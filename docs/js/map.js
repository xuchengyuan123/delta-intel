/* 互动地图（《三角洲行动》真实地图版 · KK 日报式 2D）
 * 数据驱动：所有地图、标点、物资、路线都在下方 MAPS / LOOT_TYPES 中配置。
 * 功能：多地图切换、难度标签筛选、分类筛选、物资类型筛选、滚轮缩放、拖拽平移、
 *       搜索定位、分层切换、标点物资展示、标点讨论、登录用户添加标点、路线规划。
 */
(function () {
  "use strict";

  var DC = window.DeltaCommon || {};

  // 标点分类：颜色 + 中文名 + 图标
  var CATS = {
    loot:    { label: "物资点", color: "#f5a623", icon: "📦" },
    spawn:   { label: "出生点", color: "#2ecc71", icon: "▶" },
    extract: { label: "撤离点", color: "#3498db", icon: "🚁" },
    boss:    { label: "首领",   color: "#e74c3c", icon: "☠" },
    event:   { label: "事件",   color: "#9b59b6", icon: "⚡" }
  };

  // 物资分类（对齐 KK 日报 一图流细则）
  var LOOT_TYPES = [
    { id: "safe",      name: "保险箱",     icon: "🔒" },
    { id: "safe_s",    name: "小保险箱",   icon: "🔐" },
    { id: "server",    name: "服务器",     icon: "💻" },
    { id: "pc",        name: "电脑机箱",   icon: "🖥" },
    { id: "weapon",    name: "武器箱",     icon: "🔫" },
    { id: "weapon_l",  name: "大武器箱",   icon: "🔫" },
    { id: "ammo",      name: "弹药箱",     icon: "🧨" },
    { id: "tool",      name: "工具柜",     icon: "🧰" },
    { id: "box",       name: "收纳盒",     icon: "📦" },
    { id: "cloth",     name: "一件衣服",   icon: "👕" },
    { id: "medkit",    name: "军用医疗包", icon: "⛑" },
    { id: "med",       name: "医疗物资堆", icon: "🩹" },
    { id: "bag",       name: "旅行包",     icon: "🎒" },
    { id: "case",      name: "手提箱",     icon: "💼" },
    { id: "locker",    name: "储物柜",     icon: "🗄" },
    { id: "safe_h",    name: "高级储物箱", icon: "💎" },
    { id: "drawer",    name: "抽屉柜",     icon: "🗃" },
    { id: "climb",     name: "登山包",     icon: "🎒" },
    { id: "express",   name: "快递箱",     icon: "📭" },
    { id: "airbox",    name: "航空储物箱", icon: "✈" },
    { id: "trash",     name: "垃圾桶",     icon: "🗑" },
    { id: "wild",      name: "野外物资箱", icon: "📦" },
    { id: "stash",     name: "藏匿物",     icon: "💰" },
    { id: "suitcase",  name: "高级旅行箱", icon: "🧳" },
    { id: "coin",      name: "金币堆",     icon: "🪙" },
    { id: "card",      name: "通用房卡",   icon: "🗝" }
  ];

  // ===== 真实地图数据（底图为游戏截图） =====
  var MAPS = [
    {
      id: "dam",
      name: "零号大坝",
      tag: "烽火地带",
      mode: "常规",
      image: "maps/dam-aerial.jpg",
      floors: null,
      points: [
        { x: 20, y: 28, cat: "spawn",   title: "出生点 A", desc: "西侧公路出生，靠近行政辖区。" },
        { x: 72, y: 24, cat: "spawn",   title: "出生点 B", desc: "东侧游客中心出生。" },
        { x: 40, y: 52, cat: "loot",    title: "行政辖区·主保险箱", desc: "主楼二层，需房卡开启。", loot: ["保险箱", "服务器", "高级储物箱"] },
        { x: 36, y: 60, cat: "loot",    title: "行政辖区·抽屉柜", desc: "办公区，常出房卡。", loot: ["抽屉柜", "小保险箱", "通用房卡"] },
        { x: 56, y: 60, cat: "loot",    title: "水泥厂·武器箱", desc: "厂区中央集装箱堆。", loot: ["武器箱", "大武器箱", "弹药箱"] },
        { x: 48, y: 44, cat: "loot",    title: "主变电站·服务器", desc: "高价值区，守卫多。", loot: ["服务器", "电脑机箱", "工具柜"] },
        { x: 64, y: 70, cat: "loot",    title: "游客中心·储物柜", desc: "大厅与休息区。", loot: ["储物柜", "手提箱", "一件衣服"] },
        { x: 30, y: 74, cat: "loot",    title: "管道区域·野外箱", desc: "管网夹层。", loot: ["野外物资箱", "收纳盒", "工具柜"] },
        { x: 50, y: 82, cat: "loot",    title: "大坝底·藏匿物", desc: "暗格，随机刷金币。", loot: ["藏匿物", "金币堆", "高级旅行箱"] },
        { x: 33, y: 70, cat: "extract", title: "常规撤离点", desc: "大坝下方码头，直接撤离。" },
        { x: 82, y: 74, cat: "extract", title: "付费撤离点", desc: "消耗筹码 / 现金撤离。" },
        { x: 58, y: 38, cat: "boss",    title: "首领·阿萨拉卫队", desc: "行政辖区附近巡逻。" },
        { x: 62, y: 50, cat: "event",   title: "坠机事件", desc: "随机刷新，物资丰厚。", loot: ["高级储物箱", "武器箱", "医疗物资堆"] }
      ]
    },
    {
      id: "dam-detail",
      name: "零号大坝（局部）",
      tag: "详情视图",
      mode: "常规",
      image: "maps/dam-detail-1.jpg",
      floors: null,
      points: [
        { x: 50, y: 46, cat: "loot", title: "主变电站机房", desc: "服务器机柜，高价值。", loot: ["服务器", "电脑机箱", "保险箱"] },
        { x: 30, y: 64, cat: "loot", title: "集装箱堆", desc: "武器箱与弹药。", loot: ["武器箱", "弹药箱", "大武器箱"] },
        { x: 70, y: 30, cat: "extract", title: "侧门撤离", desc: "小概率撤离点。" }
      ]
    },
    {
      id: "building",
      name: "行政辖区（分层）",
      tag: "室内 · 1F-4F",
      mode: "常规",
      image: "maps/building-floors.jpg",
      floors: [
        { name: "1F", image: "maps/building-floors.jpg", points: [{ x: 50, y: 54, cat: "loot", title: "一楼大厅前台", desc: "前台抽屉 + 储物柜。", loot: ["抽屉柜", "储物柜", "通用房卡"] }] },
        { name: "2F", image: "maps/building-floors.jpg", points: [{ x: 46, y: 46, cat: "loot", title: "二楼办公室", desc: "电脑与高级箱。", loot: ["电脑机箱", "高级储物箱", "保险箱"] }] },
        { name: "3F", image: "maps/building-floors.jpg", points: [{ x: 56, y: 40, cat: "loot", title: "三楼机房", desc: "服务器机柜。", loot: ["服务器", "电脑机箱"] }] },
        { name: "4F", image: "maps/building-floors.jpg", points: [{ x: 50, y: 34, cat: "boss", title: "楼顶首领", desc: "狙击手 / 重甲首领驻守。", loot: ["保险箱"] }] }
      ]
    },
    {
      id: "nuclear",
      name: "核电站",
      tag: "烽火地带",
      mode: "机密",
      image: "maps/nuclear-site.jpg",
      floors: null,
      points: [
        { x: 50, y: 42, cat: "loot",    title: "反应堆核心·高级箱", desc: "辐射区边缘，极高价值。", loot: ["高级储物箱", "保险箱", "藏匿物"] },
        { x: 34, y: 30, cat: "loot",    title: "控制室·服务器", desc: "控制台 + 服务器。", loot: ["服务器", "电脑机箱", "工具柜"] },
        { x: 66, y: 56, cat: "loot",    title: "医疗站", desc: "军用医疗物资。", loot: ["军用医疗包", "医疗物资堆", "收纳盒"] },
        { x: 44, y: 66, cat: "loot",    title: "武器库", desc: "大武器箱集中地。", loot: ["大武器箱", "武器箱", "弹药箱"] },
        { x: 24, y: 36, cat: "loot",    title: "废料区·野外箱", desc: "边缘随机物资。", loot: ["野外物资箱", "快递箱"] },
        { x: 30, y: 28, cat: "spawn",   title: "西侧出生点", desc: "靠近废料处理厂。" },
        { x: 76, y: 62, cat: "extract", title: "水下撤离点", desc: "条件撤离。" },
        { x: 55, y: 34, cat: "boss",    title: "首领·RBMK", desc: "反应堆核心区域。" }
      ]
    }
  ];

  // ===== 状态 =====
  var state = {
    map: null, floor: 0, scale: 1, tx: 0, ty: 0,
    filters: {}, modes: {}, lootFilter: {}, sel: null, q: "",
    addMode: false, routeMode: false
  };
  var layer, stage, popup, myMarkers = [], routes = {};
  var MY_KEY = "di_map_markers", ROUTE_KEY = "di_map_routes";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
    });
  }

  function loadMyMarkers() {
    try { myMarkers = JSON.parse(localStorage.getItem(MY_KEY) || "[]"); } catch (e) { myMarkers = []; }
  }
  function saveMyMarkers() { try { localStorage.setItem(MY_KEY, JSON.stringify(myMarkers)); } catch (e) {} }
  function loadRoutes() {
    try { routes = JSON.parse(localStorage.getItem(ROUTE_KEY) || "{}"); } catch (e) { routes = {}; }
  }
  function saveRoutes() { try { localStorage.setItem(ROUTE_KEY, JSON.stringify(routes)); } catch (e) {} }

  function init() {
    layer = $("mapLayer"); stage = $("mapStage"); popup = $("mapPopup");
    loadMyMarkers(); loadRoutes();
    Object.keys(CATS).forEach(function (k) { state.filters[k] = true; });
    MAPS.forEach(function (m) { state.modes[m.mode] = true; });
    renderModes();
    renderTabs();
    renderFilters();
    renderLootFilters();
    loadMap(MAPS[0]);
    bindEvents();
    renderAddMode();
    renderRouteMode();
  }

  function visibleMaps() {
    return MAPS.filter(function (m) { return state.modes[m.mode]; });
  }

  function renderModes() {
    var box = $("mapModes"); if (!box) return; box.innerHTML = "";
    var modes = [];
    MAPS.forEach(function (m) { if (modes.indexOf(m.mode) < 0) modes.push(m.mode); });
    modes.forEach(function (mode) {
      var b = document.createElement("button");
      b.className = "map-mode" + (state.modes[mode] ? " active" : "");
      b.textContent = mode;
      b.addEventListener("click", function () {
        state.modes[mode] = !state.modes[mode];
        if (!visibleMaps().length) state.modes[mode] = true; // 至少留一个
        renderModes(); renderTabs();
      });
      box.appendChild(b);
    });
  }

  function renderTabs() {
    var box = $("mapTabs"); box.innerHTML = "";
    visibleMaps().forEach(function (m) {
      var b = document.createElement("button");
      b.className = "map-tab" + (state.map === m ? " active" : "");
      b.innerHTML = '<span class="mt-name">' + esc(m.name) + '</span><span class="mt-tag">' + esc(m.tag || "") + "</span>";
      b.addEventListener("click", function () { loadMap(m); });
      box.appendChild(b);
    });
    // 当前地图可能被模式过滤掉，则切到第一个可见
    if (!visibleMaps().some(function (m) { return m === state.map; }) && visibleMaps()[0]) loadMap(visibleMaps()[0]);
  }

  function renderFilters() {
    var box = $("mapFilters"); box.innerHTML = "";
    Object.keys(CATS).forEach(function (k) {
      var c = CATS[k];
      var label = document.createElement("label");
      label.className = "map-filter";
      label.innerHTML = '<input type="checkbox" ' + (state.filters[k] ? "checked" : "") + ' data-cat="' + k + '"><span class="dot" style="background:' + c.color + '"></span>' + esc(c.label);
      label.querySelector("input").addEventListener("change", function (e) {
        state.filters[k] = e.target.checked; renderMarkers(); renderList();
      });
      box.appendChild(label);
    });
  }

  function renderLootFilters() {
    var box = $("mapLootFilters"); if (!box) return; box.innerHTML = "";
    LOOT_TYPES.forEach(function (l) {
      var b = document.createElement("button");
      b.className = "map-loot-filter" + (state.lootFilter[l.name] ? " active" : "");
      b.innerHTML = (l.icon ? l.icon + " " : "") + esc(l.name);
      b.addEventListener("click", function () {
        if (state.lootFilter[l.name]) delete state.lootFilter[l.name];
        else state.lootFilter[l.name] = true;
        renderLootFilters(); renderMarkers(); renderList();
      });
      box.appendChild(b);
    });
  }

  function loadMap(m) {
    state.map = m; state.floor = 0; state.scale = 1; state.tx = 0; state.ty = 0; state.sel = null;
    renderTabs();
    renderFloors();
    applyTransform();
    renderMarkers();
    renderRoute();
    renderList();
    hidePopup();
    $("mapLegend").textContent = state.routeMode
      ? "路线规划中：在地图上依次点击添加路线点；点路线点可删除。"
      : "点击标点或列表项查看物资与讨论；登录后可在地图上点击添加标点。";
  }

  function currentPoints() {
    var m = state.map; if (!m) return [];
    var base = m.floors && m.floors[state.floor] ? m.floors[state.floor].points || [] : m.points || [];
    var my = myMarkers.filter(function (p) { return p.mapId === m.id && p.floor == state.floor; });
    return base.concat(my);
  }
  function currentImage() {
    var m = state.map; if (!m) return "";
    if (m.floors && m.floors[state.floor]) return m.floors[state.floor].image || "";
    return m.image || "";
  }

  function renderFloors() {
    var box = $("mapFloors"); box.innerHTML = "";
    var m = state.map;
    if (m && m.floors && m.floors.length) {
      m.floors.forEach(function (f, i) {
        var b = document.createElement("button");
        b.className = "map-floor" + (i === state.floor ? " active" : "");
        b.textContent = f.name;
        b.addEventListener("click", function () {
          state.floor = i; state.scale = 1; state.tx = 0; state.ty = 0;
          applyTransform(); renderMarkers(); renderRoute(); renderList(); renderFloors();
        });
        box.appendChild(b);
      });
      box.style.display = "";
    } else {
      box.style.display = "none";
    }
  }

  function setImage() {
    var img = currentImage();
    if (img) {
      layer.classList.remove("noimg");
      layer.style.backgroundImage = "url('" + img + "')";
      layer.style.backgroundSize = "100% 100%";
    } else {
      layer.classList.add("noimg");
      layer.style.backgroundImage = "none";
    }
  }

  function matchFilters(p) {
    if (!state.filters[p.cat]) return false;
    if (Object.keys(state.lootFilter).length) {
      var loot = p.loot || [];
      if (!loot.some(function (l) { return state.lootFilter[l]; })) return false;
    }
    return true;
  }

  function renderMarkers() {
    setImage();
    Array.prototype.slice.call(layer.querySelectorAll(".map-marker")).forEach(function (n) { n.remove(); });
    currentPoints().forEach(function (p) {
      if (!matchFilters(p)) return;
      var cat = CATS[p.cat] || CATS.loot;
      var mk = document.createElement("button");
      mk.className = "map-marker cat-" + p.cat + (p.isUser ? " user" : "");
      mk.style.left = p.x + "%";
      mk.style.top = p.y + "%";
      mk.style.background = cat.color;
      mk.title = p.title;
      mk.innerHTML = '<span class="mk-icon">' + (cat.icon || "") + '</span>';
      mk.addEventListener("click", function (e) { e.stopPropagation(); selectPoint(p); });
      layer.appendChild(mk);
    });
    renderRoute();
  }

  function renderList() {
    var box = $("mapList"); box.innerHTML = "";
    var pts = currentPoints().filter(matchFilters);
    var q = state.q.trim().toLowerCase();
    if (q) pts = pts.filter(function (p) {
      return (p.title + " " + (p.desc || "") + " " + (p.loot || []).join(" ")).toLowerCase().indexOf(q) >= 0;
    });
    if (!pts.length) { box.innerHTML = '<p class="map-empty">无匹配标点</p>'; return; }
    var groups = {};
    pts.forEach(function (p) { (groups[p.cat] = groups[p.cat] || []).push(p); });
    Object.keys(groups).forEach(function (cat) {
      var h = document.createElement("div");
      h.className = "map-list-cat";
      h.innerHTML = '<span class="dot" style="background:' + CATS[cat].color + '"></span>' + esc(CATS[cat].label) + ' <span class="cnt">' + groups[cat].length + "</span>";
      box.appendChild(h);
      groups[cat].forEach(function (p) {
        var it = document.createElement("button");
        it.className = "map-list-item" + (p.isUser ? " user" : "");
        it.innerHTML = '<span class="li-title">' + esc(p.title) + (p.isUser ? ' <span class="user-tag">我</span>' : '') + "</span>" + (p.desc ? '<span class="li-desc">' + esc(p.desc) + "</span>" : "") + (p.loot && p.loot.length ? '<span class="li-loot">' + p.loot.map(function (l) { return '<span class="pill">' + esc(l) + '</span>'; }).join("") + '</span>' : "");
        it.addEventListener("click", function () { selectPoint(p, true); });
        box.appendChild(it);
      });
    });
  }

  function selectPoint(p, fly) {
    state.sel = p;
    showPopup(p);
    if (fly) flyTo(p);
  }

  function showPopup(p) {
    var cat = CATS[p.cat] || CATS.loot;
    popup.style.display = "";
    $("popupCat").textContent = cat.label;
    $("popupCat").style.background = cat.color;
    $("popupTitle").textContent = p.title;
    $("popupDesc").textContent = p.desc || "";

    var lootBox = $("popupLoot");
    if (p.loot && p.loot.length) {
      lootBox.innerHTML = p.loot.map(function (l) { return '<span class="map-loot-pill">' + esc(l) + '</span>'; }).join("");
      lootBox.style.display = "";
    } else {
      lootBox.style.display = "none"; lootBox.innerHTML = "";
    }

    var cmtBox = $("popupComments");
    cmtBox.style.display = "none"; cmtBox.innerHTML = '';

    $("popupDiscuss").onclick = function () {
      cmtBox.style.display = cmtBox.style.display === "none" ? "" : "none";
      if (cmtBox.style.display !== "none" && cmtBox.innerHTML === '') {
        cmtBox.innerHTML = '<div data-target="map:' + esc(state.map.id) + ':' + esc(pointId(p)) + '" id="mapCmtWrap"></div>';
        if (DC.mountComments) DC.mountComments(document.getElementById("mapCmtWrap"));
      }
    };

    var delBtn = $("popupDelete");
    if (p.isUser) {
      delBtn.style.display = "";
      delBtn.onclick = function () {
        if (!confirm("删除这个自定义标点？")) return;
        myMarkers = myMarkers.filter(function (m) { return !(m.mapId === p.mapId && m.x === p.x && m.y === p.y && m.title === p.title); });
        saveMyMarkers(); renderMarkers(); renderList(); hidePopup();
      };
    } else {
      delBtn.style.display = "none";
    }
  }

  function pointId(p) {
    return String(p.title).replace(/[^\w\u4e00-\u9fa5]/g, "_") + "_" + Math.round(p.x) + "_" + Math.round(p.y);
  }

  function hidePopup() { popup.style.display = "none"; state.sel = null; $("popupComments").style.display = "none"; $("popupComments").innerHTML = ""; }

  function applyTransform() {
    layer.style.transform = "translate(" + state.tx + "px," + state.ty + "px) scale(" + state.scale + ")";
  }

  function zoom(d) {
    state.scale = Math.min(4, Math.max(0.5, state.scale * d));
    applyTransform();
  }

  function flyTo(p) {
    var W = stage.clientWidth, H = stage.clientHeight;
    state.scale = Math.max(state.scale, 1.4);
    state.tx = -(p.x / 100 - 0.5) * W * state.scale;
    state.ty = -(p.y / 100 - 0.5) * H * state.scale;
    applyTransform();
  }

  function clientToPercent(e) {
    var rect = stage.getBoundingClientRect();
    var x = (e.clientX - rect.left - state.tx) / state.scale / rect.width * 100;
    var y = (e.clientY - rect.top - state.ty) / state.scale / rect.height * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function renderAddMode() {
    var btn = $("addModeBtn");
    if (!btn) return;
    btn.textContent = state.addMode ? "✏️ 添加中…" : "➕ 添加标点";
    btn.classList.toggle("active", state.addMode);
  }
  function renderRouteMode() {
    var btn = $("routeBtn");
    if (!btn) return;
    btn.textContent = state.routeMode ? "🧭 路线中…" : "🧭 规划路线";
    btn.classList.toggle("active", state.routeMode);
    var clr = $("routeClear");
    if (clr) clr.style.display = (routes[state.map ? state.map.id : ""] && routes[state.map.id].length) ? "" : "none";
  }

  function openAddForm(pt) {
    var form = $("addMarkerForm");
    form.style.display = "";
    $("addMarkerX").value = Math.round(pt.x * 10) / 10;
    $("addMarkerY").value = Math.round(pt.y * 10) / 10;
    $("addMarkerTitle").value = "";
    $("addMarkerDesc").value = "";
    $("addMarkerCat").value = "loot";
    renderLootCheckboxes([]);
    $("addMarkerTitle").focus();
  }

  function renderLootCheckboxes(selected) {
    var box = $("addMarkerLoot");
    selected = selected || [];
    box.innerHTML = LOOT_TYPES.map(function (l) {
      return '<label class="loot-check"><input type="checkbox" value="' + esc(l.name) + '"' + (selected.indexOf(l.name) >= 0 ? " checked" : "") + '>' + esc(l.name) + '</label>';
    }).join("");
  }

  function submitMarker() {
    var title = $("addMarkerTitle").value.trim();
    var desc = $("addMarkerDesc").value.trim();
    var cat = $("addMarkerCat").value;
    var x = parseFloat($("addMarkerX").value);
    var y = parseFloat($("addMarkerY").value);
    if (!title) { alert("请输入标点名称"); return; }
    var loot = Array.prototype.slice.call($("addMarkerLoot").querySelectorAll("input:checked")).map(function (i) { return i.value; });
    var marker = { mapId: state.map.id, floor: state.floor, x: x, y: y, cat: cat, title: title, desc: desc, loot: loot, isUser: true };
    myMarkers.push(marker);
    saveMyMarkers();
    $("addMarkerForm").style.display = "none";
    renderMarkers(); renderList(); selectPoint(marker, true);

    if (DC.api && DC.isLogin && DC.isLogin()) {
      DC.api("/api/ugc", { method: "POST", body: JSON.stringify({
        title: "地图标点补充：" + title,
        body: "地图：" + state.map.name + "\n坐标：(" + x + ", " + y + ")\n分类：" + (CATS[cat] && CATS[cat].label) + "\n描述：" + desc + "\n物资：" + loot.join("、"),
        type: "map-marker"
      }) }).then(function () { console.log("标点已提交审核"); }).catch(function (e) { console.error("UGC 提交失败", e); });
    }
  }

  // ===== 路线规划 =====
  function addWaypoint(pt) {
    var id = state.map.id;
    if (!routes[id]) routes[id] = [];
    routes[id].push({ x: pt.x, y: pt.y });
    saveRoutes(); renderRoute(); renderRouteMode();
  }
  function removeWaypoint(i) {
    var id = state.map.id;
    if (routes[id]) { routes[id].splice(i, 1); saveRoutes(); renderRoute(); renderRouteMode(); }
  }
  function clearRoute() {
    var id = state.map.id;
    routes[id] = []; saveRoutes(); renderRoute(); renderRouteMode();
  }
  function renderRoute() {
    if (!layer) return;
    var svg = layer.querySelector(".map-route");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "map-route");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      layer.appendChild(svg);
    }
    svg.innerHTML = "";
    Array.prototype.slice.call(layer.querySelectorAll(".map-waypoint")).forEach(function (n) { n.remove(); });
    var r = (state.map && routes[state.map.id]) || [];
    if (r.length) {
      var pl = document.createElementNS(svg.namespaceURI, "polyline");
      pl.setAttribute("points", r.map(function (p) { return p.x + "," + p.y; }).join(" "));
      pl.setAttribute("class", "route-line");
      pl.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(pl);
      r.forEach(function (p, i) {
        var w = document.createElement("div");
        w.className = "map-waypoint";
        w.style.left = p.x + "%"; w.style.top = p.y + "%";
        w.textContent = i + 1;
        w.title = "点击删除此路线点";
        w.addEventListener("click", function (e) { e.stopPropagation(); removeWaypoint(i); });
        layer.appendChild(w);
      });
    }
  }

  function bindEvents() {
    $("zoomIn").addEventListener("click", function () { zoom(1.2); });
    $("zoomOut").addEventListener("click", function () { zoom(1 / 1.2); });
    $("zoomReset").addEventListener("click", function () { state.scale = 1; state.tx = 0; state.ty = 0; applyTransform(); });
    $("popupClose").addEventListener("click", hidePopup);
    $("mapSearch").addEventListener("input", function (e) { state.q = e.target.value; renderList(); });

    $("addModeBtn").addEventListener("click", function () {
      state.addMode = !state.addMode;
      if (state.addMode) { state.routeMode = false; renderRouteMode(); }
      renderAddMode();
    });
    $("routeBtn").addEventListener("click", function () {
      state.routeMode = !state.routeMode;
      if (state.routeMode) { state.addMode = false; renderAddMode(); }
      renderRouteMode();
      $("mapLegend").textContent = state.routeMode
        ? "路线规划中：在地图上依次点击添加路线点；点路线点可删除。"
        : "点击标点或列表项查看物资与讨论；登录后可在地图上点击添加标点。";
    });
    $("routeClear").addEventListener("click", clearRoute);
    $("addMarkerCancel").addEventListener("click", function () { $("addMarkerForm").style.display = "none"; });
    $("addMarkerSubmit").addEventListener("click", submitMarker);

    stage.addEventListener("wheel", function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });

    var dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    stage.addEventListener("mousedown", function (e) {
      if (state.addMode) {
        var pt = clientToPercent(e); openAddForm(pt); state.addMode = false; renderAddMode(); return;
      }
      if (state.routeMode) {
        var rp = clientToPercent(e); addWaypoint(rp); return;
      }
      dragging = true; sx = e.clientX; sy = e.clientY; stx = state.tx; sty = state.ty;
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      state.tx = stx + (e.clientX - sx); state.ty = sty + (e.clientY - sy); applyTransform();
    });
    window.addEventListener("mouseup", function () { dragging = false; });

    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) { dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; stx = state.tx; sty = state.ty; }
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (dragging && e.touches.length === 1) {
        state.tx = stx + (e.touches[0].clientX - sx); state.ty = sty + (e.touches[0].clientY - sy); applyTransform(); e.preventDefault();
      }
    }, { passive: false });
    stage.addEventListener("touchend", function () { dragging = false; });

    stage.addEventListener("click", function (e) {
      if (e.target === stage || e.target === layer) {
        if (state.routeMode) { var rp = clientToPercent(e); addWaypoint(rp); }
        else hidePopup();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
