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
  var LIVE = {};    // 实时物价：name(trim) -> price，由首页客户端直拉 DeltaForcePrice
  var LIVE_TS = null; // 最近一次成功拉取时间

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
      group: "总览", en: "Overview", items: [
        { route: "home",   label: "首页一图流", en: "Home feed", ico: "🏠" },
        { route: "maps",   label: "每日地图密码", en: "Daily map codes", ico: "🗺" },
      ],
    },
    {
      group: "数据", en: "Data", items: [
        { route: "items",  label: "特勤处产物推荐", en: "Crafting recommendations", ico: "🛠" },
        { route: "bullets",label: "热门子弹利润", en: "Ammo profit", ico: "🔫" },
        { route: "events", label: "活动物品需求", en: "Event item demand", ico: "🎁" },
        { route: "materials", label: "高价格浮动材料", en: "Volatile materials", ico: "📈" },
      ],
    },
    {
      group: "可视化", en: "Visualize", items: [
        { route: "craft",  label: "制作树 / 科技树", en: "Craft / tech tree", ico: "🌳" },
      ],
    },
    {
      group: "外部", en: "External", items: [
        { route: "links",  label: "原站权威数据", en: "Official data", ico: "🔗" },
      ],
    },
    {
      group: "资讯", en: "Info", items: [
        { route: "tasks", label: "赛季任务 / 挑战手册", en: "Season tasks", ico: "📋" },
      ],
    },
    {
      group: "视听", en: "Media", items: [
        { route: "music", label: "🎵 音乐台", en: "🎵 Music", ico: "🎵" },
      ],
    },
    {
      group: "社区", en: "Community", items: [
        { href: "forum.html", label: "战友论坛", en: "Forum", ico: "💬" },
        { href: "sponsor.html", label: "赞助我们", en: "Sponsor us", ico: "💝" },
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
  // 全站图标：优先用美术管理员上传的图片，没有则回退 emoji
  function diIcon(key, emoji) {
    var map = window.DI_ICONS || {};
    if (map[key]) return '<img class="di-ic" src="' + esc(map[key]) + '" alt="' + esc(emoji || "") + '" />';
    return esc(emoji || "");
  }
  function getRoute() {
    var p = new URLSearchParams(location.search).get("viewpage");
    if (!p && location.hash.indexOf("viewpage=") > -1) {
      p = new URLSearchParams(location.hash.replace(/^#/, "")).get("viewpage");
    }
    return p || DEFAULT;
  }

  /* ---------- 菜单渲染 ---------- */
  function renderMenu(active) {
    var lang = getLang();
    var str = "";
    MENU.forEach(function (g) {
      str += '<div class="menu-group">' + esc(lang === "en" ? (g.en || g.group) : g.group) + "</div>";
      g.items.forEach(function (it) {
        var ik = "nav:" + (it.route || it.href || it.label);
        var txt = lang === "en" ? (it.en || it.label) : it.label;
        if (it.href) {
          str += '<a class="menu-item" href="' + esc(it.href) + '">' +
                 '<span class="ico">' + diIcon(ik, it.ico) + "</span><span>" + esc(txt) + "</span></a>";
        } else {
          var cls = "menu-item" + (it.route === active ? " active" : "");
          str += '<div class="' + cls + '" data-route="' + esc(it.route) + '">' +
                 '<span class="ico">' + diIcon(ik, it.ico) + "</span><span>" + esc(txt) + "</span></div>";
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
  // 语言切换后重渲染菜单与当前视图
  window.addEventListener("di:lang", function () { render(getRoute()); });

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

  // 实时物价取值：优先用 LIVE（客户端直拉），取不到回退 data.json 原值
  function lp(name, fb) { var v = LIVE[String(name == null ? "" : name).trim()]; return (typeof v === "number") ? v : fb; }

  function topItemsTable() {
    var rows = (DATA.items || []).map(function (i) {
      return "<tr>" +
        '<td><span class="pill">' + esc(i.station) + "</span></td>" +
        '<td class="' + gradeClass(i.grade) + '">' + esc(i.name) + "</td>" +
        '<td class="profit-up">' + fmt(lp(i.name, i.profit)) + "</td>" +
        "<td>" + fmt(lp(i.name, i.price)) + "</td>" +
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
      var live = lp(b.name, null);
      return "<tr>" +
        '<td style="width:36px" class="r-common">' + (idx + 1) + "</td>" +
        "<td>" + esc(b.name) + "</td>" +
        '<td class="profit-up" style="text-align:right">' + fmt(b.profit) + "</td>" +
        '<td style="text-align:right' + (live != null ? ";color:var(--accent);font-weight:600" : "") + '">' + (live != null ? fmt(live) : "—") + "</td>" +
        '<td style="width:160px"><div style="height:8px;background:var(--bg-soft);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + "%;background:var(--accent)\"></div></div></td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>#</th><th>子弹</th><th style=\"text-align:right\">利润</th><th style=\"text-align:right\">当前价</th><th></th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function topEventsTable() {
    var ev = DATA.eventItems || {};
    var rows = (ev.items || []).map(function (it) {
      return "<tr><td>" + esc(it.name) + "</td>" +
        '<td style="text-align:right">' + fmt(lp(it.name, it.cur)) + "</td>" +
        '<td style="text-align:right">' + fmt(it.ideal) + "</td>" +
        "<td>" + (lp(it.name, it.cur) > it.ideal ? "高于理想价" : "低于理想价") + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>物品</th><th style='text-align:right'>当前售价</th><th style='text-align:right'>理想售价</th><th>提示</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function topMaterialsTable() {
    var rows = (DATA.materials || []).map(function (m) {
      return "<tr><td>" + esc(m.name) + "</td>" +
        '<td style="text-align:right">' + fmt(lp(m.name, m.cur)) + "</td>" +
        '<td style="text-align:right">' + fmt(m.min) + "</td>" +
        '<td style="text-align:right">' + fmt(m.max) + "</td>" +
        "<td>" + esc(m.buy) + "</td>" +
        "<td>" + esc(m.sell) + "</td></tr>";
    }).join("");
    return '<div class="card"><table class="tbl">' +
      "<thead><tr><th>材料</th><th style='text-align:right'>当前</th><th style='text-align:right'>最低</th><th style='text-align:right'>最高</th><th>建议买</th><th>建议卖</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  // 实时物价区块（被 #liveZone 包裹，拉取成功后整段重渲染）
  function liveSectionsHtml() {
    var live = getLang() === "en" ? "live" : "实时";
    return '<div class="section-title">' + t("secItems") + " · " + live + '</div>' + topItemsTable() +
      '<div class="section-title">' + t("secBullets") + '</div>' + topBulletsTable(8) +
      '<div class="section-title">' + t("secEvents") + '</div>' + topEventsTable() +
      '<div class="section-title">' + t("secMaterials") + '</div>' + topMaterialsTable() +
      '<p class="live-note">' + t("liveFallback") + '（DeltaForcePrice，~10min）</p>';
  }

  // 客户端直拉实时物价（走 jsDelivr 的 GitHub 镜像，带 CORS 头，浏览器可直接取）
  function refreshLivePrices() {
    var zone = document.getElementById("liveZone");
    var st = document.getElementById("liveStatus");
    if (st) st.innerHTML = "🔄 " + (getLang() === "en" ? "Fetching live prices…" : "正在获取实时物价…");
    fetch("https://cdn.jsdelivr.net/gh/caiweilv/DeltaForcePrice@master/price.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (arr) {
        if (!Array.isArray(arr)) throw new Error("返回格式异常");
        LIVE = {};
        arr.forEach(function (it) { if (it && it.name) LIVE[String(it.name).trim()] = it.price; });
        LIVE_TS = new Date();
        if (zone) zone.innerHTML = liveSectionsHtml();
        var ts = LIVE_TS.toLocaleTimeString(getLang() === "en" ? "en-US" : "zh-CN");
        if (st) st.innerHTML = "✅ " + t("liveUpdate") + " <b>" + ts + "</b> · " + arr.length + ' · <a href="#" id="liveRefresh" class="live-link">' + t("refresh") + '</a>';
        bindLiveRefresh();
      })
      .catch(function (e) {
        if (zone) zone.innerHTML = liveSectionsHtml();
        var upd = DATA && DATA.updatedAt ? new Date(DATA.updatedAt).toLocaleString(getLang() === "en" ? "en-US" : "zh-CN") : "未知";
        if (st) st.innerHTML = "⚠️ " + (getLang() === "en" ? "live fetch failed" : "实时获取失败") + "（" + esc(e.message || "网络错误") + "），" + t("liveFallback") + '（' + upd + '）· <a href="#" id="liveRefresh" class="live-link">' + (getLang() === "en" ? "retry" : "重试") + '</a>';
        bindLiveRefresh();
      });
  }
  function bindLiveRefresh() {
    var a = document.getElementById("liveRefresh");
    if (a) a.addEventListener("click", function (e) { e.preventDefault(); refreshLivePrices(); });
  }

  // 地图抽象建筑线描插画（SVG，内联，无需外部图）
  function mapArt(name) {
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

  function gradeBgClass(g) {
    return g === "legend" ? "b-legend" : g === "epic" ? "b-epic" : g === "rare" ? "b-rare" : "b-common";
  }
  function itemIcon(name) {
    var n = String(name || "");
    var emo = "🛠";
    if (n.indexOf("弹") > -1 || n.indexOf("Bullet") > -1) emo = "🔫";
    else if (n.indexOf("医疗") > -1 || n.indexOf("药") > -1) emo = "💊";
    else if (n.indexOf("背心") > -1 || n.indexOf("头盔") > -1 || n.indexOf("防具") > -1) emo = "🛡";
    else if (n.indexOf("手电") > -1 || n.indexOf("光") > -1) emo = "🔦";
    else if (n.indexOf("包") > -1) emo = "🎒";
    // 美术管理员可上传“道具图标”覆盖默认 emoji
    return diIcon("item:" + n, emo);
  }

  function homeMapCards() {
    var cards = (DATA.maps || []).map(function (m) {
      return '<div class="map-card-v2">' +
        '<div class="map-v2-meta">' +
          '<div class="map-v2-name">' + esc(m.name) + "</div>" +
          '<div class="map-v2-date">' + esc(m.date || "今日更新") + "</div>" +
        "</div>" +
        '<div class="map-v2-code">' + esc(m.code) + "</div>" +
        '<div class="map-v2-art">' + mapArt(m.name) + "</div>" +
      "</div>";
    }).join("");
    return '<div class="map-grid-v2">' + cards + "</div>";
  }

  function homeItemCards() {
    var list = (DATA.items || []).slice(0, 8);
    if (!list.length) return "";
    var cards = list.map(function (i) {
      return '<div class="item-card">' +
        '<div class="item-card-icon">' + itemIcon(i.name) + "</div>" +
        '<div class="item-card-body">' +
          '<div class="item-card-station">' + esc(i.station) + "</div>" +
          '<div class="item-card-name ' + gradeClass(i.grade) + '">' + esc(i.name) + "</div>" +
          '<div class="item-card-profit profit-up">' + fmt(i.profit) + "</div>" +
          '<div class="item-card-hint">理想售价 ' + fmt(i.price) + ' · ' + esc(i.sell) + "卖</div>" +
        "</div>" +
      "</div>";
    }).join("");
    return '<div class="section-title"><span>' + t("secItems") + '</span><span class="toggle-hour">' + (getLang() === "en" ? "hourly profit" : "小时利润") + '</span></div>' +
      '<div class="item-scroll">' + cards + "</div>";
  }

  function homeTaskStrip() {
    var tasks = DATA.tasks || {};
    var groups = tasks.groups || [];
    if (!groups.length) return "";
    var firstOpen = groups.find(function (g) { return g.open; }) || groups[0];
    var firstItem = (firstOpen.items || [])[0];
    var title = firstItem ? firstItem.title : (firstOpen.name || "赛季任务");
    return '<a class="notice-strip" href="?viewpage=tasks">' +
      '<span class="notice-strip-tag">赛季任务</span>' +
      '<span class="notice-strip-title">' + esc(title) + '</span>' +
      '<span class="notice-strip-more">查看全部 →</span>' +
    "</a>";
  }

  /* ---------- 视图 ---------- */
  /* ---------- 主页内容 feed（视频/攻略/图片/资讯） ---------- */
  function typeLabel(t) { return t === "video" ? t("typeVideo") : t === "guide" ? t("typeGuide") : t === "image" ? t("typeImage") : t("typeText"); }
  function feedEmbed(u) {
    if (!u) return "";
    var m, src = "";
    if ((m = u.match(/bilibili\.com\/video\/(BV\w+)/i)) || (m = u.match(/b23\.tv\/(BV\w+)/i)))
      src = "https://player.bilibili.com/player.html?bvid=" + m[1] + "&page=1&high_quality=1&danmaku=0";
    else if ((m = u.match(/youtu\.be\/(\w+)/i)) || (m = u.match(/youtube\.com\/watch\?v=(\w+)/i)))
      src = "https://www.youtube.com/embed/" + m[1];
    if (src) return '<div class="feed-media"><iframe src="' + esc(src) + '" allowfullscreen scrolling="no" frameborder="0"></iframe></div>';
    return "";
  }
  function homeFeed() {
    var feed = (DATA.feed || []);
    if (!feed.length) return "";
    var cards = feed.map(function (f) {
      var media = f.type === "image"
        ? '<div class="feed-media"><img src="' + esc(f.url) + '" alt="' + esc(f.title) + '" loading="lazy" /></div>'
        : (f.type === "video" ? feedEmbed(f.url) : "");
      var body = f.body ? '<div class="feed-body">' + esc(f.body) + "</div>" : "";
      return '<div class="feed-card">' +
        '<div class="feed-head"><span class="feed-tag feed-' + esc(f.type) + '">' + typeLabel(f.type) + "</span>" +
        '<span class="feed-title">' + esc(f.title) + "</span>" +
        '<span class="feed-meta">' + (f.author ? esc(f.author) + " · " : "") + esc(f.time || "") + "</span></div>" +
        media + body + "</div>";
    }).join("");
    return '<div class="section-title">' + t("secFeed") + '</div><div class="feed-list">' + cards + "</div>";
  }

  // 赞助名单（首页展示）
  function homeSponsors() {
    var list = (DATA.sponsors || []);
    if (!list.length) return "";
    var cards = list.map(function (s) {
      var av = s.avatar
        ? '<img class="sp-avatar" src="' + esc(s.avatar) + '" alt="' + esc(s.name) + '" loading="lazy" />'
        : '<div class="sp-avatar sp-avatar-empty">' + esc((s.name || "?").slice(0, 1)) + "</div>";
      return '<div class="sp-card">' + av +
        '<div class="sp-meta">' +
        '<div class="sp-name">' + esc(s.name) + "</div>" +
        (s.amount ? '<div class="sp-amount">' + esc(s.amount) + "</div>" : "") +
        (s.note ? '<div class="sp-note">' + esc(s.note) + "</div>" : "") +
        "</div></div>";
    }).join("");
    return '<div class="section-title">' + t("secSponsors") + '</div><div class="sp-list">' + cards + "</div>";
  }

  var VIEWS = {
    home: {
      html: function () {
        return homeTaskStrip() +
          '<div class="hero hero-v2"><div class="hero-titles">' +
          '<h1>' + t("appName") + '</h1>' +
          '<p>' + t("heroSub") + '</p></div>' +
          '<div class="hero-update">' + (getLang() === "en" ? "Updated daily" : "每日更新") + ' · <span id="updatedAtTop">' + (DATA.updatedAt ? new Date(DATA.updatedAt).toLocaleString(getLang() === "en" ? "en-US" : "zh-CN") : "加载中") + "</span></div></div>" +
          homeFeed() +
          '<div id="liveStatus" class="live-status">🔄 ' + (getLang() === "en" ? "Loading live prices…" : "实时物价加载中…") + '</div>' +
          '<div id="liveZone">' + liveSectionsHtml() + '</div>' +
          '<div class="section-title">' + t("secMap") + '</div>' + homeMapCards() +
          homeItemCards() +
          homeSponsors();
      },
      init: function () { refreshLivePrices(); },
    },
    maps: {
      html: function () {
        var rows = (DATA.maps || []).map(function (m) {
          return "<tr><td>" + esc(m.name) + "</td>" +
            '<td class="code" style="font-family:Consolas,monospace;letter-spacing:2px;color:var(--accent-2);font-weight:700">' + esc(m.code) + "</td>" +
            '<td class="r-common">' + esc(m.date) + "</td></tr>";
        }).join("");
        return '<div class="section-title">' + t("secMap") + '</div>' +
          '<div class="card"><table class="tbl"><thead><tr><th>' + (getLang() === "en" ? "Map" : "地图") + '</th><th>' + (getLang() === "en" ? "Code" : "密码") + '</th><th>' + (getLang() === "en" ? "Updated" : "更新") + '</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      },
    },
    items: {
      html: function () {
        return '<div class="section-title">' + t("secItems") + '</div>' + topItemsTable() +
          '<div class="section-title">' + (getLang() === "en" ? "Profit comparison" : "利润对比图") + '</div>' +
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
        return '<div class="section-title">' + t("secBullets") + '</div>' + topBulletsTable((DATA.bullets || []).length);
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
        function renderCraft() {
          if (!window.go) { div.innerHTML = '<p style="padding:20px;color:var(--muted)">制作树引擎加载失败（请检查网络）。</p>'; return; }
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
        }
        // GoJS 体量较大（~3MB），仅在打开“制作树”时按需加载，避免每页都拖慢首屏
        if (!window.go) {
          div.innerHTML = '<p style="padding:20px;color:var(--muted)">正在加载制作树引擎…</p>';
          var s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/gojs@3.0.15/release/go.js";
          s.onload = renderCraft;
          s.onerror = function () { div.innerHTML = '<p style="padding:20px;color:var(--muted)">制作树引擎加载失败（请检查网络）。</p>'; };
          document.head.appendChild(s);
          return;
        }
        renderCraft();
      },
    },
    events: {
      html: function () {
        var ev = DATA.eventItems || {};
        return '<div class="section-title">' + esc(ev.title || t("secEvents")) + "</div>" +
          (ev.period ? '<p class="period">' + (getLang() === "en" ? "Event period: " : "活动时间：") + esc(ev.period) + "</p>" : "") +
          topEventsTable();
      },
    },
    materials: {
      html: function () {
        return '<div class="section-title">' + t("secMaterials") + '</div>' + topMaterialsTable();
      },
    },
    links: {
      html: function () {
        return '<div class="section-title">原站权威数据库（跳转查看）</div>' +
          '<p class="sub">以下为 kkrb.net《三角洲行动一图流》的权威数据入口，点击前往查看完整图鉴与攻略。</p>' +
          '<div class="grid links-grid">' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:干员图鉴", "🪖") + '</span><span>干员图鉴</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:武器数据库", "🔫") + '</span><span>武器数据库</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:改枪方案", "🛠️") + '</span><span>改枪方案</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:地图攻略", "🗺️") + '</span><span>地图攻略</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:游戏百科", "📚") + '</span><span>游戏百科</span><span class="ext">kkrb.net</span></a>' +
            '<a class="link-card" href="https://www.kkrb.net/?viewpage=view%2Foverview" target="_blank" rel="noopener"><span class="ic">' + diIcon("link:一图流首页", "📊") + '</span><span>一图流首页</span><span class="ext">kkrb.net</span></a>' +
          "</div>";
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
    music: {
      html: function () {
        var m = (DATA.music || []);
        if (!m.length) {
          return '<div class="section-title">🎵 音乐台</div>' +
            '<div class="card"><p style="color:var(--muted)">暂无音乐。管理员可在后台「站点配置 → 音乐」添加外部播放链接（如网易云/QQ音乐外链）。</p></div>';
        }
        var rows = m.map(function (t, i) {
          return '<div class="pl-item' + (i === 0 ? " active" : "") + '" data-i="' + i + '">' +
            '<span class="pl-idx">' + (i + 1) + '</span>' +
            '<span class="pl-cover">🎵</span>' +
            '<span class="pl-meta"><span class="pl-name">' + esc(t.name) + '</span><span class="pl-artist">' + esc(t.artist || "未知") + '</span></span>' +
            '<span class="pl-src">' + esc(t.src || "外链") + '</span>' +
          '</div>';
        }).join("");
        return '<div class="section-title">🎵 音乐台</div>' +
          '<div class="card music-now"><div class="mn-label">正在播放（悬浮播放器，跳页不中断）</div><div class="mn-name" id="mnName">—</div></div>' +
          '<div class="section-title">播放列表</div>' +
          '<div class="card"><div class="pl-list" id="plItems">' + rows + '</div></div>' +
          '<p class="craft-hint">点击列表切歌；播放器固定在右下角，刷新或切换到其他页面都会继续播放。</p>';
      },
      init: function () {
        // 通知 music.js 构建悬浮播放器并同步播放列表
        window.dispatchEvent(new CustomEvent("music:render", { detail: DATA.music || [] }));
        var list = document.getElementById("plItems");
        if (!list) return;
        list.querySelectorAll(".pl-item").forEach(function (el) {
          el.addEventListener("click", function () {
            var i = parseInt(el.getAttribute("data-i"), 10);
            window.dispatchEvent(new CustomEvent("music:select", { detail: i }));
            list.querySelectorAll(".pl-item").forEach(function (x) { x.classList.remove("active"); });
            el.classList.add("active");
          });
        });
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
      // 暴露给 music.js / auth.js 等独立脚本消费
      window.DF_DATA = d;
      // 全站图标注册表（美术管理员可在后台上传替换 emoji）
      window.DI_ICONS = (d.icons && typeof d.icons === "object") ? d.icons : {};
      window.dispatchEvent(new CustomEvent("app:data", { detail: d }));
      // 应用总管理员在后台自定义的站点主题色（site.ui）
      if (d.site && d.site.ui) {
        if (d.site.ui.accent) document.documentElement.style.setProperty("--accent", d.site.ui.accent);
        if (d.site.ui.accent2) document.documentElement.style.setProperty("--accent-2", d.site.ui.accent2);
      }
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
