/* =========================================================
 * keycard.js — 钥匙卡补卡预测
 * 基于社区经验：钥匙卡约每 4 小时整点刷新一批。推测今日补卡时间窗口。
 * ⚠️ 非官方数据，仅供参考。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  // 经验补卡时段（每约 4 小时的整点窗口，非官方）
  var RESTOCK_HOURS = [0, 4, 8, 12, 16, 20];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function reg(D) {
    D.VIEWS.keycard = {
      html: function () {
        return '<div class="section-title">钥匙卡补卡预测</div>' +
          '<p class="guide-intro">基于社区经验，钥匙卡约每 4 小时整点刷新一批。<strong>本预测为非官方推测，仅供参考。</strong></p>' +
          '<div id="kcBody"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var now = new Date();
        var windows = [];
        for (var d = 0; d < 2; d++) {
          RESTOCK_HOURS.forEach(function (h) {
            var dt = new Date(now); dt.setDate(now.getDate() + d); dt.setHours(h, 0, 0, 0);
            if (dt.getTime() > now.getTime()) windows.push({ dt: dt, today: d === 0 });
          });
        }
        windows = windows.slice(0, 6);
        var html = '<div class="kk-api kc-note">⚠️ 非官方数据，实际以游戏内为准</div>' +
          '<div class="kc-list">' + windows.map(function (w) {
            var diff = Math.round((w.dt.getTime() - now.getTime()) / 60000);
            var hm = pad(w.dt.getHours()) + ":00";
            var dayLabel = w.today ? "今天" : "明天";
            var soon = diff <= 60
              ? ('<span class="profit-up">约 ' + diff + ' 分钟后</span>')
              : ('约 ' + (Math.floor(diff / 60)) + ' 小时 ' + (diff % 60) + ' 分');
            return '<div class="kc-row">' +
              '<div class="kc-time">' + dayLabel + ' ' + hm + '</div>' +
              '<div class="kc-count">' + soon + '</div>' +
            '</div>';
          }).join("") + '</div>' +
          '<p class="guide-intro">建议在这些时段前后刷新商店/卡池，提高抢到热门钥匙卡的概率。</p>';
        document.getElementById("kcBody").innerHTML = html;
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
