/* =========================================================
 * asala.js — 阿萨拉牌盒收集（S10 裂变赛季收藏）
 *
 * 背景：S10「裂变」赛季红色品质手工收藏品「阿萨拉牌盒」。
 *   内含 54 张扑克（4 花色 2-10 / JQK / A + 大小王），集齐 54 张 + 牌盒后
 *   可在对局内玩「斗地主」，并解锁赛季收藏徽章。
 *   牌/盒均不可交易（无拍卖行），只能局内拾取。
 * 掉率分档：红(牌盒/大王 0.1%) 金(小王) 紫(4 张 A) 蓝(JQK) 绿(2-10)
 * 高掉率容器：大小保险箱 / 衣服 / 鸟窝 / 桌面盒 / 手提箱
 * 推荐地图：零号大坝(机密) / AZ3 核电站 / 长弓溪谷
 *
 * 机制：本页是本地的收集进度追踪器（纯本地，不联网）。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  var KEY = "df_asala_v1";
  var TIER_COLOR = { "红": "#ff4d4f", "金": "#ffb300", "紫": "#b06bff", "蓝": "#3a7bd5", "绿": "#2ecc71" };
  var TIER_ORDER = ["红", "金", "紫", "蓝", "绿"];

  // 生成 54 张牌 + 牌盒
  function buildCards() {
    var suits = [
      { s: "♠", n: "黑桃" }, { s: "♥", n: "红心" }, { s: "♦", n: "方块" }, { s: "♣", n: "梅花" }
    ];
    var ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    var cards = [];
    suits.forEach(function (su) {
      ranks.forEach(function (rk) {
        var tier = rk === "A" ? "紫" : (rk === "J" || rk === "Q" || rk === "K") ? "蓝" : "绿";
        cards.push({ key: su.s + rk, label: su.s + " " + rk, tier: tier, sub: su.n + " " + rk });
      });
    });
    // 大小王
    cards.push({ key: "大王", label: "大王", tier: "红", sub: "红色品质 · 0.1%" });
    cards.push({ key: "小王", label: "小王", tier: "金", sub: "金色品质" });
    // 牌盒
    cards.push({ key: "box", label: "阿萨拉牌盒", tier: "红", sub: "红色品质 · 0.1% · 集齐解锁" });
    return cards;
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function reg(D) {
    D.VIEWS.asala = {
      html: function () {
        return '<div class="section-title">阿萨拉牌盒收集 <span class="kk-api">S10 裂变</span></div>' +
          '<p class="guide-intro">S10「裂变」赛季红色手工收藏品。集齐 <strong>54 张牌 + 牌盒</strong> 后可在对局内玩「斗地主」并解锁赛季收藏徽章。' +
          '牌与盒均<strong>不可交易</strong>，只能局内拾取。本页是本地收集进度追踪器。</p>' +
          '<div class="as-bar">' +
            '<div class="as-progress"><div class="as-progress-fill" id="asFill"></div>' +
              '<span class="as-progress-txt" id="asTxt">0 / 55</span></div>' +
            '<div class="as-actions">' +
              '<button class="btn-ghost" id="asDraw">模拟开一包</button>' +
              '<button class="btn-ghost" id="asAll">全部标记已得</button>' +
              '<button class="btn-ghost" id="asReset">重置</button>' +
            '</div>' +
          '</div>' +
          '<div id="asBody"><div class="kk-empty">加载中…</div></div>' +
          '<div class="as-guide">' +
            '<div class="as-guide-h">🎯 高效 farming 指南（来自社区整理）</div>' +
            '<div class="as-guide-row"><b>高掉率容器：</b>大小保险箱 · 衣服 · 鸟窝 · 桌面盒 · 手提箱</div>' +
            '<div class="as-guide-row"><b>推荐地图：</b>零号大坝（机密）· AZ3 核电站 · 长弓溪谷</div>' +
            '<div class="as-guide-row"><b>掉率分档：</b>' +
              '<span class="as-tier" style="background:' + TIER_COLOR["红"] + '">红 牌盒/大王 0.1%</span>' +
              '<span class="as-tier" style="background:' + TIER_COLOR["金"] + '">金 小王</span>' +
              '<span class="as-tier" style="background:' + TIER_COLOR["紫"] + '">紫 四张A</span>' +
              '<span class="as-tier" style="background:' + TIER_COLOR["蓝"] + '">蓝 JQK</span>' +
              '<span class="as-tier" style="background:' + TIER_COLOR["绿"] + '">绿 2-10</span>' +
            '</div>' +
            '<div class="as-guide-row as-tip">提示：红/金档极稀有，建议优先刷大小保险箱；集齐 54 张后牌盒往往最后入手。</div>' +
          '</div>';
      },
      init: function () {
        var cards = buildCards();
        var got = load();
        var body = document.getElementById("asBody");

        function render() {
          var done = 0;
          var html = TIER_ORDER.map(function (tier) {
            var col = TIER_COLOR[tier];
            var grp = cards.filter(function (c) { return c.tier === tier; });
            var tiles = grp.map(function (c) {
              var on = !!got[c.key];
              if (on) done++;
              return '<div class="as-card tier-' + tier + (on ? " on" : "") + '" data-key="' + esc(c.key) + '" style="--tc:' + col + '">' +
                '<div class="as-card-face">' + (on ? esc(c.label) : "?") + '</div>' +
                (on ? '<div class="as-card-ok">✓</div>' : '') +
              '</div>';
            }).join("");
            return '<div class="as-group"><div class="as-group-h" style="color:' + col + '">' + tier + '档（' + grp.length + '）</div><div class="as-group-grid">' + tiles + '</div></div>';
          }).join("");
          body.innerHTML = html;

          var total = cards.length;
          var pct = total ? Math.round(done / total * 100) : 0;
          var fill = document.getElementById("asFill");
          var txt = document.getElementById("asTxt");
          if (fill) fill.style.width = pct + "%";
          if (txt) txt.textContent = done + " / " + total + " · " + pct + "%" + (done === total ? " 🎉 集齐！" : "");

          body.querySelectorAll(".as-card").forEach(function (el) {
            el.addEventListener("click", function () {
              var k = el.getAttribute("data-key");
              got[k] = !got[k]; save(got); render();
            });
          });
        }
        render();

        var allBtn = document.getElementById("asAll");
        if (allBtn) allBtn.addEventListener("click", function () {
          cards.forEach(function (c) { got[c.key] = true; }); save(got); render();
        });
        var resetBtn = document.getElementById("asReset");
        if (resetBtn) resetBtn.addEventListener("click", function () {
          if (confirm("确定清空全部收集进度？")) { got = {}; save(got); render(); }
        });
        var drawBtn = document.getElementById("asDraw");
        if (drawBtn) drawBtn.addEventListener("click", function () {
          var missing = cards.filter(function (c) { return !got[c.key]; });
          if (!missing.length) { alert("已经集齐啦！🎉"); return; }
          var pick = missing[Math.floor(Math.random() * missing.length)];
          got[pick.key] = true; save(got); render();
        });
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
