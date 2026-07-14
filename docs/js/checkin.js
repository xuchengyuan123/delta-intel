/* 三角洲情报台 · 每日签到 + 积分（悬浮小组件）
 * 自包含：优先用 window.D.api()，否则自己带 Bearer 请求 /api/checkin。
 * 仅在已登录（localStorage 有 di_user_token）时显示。 */
(function () {
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

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function mount() {
    if (!isLogin()) return;            // 未登录不显示
    if (document.getElementById("df-checkin")) return;

    var root = el("div");
    root.id = "df-checkin";
    root.innerHTML =
      '<style>' +
      '#df-checkin .ck-pill{position:fixed;top:64px;right:12px;z-index:60;display:flex;align-items:center;gap:6px;' +
      'background:var(--card,#1c1f26);color:var(--text,#fff);border:1px solid var(--border,#333);border-radius:999px;' +
      'padding:7px 12px;font-size:13px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);user-select:none;}' +
      '#df-checkin .ck-pill .ck-coin{font-size:15px;}' +
      '#df-checkin .ck-panel{position:fixed;top:104px;right:12px;z-index:61;width:248px;background:var(--card,#1c1f26);' +
      'color:var(--text,#fff);border:1px solid var(--border,#333);border-radius:14px;padding:14px;box-shadow:0 8px 28px rgba(0,0,0,.45);display:none;}' +
      '#df-checkin .ck-panel.show{display:block;}' +
      '#df-checkin .ck-h{display:flex;justify-content:space-between;align-items:center;font-weight:600;margin-bottom:8px;}' +
      '#df-checkin .ck-lv{font-size:12px;color:var(--accent,#4da3ff);}' +
      '#df-checkin .ck-bar{height:7px;border-radius:6px;background:var(--border,#333);overflow:hidden;margin:6px 0 10px;}' +
      '#df-checkin .ck-bar>i{display:block;height:100%;background:linear-gradient(90deg,#4da3ff,#7ee0c0);}' +
      '#df-checkin .ck-streak{display:flex;gap:4px;margin-bottom:10px;}' +
      '#df-checkin .ck-dot{flex:1;height:22px;border-radius:6px;background:var(--border,#333);display:flex;align-items:center;justify-content:center;font-size:11px;color:#888;}' +
      '#df-checkin .ck-dot.on{background:linear-gradient(135deg,#4da3ff,#7ee0c0);color:#06251f;font-weight:700;}' +
      '#df-checkin .ck-btn{width:100%;border:0;border-radius:10px;padding:9px;font-size:14px;font-weight:700;cursor:pointer;' +
      'background:linear-gradient(135deg,#4da3ff,#7ee0c0);color:#06251f;}' +
      '#df-checkin .ck-btn:disabled{opacity:.6;cursor:default;}' +
      '#df-checkin .ck-tip{font-size:11px;color:#9aa;margin-top:8px;text-align:center;}' +
      '@media(max-width:480px){#df-checkin .ck-panel{right:8px;width:calc(100vw - 16px);}}' +
      '</style>' +
      '<div class="ck-pill"><span class="ck-coin">🪙</span><span class="ck-pts">0</span></div>' +
      '<div class="ck-panel">' +
      '  <div class="ck-h"><span>每日签到</span><span class="ck-lv">Lv.1</span></div>' +
      '  <div class="ck-bar"><i style="width:0%"></i></div>' +
      '  <div class="ck-streak"></div>' +
      '  <button class="ck-btn">签到</button>' +
      '  <div class="ck-tip"></div>' +
      '</div>';
    document.body.appendChild(root);

    var pill = root.querySelector(".ck-pill");
    var panel = root.querySelector(".ck-panel");
    var ptsEl = root.querySelector(".ck-pts");
    var lvEl = root.querySelector(".ck-lv");
    var barEl = root.querySelector(".ck-bar>i");
    var streakEl = root.querySelector(".ck-streak");
    var btn = root.querySelector(".ck-btn");
    var tip = root.querySelector(".ck-tip");

    pill.addEventListener("click", function () { panel.classList.toggle("show"); });
    document.addEventListener("click", function (e) {
      if (panel.classList.contains("show") && !root.contains(e.target)) panel.classList.remove("show");
    });

    function render(d) {
      d = d || {};
      ptsEl.textContent = d.points || 0;
      lvEl.textContent = "Lv." + (d.level || 1);
      var into = d.into || 0, next = d.next || 100;
      barEl.style.width = Math.max(0, Math.min(100, Math.round(into / next * 100))) + "%";
      // 连续签到 7 格
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
        else { root.remove(); }
      }).catch(function () { root.remove(); });
    }

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = "签到中…";
      api("/api/checkin", { method: "POST" }).then(function (j) {
        if (j && j.ok) {
          render(j);
          if (!j.already) {
            tip.textContent = "签到成功 +" + (j.gained || 0) + " 积分 🎉";
            pill.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 360 });
          }
        } else { btn.disabled = false; btn.textContent = "签到领积分"; }
      }).catch(function () { btn.disabled = false; btn.textContent = "签到领积分"; });
    });

    load();
  }

  function tryMount() {
    try { if (isLogin() && !document.getElementById("df-checkin")) mount(); }
    catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryMount);
  else tryMount();

  // 登录后（同页弹窗）或跨标签页登录后刷新
  window.addEventListener("storage", function (e) { if (e.key === TOKEN_KEY) tryMount(); });
  // 轮询兜底：登录弹窗可能在同页完成，给 8 秒内两次机会
  setTimeout(tryMount, 1500);
  setTimeout(tryMount, 5000);
})();
