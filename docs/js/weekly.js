/* =========================================================
 * weekly.js — 行动周报（纯前端聚合本地数据，无后端、无地图）
 *
 * 聚合本地已产生的「干员行为数据」，生成本周战报：
 *   - 成就点亮：localStorage["df_achievements_v1"]（id→true）
 *   - 阿萨拉牌盒收集：localStorage["df_asala_v1"]（key→true）
 *   - 收藏馆拥有：localStorage["df_gallery_owned"]（[id,…]）
 *   - 物价快照：localStorage["df_pricetrend_v1"]（[…]）
 * 另提供「本周目标 / 高光 / 最高单局收益」手写区，存本地。
 * 可一键生成分享文本（复制 / 下载 .txt）。
 * ========================================================= */
(function () {
  "use strict";

  var KEY = "df_weekly_v1";

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function reg(D) {
    var esc = D.esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

    var TIER_COLOR = { "青铜": "#cd7f32", "白银": "#9fb3c8", "黄金": "#ffb300", "钻石": "#19c3a6", "传说": "#b06bff" };
    var TIER_ORDER = ["青铜", "白银", "黄金", "钻石", "传说"];

    D.VIEWS.weekly = {
      html: function () {
        return '' +
          '<div class="section-title">📊 行动周报</div>' +
          '<p class="guide-intro">把你在情报台留下的「足迹」汇成一份周报：成就点亮、阿萨拉收藏、收藏馆、物价快照，外加你手写的本周目标与高光。' +
          '<b>全部来自本地浏览器数据，不联网、不上传</b>，可一键生成分享文本。</p>' +
          '<div class="wk-stats" id="wkStats"></div>' +
          '<div class="wk-block">' +
            '<div class="wk-sub">成就档位分布（已点亮）</div>' +
            '<div class="wk-bars" id="wkBars"><div class="kk-empty">加载中…</div></div>' +
          '</div>' +
          '<div class="wk-block">' +
            '<div class="wk-form">' +
              '<label class="wk-label">本周目标</label>' +
              '<textarea id="wkGoals" class="wk-input" rows="3" placeholder="例如：本周要凑齐一套满改 M4A1，并把潮汐监狱典狱长刷满 50 次"></textarea>' +
              '<label class="wk-label">本周高光时刻</label>' +
              '<textarea id="wkHighlight" class="wk-input" rows="3" placeholder="例如：绝密单局带出非洲之心，评价「一颗永流传」！"></textarea>' +
              '<label class="wk-label">本周最高单局收益（哈夫币，可留空）</label>' +
              '<input id="wkBest" class="wk-input" type="number" min="0" step="1000" placeholder="例如 1500000" />' +
            '</div>' +
            '<div class="wk-actions">' +
              '<button class="btn-primary" id="wkSave">保存本周记录</button>' +
              '<button class="btn-ghost" id="wkShare">生成分享文本</button>' +
            '</div>' +
            '<div class="wk-share" id="wkShareBox" style="display:none">' +
              '<textarea id="wkShareText" class="wk-input" rows="10" readonly></textarea>' +
              '<div class="wk-actions">' +
                '<button class="btn-ghost" id="wkCopy">复制</button>' +
                '<button class="btn-ghost" id="wkDownload">下载 .txt</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      },
      init: function () {
        var DATA = D.getData && D.getData();
        var catalog = (DATA && Array.isArray(DATA.achievements)) ? DATA.achievements : [];

        var got = lsGet("df_achievements_v1", {}) || {};
        var asala = lsGet("df_asala_v1", {}) || {};
        var gallery = lsGet("df_gallery_owned", []) || [];
        var price = lsGet("df_pricetrend_v1", []) || [];

        var litCount = Object.keys(got).filter(function (k) { return got[k]; }).length;
        var asalaCount = Object.keys(asala).filter(function (k) { return asala[k]; }).length;
        var galleryCount = Array.isArray(gallery) ? gallery.length : 0;
        var priceCount = Array.isArray(price) ? price.length : 0;

        // 统计已点亮成就的档位分布
        var tierCount = {};
        TIER_ORDER.forEach(function (t) { tierCount[t] = 0; });
        catalog.forEach(function (a) {
          if (got[a.id]) { tierCount[a.tier] = (tierCount[a.tier] || 0) + 1; }
        });

        // ① 概览卡片
        var statsEl = document.getElementById("wkStats");
        if (statsEl) {
          var cards = [
            { n: litCount + " / " + catalog.length, l: "点亮成就", c: "#ffb300" },
            { n: asalaCount + " / 55", l: "阿萨拉牌盒", c: "#ff4d4f" },
            { n: String(galleryCount), l: "收藏馆拥有", c: "#19c3a6" },
            { n: String(priceCount), l: "物价快照", c: "#3a7bd5" }
          ];
          statsEl.innerHTML = cards.map(function (c) {
            return '<div class="wk-card" style="--c:' + c.c + '">' +
              '<div class="wk-card-n">' + esc(c.n) + '</div>' +
              '<div class="wk-card-l">' + esc(c.l) + '</div></div>';
          }).join("");
        }

        // ② 档位条
        var barsEl = document.getElementById("wkBars");
        if (barsEl) {
          var max = 1;
          TIER_ORDER.forEach(function (t) { if (tierCount[t] > max) max = tierCount[t]; });
          barsEl.innerHTML = TIER_ORDER.map(function (t) {
            var v = tierCount[t] || 0;
            var pct = Math.round(v / max * 100);
            var col = TIER_COLOR[t] || "#888";
            return '<div class="wk-bar-row">' +
              '<span class="wk-bar-label" style="color:' + col + '">' + esc(t) + '</span>' +
              '<span class="wk-bar-track"><span class="wk-bar-fill" style="width:' + pct + '%;background:' + col + '"></span></span>' +
              '<span class="wk-bar-val">' + v + '</span>' +
            '</div>';
          }).join("");
        }

        // ③ 载入已保存的本周记录
        var saved = lsGet(KEY, {}) || {};
        var goalsEl = document.getElementById("wkGoals");
        var hlEl = document.getElementById("wkHighlight");
        var bestEl = document.getElementById("wkBest");
        if (goalsEl) goalsEl.value = saved.goals || "";
        if (hlEl) hlEl.value = saved.highlight || "";
        if (bestEl) bestEl.value = saved.bestRun != null ? saved.bestRun : "";

        function buildShare() {
          var lines = [];
          lines.push("【三角洲情报台 · 行动周报】");
          lines.push("生成时间：" + new Date().toLocaleString("zh-CN"));
          lines.push("");
          lines.push("▸ 累计概览");
          lines.push("  点亮成就：" + litCount + " / " + catalog.length);
          lines.push("  阿萨拉牌盒：" + asalaCount + " / 55");
          lines.push("  收藏馆拥有：" + galleryCount);
          lines.push("  物价快照：" + priceCount);
          lines.push("");
          lines.push("▸ 成就档位分布");
          TIER_ORDER.forEach(function (t) { lines.push("  " + t + "：" + (tierCount[t] || 0)); });
          lines.push("");
          lines.push("▸ 本周目标");
          lines.push("  " + (goalsEl && goalsEl.value ? goalsEl.value : "（未填写）"));
          lines.push("");
          lines.push("▸ 本周高光");
          lines.push("  " + (hlEl && hlEl.value ? hlEl.value : "（未填写）"));
          lines.push("");
          lines.push("▸ 本周最高单局收益");
          lines.push("  " + (bestEl && bestEl.value ? Number(bestEl.value).toLocaleString("zh-CN") + " 哈夫币" : "（未填写）"));
          lines.push("");
          lines.push("—— 由 三角洲情报台 生成");
          return lines.join("\n");
        }

        var saveBtn = document.getElementById("wkSave");
        if (saveBtn) saveBtn.addEventListener("click", function () {
          lsSet(KEY, {
            goals: goalsEl ? goalsEl.value : "",
            highlight: hlEl ? hlEl.value : "",
            bestRun: bestEl && bestEl.value ? Number(bestEl.value) : null
          });
          saveBtn.textContent = "已保存 ✓";
          setTimeout(function () { saveBtn.textContent = "保存本周记录"; }, 1500);
        });

        var shareBtn = document.getElementById("wkShare");
        var shareBox = document.getElementById("wkShareBox");
        var shareText = document.getElementById("wkShareText");
        if (shareBtn) shareBtn.addEventListener("click", function () {
          if (shareText) shareText.value = buildShare();
          if (shareBox) shareBox.style.display = "block";
        });

        var copyBtn = document.getElementById("wkCopy");
        if (copyBtn) copyBtn.addEventListener("click", function () {
          if (!shareText) return;
          shareText.select();
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(shareText.value).then(function () { copyBtn.textContent = "已复制 ✓"; setTimeout(function () { copyBtn.textContent = "复制"; }, 1500); });
            } else { document.execCommand("copy"); copyBtn.textContent = "已复制 ✓"; setTimeout(function () { copyBtn.textContent = "复制"; }, 1500); }
          } catch (e) { document.execCommand("copy"); }
        });

        var dlBtn = document.getElementById("wkDownload");
        if (dlBtn) dlBtn.addEventListener("click", function () {
          if (!shareText) return;
          var blob = new Blob([shareText.value], { type: "text/plain;charset=utf-8" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = "三角洲情报台-行动周报.txt";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }
    };

    // 视图样式（仅注入一次）
    D.addStyle("wk-style", '' +
      '.wk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0 18px}' +
      '.wk-card{background:linear-gradient(135deg,color-mix(in srgb,var(--c) 18%,#fff),#fff);border:1px solid color-mix(in srgb,var(--c) 35%,#e5e7eb);border-radius:14px;padding:14px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.05)}' +
      '.wk-card-n{font-size:22px;font-weight:800;color:var(--c)}' +
      '.wk-card-l{font-size:12px;color:#6b7280;margin-top:4px}' +
      '.wk-block{background:#fff;border:1px solid #eef0f4;border-radius:14px;padding:16px;margin-bottom:16px}' +
      '.wk-sub{font-weight:700;margin-bottom:10px;color:#1f2533}' +
      '.wk-bar-row{display:flex;align-items:center;gap:10px;margin:7px 0}' +
      '.wk-bar-label{width:48px;font-size:13px;font-weight:700;text-align:right;flex:none}' +
      '.wk-bar-track{flex:1;height:14px;background:#eef1f6;border-radius:8px;overflow:hidden}' +
      '.wk-bar-fill{display:block;height:100%;border-radius:8px;transition:width .4s}' +
      '.wk-bar-val{width:30px;text-align:left;font-size:13px;color:#6b7280;flex:none}' +
      '.wk-form{display:flex;flex-direction:column;gap:6px}' +
      '.wk-label{font-size:13px;font-weight:600;color:#374151;margin-top:6px}' +
      '.wk-input{width:100%;border:1px solid #d8dde6;border-radius:10px;padding:10px;font:inherit;color:#1f2937;background:#fbfcfe;box-sizing:border-box;resize:vertical}' +
      '.wk-input:focus{outline:none;border-color:#19c3a6;box-shadow:0 0 0 3px rgba(25,195,166,.15)}' +
      '.wk-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}' +
      '.wk-share{margin-top:14px}' +
      '@media(max-width:640px){.wk-stats{grid-template-columns:repeat(2,1fr)}}'
    );
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
