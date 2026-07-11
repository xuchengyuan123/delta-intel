/* =========================================================
 * codex.js — 图鉴插件：特战干员图鉴 / 武器图鉴
 * 按插件模式注册视图到 window.DF.VIEWS，并向 DF.MENU 注入「图鉴」分组。
 * 数据来自 data.json.operators（干员）与 data.json.weaponCodex（武器）。
 * ========================================================= */
(function () {
  "use strict";

  // 搜索 / 筛选状态（模块级，仿 crafting.js 的 MODE 变量）
  var opQ = "";
  var wpnQ = "";
  var wpnType = "全部";

  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (x != null && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function rarityClass(r) {
    var s = String(r || "").toLowerCase();
    if (s.indexOf("传说") > -1 || s.indexOf("legend") > -1) return "r-legend";
    if (s.indexOf("史诗") > -1 || s.indexOf("epic") > -1) return "r-epic";
    if (s.indexOf("稀有") > -1 || s.indexOf("rare") > -1) return "r-rare";
    return "r-common";
  }

  function roleIcon(role) {
    var r = String(role || "");
    if (r.indexOf("突击") > -1) return "🗡️";
    if (r.indexOf("支援") > -1) return "🛡️";
    if (r.indexOf("狙击") > -1) return "🎯";
    if (r.indexOf("侦察") > -1) return "👁";
    if (r.indexOf("工程") > -1) return "🔧";
    if (r.indexOf("医疗") > -1) return "⚕️";
    return "🪖";
  }

  function opStats(o) {
    if (o.stats) return o.stats;
    return { 机动: o.stat_机动, 生存: o.stat_生存, 火力: o.stat_火力, 辅助: o.stat_辅助 };
  }

  function statBar(label, val) {
    var v = Math.max(0, Math.min(100, Number(val) || 0));
    var pct = Math.round(v / 100 * 100);
    return '<div class="stat-line">' +
      '<span class="stat-l">' + label + '</span>' +
      '<span class="stat-track"><span class="stat-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="stat-v">' + v + '</span></div>';
  }

  function chip(label, val) {
    return '<span class="chip"><b>' + label + '</b>' + (val == null ? "—" : val) + '</span>';
  }

  /* ---------------- 特战干员图鉴 ---------------- */
  function operatorsHtml(D) {
    var list = D.getData().operators || [];
    var q = opQ.toLowerCase();
    var filtered = list.filter(function (o) {
      if (!q) return true;
      return (o.name + " " + (o.codename || "") + " " + (o.role || "") + " " + (o.faction || "") + " " + (o.desc || "")).toLowerCase().indexOf(q) > -1;
    });
    var cards = filtered.map(function (o) {
      var st = opStats(o);
      return '<div class="op-card ' + rarityClass(o.rarity) + '">' +
        '<div class="op-head">' +
          '<div class="op-icon">' + roleIcon(o.role) + '</div>' +
          '<div class="op-id"><div class="op-name">' + D.esc(o.name) + '</div>' +
            '<div class="op-code">' + D.esc(o.codename || "") + '</div></div>' +
          '<div class="op-rarity">' + D.esc(o.rarity || "普通") + '</div>' +
        '</div>' +
        '<div class="op-meta"><span class="pill">' + D.esc(o.role || "") + '</span>' +
          '<span class="pill pill-2">' + D.esc(o.faction || "") + '</span></div>' +
        (o.desc ? '<div class="op-desc">' + D.esc(o.desc) + '</div>' : '') +
        '<div class="op-stats">' +
          statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) +
        '</div>' +
      '</div>';
    }).join("") ||
      '<div class="card"><p style="color:var(--muted)">暂无干员数据。管理员可在后台「特战干员图鉴」维护。</p></div>';
    return '<div class="section-title">🪖 特战干员图鉴</div>' +
      '<div class="task-search"><input type="text" id="opSearch" placeholder="搜索干员 / 代号 / 定位 / 阵营…" value="' + D.esc(opQ) + '"></div>' +
      '<div class="op-grid">' + cards + '</div>';
  }
  function operatorsInit() {
    var s = document.getElementById("opSearch");
    if (!s) return;
    s.addEventListener("input", function () { opQ = s.value; window.DF.render("operators"); });
  }

  /* ---------------- 武器图鉴 ---------------- */
  function weaponsHtml(D) {
    var list = D.getData().weaponCodex || [];
    var types = ["全部"].concat(uniq(list.map(function (w) { return w.type || "其他"; })));
    var q = wpnQ.toLowerCase();
    var filtered = list.filter(function (w) {
      if (wpnType !== "全部" && (w.type || "其他") !== wpnType) return false;
      if (!q) return true;
      return (w.name + " " + (w.type || "") + " " + (w.ammo || "") + " " + (w.desc || "")).toLowerCase().indexOf(q) > -1;
    });
    var tabs = types.map(function (t) {
      return '<button class="seg-btn' + (t === wpnType ? " active" : "") + '" data-type="' + D.esc(t) + '">' + D.esc(t) + '</button>';
    }).join("");
    var cards = filtered.map(function (w) {
      return '<div class="wpn-card ' + rarityClass(w.rarity) + '">' +
        '<div class="wpn-head">' +
          '<div class="wpn-icon">' + (w.icon || "🔫") + '</div>' +
          '<div class="wpn-id"><div class="wpn-name">' + D.esc(w.name) + '</div>' +
            '<div class="wpn-type">' + D.esc(w.type || "") + '</div></div>' +
          '<div class="wpn-rarity">' + D.esc(w.rarity || "普通") + '</div>' +
        '</div>' +
        '<div class="wpn-meta"><span class="pill">' + D.esc(w.ammo || "—") + '</span></div>' +
        '<div class="wpn-stats">' +
          chip("裸伤", w.dmg) + chip("射速", w.rof) + chip("射程", w.range) + chip("穿甲", w.pen) +
        '</div>' +
        (w.desc ? '<div class="wpn-desc">' + D.esc(w.desc) + '</div>' : '') +
      '</div>';
    }).join("") ||
      '<div class="card"><p style="color:var(--muted)">暂无武器数据。管理员可在后台「武器图鉴」维护。</p></div>';
    return '<div class="section-title">🔫 武器图鉴</div>' +
      '<div class="seg">' + tabs + '</div>' +
      '<div class="task-search"><input type="text" id="wpnSearch" placeholder="搜索武器 / 弹药 / 关键词…" value="' + D.esc(wpnQ) + '"></div>' +
      '<div class="wpn-grid">' + cards + '</div>';
  }
  function weaponsInit() {
    document.querySelectorAll("#LAY_preview .seg-btn[data-type]").forEach(function (b) {
      b.addEventListener("click", function () { wpnType = b.getAttribute("data-type"); window.DF.render("weapons"); });
    });
    var s = document.getElementById("wpnSearch");
    if (s) s.addEventListener("input", function () { wpnQ = s.value; window.DF.render("weapons"); });
  }

  /* ---------------- 注册到插件总线 ---------------- */
  function reg(D) {
    D.VIEWS.operators = { html: function () { return operatorsHtml(D); }, init: operatorsInit };
    D.VIEWS.weapons = { html: function () { return weaponsHtml(D); }, init: weaponsInit };
    D.MENU.push({
      group: "图鉴", items: [
        { route: "operators", label: "特战干员图鉴", ico: "🪖" },
        { route: "weapons",  label: "武器图鉴",     ico: "🔫" }
      ]
    });
  }
  if (window.DF) reg(window.DF);
})();
