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
    { route: "home", label: "首页一图流" },
    { route: "checkin", label: "每日签到", ico: "🪙" },
    { route: "quiz", label: "DFTI测试" },
    {
      group: "常用入口", collapsed: false, items: [
        { href: "guns-calc.html", label: "武器改装计算器", ico: "🔧" },
        { href: "guns.html",      label: "改枪码大全",     ico: "🔫" },
        { href: "kzb.html",       label: "智能卡战备",     ico: "🎴" },
        { href: "news.html",      label: "资讯中心",       ico: "📰" },
        { href: "zhanji.html",    label: "战绩查询",       ico: "📊" },
        { href: "forum.html",     label: "战友论坛",       ico: "💬" },
      ],
    },
    {
      group: "S10 赛季", collapsed: true, items: [
        { route: "tasks",     label: "赛季任务 / 挑战手册", ico: "📋" },
        { route: "eventitems",label: "活动物品需求", ico: "🎁" },
        { route: "asala",     label: "阿萨拉牌盒收集", ico: "🃏" },
      ],
    },
    {
      group: "每日热点", collapsed: true, items: [
        { route: "maps",     label: "每日地图密码", ico: "🗺" },
        { route: "bullets",  label: "热门子弹利润", ico: "🔫" },
        { route: "materials",label: "高价格浮动材料", ico: "📈" },
        { route: "keycard",  label: "钥匙卡补卡预测", ico: "🗝" },
      ],
    },
    {
      group: "攻略教学", collapsed: true, items: [
        { route: "guides",   label: "新手速览", ico: "📖" },
        { route: "trivia",   label: "小知识", ico: "💡" },
        { route: "doorcodes",label: "密码门", ico: "🔑" },
        { route: "streamer", label: "主播设置", ico: "🎥" },
        { route: "optasks",  label: "干员任务", ico: "🎯" },
        { route: "melee",    label: "近战武器", ico: "🗡" },
        { route: "gunrank",  label: "改枪热度榜", ico: "🔥" },
        { route: "sens",     label: "灵敏度布局库", ico: "🎯" },
        { route: "gunrec",   label: "个性化改枪推荐", ico: "🤖" },
        { route: "tactic",   label: "战术预案生成", ico: "🧭" },
      ],
    },
    {
      group: "图鉴数据库", collapsed: true, items: [
        { route: "operators",   label: "干员图鉴", ico: "🦸" },
        { route: "weapons",     label: "武器图鉴", ico: "🔫" },
        { route: "armors",      label: "防具数据", ico: "🛡" },
        { route: "scopes",      label: "瞄具样式", ico: "🔭" },
        { route: "npc",         label: "NPC 血量护甲", ico: "👾" },
        { route: "upgrades",    label: "特勤处升级花销", ico: "⬆️" },
        { route: "expansion",   label: "扩容箱兑换", ico: "📦" },
        { route: "keyrooms",    label: "钥匙房", ico: "🗝" },
        { route: "collectibles",label: "收集品价值", ico: "💎" },
        { route: "bulletpacks", label: "子弹自选包利润", ico: "📊" },
        { route: "weaponcmp", label: "武器对比", ico: "⚔" },
        { route: "gallery",   label: "收藏馆 / 海报", ico: "🖼" },
        { href:  "tujian.html",  label: "图鉴大全", ico: "🗂" },
      ],
    },
    {
      group: "交易制作", collapsed: true, items: [
        { route: "prices", label: "实时物价", ico: "💹" },
        { route: "items",  label: "特勤处产物推荐", ico: "🛠" },
        { route: "craft",  label: "制作树 / 科技树", ico: "🌳" },
        { route: "pricetrend", label: "价格走势图", ico: "📈" },
        { route: "matneed",  label: "物资类型矩阵", ico: "🧮" },
      ],
    },
    {
      group: "活动物资", collapsed: true, items: [
        { route: "events",  label: "活动日历", ico: "📅" },
        { route: "treasure",label: "宝藏开箱", ico: "🧰" },
        { route: "loot",    label: "随机舔包", ico: "🎒" },
        { route: "scatter", label: "散落物资点", ico: "📍" },
      ],
    },
    {
      group: "模拟分析", collapsed: true, items: [
        { route: "sim_armor", label: "护甲模拟", ico: "🛡" },
        { route: "sim_damage",label: "伤害模拟", ico: "💥" },
        { route: "analytics", label: "数据分析", ico: "📊" },
        { route: "profit",   label: "净收益结算器", ico: "💰" },
      ],
    },
    {
      group: "娱乐工具", collapsed: true, items: [
        { route: "games",   label: "电竞趣味游戏", ico: "🎮" },
        { route: "tools",   label: "实用工具", ico: "🧰" },
        { href: "music.html", label: "音乐台", ico: "🎵" },
        { route: "feedback",label: "意见反馈", ico: "📮" },
      ],
    },
    {
      group: "天气 · 预警", collapsed: true, items: [
        { route: "weather", label: "天气预报", ico: "🌤" },
        { route: "alerts",  label: "台风 / 地震预警", ico: "🌐" },
      ],
    },
    {
      group: "个人", collapsed: true, items: [
        { href: "profile.html", label: "我的主页", ico: "👤" },
        { href: "ugc.html",     label: "投稿", ico: "📝" },
        { route: "myassets", label: "我的资产", ico: "🎒" },
        { route: "weekly", label: "行动周报", ico: "📊" },
      ],
    },
    {
      group: "站点信息", collapsed: true, items: [
        { route: "changelog", label: "网站更新速览", ico: "📜" },
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
  function safeUrl(u) { u = u || ""; if (/^\s*(javascript|data|vbscript):/i.test(u)) return "#"; return u; }
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
    MENU.forEach(function (entry, idx) {
      if (entry.group) {
        // 如果当前激活路由在该组内，默认展开
        var hasActive = entry.items.some(function (it) { return it.route === active; });
        var collapsed = hasActive ? false : entry.collapsed;
        var arrow = collapsed ? "&#9662;" : "&#9652;";
        str += '<div class="menu-group-wrap' + (hasActive ? " active-group" : "") + '">' +
          '<div class="menu-group-toggle" data-idx="' + idx + '">' +
          '<span>' + esc(entry.group) + '</span><span class="arrow">' + arrow + '</span>' +
          '</div>' +
          '<div class="menu-group-items" style="display:' + (collapsed ? "none" : "block") + '">' +
          renderMenuItems(entry.items, active) +
          '</div></div>';
      } else {
        str += renderMenuItem(entry, active, "menu-item-plain");
      }
    });
    menuEl.innerHTML = str;

    // 绑定分组折叠
    menuEl.querySelectorAll(".menu-group-toggle").forEach(function (el) {
      el.addEventListener("click", function () {
        var wrap = el.parentElement;
        var items = wrap.querySelector(".menu-group-items");
        var arrow = el.querySelector(".arrow");
        var nowHidden = items.style.display === "none";
        items.style.display = nowHidden ? "block" : "none";
        arrow.innerHTML = nowHidden ? "&#9652;" : "&#9662;";
        wrap.classList.toggle("collapsed", !nowHidden);
      });
    });

    // 绑定路由点击
    menuEl.querySelectorAll(".menu-item[data-route], .menu-item-plain[data-route]").forEach(function (el) {
      el.addEventListener("click", function () { navigate(el.getAttribute("data-route")); });
    });
  }

  function renderMenuItems(items, active) {
    return items.map(function (it) { return renderMenuItem(it, active, "menu-item"); }).join("");
  }

  function renderMenuItem(it, active, extraCls) {
    if (it.href) {
      return '<a class="' + extraCls + '" href="' + esc(safeUrl(it.href)) + '">' +
             (it.ico ? '<span class="ico">' + it.ico + '</span>' : '') +
             '<span>' + esc(it.label) + "</span></a>";
    }
    var cls = extraCls + (it.route === active ? " active" : "");
    return '<div class="' + cls + '" data-route="' + esc(it.route) + '">' +
           (it.ico ? '<span class="ico">' + it.ico + '</span>' : '') +
           '<span>' + esc(it.label) + "</span></div>";
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

  // 优先取实时数据源的最新时间，避免首页“每日更新”永远卡死在 data.json 的静态 updatedAt
  function latestUpdateText() {
    var ts = 0;
    var src = "data.json";
    if (window.DF && window.DF.mapPass) {
      var m = window.DF.mapPass.meta();
      if (m && m.ts && m.ts > ts) { ts = m.ts; src = "地图密码 API"; }
    }
    if (window.DF && window.DF.livePrice) {
      var m = window.DF.livePrice.meta();
      if (m && m.ts && m.ts > ts) { ts = m.ts; src = "实时物价 API"; }
    }
    if (!ts && DATA && DATA.updatedAt) { ts = new Date(DATA.updatedAt).getTime(); }
    if (!ts || ts <= 0) return "同步中…";
    return new Date(ts).toLocaleString("zh-CN") + " · " + src;
  }

  function updateHeroTime() {
    var el = document.getElementById("kkHeroTime");
    if (el) el.textContent = latestUpdateText();
  }

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

  function topEventsTable(items) {
    var ev = DATA.eventItems || {};
    items = items || (ev.items || []);
    var rows = items.map(function (it) {
      var cur = it.cur;
      var ideal = it.ideal;
      var priceFrom = it.priceFrom ? '<span class="kk-snap" style="margin-left:6px">实时</span>' : '';
      return "<tr><td>" + esc(it.name) + priceFrom + "</td>" +
        '<td style="text-align:right">' + fmt(cur) + "</td>" +
        '<td style="text-align:right">' + fmt(ideal) + "</td>" +
        "<td>" + (cur > ideal ? "高于理想价" : "低于理想价") + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>物品</th><th style='text-align:right'>当前售价</th><th style='text-align:right'>理想售价</th><th>提示</th></tr></thead>" +
      "<tbody>" + (rows || '<tr><td colspan="4" class="kk-empty">暂无数据</td></tr>') + "</tbody></table></div>";
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
    var total = groups.reduce(function (n, g) { return n + (g.items || []).length; }, 0);
    var tags = groups.map(function (g) { return esc(g.name); }).join(" · ");
    return '<a class="kk-tasks" href="?viewpage=tasks">' +
      '<span class="kk-tasks-tag">赛季任务</span>' +
      '<span class="kk-tasks-title">' + tags + '</span>' +
      '<span class="kk-tasks-more">共 ' + total + ' 项 · 分栏查看 →</span></a>';
  }

  /* ---------- KK日报 式紧凑仪表盘板块 ---------- */
  function kkMapBlock() {
    return '<div class="kk-card"><div class="kk-card-h">🗺 每日地图密码 <span class="kk-api">API 实时</span> <a class="kk-more" href="?viewpage=maps">更多</a></div>' +
      '<div class="kk-map-grid" id="kkMapGrid">' + renderMapCards((DATA.maps || [])) + '</div>' +
      '<div class="kk-live-status" id="kkMapStatus">正在拉取最新地图密码…</div></div>';
  }
  function renderMapCards(arr) {
    return arr.map(function (m) {
      return '<div class="kk-map" title="' + esc(m.full || m.short || "") + '"><div class="kk-map-name">' + esc(m.name) + '</div>' +
        '<div class="kk-map-code">' + esc(m.code) + '</div>' +
        '<div class="kk-map-date">' + esc(m.short || m.date || "今日") + '</div></div>';
    }).join("") || '<div class="kk-empty">暂无</div>';
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
    return '<div class="kk-card"><div class="kk-card-h">📈 高价格浮动材料 <span class="kk-api">实时</span></div>' +
      '<div id="kkMaterialsBody"><div class="kk-empty">正在从实时价格源加载…</div></div></div>';
  }
  function renderMaterialsLive(arr) {
    if (!arr || !arr.length) return '<div class="kk-empty">暂无数据</div>';
    return arr.map(function (m) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(m.name) + '</span>' +
        '<span class="kk-li-v">' + fmt(m.price) + '</span>' +
        '<span class="kk-li-t">' + esc(m.cat || "实时") + '</span></div>';
    }).join("");
  }
  function kkBulletsBlock() {
    return '<div class="kk-card"><div class="kk-card-h">🔫 热门子弹价格（前十）<span class="kk-api">实时</span></div>' +
      '<div id="kkBulletsBody"><div class="kk-empty">正在从实时价格源加载…</div></div></div>';
  }
  function renderBulletsLive(arr) {
    if (!arr || !arr.length) return '<div class="kk-empty">暂无数据</div>';
    return arr.map(function (b, i) {
      return '<div class="kk-li"><span class="kk-li-i">' + (i + 1) + '</span>' +
        '<span class="kk-li-n">' + esc(b.name) + '</span>' +
        '<span class="kk-li-v">' + fmt(b.price) + '</span></div>';
    }).join("");
  }
  function kkLivePriceBlock() {
    var c = (DATA.livePrice || {});
    if (c.enabled === false) return "";
    return '<a class="kk-card kk-live" href="?viewpage=prices">' +
      '<div class="kk-card-h">💹 实时物价 <span class="kk-api">实时</span></div>' +
      '<div class="kk-live-body" id="kkLivePriceBody">正在加载游戏内交易行真实成交价…</div>' +
      '<div class="kk-live-go" id="kkLivePriceGo">查看实时物价 →</div></a>';
  }
  function kkEventsBlock() {
    var ev = DATA.eventItems || {};
    return '<div class="kk-card"><div class="kk-card-h">🎁 活动物品需求 <span class="kk-api">实时价格</span><a class="kk-more" href="?viewpage=eventitems">更多</a></div>' +
      '<div id="kkEventsBody">' + renderEventRows((ev.items || [])) + '</div></div>';
  }
  function renderEventRows(items) {
    if (!items || !items.length) return '<div class="kk-empty">暂无（后台可维护，开启实时物价后会自动匹配当前价格）</div>';
    var rows = items.map(function (it) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(it.name) + '</span>' +
        '<span class="kk-li-v" data-ename="' + esc(it.name) + '">' + (it.cur ? fmt(it.cur) : '—') + '</span></div>';
    }).join("");
    return rows;
  }
  function kkDoorBlock() {
    return '<div class="kk-card"><div class="kk-card-h">🔑 密码门速查 <span class="kk-api">API 实时</span></div>' +
      '<div id="kkDoorBody">' + renderDoorRows((DATA.doorCodes || []).slice(0, 6)) + '</div></div>';
  }
  function renderDoorRows(arr) {
    if (!arr || !arr.length) return '<div class="kk-empty">暂无</div>';
    return arr.map(function (d) {
      return '<div class="kk-li"><span class="kk-li-n">' + esc(d.map) + '·' + esc(d.location) + '</span>' +
        '<span class="kk-li-v code-strong">' + esc(d.code) + '</span></div>';
    }).join("");
  }

  /* ---------- 首页精选卡（一屏速览入口） ---------- */
  function kkFeaturedBlock() {
    return '<div class="kk-feat" id="kkFeat">' +
      '<a class="kk-feat-card" href="?viewpage=maps">' +
        '<div class="kk-feat-ico">🗺</div>' +
        '<div class="kk-feat-body"><div class="kk-feat-l">今日地图密码</div>' +
        '<div class="kk-feat-v" id="kkFeatPass">—</div>' +
        '<div class="kk-feat-sub" id="kkFeatPassSub">点击查看全部</div></div>' +
      '</a>' +
      '<a class="kk-feat-card" href="?viewpage=gunrank">' +
        '<div class="kk-feat-ico">🔥</div>' +
        '<div class="kk-feat-body"><div class="kk-feat-l">热门改枪</div>' +
        '<div class="kk-feat-v" id="kkFeatBuild">—</div>' +
        '<div class="kk-feat-sub" id="kkFeatBuildSub">改枪热度榜 →</div></div>' +
      '</a>' +
      '<a class="kk-feat-card" href="?viewpage=guides">' +
        '<div class="kk-feat-ico">📖</div>' +
        '<div class="kk-feat-body"><div class="kk-feat-l">热门攻略</div>' +
        '<div class="kk-feat-v" id="kkFeatGuide">—</div>' +
        '<div class="kk-feat-sub" id="kkFeatGuideSub">新手速览 →</div></div>' +
      '</a>' +
      '<a class="kk-feat-card" href="?viewpage=pricetrend">' +
        '<div class="kk-feat-ico">💹</div>' +
        '<div class="kk-feat-body"><div class="kk-feat-l">物价精选</div>' +
        '<div class="kk-feat-v" id="kkFeatPrice">—</div>' +
        '<div class="kk-feat-sub" id="kkFeatPriceSub">价格走势 →</div></div>' +
      '</a>' +
    '</div>';
  }
  // 首页精选卡填充（静态部分，实时部分在 home.init 内更新）
  function fillFeaturedStatic() {
    var builds = (DATA.gunBuilds || []);
    var topBuild = null;
    for (var i = 0; i < builds.length; i++) {
      var t = builds[i].tags || [];
      if (t.indexOf("绝密") > -1 || t.indexOf("满改") > -1) { topBuild = builds[i]; break; }
    }
    topBuild = topBuild || builds[0];
    var bv = document.getElementById("kkFeatBuild");
    var bs = document.getElementById("kkFeatBuildSub");
    if (bv && topBuild) {
      bv.textContent = (topBuild.name || "").replace(/\s*·\s*/g, "·").slice(0, 14);
      if (bs) bs.textContent = (topBuild.weapon || "") + " · " + (topBuild.mode || "");
    }
    var guides = (DATA.guides || []);
    var g0 = guides[0];
    var gv = document.getElementById("kkFeatGuide");
    var gs = document.getElementById("kkFeatGuideSub");
    if (gv && g0) {
      gv.textContent = (g0.title || g0.name || "新手速览").slice(0, 14);
      if (gs) gs.textContent = (g0.cat || "新手速览") + " →";
    }
  }

  /* ---------- 赛季任务图谱（纯 CSS 横向分支树，无外部依赖） ---------- */
  var TASK_COLORS = {
    g_phase1: "#3a7bd5",
    g_phase2: "#7b2cbf",
    g_phase3: "#ffb300",
    g_phase4: "#e63946",
    g_collector: "#2ecc71",
    g_fate: "#ff6b6b"
  };
  function taskGroupColor(gid) { return TASK_COLORS[gid] || "#19c3a6"; }
  function taskGroupType(g) {
    if (g.type) return g.type;
    if (g.id === "g_collector") return "收集者委托";
    if (g.id === "g_fate") return "命运契约";
    if (g.id && g.id.indexOf("g_phase") === 0) return "赛季主线";
    return g.name;
  }
  function taskDoneKey() {
    return "df-tasks-done-" + ((DATA && DATA.tasks && DATA.tasks.season) || "S10");
  }
  function getTaskDone(id) {
    try { var map = JSON.parse(localStorage.getItem(taskDoneKey()) || "{}"); return !!map[id]; }
    catch (e) { return false; }
  }
  function setTaskDone(id, done) {
    try {
      var key = taskDoneKey();
      var map = JSON.parse(localStorage.getItem(key) || "{}");
      if (done) map[id] = true; else delete map[id];
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {}
  }
  function renderTaskTree(group) {
    var container = document.getElementById("taskTree");
    if (!container || !group) return;
    var color = taskGroupColor(group.id);
    var items = (group.items || []).filter(function(it) { return it && it.id; });
    if (!items.length) {
      container.innerHTML = '<div class="task-tree-empty">暂无该阶段任务数据</div>';
      return;
    }

    var rootHtml = '<div class="task-root"><div class="task-root-card" style="--c:' + color + '">' + esc(group.name) + '</div></div>';

    var branchesHtml = items.map(function(it) {
      var done = getTaskDone(it.id);
      var cls = done ? "task-node done" : "task-node";
      return '<div class="task-branch" style="--c:' + color + '">' +
        '<div class="task-connector"></div>' +
        '<div class="' + cls + '" data-id="' + esc(it.id) + '" style="--c:' + color + '">' +
          '<div class="task-node-type">' + esc(taskGroupType(group)) + '</div>' +
          '<div class="task-node-title">' + esc(it.title) + '</div>' +
          '<div class="task-node-meta">' + esc(it.map || "任意地图") + ' · ' + (done ? "✅ 已完成" : "▼ 待完成") + '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    container.innerHTML = '<div class="task-tree" style="--c:' + color + '">' + rootHtml +
      '<div class="task-branches" style="--c:' + color + '">' + branchesHtml + '</div>' +
    '</div>';

    container.querySelectorAll(".task-node").forEach(function(node) {
      node.addEventListener("click", function() {
        var id = node.getAttribute("data-id");
        var item = items.find(function(x) { return x.id === id; });
        if (item) showTaskModal(item, group, color);
      });
    });
  }
  function showTaskModal(it, g, color) {
    if (!it) return;
    var type = g ? taskGroupType(g) : "赛季任务";
    var done = getTaskDone(it.id);
    var goals = (it.goals || []).map(function(x) { return "<li>" + esc(x) + "</li>"; }).join("") || "<li>暂无具体目标</li>";
    var rewards = (it.reward || "").split(/[、；;]/).filter(function(s) { return s.trim(); }).map(function(x) { return "<li>" + esc(x.trim()) + "</li>"; }).join("") || "<li>暂无</li>";
    var html = '<div class="task-modal-backdrop" id="taskModalBackdrop">' +
      '<div class="task-modal">' +
        '<div class="task-modal-head"><span>任务详情</span><button class="task-modal-close" id="taskModalClose">×</button></div>' +
        '<div class="task-modal-body">' +
          '<div class="task-block task-info">' +
            '<div class="task-row"><label>任务类型</label><span>' + esc(type) + '</span></div>' +
            '<div class="task-row"><label>任务名称</label><span>' + esc(it.title) + '</span></div>' +
            '<div class="task-row"><label>任务地图</label><span>' + esc(it.map || "任意地图") + '</span></div>' +
          '</div>' +
          '<div class="task-block task-goals"><div class="task-block-title">任务目标</div><ul>' + goals + '</ul></div>' +
          '<div class="task-block task-reward"><div class="task-block-title">任务奖励</div><ul>' + rewards + '</ul></div>' +
          (it.note ? '<div class="task-block task-note">' + esc(it.note) + '</div>' : '') +
        '</div>' +
        '<div class="task-modal-foot">' +
          '<button class="btn-mark' + (done ? " done" : "") + '" id="taskModalMark" style="background:' + color + '">' + (done ? "标记未完成" : "标记完成") + '</button>' +
          '<button class="btn-ok" id="taskModalOk">确定</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.insertAdjacentHTML("beforeend", html);
    var backdrop = document.getElementById("taskModalBackdrop");
    var close = function() { if (backdrop) backdrop.remove(); };
    document.getElementById("taskModalClose").addEventListener("click", close);
    document.getElementById("taskModalOk").addEventListener("click", close);
    backdrop.addEventListener("click", function(e) { if (e.target === backdrop) close(); });
    document.getElementById("taskModalMark").addEventListener("click", function() {
      var newDone = !done;
      setTaskDone(it.id, newDone);
      var currentGroup = g;
      if (!currentGroup) {
        var groups = ((DATA && DATA.tasks && DATA.tasks.groups) || []).filter(function(gx) { return gx.id && gx.id.indexOf("g_") === 0; });
        currentGroup = groups.find(function(gx) { return (gx.items || []).some(function(x) { return x.id === it.id; }); });
      }
      if (currentGroup) renderTaskTree(currentGroup);
      close();
    });
  }

  /* ---------- 视图 ---------- */
  var VIEWS = {
    home: {
      html: function () {
        return '<div class="kk-hero"><div class="kk-hero-t"><h1>三角洲情报台</h1>' +
          '<p>每日密码 · 产物利润 · 材料价格 · 一屏看全</p></div>' +
          '<div class="kk-hero-u" id="kkHeroTime">每日更新 · 同步中…</div></div>' +
          homeTaskStrip() +
          kkFeaturedBlock() +
          '<div class="kk-board">' +
            kkMapBlock() + kkItemsBlock() + kkMaterialsBlock() + kkBulletsBlock() + kkEventsBlock() + kkDoorBlock() + kkLivePriceBlock() +
          '</div>';
      },
      init: function () {
        // 首页加载并注入实时数据：地图密码、密码门、实时物价 top5、活动物品价格
        function tryUpdate() {
          updateHeroTime();
          fillFeaturedStatic();
          if (window.DF && window.DF.mapPass) {
            var mp = window.DF.mapPass;
            var list = mp.list();
            if (list && list.length) {
              var grid = document.getElementById("kkMapGrid");
              var status = document.getElementById("kkMapStatus");
              if (grid) grid.innerHTML = renderMapCards(list.map(function (m) { return { name: m.name, code: m.code, short: m.shortLocation || "今日", full: m.location }; }));
              if (status) {
                var meta = mp.meta();
                status.innerHTML = '共 ' + list.length + ' 张地图 · ' + esc(meta.updateDate || '实时接口已更新');
              }
            }
            var doorBody = document.getElementById("kkDoorBody");
            if (doorBody) doorBody.innerHTML = renderDoorRows(list.slice(0, 6).map(function (m) { return { map: m.name, location: m.location || "密码门", code: m.code }; }));
            var fp = document.getElementById("kkFeatPass");
            var fps = document.getElementById("kkFeatPassSub");
            if (fp && list[0]) fp.textContent = list[0].code || "—";
            if (fps && list[0]) fps.textContent = (list[0].name || "今日") + " 密码";
          }
          if (window.DF && window.DF.livePrice) {
            var lp = window.DF.livePrice;
            var body = document.getElementById("kkLivePriceBody");
            if (body) {
              var m = lp.meta();
              if (m && m.error) { body.textContent = "实时源暂不可用：" + m.error; }
              else if (m && m.count) {
                var top = lp.list().slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 5);
                body.innerHTML = '最新 ' + m.count + ' 项交易行价格<br>' + top.map(function (x) { return '<span class="lp-mini">' + esc(x.name) + ' <b>' + fmt(x.price) + '</b></span>'; }).join("");
                var fp2 = document.getElementById("kkFeatPrice");
                var fps2 = document.getElementById("kkFeatPriceSub");
                if (fp2 && top.length) {
                  fp2.textContent = top[0].name.length > 12 ? top[0].name.slice(0, 12) + "…" : top[0].name;
                  if (fps2) fps2.textContent = fmt(top[0].price) + " · 最新高价";
                }
              } else { body.textContent = m && m.count === 0 ? "暂无数据" : "正在加载实时物价…"; }
            }
            // 高价格浮动材料：数据源没有独立的「材料」分类，改为展示实时价格 Top 6 高价物品（多为头盔/护甲/背包/钥匙等高价值装备）
            var mb = document.getElementById("kkMaterialsBody");
            if (mb) {
              var meta = lp.meta();
              if (meta && meta.error) {
                mb.innerHTML = '<div class="kk-empty">实时源暂不可用：' + esc(meta.error) + '</div>';
              } else {
                var all = lp.list().slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
                var mats = all.slice(0, 6);
                mb.innerHTML = renderMaterialsLive(mats);
              }
            }
            // 热门子弹：实时数据源中子弹按口径分类（如 5.56x45mm、9x19mm），不是「弹」字，改用口径模式识别
            var bb = document.getElementById("kkBulletsBody");
            if (bb) {
              var meta2 = lp.meta();
              if (meta2 && meta2.error) {
                bb.innerHTML = '<div class="kk-empty">实时源暂不可用：' + esc(meta2.error) + '</div>';
              } else {
                var bls = lp.list().filter(function (x) {
                  var c = String(x.cat || "");
                  return /mm|Gauge|Magnum|ACP|AE|R$|复合弓箭矢/.test(c);
                }).sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 10);
                bb.innerHTML = renderBulletsLive(bls);
              }
            }
            // 活动物品需求：从实时价格自动匹配
            var evBody = document.getElementById("kkEventsBody");
            if (evBody) {
              var evItems = (DATA.eventItems || {}).items || [];
              if (evItems.length) {
                evBody.innerHTML = renderEventRows(evItems.map(function (it) {
                  var p = lp.price(it.name);
                  return { name: it.name, cur: p != null ? p : it.cur };
                }));
              }
            }
          }
        }
        tryUpdate();
        if (window.DF && window.DF.mapPass) window.DF.mapPass.onChange(tryUpdate);
        if (window.DF && window.DF.livePrice) {
          window.DF.livePrice.onChange(tryUpdate);
        } else {
          // liveprice.js 在 app.js 之后加载；等它注册完成后再尝试更新并绑定监听
          window.addEventListener("df:liveprice", function () {
            if (window.DF && window.DF.livePrice) window.DF.livePrice.onChange(tryUpdate);
            tryUpdate();
          }, { once: true });
        }
      }
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
        function render() {
          if (!window.go) { div.innerHTML = '<p style="padding:20px;color:var(--muted)">制作树引擎未加载（可能无网络）。</p>'; return; }
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
            nodeDataArray: c.nodes || [], linkDataArray: c.links || [],
          });
        }
        if (window.go) { render(); return; }
        // 按需懒加载 GoJS（避免首页/微信端白下载约 3MB 的图表库）
        div.innerHTML = '<p style="padding:20px;color:var(--muted)">正在加载制作树引擎…</p>';
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/gojs@3.0.15/release/go.js";
        s.onload = render;
        s.onerror = function () { div.innerHTML = '<p style="padding:20px;color:#ff5b5b">制作树引擎加载失败，请检查网络后重试。</p>'; };
        document.head.appendChild(s);
      },
    },
    eventitems: {
      html: function () {
        var ev = DATA.eventItems || {};
        var note = ev.note ? '<p class="guide-intro">' + esc(ev.note) + "</p>" : "";
        var apiTag = ev.api ? '<span class="count-badge" style="background:#19c3a6">API 实时</span>' : '<span class="count-badge" style="background:#19c3a6">实时价格匹配</span>';
        return '<div class="section-title">' + esc(ev.title || "活动物品需求") + " " + apiTag + "</div>" +
          (ev.period ? '<p class="period">活动时间：' + esc(ev.period) + "</p>" : "") +
          note +
          '<div id="evTableWrap">' + (ev.items && ev.items.length ? topEventsTable() : '<div class="card"><p style="color:var(--muted)">暂无数据。管理员可在后台「活动物品需求」面板维护物品名，系统会自动从免费实时价格接口（caiweilv/DeltaForcePrice）匹配当前交易行价格。</p></div>') + '</div>';
      },
      init: function () {
        var ev = DATA.eventItems || {};
        function resolveAndRender() {
          if (!window.DF || !window.DF.livePrice) return;
          var lp = window.DF.livePrice;
          var items = (ev.items || []).map(function (it) {
            var p = lp.price(it.name);
            return { name: it.name, cur: p != null ? p : (it.cur || 0), ideal: it.ideal || 0, priceFrom: p != null };
          });
          var wrap = document.getElementById("evTableWrap");
          if (wrap) wrap.innerHTML = topEventsTable(items);
        }
        // 如果有自定义 API，先拉取
        if (ev.api) {
          fetch(ev.api + (ev.api.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now()).then(function (r) { return r.json(); })
            .then(function (data) {
              var items = Array.isArray(data) ? data : (data.items || []);
              if (items && items.length) {
                ev.items = items.map(function (it) {
                  return { name: it.name || it.物品 || "", cur: +it.cur || +it.当前 || 0, ideal: +it.ideal || +it.理想 || 0 };
                });
                resolveAndRender();
              }
            }).catch(function () { resolveAndRender(); });
        } else {
          var lp = window.DF && window.DF.livePrice ? window.DF.livePrice : null;
          if (lp && lp.ready() && lp.ready().items && lp.ready().items.length) resolveAndRender();
          else if (window.DF && window.DF.livePrice) window.DF.livePrice.load(true).then(resolveAndRender);
          if (window.DF && window.DF.livePrice) window.DF.livePrice.onChange(resolveAndRender);
        }
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
        var groups = (tasks.groups || []).filter(function (g) { return g.id && g.id.indexOf("g_") === 0; });
        var order = { g_phase1: 0, g_phase2: 1, g_phase3: 2, g_phase4: 3, g_collector: 4, g_fate: 5 };
        groups.sort(function (a, b) { return (order[a.id] || 9) - (order[b.id] || 9); });
        if (!groups.length) {
          return '<div class="section-title">赛季任务 / 综合挑战手册</div>' +
            '<div class="card"><p style="color:var(--muted)">暂无任务数据。管理员可在后台 ' +
            '<a href="admin.html">admin.html</a> 维护赛季任务、挑战手册。</p></div>';
        }
        var tabs = groups.map(function (g, idx) {
          return '<button class="task-tab' + (idx === 0 ? " active" : "") + '" data-tab="' + idx + '">' + esc(g.name) + '</button>';
        }).join("");
        return '<div class="section-title">赛季任务 / 综合挑战手册 <span class="count-badge">' + esc(tasks.season || "S10") + '</span></div>' +
          (tasks.note ? '<p class="guide-intro">' + esc(tasks.note) + '</p>' : '') +
          '<div class="task-tabs">' + tabs + '</div>' +
          '<div class="task-panel active">' +
            '<div class="task-tree-h" id="taskTreeTitle">' + esc(groups[0].name) + '</div>' +
            '<div id="taskTree" class="task-tree-diagram"></div>' +
          '</div>';
      },
      init: function () {
        var tasks = DATA.tasks || {};
        var groups = (tasks.groups || []).filter(function (g) { return g.id && g.id.indexOf("g_") === 0; });
        var order = { g_phase1: 0, g_phase2: 1, g_phase3: 2, g_phase4: 3, g_collector: 4, g_fate: 5 };
        groups.sort(function (a, b) { return (order[a.id] || 9) - (order[b.id] || 9); });
        if (!groups.length) return;
        var tabs = document.querySelectorAll(".task-tab");
        var title = document.getElementById("taskTreeTitle");
        function show(idx) {
          tabs.forEach(function (b, i) { b.classList.toggle("active", i === idx); });
          if (title) title.textContent = groups[idx].name;
          renderTaskTree(groups[idx]);
        }
        tabs.forEach(function (btn) {
          btn.addEventListener("click", function () { show(+btn.getAttribute("data-tab")); });
        });
        show(0);
      }
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

  /* ---------- Service Worker 注册（保留更新提示，移除安装横幅）---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js?v=51").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var newWorker = reg.installing;
          newWorker.addEventListener("statechange", function () {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // 新版 SW 已安装但还在等待，提示用户刷新
              showUpdateBanner(newWorker);
            }
          });
        });
      }).catch(function () {});
      // 合并工作台生成的导航项（data.json.menu 中的 _wb 项）到侧栏
      try {
        fetch("data.json?_=" + Date.now()).then(function (r) { return r.json(); }).then(function (data) {
          if (data && Array.isArray(data.menu) && data.menu.length) {
            var items = data.menu.map(function (it) {
              return { route: it.route || "", ico: it.ico || "📦", label: it.label || it.route || "未命名", href: it.href || "" };
            });
            var idx = MENU.findIndex(function (e) { return e.group === "应用"; });
            if (idx >= 0) MENU[idx].items = items; else MENU.push({ group: "应用", items: items });
            render(getRoute());
          }
        }).catch(function () {});
      } catch (e) {}
    });
  }

  function showUpdateBanner(worker) {
    if (document.getElementById("dfUpdateBanner")) return;
    var b = document.createElement("div");
    b.id = "dfUpdateBanner";
    b.className = "install-banner";
    b.style.background = "linear-gradient(90deg,#2563eb,#06b6d4)";
    b.innerHTML = '<span class="ib-icon">🚀</span>' +
      '<span class="ib-text">网站已更新，请刷新页面加载最新版本</span>' +
      '<button class="ib-btn" id="ibUpdate">立即刷新</button>' +
      '<button class="ib-close" id="ibUpdateClose">×</button>';
    document.body.appendChild(b);
    document.getElementById("ibUpdate").addEventListener("click", function () {
      if (worker) worker.postMessage("skipWaiting");
      window.location.reload();
    });
    document.getElementById("ibUpdateClose").addEventListener("click", function () {
      document.getElementById("dfUpdateBanner").remove();
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
  // 令牌读取：登录后存于 localStorage.di_user_token
  function diToken() { try { return localStorage.getItem("di_user_token") || ""; } catch (e) { return ""; } }

  /* 统一后端 API 调用：代理 Worker /api/* 路由（GET/POST，JSON 体，Bearer 鉴权）。
   * 供 games.js(排行榜)、checkin.js、各插件复用，避免重复拼 base/header。
   * opts.body 若已是字符串则原样发送；若为对象则自动 JSON.stringify 并补 Content-Type。 */
  function dfApi(path, opts) {
    opts = opts || {};
    var base = "https://api.delta.shopping";
    try { if (DATA && DATA.site && DATA.site.apiBase) base = DATA.site.apiBase; } catch (e) {}
    var t = diToken();
    opts.headers = opts.headers || {};
    if (t) opts.headers["Authorization"] = "Bearer " + t;
    if (opts.body != null && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
    if (opts.body != null && !opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
    var url = base.replace(/\/$/, "") + path;
    return fetch(url, opts).then(function (r) {
      if (!r.ok) { return r.json().catch(function () { return { error: "HTTP " + r.status }; }); }
      return r.json();
    }).catch(function (e) { return { error: (e && e.message) ? e.message : String(e) }; });
  }

  window.DF = {
    VIEWS: VIEWS, MENU: MENU,
    esc: esc, fmt: fmt,
    mapArt: DFmapArt,
    getData: function () { return DATA; },
    setData: function (d) { DATA = d; },
    navigate: navigate,
    render: render,
    api: dfApi,
    apiBase: "https://api.delta.shopping",
    getToken: diToken,
    addStyle: function (id, css) {
      if (document.getElementById(id)) return;
      var s = document.createElement("style"); s.id = id; s.textContent = css;
      document.head.appendChild(s);
    }
  };
  /* 菜单已在上方 MENU 配置中统一编排（含全部真实路由）；
     禁用各插件各自 push 的分组，避免重复与混乱 */
  MENU.push = function () {};
  if (window.__df_ready) { try { window.__df_ready(window.DF); } catch (e) { console.error(e); } }
  if (window.__df_plugins) {
    window.__df_plugins.forEach(function (fn) { try { fn(window.DF); } catch (e) { console.error(e); } });
  }

  /* ---------- 启动：先拉数据，再渲染 ---------- */
  fetchData()
    .then(function (d) {
      DATA = d;
      try { window.dispatchEvent(new Event("df:data")); } catch (e) {}
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
