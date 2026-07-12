/* =========================================================
 * addons.js — 新手速览、电竞选手测试、工具箱、资料库等扩展视图
 * 本文件作为 DF 插件加载，不侵入 app.js 主体。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>'"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c];
    });
  }

  function getData() { return (window.DF && window.DF.getData && window.DF.getData()) || {}; }

  /* ---------- 新手速览 ---------- */
  function guideHtml() {
    var d = getData().guides || {};
    var modules = (d.modules || []).map(function (m) {
      var cards = (m.cards || []).map(function (c) {
        return '<div class="gd-card"><div class="gd-card-title">' + esc(c.title) + '</div><div class="gd-card-text">' + esc(c.text) + '</div></div>';
      }).join('') || '<div class="kk-empty">暂无卡片</div>';
      return '<div class="gd-module">' +
        '<div class="gd-module-h"><span class="gd-module-ico">' + esc(m.icon) + '</span>' + esc(m.title) + '</div>' +
        '<div class="gd-cards">' + cards + '</div></div>';
    }).join('') || '<div class="kk-empty">暂无新手速览数据</div>';
    return '<div class="section-title">📘 新手速览</div>' +
      '<p class="guide-intro">' + esc(d.intro || "从零上手《三角洲行动》，按模块分卡片查看。") + '</p>' +
      '<div class="guide-modules">' + modules + '</div>';
  }

  /* ---------- 电竞选手测试 ---------- */
  function quizHtml() {
    var q = getData().quiz || {};
    return '<div class="section-title">🎮 ' + esc(q.title || "你是哪种三角洲电竞选手？") + '</div>' +
      '<p class="guide-intro">' + esc(q.sub || "5 道选择题，测出你的战术人格。") + '</p>' +
      '<div class="quiz-wrap" id="quizWrap"><div class="kk-empty">题库加载中…</div></div>';
  }
  function quizInit() {
    var q = getData().quiz || {};
    var questions = q.questions || [];
    var wrap = document.getElementById("quizWrap");
    if (!wrap || !questions.length) { if (wrap) wrap.innerHTML = '<div class="kk-empty">暂无题库</div>'; return; }
    var idx = 0, scores = {};
    function render() {
      if (idx >= questions.length) { showResult(); return; }
      var qu = questions[idx];
      var opts = (qu.options || []).map(function (o, i) {
        return '<button class="quiz-opt" data-s="' + esc(o.s) + '" data-i="' + i + '">' + esc(o.text) + '</button>';
      }).join('');
      wrap.innerHTML = '<div class="quiz-progress">第 ' + (idx + 1) + ' / ' + questions.length + ' 题</div>' +
        '<div class="quiz-q">' + esc(qu.q) + '</div>' + '<div class="quiz-opts">' + opts + '</div>';
      wrap.querySelectorAll('.quiz-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var s = btn.getAttribute('data-s');
          scores[s] = (scores[s] || 0) + 1;
          idx++;
          render();
        });
      });
    }
    function showResult() {
      var max = 0, role = '指挥';
      Object.keys(scores).forEach(function (k) { if (scores[k] > max) { max = scores[k]; role = k; } });
      var results = q.results || {
        "指挥": { name: "战场指挥官", desc: "你擅长读图、控节奏，是队伍里最冷静的头脑。", suggest: "多和突击/狙击沟通，把信息变成击杀。" },
        "突击": { name: "正面猛男", desc: "你信奉枪法即真理，喜欢强开局面。", suggest: "先学会卡位，再学会什么时候不该冲。" },
        "渗透": { name: "幽灵刺客", desc: "你绕后、抓单、断节奏，对手永远不知道你在哪里。", suggest: "保持耐心，信息比击杀更重要。" },
        "狙击": { name: "远程死神", desc: "你善于架枪、控视野，一枪改变战局。", suggest: "练习预瞄与身位，别给对面反拉机会。" }
      };
      var r = results[role] || results['指挥'];
      wrap.innerHTML = '<div class="quiz-result">' +
        '<div class="quiz-result-icon">🏆</div>' +
        '<div class="quiz-result-role">' + esc(r.name) + '</div>' +
        '<div class="quiz-result-desc">' + esc(r.desc) + '</div>' +
        '<div class="quiz-result-suggest">💡 ' + esc(r.suggest) + '</div>' +
        '<button class="quiz-retry" id="quizRetry">再测一次</button>' +
      '</div>';
      document.getElementById('quizRetry').addEventListener('click', function () { idx = 0; scores = {}; render(); });
    }
    render();
  }

  /* ---------- 工具箱 / 资料库 ---------- */
  function toolsHtml() {
    var d = getData();
    return '<div class="section-title">🧰 工具箱 & 资料库</div>' +
      '<p class="guide-intro">收录胸挂、钥匙房、扩容箱、瞄具、NPC 等常用数据，方便快速查阅。</p>' +
      '<div class="tool-grid">' +
        toolCard('胸挂一览', 'rigs', d.rigs, ['name', 'slots', 'capacity', 'weight']) +
        toolCard('钥匙房信息', 'keyRooms', d.keyRooms, ['map', 'name', 'key', 'loot']) +
        toolCard('特勤处升级', 'upgrades', d.upgrades, ['level', 'cost', 'bonus']) +
        toolCard('扩容箱', 'expansion', d.expansion, ['name', 'price', 'capacity']) +
        toolCard('瞄具一览', 'scopes', d.scopes, ['name', 'type', 'zoom', 'style']) +
        toolCard('NPC 数据', 'npc', d.npc, ['name', 'hp', 'armor', 'map']) +
      '</div>';
  }
  function toolCard(title, key, data, fields) {
    var rows = '';
    if (data && data.length) {
      rows = data.map(function (it) {
        return '<div class="tool-row">' + fields.map(function (f) {
          return '<span><b>' + esc(f) + '</b> ' + esc(it[f]) + '</span>';
        }).join('') + '</div>';
      }).join('');
    }
    return '<div class="tool-card" data-key="' + key + '">' +
      '<div class="tool-card-h">' + esc(title) + '</div>' +
      (rows || '<div class="kk-empty">暂无数据</div>') + '</div>';
  }

  /* ---------- 反馈入口 ---------- */
  function feedbackHtml() {
    return '<div class="section-title">💬 网站反馈</div>' +
      '<div class="card">' +
        '<p>反馈已统一集中到 <a href="feedback.html">feedback.html</a>，你可以：</p>' +
        '<ul>' +
          '<li><a href="feedback.html">打开统一反馈页面</a></li>' +
        '</ul>' +
      '</div>';
  }

  function reg(D) {
    D.VIEWS.guides = { html: guideHtml, init: function () {} };
    D.VIEWS.quiz = { html: quizHtml, init: quizInit };
    D.VIEWS.tools = { html: toolsHtml, init: function () {} };
    D.VIEWS.feedback = { html: feedbackHtml, init: function () {} };
    D.MENU.push({ group: "资讯", items: [
      { route: "guides", label: "新手速览", ico: "📘" },
      { route: "quiz", label: "电竞选手测试", ico: "🎮" }
    ]});
    D.MENU.push({ group: "资料库", items: [
      { route: "tools", label: "工具箱", ico: "🧰" },
      { route: "feedback", label: "网站反馈", ico: "💬" }
    ]});
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
