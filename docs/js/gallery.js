/* =========================================================
 * gallery.js — 收藏馆 · 大红图鉴 + 海报
 * 数据：data.json.collectibles（name/type/value/tip）
 * 点击卡标记拥有（localStorage），进度统计，canvas 生成分享海报。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(n){return Number(n||0).toLocaleString();}
  var LS = "df_gallery_owned";

  function load() { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  function reg(D) {
    D.VIEWS.gallery = {
      html: function () {
        return '<div class="section-title">收藏馆 · 大红图鉴</div>' +
          '<p class="guide-intro">收录全游戏高价值收集品，点击卡片标记是否拥有（仅本地记录）。可一键生成分享海报。</p>' +
          '<div class="gl-bar">' +
            '<div class="gl-prog"><div class="gl-prog-fill" id="glFill"></div></div>' +
            '<span class="gl-prog-txt" id="glTxt"></span>' +
            '<button class="btn-ghost" id="glPoster">生成海报</button>' +
            '<button class="btn-ghost" id="glReset">重置拥有</button>' +
          '</div>' +
          '<div class="gl-grid" id="glGrid"><div class="kk-empty">加载中…</div></div>' +
          '<canvas id="glCanvas" width="720" height="1080" style="display:none"></canvas>';
      },
      init: function () {
        var DATA = D.getData() || {};
        var list = (DATA.collectibles || []).slice();
        if (!list.length) { document.getElementById("glGrid").innerHTML = '<div class="kk-empty">暂无收集品数据</div>'; return; }
        var owned = load();

        function inOwned(n) { return owned.indexOf(n) >= 0; }

        function render() {
          owned = load();
          document.getElementById("glGrid").innerHTML = list.map(function (c) {
            var has = inOwned(c.name);
            return '<div class="gl-card' + (has ? ' gl-has' : '') + '" data-name="' + esc(c.name) + '">' +
              '<div class="gl-top">' + (has ? '✅' : '⬜') + '</div>' +
              '<div class="gl-name">' + esc(c.name) + '</div>' +
              '<div class="gl-val">估值 ' + fmt(c.value) + '</div>' +
              (c.tip ? '<div class="gl-tip">' + esc(c.tip) + '</div>' : '') +
            '</div>';
          }).join("");
          document.querySelectorAll("#glGrid .gl-card").forEach(function (card) {
            card.addEventListener("click", function () {
              var n = card.getAttribute("data-name");
              var o = load();
              if (o.indexOf(n) >= 0) o = o.filter(function (x) { return x !== n; });
              else o.push(n);
              save(o); render();
            });
          });
          var pct = Math.round(owned.length / list.length * 100);
          document.getElementById("glFill").style.width = pct + '%';
          document.getElementById("glTxt").textContent = '已拥有 ' + owned.length + ' / ' + list.length;
        }

        document.getElementById("glReset").addEventListener("click", function () {
          if (confirm("确定清空已拥有的标记？")) { save([]); render(); }
        });
        document.getElementById("glPoster").addEventListener("click", function () { genPoster(list, load()); });

        render();
      }
    };

    function genPoster(list, owned) {
      var cv = document.getElementById("glCanvas");
      if (!cv || !cv.getContext) { alert("当前浏览器不支持海报生成"); return; }
      var ctx = cv.getContext("2d");
      var g = ctx.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, "#0f1115"); g.addColorStop(1, "#1a1f2b");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 1080);
      ctx.fillStyle = "#ffb300"; ctx.font = "bold 52px sans-serif";
      ctx.fillText("三角洲收藏馆", 40, 90);
      ctx.fillStyle = "#19c3a6"; ctx.font = "34px sans-serif";
      ctx.fillText("我已收集 " + owned.length + " / " + list.length + " 件大红", 40, 150);
      ctx.fillStyle = "#e5e7eb"; ctx.font = "28px sans-serif";
      var y = 220, col = 0;
      var show = owned.slice(0, 16);
      show.forEach(function (n) {
        var x = 40 + col * 340;
        ctx.fillText("✅ " + n, x, y);
        y += 48; if (y > 1000) { y = 220; col = 1; }
      });
      if (!show.length) { ctx.fillStyle = "#9ca3af"; ctx.fillText("（还没有标记任何收藏）", 40, 240); }
      try {
        var url = cv.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url; a.download = "delta-gallery.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (e) { alert("海报生成失败：" + e.message); }
    }
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
