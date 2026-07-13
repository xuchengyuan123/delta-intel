/* =========================================================
 * auth.js — 前端用户登录 / 注册（邮箱 + 密码 / 验证码）
 * 后端：Cloudflare Worker（见 cloudflare/worker.js）
 * API 地址：window.DELTA_API 或 data.json 的 site.apiBase
 * ========================================================= */
(function () {
  "use strict";

  var KEY = "di_session";

  function apiBase() {
    if (window.DELTA_API) return window.DELTA_API.replace(/\/$/, "");
    if (window.DF_DATA && window.DF_DATA.site && window.DF_DATA.site.apiBase) return window.DF_DATA.site.apiBase.replace(/\/$/, "");
    return "";
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function setSession(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function api(path, body, method) {
    var base = apiBase();
    if (!base) {
      return Promise.reject({ noApi: true, error: "本站尚未配置登录后端。请先部署 Cloudflare Worker，并在 data.json 的 site.apiBase 填好地址。" });
    }
    return fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); });
  }
  function authApi(path, body, method) {
    var s = getSession();
    var h = { "Content-Type": "application/json" };
    if (s && s.session) h["Authorization"] = "Bearer " + s.session;
    return fetch(apiBase() + path, {
      method: method || (body ? "POST" : "GET"),
      headers: h,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); });
  }

  function T(k, fb) { return (window.t ? window.t(k, fb) : (fb != null ? fb : k)); }

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  function buildModal() {
    if (document.getElementById("authModal")) return;
    var m = document.createElement("div");
    m.className = "modal";
    m.id = "authModal";
    m.hidden = true;
    m.innerHTML =
      '<div class="modal-mask" data-close></div>' +
      '<div class="modal-box">' +
        '<div class="modal-head"><span id="authTitle">' + T("loginTitle") + '</span><button class="modal-x" data-close>✕</button></div>' +
        '<div class="modal-body">' +
          '<div id="authFormWrap">' +
            '<div class="tabs">' +
              '<button class="tab active" data-tab="login">' + T("loginBtn") + '</button>' +
              '<button class="tab" data-tab="reg">' + T("register") + '</button>' +
            '</div>' +
            '<form id="authForm">' +
              '<label>' + T("idPlaceholder") + '<input id="authId" type="text" autocomplete="username" placeholder="' + T("idPlaceholder") + '"></label>' +
              '<label>' + T("pwPlaceholder") + '<input id="authPw" type="password" autocomplete="current-password" placeholder="' + T("pwPlaceholder") + '"></label>' +
              '<label>' + T("codePlaceholder") +
                '<span class="auth-send" id="authSend">' + T("getCode") + '</span>' +
                '<input id="authCode" placeholder="' + T("codePlaceholder") + '">' +
              '</label>' +
              '<button class="btn-primary" type="submit" id="authSubmit">' + T("loginBtn") + '</button>' +
              '<div class="form-msg" id="authMsg"></div>' +
              '<div class="auth-code-box" id="authCodeBox" hidden></div>' +
            '</form>' +
            '<p class="auth-tip">' +
              T("sendCodeReg") + '（EmailJS）。' + (window.getLang && window.getLang() === "en"
                ? "Phone can be a login id; its code goes to the bound email. Password-less login: email + code only."
                : "手机号可作登录账号，但其验证码会发到绑定邮箱。免密登录：仅填邮箱 + 验证码即可。") +
            '</p>' +
          '</div>' +
          '<div id="authProfile" hidden>' +
            '<div class="profile-row">' +
              '<img id="authAvatar" class="profile-avatar" alt="avatar" />' +
              '<div class="profile-info">' +
                '<div id="authEmail" class="profile-email"></div>' +
                '<label class="avatar-upload">' + T("iconUpload") + ' (jpg)<input id="authAvatarFile" type="file" accept="image/jpeg" hidden></label>' +
                '<div class="form-msg" id="authAvatarMsg"></div>' +
              '</div>' +
            '</div>' +
            '<button class="btn-primary" id="authLogout" type="button">' + T("logout") + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);

    m.querySelectorAll("[data-close]").forEach(function (x) { x.addEventListener("click", closeModal); });
    m.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        m.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        document.getElementById("authSubmit").textContent = t.getAttribute("data-tab") === "reg" ? T("register") : T("loginBtn");
        setMsg("");
      });
    });
    document.getElementById("authSend").addEventListener("click", sendCode);
    document.getElementById("authForm").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
    document.getElementById("authLogout").addEventListener("click", function () {
      clearSession(); refreshBadge(); showForm(); setMsg("");
    });
    document.getElementById("authAvatarFile").addEventListener("change", uploadAvatar);
  }

  // 打开弹窗时根据登录态显示表单 / 资料
  function openModal() {
    buildModal();
    var m = document.getElementById("authModal");
    m.hidden = false;
    var s = getSession();
    if (s && s.session) showProfile(); else showForm();
  }
  function closeModal() {
    var m = document.getElementById("authModal");
    if (m) m.hidden = true;
  }
  function showForm() {
    var f = document.getElementById("authFormWrap"); var p = document.getElementById("authProfile");
    if (f) f.hidden = false; if (p) p.hidden = true;
  }
  function showProfile() {
    var s = getSession();
    var f = document.getElementById("authFormWrap"); var p = document.getElementById("authProfile");
    if (f) f.hidden = true; if (p) p.hidden = false;
    if (s) {
      var em = document.getElementById("authEmail"); if (em) em.textContent = s.email || "";
      var av = document.getElementById("authAvatar");
      if (av) av.src = s.avatar || (apiBase() ? apiBase() + "/api/avatar/" + encodeURIComponent(s.email || "") : "");
    }
    loadMe();
  }
  // 拉取最新资料（含头像）
  function loadMe() {
    var s = getSession(); if (!s || !s.session) return;
    authApi("/api/me").then(function (r) {
      if (r.ok && !r.data.error) {
        s.role = r.data.role; s.avatar = r.data.avatar || ""; setSession(s);
        var av = document.getElementById("authAvatar");
        if (av) av.src = s.avatar || (apiBase() ? apiBase() + "/api/avatar/" + encodeURIComponent(s.email || "") : "");
        refreshBadge();
      } else { clearSession(); refreshBadge(); }
    }).catch(function () {});
  }

  // 上传头像（jpg，<=300KB）
  function uploadAvatar(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var msg = document.getElementById("authAvatarMsg");
    if (msg) { msg.textContent = "…"; msg.className = "form-msg"; }
    if (!/image\/jpeg/.test(file.type)) { if (msg) { msg.textContent = "仅支持 jpg 图片"; msg.className = "form-msg err"; } return; }
    if (file.size > 300 * 1024) { if (msg) { msg.textContent = "图片过大（上限 300KB）"; msg.className = "form-msg err"; } return; }
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      authApi("/api/me/avatar", { avatar: dataUrl }, "PUT").then(function (r) {
        if (r.ok && !r.data.error) {
          var s = getSession(); if (s) { s.avatar = r.data.avatar || dataUrl; setSession(s); }
          var av = document.getElementById("authAvatar"); if (av) av.src = r.data.avatar || dataUrl;
          refreshBadge();
          if (msg) { msg.textContent = "✅ 头像已更新"; msg.className = "form-msg ok"; }
        } else { if (msg) { msg.textContent = "❌ " + (r.data.error || "上传失败"); msg.className = "form-msg err"; } }
      }).catch(function () { if (msg) { msg.textContent = "❌ 网络错误"; msg.className = "form-msg err"; } });
    };
    reader.readAsDataURL(file);
  }

  function setMsg(t, type) {
    var el = document.getElementById("authMsg");
    if (!el) return;
    el.textContent = t || "";
    el.className = "form-msg" + (type ? " " + type : "");
  }

  function sendCode() {
    var to = document.getElementById("authId").value.trim();
    if (!to) { setMsg(T("idPlaceholder"), "err"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { setMsg(window.getLang && window.getLang() === "en" ? "Code is sent to email; enter a valid email" : "验证码发送到邮箱，请填写正确的邮箱地址", "err"); return; }
    setMsg(window.getLang && window.getLang() === "en" ? "Sending…" : "发送中…");
    api("/api/send-code", { to: to }).then(function (r) {
      if (r.ok && !r.data.error) {
        if (r.data.devCode) {
          showCodeBox(r.data.devCode, to);
          setMsg("✅ " + (r.data.note || (window.getLang && window.getLang() === "en" ? "dev-mode code shown" : "开发模式回显")), "ok");
        } else {
          setMsg("✅ " + (window.getLang && window.getLang() === "en" ? "Code sent to " + to : "验证码已发送到 " + to + "（请查收邮件）"), "ok");
        }
      } else setMsg("❌ " + (r.data.error || (window.getLang && window.getLang() === "en" ? "send failed" : "发送失败")), "err");
    }).catch(function (e) {
      if (e.noApi) setMsg("❌ " + e.error, "err"); else setMsg("❌ " + (window.getLang && window.getLang() === "en" ? "network error" : "网络错误，请重试"), "err");
    });
  }

  function showCodeBox(code, to) {
    var box = document.getElementById("authCodeBox");
    if (!box) return;
    box.hidden = false;
    box.innerHTML =
      '<div class="auth-code-label">' + (window.getLang && window.getLang() === "en" ? "Your code (" : "你的验证码（") + esc(to) + '）</div>' +
      '<div class="auth-code-value">' + esc(code) + '</div>' +
      '<button type="button" class="auth-code-copy" id="authCodeCopy">' + (window.getLang && window.getLang() === "en" ? "Copy" : "复制验证码") + '</button>';
    var cp = document.getElementById("authCodeCopy");
    if (cp) cp.addEventListener("click", function () {
      try { navigator.clipboard && navigator.clipboard.writeText(code); } catch (e) {}
      cp.textContent = "✓";
    });
    var input = document.getElementById("authCode");
    if (input) input.value = code;
  }

  function submit() {
    var id = document.getElementById("authId").value.trim();
    var pw = document.getElementById("authPw").value;
    var code = document.getElementById("authCode").value.trim();
    var isReg = document.querySelector("#authModal .tab.active").getAttribute("data-tab") === "reg";
    if (!id) { setMsg(T("idPlaceholder"), "err"); return; }

    if (isReg) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id)) { setMsg(window.getLang && window.getLang() === "en" ? "Register with email" : "注册请使用邮箱", "err"); return; }
      if (pw.length < 6) { setMsg(window.getLang && window.getLang() === "en" ? "Password at least 6 chars" : "密码至少 6 位", "err"); return; }
      if (!code) { setMsg(T("needVerify"), "err"); return; }
      api("/api/register", { email: id, password: pw, code: code }).then(function (r) {
        if (r.ok && !r.data.error) finishLogin(r.data);
        else setMsg("❌ " + (r.data.error || (window.getLang && window.getLang() === "en" ? "register failed" : "注册失败")), "err");
      }).catch(function (e) { netErr(e); });
      return;
    }

    var body;
    if (code && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id)) body = { email: id, code: code };
    else { if (!pw) { setMsg(window.getLang && window.getLang() === "en" ? "Enter password, or email + code" : "请输入密码，或使用邮箱+验证码免密登录", "err"); return; } body = { id: id, password: pw }; }
    api("/api/login", body).then(function (r) {
      if (r.ok && !r.data.error) finishLogin(r.data);
      else setMsg("❌ " + (r.data.error || (window.getLang && window.getLang() === "en" ? "login failed" : "登录失败")), "err");
    }).catch(function (e) { netErr(e); });
  }

  function netErr(e) {
    if (e && e.noApi) setMsg("❌ " + e.error, "err");
    else setMsg("❌ " + (window.getLang && window.getLang() === "en" ? "network error" : "网络错误，请确认后端已部署"), "err");
  }

  function finishLogin(data) {
    setSession({ session: data.session, email: data.email, role: data.role, avatar: "" });
    closeModal();
    refreshBadge();
    loadMe();
    showProfileIfOpen();
  }
  function showProfileIfOpen() {
    var m = document.getElementById("authModal");
    if (m && !m.hidden) showProfile();
  }

  /* ---------- 顶栏徽标 + 下拉（含头像） ---------- */
  function refreshBadge() {
    var btn = document.getElementById("userBtn");
    if (!btn) return;
    var s = getSession();
    if (!s) { btn.innerHTML = "👤"; btn.title = T("loginBtn") + " / " + T("register"); btn.classList.remove("logged"); return; }
    if (s.avatar) {
      btn.innerHTML = '<img class="badge-avatar" src="' + esc(s.avatar) + '" alt="me" />';
    } else {
      btn.textContent = (s.email || "用户").slice(0, 1).toUpperCase();
    }
    btn.title = s.email + "（" + (window.getLang && window.getLang() === "en" ? "click to logout" : "点击退出") + "）";
    btn.classList.add("logged");
  }

  function bindUserBtn() {
    var btn = document.getElementById("userBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var s = getSession();
      if (s) {
        if (confirm((window.getLang && window.getLang() === "en" ? "Logged in: " : "当前登录：") + s.email + "\n" + (window.getLang && window.getLang() === "en" ? "OK to logout." : "点击确定退出登录。"))) {
          clearSession(); refreshBadge(); showForm();
        }
      } else {
        openModal();
      }
    });
  }

  // 语言切换后刷新弹窗文案
  function updateAuthTexts() {
    var m = document.getElementById("authModal");
    if (!m) return;
    var title = document.getElementById("authTitle"); if (title) title.textContent = T("loginTitle");
    var send = document.getElementById("authSend"); if (send) send.textContent = T("getCode");
    var submit = document.getElementById("authSubmit");
    if (submit) submit.textContent = (document.querySelector("#authModal .tab.active") || {}).getAttribute && document.querySelector("#authModal .tab.active").getAttribute("data-tab") === "reg" ? T("register") : T("loginBtn");
    var logout = document.getElementById("authLogout"); if (logout) logout.textContent = T("logout");
    var up = document.querySelector(".avatar-upload"); if (up) up.childNodes[0].nodeValue = T("iconUpload") + " (jpg)";
  }

  function init() {
    buildModal();
    bindUserBtn();
    refreshBadge();
    if (window.addEventListener) window.addEventListener("di:lang", function () { updateAuthTexts(); applyAuthBadge(); });
    var s = getSession();
    if (s && s.session) {
      authApi("/api/me").then(function (r) {
        if (!r.ok || r.data.error) { clearSession(); refreshBadge(); }
        else { s.role = r.data.role; s.avatar = r.data.avatar || ""; setSession(s); refreshBadge(); }
      }).catch(function () {});
    }
  }
  function applyAuthBadge() { refreshBadge(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
