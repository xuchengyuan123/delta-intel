/* =========================================================
 * weaponcmp.js — 武器对比（数据对决）
 * 数据：data.json.weaponCodex（各项 0–100 评分）
 * 选两把武器并排对比 9 项面板属性 + 条形可视化。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  var ATTRS = [
    { k: "baseDamage", label: "基础伤害" },
    { k: "armorDamage", label: "破甲伤害" },
    { k: "effectiveRange", label: "有效射程" },
    { k: "recoilControl", label: "后坐控制" },
    { k: "handlingSpeed", label: "机动速度" },
    { k: "stability", label: "稳定性" },
    { k: "hipFireAccuracy", label: "腰射精度" },
    { k: "rof", label: "射速" },
    { k: "capacity", label: "弹匣容量" }
  ];

  function reg(D) {
    D.VIEWS.weaponcmp = {
      html: function () {
        return '<div class="section-title">武器对比 · 数据对决</div>' +
          '<p class="guide-intro">选两把武器并排对比各项面板属性（0–100 评分）。属性数据来自武器图鉴，若显示全 0 表示后台尚未录入该武器数值。</p>' +
          '<div class="wc-bar">' +
            '<select class="wc-sel" id="wcA"><option value="">选择武器 A</option></select>' +
            '<span class="wc-vs">VS</span>' +
            '<select class="wc-sel" id="wcB"><option value="">选择武器 B</option></select>' +
          '</div>' +
          '<div id="wcBody"><div class="kk-empty">请选择两把武器</div></div>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var list = (DATA.weaponCodex || []).slice();
        if (!list.length) { document.getElementById("wcBody").innerHTML = '<div class="kk-empty">暂无武器数据</div>'; return; }
        var opts = '<option value="">选择武器</option>' + list.map(function (w) { return '<option value="' + esc(w.name) + '">' + esc(w.name) + '</option>'; }).join("");
        document.getElementById("wcA").innerHTML = opts;
        document.getElementById("wcB").innerHTML = opts;
        var aEl = document.getElementById("wcA"), bEl = document.getElementById("wcB");

        function bar(label, va, vb) {
          var maxv = Math.max(va, vb, 1);
          var pa = Math.round(va / maxv * 100), pb = Math.round(vb / maxv * 100);
          return '<div class="wc-row">' +
            '<div class="wc-valA">' + (va || 0) + '</div>' +
            '<div class="wc-track"><div class="wc-barA" style="width:' + pa + '%"></div></div>' +
            '<div class="wc-label">' + esc(label) + '</div>' +
            '<div class="wc-track wc-right"><div class="wc-barB" style="width:' + pb + '%"></div></div>' +
            '<div class="wc-valB">' + (vb || 0) + '</div>' +
          '</div>';
        }

        function render() {
          var wa = aEl.value, wb = bEl.value;
          if (!wa || !wb) { document.getElementById("wcBody").innerHTML = '<div class="kk-empty">请选择两把武器</div>'; return; }
          if (wa === wb) { document.getElementById("wcBody").innerHTML = '<div class="kk-empty">请选择两把不同的武器</div>'; return; }
          var A = list.filter(function (w) { return w.name === wa; })[0] || {};
          var B = list.filter(function (w) { return w.name === wb; })[0] || {};
          var rows = ATTRS.map(function (at) {
            return bar(at.label, Number(A[at.k]) || 0, Number(B[at.k]) || 0);
          }).join("");
          document.getElementById("wcBody").innerHTML =
            '<div class="wc-cards">' +
              '<div class="wc-cardA"><div class="wc-cname">' + esc(wa) + '</div><div class="wc-ctype">' + (A.type || "") + ' · ' + (A.ammo || "") + '</div></div>' +
              '<div class="wc-cardB"><div class="wc-cname">' + esc(wb) + '</div><div class="wc-ctype">' + (B.type || "") + ' · ' + (B.ammo || "") + '</div></div>' +
            '</div>' +
            '<div class="wc-compare">' + rows + '</div>';
        }
        aEl.onchange = render; bEl.onchange = render;
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
