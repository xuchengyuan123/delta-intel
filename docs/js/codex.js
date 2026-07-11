/* =========================================================
 * codex.js — 图鉴插件：特战干员图鉴 / 武器图鉴（去稀有度、详情页分栏可编辑）
 *   - 干员：无稀有度，分栏展示 被动技能 / 大招 / 第二技能 / 第三技能 / 图文解析 / 评测
 *   - 武器：无稀有度，分栏展示 基础属性 / 新手速览 / 改装建议 / 图文解析 / 评测
 *   - 每个技能支持名称、描述、演示视频、解析图片（后台可维护）
 *   - 数据来自 data.json.operators 与 data.json.weaponCodex，缺省字段不编造
 * ========================================================= */
(function () {
  "use strict";

  var opQ = "", wpnQ = "", wpnType = "全部", opView = "card", wpnView = "card";
  var opList = [], wpnList = [];
  var modalTab = ""; // 当前弹窗激活 tab

  function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (x != null && !seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>'"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
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
    return '<div class="stat-line"><span class="stat-l">' + esc(label) + '</span>' +
      '<span class="stat-track"><span class="stat-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="stat-v">' + v + '</span></div>';
  }
  function numBar(label, val, max) {
    var v = Number(val) || 0, m = Number(max) || 100, pct = m ? Math.max(0, Math.min(100, Math.round(v / m * 100))) : 0;
    return '<div class="stat-line"><span class="stat-l">' + esc(label) + '</span>' +
      '<span class="stat-track"><span class="stat-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="stat-v">' + v + '</span></div>';
  }
  function chip(label, val) {
    if (val == null || val === "") return "";
    return '<span class="chip"><b>' + esc(label) + '</b>' + esc(val) + '</span>';
  }
  function portrait(name, seed, cls, img) {
    if (img) return '<div class="' + cls + '" style="background:url(' + esc(img) + ') center/cover"></div>';
    var palette = ["#19c3a6", "#3a7bd5", "#a06bff", "#ff7a59", "#ffb300", "#2ecc71", "#e84393", "#00b8d4"];
    var c = palette[Math.abs(hash(seed)) % palette.length];
    var initial = String(name || "?").slice(0, 1);
    return '<div class="' + cls + '" style="background:linear-gradient(135deg,' + c + ',#0d1b2a)">' + esc(initial) + '</div>';
  }
  function hash(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  /* ---------------- 详情弹窗（Tab 分栏） ---------------- */
  function closeModal() { var m = document.getElementById("dfModal"); if (m) m.remove(); modalTab = ""; }
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
  function switchTab(name) {
    modalTab = name;
    document.querySelectorAll(".df-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    document.querySelectorAll(".df-tab-panel").forEach(function (p) { p.style.display = p.getAttribute("data-panel") === name ? "block" : "none"; });
  }
  function tabNav(tabs) {
    return '<div class="df-tabs">' + tabs.map(function (t) { return '<button class="df-tab' + (modalTab === t.key ? ' active' : '') + '" data-tab="' + esc(t.key) + '">' + esc(t.label) + '</button>'; }).join("") + '</div>';
  }
  function mediaBlock(src, type) {
    if (!src) return '';
    if (type === 'video') return '<div class="df-media"><video controls preload="metadata" src="' + esc(src) + '"></video></div>';
    return '<div class="df-media"><img src="' + esc(src) + '" alt=""></div>';
  }
  function skillBlock(s, title) {
    s = s || { name: '', desc: '', video: '', image: '' };
    return '<div class="df-panel-title">' + esc(title) + '</div>' +
      (s.name ? '<div class="df-skill-name">' + esc(s.name) + '</div>' : '') +
      (s.desc ? '<div class="df-skill-desc">' + esc(s.desc) + '</div>' : '<div class="df-empty-tip">管理员尚未填写「' + esc(title) + '」内容，可在后台「干员图鉴管理」维护。</div>') +
      (s.image ? mediaBlock(s.image, 'image') : '') +
      (s.video ? mediaBlock(s.video, 'video') : '');
  }
  function analysisBlock(a) {
    a = a || { text: '', images: [], video: '' };
    var imgs = (a.images || []).map(function (img) { return mediaBlock(img, 'image'); }).join('');
    return '<div class="df-panel-title">📖 图文解析</div>' +
      (a.text ? '<div class="df-analysis-text">' + esc(a.text) + '</div>' : '<div class="df-empty-tip">管理员尚未填写图文解析，可在后台维护。</div>') +
      imgs + (a.video ? mediaBlock(a.video, 'video') : '');
  }
  function reviewsBlock(r) {
    r = r || { score: '', items: [] };
    var items = (r.items || []).map(function (x) { return '<div class="df-review-item"><div class="df-review-score">' + esc(x.score || '—') + '</div><div class="df-review-text">' + esc(x.text || '') + '</div></div>'; }).join('');
    return '<div class="df-panel-title">⭐ 实时评测</div>' +
      (r.score ? '<div class="df-total-score">综合评分：' + esc(r.score) + '</div>' : '') +
      (items || '<div class="df-empty-tip">暂无玩家评测，后台可维护真实评测条目（系统不会自动生成假数据）。</div>');
  }
  function newbieBlock(w) {
    return '<div class="df-panel-title">🎓 新手速览</div>' +
      (w.newbieGuide ? '<div class="df-analysis-text">' + esc(w.newbieGuide) + '</div>' : '<div class="df-empty-tip">管理员尚未填写新手速览，可在后台维护。</div>');
  }
  function modsBlock(w) {
    var mods = (w.mods || []).map(function (m) { return '<div class="df-mod-item">' + esc(m) + '</div>'; }).join('');
    return '<div class="df-panel-title">🔧 改装建议</div>' +
      (mods || '<div class="df-empty-tip">管理员尚未填写改装建议，可在后台维护。</div>');
  }
  function wpnStatsBlock(w) {
    var max = { baseDamage: 140, armorDamage: 80, effectiveRange: 150, recoilControl: 100, handlingSpeed: 100, stability: 100, hipFireAccuracy: 100, rof: 1200, capacity: 100 };
    return '<div class="df-panel-title">📊 基础属性</div>' +
      '<div class="df-wpn-grid">' +
        '<div class="df-wpn-stat">' + numBar('基础伤害', w.baseDamage, max.baseDamage) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('护甲伤害', w.armorDamage, max.armorDamage) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('优势射程', w.effectiveRange, max.effectiveRange) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('后坐力控制', w.recoilControl, max.recoilControl) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('操控速度', w.handlingSpeed, max.handlingSpeed) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('据枪稳定性', w.stability, max.stability) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('腰际射击精度', w.hipFireAccuracy, max.hipFireAccuracy) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('射速 (发/分)', w.rof, max.rof) + '</div>' +
        '<div class="df-wpn-stat">' + numBar('容量', w.capacity, max.capacity) + '</div>' +
      '</div>';
  }

  function openOpDetail(o) {
    if (!o) return;
    modalTab = "passive";
    var tabs = [
      { key: "passive", label: "被动技能" },
      { key: "ultimate", label: "大招" },
      { key: "skill2", label: "第二技能" },
      { key: "skill3", label: "第三技能" },
      { key: "analysis", label: "图文解析" },
      { key: "reviews", label: "评测" }
    ];
    var st = o.stats || { 机动: 0, 生存: 0, 火力: 0, 辅助: 0 };
    var inner = '<div class="df-detail-head">' + portrait(o.name, o.realname || o.name, "df-detail-portrait", o.cover) +
      '<div class="df-detail-id"><div class="df-detail-name">' + esc(o.name) + "</div>" +
      (o.realname ? '<div class="df-detail-sub">本名 · ' + esc(o.realname) + "</div>" : "") +
      '<div class="df-detail-tags"><span class="pill">' + roleIcon(o.role) + " " + esc(o.role || "") + '</span></div></div></div>' +
      '<div class="df-detail-stats">' + statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) + '</div>' +
      (o.desc ? '<div class="df-detail-desc">' + esc(o.desc) + '</div>' : '') +
      tabNav(tabs) +
      '<div class="df-tab-panel" data-panel="passive">' + skillBlock(o.passive, "被动技能") + '</div>' +
      '<div class="df-tab-panel" data-panel="ultimate" style="display:none">' + skillBlock(o.ultimate, "大招") + '</div>' +
      '<div class="df-tab-panel" data-panel="skill2" style="display:none">' + skillBlock(o.skill2, "第二技能") + '</div>' +
      '<div class="df-tab-panel" data-panel="skill3" style="display:none">' + skillBlock(o.skill3, "第三技能") + '</div>' +
      '<div class="df-tab-panel" data-panel="analysis" style="display:none">' + analysisBlock(o.analysis) + '</div>' +
      '<div class="df-tab-panel" data-panel="reviews" style="display:none">' + reviewsBlock(o.reviews) + '</div>';
    modalShell(inner);
    setTimeout(function () {
      document.querySelectorAll(".df-tab").forEach(function (t) { t.onclick = function () { switchTab(t.getAttribute("data-tab")); }; });
    }, 0);
  }
  function openWpnDetail(w) {
    if (!w) return;
    modalTab = "stats";
    var tabs = [
      { key: "stats", label: "基础属性" },
      { key: "newbie", label: "新手速览" },
      { key: "mods", label: "改装建议" },
      { key: "analysis", label: "图文解析" },
      { key: "reviews", label: "评测" }
    ];
    var inner = '<div class="df-detail-head">' + portrait(w.name, w.name, "df-detail-portrait", w.cover) +
      '<div class="df-detail-id"><div class="df-detail-name">' + esc(w.name) + "</div>" +
      '<div class="df-detail-sub">' + esc(w.type || "") + " · " + esc(w.ammo || "—") + '</div>' +
      '<div class="df-detail-tags"><span class="pill">🔫 ' + esc(w.ammo || "—") + '</span></div></div></div>' +
      (w.desc ? '<div class="df-detail-desc">' + esc(w.desc) + '</div>' : '') +
      tabNav(tabs) +
      '<div class="df-tab-panel" data-panel="stats">' + wpnStatsBlock(w) + '</div>' +
      '<div class="df-tab-panel" data-panel="newbie" style="display:none">' + newbieBlock(w) + '</div>' +
      '<div class="df-tab-panel" data-panel="mods" style="display:none">' + modsBlock(w) + '</div>' +
      '<div class="df-tab-panel" data-panel="analysis" style="display:none">' + analysisBlock(w.analysis) + '</div>' +
      '<div class="df-tab-panel" data-panel="reviews" style="display:none">' + reviewsBlock(w.reviews) + '</div>';
    modalShell(inner);
    setTimeout(function () {
      document.querySelectorAll(".df-tab").forEach(function (t) { t.onclick = function () { switchTab(t.getAttribute("data-tab")); }; });
    }, 0);
  }

  /* ---------------- 特战干员图鉴 ---------------- */
  function opStats(o) { return o.stats || { 机动: 0, 生存: 0, 火力: 0, 辅助: 0 }; }
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
      return '<tr><td class="op-td-name">' + roleIcon(o.role) + ' <b>' + D.esc(o.name) + '</b>' +
          (o.realname ? '<br><span class="op-sub">' + D.esc(o.realname) + '</span>' : '') + '</td>' +
        '<td>' + D.esc(o.role || "") + '</td>' +
        '<td class="op-skill-td"><b>' + D.esc(o.skill || "") + '</b>' + (o.skillDesc ? '<br><span class="op-sub">' + D.esc(o.skillDesc) + '</span>' : '') + '</td>' +
        '<td class="op-stats-td">' + statBar("机动", st.机动) + statBar("生存", st.生存) + statBar("火力", st.火力) + statBar("辅助", st.辅助) + '</td>' +
        '<td class="op-desc-td">' + D.esc(o.desc || "") + '</td></tr>';
    }).join("");
    var cards = filtered.map(function (o, idx) {
      var st = opStats(o);
      return '<div class="op-card" data-oi="' + idx + '" tabindex="0" role="button">' +
        '<div class="op-head">' + portrait(o.name, o.realname || o.name, "op-portrait", o.cover) +
          '<div class="op-id"><div class="op-name">' + D.esc(o.name) + '</div>' +
          (o.realname ? '<div class="op-code">本名 · ' + D.esc(o.realname) + '</div>' : '') +
          '<div class="op-role-line">' + roleIcon(o.role) + ' ' + D.esc(o.role || "") + '</div></div></div>' +
        '<div class="op-skill"><span class="op-skill-tag">战术技能</span>' + D.esc(o.skill || "") +
          (o.skillDesc ? '<div class="op-skill-desc">' + D.esc(o.skillDesc) + '</div>' : '') + '</div>' +
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

    function chipText(l, v) { return v == null || v === "" ? "" : '<span class="mini-chip"><b>' + l + '</b> ' + esc(v) + '</span>'; }
    var dataRows = filtered.map(function (w) {
      return '<tr><td class="wpn-td-name"><b>' + D.esc(w.name) + '</b><br><span class="op-sub">' + D.esc(w.type || "") + '</span></td>' +
        '<td>' + D.esc(w.ammo || "—") + '</td>' +
        '<td>' + chipText('基础伤害', w.baseDamage) + chipText('射速', w.rof) + chipText('射程', w.effectiveRange) + chipText('护甲伤害', w.armorDamage) + '</td>' +
        '<td class="op-desc-td">' + D.esc(w.desc || "") + '</td></tr>';
    }).join("");

    var cards = filtered.map(function (w, idx) {
      return '<div class="wpn-card" data-wi="' + idx + '" tabindex="0" role="button">' +
        '<div class="wpn-head">' + portrait(w.name, w.name, "wpn-portrait", w.cover) +
          '<div class="wpn-id"><div class="wpn-name">' + D.esc(w.name) + '</div><div class="wpn-type">' + D.esc(w.type || "") + '</div>' +
          '<div class="wpn-ammo-line">🔫 ' + D.esc(w.ammo || "—") + '</div></div></div>' +
        '<div class="wpn-stats">' + chip("基础伤害", w.baseDamage) + chip("射速", w.rof) + chip("容量", w.capacity) + '</div>' +
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
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
