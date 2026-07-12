/* =========================================================
 * mappass.js — 每日地图密码（真实、免费、可跨域的第三方数据源）
 *
 * 数据源：tmini.net/api/sjzmm
 *   - 免费三角洲行动每日密码接口，每日自动更新
 *   - 返回 CORS: *，浏览器可直接跨域 fetch（无需后端）
 *   - 返回结构：{ status: "success", data: { passwords: [
 *       { map_name, password, full_text, location_info: { description, images } }
 *     ]}}
 *
 * 设计原则：不伪造任何密码；取不到就显示"暂时拉不到最新密码，
 * 显示本地缓存"或"暂无"，绝不编造数字。
 * ========================================================= */
(function () {
  "use strict";

  var DEFAULT_URL = "https://tmini.net/api/sjzmm?type=json";
  var CACHE_KEY = "df_mappass_v1";
  var TTL = 10 * 60 * 1000; // 10 分钟（密码每天更新，10 分钟缓存足够）

  var cache = null;
  var listeners = [];

  function cfg() {
    var d = window.DF && window.DF.getData && window.DF.getData();
    return (d && d.mapPass) || { enabled: true, url: DEFAULT_URL };
  }

  function shortenLocation(s) {
    s = String(s || "").trim();
    if (!s) return "—";
    var cut = s.split(/[。，；;]/)[0].trim();
    if (cut.length > 22) cut = cut.slice(0, 22) + "…";
    return cut || "—";
  }

  function load(force) {
    if (c.enabled === false) return Promise.resolve(null);
    var url = c.url || DEFAULT_URL;
    if (!force && cache) return Promise.resolve(cache);
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.ts && (Date.now() - p.ts < TTL) && p.passwords) {
          cache = p; return Promise.resolve(p);
        }
      }
    } catch (e) {}
    return fetch(url + (url.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var passwords = (j && j.data && j.data.passwords) || [];
        var arr = passwords.map(function (it) {
          var loc = (it.location_info && it.location_info.description) || "";
          return {
            name: it.map_name || "",
            code: it.password || "",
            fullText: it.full_text || "",
            location: loc,
            shortLocation: shortenLocation(loc),
            images: (it.location_info && it.location_info.images) || []
          };
        });
        cache = { ts: Date.now(), passwords: arr, updateDate: (j && j.data && j.data.update_date) || "" };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        listeners.forEach(function (fn) { try { fn(cache); } catch (e) {} });
        return cache;
      })
      .catch(function (e) {
        if (cache) return cache;
        return { ts: 0, passwords: [], updateDate: "", error: e.message };
      });
  }

  function reg(D) {
    D.mapPass = {
      load: load,
      ready: function () { return cache; },
      list: function () { return (cache && cache.passwords) || []; },
      find: function (name) {
        var n = String(name || "").toLowerCase().trim();
        var arr = (cache && cache.passwords) || [];
        return arr.find(function (x) { return String(x.name || "").toLowerCase().trim() === n; });
      },
      meta: function () { return cache ? { ts: cache.ts, count: (cache.passwords || []).length, updateDate: cache.updateDate, error: cache.error } : null; },
      onChange: function (fn) { listeners.push(fn); }
    };
    setInterval(function () { load(true); }, TTL);
    load(false);

    // 覆盖 maps 视图：显示实时地图密码
    var originalMaps = D.VIEWS.maps;
    D.VIEWS.maps = {
      html: function () {
        var meta = D.mapPass.meta();
        var dateTag = meta && meta.updateDate ? '<span class="kk-snap">' + esc(meta.updateDate) + '</span>' : '';
        return '<div class="section-title">每日地图密码 ' + (meta && meta.error ? '<span class="kk-snap" style="background:#c0392b">源暂不可用</span>' : '<span class="kk-api">API 实时</span>') + '</div>' +
          '<div class="card"><table class="tbl"><thead><tr><th>地图</th><th>密码</th><th>位置</th></tr></thead><tbody id="mapPassBody">' + mapPassRows(D.mapPass.list()) + '</tbody></table>' +
          '<p class="guide-intro" style="margin-top:8px">数据来自 <a href="https://tmini.net/apidata?id=49" target="_blank">tmini.net</a> 免费公开接口，每日更新。</p></div>';
      },
      init: function () {
        function render() {
          var body = document.getElementById("mapPassBody");
          if (body) body.innerHTML = mapPassRows(D.mapPass.list());
        }
        if (D.mapPass.ready() && D.mapPass.ready().passwords.length) render();
        else D.mapPass.load(true).then(render);
        D.mapPass.onChange(render);
      }
    };

    function mapPassRows(arr) {
      if (!arr || !arr.length) return '<tr><td colspan="3" class="kk-empty">暂无数据</td></tr>';
      return arr.map(function (m) {
        return '<tr><td><strong>' + esc(m.name) + '</strong></td>' +
          '<td class="code" style="font-family:Consolas,monospace;letter-spacing:2px;color:var(--accent-2);font-weight:700">' + esc(m.code) + '</td>' +
          '<td>' + esc(m.location || "—") + '</td></tr>';
      }).join("");
    }
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
