/* =========================================================
 * crafting.js — 特勤处产物推荐（小时利润 / 总利润 切换）
 * 覆盖 app.js 的 VIEWS.items，增加切换与排序，并提供跳转到发票计算器。
 * 依赖 data.json.items[].craftMin（单件制作耗时，分钟）。
 * ========================================================= */
(function () {
  "use strict";
  var MODE = "total"; // total | hourly

  function hourlyOf(i) { return Math.round((i.profit || 0) * 60 / (i.craftMin || 60)); }

  function renderItems(D) {
    var esc = D.esc, fmt = D.fmt;
    var items = (D.getData().items || []).slice();
    var metric = MODE === "hourly" ? hourlyOf : function (i) { return i.profit || 0; };
    items.sort(function (a, b) { return metric(b) - metric(a); });

    var rows = items.map(function (i, idx) {
      var h = hourlyOf(i);
      return "<tr>" +
        '<td style="width:34px" class="r-common">' + (idx + 1) + "</td>" +
        '<td><span class="pill">' + esc(i.station) + "</span></td>" +
        '<td class="' + ("r-" + (i.grade || "common")) + '">' + esc(i.name) + "</td>" +
        '<td class="profit-up" style="text-align:right;font-weight:800">' + fmt(i.profit) + "</td>" +
        '<td class="profit-up" style="text-align:right">' + fmt(h) + "</td>" +
        '<td style="text-align:right">' + fmt(i.price) + "</td>" +
        '<td class="r-common">' + esc(i.sell) + "</td></tr>";
    }).join("");

    return '<div class="seg" role="tablist">' +
        '<button class="seg-btn' + (MODE === "total" ? " active" : "") + '" data-mode="total">总利润</button>' +
        '<button class="seg-btn' + (MODE === "hourly" ? " active" : "") + '" data-mode="hourly">小时利润</button>' +
      "</div>" +
      '<div class="card"><table class="tbl">' +
        "<thead><tr><th>#</th><th>工作台</th><th>产物</th><th style='text-align:right'>总利润</th><th style='text-align:right'>小时利润</th><th style='text-align:right'>理想售价</th><th>建议卖</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div>" +
      '<div class="craft-tools">' +
        '<a class="btn-ghost" href="?viewpage=sim_invoice">🧾 发票利润计算器</a>' +
        '<span class="muted-note">小时利润 = 总利润 ÷ 单件耗时 × 60。切换按所选指标排序。</span>' +
      "</div>" +
      '<div class="section-title">利润对比图</div>' +
      '<div class="card"><div class="chart-box"><canvas id="profitChart"></canvas></div></div>';
  }

  function initItems(D) {
    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { MODE = b.getAttribute("data-mode"); D.render("items"); });
    });
    var ctx = document.getElementById("profitChart");
    if (!ctx || !window.Chart) return;
    var items = (D.getData().items || []).slice();
    var labels = items.map(function (i) { return i.name; });
    var data = items.map(MODE === "hourly" ? hourlyOf : function (i) { return i.profit || 0; });
    new window.Chart(ctx, {
      type: "bar",
      data: { labels: labels, datasets: [{ label: MODE === "hourly" ? "小时利润" : "总利润", data: data, backgroundColor: "#19c3a6" }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } }
        }
      }
    });
  }

  function reg(D) {
    D.VIEWS.items = {
      html: function () { return '<div class="section-title">特勤处制作产物推荐</div>' + renderItems(D); },
      init: function () { initItems(D); }
    };
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
