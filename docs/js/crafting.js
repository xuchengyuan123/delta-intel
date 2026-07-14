/* =========================================================
 * crafting.js — 特勤处产物推荐（实时物价 API 增强）
 * 覆盖 app.js 的 VIEWS.items，增加「总利润 / 小时利润」切换。
 * 接入免费公开实时物价源 caiweilv/DeltaForcePrice（游戏内交易行真实成交价）：
 *   - 实时售价 → 实时利润 = 实时售价 − 材料成本（成本按静态数据估算）
 *   - 实时小时利润 = 实时利润 ÷ 单件耗时 × 60
 *   - 实时价取不到时回退静态数据并标注「静态」，绝不编造数字。
 * 依赖 data.json.items[]（name/station/profit/price/craftMin/grade）。
 * ========================================================= */
(function () {
  "use strict";
  var MODE = "total"; // total | hourly

  function hourlyOf(i) { return Math.round((i.profit || 0) * 60 / (i.craftMin || 60)); }

  // 用实时物价源重算（caiweilv/DeltaForcePrice，免费、跨域）
  function enrich(D, items) {
    var LP = D.livePrice;
    return items.map(function (i) {
      var o = {};
      for (var k in i) if (i.hasOwnProperty(k)) o[k] = i[k];
      var live = null;
      if (LP && LP.price) { try { live = LP.price(i.name); } catch (e) { live = null; } }
      o._live = live;
      if (live != null) {
        // 材料成本 = 理想售价 − 静态总利润（视为稳定），实时利润 = 实时售价 − 成本
        var cost = (Number(i.price) || 0) - (Number(i.profit) || 0);
        o._profit = Math.max(0, Math.round(live - cost));
        o._hourly = Math.round(o._profit * 60 / (i.craftMin || 60));
        o._real = true;
      } else {
        o._profit = Number(i.profit) || 0;
        o._hourly = hourlyOf(i);
        o._real = false;
      }
      return o;
    });
  }

  function renderItems(D) {
    var esc = D.esc, fmt = D.fmt;
    var raw = (D.getData().items || []).slice();
    var items = enrich(D, raw);
    var metric = MODE === "hourly" ? function (i) { return i._hourly; } : function (i) { return i._profit; };
    items.sort(function (a, b) { return metric(b) - metric(a); });

    var rows = items.map(function (i, idx) {
      var badge = i._real
        ? '<span class="kk-api" title="实时物价接口">实时</span>'
        : '<span class="kk-static" title="实时源暂不可用，显示静态数据">静态</span>';
      var priceShow = (i._live != null) ? i._live : (Number(i.price) || 0);
      return "<tr>" +
        '<td style="width:34px" class="r-common">' + (idx + 1) + "</td>" +
        '<td><span class="pill">' + esc(i.station) + "</span></td>" +
        '<td class="' + ("r-" + (i.grade || "common")) + '">' + esc(i.name) + "</td>" +
        '<td style="text-align:right;white-space:nowrap">' + fmt(priceShow) + " " + badge + "</td>" +
        '<td class="profit-up" style="text-align:right;font-weight:800">' + fmt(i._profit) + "</td>" +
        '<td class="profit-up" style="text-align:right">' + fmt(i._hourly) + "</td>" +
        '<td class="r-common">' + esc(i.sell) + "</td></tr>";
    }).join("");

    var meta = "";
    if (D.livePrice && D.livePrice.meta) {
      var m = D.livePrice.meta();
      if (m) {
        if (m.error) meta = "实时源暂不可用（" + m.error + "），已回退静态数据";
        else if (m.ts) meta = "实时物价更新于 " + new Date(m.ts).toLocaleTimeString("zh-CN") + " · 共 " + m.count + " 项";
      }
    }

    return '<div class="section-title">特勤处制作产物推荐 <span class="kk-api" id="itBadge">实时</span></div>' +
      '<p class="guide-intro">数据接入《三角洲行动》游戏内交易行真实成交价（caiweilv/DeltaForcePrice 免费公开接口），自动计算 <b>实时利润 / 小时利润</b>。实时价取不到时回退静态数据，绝不编造。</p>' +
      '<div class="seg" role="tablist">' +
        '<button class="seg-btn' + (MODE === "total" ? " active" : "") + '" data-mode="total">总利润</button>' +
        '<button class="seg-btn' + (MODE === "hourly" ? " active" : "") + '" data-mode="hourly">小时利润</button>' +
      "</div>" +
      (meta ? '<div class="lp-meta" style="margin:6px 0 10px">' + meta + "</div>" : "") +
      '<div class="card"><div style="overflow-x:auto"><table class="tbl">' +
        "<thead><tr><th>#</th><th>工作台</th><th>产物</th><th style='text-align:right'>实时售价</th><th style='text-align:right'>总利润</th><th style='text-align:right'>小时利润</th><th>建议卖出</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div></div>" +
      '<div class="craft-tools"><span class="muted-note">小时利润 = 总利润 ÷ 单件耗时 × 60。实时利润 = 实时售价 − 材料成本（成本按静态数据估算，售价取交易行真实成交价）。</span></div>' +
      '<div class="section-title">利润对比图</div>' +
      '<div class="card"><div class="chart-box"><canvas id="profitChart"></canvas></div></div>';
  }

  function drawChart(D) {
    var ctx = document.getElementById("profitChart");
    if (!ctx || !window.Chart) return;
    var items = enrich(D, (D.getData().items || []).slice());
    var labels = items.map(function (i) { return i.name; });
    var data = items.map(MODE === "hourly" ? function (i) { return i._hourly; } : function (i) { return i._profit; });
    new window.Chart(ctx, {
      type: "bar",
      data: { labels: labels, datasets: [{ label: MODE === "hourly" ? "小时利润(实时)" : "总利润(实时)", data: data, backgroundColor: "#19c3a6" }] },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: { ticks: { color: "#8b93a1" }, grid: { color: "rgba(255,255,255,.05)" } }
        }
      }
    });
  }

  function initItems(D) {
    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { MODE = b.getAttribute("data-mode"); D.render("items"); });
    });
    drawChart(D);
    // 实时物价就绪后自动刷新本视图（若当前正在看）
    if (D.livePrice && D.livePrice.onChange) {
      D.livePrice.onChange(function () {
        if (document.getElementById("itBadge")) D.render("items");
      });
    }
  }

  function reg(D) {
    D.VIEWS.items = {
      html: function () { return renderItems(D); },
      init: function () { initItems(D); }
    };
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
