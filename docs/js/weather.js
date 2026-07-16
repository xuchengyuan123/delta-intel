/* 三角洲情报台 · 天气小组件（Open-Meteo，免密钥、浏览器直连、支持 CORS）
 * 用法：首页 <main> 内放 <div id="weatherCard"></div> 即可。
 * 默认城市存 localStorage(di_weather_city)，可输入城市名切换（经 Open-Meteo Geocoding）。
 */
(function () {
  "use strict";
  var KEY = "di_weather_city";
  var card = document.getElementById("weatherCard");
  if (!card) return;

  // 注入样式（与站点 --card/--border/--accent/--text/--muted 变量一致）
  var st = document.createElement("style");
  st.textContent =
    ".weather-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:0 0 16px;display:flex;flex-direction:column;gap:8px;}" +
    ".wx-top{display:flex;align-items:center;gap:12px;}" +
    ".wx-ico{font-size:34px;line-height:1;}" +
    ".wx-main{display:flex;flex-direction:column;}" +
    ".wx-temp{font-size:26px;font-weight:800;line-height:1;}" +
    ".wx-desc{font-size:13px;color:var(--muted);}" +
    ".wx-city{margin-left:auto;font-size:13px;color:var(--accent);font-weight:600;}" +
    ".wx-meta{font-size:12px;color:var(--muted);}" +
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
  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  var city = { name: "上海", lat: 31.2304, lon: 121.4737 };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || "null"); if (sv && sv.lat) city = sv; } catch (e) {}

  function render(w) {
    var m = wmo(w.weather_code);
    card.innerHTML =
      '<div class="wx-top"><span class="wx-ico">' + m[0] + '</span>' +
      '<div class="wx-main"><div class="wx-temp">' + Math.round(w.temperature_2m) + '°</div>' +
      '<div class="wx-desc">' + m[1] + '</div></div>' +
      '<div class="wx-city" id="wxCityName">' + esc(city.name) + '</div></div>' +
      '<div class="wx-meta">💧 ' + Math.round(w.relative_humidity_2m) + '% · 💨 ' + Math.round(w.wind_speed_10m) + ' km/h</div>' +
      '<div class="wx-edit"><input id="wxInput" placeholder="切换城市，如：北京 / 广州" /><button id="wxBtn">查询</button></div>';
    var inp = card.querySelector("#wxInput");
    var btn = card.querySelector("#wxBtn");
    function go() { var v = inp.value.trim(); if (v) geocode(v); }
    btn.onclick = go;
    inp.onkeydown = function (e) { if (e.key === "Enter") go(); };
  }

  function load() {
    card.innerHTML = '<div class="wx-loading">天气加载中…</div>';
    var u = "https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto";
    fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.current) render(j.current);
      else card.innerHTML = '<div class="wx-err">天气数据暂不可用</div>';
    }).catch(function () {
      card.innerHTML = '<div class="wx-err">天气获取失败（可能是网络限制，可换城市重试）</div>';
    });
  }

  function geocode(name) {
    var u = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=1&language=zh";
    fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var r0 = (j && j.results && j.results[0]);
      if (r0) {
        city = { name: r0.name, lat: r0.latitude, lon: r0.longitude };
        try { localStorage.setItem(KEY, JSON.stringify(city)); } catch (e) {}
        load();
      } else if (card.querySelector("#wxInput")) {
        card.querySelector("#wxInput").value = "未找到该城市";
      }
    }).catch(function () {
      if (card.querySelector("#wxInput")) card.querySelector("#wxInput").value = "查询失败";
    });
  }

  load();
})();
