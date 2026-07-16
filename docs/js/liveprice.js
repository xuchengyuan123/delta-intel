/* =========================================================
 * liveprice.js — 实时物价（真实、免费、可跨域的第三方数据源）
 *
 * 数据源：caiweilv/DeltaForcePrice（GitHub 公开仓库）
 *   - 数据来自《三角洲行动》游戏内交易行【真实成交价】，每 10 分钟推送一次
 *   - 主源经本站 Worker 自定义域 https://api.delta.shopping/api/price 转发（服务端拉取+缓存，国内稳定可达）
 *   - 同时配置 jsDelivr / fastly / raw 等多个镜像做自动 fallback，任一可达即用，绝不编造数字
 *   - 字段：{ id, is_get_time, name, price, secondClassCN }
 *
 * 设计原则（对应需求：真实数据、免费 API、不要假数据）：
 *  - 不伪造任何价格；取不到就显示「加载中 / 暂不可用 + 重试」，绝不编造数字。
 *  - 本地缓存 5 分钟（localStorage），避免每次刷新都打外部请求；过期或首屏再拉。
 *  - 页面打开期间每 5 分钟自动刷新一次，保证"实时"。
 *  - 端点可在 data.json.livePrice.url 配置（默认即上方真实源）。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  // 主源：本站 Worker 自定义域转发（服务端拉取 + 缓存，国内稳定可达）
  var DEFAULT_URL = "https://api.delta.shopping/api/price";
  // 镜像 fallback：jsDelivr（国内优先）→ fastly → raw（中国大陆常被 GFW 间歇性封锁，作最后兜底）
  var MIRRORS = [
    "https://api.delta.shopping/api/price",
    "https://cdn.jsdelivr.net/gh/caiweilv/DeltaForcePrice@master/price.json",
    "https://fastly.jsdelivr.net/gh/caiweilv/DeltaForcePrice@master/price.json",
    "https://raw.githubusercontent.com/caiweilv/DeltaForcePrice/master/price.json"
  ];
  var CACHE_KEY = "df_liveprice_v1";
  var TTL = 5 * 60 * 1000; // 5 分钟

  var cache = null;       // { ts, items: [{name,price,cat}], map: {lowerName: price}, src }
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

  function tryFetch(url) {
    return fetch(url + (url.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (arr) {
        if (!Array.isArray(arr)) throw new Error("数据格式异常");
        return arr.map(function (it) {
          return { name: it.name, price: it.price, cat: it.secondClassCN };
        });
      });
  }

  function load(force) {
    var c = cfg();
    if (c.enabled === false) { return Promise.resolve(null); }
    // 内存缓存
    if (!force && cache && cache.items && cache.items.length) return Promise.resolve(cache);
    // 本地缓存（5 分钟内且非空则直接用，不过网）
    if (!force) {
      try {
        var raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          var p = JSON.parse(raw);
          if (p && p.ts && (Date.now() - p.ts < TTL) && p.items && p.items.length) {
            cache = p; return Promise.resolve(p);
          }
        }
      } catch (e) {}
    }
    // 构造镜像列表：配置 url 优先，再补其余镜像（去重）
    var urls = [];
    var u = c.url || DEFAULT_URL;
    if (urls.indexOf(u) < 0) urls.push(u);
    MIRRORS.forEach(function (m) { if (urls.indexOf(m) < 0) urls.push(m); });
    // 清掉旧的"失败缓存"，强制重新尝试
    if (cache && cache.error) cache = null;

    var idx = 0;
    function attempt() {
      if (idx >= urls.length) {
        // 所有镜像都失败：退回旧缓存（若有），否则记录错误（不编造）
        if (cache && cache.items && cache.items.length) return Promise.resolve(cache);
        cache = { ts: 0, items: [], map: {}, error: "实时源暂不可用（网络被拦截或接口失效）", src: "" };
        listeners.forEach(function (fn) { try { fn(cache); } catch (e) {} });
        return Promise.resolve(cache);
      }
      var url = urls[idx++];
      return tryFetch(url).then(function (items) {
        cache = { ts: Date.now(), items: items, map: buildMap(items), src: url };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        listeners.forEach(function (fn) { try { fn(cache); } catch (e) {} });
        return cache;
      }).catch(function () { return attempt(); }); // 试下一个镜像
    }
    return attempt();
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
      meta: function () { return cache ? { ts: cache.ts, count: (cache.items || []).length, error: cache.error, src: cache.src } : null; },
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
          '<p class="guide-intro">数据来自《三角洲行动》游戏内交易行真实成交价（caiweilv/DeltaForcePrice，每 10 分钟更新），<strong>经本站 Worker 代理（api.delta.shopping，国内稳定可达）</strong>转发，<strong>价格为真实数据，非本站编造</strong>；若代理偶发不可用，自动回退 jsDelivr 镜像。若仍空白，点右侧「重试」手动再拉一次。</p>' +
          '<div class="lp-bar">' +
            '<input type="text" id="lpSearch" placeholder="搜索物品名，如：沙漠之鹰 / M4A1 / 3级防弹衣">' +
            '<select id="lpCat"><option value="">全部分类</option></select>' +
            '<span class="lp-meta" id="lpMeta">加载中…</span>' +
            '<button class="btn-ghost" id="lpRetry" style="display:none">🔄 重试</button>' +
          '</div>' +
          '<div class="lp-table" id="lpTable"><div class="kk-empty">正在拉取实时物价…</div></div>';
      },
      init: function () {
        var catSel = document.getElementById("lpCat");
        var search = document.getElementById("lpSearch");
        var table = document.getElementById("lpTable");
        var meta = document.getElementById("lpMeta");
        var retry = document.getElementById("lpRetry");
        if (!catSel) return;

        function cats() {
          var s = {}; D.livePrice.list().forEach(function (x) { if (x.cat) s[x.cat] = 1; });
          return Object.keys(s);
        }
        function render() {
          var arr = D.livePrice.list({ q: search.value, cat: catSel.value });
          if (!arr.length) { table.innerHTML = '<div class="kk-empty">无匹配物品</div>'; return; }
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
          if (!m) { meta.textContent = "加载中…"; retry.style.display = "none"; return; }
          if (m.error) {
            meta.textContent = "⚠️ " + m.error;
            retry.style.display = "";
            return;
          }
          retry.style.display = "none";
          var t = m.ts ? new Date(m.ts) : null;
          var srcTag = m.src && m.src.indexOf("api.delta.shopping") > -1 ? "本站 Worker 代理" :
                       (m.src && m.src.indexOf("jsdelivr") > -1 ? "jsDelivr 镜像" : (m.src ? "源站" : ""));
          meta.textContent = "共 " + m.count + " 项 · 更新于 " + (t ? t.toLocaleTimeString("zh-CN") : "—") + (srcTag ? " · " + srcTag : "");
        }

        catSel.innerHTML = '<option value="">全部分类</option>' +
          cats().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
        catSel.onchange = render;
        search.oninput = render;
        if (retry) retry.onclick = function () { meta.textContent = "重新拉取中…"; load(true).then(function () { render(); refreshMeta(); }); };
        D.livePrice.onChange(function () {
          var cur = catSel.value;
          catSel.innerHTML = '<option value="">全部分类</option>' +
            cats().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
          catSel.value = cur;
          render(); refreshMeta();
        });
        if (D.livePrice.ready() && D.livePrice.ready().items.length) { render(); refreshMeta(); }
        else { load(true).then(function () { render(); refreshMeta(); }); }
      }
    };
  }

  if (window.DF) {
    reg(window.DF);
    try { window.dispatchEvent(new Event("df:liveprice")); } catch (e) {}
  } else {
    (window.__df_plugins = window.__df_plugins || []).push(reg);
  }
})();
