/* =========================================================
 * admin-table.js — 可复用后台数据表格组件（优化版）
 * 解决：列过多显示不下 / 添加行丢失未保存数据 / 编辑不直观
 * 特性：
 *   - 首列(名称)与尾列(操作) sticky 固定，中间列横向滚动
 *   - 点击任意行 → 右侧滑出「详情抽屉」编辑全部字段（含长文本）
 *   - 列设置：勾选显示/隐藏列 + 拖拽排序，按 key 记忆到 localStorage
 *   - 添加一行前，若当前抽屉有未保存修改，先自动保存该行
 *   - 支持 上移/下移/删除/复制 行
 * 依赖：调用方传入 load()/save()（复用 admin.html 的 loadDataObj/saveDataObj）
 * ========================================================= */
(function () {
  "use strict";
  var CFG_KEY = "di_at_cfg_";

  function getCfg(key) { try { return JSON.parse(localStorage.getItem(CFG_KEY + key) || "null"); } catch (e) { return null; } }
  function setCfg(key, cfg) { try { localStorage.setItem(CFG_KEY + key, JSON.stringify(cfg)); } catch (e) {} }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function uid() { return "r" + Date.now() + Math.floor(Math.random() * 1000); }

  /* opts = { key, title, columns, newRow, load, save }
   * columns: [{ field, title, type:'text'|'number'|'textarea'|'select'|'bool',
   *             width, fixed:'left'|'right', options:[{v,l}], inTable:true|false, cell:fn(val,row)->html }]
   */
  function mount(opts) {
    var columns = opts.columns.slice();
    var rows = [];
    var dirty = false;
    var editingId = null;       // 当前抽屉编辑的行 id
    var drawerDirty = false;    // 抽屉内是否有未保存修改

    var root = document.createElement("div");
    root.className = "at-root";
    root.innerHTML =
      '<div class="at-toolbar">' +
        '<button class="btn sm" data-act="add">＋ 添加一行</button>' +
        '<button class="btn sm ghost" data-act="cfg">⚙ 列设置</button>' +
        '<button class="btn sm" data-act="save">💾 保存全部</button>' +
        '<span class="at-dirty" data-dirty></span>' +
        '<span class="at-count" data-count></span>' +
      '</div>' +
      '<div class="at-scroll"><table class="at-table"><thead></thead><tbody></tbody></table></div>' +
      '<div class="at-drawer-mask" data-drawermask hidden></div>' +
      '<aside class="at-drawer" data-drawer hidden>' +
        '<div class="at-drawer-head"><span data-drawertitle>编辑</span>' +
          '<button class="modal-x" data-drawerclose>✕</button></div>' +
        '<div class="at-drawer-body" data-drawerbody></div>' +
        '<div class="at-drawer-foot">' +
          '<button class="btn sm" data-act="row-save">保存此行</button>' +
          '<button class="btn sm ghost" data-act="row-del">删除</button>' +
          '<span data-rowmsg></span>' +
        '</div>' +
      '</aside>' +
      '<div class="at-cfg" data-cfg hidden>' +
        '<div class="at-cfg-head">列设置（勾选显示 / 拖拽排序，自动记忆）</div>' +
        '<div class="at-cfg-list" data-cfglist></div>' +
        '<div class="at-cfg-foot"><button class="btn sm" data-act="cfg-apply">完成</button></div>' +
      '</div>';

    var thead = root.querySelector("thead");
    var tbody = root.querySelector("tbody");
    var scroll = root.querySelector(".at-scroll");
    var drawer = root.querySelector("[data-drawer]");
    var drawerMask = root.querySelector("[data-drawermask]");
    var drawerBody = root.querySelector("[data-drawerbody]");
    var drawerTitle = root.querySelector("[data-drawertitle]");
    var cfgBox = root.querySelector("[data-cfg]");
    var dirtyEl = root.querySelector("[data-dirty]");
    var countEl = root.querySelector("[data-count]");

    /* ---- 列可见性 / 排序（记忆） ---- */
    function applyCfg() {
      var cfg = getCfg(opts.key);
      if (cfg && Array.isArray(cfg.order)) {
        var map = {}; columns.forEach(function (c) { map[c.field] = c; });
        var ordered = cfg.order.map(function (f) { return map[f]; }).filter(Boolean);
        // 补齐 cfg 中缺失的新列
        columns.forEach(function (c) { if (cfg.order.indexOf(c.field) < 0) ordered.push(c); });
        columns = ordered;
      }
      columns.forEach(function (c) { if (c._vis === undefined) c._vis = (cfg && cfg.hidden && cfg.hidden.indexOf(c.field) >= 0) ? false : (c.inTable === false ? false : true); });
    }
    function visibleCols() { return columns.filter(function (c) { return c._vis !== false; }); }

    /* ---- 渲染表头 ---- */
    function renderHead() {
      var cols = visibleCols();
      thead.innerHTML = "<tr>" + cols.map(function (c, i) {
        var sticky = c.fixed === "left" ? " at-sticky-left" : (c.fixed === "right" ? " at-sticky-right" : "");
        var w = c.width ? ' style="min-width:' + c.width + 'px;max-width:' + (c.width * 1.6) + 'px"' : "";
        return '<th class="' + sticky + '"' + w + '>' + esc(c.title) + "</th>";
      }).join("") + "</tr>";
    }

    /* ---- 单元格 ---- */
    function cellHtml(c, row) {
      var v = row[c.field];
      if (c.cell) return c.cell(v, row);
      if (c.type === "bool") return v ? "✅" : "—";
      if (c.type === "select") {
        var opt = (c.options || []).find(function (o) { return String(o.v) === String(v); });
        return esc(opt ? opt.l : (v == null ? "" : v));
      }
      var s = v == null ? "" : String(v);
      if (s.length > 40) return esc(s.slice(0, 38)) + "…";
      return esc(s);
    }

    /* ---- 渲染表体 ---- */
    function renderBody() {
      var cols = visibleCols();
      if (!rows.length) { tbody.innerHTML = '<tr><td class="at-empty" colspan="' + cols.length + '">暂无数据，点「添加一行」</td></tr>'; }
      else tbody.innerHTML = rows.map(function (row) {
        var tds = cols.map(function (c, i) {
          var sticky = c.fixed === "left" ? " at-sticky-left" : (c.fixed === "right" ? " at-sticky-right" : "");
          var cls = "at-td" + (c.type === "textarea" || c.type === "select" ? " at-td-mid" : "");
          return '<td class="' + sticky + " " + cls + '" data-field="' + esc(c.field) + '">' + cellHtml(c, row) + "</td>";
        }).join("");
        return '<tr data-id="' + esc(row._id) + '">' + tds + "</tr>";
      }).join("");
      // 行点击 → 打开抽屉
      Array.prototype.forEach.call(tbody.querySelectorAll("tr[data-id]"), function (tr) {
        tr.addEventListener("click", function () { openDrawer(tr.getAttribute("data-id")); });
      });
      countEl.textContent = "共 " + rows.length + " 条";
    }

    /* ---- 详情抽屉 ---- */
    function openDrawer(id) {
      // 若抽屉已开且有未保存修改，先自动保存当前行（防丢失）
      if (editingId && drawerDirty) { saveRow(true); }
      var row = rows.find(function (r) { return r._id === id; });
      if (!row) return;
      editingId = id; drawerDirty = false;
      drawerTitle.textContent = "编辑：" + (row[opts.titleField || columns[0].field] || id);
      drawerBody.innerHTML = columns.map(function (c) {
        if (c.fixed === "right") return ""; // 操作列不进抽屉
        var v = row[c.field];
        var ctrl;
        if (c.type === "textarea") ctrl = '<textarea data-f="' + esc(c.field) + '" rows="3">' + esc(v == null ? "" : v) + "</textarea>";
        else if (c.type === "bool") ctrl = '<input type="checkbox" data-f="' + esc(c.field) + '"' + (v ? " checked" : "") + " />";
        else if (c.type === "select") ctrl = '<select data-f="' + esc(c.field) + '">' + (c.options || []).map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? " selected" : "") + ">" + esc(o.l) + "</option>";
        }).join("") + "</select>";
        else if (c.type === "number") ctrl = '<input type="number" data-f="' + esc(c.field) + '" value="' + esc(v == null ? "" : v) + '" />';
        else ctrl = '<input type="text" data-f="' + esc(c.field) + '" value="' + esc(v == null ? "" : v) + '" />';
        return '<div class="at-field"><label>' + esc(c.title) + "</label>" + ctrl + "</div>";
      }).join("");
      drawerBody.querySelectorAll("[data-f]").forEach(function (el) {
        el.addEventListener("input", function () { drawerDirty = true; markDirty(); });
        el.addEventListener("change", function () { drawerDirty = true; markDirty(); });
      });
      drawer.hidden = false; drawerMask.hidden = false;
    }
    function closeDrawer() {
      if (editingId && drawerDirty) { if (!confirm("当前行有未保存修改，确定关闭？")) return; }
      editingId = null; drawerDirty = false;
      drawer.hidden = true; drawerMask.hidden = true;
    }
    function saveRow(silent) {
      if (!editingId) return;
      var row = rows.find(function (r) { return r._id === editingId; });
      if (!row) return;
      drawerBody.querySelectorAll("[data-f]").forEach(function (el) {
        var f = el.getAttribute("data-f");
        var col = columns.find(function (c) { return c.field === f; });
        var val;
        if (col && col.type === "bool") val = el.checked;
        else if (col && col.type === "number") val = el.value === "" ? "" : Number(el.value);
        else val = el.value;
        row[f] = val;
      });
      drawerDirty = false; dirty = true; markDirty();
      if (!silent) { drawer.querySelector("[data-rowmsg]").textContent = "✅ 已暂存（点保存全部写入）"; }
      renderBody();
    }

    /* ---- 列设置面板 ---- */
    function renderCfg() {
      var list = cfgBox.querySelector("[data-cfglist]");
      list.innerHTML = columns.map(function (c, i) {
        return '<div class="at-cfg-item" draggable="true" data-f="' + esc(c.field) + '">' +
          '<span class="at-drag">⠿</span>' +
          '<input type="checkbox" data-vis ' + (c._vis !== false ? "checked" : "") + " />" +
          "<span>" + esc(c.title) + "</span></div>";
      }).join("");
      bindDrag(list);
    }
    function bindDrag(list) {
      var dragEl = null;
      list.querySelectorAll(".at-cfg-item").forEach(function (it) {
        it.addEventListener("dragstart", function () { dragEl = it; });
        it.addEventListener("dragover", function (e) { e.preventDefault(); });
        it.addEventListener("drop", function (e) {
          e.preventDefault();
          if (!dragEl || dragEl === it) return;
          var items = Array.prototype.slice.call(list.children);
          var from = items.indexOf(dragEl), to = items.indexOf(it);
          if (from < to) it.parentNode.insertBefore(dragEl, it.nextSibling);
          else it.parentNode.insertBefore(dragEl, it);
        });
      });
    }
    function applyCfgPanel() {
      var order = Array.prototype.map.call(cfgBox.querySelectorAll(".at-cfg-item"), function (it) { return it.getAttribute("data-f"); });
      var hidden = [];
      cfgBox.querySelectorAll(".at-cfg-item").forEach(function (it) {
        if (!it.querySelector("[data-vis]").checked) hidden.push(it.getAttribute("data-f"));
      });
      setCfg(opts.key, { order: order, hidden: hidden });
      applyCfg(); renderHead(); renderBody();
      cfgBox.hidden = true;
    }

    /* ---- 工具栏动作 ---- */
    root.querySelector('[data-act="add"]').addEventListener("click", function () {
      // 关键：添加一行前，若抽屉有未保存修改，先自动保存当前行，避免丢失
      if (editingId && drawerDirty) saveRow(true);
      var nr = typeof opts.newRow === "function" ? opts.newRow() : (opts.newRow || {});
      nr._id = uid();
      rows.unshift(nr);
      dirty = true; markDirty(); renderBody();
      openDrawer(nr._id);
    });
    root.querySelector('[data-act="cfg"]').addEventListener("click", function () { renderCfg(); cfgBox.hidden = false; });
    root.querySelector('[data-act="cfg-apply"]').addEventListener("click", applyCfgPanel);
    root.querySelector('[data-act="save"]').addEventListener("click", function () {
      if (editingId && drawerDirty) saveRow(true);
      var msg = { className: "msg", textContent: "保存中…" };
      // 临时 message 元素
      var tmp = document.createElement("span"); tmp.className = "msg"; root.querySelector(".at-toolbar").appendChild(tmp);
      opts.save(rows.map(function (r) { var c = Object.assign({}, r); delete c._id; return c; }), tmp)
        .then(function () { dirty = false; markDirty(); closeDrawer(); })
        .catch(function (e) { tmp.className = "msg err"; tmp.textContent = "❌ " + (e && e.message || e); });
    });
    root.querySelector('[data-act="row-save"]').addEventListener("click", function () { saveRow(false); });
    root.querySelector('[data-act="row-del"]').addEventListener("click", function () {
      if (!editingId) return;
      if (!confirm("确定删除此行？")) return;
      rows = rows.filter(function (r) { return r._id !== editingId; });
      dirty = true; markDirty(); closeDrawer(); renderBody();
    });
    root.querySelector("[data-drawerclose]").addEventListener("click", closeDrawer);
    drawerMask.addEventListener("click", closeDrawer);

    function markDirty() { dirtyEl.textContent = dirty ? "● 有未保存修改" : ""; dirtyEl.style.color = dirty ? "#ffce54" : ""; }

    /* ---- 初始化 ---- */
    function reload() {
      return opts.load().then(function (arr) {
        rows = (arr || []).map(function (r) { r = Object.assign({}, r); r._id = uid(); return r; });
        dirty = false; markDirty(); renderHead(); renderBody();
      });
    }
    applyCfg();
    reload();

    return { reload: reload, el: root };
  }

  window.AdminTable = { mount: mount };
})();
