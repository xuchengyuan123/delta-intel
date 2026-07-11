/* =========================================================
 * app.js — 站点前端：壳 + ?viewpage 路由 + 视图片段 + 用户/管理员鉴权
 * 数据全部来自运行时 fetch('data.json')（由 ingest.js / 管理员后台 生成）。
 * 鉴权走同源接口 /api/*，Cookie 由后端 HttpOnly 下发，前端只管调。
 * ========================================================= */
(function () {
  "use strict";

  var preview = document.getElementById("LAY_preview");
  var menuEl = document.getElementById("menu");
  var html = document.documentElement;
  var DATA = null; // 站点数据（data.json / /api/data）

  // 全局错误兜底：万一某段脚本出错，避免“全白”无提示
  window.addEventListener("error", function (e) {
    var el = document.getElementById("LAY_preview");
    if (el && el.children.length === 0) {
      el.innerHTML = '<div class="card"><p style="color:#ff6b6b">页面脚本出错了：' +
        esc(e.message || "未知错误") + '。请按 Ctrl+F5（或 Ctrl+Shift+R）强制刷新重试。</p></div>';
    }
  });

  // 统一取数：本站在 GitHub Pages 纯静态托管，直接读同源 data.json（相对路径，自动适配子目录 /delta-intel/）。
  // 不再探测 /api/data（那是 Cloudflare Worker 场景才需要的，纯静态下只会 404 浪费一次请求）。
  function fetchData() {
    return fetch("data.json?_=" + Date.now())
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  /* ---------- 菜单配置 ---------- */
  var DEFAULT = "home";
  var MENU = [
    {
      group: "总览", items: [
        { route: "home",   label: "首页一图流", ico: "🏠" },
        { route: "maps",   label: "每日地图密码", ico: "🗺" },
      ],
    },
    {
      group: "数据", items: [
        { route: "items",  label: "特勤处产物推荐", ico: "🛠" },
        { route: "bullets",label: "热门子弹利润", ico: "🔫" },
        { route: "events", label: "活动物品需求", ico: "🎁" },
        { route: "materials", label: "高价格浮动材料", ico: "📈" },
      ],
    },
    {
      group: "可视化", items: [
        { route: "craft",  label: "制作树 / 科技树", ico: "🌳" },
      ],
    },
    {
      group: "外部", items: [
        { route: "links",  label: "原站权威数据", ico: "🔗" },
      ],
    },
    {
      group: "社区", items: [
        { href: "forum.html", label: "战友论坛", ico: "💬" },
        { href: "sponsor.html", label: "赞助我们", ico: "💝" },
      ],
    },
  ];

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function getRoute() {
    var p = new URLSearchParams(location.search).get("viewpage");
    if (!p && location.hash.indexOf("viewpage=") > -1) {
      p = new URLSearchParams(location.hash.replace(/^#/, "")).get("viewpage");
    }
    return p || DEFAULT;
  }

  /* ---------- 菜单渲染 ---------- */
  function renderMenu(active) {
    var str = "";
    MENU.forEach(function (g) {
      str += '<div class="menu-group">' + esc(g.group) + "</div>";
      g.items.forEach(function (it) {
        if (it.href) {
          str += '<a class="menu-item" href="' + esc(it.href) + '">' +
                 '<span class="ico">' + it.ico + "</span><span>" + esc(it.label) + "</span></a>";
        } else {
          var cls = "menu-item" + (it.route === active ? " active" : "");
          str += '<div class="' + cls + '" data-route="' + esc(it.route) + '">' +
                 '<span class="ico">' + it.ico + "</span><span>" + esc(it.label) + "</span></div>";
        }
      });
    });
    menuEl.innerHTML = str;
    menuEl.querySelectorAll(".menu-item[data-route]").forEach(function (el) {
      el.addEventListener("click", function () { navigate(el.getAttribute("data-route")); });
    });
  }

  /* ---------- 路由 ---------- */
  function navigate(route) {
    try {
      history.pushState({ route: route }, "", location.pathname + "?viewpage=" + encodeURIComponent(route));
    } catch (e) {
      location.hash = "viewpage=" + encodeURIComponent(route);
    }
    render(route);
  }
  window.addEventListener("popstate", function () { render(getRoute()); });
  window.addEventListener("hashchange", function () { render(getRoute()); });

  function render(route) {
    renderMenu(route);
    var fn = VIEWS[route] || VIEWS[DEFAULT];
    preview.innerHTML = fn.html();
    if (fn.init) fn.init();
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("backdrop").classList.remove("show");
    window.scrollTo(0, 0);
  }

  /* ---------- 复用片段 ---------- */
  function gradeClass(g) { return "r-" + (g || "common"); }

  function topItemsTable() {
    var rows = (DATA.items || []).map(function (i) {
      return "<tr>" +
        '<td><span class="pill">' + esc(i.station) + "</span></td>" +
        '<td class="' + gradeClass(i.grade) + '">' + esc(i.name) + "</td>" +
        '<td class="profit-up">' + fmt(i.profit) + "</td>" +
        "<td>" + fmt(i.price) + "</td>" +
        '<td class="r-common">' + esc(i.sell) + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>工作台</th><th>产物</th><th>当前利润</th><th>理想售价</th><th>建议卖</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function topBulletsTable(n) {
    var list = (DATA.bullets || []).slice(0, n);
    var max = list.length ? list[0].profit : 1;
    var rows = list.map(function (b, idx) {
      var pct = Math.max(4, Math.round((b.profit / max) * 100));
      return "<tr>" +
        '<td style="width:36px" class="r-common">' + (idx + 1) + "</td>" +
        "<td>" + esc(b.name) + "</td>" +
        '<td class="profit-up" style="text-align:right">' + fmt(b.profit) + "</td>" +
        '<td style="width:160px"><div style="height:8px;background:var(--bg-soft);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + "%;background:var(--accent)\"></div></div></td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>#</th><th>子弹</th><th style=\"text-align:right\">利润</th><th></th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function topEventsTable() {
    var ev = DATA.eventItems || {};
    var rows = (ev.items || []).map(function (it) {
      return "<tr><td>" + esc(it.name) + "</td>" +
        '<td style="text-align:right">' + fmt(it.cur) + "</td>" +
        '<td style="text-align:right">' + fmt(it.ideal) + "</td>" +
        "<td>" + (it.cur > it.ideal ? "高于理想价" : "低于理想价") + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>物品</th><th style='text-align:right'>当前售价</th><th style='text-align:right'>理想售价</th><th>提示</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function topMaterialsTable() {
    var rows = (DATA.materials || []).map(function (m) {
      return "<tr><td>" + esc(m.name) + "</td>" +
        '<td style="text-align:right">' + fmt(m.cur) + "</td>" +
        '<td style="text-align:right">' + fmt(m.min) + "</td>" +
        '<td style="text-align:right">' + fmt(m.max) + "</td>" +
        "<td>" + esc(m.buy) + "</td>" +
        "<td>" + esc(m.sell) + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>材料</th><th style='text-align:right'>当前</th><th style='text-align:right'>最低</th><th style='text-align:right'>最高</th><th>建议买</th><th>建议卖</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  /* ---------- 视图 ---------- */
  var VIEWS = {
    home: {
      html: function () {
        var maps = (DATA.maps || []).map(function (m) {
          return '<div class="card map-card">' +
            '<div class="map-name">' + esc(m.name) + "</div>" +
            '<div class="code">' + esc(m.code) + "</div>" +
            '<div class="date">' + esc(m.date) + "</div></div>";
        }).join("");
        var total = (DATA.items || []).reduce(function (s, i) { return s + (i.profit || 0); }, 0);
        return (
          '<div class="hero"><h1>三角洲情报台 · 每日战区情报</h1>' +
          "<p>地图密码 / 特勤处产物 / 子弹利润，一屏看全。数据每日自动更新。</p></div>" +
          '<div class="grid grid-3" style="margin-top:16px">' +
            '<div class="card stat"><div class="num">' + (DATA.maps || []).length + '</div><div class="label">今日地图</div></div>' +
            '<div class="card stat"><div class="num">' + (DATA.items || []).length + '</div><div class="label">推荐产物</div></div>' +
            '<div class="card stat"><div class="num">' + fmt(total) + '</div><div class="label">合计时利润</div></div>' +
          "</div>" +
          '<div class="section-title">每日地图密码</div><div class="grid grid-auto">' + maps + "</div>" +
          '<div class="section-title">特勤处制作产物推荐（Top）</div>' + topItemsTable() +
          '<div class="section-title">热门子弹利润</div>' + topBulletsTable(6) +
          '<div class="section-title">活动物品需求</div>' + topEventsTable() +
          '<div class="section-title">高价格浮动制造材料</div>' + topMaterialsTable()
        );
      },
    },
    maps: {
      html: function () {
        var rows = (DATA.maps || []).map(function (m) {
          return "<tr><td>" + esc(m.name) + "</td>" +
            '<td class="code" style="font-family:Consolas,monospace;letter-spacing:2px;color:var(--accent-2);font-weight:700">' + esc(m.code) + "</td>" +
            '<td class="r-common">' + esc(m.date) + "</td></tr>";
        }).join("");
        return '<div class="section-title">每日地图密码</div>' +
          '<div class="card"><table class="tbl"><thead><tr><th>地图</th><th>密码</th><th>更新</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      },
    },
    items: {
      html: function () {
        return '<div class="section-title">特勤处制作产物推荐</div>' + topItemsTable() +
          '<div class="section-title">利润对比图</div>' +
          '<div class="card"><div class="chart-box"><canvas id="profitChart"></canvas></div></div>';
      },
      init: function () {
        var ctx = document.getElementById("profitChart");
        if (!ctx || !window.Chart) return;
        var items = DATA.items || [];
        new window.Chart(ctx, {
          type: "bar",
          data: { labels: items.map(function (i) { return i.name; }),
            datasets: [{ label: "当前利润", data: items.map(function (i) { return i.profit; }), backgroundColor: "#ffb300" }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } },
                      y: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } } } },
        });
      },
    },
    bullets: {
      html: function () {
        return '<div class="section-title">兑换子弹利润</div>' + topBulletsTable((DATA.bullets || []).length);
      },
    },
    craft: {
      html: function () {
        return '<div class="section-title">制作树 / 科技树</div>' +
          '<div class="legend">' +
            '<span class="item"><span class="swatch" style="background:#ffb300"></span>最终产物</span>' +
            '<span class="item"><span class="swatch" style="background:#3a7bd5"></span>材料 / 中间体</span>' +
            '<span class="item"><span class="swatch" style="background:#2ecc71"></span>原材料</span>' +
          "</div>" +
          '<div class="card"><div id="craftDiagram" class="craft-diagram"></div></div>' +
          '<p class="craft-hint">拖拽节点调整布局，滚轮缩放；箭头指向“所需材料”。数据为示例，接入真实数据源后自动更新。</p>';
      },
      init: function () {
        var div = document.getElementById("craftDiagram");
        if (!div) return;
        if (!window.go) { div.innerHTML = '<p style="padding:20px;color:var(--muted)">GoJS 未加载（可能无网络）。</p>'; return; }
        var $ = go.GraphObject.make;
        var diagram = $(go.Diagram, "craftDiagram", {
          "undoManager.isEnabled": true, background: "transparent",
          initialAutoScale: go.AutoScale.Uniform, padding: 24,
          layout: $(go.LayeredDigraphLayout, { direction: 0, layerSpacing: 45, columnSpacing: 18 }),
        });
        var c = DATA.craft || { nodes: [], links: [] };
        function colorOf(d) {
          if (d.cat === "product") return "#ffb300";
          var raw = !c.links.some(function (l) { return l.from === d.key; });
          return raw ? "#2ecc71" : "#3a7bd5";
        }
        diagram.nodeTemplate = $(go.Node, "Auto", { cursor: "pointer" },
          $(go.Shape, "RoundedRectangle", { strokeWidth: 0 },
            new go.Binding("fill", "", colorOf)),
          $(go.TextBlock, { margin: 8, font: "13px 'Microsoft YaHei', sans-serif", stroke: "#fff" },
            new go.Binding("text", "text")));
        diagram.linkTemplate = $(go.Link, { routing: go.Routing.AvoidsNodes, corner: 6, curve: go.Curve.JumpOver },
          $(go.Shape, { stroke: "#6b7280", strokeWidth: 2 }));
        diagram.model = $(go.GraphLinksModel, {
          nodeKeyProperty: "key", linkKeyProperty: "key",
          nodes: c.nodes || [], links: c.links || [],
        });
      },
    },
    events: {
      html: function () {
        var ev = DATA.eventItems || {};
        return '<div class="section-title">' + esc(ev.title || "活动物品需求") + "</div>" +
          (ev.period ? '<p class="period">活动时间：' + esc(ev.period) + "</p>" : "") +
          topEventsTable();
      },
    },
    materials: {
      html: function () {
        return '<div class="section-title">高价格浮动制造材料</div>' + topMaterialsTable();
      },
    },
    links: {
      html: function () {
        return '<div class="section-title">原站权威数据库（跳转查看）</div>' +
          '<p class="sub">以下为 kkrb.net《三角洲行动一图流》的权威数据入口，点击前往查看完整图鉴与攻略。</p>' +
          '<div class="grid links-grid">' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">🪖</span><span>干员图鉴</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">🔫</span><span>武器数据库</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">🛠️</span><span>改枪方案</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">🗺️</span><span>地图攻略</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">📚</span><span>游戏百科</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/?viewpage=view%2Foverview" target="_blank" rel="noopener"><span class="ic">📊</span><span>一图流首页</span><span class="ext">kkrb.net</span></a>' +
          "</div>";
      },
    },
  };

  /* ---------- 主题切换 ---------- */
  function applyTheme(t) { html.classList.toggle("dark", t === "dark"); try { localStorage.setItem("df-theme", t); } catch (e) {} }
  document.getElementById("themeToggle").addEventListener("click", function () {
    applyTheme(html.classList.contains("dark") ? "light" : "dark");
  });
  (function () {
    var saved; try { saved = localStorage.getItem("df-theme"); } catch (e) {}
    applyTheme(saved || "dark");
  })();

  /* ---------- 移动端抽屉 ---------- */
  document.getElementById("menuToggle").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("backdrop").classList.toggle("show");
  });
  document.getElementById("backdrop").addEventListener("click", function () {
    document.getElementById("sidebar").classList.remove("open");
    this.classList.remove("show");
  });

  /* ---------- 启动：先拉数据，再渲染 ---------- */
  fetchData()
    .then(function (d) {
      DATA = d;
      var ua = document.getElementById("updatedAt");
      if (ua && d.updatedAt) {
        var t = new Date(d.updatedAt);
        ua.textContent = "最后更新：" + t.toLocaleString("zh-CN");
      }
      render(getRoute());
    })
    .catch(function (e) {
      preview.innerHTML = '<div class="card"><p>加载数据失败：' + esc(e.message) +
        "。</p><p>请通过服务器访问（<code>node server.js</code> / <code>wrangler dev</code> / 部署到托管），不要直接双击本地文件。</p></div>";
    });
})();
