/* =========================================================
 * gallery.js — 收藏馆 · 大红图鉴 + 海报（完整版）
 * 数据：data.json.collectibles
 *   - 大红/收集品：{ name, type, value, tip }  → 主图鉴，可标记拥有
 *   - 子弹自选包：{ name, contains[], cost, price, profit } → 只读分区
 * 功能：搜索 / 排序 / 分类筛选 / 已拥有筛选 / 稀有度配色 / 收藏总估值 /
 *       完成度进度 / 一键生成分享海报（canvas 下载）。
 * 拥有状态仅存本地 localStorage，不联网、不上传。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}
  function wan(n){var v=Number(n||0); if(v>=10000) return (v/10000).toFixed(v>=1000000?0:1)+'万'; return fmt(v);}
  var LS = "df_gallery_owned";

  function load() { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  // 稀有度档位（按哈夫币估值，贴近游戏"大红"分级）
  var TIERS = [
    { key: "t1", name: "传说·大红", min: 5000000,  color: "#ff4d4f" },
    { key: "t2", name: "史诗",       min: 1000000,  color: "#b37feb" },
    { key: "t3", name: "稀有",       min: 200000,   color: "#40a9ff" },
    { key: "t4", name: "精良",       min: 50000,    color: "#52c41a" },
    { key: "t5", name: "普通",       min: 0,        color: "#8c8c8c" }
  ];
  function tierOf(v){ v=Number(v||0); for(var i=0;i<TIERS.length;i++){ if(v>=TIERS[i].min) return TIERS[i]; } return TIERS[TIERS.length-1]; }

  function reg(D) {
    D.VIEWS.gallery = {
      html: function () {
        return '<div class="section-title">收藏馆 · 大红图鉴</div>' +
          '<p class="guide-intro">收录全游戏高价值收集品，点击卡片标记是否拥有（仅本地记录）。可按名称搜索、按价值排序、按稀有度/分类筛选，并生成分享海报。</p>' +
          '<div class="gl-stats" id="glStats"></div>' +
          '<div class="gl-toolbar">' +
            '<input class="gl-search" id="glSearch" placeholder="搜索名称，如：海洋之泪 / 非洲之心">' +
            '<select class="gl-sel" id="glSort">' +
              '<option value="valdesc">价值从高到低</option>' +
              '<option value="valasc">价值从低到高</option>' +
              '<option value="name">按名称</option>' +
            '</select>' +
            '<select class="gl-sel" id="glFilter">' +
              '<option value="all">全部</option>' +
              '<option value="owned">已拥有</option>' +
              '<option value="not">未拥有</option>' +
            '</select>' +
            '<select class="gl-sel" id="glType"><option value="">全部分类</option></select>' +
            '<button class="btn-ghost" id="glPoster">生成海报</button>' +
            '<button class="btn-ghost" id="glReset">重置拥有</button>' +
          '</div>' +
          '<div class="gl-legend" id="glLegend"></div>' +
          '<div class="gl-prog"><div class="gl-prog-fill" id="glFill"></div></div>' +
          '<div class="gl-grid" id="glGrid"><div class="kk-empty">加载中…</div></div>' +
          '<div class="gl-packs" id="glPacks"></div>' +
          '<canvas id="glCanvas" width="720" height="1080" style="display:none"></canvas>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var all = (DATA.collectibles || []).slice();
        if (!all.length) { document.getElementById("glGrid").innerHTML = '<div class="kk-empty">暂无收集品数据</div>'; return; }

        // 拆分为「大红（有 value）」与「子弹自选包（有 contains）」
        var reds = all.filter(function (c) { return c && typeof c.value === "number"; });
        var packs = all.filter(function (c) { return c && Array.isArray(c.contains); });

        var search = document.getElementById("glSearch");
        var sortSel = document.getElementById("glSort");
        var filterSel = document.getElementById("glFilter");
        var typeSel = document.getElementById("glType");
        var grid = document.getElementById("glGrid");

        // 分类下拉（动态）
        var types = {}; reds.forEach(function (c) { if (c.type) types[c.type] = 1; });
        typeSel.innerHTML = '<option value="">全部分类</option>' +
          Object.keys(types).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");

        // 稀有度图例
        document.getElementById("glLegend").innerHTML = TIERS.map(function (t) {
          return '<span class="gl-tier"><i style="background:' + t.color + '"></i>' + t.name + '</span>';
        }).join("");

        function ownedArr() { return load(); }
        function inOwned(n) { return ownedArr().indexOf(n) >= 0; }

        function render() {
          var owned = ownedArr();
          var q = norm(search.value);
          var arr = reds.filter(function (c) {
            if (typeSel.value && c.type !== typeSel.value) return false;
            if (filterSel.value === "owned" && !inOwned(c.name)) return false;
            if (filterSel.value === "not" && inOwned(c.name)) return false;
            if (q && norm(c.name).indexOf(q) < 0) return false;
            return true;
          });
          if (sortSel.value === "valdesc") arr.sort(function (a, b) { return b.value - a.value; });
          else if (sortSel.value === "valasc") arr.sort(function (a, b) { return a.value - b.value; });
          else arr.sort(function (a, b) { return norm(a.name) < norm(b.name) ? -1 : 1; });

          if (!arr.length) { grid.innerHTML = '<div class="kk-empty">无匹配收集品</div>'; }
          else {
            grid.innerHTML = arr.map(function (c) {
              var has = inOwned(c.name);
              var t = tierOf(c.value);
              return '<div class="gl-card gl-' + t.key + (has ? ' gl-has' : '') + '" data-name="' + esc(c.name) + '">' +
                '<span class="gl-ribbon" style="background:' + t.color + '"></span>' +
                '<div class="gl-top">' + (has ? '✅' : '⬜') + '</div>' +
                '<div class="gl-name">' + esc(c.name) + '</div>' +
                '<div class="gl-val">估值 ' + fmt(c.value) + ' <span class="gl-wan">(' + wan(c.value) + ')</span></div>' +
                (c.tip ? '<div class="gl-tip">' + esc(c.tip) + '</div>' : '') +
              '</div>';
            }).join("");
          }

          // 绑定点击
          Array.prototype.forEach.call(grid.querySelectorAll(".gl-card"), function (card) {
            card.addEventListener("click", function () {
              var n = card.getAttribute("data-name");
              var o = ownedArr();
              if (o.indexOf(n) >= 0) o = o.filter(function (x) { return x !== n; });
              else o.push(n);
              save(o); render(); refreshStats();
            });
          });

          refreshStats();
        }

        function refreshStats() {
          var owned = ownedArr();
          var haveReds = reds.filter(function (c) { return inOwned(c.name); });
          var totalVal = haveReds.reduce(function (s, c) { return s + (c.value || 0); }, 0);
          var pct = reds.length ? Math.round(haveReds.length / reds.length * 100) : 0;
          document.getElementById("glStats").innerHTML =
            stat(reds.length, "大红总数") +
            stat(haveReds.length, "已收集") +
            stat(wan(totalVal) + " 哈夫币", "收藏估值") +
            stat(pct + "%", "完成度");
          document.getElementById("glFill").style.width = pct + "%";
        }
        function stat(v, l) { return '<div class="gl-stat"><div class="gl-stat-v">' + esc(v) + '</div><div class="gl-stat-l">' + l + '</div></div>'; }

        function norm(s){return String(s==null?'':s).trim().toLowerCase();}

        // 子弹自选包只读分区
        if (packs.length) {
          document.getElementById("glPacks").innerHTML =
            '<div class="gl-packs-title">子弹自选包（参考利润）</div>' +
            '<div class="gl-pack-grid">' + packs.map(function (p) {
              return '<div class="gl-pack">' +
                '<div class="gl-pack-name">' + esc(p.name) + '</div>' +
                '<div class="gl-pack-row">成本 ' + fmt(p.cost) + '</div>' +
                '<div class="gl-pack-row">售价 ' + fmt(p.price) + '</div>' +
                '<div class="gl-pack-row gl-pack-profit">利润 ' + fmt(p.profit) + '</div>' +
              '</div>';
            }).join("") + '</div>';
        }

        search.oninput = render;
        sortSel.onchange = render;
        filterSel.onchange = render;
        typeSel.onchange = render;

        document.getElementById("glReset").addEventListener("click", function () {
          if (confirm("确定清空已拥有的标记？")) { save([]); render(); }
        });
        document.getElementById("glPoster").addEventListener("click", function () { genPoster(reds, ownedArr()); });

        render();
        refreshStats();
      }
    };

    function genPoster(reds, owned) {
      var cv = document.getElementById("glCanvas");
      if (!cv || !cv.getContext) { alert("当前浏览器不支持海报生成"); return; }
      var ctx = cv.getContext("2d");
      var g = ctx.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, "#0f1115"); g.addColorStop(1, "#1a1f2b");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 1080);
      ctx.fillStyle = "#ffb300"; ctx.font = "bold 52px sans-serif";
      ctx.fillText("三角洲收藏馆", 40, 90);
      var total = owned.reduce(function (s, n) {
        var c = reds.filter(function (x) { return x.name === n; })[0];
        return s + (c ? (c.value || 0) : 0);
      }, 0);
      var pct = reds.length ? Math.round(owned.length / reds.length * 100) : 0;
      ctx.fillStyle = "#19c3a6"; ctx.font = "30px sans-serif";
      ctx.fillText("已收集 " + owned.length + " / " + reds.length + " 件 · 完成度 " + pct + "%", 40, 150);
      ctx.fillText("收藏估值 " + wan(total) + " 哈夫币", 40, 196);
      ctx.fillStyle = "#e5e7eb"; ctx.font = "26px sans-serif";
      ctx.fillText("—— 我已拥有的大红 ——", 40, 250);
      var y = 300, col = 0;
      if (!owned.length) { ctx.fillStyle = "#9ca3af"; ctx.fillText("（还没有标记任何收藏）", 40, 300); }
      owned.forEach(function (n) {
        var x = 40 + col * 360;
        ctx.fillText("✅ " + n, x, y);
        y += 44; if (y > 1020) { y = 300; col = 1; }
      });
      try {
        var url = cv.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url; a.download = "delta-gallery.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (e) { alert("海报生成失败：" + e.message); }
    }
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
