/* 三角洲情报台 · 地震/台风预警小组件
 * 数据来源（均免密钥、浏览器直连、支持 CORS）：
 *   - 地震：Wolfx 代理中国地震台网(CENC) https://api.wolfx.jp/cenc_eqlist.json
 *   - 台风：中央气象台台风网 https://typhoon.nmc.cn/weatherservice/typhoon/jsons/...
 * 用法：首页 <main> 内放 <div id="alertsCard"></div> 即可。
 * 自动匹配地区：复用天气组件的城市 localStorage(di_weather_city)；
 *   地震距用户 <1000km、台风距用户 <2000km 时高亮提示，并显示实时风向/震源。
 * 每 5 分钟自动刷新。
 */
(function () {
  "use strict";
  var KEY = "di_weather_city";
  var card = document.getElementById("alertsCard");
  if (!card) return;

  // 注入样式（与站点 --card/--border/--accent/--text/--muted/--bg 变量一致）
  var st = document.createElement("style");
  st.textContent =
    ".alerts-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:0 0 16px;display:flex;flex-direction:column;gap:10px;}" +
    ".ac-head{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;}" +
    ".ac-region{margin-left:auto;font-size:12px;color:var(--accent);font-weight:600;}" +
    ".ac-sec{display:flex;flex-direction:column;gap:6px;}" +
    ".ac-sec-t{font-size:13px;color:var(--muted);font-weight:600;}" +
    ".ac-body{display:flex;flex-direction:column;gap:8px;}" +
    ".ac-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--bg);}" +
    ".ac-item.ac-near{border-color:#ff5c5c;box-shadow:0 0 0 1px rgba(255,92,92,.35);}" +
    ".ac-mag{font-weight:800;font-size:14px;min-width:38px;text-align:center;border-radius:8px;padding:5px 0;color:#fff;}" +
    ".mag-hi{background:#e23b3b;}.mag-mid{background:#e8923b;}.mag-lo{background:#3b8ee2;}" +
    ".ac-typh{font-size:22px;line-height:1;}" +
    ".ac-info{display:flex;flex-direction:column;gap:2px;min-width:0;}" +
    ".ac-loc{font-size:14px;font-weight:600;}" +
    ".ac-meta{font-size:12px;color:var(--muted);}" +
    ".ac-dim{color:var(--muted);font-weight:400;font-size:12px;}" +
    ".ac-badge{background:#ff5c5c;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;}" +
    ".ac-empty{padding:6px 2px;color:var(--muted);font-size:13px;}" +
    ".ac-foot{font-size:11px;color:var(--muted);border-top:1px dashed var(--border);padding-top:8px;}";
  document.head.appendChild(st);

  var EQ_URL = "https://api.wolfx.jp/cenc_eqlist.json";
  var TY_LIST_URL = "https://typhoon.nmc.cn/weatherservice/typhoon/jsons/list_default";
  function tyViewUrl(id) { return "https://typhoon.nmc.cn/weatherservice/typhoon/jsons/view_" + id; }

  // 复用天气城市；缺失则用上海
  var userCity = { name: "上海", lat: 31.2304, lon: 121.4737 };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || "null"); if (sv && sv.lat) userCity = sv; } catch (e) {}

  function esc(s) { var d = document.createElement("div"); d.textContent = (s == null ? "" : String(s)); return d.innerHTML; }

  // 16 方位缩写 → 中文
  var DIR = { N: "北", NNE: "北东北", NE: "东北", ENE: "东东北", E: "东", ESE: "东东南", SE: "东南", SSE: "南东南", S: "南", SSW: "南西南", SW: "西南", WSW: "西西南", W: "西", WNW: "西西北", NW: "西北", NNW: "北西北" };
  function dirCn(d) { return DIR[d] || (d || "未知"); }

  var TY_TYPE = { TD: "热带低压", TS: "热带风暴", TY: "台风", STY: "强台风", SuperTY: "超强台风" };

  // 球面距离（km）
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // 解析 JSONP（中央气象台返回  name(({...}))  形式）
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

  function skeleton() {
    card.innerHTML =
      '<div class="alerts-card">' +
      '<div class="ac-head">🌐 地震 / 台风预警 <span class="ac-region">地区：' + esc(userCity.name) + '</span></div>' +
      '<div class="ac-sec"><div class="ac-sec-t">🌍 地震 · 中国地震台网</div><div id="acEq" class="ac-body">加载中…</div></div>' +
      '<div class="ac-sec"><div class="ac-sec-t">🌀 台风 · 中央气象台</div><div id="acTy" class="ac-body">加载中…</div></div>' +
      '<div class="ac-foot">数据来源：CENC / 中央气象台 · 每 5 分钟自动刷新 · 距你较近时高亮提示</div>' +
      '</div>';
  }

  function loadEq() {
    var box = document.getElementById("acEq");
    if (!box) return;
    fetch(EQ_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      var items = Object.keys(d).map(function (k) { return d[k]; })
        .filter(function (it) { return parseFloat(it.magnitude) >= 3; })
        .sort(function (a, b) {
          return new Date(b.time.replace(/-/g, "/")) - new Date(a.time.replace(/-/g, "/"));
        })
        .slice(0, 12);
      if (!items.length) { box.innerHTML = '<div class="ac-empty">近期无显著地震记录</div>'; return; }
      var html = "";
      items.forEach(function (it) {
        var lat = parseFloat(it.latitude), lon = parseFloat(it.longitude);
        var dist = haversine(userCity.lat, userCity.lon, lat, lon);
        var near = dist <= 1000;
        html +=
          '<div class="ac-item' + (near ? " ac-near" : "") + '">' +
          '<span class="ac-mag ' + magClass(it.magnitude) + '">' + esc(it.magnitude) + '</span>' +
          '<div class="ac-info">' +
          '<div class="ac-loc">' + esc(it.placeName || it.location) +
          (near ? ' <span class="ac-badge">⚠ 距你约 ' + dist + ' km</span>'
                : ' <span class="ac-dim">· 距你 ' + dist + ' km</span>') + '</div>' +
          '<div class="ac-meta">' + fmtAgo(it.time) + ' · 深度 ' + esc(it.depth) + ' km · 震源 ' +
          lat.toFixed(2) + ',' + lon.toFixed(2) + '</div>' +
          '</div></div>';
      });
      box.innerHTML = html;
    }).catch(function () {
      box.innerHTML = '<div class="ac-empty">⚠ 地震数据暂时无法获取（可能是网络限制）</div>';
    });
  }

  function loadTy() {
    var box = document.getElementById("acTy");
    if (!box) return;
    fetch(TY_LIST_URL).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (txt) {
      var data = parseJsonp(txt);
      var list = (data.typhoonList || []).filter(function (t) { return t[7] === "start"; });
      if (!list.length) { box.innerHTML = '<div class="ac-empty">当前无活跃台风</div>'; return; }
      Promise.all(list.map(function (t) {
        var id = t[0], cn = t[2], en = t[1];
        return fetch(tyViewUrl(id)).then(function (r) { return r.text(); }).then(function (vt) {
          var vd = parseJsonp(vt);
          var tp = vd.typhoon || [];
          var tracks = tp[8] || [];
          var last = tracks[tracks.length - 1];
          return { id: id, cn: cn, en: en, track: last };
        }).catch(function () { return null; });
      })).then(function (arr) {
        arr = arr.filter(Boolean);
        if (!arr.length) { box.innerHTML = '<div class="ac-empty">⚠ 台风数据暂时无法获取</div>'; return; }
        var html = "";
        arr.forEach(function (o) {
          var tr = o.track;
          if (!tr) return;
          var lon = parseFloat(tr[4]), lat = parseFloat(tr[5]), pres = tr[6],
              wind = parseFloat(tr[7]), dir = tr[8], spd = parseFloat(tr[9]);
          var dist = haversine(userCity.lat, userCity.lon, lat, lon);
          var near = dist <= 2000;
          var typeName = TY_TYPE[tr[3]] || tr[3] || "";
          html +=
            '<div class="ac-item' + (near ? " ac-near" : "") + '">' +
            '<span class="ac-typh">🌀</span>' +
            '<div class="ac-info">' +
            '<div class="ac-loc">' + esc(o.cn) + ' <span class="ac-dim">' + esc(o.en) + '</span>' +
            (near ? ' <span class="ac-badge">⚠ 距你约 ' + dist + ' km</span>'
                  : ' <span class="ac-dim">· 距你 ' + dist + ' km</span>') + '</div>' +
            '<div class="ac-meta">' + typeName + ' · 最大风速 ' + wind + ' m/s · 气压 ' + pres + ' hPa</div>' +
            '<div class="ac-meta">实时风向(移动) ' + dirCn(dir) + ' · 移速 ' + spd + ' km/h · 中心 ' +
            lat.toFixed(1) + '°N,' + lon.toFixed(1) + '°E</div>' +
            '</div></div>';
        });
        box.innerHTML = html || '<div class="ac-empty">当前无活跃台风</div>';
      });
    }).catch(function () {
      box.innerHTML = '<div class="ac-empty">⚠ 台风数据暂时无法获取（可能是网络限制）</div>';
    });
  }

  skeleton();
  loadEq();
  loadTy();
  setInterval(function () { loadEq(); loadTy(); }, 300000);
})();
