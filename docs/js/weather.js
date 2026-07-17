/* 三角洲情报台 · 天气小组件（Open-Meteo，免密钥、浏览器直连、支持 CORS）
 * 天气预报式详细显示：当前大卡 + 指标(湿度/体感/风速/气压) + 未来24小时横滑 + 未来7天 + 温度走势曲线。
 * 首页 <main> 内 <div id="weatherCard"></div> 自动填充；
 * 同时注册 window.DF.VIEWS.weather，由左侧栏「天气预报」入口进入独立页面。 */
(function () {
  "use strict";
  var KEY = "di_weather_city";

  // 注入样式（与站点 --card/--border/--accent/--text/--muted 变量一致）
  var st = document.createElement("style");
  st.textContent =
    ".weather-wrap{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:0 0 16px;display:flex;flex-direction:column;gap:12px;}" +
    ".wx-head{display:flex;align-items:center;gap:12px;}" +
    ".wx-ico{font-size:40px;line-height:1;}" +
    ".wx-now{display:flex;flex-direction:column;}" +
    ".wx-temp{font-size:32px;font-weight:800;line-height:1;}" +
    ".wx-desc{font-size:14px;color:var(--muted);}" +
    ".wx-city{margin-left:auto;text-align:right;}" +
    ".wx-city b{font-size:14px;color:var(--accent);}" +
    ".wx-city small{display:block;color:var(--muted);font-size:11px;margin-top:2px;}" +
    ".wx-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}" +
    ".wx-metric{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 4px;text-align:center;}" +
    ".wx-metric .k{font-size:11px;color:var(--muted);}" +
    ".wx-metric .v{font-size:15px;font-weight:700;margin-top:3px;}" +
    ".wx-sec-t{font-size:13px;font-weight:700;color:var(--muted);margin:2px 0;}" +
    ".wx-hours{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;}" +
    ".wx-hours::-webkit-scrollbar{height:6px;}" +
    ".wx-hours::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}" +
    ".wx-hour{flex:0 0 auto;width:60px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 4px;text-align:center;}" +
    ".wx-hour .t{font-size:11px;color:var(--muted);}" +
    ".wx-hour .i{font-size:20px;line-height:1.4;}" +
    ".wx-hour .tp{font-size:13px;font-weight:700;}" +
    ".wx-hour .pp{font-size:10px;color:#5aa9ff;}" +
    ".wx-days{display:flex;flex-direction:column;gap:6px;}" +
    ".wx-day{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:7px 10px;}" +
    ".wx-day .wd{width:40px;font-size:13px;font-weight:600;}" +
    ".wx-day .di{font-size:22px;width:30px;text-align:center;}" +
    ".wx-day .dt{font-size:13px;font-weight:700;}" +
    ".wx-day .dp{font-size:11px;color:#5aa9ff;margin-left:auto;}" +
    ".wx-chart{width:100%;height:84px;display:block;}" +
    ".wx-edit{display:flex;gap:8px;}" +
    ".wx-edit input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);}" +
    ".wx-edit button{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;}" +
    ".wx-loading,.wx-err{padding:8px 0;color:var(--muted);font-size:13px;}";
  document.head.appendChild(st);

  var WMO = {
    0: ["☀️", "晴"], 1: ["🌤️", "大致晴朗"], 2: ["⛅", "局部多云"], 3: ["☁️", "阴"],
    45: ["🌫️", "雾"], 48: ["🌫️", "雾凇"],
    51: ["🌦️", "毛毛雨"], 53: ["🌦️", "毛毛雨"], 55: ["🌦️", "毛毛雨"],
    56: ["🌧️", "冻毛雨"], 57: ["🌧️", "冻毛雨"],
    61: ["🌧️", "小雨"], 63: ["🌧️", "中雨"], 65: ["🌧️", "大雨"],
    66: ["🌧️", "冻雨"], 67: ["🌧️", "冻雨"],
    71: ["🌨️", "小雪"], 73: ["🌨️", "中雪"], 75: ["🌨️", "大雪"], 77: ["🌨️", "雪粒"],
    80: ["🌦️", "阵雨"], 81: ["🌦️", "阵雨"], 82: ["⛈️", "强阵雨"],
    85: ["🌨️", "阵雪"], 86: ["🌨️", "阵雪"],
    95: ["⛈️", "雷暴"], 96: ["⛈️", "雷暴伴雹"], 99: ["⛈️", "强雷暴伴雹"]
  };
  function wmo(c) { return WMO[c] || ["🌡️", "未知"]; }
  function esc(s) { s = String(s == null ? '' : s); var q = String.fromCharCode(34); return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(new RegExp(q, 'g'), '&quot;').replace(/'/g, '&#39;'); }
  // 风向度数 → 8 方位中文
  function dirCn(deg) {
    if (deg == null || isNaN(deg)) return "未知";
    var arr = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    return arr[Math.round(((deg % 360) / 45)) % 8];
  }

  var city = { name: "上海", lat: 31.2304, lon: 121.4737 };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || "null"); if (sv && sv.lat) city = sv; } catch (e) {}

  // 温度走势曲线（取 hourly 切片，画 SVG 折线）
  function tempCurve(h, fromIdx, n) {
    var vals = [];
    var k = fromIdx;
    while (k < h.temperature_2m.length && vals.length < n) vals.push(h.temperature_2m[k++]);
    if (vals.length < 2) return "";
    var W = 320, H = 80, pad = 8;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var rng = (mx - mn) || 1;
    var pts = vals.map(function (v, i) {
      var x = pad + i * (W - 2 * pad) / (vals.length - 1);
      var y = H - pad - (v - mn) / rng * (H - 2 * pad);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg class="wx-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function renderInto(el, j) {
    if (!el || !j || !j.current) return;
    var c = j.current;
    var m = wmo(c.weather_code);
    var app = c.apparent_temperature != null ? Math.round(c.apparent_temperature) + "°" : "—";
    var metrics = [
      ["💧 湿度", Math.round(c.relative_humidity_2m) + "%"],
      ["🌡️ 体感", app],
      ["💨 风速", Math.round(c.wind_speed_10m) + " km/h"],
      ["🌬️ 气压", Math.round(c.pressure_msl) + " hPa"]
    ];
    // 逐小时：从当前时刻起，每 3 小时取一个，共 8 个（24h）
    var h = j.hourly, hrs = "";
    if (h && h.time && h.time.length) {
      var now = Date.now(), startIdx = 0;
      for (var i = 0; i < h.time.length; i++) {
        if (new Date(h.time[i]).getTime() >= now - 3600000) { startIdx = i; break; }
      }
      var cnt = 0;
      for (var k = startIdx; k < h.time.length && cnt < 8; k += 3, cnt++) {
        var d = new Date(h.time[k]);
        var hm = wmo(h.weather_code[k]);
        var pp = (h.precipitation_probability && h.precipitation_probability[k] != null) ? h.precipitation_probability[k] : 0;
        hrs += '<div class="wx-hour"><div class="t">' + d.getHours() + "时</div>" +
          '<div class="i">' + hm[0] + "</div>" +
          '<div class="tp">' + Math.round(h.temperature_2m[k]) + "°</div>" +
          '<div class="pp">💧' + pp + "%</div></div>";
      }
    }
    if (!hrs) hrs = '<div class="ac-empty">暂无逐小时数据</div>';
    // 7 天
    var dd = j.daily, days = "";
    if (dd && dd.time && dd.time.length) {
      var wdArr = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      for (var x = 0; x < dd.time.length && x < 7; x++) {
        var dt = new Date(dd.time[x]);
        var wdn = x === 0 ? "今天" : wdArr[dt.getDay()];
        var dm = wmo(dd.weather_code[x]);
        var dpp = (dd.precipitation_probability_max && dd.precipitation_probability_max[x] != null) ? dd.precipitation_probability_max[x] : 0;
        days += '<div class="wx-day"><div class="wd">' + wdn + "</div>" +
          '<div class="di">' + dm[0] + "</div>" +
          '<div class="dt">' + Math.round(dd.temperature_2m_min[x]) + "° ~ " + Math.round(dd.temperature_2m_max[x]) + "°</div>" +
          '<div class="dp">💧' + dpp + "%</div></div>";
      }
    }
    if (!days) days = '<div class="ac-empty">暂无预报数据</div>';
    var curve = tempCurve(h, startIdx, 24);

    el.innerHTML =
      '<div class="weather-wrap">' +
      '<div class="wx-head"><span class="wx-ico">' + m[0] + '</span>' +
      '<div class="wx-now"><div class="wx-temp">' + Math.round(c.temperature_2m) + '°</div><div class="wx-desc">' + m[1] + '</div></div>' +
      '<div class="wx-city"><b>' + esc(city.name) + '</b><small>' + dirCn(c.wind_direction_10m) + '风 · 云量 ' + Math.round(c.cloud_cover) + '%</small></div></div>' +
      '<div class="wx-metrics">' + metrics.map(function (x) {
        return '<div class="wx-metric"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>';
      }).join("") + '</div>' +
      '<div class="wx-sec-t">🕐 未来 24 小时</div><div class="wx-hours">' + hrs + '</div>' +
      '<div class="wx-sec-t">📅 未来 7 天预报</div><div class="wx-days">' + days + '</div>' +
      (curve ? '<div class="wx-sec-t">🌡️ 温度走势（24h）</div>' + curve : '') +
      '<div class="wx-edit"><input id="wxInput" placeholder="切换城市，如：北京 / 广州" /><button id="wxBtn">查询</button></div>' +
      '</div>';
    var inp = el.querySelector("#wxInput");
    var btn = el.querySelector("#wxBtn");
    function go() { var v = inp.value.trim(); if (v) geocode(v); }
    btn.onclick = go;
    inp.onkeydown = function (e) { if (e.key === "Enter") go(); };
  }

  function loadInto(el) {
    if (!el) return;
    el.innerHTML = '<div class="weather-wrap"><div class="wx-loading">天气加载中…</div></div>';
    var u = "https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover" +
      "&hourly=temperature_2m,precipitation_probability,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto&forecast_days=7";
    fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.current) renderInto(el, j);
      else el.innerHTML = '<div class="weather-wrap"><div class="wx-err">天气数据暂不可用</div></div>';
    }).catch(function () {
      el.innerHTML = '<div class="weather-wrap"><div class="wx-err">天气获取失败（可能是网络限制，可换城市重试）</div></div>';
    });
  }

  function geocode(name) {
    var u = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=1&language=zh";
    fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var r0 = (j && j.results && j.results[0]);
      if (r0) {
        city = { name: r0.name, lat: r0.latitude, lon: r0.longitude };
        try { localStorage.setItem(KEY, JSON.stringify(city)); } catch (e) {}
        loadInto(document.getElementById("weatherCard"));
        loadInto(document.getElementById("weatherView"));
      } else {
        var c = document.getElementById("wxInput"); if (c) c.value = "未找到该城市";
      }
    }).catch(function () {
      var c = document.getElementById("wxInput"); if (c) c.value = "查询失败";
    });
  }

  // 首页自动填充
  var homeCard = document.getElementById("weatherCard");
  if (homeCard) loadInto(homeCard);

  // 注册为左侧栏「天气预报」视图（兼容 window.DF 尚未就绪的情况）
  function reg(D) {
    D.VIEWS.weather = {
      html: function () { return '<div id="weatherView"></div>'; },
      init: function () { loadInto(document.getElementById("weatherView")); }
    };
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
