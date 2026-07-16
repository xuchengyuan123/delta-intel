/* =========================================================
 * sens.js — 灵敏度布局库
 * 数据：data.json.sens（可选，缺失时展示内置示例）
 * 查看预设、复制分享码、双方案对比。后台「灵敏度库」可维护真实数据。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}

  // 内置示例预设（DATA.sens 为空时展示，可在后台补充真实数据）
  var BUILTIN = [
    { name: "通用·稳定流", device: "鼠标", dpi: 800, game: 5.0, scope: 35, vert: 1.0, ads: 1.0, remark: "新手友好，压枪稳定", example: true },
    { name: "狙击·精细流", device: "鼠标", dpi: 400, game: 3.2, scope: 18, vert: 0.8, ads: 1.2, remark: "开镜细，适合栓动狙", example: true },
    { name: "冲锋·灵敏流", device: "鼠标", dpi: 1600, game: 8.0, scope: 50, vert: 1.2, ads: 0.9, remark: "近战转身快", example: true }
  ];

  function allPresets(D) {
    var DATA = D.getData() || {};
    var arr = (DATA.sens || []).slice();
    BUILTIN.forEach(function (b) { if (!arr.some(function (x) { return x.name === b.name; })) arr.push(b); });
    return arr;
  }

  function codeOf(p) {
    return "DPI" + (p.dpi || 0) + "|G" + (p.game || 0) + "|S" + (p.scope || 0) + "|V" + (p.vert || 0) + "|A" + (p.ads || 0);
  }
  function copyCode(code) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code); return true; } } catch (e) {}
    try { var ta = document.createElement("textarea"); ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { return false; }
  }

  function reg(D) {
    D.VIEWS.sens = {
      html: function () {
        return '<div class="section-title">灵敏度布局库</div>' +
          '<p class="guide-intro">收录主播/高玩灵敏度预设，一键复制分享码，也可选两套方案对比。数据可在后台「灵敏度库」维护。</p>' +
          '<div class="sens-bar">' +
            '<select class="sens-sel" id="sensA"><option value="">对比方案 A</option></select>' +
            '<select class="sens-sel" id="sensB"><option value="">对比方案 B（可选）</option></select>' +
          '</div>' +
          '<div id="sensBody"><div class="kk-empty">加载中…</div></div>';
      },
      init: function () {
        var presets = allPresets(D);
        if (!presets.length) { document.getElementById("sensBody").innerHTML = '<div class="kk-empty">暂无灵敏度预设</div>'; return; }
        var optGen = function () { return presets.map(function (p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join(""); };
        document.getElementById("sensA").innerHTML = '<option value="">对比方案 A</option>' + optGen();
        document.getElementById("sensB").innerHTML = '<option value="">对比方案 B（可选）</option>' + optGen();
        var aEl = document.getElementById("sensA"), bEl = document.getElementById("sensB");

        function card(p) {
          var tag = p.example ? ' <span class="kk-api">示例</span>' : '';
          return '<div class="sens-card">' +
            '<div class="sens-name">' + esc(p.name) + tag + '</div>' +
            '<div class="sens-device">' + (p.device || "鼠标") + ' · DPI ' + (p.dpi || "?") + '</div>' +
            '<div class="sens-grid">' +
              '<div><span>游戏灵敏度</span><b>' + (p.game || "-") + '</b></div>' +
              '<div><span>开镜倍率</span><b>' + (p.scope || "-") + '</b></div>' +
              '<div><span>垂直灵敏度</span><b>' + (p.vert || "-") + '</b></div>' +
              '<div><span>开火灵敏度</span><b>' + (p.ads || "-") + '</b></div>' +
            '</div>' +
            (p.remark ? '<div class="sens-remark">' + esc(p.remark) + '</div>' : '') +
            '<div class="sens-foot">' +
              '<code class="sens-code">' + esc(codeOf(p)) + '</code>' +
              '<button class="sens-copy btn-ghost" data-code="' + esc(codeOf(p)) + '">复制分享码</button>' +
            '</div>' +
          '</div>';
        }

        function render() {
          var ia = aEl.value, ib = bEl.value;
          var html = "";
          if (ia !== "") html += '<div class="sens-col"><div class="sens-col-h">A</div>' + card(presets[+ia]) + '</div>';
          if (ib !== "") html += '<div class="sens-col"><div class="sens-col-h">B</div>' + card(presets[+ib]) + '</div>';
          if (ia === "" && ib === "") html = presets.map(card).join("");
          document.getElementById("sensBody").innerHTML = html || '<div class="kk-empty">请选择方案</div>';
          document.querySelectorAll("#sensBody .sens-copy").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var ok = copyCode(btn.getAttribute("data-code"));
              var old = btn.textContent; btn.textContent = ok ? "已复制 ✓" : "复制失败";
              setTimeout(function () { btn.textContent = old; }, 1400);
            });
          });
        }
        aEl.onchange = render; bEl.onchange = render; render();
      }
    };
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
