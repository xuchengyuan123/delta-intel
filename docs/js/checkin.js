/* 三角洲情报台 · 每日签到 + 积分（独立页面视图）
 * 仅在已登录（localStorage 有 di_user_token）时可用。
 * 注册 window.DF.VIEWS.checkin，由左侧栏「每日签到」入口进入，不再使用悬浮球。 */
(function () {
  "use strict";
  var TOKEN_KEY = "di_user_token";

  function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function isLogin() { return !!token(); }

  function api(path, opts) {
    opts = opts || {};
    if (window.D && window.D.api) return window.D.api(path, opts);
    var base = (window.D && window.D.apiBase) || "https://api.delta.shopping";
    var t = token();
    opts.headers = opts.headers || {};
    if (t) opts.headers["Authorization"] = "Bearer " + t;
    return fetch(base.replace(/\/$/, "") + path, opts).then(function (r) { return r.json(); });
  }

  /* 注入样式（视图内卡片） */
  var st = document.createElement("style");
  st.textContent =
    '#df-checkin .ck-card{max-width:420px;margin:18px auto;background:var(--card,#1c1f26);color:var(--text,#fff);' +
    'border:1px solid var(--border,#333);border-radius:18px;padding:20px;box-shadow:0 10px 32px rgba(0,0,0,.4);}' +
    '#df-checkin .ck-h{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:18px;}' +
    '#df-checkin .ck-pts{font-size:15px;color:var(--accent,#4da3ff);font-weight:800;}' +
    '#df-checkin .ck-sub{font-size:12px;color:var(--muted);margin:2px 0 14px;}' +
    '#df-checkin .ck-bar{height:9px;border-radius:6px;background:var(--border,#333);overflow:hidden;margin:6px 0 14px;}' +
    '#df-checkin .ck-bar>i{display:block;height:100%;background:linear-gradient(90deg,#4da3ff,#7ee0c0);transition:width .3s;}' +
    '#df-checkin .ck-streak{display:flex;gap:6px;margin-bottom:16px;}' +
    '#df-checkin .ck-dot{flex:1;height:30px;border-radius:8px;background:var(--border,#333);display:flex;align-items:center;justify-content:center;font-size:12px;color:#888;}' +
    '#df-checkin .ck-dot.on{background:linear-gradient(135deg,#4da3ff,#7ee0c0);color:#06251f;font-weight:700;}' +
    '#df-checkin .ck-btn{width:100%;border:0;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;' +
    'background:linear-gradient(135deg,#4da3ff,#7ee0c0);color:#06251f;}' +
    '#df-checkin .ck-btn:disabled{opacity:.6;cursor:default;}' +
    '#df-checkin .ck-tip{font-size:12px;color:var(--muted);margin-top:10px;text-align:center;}' +
    '#df-checkin .ck-empty{padding:10px 0 14px;text-align:center;color:var(--muted);}' +
    '#df-checkin .ck-login{display:block;text-align:center;color:var(--accent,#4da3ff);font-weight:600;}' +
    '@media(max-width:480px){#df-checkin .ck-card{margin:12px;}}';
  document.head.appendChild(st);

  function renderInto(el) {
    if (!isLogin()) {
      el.innerHTML = '<div class="ck-card"><div class="ck-empty">🔒 请先登录后再来签到领积分</div>' +
        '<a class="ck-login" href="index.html">前往首页登录</a></div>';
      return;
    }
    el.innerHTML =
      '<div class="ck-card">' +
      '  <div class="ck-h"><span>每日签到</span><span class="ck-pts">0 积分</span></div>' +
      '  <div class="ck-sub">Lv.1</div>' +
      '  <div class="ck-bar"><i style="width:0%"></i></div>' +
      '  <div class="ck-streak"></div>' +
      '  <button class="ck-btn">签到领积分</button>' +
      '  <div class="ck-tip"></div>' +
      '</div>';

    var ptsEl = el.querySelector(".ck-pts");
    var lvEl = el.querySelector(".ck-sub");
    var barEl = el.querySelector(".ck-bar>i");
    var streakEl = el.querySelector(".ck-streak");
    var btn = el.querySelector(".ck-btn");
    var tip = el.querySelector(".ck-tip");

    function render(d) {
      d = d || {};
      ptsEl.textContent = (d.points || 0) + " 积分";
      lvEl.textContent = "Lv." + (d.level || 1);
      var into = d.into || 0, next = d.next || 100;
      barEl.style.width = Math.max(0, Math.min(100, Math.round(into / next * 100))) + "%";
      var s = d.streak || 0;
      var html = "";
      for (var i = 0; i < 7; i++) {
        var on = i < Math.min(s, 7);
        html += '<div class="ck-dot' + (on ? " on" : "") + '">' + (on ? "✓" : (i + 1)) + "</div>";
      }
      streakEl.innerHTML = html;
      if (d.checkedInToday) {
        btn.disabled = true; btn.textContent = "今日已签到 ✓";
        tip.textContent = "连续签到 " + s + " 天 · 明天再来";
      } else {
        btn.disabled = false; btn.textContent = "签到领积分";
        tip.textContent = "连续签到越高，每日积分越多";
      }
    }

    function load() {
      api("/api/checkin", { method: "GET" }).then(function (j) {
        if (j && (j.points != null || j.level != null)) render(j);
        else { el.innerHTML = '<div class="ck-card"><div class="ck-empty">⚠️ 加载失败，请稍后重试</div></div>'; }
      }).catch(function () {
        el.innerHTML = '<div class="ck-card"><div class="ck-empty">⚠️ 加载失败，请检查网络</div></div>';
      });
    }

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = "签到中…";
      api("/api/checkin", { method: "POST" }).then(function (j) {
        if (j && j.ok) {
          render(j);
          if (!j.already) tip.textContent = "签到成功 +" + (j.gained || 0) + " 积分 🎉";
        } else { btn.disabled = false; btn.textContent = "签到领积分"; }
      }).catch(function () { btn.disabled = false; btn.textContent = "签到领积分"; });
    });

    load();
  }

  /* 注册为左侧栏「每日签到」视图（兼容 window.DF 尚未就绪的情况） */
  function reg(D) {
    D.VIEWS.checkin = {
      html: function () { return '<div id="df-checkin"></div>'; },
      init: function () { var el = document.getElementById("df-checkin"); if (el) renderInto(el); }
    };
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
