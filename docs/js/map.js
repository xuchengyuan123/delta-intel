/* 互动地图（《三角洲行动》真实地图版）
 * 数据驱动：所有地图、标点、物资都在下方 MAPS 中配置。
 * 功能：多地图切换、滚轮缩放、拖拽平移、分类筛选、搜索定位、物资展示、标点讨论、登录用户添加标点。
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

  // 物资分类（参考用户提供的物资图标）
  var LOOT_TYPES = [
    { id: "safe",     name: "保险箱", icon: "🔒" },
    { id: "server",   name: "服务器", icon: "💻" },
    { id: "weapon",   name: "武器箱", icon: "🔫" },
    { id: "ammo",     name: "弹药箱", icon: "🧨" },
    { id: "tool",     name: "工具柜", icon: "🧰" },
    { id: "medical",  name: "医疗物资", icon: "🧰" },
    { id: "bag",      name: "背包/登山包", icon: "🎒" },
    { id: "nest",     name: "鸟窝", icon: "🪺" },
    { id: "trash",    name: "垃圾桶", icon: "🗑" },
    { id: "computer", name: "电脑/机箱", icon: "🖥" },
    { id: "high",     name: "高级储物箱", icon: "💼" },
    { id: "key",      name: "钥匙/房卡", icon: "🗝" }
  ];

  // ===== 真实地图数据（替换为游戏截图） =====
  var MAPS = [
    {
      id: "dam",
      name: "零号大坝",
      tag: "烽火地带 · 常规",
      image: "maps/dam-aerial.jpg",
      floors: null,
      points: [
        { x: 22, y: 30, cat: "spawn",   title: "出生点 A", desc: "西侧公路出生，靠近行政辖区。" },
        { x: 70, y: 25, cat: "spawn",   title: "出生点 B", desc: "东侧游客中心出生。" },
        { x: 40, y: 55, cat: "loot",    title: "行政辖区·保险箱", desc: "主楼二层，需房卡开启。", loot: ["保险箱", "服务器", "高级储物箱"] },
        { x: 55, y: 62, cat: "loot",    title: "水泥厂·武器箱", desc: "厂区中央集装箱堆。", loot: ["武器箱", "弹药箱", "工具柜"] },
        { x: 33, y: 70, cat: "extract", title: "常规撤离点", desc: "大坝下方码头，直接撤离。" },
        { x: 80, y: 72, cat: "extract", title: "付费撤离点", desc: "消耗筹码 / 现金撤离。" },
        { x: 50, y: 38, cat: "boss",    title: "首领·阿萨拉卫队", desc: "行政辖区附近巡逻。" },
        { x: 62, y: 48, cat: "event",   title: "坠机事件", desc: "随机刷新，物资丰厚。", loot: ["高级储物箱", "武器箱"] }
      ]
    },
    {
      id: "dam-detail",
      name: "零号大坝（局部）",
      tag: "详情视图",
      image: "maps/dam-detail-1.jpg",
      floors: null,
      points: [
        { x: 50, y: 50, cat: "loot", title: "主变电站", desc: "高价值区域，常有保险箱。", loot: ["保险箱", "服务器"] }
      ]
    },
    {
      id: "building",
      name: "分层建筑",
      tag: "室内 · 1F-4F",
      image: "maps/building-floors.jpg",
      floors: [
        { name: "1F", image: "maps/building-floors.jpg", points: [{ x: 50, y: 50, cat: "loot", title: "一楼大厅物资", desc: "前台附近。", loot: ["工具柜", "垃圾桶"] }] },
        { name: "2F", image: "maps/building-floors.jpg", points: [{ x: 45, y: 45, cat: "loot", title: "二楼办公室", desc: "抽屉柜 + 电脑。", loot: ["电脑/机箱", "高级储物箱"] }] },
        { name: "3F", image: "maps/building-floors.jpg", points: [{ x: 55, y: 40, cat: "loot", title: "三楼机房", desc: "服务器机柜。", loot: ["服务器"] }] },
        { name: "4F", image: "maps/building-floors.jpg", points: [{ x: 50, y: 35, cat: "boss", title: "楼顶首领", desc: "狙击手/重甲首领。" }] }
      ]
    },
    {
      id: "nuclear",
      name: "核电站",
      tag: "烽火地带 · 机密",
      image: "maps/nuclear-site.jpg",
      floors: null,
      points: [
        { x: 50, y: 45, cat: "loot", title: "反应堆周边", desc: "辐射区边缘，高价值物资。", loot: ["高级储物箱", "工具柜", "医疗物资"] },
        { x: 30, y: 30, cat: "spawn", title: "西侧出生点", desc: "靠近废料处理厂。" },
        { x: 75, y: 60, cat: "extract", title: "水下撤离点", desc: "条件撤离。" },
        { x: 55, y: 35, cat: "boss", title: "首领·RBMK", desc: "反应堆核心区域。" }
      ]
    }
  ];

  // ===== 状态 =====
  var state = { map: null, floor: 0, scale: 1, tx: 0, ty: 0, filters: {}, sel: null, q: "", addMode: false };
  var layer, stage, popup, myMarkers = [];
  var MY_KEY = "di_map_markers";

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

  function init() {
    layer = $("mapLayer"); stage = $("mapStage"); popup = $("mapPopup");
    loadMyMarkers();
    Object.keys(CATS).forEach(function (k) { state.filters[k] = true; });
    renderTabs();
    renderFilters();
    loadMap(MAPS[0]);
    bindEvents();
    renderAddMode();
  }

  function renderTabs() {
    var box = $("mapTabs"); box.innerHTML = "";
    MAPS.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "map-tab" + (state.map === m ? " active" : "");
      b.innerHTML = '<span class="mt-name">' + esc(m.name) + '</span><span class="mt-tag">' + esc(m.tag || "") + "</span>";
      b.addEventListener("click", function () { loadMap(m); });
      box.appendChild(b);
    });
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

  function loadMap(m) {
    state.map = m; state.floor = 0; state.scale = 1; state.tx = 0; state.ty = 0; state.sel = null;
    renderTabs();
    renderFloors();
    applyTransform();
    renderMarkers();
    renderList();
    hidePopup();
    $("mapLegend").textContent = "点击标点或列表项查看物资/讨论；登录后可在地图上右键添加标点。";
  }

  function currentPoints() {
    var m = state.map; if (!m) return [];
    var base = m.floors && m.floors[state.floor] ? m.floors[state.floor].points || [] : m.points || [];
    // 追加用户自定义标点（仅当前地图）
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
          applyTransform(); renderMarkers(); renderList(); renderFloors();
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

  function renderMarkers() {
    setImage();
    Array.prototype.slice.call(layer.querySelectorAll(".map-marker")).forEach(function (n) { n.remove(); });
    currentPoints().forEach(function (p, i) {
      if (!state.filters[p.cat]) return;
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
  }

  function renderList() {
    var box = $("mapList"); box.innerHTML = "";
    var pts = currentPoints().filter(function (p) { return state.filters[p.cat]; });
    var q = state.q.trim().toLowerCase();
    if (q) pts = pts.filter(function (p) { return (p.title + " " + (p.desc || "") + " " + (p.loot || []).join(" ")).toLowerCase().indexOf(q) >= 0; });
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

    // 物资列表
    var lootBox = $("popupLoot");
    if (p.loot && p.loot.length) {
      lootBox.innerHTML = p.loot.map(function (l) { return '<span class="map-loot-pill">' + esc(l) + '</span>'; }).join("");
      lootBox.style.display = "";
    } else {
      lootBox.style.display = "none";
      lootBox.innerHTML = "";
    }

    // 讨论区
    var cmtBox = $("popupComments");
    cmtBox.style.display = "none";
    cmtBox.innerHTML = '';

    // 讨论按钮
    $("popupDiscuss").onclick = function () {
      cmtBox.style.display = cmtBox.style.display === "none" ? "" : "none";
      if (cmtBox.style.display !== "none" && cmtBox.innerHTML === '') {
        cmtBox.innerHTML = '<div data-target="map:' + esc(state.map.id) + ':' + esc(pointId(p)) + '" id="mapCmtWrap"></div>';
        if (DC.mountComments) DC.mountComments(document.getElementById("mapCmtWrap"));
      }
    };

    // 删除我的标点
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

    // 同时提交 UGC 供管理员审核
    if (DC.api && DC.isLogin && DC.isLogin()) {
      DC.api("/api/ugc", { method: "POST", body: JSON.stringify({
        title: "地图标点补充：" + title,
        body: "地图：" + state.map.name + "\n坐标：(" + x + ", " + y + ")\n分类：" + (CATS[cat] && CATS[cat].label) + "\n描述：" + desc + "\n物资：" + loot.join("、"),
        type: "map-marker"
      }) }).then(function () { console.log("标点已提交审核"); }).catch(function (e) { console.error("UGC 提交失败", e); });
    }
  }

  function bindEvents() {
    $("zoomIn").addEventListener("click", function () { zoom(1.2); });
    $("zoomOut").addEventListener("click", function () { zoom(1 / 1.2); });
    $("zoomReset").addEventListener("click", function () { state.scale = 1; state.tx = 0; state.ty = 0; applyTransform(); });
    $("popupClose").addEventListener("click", hidePopup);
    $("mapSearch").addEventListener("input", function (e) { state.q = e.target.value; renderList(); });

    $("addModeBtn").addEventListener("click", function () { state.addMode = !state.addMode; renderAddMode(); });
    $("addMarkerCancel").addEventListener("click", function () { $("addMarkerForm").style.display = "none"; });
    $("addMarkerSubmit").addEventListener("click", submitMarker);

    // 滚轮缩放
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    // 鼠标拖拽平移
    var dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    stage.addEventListener("mousedown", function (e) {
      if (state.addMode) {
        var pt = clientToPercent(e);
        openAddForm(pt); state.addMode = false; renderAddMode();
        return;
      }
      dragging = true; sx = e.clientX; sy = e.clientY; stx = state.tx; sty = state.ty;
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      state.tx = stx + (e.clientX - sx); state.ty = sty + (e.clientY - sy); applyTransform();
    });
    window.addEventListener("mouseup", function () { dragging = false; });

    // 触摸拖拽
    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) { dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; stx = state.tx; sty = state.ty; }
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (dragging && e.touches.length === 1) {
        state.tx = stx + (e.touches[0].clientX - sx); state.ty = sty + (e.touches[0].clientY - sy); applyTransform(); e.preventDefault();
      }
    }, { passive: false });
    stage.addEventListener("touchend", function () { dragging = false; });

    // 点击空白处关闭弹窗
    stage.addEventListener("click", function (e) {
      if (e.target === stage || e.target === layer) hidePopup();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
