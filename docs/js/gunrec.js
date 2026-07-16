/* =========================================================
 * gunrec.js — 个性化改枪推荐
 * 数据：data.json.gunBuilds（改枪方案）
 * 选模式 + 用途，按标签权重 + 武器人气评分推荐 Top5，复制改枪码。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  var WEAPON_POP = {
    "M4A1": 12, "AKM": 9, "AK-12": 8, "M250": 8, "ASVAL": 8, "QBZ95-1": 7,
    "AUG": 7, "M7": 7, "K416": 9, "SCAR-H": 7, "AWM": 10, "M700": 6,
    "SR-25": 7, "M14": 6, "MP5": 7, "Vector": 7, "P90": 6, "UTS-15": 5
  };
  function hash20(str) { str = String(str || ""); var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h % 21; }

  function copyCode(code) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code); return true; } } catch (e) {}
    try { var ta = document.createElement("textarea"); ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { return false; }
  }

  var PURPOSE_WEIGHT = {
    "新手": { "新手": 14, "性价比": 10, "低配": 10, "通用": 6 },
    "性价比": { "性价比": 14, "低配": 10, "通用": 8, "满改": -4 },
    "机密": { "机密": 15, "满改": 10, "高配": 8 },
    "绝密": { "绝密": 16, "满改": 12, "机密": 8 },
    "架枪": { "架枪": 14, "狙击": 8, "射手步枪": 6 },
    "狙击": { "狙击": 16, "架枪": 8, "射手步枪": 8 },
    "打架": { "高配": 10, "满改": 10, "通用": 6 },
    "跑刀": { "低配": 12, "性价比": 8, "新手": 6 }
  };

  function reg(D) {
    D.VIEWS.gunrec = {
      html: function () {
        return '<div class="section-title">个性化改枪推荐</div>' +
          '<p class="guide-intro">选「模式 + 用途」，从改枪码大全里为你排序推荐 Top5。匹配度为本站估算（综合用途标签权重 + 武器人气）。</p>' +
          '<div class="gr-bar">' +
            '<div class="gr-filters" id="grMode">' +
              '<button class="gr-f active" data-mode="全部">全部模式</button>' +
              '<button class="gr-f" data-mode="烽火地带">烽火地带</button>' +
              '<button class="gr-f" data-mode="全面战场">全面战场</button>' +
            '</div>' +
            '<select class="gr-weapon" id="grPurpose">' +
              '<option value="新手">新手开荒</option>' +
              '<option value="性价比">性价比</option>' +
              '<option value="机密">机密图</option>' +
              '<option value="绝密">绝密图</option>' +
              '<option value="架枪">架枪架点</option>' +
              '<option value="狙击">狙击</option>' +
              '<option value="打架">正面打架</option>' +
              '<option value="跑刀">跑刀摸金</option>' +
            '</select>' +
          '</div>' +
          '<div id="grBody"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var builds = (DATA.gunBuilds || []).slice();
        if (!builds.length) { document.getElementById("grBody").innerHTML = '<div class="kk-empty">暂无改枪方案</div>'; return; }
        var curMode = "全部", curPurpose = "新手";

        function score(b) {
          var w = PURPOSE_WEIGHT[curPurpose] || {};
          var s = 30;
          (b.tags || []).forEach(function (t) { if (w[t]) s += w[t]; });
          s += WEAPON_POP[String(b.weapon || "")] || 4;
          s += hash20(b.code || b.name || "") * 0.3;
          return Math.round(s * 10) / 10;
        }

        function render() {
          var list = builds.filter(function (b) {
            if (curMode !== "全部" && b.mode !== curMode) return false;
            return true;
          });
          list.forEach(function (b) { b._score = score(b); });
          list.sort(function (a, b) { return b._score - a._score; });
          list = list.slice(0, 5);
          if (!list.length) { document.getElementById("grBody").innerHTML = '<div class="kk-empty">当前筛选无方案</div>'; return; }
          document.getElementById("grBody").innerHTML = list.map(function (b, i) {
            var pct = Math.min(100, Math.round(b._score / 1.2));
            return '<div class="gr-card">' +
              '<div class="gr-rank">' + (i + 1) + '</div>' +
              '<div class="gr-main">' +
                '<div class="gr-name">' + esc(b.name) + '</div>' +
                '<div class="gr-meta"><span class="gr-weapon">' + esc(b.weapon) + '</span><span class="gr-mode">' + esc(b.mode || "—") + '</span>' +
                  (b.author ? '<span class="gr-author">by ' + esc(b.author) + '</span>' : '') + '</div>' +
                '<div class="gr-tags">' + (b.tags || []).map(function (t) { return '<span class="gr-tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
                (b.desc ? '<div class="gr-desc">' + esc(b.desc) + '</div>' : '') +
                '<div class="gr-foot"><span class="gr-price">参考价 ' + esc(b.price || "—") + '</span>' +
                  '<button class="gr-copy btn-ghost" data-code="' + esc(b.code || "") + '">复制改枪码</button></div>' +
                '<div class="gr-scorebar"><div class="gr-scorefill" style="width:' + pct + '%"></div></div>' +
                '<div class="gr-scoretxt">匹配度 ' + b._score + '</div>' +
              '</div>' +
            '</div>';
          }).join("");
          document.querySelectorAll("#grBody .gr-copy").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var ok = copyCode(btn.getAttribute("data-code"));
              var old = btn.textContent; btn.textContent = ok ? "已复制 ✓" : "复制失败";
              setTimeout(function () { btn.textContent = old; }, 1400);
            });
          });
        }
        document.querySelectorAll("#grMode .gr-f").forEach(function (btn) {
          btn.addEventListener("click", function () {
            curMode = btn.getAttribute("data-mode");
            document.querySelectorAll("#grMode .gr-f").forEach(function (x) { x.classList.remove("active"); });
            btn.classList.add("active"); render();
          });
        });
        document.getElementById("grPurpose").onchange = function () { curPurpose = this.value; render(); };
        render();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
