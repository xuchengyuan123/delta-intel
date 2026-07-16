/* =========================================================
 * matneed.js — 物资类型矩阵（按需选物）
 * 数据：data.json.materials（name/cur/min/max/buy/sell）
 * 按需求（赚差价/稳定理财/高价囤货/做任务）筛选排序，给买卖时点建议。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  // 常见“做任务”相关材料关键词（经验整理，可在后台维护）
  var TASK_KEYS = ["镜头","移动电缆","特种钢","服务器","显卡","电池","密码","硬盘","机械","芯片","医疗","绷带","手术","酒精","燃料","保险","弹药","螺丝","钢","铜","铝","钛","碳","橡胶","塑料","合金","纤维","陶瓷","板"];

  function spread(m){ return (Number(m.max)||0) - (Number(m.min)||0); }
  function volatility(m){
    var c = Number(m.cur)||0; if(!c) return 0;
    return spread(m) / c; // 相对波动
  }

  function reg(D) {
    D.VIEWS.matneed = {
      html: function () {
        return '<div class="section-title">物资类型矩阵 · 按需选物</div>' +
          '<p class="guide-intro">根据你当前的<strong>需求</strong>从浮动材料中智能筛选与排序：赚差价看价差、稳定理财看低波动、高价囤货看现价、做任务看常用材料。' +
          '买卖时点为站点经验统计，仅供参考。</p>' +
          '<div class="mn-bar">' +
            '<div class="mn-filters" id="mnFilters">' +
              '<button class="mn-f active" data-need="arb">赚差价</button>' +
              '<button class="mn-f" data-need="stable">稳定理财</button>' +
              '<button class="mn-f" data-need="hoard">高价囤货</button>' +
              '<button class="mn-f" data-need="task">做任务</button>' +
            '</div>' +
            '<input class="mn-search" id="mnSearch" placeholder="搜索材料名…">' +
          '</div>' +
          '<div id="mnBody"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var list = (DATA.materials || []).slice();
        if (!list.length) {
          document.getElementById("mnBody").innerHTML = '<div class="kk-empty">暂无材料数据</div>';
          return;
        }
        var curNeed = "arb";
        var curQ = "";

        function rankList() {
          var arr = list.slice();
          if (curNeed === "arb") arr.sort(function (a, b) { return spread(b) - spread(a); });
          else if (curNeed === "stable") arr.sort(function (a, b) { return volatility(a) - volatility(b); });
          else if (curNeed === "hoard") arr.sort(function (a, b) { return (Number(b.cur) || 0) - (Number(a.cur) || 0); });
          else if (curNeed === "task") {
            arr = arr.filter(function (m) {
              var n = String(m.name || "");
              return TASK_KEYS.some(function (k) { return n.indexOf(k) >= 0; });
            });
            arr.sort(function (a, b) { return spread(b) - spread(a); });
          }
          if (curQ) {
            arr = arr.filter(function (m) { return String(m.name || "").toLowerCase().indexOf(curQ.toLowerCase()) >= 0; });
          }
          return arr;
        }

        function row(m) {
          var sp = spread(m);
          var vol = volatility(m);
          var tip = "";
          if (curNeed === "arb") tip = '价差 <b class="profit-up">' + fmt(sp) + '</b>';
          else if (curNeed === "stable") tip = '波动率 <b>' + (vol * 100).toFixed(1) + '%</b>';
          else if (curNeed === "hoard") tip = '现价 <b>' + fmt(m.cur) + '</b>';
          else tip = '价差 <b>' + fmt(sp) + '</b>';
          return '<div class="mn-row">' +
            '<div class="mn-name">' + esc(m.name) + '</div>' +
            '<div class="mn-cur">' + fmt(m.cur) + '</div>' +
            '<div class="mn-range">' + fmt(m.min) + ' ~ ' + fmt(m.max) + '</div>' +
            '<div class="mn-tip">' + tip + '</div>' +
            '<div class="mn-time">买 <b>' + esc(m.buy || "—") + '</b><br>卖 <b>' + esc(m.sell || "—") + '</b></div>' +
          '</div>';
        }

        function render() {
          var arr = rankList();
          if (!arr.length) { document.getElementById("mnBody").innerHTML = '<div class="kk-empty">没有匹配的材料</div>'; return; }
          document.getElementById("mnBody").innerHTML =
            '<div class="mn-head"><span>材料</span><span>现价</span><span>区间</span><span>指标</span><span>买卖时点</span></div>' +
            arr.map(row).join("");
        }

        document.querySelectorAll("#mnFilters .mn-f").forEach(function (btn) {
          btn.addEventListener("click", function () {
            curNeed = btn.getAttribute("data-need");
            document.querySelectorAll("#mnFilters .mn-f").forEach(function (x) { x.classList.remove("active"); });
            btn.classList.add("active");
            render();
          });
        });
        document.getElementById("mnSearch").addEventListener("input", function (e) { curQ = e.target.value.trim(); render(); });
        render();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
