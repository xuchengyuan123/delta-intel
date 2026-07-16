/* =========================================================
 * achievements.js — 成就墙 / 徽章盒（双标签）
 *
 * 两个标签：
 *   ① 三角洲行动成就（kind=game）：游戏内真实成就的收集情况，
 *      清单可由后台「成就管理」维护（data.json.achievements）。
 *      因无法绑定腾讯账号，需干员自行勾选「已获得」（纯本地）。
 *   ② 本站成就（kind=site）：在情报台内的行为成就（签到、抄作业等）。
 *
 * 机制：成就由你自行标记「已获得」（纯本地，不联网、不上传）。
 *   进度条展示收集度；可一键生成「我的成就墙」分享海报（canvas 下载）。
 * ========================================================= */
(function () {
  "use strict";

  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}

  var KEY = "df_achievements_v1";

  // 内置默认成就（可被 data.json.achievements 覆盖）。kind: game=三角洲行动 / site=本站
  var DEFAULTS = [
    // ===== 三角洲行动 · 基础成长 =====
    { id: "g_lv10",   name: "初入战场",   tier: "青铜", ico: "🪖", kind: "game", mode: "通用",     category: "基础成长", desc: "干员等级达到 10 级" },
    { id: "g_weapon", name: "军火库",     tier: "青铜", ico: "🔫", kind: "game", mode: "通用",     category: "基础成长", desc: "解锁 10 把不同永久主武器" },
    { id: "g_op3",    name: "干员集结",   tier: "白银", ico: "🪖", kind: "game", mode: "通用",     category: "基础成长", desc: "集齐 3 名不同干员" },
    // ===== 三角洲行动 · 战斗战绩 =====
    { id: "g_k100",   name: "百人斩",     tier: "白银", ico: "⚔",  kind: "game", mode: "通用",     category: "战斗战绩", desc: "累计击杀 100 名敌人" },
    { id: "g_k1000",  name: "千杀统帅",   tier: "黄金", ico: "⚔",  kind: "game", mode: "通用",     category: "战斗战绩", desc: "累计击杀 1000 名敌人" },
    { id: "g_genius", name: "天才少年",   tier: "传说", ico: "🌟", kind: "game", mode: "双模式", category: "战斗战绩", desc: "烽火地带：机密/绝密单局击败12名特战干员；全面战场：晋升之路/胜者为王单局击败140名" },
    { id: "g_tide",   name: "潮汐的救赎", tier: "钻石", ico: "🌊", kind: "game", mode: "烽火地带", category: "战斗战绩", desc: "囚徒状态撤离且单局收获达 100 万" },
    { id: "g_chain",  name: "锁链与自由IV", tier: "钻石", ico: "⛓", kind: "game", mode: "烽火地带", category: "战斗战绩", desc: "潮汐监狱累计击败典狱长与渡鸦各 50 次" },
    { id: "g_godfather", name: "教父IV",  tier: "钻石", ico: "👑", kind: "game", mode: "烽火地带", category: "战斗战绩", desc: "累计击败赛伊德/雷斯/老太各 50 次" },
    { id: "g_beast",  name: "战争巨兽IV", tier: "传说", ico: "🚜", kind: "game", mode: "全面战场", category: "战斗战绩", desc: "①坦克击败35人×100 ②飞行载具击败25人×100 ③战车类载具击败25人×100 ④防空车击败20人或造成2000伤害×100" },
    // ===== 三角洲行动 · 探索收集 =====
    { id: "g_map",    name: "地图通",     tier: "白银", ico: "🗺", kind: "game", mode: "通用",     category: "探索收集", desc: "单张地图找齐全部隐藏彩蛋点" },
    { id: "g_africa", name: "非洲之心(宝石)", tier: "黄金", ico: "💎", kind: "game", mode: "烽火地带", category: "探索收集", desc: "全游戏最稀有宝石；单局带出即获评价「一颗永流传」，带出 5 次解锁成就「钻石大亨IV」" },
    { id: "g_diamond",name: "钻石大亨IV", tier: "传说", ico: "💎", kind: "game", mode: "烽火地带", category: "探索收集", desc: "累计获得评价「一颗永流传」5 次" },
    { id: "g_jewel",  name: "珠宝藏家IV", tier: "钻石", ico: "🔷", kind: "game", mode: "烽火地带", category: "探索收集", desc: "累计获得评价「深海遗珠」5 次" },
    { id: "g_mandel", name: "曼德尔砖收藏家IV", tier: "传说", ico: "🧱", kind: "game", mode: "烽火地带", category: "探索收集", desc: "破译并带出曼德尔砖 400 次" },
    { id: "g_star",   name: "星际拓荒者", tier: "钻石", ico: "🚀", kind: "game", mode: "烽火地带", category: "探索收集", desc: "将「太空配送员」徽章进阶到第二阶段（炫彩勇敢者进化）解锁" },
    { id: "g_birdnest", name: "黄金鸟窝纪念", tier: "黄金", ico: "🪺", kind: "game", mode: "通用",  category: "探索收集", desc: "5 张地图收集 8 个协议箱" },
    // ===== 三角洲行动 · 挑战 / 社交 =====
    { id: "g_lone",   name: "独狼尖兵",   tier: "传说", ico: "🐺", kind: "game", mode: "通用",     category: "挑战", desc: "黑鹰坠落单人最高评价通关全部关卡" },
    // ===== 三角洲行动 · 赛季限定徽章（S8/S9，真实存在）=====
    { id: "g_tiezj",  name: "铁三角",     tier: "钻石", ico: "🔺", kind: "game", mode: "烽火地带", category: "社交互动", desc: "机密/绝密模式小队3人全存活且每人至少击败4名敌方单位（S8）" },
    { id: "g_saiyid", name: "天才赛伊德", tier: "传说", ico: "🎯", kind: "game", mode: "烽火地带", category: "战斗战绩", desc: "赤枭巡猎玩法中单局击败12名特战干员（S8）" },
    { id: "g_hammer", name: "一锤定音",   tier: "钻石", ico: "💥", kind: "game", mode: "全面战场", category: "战斗战绩", desc: "晋升之路/胜者为王单发制导导弹获得8000积分（S8）" },
    { id: "g_hualai", name: "花来",       tier: "钻石", ico: "🌺", kind: "game", mode: "烽火地带", category: "战斗战绩", desc: "击败一名特战干员并完整穿戴其头盔/护甲/主武器/胸挂/背包后撤离（S9）" },
    { id: "g_shuang", name: "好事成双",   tier: "钻石", ico: "🐟", kind: "game", mode: "烽火地带", category: "探索收集", desc: "机密/绝密带出2个相同的9格+红色品质收藏品，暗星燃料除外（S9）" },
    { id: "g_real3",  name: "真铁三角",   tier: "钻石", ico: "🔻", kind: "game", mode: "烽火地带", category: "社交互动", desc: "三人小队全存活且每人至少击败4名敌方特战干员（S9）" },
    { id: "g_kongzhai", name: "空摘",     tier: "钻石", ico: "🚁", kind: "game", mode: "全面战场", category: "战斗战绩", desc: "晋升之路/胜者为王用狙击步枪击落飞行载具驾驶员（S9）" },
    { id: "g_friend10", name: "战友",     tier: "青铜", ico: "🤝", kind: "game", mode: "通用",     category: "社交互动", desc: "添加 10 位游戏好友" },
    { id: "g_team",   name: "战队组建",   tier: "白银", ico: "⚔",  kind: "game", mode: "通用",     category: "社交互动", desc: "加入或创建战队并打 10 局战队赛" },
    // ===== 本站成就（情报台行为） =====
    { id: "a_signin",  name: "初出茅庐",   tier: "青铜", ico: "🪙", kind: "site", desc: "完成第一次每日签到" },
    { id: "a_copy",    name: "抄作业",     tier: "青铜", ico: "🔫", kind: "site", desc: "复制第一个改枪码" },
    { id: "a_codex",   name: "看图说话",   tier: "青铜", ico: "📖", kind: "site", desc: "查看任意图鉴条目" },
    { id: "a_pass",    name: "密码通",     tier: "白银", ico: "🔑", kind: "site", desc: "记住 5 张地图密码" },
    { id: "a_build3",  name: "改枪学徒",   tier: "白银", ico: "🛠", kind: "site", desc: "收藏 3 套改枪方案" },
    { id: "a_forum",   name: "论坛萌新",   tier: "白银", ico: "💬", kind: "site", desc: "发布第一条论坛帖子" },
    { id: "a_build10", name: "改枪大师",   tier: "黄金", ico: "🎯", kind: "site", desc: "抄过 10 套改枪码" },
    { id: "a_asala",   name: "收藏家",     tier: "黄金", ico: "🃏", kind: "site", desc: "集齐阿萨拉牌盒 54+1" },
    { id: "a_price20", name: "物价猎人",   tier: "黄金", ico: "💹", kind: "site", desc: "记录 20 次价格快照" },
    { id: "a_full5",   name: "满改土豪",   tier: "钻石", ico: "💎", kind: "site", desc: "拥有 5 套满改方案" },
    { id: "a_friend",  name: "战友遍布",   tier: "钻石", ico: "🤝", kind: "site", desc: "添加 10 位站内好友" },
    { id: "a_zhanji",  name: "战绩达人",   tier: "钻石", ico: "📊", kind: "site", desc: "绑定战绩查询" },
    { id: "a_veteran", name: "情报台元老", tier: "传说", ico: "👑", kind: "site", desc: "连续签到 30 天" },
    { id: "a_all",     name: "全能情报员", tier: "传说", ico: "🏆", kind: "site", desc: "解锁全部其它本站成就" }
  ];
  var TIER_COLOR = {
    "青铜": "#cd7f32", "白银": "#9fb3c8", "黄金": "#ffb300",
    "钻石": "#19c3a6", "传说": "#b06bff"
  };
  var KIND_LABEL = { game: "三角洲行动", site: "本站" };

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
          '<p class="guide-intro">两个标签：<b>三角洲行动</b>成就（游戏内真实成就的收集情况，清单由后台维护，需自行勾选已获得）与 <b>本站</b>成就（在情报台的行为成就）。成就纯本地保存，不联网、不上传；点亮后可生成分享海报。</p>' +
          '<div class="ac-tabs">' +
            '<button class="ac-tab active" data-kind="game">🎮 三角洲行动</button>' +
            '<button class="ac-tab" data-kind="site">🏠 本站</button>' +
          '</div>' +
          '<div class="ac-bar">' +
            '<div class="ac-progress"><div class="ac-progress-fill" id="acFill"></div>' +
              '<span class="ac-progress-txt" id="acTxt">0 / 0</span></div>' +
            '<div class="ac-actions">' +
              '<button class="btn-ghost" id="acAll">本标签全点亮</button>' +
              '<button class="btn-ghost" id="acReset">本标签重置</button>' +
              '<button class="btn-primary" id="acPoster">生成分享海报</button>' +
            '</div>' +
          '</div>' +
          '<div class="ac-grid" id="acGrid"><div class="kk-empty">加载中…</div></div>' +
          '<canvas id="acCanvas" width="600" height="800" style="display:none"></canvas>';
      },
      init: function () {
        var items = list(D);
        var got = load();
        var curKind = "game";
        var grid = document.getElementById("acGrid");

        function render() {
          var sub = items.filter(function (a) { return (a.kind || "game") === curKind; });
          var done = 0;
          grid.innerHTML = sub.map(function (a) {
            var on = !!got[a.id];
            if (on) done++;
            var col = TIER_COLOR[a.tier] || "#888";
            return '<div class="ac-badge' + (on ? " on" : "") + '" data-id="' + esc(a.id) + '" style="--bc:' + col + '">' +
              '<div class="ac-badge-ico">' + (on ? esc(a.ico) : KIND_LABEL[curKind] === "本站" ? esc(a.ico) : "🔒") + '</div>' +
              '<div class="ac-badge-name">' + esc(a.name) + '</div>' +
              '<div class="ac-badge-tier">' + esc(a.tier) + (a.mode ? " · " + esc(a.mode) : "") + '</div>' +
              '<div class="ac-badge-desc">' + esc(a.desc) + '</div>' +
              (on ? '<div class="ac-badge-ok">已获得 ✓</div>' : '<div class="ac-badge-ok off">点击点亮</div>') +
            '</div>';
          }).join("");
          var total = sub.length;
          var pct = total ? Math.round(done / total * 100) : 0;
          var fill = document.getElementById("acFill");
          var txt = document.getElementById("acTxt");
          if (fill) fill.style.width = pct + "%";
          if (txt) txt.textContent = KIND_LABEL[curKind] + "：" + done + " / " + total + " · " + pct + "%";
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

        document.querySelectorAll(".ac-tab").forEach(function (t) {
          t.addEventListener("click", function () {
            document.querySelectorAll(".ac-tab").forEach(function (x) { x.classList.remove("active"); });
            t.classList.add("active");
            curKind = t.getAttribute("data-kind");
            render();
          });
        });

        var allBtn = document.getElementById("acAll");
        if (allBtn) allBtn.addEventListener("click", function () {
          items.forEach(function (a) { if ((a.kind || "game") === curKind) got[a.id] = true; }); save(got); render();
        });
        var resetBtn = document.getElementById("acReset");
        if (resetBtn) resetBtn.addEventListener("click", function () {
          if (confirm("确定清空本标签已点亮成就？")) {
            items.forEach(function (a) { if ((a.kind || "game") === curKind) delete got[a.id]; }); save(got); render();
          }
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
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#1a1f2b"); g.addColorStop(1, "#0f1320");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffb300"; ctx.font = "bold 30px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center"; ctx.fillText("三角洲情报台 · 成就墙", W / 2, 64);
      var done = items.filter(function (a) { return got[a.id]; }).length;
      ctx.fillStyle = "#cfd6e4"; ctx.font = "18px 'Microsoft YaHei', sans-serif";
      ctx.fillText("已点亮 " + done + " / " + items.length + " 枚徽章", W / 2, 98);
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
        var nm = (KIND_LABEL[a.kind] === "本站" ? "🏠" : "🎮") + a.name;
        ctx.fillText(nm, x, y + 54);
        ctx.font = "12px 'Microsoft YaHei', sans-serif"; ctx.fillStyle = col;
        ctx.fillText(a.tier, x, y + 74);
      });
      ctx.fillStyle = "#6b7280"; ctx.font = "13px 'Microsoft YaHei', sans-serif";
      ctx.fillText("由 三角洲情报台 生成 · " + new Date().toLocaleDateString("zh-CN"), W / 2, H - 24);
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
