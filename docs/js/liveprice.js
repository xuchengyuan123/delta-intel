/* =========================================================
 * liveprice.js — 实时物价（真实、免费、可跨域的第三方数据源）
 *
 * 数据源：caiweilv/DeltaForcePrice（GitHub 公开仓库）
 *   - 数据来自《三角洲行动》游戏内交易行【真实成交价】，每 10 分钟推送一次
 *   - 通过 raw.githubusercontent.com 提供 JSON，该域名默认返回
 *     Access-Control-Allow-Origin: *，浏览器可直接跨域 fetch（无需后端）
 *   - 字段：{ id, is_get_time, name, price, secondClassCN }
 *
 * 设计原则（对应需求：真实数据、免费 API、不要假数据）：
 *  - 不伪造任何价格；取不到就显示「加载中 / 暂不可用」，绝不编造数字。
 *  - 本地缓存 5 分钟（localStorage），避免每次刷新都打外部请求；过期或首屏再拉。
 *  - 页面打开期间每 5 分钟自动刷新一次，保证"实时"。
 *  - 端点可在 data.json.livePrice.url 配置（默认即上方真实源）。
 * ========================================================= */
(function () {
  "use strict";

  var DEFAULT_URL = "https://raw.githubusercontent.com/caiweilv/DeltaForcePrice/master/price.json";
  var CACHE_KEY = "df_liveprice_v1";
  var TTL = 5 * 60 * 1000; // 5 分钟

  var cache = null;       // { ts, items: [{name,price,cat}], map: {lowerName: price} }
  var listeners = [];

  function cfg() {
    var d = window.DF && window.DF.getData && window.DF.getData();
    return (d && d.livePrice) || { enabled: true, url: DEFAULT_URL };
  }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  function buildMap(items) {
    var map = {};
    items.forEach(function (it) { map[norm(it.name)] = it.price; });
    return map;
  }

  function load(force) {
    var c = cfg();
    if (c.enabled === false) { return Promise.resolve(null); }
    var url = c.url || DEFAULT_URL;
    // 尝试读缓存
    if (!force && cache) return Promise.resolve(cache);
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.ts && (Date.now() - p.ts < TTL) && p.items) {
          cache = p; return Promise.resolve(p);
        }
      }
    } catch (e) {}
    return fetch(url + (url.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (arr) {
        if (!Array.isArray(arr)) throw new Error("数据格式异常");
        var items = arr.map(function (it) {
          return { name: it.name, price: it.price, cat: it.secondClassCN };
        });
        cache = { ts: Date.now(), items: items, map: buildMap(items) };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        listeners.forEach(function (fn) { try { fn(cache); } catch (e) {} });
        return cache;
      })
      .catch(function (e) {
        // 取不到不要伪造；若有旧缓存就退回旧缓存
        if (cache) return cache;
        return { ts: 0, items: [], map: {}, error: e.message };
      });
  }

  function reg(D) {
    D.livePrice = {
      load: load,
      ready: function () { return cache; },
      // 按名查价（精确，小写归一化匹配）；查不到返回 null（不编）
      price: function (name) {
        if (!cache || !cache.map) return null;
        var v = cache.map[norm(name)];
        return (v == null) ? null : v;
      },
      // 全量（可按分类/关键词过滤）
      list: function (opt) {
        opt = opt || {};
        var arr = (cache && cache.items) || [];
        if (opt.cat) arr = arr.filter(function (x) { return x.cat === opt.cat; });
        if (opt.q) {
          var q = norm(opt.q);
          arr = arr.filter(function (x) { return norm(x.name).indexOf(q) > -1; });
        }
        return arr;
      },
      meta: function () { return cache ? { ts: cache.ts, count: (cache.items || []).length, error: cache.error } : null; },
      onChange: function (fn) { listeners.push(fn); }
    };
    // 页面打开期间每 5 分钟自动刷新
    setInterval(function () { load(true); }, TTL);
    // 首屏拉取（不阻塞渲染）
    load(false);

    /* ---------- 实时物价视图 ---------- */
    D.VIEWS.prices = {
      html: function () {
        var c = cfg();
        if (c.enabled === false) {
          return '<div class="section-title">实时物价（交易行真实成交价）</div>' +
            '<div class="card"><p class="an-note">实时物价已在后台「浏览统计 / 实时物价」中关闭。开启后即可查看游戏内交易行真实价格。</p></div>';
        }
        return '<div class="section-title">实时物价 <span class="kk-api" id="lpBadge">实时</span></div>' +
          '<p class="guide-intro">数据来自《三角洲行动》游戏内交易行真实成交价（caiweilv/DeltaForcePrice，每 10 分钟更新）。本页直接调用该免费公开接口，<strong>价格为真实数据，非本站编造</strong>。</p>' +
          '<div class="lp-bar">' +
            '<input type="text" id="lpSearch" placeholder="搜索物品名，如：沙漠之鹰 / M4A1 / 3级防弹衣">' +
            '<select id="lpCat"><option value="">全部分类</option></select>' +
            '<span class="lp-meta" id="lpMeta">加载中…</span>' +
          '</div>' +
          '<div class="lp-table" id="lpTable"><div class="kk-empty">正在拉取实时物价…</div></div>';
      },
      init: function () {
        var catSel = document.getElementById("lpCat");
        var search = document.getElementById("lpSearch");
        var table = document.getElementById("lpTable");
        var meta = document.getElementById("lpMeta");
        if (!catSel) return;

        function cats() {
          var s = {}; D.livePrice.list().forEach(function (x) { if (x.cat) s[x.cat] = 1; });
          return Object.keys(s);
        }
        function render() {
          var arr = D.livePrice.list({ q: search.value, cat: catSel.value });
          if (!arr.length) { table.innerHTML = '<div class="kk-empty">无匹配物品</div>'; return; }
          // 价格从高到低（热门高价靠前）
          arr = arr.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
          if (arr.length > 300) arr = arr.slice(0, 300);
          table.innerHTML = arr.map(function (x) {
            return '<div class="lp-row"><span class="lp-name">' + esc(x.name) + '</span>' +
              '<span class="lp-cat">' + esc(x.cat || "") + '</span>' +
              '<span class="lp-price">' + fmt(x.price) + '</span></div>';
          }).join("");
        }
        function refreshMeta() {
          var m = D.livePrice.meta();
          if (!m) { meta.textContent = "加载中…"; return; }
          if (m.error) { meta.textContent = "实时源暂不可用（" + m.error + "）"; return; }
          var t = m.ts ? new Date(m.ts) : null;
          meta.textContent = "共 " + m.count + " 项 · 更新于 " + (t ? t.toLocaleTimeString("zh-CN") : "—");
        }

        // 分类下拉
        catSel.innerHTML = '<option value="">全部分类</option>' +
          cats().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
        catSel.onchange = render;
        search.oninput = render;
        D.livePrice.onChange(function () {
          // 重新填分类 + 重渲染
          var cur = catSel.value;
          catSel.innerHTML = '<option value="">全部分类</option>' +
            cats().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
          catSel.value = cur;
          render(); refreshMeta();
        });
        // 若已缓存直接渲染，否则等 load 完成
        if (D.livePrice.ready() && D.livePrice.ready().items.length) { render(); refreshMeta(); }
        else { load(true).then(function () { render(); refreshMeta(); }); }
      }
    };

    D.MENU.push({ group: "资料库", items: [{ route: "prices", label: "实时物价", ico: "💹" }] });
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
