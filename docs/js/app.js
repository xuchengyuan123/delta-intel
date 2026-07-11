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

  /* ---------- 赞助弹窗与更新日志 ---------- */
  var CHANGELOG = [
    { date: "2026-07-11", title: "全站大更新 · 攻略/工具/小知识/安装", items: ["新增「新手攻略」与「三角洲小知识」分享（可点赞/复制/发布）", "新增实用工具：宝藏开箱、随机舔包、散落物资点", "图鉴新增特战干员图鉴与武器图鉴", "音乐台可内嵌B站播放完整歌曲", "小游戏补齐 5 款（摩斯/破译电脑/快速反应/脑机/指纹）", "支持 PWA 安装到桌面、深浅模式跟随系统、手机横竖屏自适应", "后台分级管理员（总/赛季任务/音乐/美术/模拟器/代码/干员图鉴/武器图鉴）", "后台仅电脑端可登录"] },
    { date: "2026-07-11", title: "小游戏/音乐台/弹窗上线", items: ["新增数字摩斯密码小游戏与指纹选择小游戏", "音乐台改为外链 QQ音乐/B站/网易云", "增加自动赞助弹窗与更新日志"] },
    { date: "2026-07-10", title: "首页美化 V3", items: ["重绘建筑线描卡片", "赛季任务支持搜索与手动维护"] },
    { date: "2026-07-09", title: "管理后台与自动更新", items: ["上线 admin.html 管理后台", "修复自动更新路径"] }
  ];

  function sponsorModalHtml() {
    return '<div id="sponsorModal" class="modal-backdrop">' +
      '<div class="modal-card">' +
        '<button class="modal-close" id="modalClose">×</button>' +
        '<div class="modal-icon">💝</div>' +
        '<h2>支持三角洲情报台</h2>' +
        '<p>制作不易，服务器、数据维护、功能更新都需要时间和精力。</p>' +
        '<p>如果你觉得这个网站好用，欢迎赞助，让情报台持续运转下去！</p>' +
        '<div class="modal-meta">' +
          '<div>制作人：三角洲情报台开发组</div>' +
          '<div>预计 <strong>11 月左右</strong> 会有重大升级，敬请期待。</div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<a class="btn-primary" href="sponsor.html">去爱发电赞助</a>' +
          '<button class="btn-ghost" id="modalLog">查看更新日志</button>' +
          '<button class="btn-ghost" id="modalLater">稍后再说</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function changelogHtml() {
    var list = (DATA && DATA.changelog && DATA.changelog.length) ? DATA.changelog : CHANGELOG;
    var rows = list.map(function (log) {
      return '<div class="log-item">' +
        '<div class="log-date">' + esc(log.date) + '</div>' +
        '<div class="log-title">' + esc(log.title) + '</div>' +
        '<ul>' + (log.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join("") + '</ul>' +
      '</div>';
    }).join("");
    return '<div class="section-title">📜 网站更新速览</div>' +
      '<div class="card changelog">' + rows + '</div>';
  }
  function showSponsorModal() {
    if (document.getElementById("sponsorModal")) return;
    var wrap = document.createElement("div"); wrap.innerHTML = sponsorModalHtml();
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById("modalClose").addEventListener("click", closeSponsorModal);
    document.getElementById("modalLater").addEventListener("click", closeSponsorModal);
    document.getElementById("modalLog").addEventListener("click", function () {
      closeSponsorModal();
      navigate("changelog");
    });
  }
  function closeSponsorModal() {
    var m = document.getElementById("sponsorModal"); if (m) m.remove();
    try { localStorage.setItem("df-sponsor-shown", "1"); } catch (e) {}
  }
  function maybeShowSponsorModal() {
    try { if (localStorage.getItem("df-sponsor-shown")) return; } catch (e) {}
    setTimeout(showSponsorModal, 1200);
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
      group: "资讯", items: [
        { route: "tasks", label: "赛季任务 / 挑战手册", ico: "📋" },
        { route: "changelog", label: "网站更新速览", ico: "📜" },
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

  // 地图抽象建筑线描插画（SVG，内联，无需外部图）
  function mapArt(name) {
    // 美术管理员可在 data.json.site.art 中覆盖每张地图的线描，实现“后台改图、前台即时生效”
    var artOverride = DATA && DATA.site && DATA.site.art && DATA.site.art[name];
    if (artOverride) return artOverride;
    var n = String(name || "");
    var color = "rgba(25,195,166,.45)";
    var stroke = 'stroke="' + color + '" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    var grid = 'stroke="rgba(25,195,166,.08)" stroke-width="1" fill="none"';
    var svg = '<svg viewBox="0 0 160 120" class="map-art">';

    // 背景淡网格（蓝图感）
    svg += '<g>';
    for (var gx = 0; gx <= 160; gx += 20) {
      svg += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="120" ' + grid + '/>';
    }
    for (var gy = 0; gy <= 120; gy += 20) {
      svg += '<line x1="0" y1="' + gy + '" x2="160" y2="' + gy + '" ' + grid + '/>';
    }
    svg += '</g>';

    if (n.indexOf("大坝") > -1) {
      // 零号大坝：弧形大坝 + 闸门 + 水面 + 远山
      svg += '<path ' + stroke + ' d="M10 85 Q50 55 90 70 T150 60" />';
      svg += '<path ' + stroke + ' d="M30 82 L30 60 L50 60 L50 78" />';
      svg += '<path ' + stroke + ' d="M70 74 L70 52 L90 52 L90 68" />';
      svg += '<path ' + stroke + ' d="M110 66 L110 48 L130 48 L130 62" />';
      svg += '<path ' + stroke + ' d="M5 95 Q40 92 80 95 T155 92" />';
      svg += '<path ' + stroke + ' d="M15 102 Q55 98 100 102 T150 98" />';
      svg += '<path ' + stroke + ' d="M0 40 L20 25 L50 32 L80 18 L110 28 L140 15 L160 30" />';
    } else if (n.indexOf("溪谷") > -1 || n.indexOf("长弓") > -1) {
      // 长弓溪谷：雷达天线 + 信号塔 + 起伏山丘
      svg += '<circle cx="110" cy="38" r="22" ' + stroke + '/>';
      svg += '<line x1="110" y1="16" x2="110" y2="8" ' + stroke + '/>';
      svg += '<line x1="88" y1="38" x2="80" y2="38" ' + stroke + '/>';
      svg += '<line x1="132" y1="38" x2="140" y2="38" ' + stroke + '/>';
      svg += '<line x1="40" y1="95" x2="40" y2="35" ' + stroke + '/>';
      svg += '<line x1="32" y1="45" x2="48" y2="45" ' + stroke + '/>';
      svg += '<line x1="32" y1="55" x2="48" y2="55" ' + stroke + '/>';
      svg += '<line x1="32" y1="65" x2="48" y2="65" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M5 100 Q40 75 80 90 T150 80" />';
      svg += '<path ' + stroke + ' d="M0 110 Q50 95 100 108 T160 100" />';
      svg += '<circle cx="40" cy="28" r="4" ' + stroke + '/>';
    } else if (n.indexOf("航天") > -1) {
      // 航天基地：发射塔 + 火箭 + 尾焰
      svg += '<line x1="80" y1="15" x2="80" y2="95" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M80 15 L72 38 L80 30 L88 38 Z" />';
      svg += '<line x1="55" y1="95" x2="55" y2="40" ' + stroke + '/>';
      svg += '<line x1="105" y1="95" x2="105" y2="40" ' + stroke + '/>';
      svg += '<line x1="55" y1="55" x2="105" y2="55" ' + stroke + '/>';
      svg += '<line x1="55" y1="70" x2="105" y2="70" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M70 95 L75 110 L85 110 L90 95" />';
      svg += '<path ' + stroke + ' d="M65 115 Q80 125 95 115" />';
      svg += '<path ' + stroke + ' d="M20 100 Q50 85 90 95 T150 88" />';
    } else if (n.indexOf("巴克") > -1) {
      // 巴克什：塔楼 + 拱门 + 建筑轮廓
      svg += '<rect x="35" y="55" width="22" height="50" rx="2" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M35 55 L46 35 L57 55" />';
      svg += '<line x1="42" y1="45" x2="42" y2="55" ' + stroke + '/>';
      svg += '<line x1="50" y1="45" x2="50" y2="55" ' + stroke + '/>';
      svg += '<rect x="67" y="70" width="30" height="35" rx="2" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M67 70 Q82 55 97 70" />';
      svg += '<rect x="105" y="45" width="28" height="60" rx="2" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M105 45 L119 25 L133 45" />';
      svg += '<line x1="119" y1="25" x2="119" y2="45" ' + stroke + '/>';
      svg += '<line x1="75" y1="78" x2="89" y2="78" ' + stroke + '/>';
      svg += '<line x1="75" y1="88" x2="89" y2="88" ' + stroke + '/>';
    } else if (n.indexOf("监狱") > -1 || n.indexOf("潮汐") > -1) {
      // 潮汐监狱：高墙 + 瞭望塔 + 铁丝网
      svg += '<rect x="25" y="50" width="110" height="55" rx="2" ' + stroke + '/>';
      svg += '<line x1="25" y1="65" x2="135" y2="65" ' + stroke + '/>';
      svg += '<line x1="25" y1="80" x2="135" y2="80" ' + stroke + '/>';
      svg += '<line x1="55" y1="50" x2="55" y2="105" ' + stroke + '/>';
      svg += '<line x1="105" y1="50" x2="105" y2="105" ' + stroke + '/>';
      svg += '<rect x="70" y="25" width="20" height="30" rx="2" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M70 25 L80 15 L90 25" />';
      svg += '<line x1="15" y1="55" x2="145" y2="55" ' + stroke + '/>';
      svg += '<line x1="15" y1="55" x2="15" y2="50" ' + stroke + '/>';
      svg += '<line x1="35" y1="55" x2="35" y2="50" ' + stroke + '/>';
      svg += '<line x1="55" y1="55" x2="55" y2="50" ' + stroke + '/>';
      svg += '<line x1="105" y1="55" x2="105" y2="50" ' + stroke + '/>';
      svg += '<line x1="125" y1="55" x2="125" y2="50" ' + stroke + '/>';
      svg += '<line x1="145" y1="55" x2="145" y2="50" ' + stroke + '/>';
    } else if (n.indexOf("AZ3") > -1 || n.indexOf("核") > -1) {
      // AZ3/核电：冷却塔 + 厂房 + 烟囱
      svg += '<path ' + stroke + ' d="M40 100 Q40 55 55 30 Q70 55 70 100" />';
      svg += '<ellipse cx="55" cy="30" rx="15" ry="4" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M95 100 Q95 65 110 40 Q125 65 125 100" />';
      svg += '<ellipse cx="110" cy="40" rx="15" ry="4" ' + stroke + '/>';
      svg += '<rect x="75" y="75" width="50" height="25" rx="2" ' + stroke + '/>';
      svg += '<line x1="85" y1="75" x2="85" y2="55" ' + stroke + '/>';
      svg += '<line x1="115" y1="75" x2="115" y2="55" ' + stroke + '/>';
      svg += '<path ' + stroke + ' d="M80 55 Q100 45 120 55" />';
      svg += '<path ' + stroke + ' d="M20 105 Q60 95 100 105 T150 100" />';
      svg += '<circle cx="130" cy="60" r="3" ' + stroke + '/>';
    } else {
      svg += '<circle cx="80" cy="60" r="35" ' + stroke + '/>';
      svg += '<line x1="80" y1="25" x2="80" y2="95" ' + stroke + '/>';
      svg += '<line x1="45" y1="60" x2="115" y2="60" ' + stroke + '/>';
      svg += '<rect x="60" y="45" width="40" height="30" rx="2" ' + stroke + '/>';
    }
    svg += "</svg>";
    return svg;
  }

  // 建筑线描可被外置 art.js 覆盖（window.DF_MAP_ART），以贴近原站花纹
  function DFmapArt(name) { return (window.DF_MAP_ART || mapArt)(name); }

  function gradeBgClass(g) {
    return g === "legend" ? "b-legend" : g === "epic" ? "b-epic" : g === "rare" ? "b-rare" : "b-common";
  }
  function itemIcon(name) {
    var n = String(name || "");
    if (n.indexOf("弹") > -1 || n.indexOf("Bullet") > -1) return "🔫";
    if (n.indexOf("医疗") > -1 || n.indexOf("药") > -1) return "💊";
    if (n.indexOf("背心") > -1 || n.indexOf("头盔") > -1 || n.indexOf("防具") > -1) return "🛡";
    if (n.indexOf("手电") > -1 || n.indexOf("光") > -1) return "🔦";
    if (n.indexOf("包") > -1) return "🎒";
    return "🛠";
  }

  function homeTaskStrip() {
    var tasks = DATA.tasks || {};
    var groups = tasks.groups || [];
    if (!groups.length) return "";
    var firstOpen = groups.find(function (g) { return g.open; }) || groups[0];
    var firstItem = (firstOpen.items || [])[0];
    var title = firstItem ? firstItem.title : (firstOpen.name || "赛季任务");
    return '<a class="kk-tasks" href="?viewpage=tasks">' +
      '<span class="kk-tasks-tag">赛季任务</span>' +
      '<span class="kk-tasks-title">' + esc(title) + '</span>' +
      '<span class="kk-tasks-more">查看全部 →</span></a>';
  }

  /* ---------- KK日报 式紧凑仪表盘板块 ---------- */
  function kkMapBlock() {
    var cards = (DATA.maps || []).map(function (m) {
      return '<div class="kk-map"><div class="kk-map-name">' + esc(m.name) + '</div>' +
        '<div class="kk-map-code">' + esc(m.code) + '</div>' +
        '<div class="kk-map-date">' + esc(m.date || "今日") + '</div></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">🗺 每日地图密码 <a class="kk-more" href="?viewpage=maps">更多</a></div>' +
      '<div class="kk-map-grid">' + cards + '</div></div>';
  }
  function kkItemsBlock() {
    var list = (DATA.items || []).slice(0, 6);
    if (!list.length) return '<div class="kk-card"><div class="kk-card-h">🛠 特勤处产物</div><div class="kk-empty">暂无数据</div></div>';
    var rows = list.map(function (i) {
      var hourly = Math.round(i.profit * 60 / (i.craftMin || 60));
      return '<div class="kk-li"><span class="kk-li-st">' + esc(i.station) + '</span>' +
        '<span class="kk-li-n ' + gradeClass(i.grade) + '">' + esc(i.name) + '</span>' +
        '<span class="kk-li-v profit-up">' + fmt(hourly) + '</span></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">🛠 特勤处产物（小时利润）</div>' + rows + '</div>';
  }
  function kkMaterialsBlock() {
    var rows = (DATA.materials || []).slice(0, 4).map(function (m) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(m.name) + '</span>' +
        '<span class="kk-li-v">' + fmt(m.cur) + '</span>' +
        '<span class="kk-li-t">买' + esc(m.buy || "-") + '/卖' + esc(m.sell || "-") + '</span></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">📈 高价格浮动材料</div>' + (rows || '<div class="kk-empty">暂无</div>') + '</div>';
  }
  function kkBulletsBlock() {
    var list = (DATA.bullets || []).slice(0, 10);
    var rows = list.map(function (b, i) {
      return '<div class="kk-li"><span class="kk-li-i">' + (i + 1) + '</span>' +
        '<span class="kk-li-n">' + esc(b.name) + '</span>' +
        '<span class="kk-li-v profit-up">' + fmt(b.profit) + '</span></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">🔫 热门子弹利润（前十）</div>' + (rows || '<div class="kk-empty">暂无</div>') + '</div>';
  }
  function kkEventsBlock() {
    var ev = DATA.eventItems || {};
    var rows = (ev.items || []).map(function (it) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(it.name) + '</span>' +
        '<span class="kk-li-v">' + fmt(it.cur) + '</span></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">🎁 活动物品需求</div>' + (rows || '<div class="kk-empty">暂无</div>') + '</div>';
  }
  function kkDoorBlock() {
    var rows = (DATA.doorCodes || []).slice(0, 6).map(function (d) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(d.map) + '·' + esc(d.location) + '</span>' +
        '<span class="kk-li-v code-strong">' + esc(d.code) + '</span></div>';
    }).join("");
    return '<div class="kk-card"><div class="kk-card-h">🔑 密码门速查</div>' + (rows || '<div class="kk-empty">暂无</div>') + '</div>';
  }

  /* ---------- 视图 ---------- */
  var VIEWS = {
    home: {
      html: function () {
        return '<div class="kk-hero"><div class="kk-hero-t"><h1>三角洲情报台</h1>' +
          '<p>每日密码 · 产物利润 · 材料价格 · 一屏看全</p></div>' +
          '<div class="kk-hero-u">每日更新 · ' + (DATA.updatedAt ? new Date(DATA.updatedAt).toLocaleString("zh-CN") : "加载中") + '</div></div>' +
          homeTaskStrip() +
          '<div class="kk-board">' +
            kkMapBlock() + kkItemsBlock() + kkMaterialsBlock() + kkBulletsBlock() + kkEventsBlock() + kkDoorBlock() +
          '</div>';
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
    tasks: {
      html: function () {
        var tasks = DATA.tasks || {};
        var groups = tasks.groups || [];
        if (!groups.length) {
          return '<div class="section-title">赛季任务 / 综合挑战手册</div>' +
            '<div class="card"><p style="color:var(--muted)">暂无任务数据。管理员可在后台 ' +
            '<a href="admin.html">admin.html</a> 维护赛季任务、挑战手册。</p></div>';
        }
        var searchHtml = '<div class="task-search">' +
          '<input type="text" id="taskSearch" placeholder="搜索任务…" value="' + esc(tasks.search || "") + '" />' +
        "</div>";
        var listHtml = groups.map(function (g) {
          var items = (g.items || []).filter(function (it) {
            var q = (tasks.search || "").toLowerCase();
            if (!q) return true;
            return (it.title + " " + it.content).toLowerCase().indexOf(q) > -1;
          });
          var itemsHtml = items.map(function (it) {
            return '<div class="task-item' + (it.done ? " done" : "") + '" data-id="' + esc(it.id) + '">' +
              '<div class="task-row">' +
                '<span class="task-cb">' + (it.done ? "✅" : "⭕") + '</span>' +
                '<span class="task-title">' + esc(it.title) + "</span>" +
                '<span class="task-toggle">' + (it.open ? "▾" : "▸") + "</span>" +
              "</div>" +
              (it.open ? '<div class="task-body">' + esc(it.content) + "</div>" : "") +
            "</div>";
          }).join("");
          return '<div class="task-group' + (g.open ? " open" : "") + '" data-id="' + esc(g.id) + '">' +
            '<div class="task-group-head">' +
              '<span class="task-group-name">' + esc(g.name) + "</span>" +
              '<span class="task-group-count">' + items.length + "</span>" +
              '<span class="task-group-arrow">' + (g.open ? "▾" : "▸") + "</span>" +
            "</div>" +
            '<div class="task-group-body">' + itemsHtml + "</div>" +
          "</div>";
        }).join("");
        return '<div class="section-title">赛季任务 / 综合挑战手册</div>' + searchHtml +
          '<div class="task-list">' + listHtml + "</div>";
      },
      init: function () {
        var searchInput = document.getElementById("taskSearch");
        if (!searchInput) return;
        searchInput.addEventListener("input", function () {
          DATA.tasks.search = searchInput.value;
          render("tasks");
        });
        document.querySelectorAll(".task-group-head").forEach(function (h) {
          h.addEventListener("click", function () {
            var gid = h.parentElement.getAttribute("data-id");
            var g = DATA.tasks.groups.find(function (x) { return x.id === gid; });
            if (g) { g.open = !g.open; render("tasks"); }
          });
        });
        document.querySelectorAll(".task-row").forEach(function (r) {
          r.addEventListener("click", function (e) {
            if (e.target.classList.contains("task-cb")) return;
            var id = r.parentElement.getAttribute("data-id");
            var groups = DATA.tasks.groups || [];
            groups.forEach(function (g) {
              (g.items || []).forEach(function (it) { if (it.id === id) it.open = !it.open; });
            });
            render("tasks");
          });
        });
        document.querySelectorAll(".task-cb").forEach(function (cb) {
          cb.addEventListener("click", function (e) {
            e.stopPropagation();
            var id = cb.parentElement.parentElement.getAttribute("data-id");
            var groups = DATA.tasks.groups || [];
            groups.forEach(function (g) {
              (g.items || []).forEach(function (it) { if (it.id === id) it.done = !it.done; });
            });
            render("tasks");
          });
        });
      },
    },
    changelog: {
      html: function () { return changelogHtml(); },
    },
  };

  /* ---------- 主题切换（支持 自动跟随系统 / 浅色 / 深色） ---------- */
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function sysDark() { return mq ? mq.matches : true; }
  function getSavedTheme() { try { return localStorage.getItem("df-theme") || "auto"; } catch (e) { return "auto"; } }
  function applyTheme(t) {
    var eff = (t === "auto") ? (sysDark() ? "dark" : "light") : t;
    html.classList.toggle("dark", eff === "dark");
    try { localStorage.setItem("df-theme", t); } catch (e) {}
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = (t === "auto") ? "🖥️" : (eff === "dark" ? "🌙" : "☀️");
  }
  document.getElementById("themeToggle").addEventListener("click", function () {
    var cur = getSavedTheme();
    var next = (cur === "auto") ? "light" : (cur === "light" ? "dark" : "auto");
    applyTheme(next);
  });
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (getSavedTheme() === "auto") applyTheme("auto"); });
  applyTheme(getSavedTheme());

  /* ---------- 界面定制（总管理员后台设置，前台即时应用） ---------- */
  function applySiteUi(site) {
    var ui = (site && site.ui) || {};
    var root = document.documentElement;
    try {
      if (ui.accent) root.style.setProperty("--accent", ui.accent);
      if (ui.accent2) root.style.setProperty("--accent-2", ui.accent2);
      else if (site && site.accent2) root.style.setProperty("--accent-2", site.accent2);
      if (ui.radius) root.style.setProperty("--radius", ui.radius + "px");
      if (ui.density === "compact") root.classList.add("compact"); else root.classList.remove("compact");
      root.style.zoom = (ui.fontScale && ui.fontScale !== 1) ? ui.fontScale : "";
    } catch (e) {}
  }

  /* ---------- PWA：安装横幅 + Service Worker 注册 ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
  window.addEventListener("appinstalled", function () { hideInstallBanner(); });
  function showInstallBanner() {
    if (document.getElementById("dfInstallBanner")) return;
    var b = document.createElement("div");
    b.id = "dfInstallBanner";
    b.className = "install-banner";
    b.innerHTML = '<span class="ib-icon">📲</span>' +
      '<span class="ib-text">把「三角洲情报台」安装到桌面，随时查看最新情报</span>' +
      '<button class="ib-btn" id="ibInstall">安装</button>' +
      '<button class="ib-close" id="ibClose">×</button>';
    document.body.appendChild(b);
    document.getElementById("ibInstall").addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; hideInstallBanner(); });
    });
    document.getElementById("ibClose").addEventListener("click", hideInstallBanner);
  }
  function hideInstallBanner() { var b = document.getElementById("dfInstallBanner"); if (b) b.remove(); }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---------- 移动端抽屉 ---------- */
  document.getElementById("menuToggle").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("backdrop").classList.toggle("show");
  });
  document.getElementById("backdrop").addEventListener("click", function () {
    document.getElementById("sidebar").classList.remove("open");
    this.classList.remove("show");
  });

  /* ---------- 插件总线（供 js/art.js、simulators.js、games.js、music.js 等扩展）---------- */
  window.DF = {
    VIEWS: VIEWS, MENU: MENU,
    esc: esc, fmt: fmt,
    mapArt: DFmapArt,
    getData: function () { return DATA; },
    setData: function (d) { DATA = d; },
    navigate: navigate,
    render: render,
    addStyle: function (id, css) {
      if (document.getElementById(id)) return;
      var s = document.createElement("style"); s.id = id; s.textContent = css;
      document.head.appendChild(s);
    }
  };
  if (window.__df_ready) { try { window.__df_ready(window.DF); } catch (e) { console.error(e); } }
  if (window.__df_plugins) {
    window.__df_plugins.forEach(function (fn) { try { fn(window.DF); } catch (e) { console.error(e); } });
  }

  /* ---------- 启动：先拉数据，再渲染 ---------- */
  fetchData()
    .then(function (d) {
      DATA = d;
      // 应用界面定制（总管理员在后台设置的全局外观）
      try { applySiteUi(DATA.site); } catch (e) {}
      var ua = document.getElementById("updatedAt");
      if (ua && d.updatedAt) {
        var t = new Date(d.updatedAt);
        ua.textContent = "最后更新：" + t.toLocaleString("zh-CN");
      }
      render(getRoute());
      maybeShowSponsorModal();
    })
    .catch(function (e) {
      preview.innerHTML = '<div class="card"><p>加载数据失败：' + esc(e.message) +
        "。</p><p>请通过服务器访问（<code>node server.js</code> / <code>wrangler dev</code> / 部署到托管），不要直接双击本地文件。</p></div>";
    });
})();
