/* 互动地图（仿《三角洲行动》官方地图工具）
 * 数据驱动：所有地图与标点都在下方 MAPS 里配置。
 *   x / y 为相对地图的百分比（0~100），cat 决定颜色与分类。
 *   image 留空 → 使用内置战术网格底图；填入图片 URL 即用真实地图。
 *   floors 留空 → 单层；填入数组 → 开启分层切换（每层可有自己的 image + points）。
 */
(function () {
  "use strict";

  // 标点分类：颜色 + 中文名
  var CATS = {
    loot:    { label: "物资点", color: "#f5a623" },
    spawn:   { label: "出生点", color: "#2ecc71" },
    extract: { label: "撤离点", color: "#3498db" },
    boss:    { label: "首领",   color: "#e74c3c" },
    event:   { label: "事件",   color: "#9b59b6" }
  };

  // ===== 示例数据（替换为真实地图图与坐标即可） =====
  var MAPS = [
    {
      id: "dam",
      name: "零号大坝",
      tag: "烽火地带 · 常规",
      image: "",
      floors: null,
      points: [
        { x: 22, y: 30, cat: "spawn",   title: "出生点 A", desc: "西侧公路出生，靠近行政辖区。" },
        { x: 70, y: 25, cat: "spawn",   title: "出生点 B", desc: "东侧游客中心出生。" },
        { x: 40, y: 55, cat: "loot",    title: "行政辖区·保险箱", desc: "主楼二层，需房卡开启。" },
        { x: 55, y: 62, cat: "loot",    title: "水泥厂·武器箱", desc: "厂区中央集装箱堆。" },
        { x: 33, y: 70, cat: "extract", title: "常规撤离点", desc: "大坝下方码头，直接撤离。" },
        { x: 80, y: 72, cat: "extract", title: "付费撤离点", desc: "消耗筹码 / 现金撤离。" },
        { x: 50, y: 38, cat: "boss",    title: "首领·阿萨拉卫队", desc: "行政辖区附近巡逻。" },
        { x: 62, y: 48, cat: "event",   title: "坠机事件", desc: "随机刷新，物资丰厚。" }
      ]
    },
    {
      id: "valley",
      name: "长弓溪谷",
      tag: "烽火地带 · 机密",
      image: "",
      floors: null,
      points: [
        { x: 30, y: 40, cat: "spawn",   title: "出生点", desc: "溪谷北口。" },
        { x: 58, y: 52, cat: "loot",    title: "钻石皇后酒店·服务器", desc: "顶层机房，高价值。" },
        { x: 45, y: 66, cat: "extract", title: "概率撤离点", desc: "需满足触发条件。" },
        { x: 70, y: 35, cat: "boss",    title: "首领·卫队指挥", desc: "酒店区域驻守。" }
      ]
    }
  ];

  // ===== 状态 =====
  var state = { map: null, floor: 0, scale: 1, tx: 0, ty: 0, filters: {}, sel: null, q: "" };
  var layer, stage, popup;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function init() {
    layer = $("mapLayer"); stage = $("mapStage"); popup = $("mapPopup");
    Object.keys(CATS).forEach(function (k) { state.filters[k] = true; });
    renderTabs();
    renderFilters();
    loadMap(MAPS[0]);
    bindEvents();
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
  }

  function currentPoints() {
    var m = state.map; if (!m) return [];
    if (m.floors && m.floors[state.floor]) return m.floors[state.floor].points || [];
    return m.points || [];
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
      var mk = document.createElement("button");
      mk.className = "map-marker cat-" + p.cat;
      mk.style.left = p.x + "%";
      mk.style.top = p.y + "%";
      mk.title = p.title;
      mk.addEventListener("click", function (e) { e.stopPropagation(); selectPoint(p); });
      layer.appendChild(mk);
    });
  }

  function renderList() {
    var box = $("mapList"); box.innerHTML = "";
    var pts = currentPoints().filter(function (p) { return state.filters[p.cat]; });
    var q = state.q.trim().toLowerCase();
    if (q) pts = pts.filter(function (p) { return (p.title + " " + (p.desc || "")).toLowerCase().indexOf(q) >= 0; });
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
        it.className = "map-list-item";
        it.innerHTML = '<span class="li-title">' + esc(p.title) + "</span>" + (p.desc ? '<span class="li-desc">' + esc(p.desc) + "</span>" : "");
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
    popup.style.display = "";
    $("popupCat").textContent = CATS[p.cat] ? CATS[p.cat].label : p.cat;
    $("popupCat").style.background = CATS[p.cat] ? CATS[p.cat].color : "#888";
    $("popupTitle").textContent = p.title;
    $("popupDesc").textContent = p.desc || "";
  }
  function hidePopup() { popup.style.display = "none"; state.sel = null; }

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

  function bindEvents() {
    $("zoomIn").addEventListener("click", function () { zoom(1.2); });
    $("zoomOut").addEventListener("click", function () { zoom(1 / 1.2); });
    $("zoomReset").addEventListener("click", function () { state.scale = 1; state.tx = 0; state.ty = 0; applyTransform(); });
    $("popupClose").addEventListener("click", hidePopup);
    $("mapSearch").addEventListener("input", function (e) { state.q = e.target.value; renderList(); });

    // 滚轮缩放
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    // 鼠标拖拽平移
    var dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    stage.addEventListener("mousedown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY; stx = state.tx; sty = state.ty;
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      state.tx = stx + (e.clientX - sx); state.ty = sty + (e.clientY - sy); applyTransform();
    });
    window.addEventListener("mouseup", function () { dragging = false; });

    // 触摸拖拽（移动端）
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
