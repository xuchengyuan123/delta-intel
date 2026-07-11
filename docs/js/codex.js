/* =========================================================
 * codex.js — 图鉴插件：特战干员图鉴 / 武器图鉴（仿 KK日报 数据密集风）
 *   - 干员：肖像占位 + 稀有度徽章 + 定位/阵营 + 四维属性条 + 技能/简介
 *   - 武器：肖像占位 + 稀有度 + 类型/弹药 + 多属性 chip + 简介
 *   - 支持图片字段（portrait/cover），缺省用生成式占位，绝不裂图
 *   - 列表 / 卡片 两种视图切换
 * 数据来自 data.json.operators 与 data.json.weaponCodex。
 * ========================================================= */
(function () {
  "use strict";

  var opQ = "", wpnQ = "", wpnType = "全部", opView = "card", wpnView = "card";
  var opList = [], wpnList = []; // 当前渲染的列表，供点击弹窗查详情

  function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (x != null && !seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
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
  function statBar(label, val) {
    var v = Math.max(0, Math.min(100, Number(val) || 0)), pct = Math.round(v);
    return '<div class="stat-line"><span class="stat-l">' + label + '</span>' +
      '<span class="stat-track"><span class="stat-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="stat-v">' + v + '</span></div>';
  }
  function chip(label, val) {
    if (val == null || val === "") return "";
    return '<span class="chip"><b>' + label + '</b>' + esc(val) + '</span>';
  }
  function portrait(name, seed, cls, img) {
    if (img) return '<div class="' + cls + '" style="background:url(' + esc(img) + ') center/cover"></div>';
    var palette = ["#19c3a6", "#3a7bd5", "#a06bff", "#ff7a59", "#ffb300", "#2ecc71", "#e84393", "#00b8d4"];
    var c = palette[Math.abs(hash(seed)) % palette.length];
    var initial = String(name || "?").slice(0, 1);
    return '<div class="' + cls + '" style="background:linear-gradient(135deg,' + c + ',#0d1b2a)">' + esc(initial) + '</div>';
  }
  function hash(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  /* ---------------- 详情弹窗（点击卡片弹出，内容由管理员后续填充；支持技能演示 MP4） ---------------- */
  function closeModal() { var m = document.getElementById("dfModal"); if (m) m.remove(); }
  function modalShell(inner) {
    closeModal();
    var root = document.createElement("div");
    root.className = "df-modal-backdrop";
    root.id = "dfModal";
    root.innerHTML = '<div class="df-modal"><button class="df-modal-close" id="dfModalClose">×</button>' + inner + '</div>';
    document.body.appendChild(root);
    root.addEventListener("click", function (e) { if (e.target === root) closeModal(); });
    var c = root.querySelector("#dfModalClose"); if (c) c.onclick = closeModal;
    document.addEventListener("keydown", function escClose(e) { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", escClose); } });
  }
  function section(t) { return '<div class="df-sec"><div class="df-sec-h">' + t + '</div><div class="df-sec-b">（管理员可在后台填写，前台即时展示）</div></div>'; }
  function videoBlock(src) {
    if (!src) return '<div class="df-detail-video empty">（暂无技能演示视频，管理员可在后台上传 MP4）</div>';
    return '<div class="df-detail-video"><video controls preload="metadata" src="' + esc(src) + '"></video><div class="df-detail-cap">🎬 技能演示视频</div></div>';
  }
  function openOpDetail(o) {
    if (!o) return;
    var st = opStats(o);
    var inner = '<div class="df-detail-head">' + portrait(o.name, o.realname || o.name, "df-detail-portrait", o.cover || o.portrait) +
      '<div class="df-detail-id"><div class="df-detail-name">' + esc(o.name) + "</div>" +
      (o.realname ? '<div class="df-detail-sub">本名 · ' + esc(o.realname) + "</div>" : "") +
      '<div class="df-detail-tags"><span class="pill ' + rarityClass(o.rarity) + '">' + roleIcon(o.role) + " " + esc(o.role || "") + '</span>' +
      '<span class="pill ' + rarityClass(o.rarity) + '">' + esc(o.rarity || "普通") + "</span></div></div></div>" +
      '<div class="df-detail-stats">' + statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) + "</div>" +
      '<div class="df-detail-skill"><span class="op-skill-tag">战术技能</span>' + esc(o.skill || "") +
      (o.skillDesc ? '<div class="op-skill-desc">' + esc(o.skillDesc) + "</div>" : "") + "</div>" +
      (o.desc ? '<div class="df-detail-desc">' + esc(o.desc) + "</div>" : "") +
      videoBlock(o.video) +
      '<div class="df-detail-sections">' + section("📖 背景故事") + section("🎯 战术定位") + section("🧰 配装建议") + section("💡 小贴士") + "</div>";
    modalShell(inner);
  }
  function openWpnDetail(w) {
    if (!w) return;
    var inner = '<div class="df-detail-head">' + portrait(w.name, w.name, "df-detail-portrait", w.cover || w.image) +
      '<div class="df-detail-id"><div class="df-detail-name">' + esc(w.name) + "</div>" +
      '<div class="df-detail-sub">' + esc(w.type || "") + "</div>" +
      '<div class="df-detail-tags"><span class="pill">🔫 ' + esc(w.ammo || "—") + '</span><span class="pill ' + rarityClass(w.rarity) + '">' + esc(w.rarity || "普通") + "</span></div></div></div>" +
      '<div class="df-detail-stats">' + statBar("裸伤", w.dmg) + statBar("射速", w.rof) + statBar("射程", w.range) + statBar("穿甲", w.pen) + statBar("后坐", w.recoil) + statBar("精准", w.acc) + "</div>" +
      (w.desc ? '<div class="df-detail-desc">' + esc(w.desc) + "</div>" : "") +
      videoBlock(w.video) +
      '<div class="df-detail-sections">' + section("🔧 改装建议") + section("🎯 适用场景") + section("🧰 配装思路") + section("💡 小贴士") + "</div>";
    modalShell(inner);
  }

  /* ---------------- 特战干员图鉴（《三角洲行动》真实干员） ---------------- */
  function opStats(o) {
    return o.stats || { 机动: o.stat_机动, 生存: o.stat_生存, 火力: o.stat_火力, 辅助: o.stat_辅助 };
  }
  function operatorsHtml(D) {
    var list = D.getData().operators || [];
    var q = opQ.toLowerCase();
    var filtered = list.filter(function (o) {
      if (!q) return true;
      return (o.name + " " + (o.realname || "") + " " + (o.role || "") + " " + (o.skill || "") + " " + (o.skillDesc || "") + " " + (o.desc || "")).toLowerCase().indexOf(q) > -1;
    });
    opList = filtered;
    var dataRows = filtered.map(function (o) {
      var st = opStats(o);
      return '<tr><td class="op-td-name"><span class="op-dot ' + rarityClass(o.rarity) + '"></span>' + roleIcon(o.role) + ' <b>' + D.esc(o.name) + '</b>' +
          (o.realname ? '<br><span class="op-sub">' + D.esc(o.realname) + '</span>' : '') + '</td>' +
        '<td>' + D.esc(o.role || "") + '</td>' +
        '<td class="op-skill-td"><b>' + D.esc(o.skill || "") + '</b>' + (o.skillDesc ? '<br><span class="op-sub">' + D.esc(o.skillDesc) + '</span>' : '') + '</td>' +
        '<td class="op-stats-td">' + statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) + '</td>' +
        '<td class="op-desc-td">' + D.esc(o.desc || "") + '</td></tr>';
    }).join("");
    var cards = filtered.map(function (o, idx) {
      var st = opStats(o);
      return '<div class="op-card ' + rarityClass(o.rarity) + '" data-oi="' + idx + '" tabindex="0" role="button">' +
        '<div class="op-head">' + portrait(o.name, o.realname || o.name, "op-portrait", o.cover || o.portrait) +
          '<div class="op-id"><div class="op-name">' + D.esc(o.name) + '</div>' +
          (o.realname ? '<div class="op-code">本名 · ' + D.esc(o.realname) + '</div>' : '') +
          '<div class="op-rarity">' + D.esc(o.rarity || "普通") + '</div></div></div>' +
        '<div class="op-meta"><span class="pill ' + rarityClass(o.rarity) + '">' + roleIcon(o.role) + ' ' + D.esc(o.role || "") + '</span></div>' +
        '<div class="op-skill"><span class="op-skill-tag">战术技能</span>' + D.esc(o.skill || "") +
          (o.skillDesc ? '<div class="op-skill-desc">' + D.esc(o.skillDesc) + '</div>' : '') + '</div>' +
        (o.desc ? '<div class="op-desc">' + D.esc(o.desc) + '</div>' : '') +
        '<div class="op-stats">' + statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) + '</div>' +
      '</div>';
    }).join("") || '<div class="card"><p style="color:var(--muted)">暂无干员数据。管理员可在后台「特战干员图鉴」维护。</p></div>';

    var viewBtns = '<div class="seg seg-right">' +
      '<button class="seg-btn' + (opView === "card" ? " active" : "") + '" data-ov="card">卡片</button>' +
      '<button class="seg-btn' + (opView === "list" ? " active" : "") + '" data-ov="list">列表</button></div>';

    return '<div class="section-title">🪖 特战干员图鉴 <span class="count-badge">' + filtered.length + ' 名</span></div>' +
      '<div class="task-search"><input type="text" id="opSearch" placeholder="搜索干员 / 代号 / 兵种 / 战术技能…" value="' + D.esc(opQ) + '"></div>' +
      viewBtns +
      (opView === "list"
        ? '<div class="card" style="padding:0;overflow:auto"><table class="codex-table"><thead><tr><th>干员</th><th>兵种</th><th>战术技能</th><th>属性</th><th>简介</th></tr></thead><tbody>' + dataRows + '</tbody></table></div>'
        : '<div class="op-grid">' + cards + '</div>');
  }
  function operatorsInit() {
    var s = document.getElementById("opSearch"); if (s) s.addEventListener("input", function () { opQ = s.value; window.DF.render("operators"); });
    document.querySelectorAll(".seg-btn[data-ov]").forEach(function (b) { b.addEventListener("click", function () { opView = b.getAttribute("data-ov"); window.DF.render("operators"); }); });
    document.querySelectorAll("#LAY_preview .op-card[data-oi]").forEach(function (card) {
      card.addEventListener("click", function () { openOpDetail(opList[+card.getAttribute("data-oi")]); });
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOpDetail(opList[+card.getAttribute("data-oi")]); } });
    });
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
    wpnList = filtered;
    var tabs = types.map(function (t) { return '<button class="seg-btn' + (t === wpnType ? " active" : "") + '" data-type="' + D.esc(t) + '">' + D.esc(t) + '</button>'; }).join("");

    var dataRows = filtered.map(function (w) {
      return '<tr><td class="wpn-td-name"><span class="op-dot ' + rarityClass(w.rarity) + '"></span> <b>' + D.esc(w.name) + '</b><br><span class="op-sub">' + D.esc(w.type || "") + '</span></td>' +
        '<td>' + D.esc(w.ammo || "—") + '</td>' +
        '<td>' + chipText("裸伤", w.dmg) + chipText("射速", w.rof) + chipText("射程", w.range) + chipText("穿甲", w.pen) + chipText("后坐", w.recoil) + chipText("精准", w.acc) + '</td>' +
        '<td class="op-desc-td">' + D.esc(w.desc || "") + '</td></tr>';
    }).join("");
    function chipText(l, v) { return v == null || v === "" ? "" : '<span class="mini-chip"><b>' + l + '</b> ' + esc(v) + '</span>'; }

    var cards = filtered.map(function (w, idx) {
      return '<div class="wpn-card ' + rarityClass(w.rarity) + '" data-wi="' + idx + '" tabindex="0" role="button">' +
        '<div class="wpn-head">' + portrait(w.name, w.name, "wpn-portrait", w.cover || w.image) +
          '<div class="wpn-id"><div class="wpn-name">' + D.esc(w.name) + '</div><div class="wpn-type">' + D.esc(w.type || "") + '</div>' +
          '<div class="wpn-rarity">' + D.esc(w.rarity || "普通") + '</div></div></div>' +
        '<div class="wpn-meta"><span class="pill">🔫 ' + D.esc(w.ammo || "—") + '</span></div>' +
        '<div class="wpn-stats">' + chip("裸伤", w.dmg) + chip("射速", w.rof) + chip("射程", w.range) + chip("穿甲", w.pen) + chip("后坐", w.recoil) + chip("精准", w.acc) + '</div>' +
        (w.desc ? '<div class="wpn-desc">' + D.esc(w.desc) + '</div>' : '') +
      '</div>';
    }).join("") || '<div class="card"><p style="color:var(--muted)">暂无武器数据。管理员可在后台「武器图鉴」维护。</p></div>';

    var viewBtns = '<div class="seg seg-right">' +
      '<button class="seg-btn' + (wpnView === "card" ? " active" : "") + '" data-wv="card">卡片</button>' +
      '<button class="seg-btn' + (wpnView === "list" ? " active" : "") + '" data-wv="list">列表</button></div>';

    return '<div class="section-title">🔫 武器图鉴 <span class="count-badge">' + filtered.length + ' 把</span></div>' +
      '<div class="seg">' + tabs + '</div>' +
      '<div class="task-search"><input type="text" id="wpnSearch" placeholder="搜索武器 / 弹药 / 关键词…" value="' + D.esc(wpnQ) + '"></div>' +
      viewBtns +
      (wpnView === "list"
        ? '<div class="card" style="padding:0;overflow:auto"><table class="codex-table"><thead><tr><th>武器</th><th>弹药</th><th>属性</th><th>简介</th></tr></thead><tbody>' + dataRows + '</tbody></table></div>'
        : '<div class="wpn-grid">' + cards + '</div>');
  }
  function weaponsInit() {
    document.querySelectorAll("#LAY_preview .seg-btn[data-type]").forEach(function (b) { b.addEventListener("click", function () { wpnType = b.getAttribute("data-type"); window.DF.render("weapons"); }); });
    var s = document.getElementById("wpnSearch"); if (s) s.addEventListener("input", function () { wpnQ = s.value; window.DF.render("weapons"); });
    document.querySelectorAll(".seg-btn[data-wv]").forEach(function (b) { b.addEventListener("click", function () { wpnView = b.getAttribute("data-wv"); window.DF.render("weapons"); }); });
    document.querySelectorAll("#LAY_preview .wpn-card[data-wi]").forEach(function (card) {
      card.addEventListener("click", function () { openWpnDetail(wpnList[+card.getAttribute("data-wi")]); });
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWpnDetail(wpnList[+card.getAttribute("data-wi")]); } });
    });
  }

  function reg(D) {
    D.VIEWS.operators = { html: function () { return operatorsHtml(D); }, init: operatorsInit };
    D.VIEWS.weapons = { html: function () { return weaponsHtml(D); }, init: weaponsInit };
    D.MENU.push({ group: "图鉴", items: [
      { route: "operators", label: "特战干员图鉴", ico: "🪖" },
      { route: "weapons",  label: "武器图鉴",     ico: "🔫" }
    ] });
  }
  if (window.DF) reg(window.DF);
})();
