/* 三角洲情报台 · 地震/台风预警
 * 数据来源（均免密钥、浏览器直连、支持 CORS）：
 *   - 地震：Wolfx 代理中国地震台网(CENC) https://api.wolfx.jp/cenc_eqlist.json
 *   - 台风：中央气象台台风网 https://typhoon.nmc.cn/weatherservice/typhoon/jsons/...
 * 自动匹配地区：复用天气组件的城市 localStorage(di_weather_city)；
 *   地震距用户 <1000km、台风距用户 <2000km 时高亮提示，并显示实时风向/震源。
 * 每 5 分钟自动刷新。
 * 行为：仅当存在「距你较近」的活跃预警时，右下角出现闪烁悬浮按钮；
 *       左侧栏「台风 / 地震预警」入口进入独立页面查看完整列表。 */
(function () {
  "use strict";
  var KEY = "di_weather_city";

  // 注入样式
  var st = document.createElement("style");
  st.textContent =
    ".alerts-fab{position:fixed;right:18px;bottom:18px;z-index:90;width:56px;height:56px;border-radius:50%;background:#e23b3b;color:#fff;border:0;box-shadow:0 4px 18px rgba(0,0,0,.25);font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}" +
    ".alerts-fab:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);}" +
    ".alerts-fab.blink{animation:alertsBlink 1.2s infinite;}" +
    "@keyframes alertsBlink{0%,100%{box-shadow:0 0 0 0 rgba(255,92,92,.6);}50%{box-shadow:0 0 0 12px rgba(255,92,92,0);}}" +
    ".alerts-badge{position:absolute;top:-4px;right:-4px;background:#fff;color:#e23b3b;border-radius:999px;padding:2px 7px;font-size:12px;font-weight:700;min-width:22px;text-align:center;border:2px solid var(--bg);}" +
    ".alerts-modal .modal-card{width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;text-align:left;padding:0;}" +
    ".alerts-modal .modal-card h2{margin:0;font-size:18px;display:flex;align-items:center;gap:8px;}" +
    ".alerts-modal .alerts-body{padding:16px;overflow-y:auto;flex:1;}" +
    ".alerts-modal .alerts-foot{padding:10px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);text-align:center;}" +
    ".alerts-modal .alerts-tabs{display:flex;gap:8px;margin-bottom:12px;}" +
    ".alerts-modal .alerts-tab{flex:1;background:var(--bg-soft);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px;font-size:13px;cursor:pointer;font-weight:600;}" +
    ".alerts-modal .alerts-tab.active{background:var(--accent);color:#1a1a1a;border-color:var(--accent);}" +
    ".alerts-modal .ac-region{display:flex;align-items:center;gap:8px;margin-left:auto;font-size:13px;color:var(--muted);}" +
    ".alerts-modal .ac-region select{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:4px 8px;font-size:13px;}" +
    ".alerts-modal .ac-body{display:flex;flex-direction:column;gap:8px;}" +
    ".alerts-modal .ac-item{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg);}" +
    ".alerts-modal .ac-item.ac-near{border-color:#ff5c5c;box-shadow:0 0 0 1px rgba(255,92,92,.35);}" +
    ".alerts-modal .ac-mag{font-weight:800;font-size:14px;min-width:38px;text-align:center;border-radius:8px;padding:5px 0;color:#fff;}" +
    ".alerts-modal .mag-hi{background:#e23b3b;}.alerts-modal .mag-mid{background:#e8923b;}.alerts-modal .mag-lo{background:#3b8ee2;}" +
    ".alerts-modal .ac-typh{font-size:22px;line-height:1;}" +
    ".alerts-modal .ac-info{display:flex;flex-direction:column;gap:2px;min-width:0;}" +
    ".alerts-modal .ac-loc{font-size:14px;font-weight:600;}" +
    ".alerts-modal .ac-meta{font-size:12px;color:var(--muted);}" +
    ".alerts-modal .ac-dim{color:var(--muted);font-weight:400;font-size:12px;}" +
    ".alerts-modal .ac-badge{background:#ff5c5c;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;}" +
    ".alerts-modal .ac-empty{padding:6px 2px;color:var(--muted);font-size:13px;}" +
    ".ac-view{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:18px;}" +
    ".ac-view .ac-sec h3{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px;}" +
    ".ac-view .ac-body{display:flex;flex-direction:column;gap:8px;}";
  document.head.appendChild(st);

  var EQ_URL = "https://api.wolfx.jp/cenc_eqlist.json";
  var TY_LIST_URL = "https://typhoon.nmc.cn/weatherservice/typhoon/jsons/list_default";
  function tyViewUrl(id) { return "https://typhoon.nmc.cn/weatherservice/typhoon/jsons/view_" + id; }

  var userCity = { name: "上海", lat: 31.2304, lon: 121.4737 };
  function loadCity() {
    try {
      var sv = JSON.parse(localStorage.getItem(KEY) || "null");
      if (sv && sv.lat) userCity = sv;
    } catch (e) {}
  }
  loadCity();

  var eqData = [], tyData = [], badgeCount = 0;

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  var DIR = { N: "北", NNE: "北东北", NE: "东北", ENE: "东东北", E: "东", ESE: "东东南", SE: "东南", SSE: "南东南", S: "南", SSW: "南西南", SW: "西南", WSW: "西西南", W: "西", WNW: "西西北", NW: "西北", NNW: "北西北" };
  function dirCn(d) { return DIR[d] || (d || "未知"); }
  var TY_TYPE = { TD: "热带低压", TS: "热带风暴", TY: "台风", STY: "强台风", SuperTY: "超强台风" };

  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function parseJsonp(text) {
    var s = text.indexOf("((") >= 0 ? text.indexOf("((") : text.indexOf("(");
    var start = text.indexOf("{", s);
    var end = text.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("bad jsonp");
    return JSON.parse(text.slice(start, end + 1));
  }

  function fmtAgo(timeStr) {
    var t = new Date(String(timeStr).replace(/-/g, "/")).getTime();
    if (isNaN(t)) return timeStr;
    var diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 0) return "刚刚";
    if (diff < 60) return diff + "秒前";
    if (diff < 3600) return Math.floor(diff / 60) + "分钟前";
    if (diff < 86400) return Math.floor(diff / 3600) + "小时前";
    return Math.floor(diff / 86400) + "天前";
  }

  function magClass(m) { m = parseFloat(m); if (m >= 5) return "mag-hi"; if (m >= 4) return "mag-mid"; return "mag-lo"; }

  function renderFab() {
    var existing = document.getElementById("alertsFab");
    if (badgeCount <= 0) { if (existing) existing.remove(); return; }
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "alertsFab";
      document.body.appendChild(existing);
    }
    existing.innerHTML = '<button class="alerts-fab" id="alertsBtn" title="地震/台风预警">🌐' +
      '<span class="alerts-badge">' + badgeCount + '</span></button>';
    var btn = document.getElementById("alertsBtn");
    btn.classList.add("blink");
    btn.addEventListener("click", openModal);
  }

  function openModal() {
    if (document.getElementById("alertsModal")) return;
    var wrap = document.createElement("div");
    wrap.id = "alertsModal";
    wrap.className = "modal-backdrop alerts-modal";
    wrap.innerHTML =
      '<div class="modal-card">' +
      '<div class="modal-head">' +
      '<h2>🌐 地震 / 台风预警</h2>' +
      '<div class="ac-region">' +
      '<span>关注地区：</span>' +
      '<select id="alertsCity">' +
      '<option value="31.2304,121.4737,上海">上海</option>' +
      '<option value="39.9042,116.4074,北京">北京</option>' +
      '<option value="23.1291,113.2644,广州">广州</option>' +
      '<option value="22.5431,114.0579,深圳">深圳</option>' +
      '<option value="30.5728,104.0668,成都">成都</option>' +
      '<option value="34.3416,108.9398,西安">西安</option>' +
      '<option value="36.0611,120.3826,青岛">青岛</option>' +
      '<option value="29.5630,106.5516,重庆">重庆</option>' +
      '<option value="38.9140,121.6147,大连">大连</option>' +
      '<option value="26.0745,119.2965,福州">福州</option>' +
      '</select>' +
      '</div>' +
      '<button class="modal-x" id="alertsClose">×</button>' +
      '</div>' +
      '<div class="alerts-body">' +
      '<div class="alerts-tabs">' +
      '<button class="alerts-tab active" data-tab="eq">🌍 地震</button>' +
      '<button class="alerts-tab" data-tab="ty">🌀 台风</button>' +
      '</div>' +
      '<div id="alertsTabEq" class="ac-body">加载中…</div>' +
      '<div id="alertsTabTy" class="ac-body" style="display:none">加载中…</div>' +
      '</div>' +
      '<div class="alerts-foot">数据来源：CENC / 中央气象台 · 每 5 分钟自动刷新 · 距你较近时高亮提示</div>' +
      '</div>';
    document.body.appendChild(wrap);

    var sel = document.getElementById("alertsCity");
    sel.value = userCity.lat + "," + userCity.lon + "," + userCity.name;
    sel.addEventListener("change", function () {
      var parts = sel.value.split(",");
      userCity = { lat: +parts[0], lon: +parts[1], name: parts[2] };
      try { localStorage.setItem(KEY, JSON.stringify(userCity)); } catch (e) {}
      fillEq();
      fillTy();
    });

    document.getElementById("alertsClose").addEventListener("click", closeModal);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closeModal(); });

    document.querySelectorAll(".alerts-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".alerts-tab").forEach(function (t) { t.classList.toggle("active", t === tab); });
        document.getElementById("alertsTabEq").style.display = tab.getAttribute("data-tab") === "eq" ? "flex" : "none";
        document.getElementById("alertsTabTy").style.display = tab.getAttribute("data-tab") === "ty" ? "flex" : "none";
      });
    });

    fillEq();
    fillTy();
  }

  function closeModal() { var m = document.getElementById("alertsModal"); if (m) m.remove(); }

  function fillEq() {
    var h = renderEqHtml(eqData);
    var a = document.getElementById("alertsTabEq"); if (a) a.innerHTML = h;
    var b = document.getElementById("acEqList"); if (b) b.innerHTML = h;
  }
  function fillTy() {
    var h = renderTyHtml(tyData);
    var a = document.getElementById("alertsTabTy"); if (a) a.innerHTML = h;
    var b = document.getElementById("acTyList"); if (b) b.innerHTML = h;
  }

  function renderEqHtml(items) {
    if (!items || !items.length) return '<div class="ac-empty">暂无数据</div>';
    return items.map(function (it) {
      var lat = parseFloat(it.latitude), lon = parseFloat(it.longitude);
      var dist = haversine(userCity.lat, userCity.lon, lat, lon);
      var near = dist <= 1000;
      return '<div class="ac-item' + (near ? " ac-near" : "") + '">' +
        '<span class="ac-mag ' + magClass(it.magnitude) + '">' + esc(it.magnitude) + '</span>' +
        '<div class="ac-info">' +
        '<div class="ac-loc">' + esc(it.placeName || it.location) +
        (near ? ' <span class="ac-badge">⚠ 距你约 ' + dist + ' km</span>'
              : ' <span class="ac-dim">· 距你 ' + dist + ' km</span>') + '</div>' +
        '<div class="ac-meta">' + fmtAgo(it.time) + ' · 深度 ' + esc(it.depth) + ' km · 震源 ' +
        lat.toFixed(2) + ',' + lon.toFixed(2) + '</div>' +
        '</div></div>';
    }).join("");
  }

  function renderTyHtml(items) {
    if (!items || !items.length) return '<div class="ac-empty">当前无活跃台风</div>';
    return items.map(function (o) {
      var tr = o.track;
      if (!tr) return "";
      var lon = parseFloat(tr[4]), lat = parseFloat(tr[5]), pres = tr[6],
          wind = parseFloat(tr[7]), dir = tr[8], spd = parseFloat(tr[9]);
      var dist = haversine(userCity.lat, userCity.lon, lat, lon);
      var near = dist <= 2000;
      var typeName = TY_TYPE[tr[3]] || tr[3] || "";
      return '<div class="ac-item' + (near ? " ac-near" : "") + '">' +
        '<span class="ac-typh">🌀</span>' +
        '<div class="ac-info">' +
        '<div class="ac-loc">' + esc(o.cn) + ' <span class="ac-dim">' + esc(o.en) + '</span>' +
        (near ? ' <span class="ac-badge">⚠ 距你约 ' + dist + ' km</span>'
              : ' <span class="ac-dim">· 距你 ' + dist + ' km</span>') + '</div>' +
        '<div class="ac-meta">' + typeName + ' · 最大风速 ' + wind + ' m/s · 气压 ' + pres + ' hPa</div>' +
        '<div class="ac-meta">实时风向(移动) ' + dirCn(dir) + ' · 移速 ' + spd + ' km/h · 中心 ' +
        lat.toFixed(1) + '°N,' + lon.toFixed(1) + '°E</div>' +
        '</div></div>';
    }).join("");
  }

  function updateBadge() {
    badgeCount = 0;
    eqData.forEach(function (it) {
      var dist = haversine(userCity.lat, userCity.lon, parseFloat(it.latitude), parseFloat(it.longitude));
      if (dist <= 1000) badgeCount++;
    });
    tyData.forEach(function (o) {
      var tr = o.track; if (!tr) return;
      var dist = haversine(userCity.lat, userCity.lon, parseFloat(tr[5]), parseFloat(tr[4]));
      if (dist <= 2000) badgeCount++;
    });
    renderFab();
  }

  function loadEq() {
    fetch(EQ_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      eqData = Object.keys(d).map(function (k) { return d[k]; })
        .filter(function (it) { return parseFloat(it.magnitude) >= 3; })
        .sort(function (a, b) {
          return new Date(b.time.replace(/-/g, "/")) - new Date(a.time.replace(/-/g, "/"));
        })
        .slice(0, 12);
      updateBadge();
      fillEq();
    }).catch(function () {
      eqData = [];
      fillEq();
    });
  }

  function loadTy() {
    fetch(TY_LIST_URL).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (txt) {
      var data = parseJsonp(txt);
      var list = (data.typhoonList || []).filter(function (t) { return t[7] === "start"; });
      if (!list.length) { tyData = []; updateBadge(); fillTy(); return; }
      Promise.all(list.map(function (t) {
        var id = t[0], cn = t[2], en = t[1];
        return fetch(tyViewUrl(id)).then(function (r) { return r.text(); }).then(function (vt) {
          var vd = parseJsonp(vt);
          var tp = vd.typhoon || [];
          var tracks = tp[8] || [];
          return { id: id, cn: cn, en: en, track: tracks[tracks.length - 1] };
        }).catch(function () { return null; });
      })).then(function (arr) {
        tyData = arr.filter(Boolean);
        updateBadge();
        fillTy();
      });
    }).catch(function () {
      tyData = [];
      fillTy();
    });
  }

  loadEq();
  loadTy();
  setInterval(function () { loadEq(); loadTy(); }, 300000);

  // 注册为左侧栏「台风 / 地震预警」视图（完整列表，无需弹窗；兼容 window.DF 尚未就绪）
  function reg(D) {
    D.VIEWS.alerts = {
      html: function () {
        return '<div id="alertsView" class="ac-view">' +
          '<div class="ac-sec"><h3>🌍 地震</h3><div id="acEqList" class="ac-body">加载中…</div></div>' +
          '<div class="ac-sec"><h3>🌀 台风</h3><div id="acTyList" class="ac-body">加载中…</div></div>' +
          '</div>';
      },
      init: function () { fillEq(); fillTy(); }
    };
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
