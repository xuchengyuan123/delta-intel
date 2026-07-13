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
//   POST /api/admin/create-subadmin (super) {email,password,phone,role} -> {ok, role}
//   GET  /api/admin/data           -> {content:"<json string>"}
//   PUT  /api/admin/data           {content:"<json string>"} -> {ok}
//   PUT  /api/admin/file           {path, content(base64), message} -> {url}
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
async function createSession(env, email, role) {
  const token = randToken();
  const s = { email, role, exp: Date.now() + 7 * 86400 * 1000 };
  await env.SESSIONS.put("sess:" + token, JSON.stringify(s), { expirationTtl: 7 * 86400 + 60 });
  return token;
}

/* ============ 鉴权辅助 ============ */
async function requireLogin(env, req) {
  const s = await getSession(env, req);
  if (!s) throw new HttpError(401, "未登录或会话已过期");
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
  // 手机号验证码需要短信网关（需实名，本项目未配置）→ 明确提示，不走到邮件发送
  const isPhone = !to.includes("@") && /^\+?\d{6,15}$/.test(to);
  if (isPhone) {
    return json({ error: "手机号验证码暂不支持（需短信服务且要实名，当前未配置）。请改用邮箱接收验证码；已设密码的手机号可直接用密码登录。" }, 400);
  }
  const purpose = (body.purpose || "login").toLowerCase();
  if (purpose === "login") {
    const user = await getUserById(env, to);
    if (!user) return json({ error: "该账号不存在，请先注册" }, 400);
  } else if (purpose === "register") {
    if (await getUserById(env, to)) return json({ error: "该账号已注册，请直接登录" }, 400);
  }
  const code = genCode();
  await env.CODES.put("code:" + to, code, { expirationTtl: 300 });

  const devMode = (env.DEV_MODE || "").toLowerCase() === "true";
  const mail = env.MAIL; // Cloudflare 自带发信绑定（MailChannels）
  const hasEmailJS = env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY;
  if (devMode || (!mail && !hasEmailJS)) {
    // 开发模式 / 未配置任何发信：验证码直接回显到前端（前端已支持 devCode 展示）
    return json({ ok: true, devCode: code });
  }
  try {
    if (mail) await sendViaMail(env, to, code);          // 优先 Cloudflare MailChannels
    else if (hasEmailJS) await sendEmailJS(env, to, code); // 备选 EmailJS
    return json({ ok: true });
  } catch (e) {
    // 邮件发送失败（域名未开 Email Routing / DNS 未配 / 被收件方拒收）也回显，避免卡死
    return json({ ok: true, devCode: code, mailError: String((e && e.message) || e) });
  }
}

async function adminLogin(env, body) {
  await ensureSuper(env);
  const id = (body.id || body.email || "").trim().toLowerCase();
  if (!id) return json({ error: "缺少账号" }, 400);
  const user = await getUserById(env, id);
  if (!user || user.disabled) return json({ error: "账号不存在或已禁用" }, 401);

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

  const token = await createSession(env, user.email, user.role);
  return json({ session: token, role: user.role, email: user.email });
}

async function createSubadmin(env, body) {
  const email = (body.email || "").trim().toLowerCase();
  const pw = body.password || "";
  const phone = (body.phone || "").trim();
  const role = body.role || "tasks";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "邮箱格式不正确" }, 400);
  if (pw.length < 6) return json({ error: "密码至少 6 位" }, 400);
  if (role === "super") return json({ error: "不能创建总管理员" }, 400);
  if (await getUserById(env, email)) return json({ error: "该邮箱已存在" }, 400);
  if (phone && (await getUserById(env, phone))) return json({ error: "该手机号已存在" }, 400);

  const salt = await newSalt();
  const hash = await hashPassword(pw, salt);
  await putUser(env, { email, phone, role, salt, hash, disabled: false });
  return json({ ok: true, role });
}

/* ============ 普通用户：注册 / 登录 ============ */
async function registerUser(env, body) {
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
  const token = await createSession(env, id, "user");
  return json({ session: token, role: "user", id });
}

async function userLogin(env, body) {
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
  const token = await createSession(env, user.email || user.phone, user.role);
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
async function createUgc(env, body, sess) {
  const title = (body.title || "").trim();
  const text = (body.body || "").trim();
  if (!title) return json({ error: "标题不能为空" }, 400);
  if (!text) return json({ error: "内容不能为空" }, 400);
  const id = genId("u");
  const rec = { id, author: sess.email, title, category: body.category || "攻略", body: text, status: "pending", createdAt: Date.now(), rejectReason: "" };
  await env.UGC.put("u:" + id, JSON.stringify(rec));
  const idx = await getUgcIdx(env);
  idx.unshift({ id, author: rec.author, title, category: rec.category, status: "pending", createdAt: rec.createdAt });
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
  return json({ profile: { id: u.email || u.phone, name: u.name || "", bio: u.bio || "", avatar: u.avatar || "", role: u.role, joinedAt: u.createdAt || null } });
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

  try {
    if (p === "/api/send-code" && request.method === "POST") return await sendCode(env, body);
    if (p === "/api/admin-login" && request.method === "POST") return await adminLogin(env, body);

    if (p === "/api/logout" && request.method === "POST") {
      const s = await getSession(env, request);
      if (s) {
        const auth = request.headers.get("Authorization") || "";
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m) await env.SESSIONS.delete("sess:" + m[1]);
      }
      return json({ ok: true });
    }

    if (p === "/api/me" && request.method === "GET") {
      const s = await getSession(env, request);
      if (!s) return json({ error: "未登录" }, 401);
      return json({ role: s.role, email: s.email });
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
    if (p === "/api/user/register" && request.method === "POST") return await registerUser(env, body);
    if (p === "/api/user/login" && request.method === "POST") return await userLogin(env, body);

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

    /* —— 全站搜索（论坛 + 投稿） —— */
    if (p === "/api/search" && request.method === "GET") {
      return await searchContent(env, url.searchParams.get("q") || "");
    }

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
