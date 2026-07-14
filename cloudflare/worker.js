// DeltaIntel 分管理员后端 Worker
// 功能：
//   1) 分管理员 / 总管理员 账号登录（邮箱或手机号 + 密码，或验证码免密）
//   2) 验证码发放（开发模式直接回显；可选接入 Cloudflare MailChannels / EmailJS 真发信）
//   3) 会话管理（Bearer Token 存 KV）
//   4) 账号管理（总管理员创建 / 列出分管理员）
//   5) 代理 data.json 与文件读写到 GitHub 仓库（Worker 持有 GH_TOKEN，子管理员无需各自的 Token）
//
// 前端 admin.html 通过 wkFetch 调用以下接口：
//   POST /api/send-code            {to}                      -> {ok, devCode?}
//   POST /api/admin-login          {id, password} | {email, code} -> {session, role, email}
//   POST /api/logout               -> {ok}
//   GET  /api/me                   -> {role, email}
//   GET  /api/admin/users          (super)                   -> {users:[{email,phone,role,disabled}]}
//   POST /api/admin/create-subadmin (super) {email,password,phone,role,panels[]} -> {ok, role, panels[]}
//   GET  /api/admin/members         (super | 用户管理分管理员)  -> {members:[{id,email,phone,name,disabled,createdAt}]}
//   PUT  /api/admin/member           (super | 用户管理分管理员)  {id, disabled} -> {ok, disabled}
//   DELETE /api/admin/member         (super | 用户管理分管理员)  {id} -> {ok}
//   AI 审核（可选）：配置 AI_API_KEY + AI_API_URL 后，论坛发帖自动 approve/reject，敏感词或异常转人工
//   GET  /api/admin/data           -> {content:"<json string>"}
//   PUT  /api/admin/data           {content:"<json string>"} -> {ok}
//   PUT  /api/admin/file           {path, content(base64), message} -> {url}
//   GET  /api/kzb/diy               ?zb=&exchange=&is_bb=&is_gun=&is_hj=&is_sq=&is_tk=&is_xg= -> 代理三角洲数据帝实时卡战备（需 ORZICE_TOKEN Secret）
//
// 依赖绑定（在 wrangler.toml 配置）：
//   KV:  USERS / SESSIONS / CODES
//   vars:REPO, DEV_MODE
//   secrets: GH_TOKEN, SUPER_EMAIL, SUPER_PASSWORD（以及可选 EMAILJS_*；邮件用 MAIL 绑定）

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}
function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}
// 带 HTTP 状态码的错误（权限类用，便于返回 401/403 而非 500）
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ============ 工具函数 ============ */
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
const enc = new TextEncoder();

// PBKDF2 密码哈希（Web Crypto）
async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMat, 256);
  return bufToHex(bits);
}
async function newSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return bufToHex(b);
}

// UTF-8 安全的 base64（用于写 GitHub）
function b64utf8(str) {
  const bytes = enc.encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64decodeUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
// 解析 "k=v&k2=v2"（QQ token 接口返回格式）
function parseQueryString(str) {
  const out = {};
  String(str || "").split("&").forEach(function (kv) {
    const i = kv.indexOf("=");
    if (i < 0) return;
    const k = kv.slice(0, i);
    const v = kv.slice(i + 1);
    if (k) out[k] = decodeURIComponent(v.replace(/\+/g, " "));
  });
  return out;
}
// 从 "callback({ ... })" 文本中提取 openid
function extractOpenid(text) {
  const m = String(text || "").match(/["']?openid["']?\s*:\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

/* ============ 用户存储（KV: USERS） ============ */
async function getUserById(env, id) {
  const rec = await env.USERS.get("u:" + id.toLowerCase());
  return rec ? JSON.parse(rec) : null;
}
async function putUser(env, user) {
  const ids = [user.email.toLowerCase()];
  if (user.phone) ids.push(user.phone.toLowerCase());
  for (const id of ids) await env.USERS.put("u:" + id, JSON.stringify(user));
}
async function allUsers(env) {
  const list = await env.USERS.list();
  const out = [];
  for (const k of list.keys) {
    if (!k.name.startsWith("u:")) continue;
    const rec = await env.USERS.get(k.name);
    if (rec) out.push(JSON.parse(rec));
  }
  return out;
}

// 首次访问时，用环境变量引导出总管理员账号（仅在尚未存在时创建一次）
async function ensureSuper(env) {
  const email = (env.SUPER_EMAIL || "").trim().toLowerCase();
  const pw = (env.SUPER_PASSWORD || "").trim();
  if (!email || !pw) return;
  const existing = await getUserById(env, email);
  if (existing) return;
  const salt = await newSalt();
  const hash = await hashPassword(pw, salt);
  await putUser(env, { email, phone: "", role: "super", salt, hash, disabled: false });
}

/* ============ 会话（KV: SESSIONS） ============ */
async function getSession(env, req) {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1];
  const rec = await env.SESSIONS.get("sess:" + token);
  if (!rec) return null;
  const s = JSON.parse(rec);
  if (s.exp && s.exp < Date.now()) {
    await env.SESSIONS.delete("sess:" + token);
    return null;
  }
  return s;
}
async function createSession(env, email, role, panels, device) {
  const token = randToken();
  const s = { email, role, exp: Date.now() + 7 * 86400 * 1000, at: Date.now() };
  if (panels && panels.length) s.panels = panels;
  if (device) s.device = device;
  await env.SESSIONS.put("sess:" + token, JSON.stringify(s), { expirationTtl: 7 * 86400 + 60 });
  // 维护 per-user 会话索引（用于「多端/设备管理」，可看到在哪些设备登录、远程踢下线）
  try {
    const idxKey = "sessions:" + email;
    let idx = [];
    const raw = await env.SESSIONS.get(idxKey);
    if (raw) { try { idx = JSON.parse(raw); } catch (e) {} }
    idx = idx.filter(function (x) { return x.token !== token; });
    idx.push({ token: token, role: role, device: device || null, at: Date.now() });
    await env.SESSIONS.put(idxKey, JSON.stringify(idx), { expirationTtl: 30 * 86400 + 60 });
  } catch (e) {}
  return token;
}
// 解析 User-Agent → 浏览器 / 系统（用于设备管理展示）
function parseUA(ua) {
  ua = (ua || "").toLowerCase();
  var browser = "未知浏览器", os = "未知系统";
  if (ua.indexOf("edg") >= 0) browser = "Edge";
  else if (ua.indexOf("chrome") >= 0 && ua.indexOf("chromium") < 0) browser = "Chrome";
  else if (ua.indexOf("firefox") >= 0) browser = "Firefox";
  else if (ua.indexOf("safari") >= 0 && ua.indexOf("chrome") < 0) browser = "Safari";
  else if (ua.indexOf("micromessenger") >= 0) browser = "微信内置";
  else if (ua.indexOf("qq") >= 0) browser = "QQ浏览器";
  if (ua.indexOf("iphone") >= 0 || ua.indexOf("ipad") >= 0) os = "iOS";
  else if (ua.indexOf("android") >= 0) os = "Android";
  else if (ua.indexOf("windows") >= 0) os = "Windows";
  else if (ua.indexOf("mac os") >= 0 || ua.indexOf("macintosh") >= 0) os = "macOS";
  else if (ua.indexOf("linux") >= 0) os = "Linux";
  return { browser: browser, os: os, ua: (ua || "") };
}
// 列出某用户全部会话（自动清理失效项，标记本机）
async function listSessions(env, email, currentToken) {
  const idxKey = "sessions:" + email;
  let idx = [];
  const raw = await env.SESSIONS.get(idxKey);
  if (raw) { try { idx = JSON.parse(raw); } catch (e) {} }
  var live = [];
  for (var i = 0; i < idx.length; i++) {
    const it = idx[i];
    const rec = await env.SESSIONS.get("sess:" + it.token);
    if (!rec) continue;
    var s; try { s = JSON.parse(rec); } catch (e) { continue; }
    if (s.exp && s.exp < Date.now()) { try { await env.SESSIONS.delete("sess:" + it.token); } catch (e) {} continue; }
    live.push({ token: it.token, role: it.role, device: it.device || null, at: it.at, current: it.token === currentToken });
  }
  if (live.length !== idx.length) {
    try {
      await env.SESSIONS.put(idxKey, JSON.stringify(live.map(function (x) {
        return { token: x.token, role: x.role, device: x.device, at: x.at };
      })), { expirationTtl: 30 * 86400 + 60 });
    } catch (e) {}
  }
  live.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  return live;
}
async function revokeSession(env, email, token) {
  try { await env.SESSIONS.delete("sess:" + token); } catch (e) {}
  const idxKey = "sessions:" + email;
  let idx = [];
  const raw = await env.SESSIONS.get(idxKey);
  if (raw) { try { idx = JSON.parse(raw); } catch (e) {} }
  idx = idx.filter(function (x) { return x.token !== token; });
  try { await env.SESSIONS.put(idxKey, JSON.stringify(idx), { expirationTtl: 30 * 86400 + 60 }); } catch (e) {}
  return true;
}

/* ============ 鉴权辅助 ============ */
async function requireLogin(env, req) {
  const s = await getSession(env, req);
  if (!s) throw new HttpError(401, "未登录或会话已过期");
  try {
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
    const country = (req.cf && req.cf.country) || "";
    await updatePresence(env, s.email, { ip: ip, country: country });
  } catch (e) {}
  return s;
}
async function requireSuper(env, req) {
  const s = await requireLogin(env, req);
  if (s.role !== "super") throw new HttpError(403, "需要总管理员权限");
  return s;
}
// 仅后台员工（总管理员 / 分管理员）可访问后台数据接口；普通用户（role=user）被拒
async function requireStaff(env, req) {
  const s = await requireLogin(env, req);
  if (s.role === "user") throw new HttpError(403, "普通用户无权访问后台数据");
  return s;
}

/* ============ GitHub 代理 ============ */
function ghHeaders(env) {
  return {
    Authorization: "Bearer " + env.GH_TOKEN,
    Accept: "application/vnd.github+json",
    "User-Agent": "delta-intel-worker",
    "Content-Type": "application/json",
  };
}
async function ghGetData(env) {
  const url = `https://api.github.com/repos/${env.REPO}/contents/docs/data.json`;
  const r = await fetch(url, { headers: ghHeaders(env) });
  if (!r.ok) throw new Error("GitHub 读取失败 HTTP " + r.status);
  const j = await r.json();
  return { content: b64decodeUtf8(j.content), sha: j.sha };
}
async function ghPutData(env, contentStr, message) {
  const { sha } = await ghGetData(env); // 取最新 sha，避免冲突
  const url = `https://api.github.com/repos/${env.REPO}/contents/docs/data.json`;
  const body = { message: message || "[分管理员] 更新数据", content: b64utf8(contentStr), sha };
  const r = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || "GitHub 写入失败 HTTP " + r.status);
  }
  return true;
}
async function ghPutFile(env, path, contentB64, message) {
  let p = (path || "").replace(/^\/+/, "");
  if (!p.startsWith("docs/")) p = "docs/" + p;
  const url = `https://api.github.com/repos/${env.REPO}/contents/${p}`;
  let sha;
  const r0 = await fetch(url, { headers: ghHeaders(env) });
  if (r0.ok) {
    const j = await r0.json();
    sha = j.sha;
  }
  const body = { message: message || "上传文件", content: contentB64 };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || "文件上传失败");
  }
  const j = await r.json();
  return j.content ? j.content.download_url : null;
}

