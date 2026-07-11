/* =========================================================
 * database.js — 资料库扩展插件（补齐 KK日报 有、本站原先缺的数据板块）
 *   VIEWS.armors      防具基础数据一览
 *   VIEWS.scopes      瞄具开镜样式一览
 *   VIEWS.npc         NPC 血量 / 护甲数据一览
 *   VIEWS.upgrades    特勤处升级花销
 *   VIEWS.expansion   扩容箱兑换价格
 *   VIEWS.keyrooms    钥匙房信息
 *   VIEWS.collectibles 收集品及消耗品单格价值
 *   VIEWS.bulletpacks 子弹自选包利润
 * 数据来自 data.json 对应数组；管理员可在后台「资料管理员」面板维护。
 * 菜单注入：装备数据 / 养成数据 / 交易数据 三组。
 * ========================================================= */
(function () {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }

  function rack(title, cols, rows) {
    if (!rows.length) return '<div class="card"><p style="color:var(--muted)">暂无数据，管理员可在后台「资料管理员」维护。</p></div>';
    var head = cols.map(function (c) { return "<th>" + c[0] + "</th>"; }).join("");
    var body = rows.map(function (r) {
      return "<tr>" + cols.map(function (c) {
        var v = r[c[1]];
        var cls = c[2] || "";
        if (c[1] === "profit" || c[1] === "cur" || c[1] === "value" || c[1] === "price") cls += " profit-up";
        return '<td class="' + cls.trim() + '">' + (v == null || v === "" ? "—" : (typeof v === "number" ? fmt(v) : esc(v))) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="card" style="padding:0;overflow:auto"><table class="tbl">' +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function withData(fn) { return function () { return fn(DATAH()); }; }
  var _D = null;
  function DATAH() { return _D; }

  function reg(D) {
    _D = D;
    D.VIEWS.armors = { html: withData(function () {
      return '<div class="section-title">🛡 防具基础数据一览</div>' +
        rack("防具", [["名称", "name"], ["类型", "type"], ["稀有度", "rarity"], ["护甲", "armor", "r-common"], ["耐久", "dura"], ["减伤", "dr"], ["移动", "mob"], ["简介", "desc"]],
          D.getData().armors || []);
    }) };
    D.VIEWS.scopes = { html: withData(function () {
      return '<div class="section-title">🔭 瞄具开镜样式一览</div>' +
        rack("瞄具", [["名称", "name"], ["倍率", "zoom"], ["开镜样式", "style"], ["适用", "fit"], ["说明", "desc"]],
          D.getData().scopes || []);
    }) };
    D.VIEWS.npc = { html: withData(function () {
      return '<div class="section-title">👾 NPC 血量 / 护甲数据一览</div>' +
        rack("NPC", [["名称", "name"], ["类型", "type"], ["血量", "hp", "r-common"], ["护甲", "armor", "r-common"], ["弱点", "weak"], ["说明", "desc"]],
          D.getData().npc || []);
    }) };
    D.VIEWS.upgrades = { html: withData(function () {
      return '<div class="section-title">⬆ 特勤处升级花销</div>' +
        rack("升级", [["项目", "name"], ["等级", "level"], ["花费", "cost", "profit-up"], ["回报", "return"], ["说明", "desc"]],
          D.getData().upgrades || []);
    }) };
    D.VIEWS.expansion = { html: withData(function () {
      return '<div class="section-title">📦 扩容箱兑换价格</div>' +
        rack("扩容箱", [["规格", "name"], ["兑换价", "price", "profit-up"], ["容量", "cap"], ["说明", "desc"]],
          D.getData().expansion || []);
    }) };
    D.VIEWS.keyrooms = { html: withData(function () {
      return '<div class="section-title">🔑 钥匙房信息</div>' +
        rack("钥匙房", [["地图", "map"], ["房间", "room"], ["钥匙", "key"], ["产出", "loot"], ["说明", "desc"]],
          D.getData().keyRooms || []);
    }) };
    D.VIEWS.collectibles = { html: withData(function () {
      return '<div class="section-title">💎 收集品及消耗品单格价值</div>' +
        rack("收集品", [["名称", "name"], ["类型", "type"], ["单格价值", "value", "profit-up"], ["建议", "tip"]],
          D.getData().collectibles || []);
    }) };
    D.VIEWS.bulletpacks = { html: withData(function () {
      return '<div class="section-title">📦 子弹自选包利润</div>' +
        rack("子弹包", [["名称", "name"], ["包含", "contains"], ["成本", "cost", "r-common"], ["售价", "price", "profit-up"], ["利润", "profit", "profit-up"]],
          D.getData().bulletPacks || []);
    }) };

    D.MENU.push(
      { group: "装备数据", items: [
        { route: "armors", label: "防具基础数据", ico: "🛡" },
        { route: "scopes", label: "瞄具开镜样式", ico: "🔭" },
        { route: "npc",    label: "NPC 数据",      ico: "👾" }
      ] },
      { group: "养成数据", items: [
        { route: "upgrades",  label: "升级花销",   ico: "⬆" },
        { route: "expansion", label: "扩容箱价格", ico: "📦" },
        { route: "keyrooms",  label: "钥匙房信息", ico: "🔑" }
      ] },
      { group: "交易数据", items: [
        { route: "collectibles", label: "收集品单格价值", ico: "💎" },
        { route: "bulletpacks", label: "子弹自选包利润", ico: "📦" }
      ] }
    );
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
