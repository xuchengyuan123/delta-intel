/* =========================================================
 * gunrank.js — 改枪热度榜（T 度分级）
 *
 * 数据：data.json.gunBuilds（改枪方案列表）
 * 热度算法：综合「标签权重 + 武器人气 + 改枪码哈希」得出一个
 *   稳定的「热度指数」。若某条数据自带 heat 字段，则优先使用。
 *   ⚠️ 此热度为本站估算，非官方数据，仅作参考与娱乐。
 * 交互：按 烽火地带 / 全面战场 切换；按武器筛选；一键复制改枪码。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  // 标签权重（命中即累加）
  var TAG_WEIGHT = {
    "绝密": 22, "满改": 18, "机密": 15, "高配": 12, "性价比": 12,
    "狙击": 11, "架枪": 9, "新手": 8, "通用": 6, "突击步枪": 6,
    "低配": 4, "冲锋枪": 5, "机枪": 5, "射手步枪": 6, "霰弹枪": 5, "手枪": 3
  };
  // 武器人气（基础分）
  var WEAPON_POP = {
    "M4A1": 12, "AKM": 9, "AK-12": 8, "M250": 8, "ASVAL": 8, "QBZ95-1": 7,
    "AUG": 7, "M7": 7, "K416": 9, "SCAR-H": 7, "AWM": 10, "M700": 6,
    "SR-25": 7, "M14": 6, "MP5": 7, "Vector": 7, "P90": 6, "UTS-15": 5
  };

  // 稳定的字符串哈希（djb2）→ 0..20
  function hash20(str) {
    str = String(str || "");
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h % 21; // 0..20
  }

  function heatFor(b) {
    if (b && typeof b.heat === "number") return b.heat;
    var score = 40; // 基础分
    (b.tags || []).forEach(function (t) { if (TAG_WEIGHT[t]) score += TAG_WEIGHT[t]; });
    var w = String(b.weapon || "");
    score += WEAPON_POP[w] || 4;
    score += hash20(b.code || b.name || "");
    return Math.min(99, Math.round(score));
  }

  // T 度分级阈值
  function tierOf(h) {
    if (h >= 82) return "T0";
    if (h >= 68) return "T1";
    if (h >= 54) return "T2";
    return "T3";
  }
  var TIER_LABEL = { T0: "T0 · 版本之子", T1: "T1 · 强势推荐", T2: "T2 · 可用好用", T3: "T3 · 入门娱乐" };
  var TIER_COLOR = { T0: "#ff4d4f", T1: "#ffb300", T2: "#19c3a6", T3: "#6b7280" };

  function copyCode(code) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
        return true;
      }
    } catch (e) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }

  function reg(D) {
    D.VIEWS.gunrank = {
      html: function () {
        return '<div class="section-title">改枪热度榜 <span class="kk-api">估算</span></div>' +
          '<p class="guide-intro">综合「标签权重 + 武器人气 + 改枪码哈希」得出稳定的<strong>热度指数</strong>，按 T0–T3 分档。' +
          '热度为本站估算（非官方数据），仅供抄作业参考。数据来自后台「改枪码大全」。' +
          '某条方案自带 <code>heat</code> 字段时优先使用该值。</p>' +
          '<div class="gr-bar">' +
            '<div class="gr-filters" id="grFilters">' +
              '<button class="gr-f active" data-mode="全部">全部模式</button>' +
              '<button class="gr-f" data-mode="烽火地带">烽火地带</button>' +
              '<button class="gr-f" data-mode="全面战场">全面战场</button>' +
            '</div>' +
            '<select class="gr-weapon" id="grWeapon"><option value="">全部武器</option></select>' +
          '</div>' +
          '<div id="grBody"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var builds = (DATA.gunBuilds || []).slice();
        if (!builds.length) {
          document.getElementById("grBody").innerHTML = '<div class="kk-empty">暂无改枪方案数据（后台「改枪码大全」中维护）</div>';
          return;
        }
        // 计算热度并排序
        builds.forEach(function (b) { b._heat = heatFor(b); });
        builds.sort(function (a, b) { return b._heat - a._heat; });

        var weapons = [];
        builds.forEach(function (b) { if (weapons.indexOf(b.weapon) < 0) weapons.push(b.weapon); });
        var wsel = document.getElementById("grWeapon");
        wsel.innerHTML = '<option value="">全部武器</option>' +
          weapons.map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + '</option>'; }).join("");

        var curMode = "全部";
        var curWeapon = "";

        function tierBlock(tier, list) {
          if (!list.length) return "";
          var cards = list.map(function (b, i) {
            var rank = i + 1;
            return '<div class="gr-card">' +
              '<div class="gr-rank">' + rank + '</div>' +
              '<div class="gr-main">' +
                '<div class="gr-name">' + esc(b.name) + '</div>' +
                '<div class="gr-meta"><span class="gr-weapon">' + esc(b.weapon) + '</span>' +
                  '<span class="gr-mode">' + esc(b.mode || "—") + '</span>' +
                  (b.author ? '<span class="gr-author">by ' + esc(b.author) + '</span>' : '') + '</div>' +
                '<div class="gr-tags">' + (b.tags || []).map(function (t) { return '<span class="gr-tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
                (b.desc ? '<div class="gr-desc">' + esc(b.desc) + '</div>' : '') +
                '<div class="gr-foot">' +
                  '<span class="gr-price">参考价 ' + esc(b.price || "—") + '</span>' +
                  '<button class="gr-copy btn-ghost" data-code="' + esc(b.code || "") + '">复制改枪码</button>' +
                '</div>' +
              '</div>' +
              '<div class="gr-heat"><span class="gr-heat-n" style="color:' + TIER_COLOR[tier] + '">' + b._heat + '</span><span class="gr-heat-l">热度</span></div>' +
            '</div>';
          }).join("");
          return '<div class="gr-tier">' +
            '<div class="gr-tier-h" style="border-color:' + TIER_COLOR[tier] + '"><span class="gr-tier-dot" style="background:' + TIER_COLOR[tier] + '"></span>' + TIER_LABEL[tier] + '</div>' +
            cards + '</div>';
        }

        function render() {
          var list = builds.filter(function (b) {
            if (curMode !== "全部" && b.mode !== curMode) return false;
            if (curWeapon && b.weapon !== curWeapon) return false;
            return true;
          });
          if (!list.length) { document.getElementById("grBody").innerHTML = '<div class="kk-empty">当前筛选无方案</div>'; return; }
          var tiers = { T0: [], T1: [], T2: [], T3: [] };
          list.forEach(function (b) { tiers[tierOf(b._heat)].push(b); });
          document.getElementById("grBody").innerHTML =
            tierBlock("T0", tiers.T0) + tierBlock("T1", tiers.T1) + tierBlock("T2", tiers.T2) + tierBlock("T3", tiers.T3);
          // 绑定复制
          document.querySelectorAll("#grBody .gr-copy").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var ok = copyCode(btn.getAttribute("data-code"));
              var old = btn.textContent;
              btn.textContent = ok ? "已复制 ✓" : "复制失败";
              setTimeout(function () { btn.textContent = old; }, 1400);
            });
          });
        }

        // 模式筛选
        document.querySelectorAll("#grFilters .gr-f").forEach(function (btn) {
          btn.addEventListener("click", function () {
            curMode = btn.getAttribute("data-mode");
            document.querySelectorAll("#grFilters .gr-f").forEach(function (x) { x.classList.remove("active"); });
            btn.classList.add("active");
            render();
          });
        });
        wsel.onchange = function () { curWeapon = wsel.value; render(); };

        render();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