/* ============ 扩展存储（KV: ACCESS / PRESENCE / FRIENDS / MESSAGES / AVATARS） ============ */
async function recordAccess(env, rec) {
  try {
    const idx = await env.ACCESS.get("idx:access");
    const arr = idx ? JSON.parse(idx) : [];
    arr.unshift(rec);
    if (arr.length > 2000) arr.length = 2000;
    await env.ACCESS.put("idx:access", JSON.stringify(arr));
  } catch (e) {}
}
async function updatePresence(env, email, meta) {
  try {
    await env.PRESENCE.put("p:" + email.toLowerCase(), JSON.stringify(Object.assign({ ts: Date.now() }, meta || {})));
  } catch (e) {}
}
async function getPresence(env, email) {
  try { const r = await env.PRESENCE.get("p:" + email.toLowerCase()); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
function isOnline(p) { return !!(p && p.ts && (Date.now() - p.ts) < 5 * 60 * 1000); }
async function friendKey(env, a, b) { return "fr:" + [a.toLowerCase(), b.toLowerCase()].sort().join("|"); }
async function putFriend(env, a, b, rec) { await env.FRIENDS.put(await friendKey(env, a, b), JSON.stringify(rec)); }
async function getFriend(env, a, b) { const r = await env.FRIENDS.get(await friendKey(env, a, b)); return r ? JSON.parse(r) : null; }
async function delFriend(env, a, b) { await env.FRIENDS.delete(await friendKey(env, a, b)); }
async function friendListKeys(env) { const list = await env.FRIENDS.list(); return list.keys.map((k) => k.name); }
async function pushMessage(env, a, b, msg) {
  const key = "msg:" + (await friendKey(env, a, b)).slice(3);
  const r = await env.MESSAGES.get(key);
  const arr = r ? JSON.parse(r) : [];
  arr.push(msg);
  if (arr.length > 500) arr.shift();
  await env.MESSAGES.put(key, JSON.stringify(arr));
}
async function getMessages(env, a, b) {
  const key = "msg:" + (await friendKey(env, a, b)).slice(3);
  const r = await env.MESSAGES.get(key);
  return r ? JSON.parse(r) : [];
}
function b64decodeBytes(b64) {
  try {
    const bin = atob(String(b64).replace(/^data:[^;]+;base64,/, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (e) { return null; }
}

/* ============ 访问日志 / 在线状态（管理员） ============ */
async function listAccess(env, isSuper) {
  const idx = await env.ACCESS.get("idx:access");
  const log = idx ? JSON.parse(idx) : [];
  const plist = await env.PRESENCE.list();
  const online = [];
  for (const k of plist.keys) {
    const rec = JSON.parse(await env.PRESENCE.get(k.name));
    const email = k.name.slice(2);
    const u = await getUserById(env, email).catch(function () { return null; });
    online.push({ id: email, name: u ? (u.name || email) : email, country: rec.country || "", ts: rec.ts, ip: isSuper ? (rec.ip || "") : "" });
  }
  const byCountry = {};
  log.forEach(function (e) { if (e.country) byCountry[e.country] = (byCountry[e.country] || 0) + 1; });
  const out = { total: log.length, online: online, byCountry: byCountry, generatedAt: Date.now() };
  if (isSuper) out.log = log.slice(0, 200);
  return out;
}
async function cfAnalytics(env) {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) return null;
  try {
    const url = "https://api.cloudflare.com/client/v4/zones/" + encodeURIComponent(env.CF_ZONE_ID) + "/analytics/dashboard?since=-1440";
    const r = await fetch(url, { headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const t = j && j.result && j.result.totals;
    if (!t) return null;
    return { visits: t.visits, uniques: t.uniques, pageViews: t.pageViews, requests: t.requests, bytes: t.bytes };
  } catch (e) { return null; }
}

/* ============ 好友系统 ============ */
async function searchUsers(env, q, exceptId) {
  q = (q || "").trim().toLowerCase();
  if (!q) return [];
  const list = await env.USERS.list();
  const out = [];
  for (const k of list.keys) {
    if (!k.name.startsWith("u:")) continue;
    const u = JSON.parse(await env.USERS.get(k.name));
    const id = (u.email || u.phone || "").toLowerCase();
    const name = (u.name || "").toLowerCase();
    if (id === exceptId.toLowerCase() || name === exceptId.toLowerCase()) continue;
    if (id.includes(q) || name.includes(q)) {
      out.push({ id: u.email || u.phone, name: u.name || "", avatar: u.avatar || "" });
      if (out.length >= 20) break;
    }
  }
  return out;
}
async function friendView(env, me) {
  const keys = await friendListKeys(env);
  const friends = [], incoming = [], outgoing = [];
  for (const key of keys) {
    const parts = key.slice(3).split("|");
    const other = parts[0] === me.toLowerCase() ? parts[1] : (parts[1] === me.toLowerCase() ? parts[0] : null);
    if (!other) continue;
    const rec = JSON.parse(await env.FRIENDS.get(key));
    const u = await getUserById(env, other).catch(function () { return null; });
    const p = await getPresence(env, other);
    const item = { id: other, name: u ? (u.name || other) : other, avatar: u ? (u.avatar || "") : "", online: isOnline(p), lastSeen: p ? p.ts : null, status: rec.status, from: rec.from };
    if (rec.status === "accepted") friends.push(item);
    else if (rec.from === me.toLowerCase()) outgoing.push(item);
    else incoming.push(item);
  }
  return { friends: friends, incoming: incoming, outgoing: outgoing };
}

/* ============ 微信登录（OAuth2 骨架；配置 WECHAT_APPID / WECHAT_APPKEY 后启用，前端默认隐藏） ============ */
async function wxAuthStart(env, url) {
  const appid = env.WECHAT_APPID, secret = env.WECHAT_APPKEY;
  const frontend = url.searchParams.get("redirect") || (url.origin.replace(/^https?:\/\/api\./, "https://") + "/forum.html");
  if (!appid || !secret) {
    const sep = frontend.includes("?") ? "&" : "?";
    return Response.redirect(frontend + sep + "wx_error=not_configured", 302);
  }
  const state = randToken();
  await env.CODES.put("wxstate:" + state, frontend, { expirationTtl: 600 });
  const cb = url.origin + "/api/auth/wechat/callback";
  const authUrl = "https://open.weixin.qq.com/connect/qrconnect?appid=" + encodeURIComponent(appid) +
    "&redirect_uri=" + encodeURIComponent(cb) + "&response_type=code&scope=snsapi_login&state=" + state;
  return Response.redirect(authUrl, 302);
}
async function wxAuthCallback(env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appid = env.WECHAT_APPID, secret = env.WECHAT_APPKEY;
  let frontend = url.origin.replace(/^https?:\/\/api\./, "https://") + "/forum.html";
  if (code && state && appid && secret) {
    const saved = await env.CODES.get("wxstate:" + state);
    if (saved) { await env.CODES.delete("wxstate:" + state); frontend = saved; }
    try {
      const tokUrl = "https://api.weixin.qq.com/sns/oauth2/access_token?appid=" + encodeURIComponent(appid) +
        "&secret=" + encodeURIComponent(secret) + "&code=" + encodeURIComponent(code) + "&grant_type=authorization_code";
      const tok = await (await fetch(tokUrl)).json();
      if (tok && tok.access_token && tok.openid) {
        const uiUrl = "https://api.weixin.qq.com/sns/userinfo?access_token=" + encodeURIComponent(tok.access_token) + "&openid=" + encodeURIComponent(tok.openid);
        const ui = await (await fetch(uiUrl)).json().catch(function () { return {}; });
        const wid = "wx:" + tok.openid;
        let user = await getUserById(env, wid);
        if (!user) {
          user = { email: wid, phone: "", role: "user", oauth: "wechat", name: ui.nickname || "微信用户", avatar: ui.headimgurl || "", disabled: false };
          await putUser(env, user);
        }
        const token = await createSession(env, wid, "user");
        const sep = frontend.includes("?") ? "&" : "?";
        return Response.redirect(frontend + sep + "token=" + encodeURIComponent(token) + "&id=" + encodeURIComponent(user.name || "微信用户") + "&role=user", 302);
      }
    } catch (e) {}
  }
  const sep = frontend.includes("?") ? "&" : "?";
  return Response.redirect(frontend + sep + "wx_error=auth_failed", 302);
}

/* ============ 业务逻辑 ============ */
async function qqAuthStart(env, url) {
  const appid = env.QQ_APPID, appkey = env.QQ_APPKEY;
  const frontend = url.searchParams.get("redirect") || (url.origin.replace(/^https?:\/\/api\./, "https://") + "/forum.html");
  if (!appid || !appkey) {
    const sep = frontend.includes("?") ? "&" : "?";
    return Response.redirect(frontend + sep + "qq_error=not_configured", 302);
  }
  const state = randToken();
  await env.CODES.put("qqstate:" + state, frontend, { expirationTtl: 600 });
  const cb = url.origin + "/api/auth/qq/callback";
  const authUrl = "https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=" +
    encodeURIComponent(appid) + "&redirect_uri=" + encodeURIComponent(cb) +
    "&state=" + state + "&scope=get_user_info";
  return Response.redirect(authUrl, 302);
}

async function qqAuthCallback(env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appid = env.QQ_APPID, appkey = env.QQ_APPKEY;
  let frontend = url.origin.replace(/^https?:\/\/api\./, "https://") + "/forum.html";
  if (code && state && appid && appkey) {
    const saved = await env.CODES.get("qqstate:" + state);
    if (saved) { await env.CODES.delete("qqstate:" + state); frontend = saved; }
    if (saved) {
      try {
        const tokenUrl = "https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=" +
          encodeURIComponent(appid) + "&client_secret=" + encodeURIComponent(appkey) +
          "&code=" + encodeURIComponent(code) + "&redirect_uri=" + encodeURIComponent(url.origin + "/api/auth/qq/callback");
        const tokText = await (await fetch(tokenUrl)).text();
        const at = parseQueryString(tokText).access_token;
        if (at) {
          const meText = await (await fetch("https://graph.qq.com/oauth2.0/me?access_token=" + encodeURIComponent(at))).text();
          const openid = extractOpenid(meText);
          if (openid) {
            const uiResp = await fetch("https://graph.qq.com/user/get_user_info?access_token=" +
              encodeURIComponent(at) + "&oauth_consumer_key=" + encodeURIComponent(appid) + "&openid=" + encodeURIComponent(openid));
            const ui = await uiResp.json().catch(function () { return {}; });
            const qid = "qq:" + openid;
            let user = await getUserById(env, qid);
            if (!user) {
              user = { email: qid, phone: "", role: "user", oauth: "qq", name: ui.nickname || "QQ用户", avatar: ui.figureurl_qq_1 || ui.figureurl || "", disabled: false };
              await putUser(env, user);
            }
            const token = await createSession(env, qid, "user");
            const sep = frontend.includes("?") ? "&" : "?";
            return Response.redirect(frontend + sep + "token=" + encodeURIComponent(token) +
              "&id=" + encodeURIComponent(user.name || "QQ用户") + "&role=user", 302);
          }
        }
      } catch (e) {}
    }
  }
  const sep = frontend.includes("?") ? "&" : "?";
  return Response.redirect(frontend + sep + "qq_error=auth_failed", 302);
}

async function sendCode(env, body) {
  await ensureSuper(env);
  const to = (body.to || "").trim().toLowerCase();
  if (!to) return json({ error: "缺少邮箱或手机号" }, 400);
  const isPhone = !to.includes("@") && /^\+?\d{6,15}$/.test(to);
  const purpose = (body.purpose || "login").toLowerCase();
  if (purpose === "login") {
    const user = await getUserById(env, to);
    if (!user) return json({ error: "该账号不存在，请先注册" }, 400);
  } else if (purpose === "register") {
    if (await getUserById(env, to)) return json({ error: "该账号已注册，请直接登录" }, 400);
  }
  const code = genCode();
  await env.CODES.put("code:" + to, code, { expirationTtl: 300 });

  const mail = env.MAIL; // Cloudflare 自带发信绑定（MailChannels）
  const hasEmailJS = env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY;
  const sms = env.SMS_GATEWAY; // 短信网关标识（如 "aliyun"）；未配置则手机验证码回显

  if (isPhone) {
    // 手机号：配置了短信网关才真发；否则回显到屏幕（未配置/开发环境友好，配好短信后不再回显）
    if (sms) {
      try { await sendSMS(env, to, code); return json({ ok: true }); }
      catch (e) { return json({ ok: true, devCode: code, smsError: String((e && e.message) || e) }); }
    }
    return json({ ok: true, devCode: code });
  }
  // 邮箱：配置了发信通道才真发；否则回显。配置完成后屏幕不再显示验证码。
  if (mail || hasEmailJS) {
    try {
      if (mail) await sendViaMail(env, to, code);          // 优先 Cloudflare MailChannels
      else if (hasEmailJS) await sendEmailJS(env, to, code); // 备选 EmailJS
      return json({ ok: true });
    } catch (e) {
      // 邮件发送失败（域名未开 Email Routing / DNS 未配 / 被收件方拒收）也回显，避免卡死
      return json({ ok: true, devCode: code, mailError: String((e && e.message) || e) });
    }
  }
  return json({ ok: true, devCode: code });
}

// 短信发送（预留：需短信网关且要实名；当前未配置，sendCode 走回显分支）
async function sendSMS(env, to, code) {
  if ((env.SMS_GATEWAY || "") !== "aliyun") throw new Error("短信网关未配置");
  // TODO: 接入阿里云短信（需已实名账号 + AccessKey）；当前未实现，落到回显兜底
  throw new Error("短信发送尚未实现（需实名短信服务）");
}

async function adminLogin(env, body, req) {
  await ensureSuper(env);
  const id = (body.id || body.email || "").trim().toLowerCase();
  if (!id) return json({ error: "缺少账号" }, 400);
  const user = await getUserById(env, id);
  if (!user || user.disabled) return json({ error: "账号不存在或已禁用" }, 401);
  // 总管理员仅支持密码登录，不支持验证码
  if (user.role === "super" && body.code) {
    return json({ error: "总管理员仅支持密码登录，不支持验证码" }, 400);
  }

  let ok = false;
  if (body.code) {
    const stored = await env.CODES.get("code:" + id);
    ok = !!stored && stored === String(body.code).trim();
    if (ok) await env.CODES.delete("code:" + id); // 一次性
  } else if (body.password) {
    const hash = await hashPassword(body.password, user.salt);
    ok = hash === user.hash;
  }
  if (!ok) return json({ error: "账号或密码/验证码错误" }, 401);

  const panels = (user.panels && user.panels.length) ? user.panels : (DEFAULT_PANELS[user.role] || ["dashboard"]);
  const device = parseUA(req ? req.headers.get("user-agent") : "");
  const token = await createSession(env, user.email, user.role, panels, device);
  return json({ session: token, role: user.role, email: user.email, panels });
}

// 分管理员默认面板（兼容未存 panels 的旧分管理员；前端按角色查；新创建以传来的 panels 为准）
const DEFAULT_PANELS = {
  super: ["dashboard","tasks","music","art","sim","code","opcode","wcodex","trivia","uidesign","gun","door","events","streamer","optask","melee","feedback","armors","scopes","npc","upgrades","expansion","keyrooms","collectibles","bulletpacks","changelog","eventitems","sponsor","analytics","liveprice","mappass","subadmins","usermgr","site","guides","craft","quiz","materials","rigs","containers","scatter","items","bullets","maps","announce","ugc"],
  tasks: ["tasks"], music: ["music"], art: ["art","images"], sim: ["sim"], code: ["code"],
  opcode: ["opcode"], wcodex: ["wcodex"], data: ["gun","door","events","streamer","optask","melee","feedback","armors","scopes","npc","upgrades","expansion","keyrooms","collectibles","bulletpacks","eventitems"],
  usermgr: ["usermgr"]
};

async function createSubadmin(env, body) {
  const contact = (body.contact || "").trim().toLowerCase();
  const pw = body.password || "";
  const role = body.role || "subadmin";
  const isEmail = contact.indexOf("@") >= 0;
  const phoneOk = /^\+?\d{6,15}$/.test(contact);
  if (!contact || (!isEmail && !phoneOk)) return json({ error: "联系方式格式不正确（需为邮箱或手机号）" }, 400);
  if (pw.length < 6) return json({ error: "密码至少 6 位" }, 400);
  if (role === "super") return json({ error: "不能创建总管理员" }, 400);
  if (await getUserById(env, contact)) return json({ error: "该联系方式已存在" }, 400);

  const email = isEmail ? contact : "";
  const phone = isEmail ? "" : contact;

  // 面板权限：优先用前端传来的多选；否则按角色回退默认面板（兼容旧分管理员）
  const panels = (Array.isArray(body.panels) && body.panels.length) ? body.panels : (DEFAULT_PANELS[role] || ["dashboard"]);
  const salt = await newSalt();
  const hash = await hashPassword(pw, salt);
  await putUser(env, { email, phone, role, panels, salt, hash, disabled: false });
  return json({ ok: true, role, panels });
}

/* ============ 普通用户：注册 / 登录 ============ */
async function registerUser(env, body, req) {
  const id = (body.id || "").trim().toLowerCase();
  if (!id) return json({ error: "请输入邮箱或手机号" }, 400);
  const isEmail = id.indexOf("@") >= 0;
  const phoneOk = /^\+?\d{6,15}$/.test(id);
  if (!isEmail && !phoneOk) return json({ error: "邮箱或手机号格式不正确" }, 400);
  if (await getUserById(env, id)) return json({ error: "该账号已注册，请直接登录" }, 400);
  // 验证码校验（DEV_MODE 下验证码回显到前端；接好 EmailJS 后改为真发信）
  const stored = await env.CODES.get("code:" + id);
  if (!stored || stored !== String(body.code || "").trim()) {
    return json({ error: "验证码错误或已过期（5 分钟内有效）" }, 400);
  }
  await env.CODES.delete("code:" + id);
  const pw = body.password || "";
  if (pw.length < 6) return json({ error: "密码至少 6 位" }, 400);
  const salt = await newSalt();
  const hash = await hashPassword(pw, salt);
  await putUser(env, {
    email: isEmail ? id : "",
    phone: isEmail ? "" : id,
    role: "user",
    salt, hash, disabled: false, createdAt: Date.now(),
  });
  const device = parseUA(req ? req.headers.get("user-agent") : "");
  const token = await createSession(env, id, "user", null, device);
  return json({ session: token, role: "user", id });
}

async function userLogin(env, body, req) {
  const id = (body.id || body.email || "").trim().toLowerCase();
  if (!id) return json({ error: "缺少账号" }, 400);
  const user = await getUserById(env, id);
  if (!user || user.disabled) return json({ error: "账号不存在或已禁用" }, 401);
  let ok = false;
  if (body.code) {
    const stored = await env.CODES.get("code:" + id);
    ok = !!stored && stored === String(body.code).trim();
    if (ok) await env.CODES.delete("code:" + id);
  } else if (body.password) {
    const hash = await hashPassword(body.password, user.salt);
    ok = hash === user.hash;
  }
  if (!ok) return json({ error: "账号或密码/验证码错误" }, 401);
  const device = parseUA(req ? req.headers.get("user-agent") : "");
  const token = await createSession(env, user.email || user.phone, user.role, null, device);
  return json({ session: token, role: user.role, id: user.email || user.phone });
}

async function sendViaMail(env, to, code) {
  if (!env.MAIL) throw new Error("no MAIL binding");
  const from = (env.MAIL_FROM || "noreply@delta.shopping").trim();
  const site = "三角洲情报台";
  const text =
    site + " 验证码\n\n你的验证码是：" + code + "\n有效期 5 分钟。如非本人操作，请忽略此邮件。\n\n" + site + " delta.shopping";
  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px">' +
    '<h2 style="margin:0 0 12px;color:#111">' + site + "</h2>" +
    '<p style="margin:0 0 16px;color:#333;font-size:15px">你的验证码是：</p>' +
    '<div style="font-size:28px;font-weight:700;letter-spacing:4px;color:#c0392b;margin:0 0 16px">' + code + "</div>" +
    '<p style="margin:0;color:#888;font-size:13px">有效期 5 分钟。如非本人操作，请忽略此邮件。</p>' +
    '<p style="margin:16px 0 0;color:#aaa;font-size:12px">' + site + " · delta.shopping</p>" +
    "</div>";
  await env.MAIL.send({ from: from, to: [to], subject: "【" + site + "】你的验证码", text: text, html: html });
  return true;
}

async function sendEmailJS(env, to, code) {
  const url = "https://api.emailjs.com/api/v1.0/email/send";
  const body = {
    service_id: env.EMAILJS_SERVICE_ID,
    template_id: env.EMAILJS_TEMPLATE_ID,
    user_id: env.EMAILJS_PUBLIC_KEY,
    template_params: { to_email: to, code: code, site: "三角洲情报台" },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("EmailJS " + r.status);
  return true;
}

/* ============ 论坛（帖子存 KV: POSTS） ============ */
const POST_CAP = 500;
function genPostId() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "p" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function snippet(s, n = 120) {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
}
async function getIdx(env) {
  const r = await env.POSTS.get("idx:list");
  if (!r) return [];
  try { return JSON.parse(r); } catch (e) { return []; }
}
async function setIdx(env, arr) { await env.POSTS.put("idx:list", JSON.stringify(arr)); }
async function getPost(env, id) {
  const r = await env.POSTS.get("post:" + id);
  return r ? JSON.parse(r) : null;
}
async function createPost(env, body, sess) {
  const title = (body.title || "").trim();
  const text = (body.body || "").trim();
  if (!title) return json({ error: "标题不能为空" }, 400);
  if (!text) return json({ error: "内容不能为空" }, 400);
  const id = genPostId();
  const post = { id, author: sess.email, title, body: text, createdAt: Date.now(), replies: [] };
  await env.POSTS.put("post:" + id, JSON.stringify(post));
  const idx = await getIdx(env);
  idx.unshift({ id, author: sess.email, title, createdAt: post.createdAt, replyCount: 0, snippet: snippet(text) });
  if (idx.length > POST_CAP) idx.length = POST_CAP;
  await setIdx(env, idx);
  return json({ ok: true, id });
}
async function listPosts(env, url) {
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 50);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
  const idx = await getIdx(env);
  return json({ posts: idx.slice(offset, offset + limit), total: idx.length });
}
async function getPostApi(env, id) {
  const p = await getPost(env, id);
  if (!p) return json({ error: "帖子不存在或已删除" }, 404);
  return json({ post: p });
}
async function replyPost(env, id, body, sess) {
  const text = (body.body || "").trim();
  if (!text) return json({ error: "回复内容不能为空" }, 400);
  const p = await getPost(env, id);
  if (!p) return json({ error: "帖子不存在或已删除" }, 404);
  p.replies = p.replies || [];
  p.replies.push({ author: sess.email, body: text, createdAt: Date.now() });
  await env.POSTS.put("post:" + id, JSON.stringify(p));
  const idx = await getIdx(env);
  const it = idx.find((x) => x.id === id);
  if (it) { it.replyCount = p.replies.length; await setIdx(env, idx); }
  return json({ ok: true });
}
async function deletePost(env, id, sess) {
  const p = await getPost(env, id);
  if (!p) return json({ error: "帖子不存在" }, 404);
  const isAuthor = p.author === sess.email;
  const isStaff = sess.role === "super" || sess.role === "tasks";
  if (!isAuthor && !isStaff) return json({ error: "只能删除自己的帖子" }, 403);
  await env.POSTS.delete("post:" + id);
  const idx = await getIdx(env);
  const next = idx.filter((x) => x.id !== id);
  if (next.length !== idx.length) await setIdx(env, next);
  return json({ ok: true });
}

/* ============ 通用 id 生成 ============ */
function genId(prefix) {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return prefix + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ============ 公告（KV: ANNOUNCE） ============ */
const ANNOUNCE_CAP = 50;
async function getAnnIdx(env) { const r = await env.ANNOUNCE.get("idx:list"); try { return r ? JSON.parse(r) : []; } catch (e) { return []; } }
async function setAnnIdx(env, a) { await env.ANNOUNCE.put("idx:list", JSON.stringify(a)); }
async function createAnnounce(env, body) {
  const text = (body.text || "").trim();
  if (!text) return json({ error: "公告内容不能为空" }, 400);
  const id = genId("a");
  const rec = { id, text, color: body.color || "info", active: body.active !== false, until: body.until || null, createdAt: Date.now() };
  await env.ANNOUNCE.put("a:" + id, JSON.stringify(rec));
  const idx = await getAnnIdx(env);
  idx.unshift({ id, text, color: rec.color, active: rec.active, until: rec.until, createdAt: rec.createdAt });
  if (idx.length > ANNOUNCE_CAP) idx.length = ANNOUNCE_CAP;
  await setAnnIdx(env, idx);
  return json({ ok: true, id });
}
async function updateAnnounce(env, id, body) {
  const r = await env.ANNOUNCE.get("a:" + id);
  if (!r) return json({ error: "公告不存在" }, 404);
  const rec = JSON.parse(r);
  if (typeof body.text === "string") rec.text = body.text.trim();
  if (body.color) rec.color = body.color;
  if (typeof body.active === "boolean") rec.active = body.active;
  if ("until" in body) rec.until = body.until || null;
  await env.ANNOUNCE.put("a:" + id, JSON.stringify(rec));
  const idx = await getAnnIdx(env);
  const it = idx.find((x) => x.id === id);
  if (it) Object.assign(it, { text: rec.text, color: rec.color, active: rec.active, until: rec.until });
  await setAnnIdx(env, idx);
  return json({ ok: true });
}
async function deleteAnnounce(env, id) {
  await env.ANNOUNCE.delete("a:" + id);
  const idx = await getAnnIdx(env);
  const next = idx.filter((x) => x.id !== id);
  if (next.length !== idx.length) await setAnnIdx(env, next);
  return json({ ok: true });
}
async function listActiveAnnounce(env) {
  const idx = await getAnnIdx(env);
  const now = Date.now();
  const out = idx.filter((x) => x.active && (!x.until || x.until > now));
  return json({ announcements: out });
}

/* ============ 用户投稿 UGC（KV: UGC） ============ */
const UGC_CAP = 500;
async function getUgcIdx(env) { const r = await env.UGC.get("idx:list"); try { return r ? JSON.parse(r) : []; } catch (e) { return []; } }
async function setUgcIdx(env, a) { await env.UGC.put("idx:list", JSON.stringify(a)); }
// 敏感词快速预筛（命中直接转人工；仅做第一道过滤，语义审核交给 AI）
const SENSITIVE_WORDS = ["傻逼", "操你妈", "fuck", "shit", "广告加微信", "代练接单", "外挂出售", "色情", "赌博", "私彩", "引流", "菠菜", "加我vx", "加我微信", "代充", "刷钻"];

// AI 内容审核（可插拔：配置 AI_API_KEY + AI_API_URL 后生效；未配置/异常/敏感词一律转人工待审）
// 决策：approve=通过直接公开；reject=违规直接拒；review=转人工
async function aiModerate(env, title, body) {
  const text = ((title || "") + " " + (body || "")).toLowerCase();
  for (const w of SENSITIVE_WORDS) {
    if (w && text.indexOf(w.toLowerCase()) >= 0) return { decision: "review", reason: "命中敏感词：" + w };
  }
  const key = env.AI_API_KEY, url = env.AI_API_URL;
  if (!key || !url) return { decision: "review", reason: "AI 未配置，转人工待审" };
  try {
    const sys = "你是严格的游戏社区内容审核员，只输出一个 JSON 对象，不要任何额外文字。字段：decision(取值 approve|reject|review)，reason(简短中文理由)。approve=正常可公开；reject=广告/辱骂/色情/诈骗/违规，直接拒绝；review=不确定或疑似敏感，转人工审核。";
    const user = "请审核以下用户投稿：\n标题：" + (title || "") + "\n内容：" + (body || "");
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: env.AI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0 })
    });
    if (!r.ok) return { decision: "review", reason: "AI 接口返回 " + r.status + "，转人工" };
    const j = await r.json().catch(() => null);
    const content = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return { decision: "review", reason: "AI 返回无法解析，转人工" };
    let o; try { o = JSON.parse(m[0]); } catch (e) { return { decision: "review", reason: "AI JSON 解析失败，转人工" }; }
    if (o.decision === "approve" || o.decision === "reject" || o.decision === "review") return { decision: o.decision, reason: o.reason || "" };
    return { decision: "review", reason: "AI 决策值非法，转人工" };
  } catch (e) {
    return { decision: "review", reason: "AI 调用异常：" + (e && e.message ? e.message : e) + "，转人工" };
  }
}

async function createUgc(env, body, sess) {
  const title = (body.title || "").trim();
  const text = (body.body || "").trim();
  if (!title) return json({ error: "标题不能为空" }, 400);
  if (!text) return json({ error: "内容不能为空" }, 400);
  const id = genId("u");
  let status = "pending", rejectReason = "", aiNote = "";
  const mod = await aiModerate(env, title, text);
  if (mod.decision === "approve") { status = "approved"; aiNote = "AI 自动通过：" + (mod.reason || ""); }
  else if (mod.decision === "reject") { status = "rejected"; rejectReason = "AI 自动拒绝：" + (mod.reason || ""); }
  else { status = "pending"; aiNote = "转人工：" + (mod.reason || ""); }
  const rec = { id, author: sess.email, title, category: body.category || "攻略", body: text, status, createdAt: Date.now(), rejectReason, aiNote };
  await env.UGC.put("u:" + id, JSON.stringify(rec));
  const idx = await getUgcIdx(env);
  idx.unshift({ id, author: rec.author, title, category: rec.category, status, createdAt: rec.createdAt });
  if (idx.length > UGC_CAP) idx.length = UGC_CAP;
  await setUgcIdx(env, idx);
  return json({ ok: true, id });
}
async function listApprovedUgc(env) {
  const idx = await getUgcIdx(env);
  const out = [];
  for (const it of idx) {
    if (it.status !== "approved") continue;
    const r = await env.UGC.get("u:" + it.id);
    if (!r) continue;
    const rec = JSON.parse(r);
    out.push({ id: rec.id, author: rec.author, title: rec.title, category: rec.category, body: rec.body, createdAt: rec.createdAt });
  }
  return json({ items: out });
}
async function listAllUgc(env) { return json({ items: await getUgcIdx(env) }); }
async function listMyUgc(env, sess) {
  const idx = await getUgcIdx(env);
  return json({ items: idx.filter((x) => x.author === sess.email) });
}
async function reviewUgc(env, id, body) {
  const r = await env.UGC.get("u:" + id);
  if (!r) return json({ error: "投稿不存在" }, 404);
  const rec = JSON.parse(r);
  const st = body.status;
  if (st !== "approved" && st !== "rejected" && st !== "pending") return json({ error: "状态非法" }, 400);
  rec.status = st;
  rec.rejectReason = body.rejectReason || "";
  await env.UGC.put("u:" + id, JSON.stringify(rec));
  const idx = await getUgcIdx(env);
  const it = idx.find((x) => x.id === id);
  if (it) it.status = st;
  await setUgcIdx(env, idx);
  return json({ ok: true });
}
async function deleteUgc(env, id) {
  await env.UGC.delete("u:" + id);
  const idx = await getUgcIdx(env);
  const next = idx.filter((x) => x.id !== id);
  if (next.length !== idx.length) await setUgcIdx(env, next);
  return json({ ok: true });
}

// 手动触发 AI 审核：单条（body.id）或全部待审（body.all=true）
async function aiModerateUgc(env, body) {
  const id = (body && body.id || "").trim();
  const all = !!(body && body.all);
  if (!id && !all) return json({ error: "请提供 id（单条）或 all:true（全部待审）" }, 400);
  const results = [];
  if (id) {
    const r = await env.UGC.get("u:" + id);
    if (!r) return json({ error: "投稿不存在" }, 404);
    const rec = JSON.parse(r);
    const mod = await aiModerate(env, rec.title, rec.body);
    if (mod.decision === "approve") { rec.status = "approved"; rec.aiNote = "AI 自动通过：" + (mod.reason || ""); rec.rejectReason = ""; }
    else if (mod.decision === "reject") { rec.status = "rejected"; rec.rejectReason = "AI 自动拒绝：" + (mod.reason || ""); rec.aiNote = ""; }
    else { rec.status = "pending"; rec.aiNote = "转人工：" + (mod.reason || ""); }
    await env.UGC.put("u:" + id, JSON.stringify(rec));
    const idx = await getUgcIdx(env);
    const it = idx.find((x) => x.id === id);
    if (it) it.status = rec.status;
    await setUgcIdx(env, idx);
    results.push({ id, decision: mod.decision, status: rec.status, reason: mod.reason || "" });
    return json({ ok: true, processed: 1, results });
  }
  const idx = await getUgcIdx(env);
  const pendings = idx.filter((x) => x.status === "pending");
  for (const it of pendings) {
    const r = await env.UGC.get("u:" + it.id);
    if (!r) continue;
    const rec = JSON.parse(r);
    const mod = await aiModerate(env, rec.title, rec.body);
    let st;
    if (mod.decision === "approve") { st = "approved"; rec.aiNote = "AI 自动通过：" + (mod.reason || ""); rec.rejectReason = ""; }
    else if (mod.decision === "reject") { st = "rejected"; rec.rejectReason = "AI 自动拒绝：" + (mod.reason || ""); rec.aiNote = ""; }
    else { st = "pending"; rec.aiNote = "转人工：" + (mod.reason || ""); }
    rec.status = st;
    await env.UGC.put("u:" + it.id, JSON.stringify(rec));
    it.status = st;
    results.push({ id: it.id, decision: mod.decision, status: st, reason: mod.reason || "" });
  }
  await setUgcIdx(env, idx);
  return json({ ok: true, processed: results.length, results });
}

/* ============ 注册用户管理（仅总管理员 / 用户管理分管理员） ============ */
async function requireUserMgr(env, req) {
  const s = await requireLogin(env, req);
  if (s.role === "super") return s;
  const panels = s.panels || [];
  if (panels.indexOf("usermgr") < 0) throw new HttpError(403, "需要用户管理权限（仅总管理员或用户管理分管理员可操作）");
  return s;
}
async function listMembers(env) {
  const users = await allUsers(env);
  const members = users
    .filter((u) => u.role === "user")
    .map((u) => ({ id: (u.email || u.phone || "").toLowerCase(), email: u.email || "", phone: u.phone || "", name: u.name || "", disabled: !!u.disabled, createdAt: u.createdAt || null }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return json({ members });
}
async function setMemberDisabled(env, body) {
  const id = (body.id || "").trim().toLowerCase();
  if (!id) return json({ error: "缺少用户 id" }, 400);
  const u = await getUserById(env, id);
  if (!u || u.role !== "user") return json({ error: "用户不存在" }, 404);
  u.disabled = !!body.disabled;
  await putUser(env, u);
  return json({ ok: true, disabled: u.disabled });
}
async function deleteMember(env, body) {
  const id = (body.id || "").trim().toLowerCase();
  if (!id) return json({ error: "缺少用户 id" }, 400);
  const u = await getUserById(env, id);
  if (!u || u.role !== "user") return json({ error: "用户不存在" }, 404);
  if (u.email) await env.USERS.delete("u:" + u.email.toLowerCase());
  if (u.phone) await env.USERS.delete("u:" + u.phone.toLowerCase());
  return json({ ok: true });
}

/* ============ 评论（KV: COMMENTS） ============ */
const COMMENT_CAP = 300;
async function getComments(env, target) { const r = await env.COMMENTS.get("t:" + target); try { return r ? JSON.parse(r) : []; } catch (e) { return []; } }
async function addComment(env, target, body, sess) {
  const text = (body.body || "").trim();
  if (!text) return json({ error: "评论内容不能为空" }, 400);
  if (!target) return json({ error: "缺少评论对象" }, 400);
  const list = await getComments(env, target);
  const c = { id: genId("c"), author: sess.email, body: text, createdAt: Date.now() };
  list.push(c);
  if (list.length > COMMENT_CAP) list.shift();
  await env.COMMENTS.put("t:" + target, JSON.stringify(list));
  return json({ ok: true, comment: c });
}

/* ============ 个人主页（KV: USERS） ============ */
async function getProfile(env, id) {
  const u = await getUserById(env, id);
  if (!u) return json({ error: "用户不存在" }, 404);
  return json({ profile: { id: u.email || u.phone, name: u.name || "", bio: u.bio || "", avatar: u.avatar || "", role: u.role, joinedAt: u.createdAt || null } });
}
async function getMyProfile(env, sess) {
  const u = await getUserById(env, sess.email);
  if (!u) return json({ error: "用户不存在" }, 404);
  const ci = checkinInfo(u);
  return json({ profile: { id: u.email || u.phone, name: u.name || "", bio: u.bio || "", avatar: u.avatar || "", role: u.role, joinedAt: u.createdAt || null, points: ci.points, streak: ci.streak, lastCheckin: ci.lastCheckin, level: ci.level, next: ci.next, into: ci.into, checkedInToday: ci.checkedInToday } });
}
async function updateProfile(env, body, sess) {
  const u = await getUserById(env, sess.email);
  if (!u) return json({ error: "用户不存在" }, 404);
  if (typeof body.name === "string") u.name = body.name.slice(0, 30);
  if (typeof body.bio === "string") u.bio = body.bio.slice(0, 300);
  if (typeof body.avatar === "string") u.avatar = body.avatar.slice(0, 500);
  await putUser(env, u);
  return json({ ok: true, profile: { id: u.email || u.phone, name: u.name || "", bio: u.bio || "", avatar: u.avatar || "", role: u.role } });
}

/* ============ 每日签到 + 积分 ============ */
// 按北京时间(Asia/Shanghai)取当天日期，避免跨日时区错乱
function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD
}
function ydayStr(today) {
  const d = new Date(today + "T00:00:00+08:00");
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}
function levelOf(points) {
  const p = points || 0;
  const level = Math.floor(p / 100) + 1;
  const next = level * 100;
  return { level, next, into: p - (level - 1) * 100 };
}
function checkinInfo(u) {
  const t = todayStr();
  const lv = levelOf(u.points || 0);
  return {
    checkedInToday: (u.lastCheckin || "") === t,
    points: u.points || 0,
    streak: u.streak || 0,
    lastCheckin: u.lastCheckin || null,
    level: lv.level,
    next: lv.next,
    into: lv.into,
  };
}
async function doCheckIn(env, s) {
  const u = await getUserById(env, s.email);
  if (!u) throw new HttpError(404, "用户不存在");
  const t = todayStr();
  if ((u.lastCheckin || "") === t) {
    return { ok: true, already: true, ...checkinInfo(u) };
  }
  const ys = ydayStr(t);
  const streak = (u.lastCheckin || "") === ys ? (u.streak || 0) + 1 : 1;
  const gained = 5 + Math.min(streak - 1, 10) * 2; // 首日 5 分，连签每日 +2，第 11 天起封顶 25
  u.points = (u.points || 0) + gained;
  u.streak = streak;
  u.lastCheckin = t;
  u.checkinDays = (u.checkinDays || 0) + 1;
  await putUser(env, u);
  return { ok: true, already: false, gained, ...checkinInfo(u) };
}

/* ============ 全站搜索（论坛 + 投稿） ============ */
async function searchContent(env, q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return json({ results: [] });
  const results = [];
  const pidx = await getIdx(env);
  for (const it of pidx) {
    if ((it.title || "").toLowerCase().includes(q) || (it.snippet || "").toLowerCase().includes(q)) {
      results.push({ type: "forum", id: it.id, title: it.title, snippet: it.snippet, author: it.author, createdAt: it.createdAt, url: "forum.html#post-" + it.id });
    }
  }
  const uidx = await getUgcIdx(env);
  for (const it of uidx) {
    if (it.status !== "approved") continue;
    const r = await env.UGC.get("u:" + it.id);
    if (!r) continue;
    const rec = JSON.parse(r);
    if ((rec.title || "").toLowerCase().includes(q) || (rec.body || "").toLowerCase().includes(q)) {
      results.push({ type: "ugc", id: it.id, title: rec.title, snippet: snippet(rec.body), author: rec.author, createdAt: rec.createdAt, url: "ugc.html#" + it.id });
    }
  }
  results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return json({ results: results.slice(0, 50) });
}

/* ============ 路由 ============ */
/* ============ 智能卡战备代理（三角洲数据帝 orzice.com 实时卡战备） ============ */
async function kzbDiy(env, url) {
  const token = env.ORZICE_TOKEN;
  if (!token) {
    // 未配置 token：前端自动回退到本地模板估算，这里给明确标记
    return json({ error: "未配置 ORZICE_TOKEN（在 Cloudflare Worker 添加 Secret 后启用实时卡战备）", needToken: true }, 200);
  }
  const allowed = ["zb", "exchange", "is_bb", "is_gun", "is_hj", "is_sq", "is_tk", "is_xg"];
  const qs = new URLSearchParams();
  for (const k of allowed) {
    const v = url.searchParams.get(k);
    if (v !== null && v !== "") qs.set(k, v);
  }
  qs.set("token", token);
  const upstream = "https://orzice.com/workApi/v1/sjz_api/jzv3_diy?" + qs.toString();
  try {
    const r = await fetch(upstream, { headers: { "User-Agent": "DeltaIntel/1.0" } });
    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch (e) {
      return json({ error: "上游返回非 JSON：" + txt.slice(0, 200), upstreamStatus: r.status }, 502);
    }
    return json(data, r.status === 200 ? 200 : 502);
  } catch (e) {
    return json({ error: "调用卡战备接口失败：" + (e && e.message ? e.message : e), needToken: !token }, 502);
  }
}

/* ============ 全球实时排行榜（KV: LB） ============ */
// 支持的游戏 key（与前端 games.js 中 GAME 的 tab 一致）
const LB_GAMES = ["morse", "pc", "react", "brain", "fp", "quiz"];
function lbPeriodMs(period) {
  if (period === "week") return 7 * 86400 * 1000;
  if (period === "month") return 30 * 86400 * 1000;
  return Infinity;
}
async function leaderboardGet(env, url) {
  if (!env.LB) return json({ error: "未配置排行榜 KV（在 Cloudflare Worker 绑定 LB 命名空间后启用）", needKv: true }, 200);
  const game = (url.searchParams.get("game") || "all").toLowerCase();
  const period = (url.searchParams.get("period") || "all").toLowerCase();
  const since = Date.now() - lbPeriodMs(period);
  // 可选会话：用于标注「你的排名」（不强制登录）
  let myEmail = null;
  try { const auth = request.headers.get("Authorization") || ""; const m = auth.match(/^Bearer\s+(.+)$/i); if (m) { const rec = await env.SESSIONS.get("sess:" + m[1]); if (rec) { const s = JSON.parse(rec); if (!s.exp || s.exp >= Date.now()) myEmail = s.email.toLowerCase(); } } } catch (e) {}
  let rows = [];
  if (game === "all") {
    // 汇总：每个用户取其各游戏最高分之和
    const listed = await env.LB.list({ prefix: "lb:" });
    const byUser = {};
    for (const k of listed.keys) {
      const m = k.name.match(/^lb:(.+?):(.+)$/); // lb:<game>:<email>
      if (!m) continue;
      const g = m[1], email = m[2];
      let rec; try { rec = JSON.parse(await env.LB.get(k.name)); } catch (e) { continue; }
      if (!rec || rec.at < since) continue;
      if (!byUser[email]) byUser[email] = { name: rec.name, perGame: {}, at: 0 };
      if (!(g in byUser[email].perGame) || rec.score > byUser[email].perGame[g]) byUser[email].perGame[g] = rec.score;
      if (rec.at > byUser[email].at) byUser[email].at = rec.at;
    }
    rows = Object.keys(byUser).map(function (email) {
      const u = byUser[email];
      const total = Object.keys(u.perGame).reduce(function (a, g) { return a + u.perGame[g]; }, 0);
      return { name: u.name, email: email, score: total, at: u.at };
    });
  } else {
    if (LB_GAMES.indexOf(game) < 0) return json({ error: "未知游戏：" + game }, 400);
    const listed = await env.LB.list({ prefix: "lb:" + game + ":" });
    for (const k of listed.keys) {
      let rec; try { rec = JSON.parse(await env.LB.get(k.name)); } catch (e) { continue; }
      if (!rec || rec.at < since) continue;
      rows.push({ name: rec.name, score: rec.score, at: rec.at });
    }
  }
  rows.sort(function (a, b) { return b.score - a.score || b.at - a.at; });
  const top = rows.slice(0, 50).map(function (r, i) { return { rank: i + 1, name: r.name, email: r.email, score: r.score, at: r.at }; });
  let myRank = null, myScore = null;
  if (myEmail) {
    const me = rows.find(function (r) { return (r.email || "").toLowerCase() === myEmail; });
    if (me) { myRank = rows.indexOf(me) + 1; myScore = me.score; }
  }
  return json({ ok: true, game: game, period: period, total: rows.length, rows: top, myRank: myRank, myScore: myScore, myEmail: myEmail });
}
async function leaderboardPost(env, request, body) {
  if (!env.LB) return json({ error: "未配置排行榜 KV（在 Cloudflare Worker 绑定 LB 命名空间后启用）", needKv: true }, 200);
  const s = await requireLogin(env, request); // 必须登录，防匿名刷榜
  const game = (body.game || "").toLowerCase();
  const score = Math.floor(Number(body.score));
  if (LB_GAMES.indexOf(game) < 0) return json({ error: "未知游戏：" + game }, 400);
  if (!isFinite(score) || score <= 0) return json({ error: "分数无效" }, 400);
  const email = s.email.toLowerCase();
  const u = await getUserById(env, s.email).catch(function () { return null; });
  const name = (u && u.name) || email.split("@")[0];
  const key = "lb:" + game + ":" + email;
  const old = await env.LB.get(key);
  let cur = null; try { cur = old ? JSON.parse(old) : null; } catch (e) {}
  // 只保存历史最高分
  if (!cur || score > cur.score) {
    await env.LB.put(key, JSON.stringify({ score: score, name: name, at: Date.now() }));
  }
  // 计算当前排名（该游戏总榜）
  const listed = await env.LB.list({ prefix: "lb:" + game + ":" });
  let better = 0;
  for (const k of listed.keys) {
    let rec; try { rec = JSON.parse(await env.LB.get(k.name)); } catch (e) { continue; }
    if (rec && rec.score > score) better++;
  }
  return json({ ok: true, rank: better + 1, game: game, score: score });
}

async function handle(request, env) {
  if (request.method === "OPTIONS") return corsPreflight();
  const url = new URL(request.url);
  const p = url.pathname;
  let body = {};
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const t = await request.text();
      if (t) body = JSON.parse(t);
    }
  } catch (e) {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  /* 访问日志：记录页面与 API 请求（跳过 css/js/图片等静态资源） */
  try {
    const skipStatic = /\.(css|js|svg|jpg|jpeg|png|gif|ico|woff2?|ttf|json|webmanifest)$/i.test(p);
    if (!skipStatic) {
      const ua = request.headers.get("user-agent") || "";
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
      const country = (request.cf && request.cf.country) || "";
      await recordAccess(env, { ts: Date.now(), ip: ip, country: country, path: p, ua: ua });
    }
  } catch (e) {}

  try {
    if (p === "/api/send-code" && request.method === "POST") return await sendCode(env, body);
    if (p === "/api/admin-login" && request.method === "POST") return await adminLogin(env, body, request);

    if (p === "/api/logout" && request.method === "POST") {
      const s = await getSession(env, request);
      if (s) {
        const auth = request.headers.get("Authorization") || "";
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m) await revokeSession(env, s.email, m[1]);
      }
      return json({ ok: true });
    }

    /* —— 多端/设备管理：列出当前账号的全部登录设备、远程踢下线 —— */
    if (p === "/api/sessions" && request.method === "GET") {
      const s = await requireLogin(env, request);
      const auth = request.headers.get("Authorization") || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      const cur = m ? m[1] : "";
      const list = await listSessions(env, s.email, cur);
      return json({ ok: true, email: s.email, sessions: list });
    }
    if (p === "/api/sessions/revoke" && request.method === "POST") {
      const s = await requireLogin(env, request);
      const tk = (body.token || "").trim();
      if (!tk) return json({ error: "缺少 token" }, 400);
      const owned = await listSessions(env, s.email, "");
      if (!owned.some(function (x) { return x.token === tk; })) return json({ error: "无权限或会话不存在" }, 403);
      await revokeSession(env, s.email, tk);
      return json({ ok: true });
    }

    if (p === "/api/me" && request.method === "GET") {
      const s = await getSession(env, request);
      if (!s) return json({ error: "未登录" }, 401);
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
      const country = (request.cf && request.cf.country) || "";
      await updatePresence(env, s.email, { ip: ip, country: country });
      const u = await getUserById(env, s.email);
      return json({ role: s.role, email: s.email, name: u ? (u.name || "") : "", avatar: u ? (u.avatar || "") : "" });
    }

    if (p === "/api/admin/users" && request.method === "GET") {
      await requireSuper(env, request);
      const users = await allUsers(env);
      return json({
        users: users.map((u) => ({ email: u.email, phone: u.phone, role: u.role, disabled: !!u.disabled })),
      });
    }

    if (p === "/api/admin/create-subadmin" && request.method === "POST") {
      await requireSuper(env, request);
      return await createSubadmin(env, body);
    }

    if (p === "/api/admin/members" && request.method === "GET") {
      await requireUserMgr(env, request);
      return await listMembers(env);
    }
    if (p === "/api/admin/member" && request.method === "PUT") {
      await requireUserMgr(env, request);
      return await setMemberDisabled(env, body);
    }
    if (p === "/api/admin/member" && request.method === "DELETE") {
      await requireUserMgr(env, request);
      return await deleteMember(env, body);
    }

    if (p === "/api/admin/data" && request.method === "GET") {
      await requireStaff(env, request);
      if (!env.GH_TOKEN) return json({ error: "Worker 未配置 GH_TOKEN" }, 500);
      const { content } = await ghGetData(env);
      return json({ content });
    }

    if (p === "/api/admin/data" && request.method === "PUT") {
      await requireStaff(env, request);
      if (!env.GH_TOKEN) return json({ error: "Worker 未配置 GH_TOKEN" }, 500);
      await ghPutData(env, body.content, "[分管理员] 更新数据");
      return json({ ok: true });
    }

    if (p === "/api/admin/file" && request.method === "PUT") {
      await requireStaff(env, request);
      if (!env.GH_TOKEN) return json({ error: "Worker 未配置 GH_TOKEN" }, 500);
      const url = await ghPutFile(env, body.path, body.content, body.message);
      return json({ url });
    }

    /* —— 普通用户：注册 / 登录 —— */
    if (p === "/api/user/send-code" && request.method === "POST") return await sendCode(env, body);
    if (p === "/api/user/register" && request.method === "POST") return await registerUser(env, body, request);
    if (p === "/api/user/login" && request.method === "POST") return await userLogin(env, body, request);

    /* —— 论坛：看帖公开，发帖 / 回复 / 删帖需登录 —— */
    if (p === "/api/forum/posts" && request.method === "GET") return await listPosts(env, url);
    if (p === "/api/forum/posts" && request.method === "POST") {
      const s = await requireLogin(env, request);
      return await createPost(env, body, s);
    }
    if (p.startsWith("/api/forum/posts/") && p.length > "/api/forum/posts/".length) {
      const seg = p.slice("/api/forum/posts/".length).split("/");
      const pid = seg[0];
      if (request.method === "GET") return await getPostApi(env, pid);
      if (request.method === "POST" && seg[1] === "reply") {
        const s = await requireLogin(env, request);
        return await replyPost(env, pid, body, s);
      }
      if (request.method === "DELETE") {
        const s = await requireLogin(env, request);
        return await deletePost(env, pid, s);
      }
    }

    /* —— QQ 登录（OAuth2 骨架；需在 Cloudflare 配置 QQ_APPID / QQ_APPKEY 后启用）—— */
    if (p === "/api/auth/qq" && request.method === "GET") return await qqAuthStart(env, url);
    if (p === "/api/auth/qq/callback" && request.method === "GET") return await qqAuthCallback(env, url);

    /* —— 公告：公开读取 + 仅员工管理 —— */
    if (p === "/api/announce" && request.method === "GET") return await listActiveAnnounce(env);
    if (p === "/api/admin/announce") {
      await requireStaff(env, request);
      if (request.method === "POST") return await createAnnounce(env, body);
      if (request.method === "GET") return json({ items: await getAnnIdx(env) });
    }
    if (p.startsWith("/api/admin/announce/") && p.length > "/api/admin/announce/".length) {
      const aid = p.slice("/api/admin/announce/".length);
      await requireStaff(env, request);
      if (request.method === "PUT") return await updateAnnounce(env, aid, body);
      if (request.method === "DELETE") return await deleteAnnounce(env, aid);
    }

    /* —— 用户投稿 UGC —— */
    if (p === "/api/ugc" && request.method === "POST") {
      const s = await requireLogin(env, request);
      return await createUgc(env, body, s);
    }
    if (p === "/api/ugc" && request.method === "GET") return await listApprovedUgc(env);
    if (p === "/api/ugc/mine" && request.method === "GET") {
      const s = await requireLogin(env, request);
      return await listMyUgc(env, s);
    }
    if (p === "/api/admin/ugc" && request.method === "GET") {
      await requireStaff(env, request);
      return await listAllUgc(env);
    }
    if (p === "/api/admin/ugc/aimod" && request.method === "POST") {
      await requireStaff(env, request);
      return await aiModerateUgc(env, body);
    }
    if (p.startsWith("/api/admin/ugc/") && p.length > "/api/admin/ugc/".length) {
      const uid = p.slice("/api/admin/ugc/".length);
      await requireStaff(env, request);
      if (request.method === "PUT") return await reviewUgc(env, uid, body);
      if (request.method === "DELETE") return await deleteUgc(env, uid);
    }

    /* —— 评论 —— */
    if (p === "/api/comments" && request.method === "GET") {
      const target = url.searchParams.get("target") || "";
      if (!target) return json({ error: "缺少 target" }, 400);
      return json({ comments: await getComments(env, target) });
    }
    if (p === "/api/comments" && request.method === "POST") {
      const s = await requireLogin(env, request);
      const target = (body.target || "").trim();
      return await addComment(env, target, body, s);
    }

    /* —— 个人主页 —— */
    if (p === "/api/user/profile/me" && request.method === "GET") {
      const s = await requireLogin(env, request);
      return await getMyProfile(env, s);
    }
    if (p.startsWith("/api/user/profile/") && p.length > "/api/user/profile/".length) {
      const pid = decodeURIComponent(p.slice("/api/user/profile/".length));
      return await getProfile(env, pid);
    }
    if (p === "/api/user/profile" && request.method === "PUT") {
      const s = await requireLogin(env, request);
      return await updateProfile(env, body, s);
    }

    /* —— 每日签到 + 积分 —— */
    if (p === "/api/checkin" && request.method === "GET") {
      const s = await requireLogin(env, request);
      const u = await getUserById(env, s.email);
      return json(u ? checkinInfo(u) : { checkedInToday: false, points: 0, streak: 0, level: 1, next: 100, into: 0, lastCheckin: null });
    }
    if (p === "/api/checkin" && request.method === "POST") {
      const s = await requireLogin(env, request);
      return json(await doCheckIn(env, s));
    }

    /* —— 全站搜索（论坛 + 投稿） —— */
    if (p === "/api/search" && request.method === "GET") {
      return await searchContent(env, url.searchParams.get("q") || "");
    }

    /* —— 访问日志（仅后台管理员；总管理员看完整含 IP，分管理员看汇总与国家分布） —— */
    if (p === "/api/admin/access" && request.method === "GET") {
      const s = await requireStaff(env, request);
      const data = await listAccess(env, s.role === "super");
      const cf = await cfAnalytics(env);
      if (cf) data.cloudflare = cf;
      return json(data);
    }

    /* —— 好友系统（登录用户） —— */
    if (p === "/api/friends" && request.method === "GET") {
      const s = await requireLogin(env, request);
      return json(await friendView(env, s.email));
    }
    if (p === "/api/friends/search" && request.method === "GET") {
      const s = await requireLogin(env, request);
      return json({ users: await searchUsers(env, url.searchParams.get("q") || "", s.email) });
    }
    if (p === "/api/friends/request" && request.method === "POST") {
      const s = await requireLogin(env, request);
      const to = (body.to || "").trim().toLowerCase();
      if (!to) return json({ error: "请填写对方账号" }, 400);
      if (to === s.email.toLowerCase()) return json({ error: "不能添加自己为好友" }, 400);
      if (await getFriend(env, s.email, to)) return json({ error: "已存在好友关系或请求" }, 400);
      if (!(await getUserById(env, to))) return json({ error: "该用户不存在" }, 400);
      await putFriend(env, s.email, to, { status: "pending", from: s.email.toLowerCase(), at: Date.now() });
      return json({ ok: true });
    }
    if (p === "/api/friends/respond" && request.method === "POST") {
      const s = await requireLogin(env, request);
      const from = (body.from || "").trim().toLowerCase();
      const action = (body.action || "").trim();
      const rec = await getFriend(env, s.email, from);
      if (!rec) return json({ error: "请求不存在" }, 404);
      if (rec.from === s.email.toLowerCase()) return json({ error: "无权操作该请求" }, 403);
      if (action === "accept") { rec.status = "accepted"; await putFriend(env, s.email, from, rec); return json({ ok: true }); }
      if (action === "reject") { await delFriend(env, s.email, from); return json({ ok: true }); }
      return json({ error: "操作无效" }, 400);
    }
    if (p.startsWith("/api/friends/") && p.length > "/api/friends/".length) {
      const s = await requireLogin(env, request);
      const id = decodeURIComponent(p.slice("/api/friends/".length));
      await delFriend(env, s.email, id);
      return json({ ok: true });
    }

    /* —— 私聊（仅好友间） —— */
    if (p === "/api/messages" && request.method === "GET") {
      const s = await requireLogin(env, request);
      const withId = (url.searchParams.get("with") || "").trim();
      if (!withId) return json({ error: "缺少 with" }, 400);
      const fr = await getFriend(env, s.email, withId);
      if (!fr || fr.status !== "accepted") return json({ error: "你们还不是好友" }, 403);
      return json({ messages: await getMessages(env, s.email, withId) });
    }
    if (p === "/api/messages" && request.method === "POST") {
      const s = await requireLogin(env, request);
      const to = (body.to || "").trim();
      const text = (body.text || "").trim();
      if (!to || !text) return json({ error: "缺少收件人或内容" }, 400);
      const fr = await getFriend(env, s.email, to);
      if (!fr || fr.status !== "accepted") return json({ error: "你们还不是好友，无法私聊" }, 403);
      const msg = { from: s.email.toLowerCase(), to: to.toLowerCase(), text: text, ts: Date.now() };
      await pushMessage(env, s.email, to, msg);
      return json({ ok: true, message: msg });
    }

    /* —— 头像上传（JPG，存 KV）与读取 —— */
    if (p === "/api/user/avatar" && request.method === "PUT") {
      const s = await requireLogin(env, request);
      const img = body.image || "";
      const m = String(img).match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return json({ error: "头像格式不正确（需图片 base64）" }, 400);
      const ct = m[1] || "image/jpeg";
      const bin = b64decodeBytes(m[2]);
      if (!bin || bin.length > 2 * 1024 * 1024) return json({ error: "头像过大（限 2MB）" }, 400);
      await env.AVATARS.put("av:" + s.email.toLowerCase(), bin, { metadata: { contentType: ct } });
      const url2 = url.origin + "/api/user/avatar/" + encodeURIComponent(s.email);
      const u = await getUserById(env, s.email);
      if (u) { u.avatar = url2; await putUser(env, u); }
      return json({ ok: true, url: url2 });
    }
    if (p.startsWith("/api/user/avatar/") && request.method === "GET") {
      const id = decodeURIComponent(p.slice("/api/user/avatar/".length));
      const bin = await env.AVATARS.get("av:" + id.toLowerCase(), "arrayBuffer");
      if (!bin) return new Response("Not Found", { status: 404 });
      const meta = await env.AVATARS.getWithMetadata("av:" + id.toLowerCase());
      const ct = (meta && meta.metadata && meta.metadata.contentType) || "image/jpeg";
      return new Response(bin, { headers: { "Content-Type": ct, ...CORS } });
    }

    /* —— 微信登录（OAuth2 骨架；配置 WECHAT_APPID / WECHAT_APPKEY 后启用，前端默认隐藏） —— */
    if (p === "/api/auth/wechat" && request.method === "GET") return await wxAuthStart(env, url);
    if (p === "/api/auth/wechat/callback" && request.method === "GET") return await wxAuthCallback(env, url);

    /* —— 智能卡战备：代理三角洲数据帝实时卡战备 API（token 存 Worker Secret ORZICE_TOKEN，不暴露给前端） —— */
    if (p === "/api/kzb/diy" && request.method === "GET") return await kzbDiy(env, url);

    /* —— 全球实时排行榜（KV: LB） —— */
    if (p === "/api/leaderboard" && request.method === "GET") return await leaderboardGet(env, url);
    if (p === "/api/leaderboard" && request.method === "POST") return await leaderboardPost(env, request, body);

    return json({ error: "Not Found" }, 404);
  } catch (e) {
    const st = (typeof e.status === "number") ? e.status : 500;
    return json({ error: e.message || "服务器错误" }, st);
  }
}

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};
