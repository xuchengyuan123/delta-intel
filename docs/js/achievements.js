/* =========================================================
 * achievements.js — 成就墙 / 徽章盒
 *
 * 数据：内置成就列表（可被 data.json.achievements 覆盖）。
 * 机制：成就由你自行标记「已获得」（纯本地，不联网、不上传）。
 *   进度条展示收集度；可一键生成「我的成就墙」分享海报（canvas 下载）。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  var KEY = "df_achievements_v1";

  // 内置默认成就（分档：青铜/白银/黄金/钻石/传说）
  var DEFAULTS = [
    { id: "a_signin",  name: "初出茅庐",   tier: "青铜", ico: "🪙", desc: "完成第一次每日签到" },
    { id: "a_copy",    name: "抄作业",     tier: "青铜", ico: "🔫", desc: "复制第一个改枪码" },
    { id: "a_codex",   name: "看图说话",   tier: "青铜", ico: "📖", desc: "查看任意图鉴条目" },
    { id: "a_pass",    name: "密码通",     tier: "白银", ico: "🔑", desc: "记住 5 张地图密码" },
    { id: "a_build3",  name: "改枪学徒",   tier: "白银", ico: "🛠", desc: "收藏 3 套改枪方案" },
    { id: "a_forum",   name: "论坛萌新",   tier: "白银", ico: "💬", desc: "发布第一条论坛帖子" },
    { id: "a_build10", name: "改枪大师",   tier: "黄金", ico: "🎯", desc: "抄过 10 套改枪码" },
    { id: "a_asala",   name: "收藏家",     tier: "黄金", ico: "🃏", desc: "集齐阿萨拉牌盒 54+1" },
    { id: "a_price20", name: "物价猎人",   tier: "黄金", ico: "💹", desc: "记录 20 次价格快照" },
    { id: "a_full5",   name: "满改土豪",   tier: "钻石", ico: "💎", desc: "拥有 5 套满改方案" },
    { id: "a_friend",  name: "战友遍布",   tier: "钻石", ico: "🤝", desc: "添加 10 位好友" },
    { id: "a_zhanji",  name: "战绩达人",   tier: "钻石", ico: "📊", desc: "绑定战绩查询" },
    { id: "a_veteran", name: "情报台元老", tier: "传说", ico: "👑", desc: "连续签到 30 天" },
    { id: "a_all",     name: "全能情报员", tier: "传说", ico: "🏆", desc: "解锁全部其它成就" }
  ];
  var TIER_COLOR = {
    "青铜": "#cd7f32", "白银": "#9fb3c8", "黄金": "#ffb300",
    "钻石": "#19c3a6", "传说": "#b06bff"
  };

  function list(D) {
    var d = D.getData && D.getData();
    if (d && Array.isArray(d.achievements) && d.achievements.length) return d.achievements;
    return DEFAULTS;
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function reg(D) {
    D.VIEWS.achievements = {
      html: function () {
        return '<div class="section-title">成就墙 / 徽章盒</div>' +
          '<p class="guide-intro">成就由你自行标记「已获得」（纯本地保存，不联网、不上传）。点亮全部徽章后可生成分享海报。</p>' +
          '<div class="ac-bar">' +
            '<div class="ac-progress"><div class="ac-progress-fill" id="acFill"></div>' +
              '<span class="ac-progress-txt" id="acTxt">0 / 0</span></div>' +
            '<div class="ac-actions">' +
              '<button class="btn-ghost" id="acAll">全部点亮</button>' +
              '<button class="btn-ghost" id="acReset">重置</button>' +
              '<button class="btn-primary" id="acPoster">生成分享海报</button>' +
            '</div>' +
          '</div>' +
          '<div class="ac-grid" id="acGrid"><div class="kk-empty">加载中…</div></div>' +
          '<canvas id="acCanvas" width="600" height="800" style="display:none"></canvas>';
      },
      init: function () {
        var items = list(D);
        var got = load();
        var grid = document.getElementById("acGrid");

        function render() {
          var done = 0;
          grid.innerHTML = items.map(function (a) {
            var on = !!got[a.id];
            if (on) done++;
            var col = TIER_COLOR[a.tier] || "#888";
            return '<div class="ac-badge' + (on ? " on" : "") + '" data-id="' + esc(a.id) + '" style="--bc:' + col + '">' +
              '<div class="ac-badge-ico">' + (on ? esc(a.ico) : "🔒") + '</div>' +
              '<div class="ac-badge-name">' + esc(a.name) + '</div>' +
              '<div class="ac-badge-tier">' + esc(a.tier) + '</div>' +
              '<div class="ac-badge-desc">' + esc(a.desc) + '</div>' +
              (on ? '<div class="ac-badge-ok">已获得 ✓</div>' : '<div class="ac-badge-ok off">点击点亮</div>') +
            '</div>';
          }).join("");
          var total = items.length;
          var pct = total ? Math.round(done / total * 100) : 0;
          var fill = document.getElementById("acFill");
          var txt = document.getElementById("acTxt");
          if (fill) fill.style.width = pct + "%";
          if (txt) txt.textContent = done + " / " + total + " · " + pct + "%";
          grid.querySelectorAll(".ac-badge").forEach(function (el) {
            el.addEventListener("click", function () {
              var id = el.getAttribute("data-id");
              got[id] = !got[id];
              save(got);
              render();
            });
          });
        }
        render();

        var allBtn = document.getElementById("acAll");
        if (allBtn) allBtn.addEventListener("click", function () {
          items.forEach(function (a) { got[a.id] = true; }); save(got); render();
        });
        var resetBtn = document.getElementById("acReset");
        if (resetBtn) resetBtn.addEventListener("click", function () {
          if (confirm("确定清空所有已点亮成就？")) { got = {}; save(got); render(); }
        });
        var posterBtn = document.getElementById("acPoster");
        if (posterBtn) posterBtn.addEventListener("click", function () { drawPoster(items, got); });
      }
    };

    function drawPoster(items, got) {
      var cv = document.getElementById("acCanvas");
      if (!cv) return;
      var ctx = cv.getContext("2d");
      var W = cv.width, H = cv.height;
      // 背景
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#1a1f2b"); g.addColorStop(1, "#0f1320");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 标题
      ctx.fillStyle = "#ffb300"; ctx.font = "bold 30px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center"; ctx.fillText("三角洲情报台 · 成就墙", W / 2, 64);
      var done = items.filter(function (a) { return got[a.id]; }).length;
      ctx.fillStyle = "#cfd6e4"; ctx.font = "18px 'Microsoft YaHei', sans-serif";
      ctx.fillText("已点亮 " + done + " / " + items.length + " 枚徽章", W / 2, 98);
      // 徽章网格
      var cols = 4, cellW = W / cols, startY = 140, cellH = 130;
      items.forEach(function (a, i) {
        var r = Math.floor(i / cols), c = i % cols;
        var x = c * cellW + cellW / 2, y = startY + r * cellH + 46;
        var on = !!got[a.id];
        var col = TIER_COLOR[a.tier] || "#888";
        ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fillStyle = on ? col : "#2a3142"; ctx.fill();
        ctx.textAlign = "center";
        ctx.font = "30px sans-serif"; ctx.fillStyle = "#fff";
        ctx.fillText(on ? a.ico : "🔒", x, y + 10);
        ctx.font = "15px 'Microsoft YaHei', sans-serif";
        ctx.fillStyle = on ? "#e7ecf5" : "#7a8295";
        ctx.fillText(a.name, x, y + 54);
        ctx.font = "12px 'Microsoft YaHei', sans-serif"; ctx.fillStyle = col;
        ctx.fillText(a.tier, x, y + 74);
      });
      // 页脚
      ctx.fillStyle = "#6b7280"; ctx.font = "13px 'Microsoft YaHei', sans-serif";
      ctx.fillText("由 三角洲情报台 生成 · " + new Date().toLocaleDateString("zh-CN"), W / 2, H - 24);
      // 下载
      try {
        var url = cv.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url; a.download = "三角洲情报台-成就墙.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (e) { alert("海报生成失败：" + e.message); }
    }
  }

  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
