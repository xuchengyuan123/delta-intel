/* =========================================================
 * guides.js — 攻略 / 资料库 / 小知识 / 实用工具 插件
 * 注册：
 *  VIEWS.guides(新手攻略·模块化) / VIEWS.quiz(电竞测试) / VIEWS.trivia(小知识)
 *  VIEWS.gunbuilds(改枪方案) / VIEWS.doorcodes(密码门) / VIEWS.events(活动日历)
 *  VIEWS.streamer(主播设置) / VIEWS.optasks(干员任务) / VIEWS.melee(近战武器)
 *  VIEWS.treasure(宝藏开箱) / VIEWS.loot(随机舔包) / VIEWS.scatter(散落物资点)
 * 向 DF.MENU 注入「攻略」「资料库」「工具」分组。
 * ========================================================= */
(function () {
  "use strict";
  function reg(D) {
    var esc = D.esc;

    /* ---------------- 新手攻略（模块化） ---------------- */
    function guidesHtml(o) {
      var g = o.guides || { modules: [] };
      var mods = (g.modules || []).map(function (m) {
        var cards = (m.cards || []).map(function (c) {
          return '<div class="g-card"><div class="g-card-title">' + esc(c.title) + '</div><div class="g-card-text">' + esc(c.text) + '</div></div>';
        }).join("");
        return '<div class="g-module"><div class="g-mod-head"><span class="g-mod-ico">' + esc(m.icon || "📌") + "</span>" + esc(m.title) + "</div>" +
          '<div class="g-card-grid">' + (cards || '<div class="g-card">暂无要点</div>') + "</div></div>";
      }).join("");
      return '<div class="section-title">🎯 新手攻略</div>' +
        '<p class="guide-intro">' + esc(g.intro || "从零上手《三角洲行动》。") + "</p>" +
        (mods || '<div class="card"><p style="color:var(--muted)">暂无攻略模块，管理员可在后台添加。</p></div>');
    }

    /* ---------------- 电竞选手测试 ---------------- */
    function quizResult(q, scores) {
      var cnt = {};
      scores.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; });
      var best = q.results[0].key, max = -1;
      q.results.forEach(function (r) { if ((cnt[r.key] || 0) > max) { max = cnt[r.key] || 0; best = r.key; } });
      return q.results.find(function (r) { return r.key === best; }) || q.results[0];
    }
    function quizHtml(o) {
      var q = o.quiz;
      if (!q) return '<div class="section-title">🎮 电竞选手测试</div><div class="card">暂无测试数据。</div>';
      var prevHtml = "";
      try {
        var pr = JSON.parse(localStorage.getItem("df-quiz") || "null");
        if (pr) { var res = quizResult(q, pr); prevHtml = '<div class="quiz-prev">你上次的测试结果：<b>' + res.icon + " " + esc(res.name) + '</b> · <button class="btn ghost sm" id="quizRetake">重新测试</button></div>'; }
      } catch (e) {}
      var qs = q.questions.map(function (Q, i) {
        var opts = Q.options.map(function (op) {
          return '<label class="quiz-opt" data-q="' + i + '" data-s="' + esc(op.s) + '"><input type="radio" name="qq' + i + '" value="' + esc(op.s) + '"> <span>' + esc(op.text) + "</span></label>";
        }).join("");
        return '<div class="quiz-q"><div class="quiz-qt">' + (i + 1) + ". " + esc(Q.q) + "</div>" + opts + "</div>";
      }).join("");
      return '<div class="section-title">🎮 ' + esc(q.title) + "</div>" +
        '<p class="guide-intro">' + esc(q.sub || "") + "</p>" + prevHtml +
        '<div class="quiz-box" id="quizBox">' + qs +
          '<div class="quiz-actions"><button class="btn-primary" id="quizGo">查看我的结果</button><span class="t-msg" id="quizMsg"></span></div></div>' +
        '<div id="quizResult"></div>';
    }
    function quizInit(D) {
      function showResult() {
        var q = D.getData().quiz; if (!q) return;
        var scores = [];
        for (var i = 0; i < q.questions.length; i++) {
          var el = document.querySelector('input[name="qq' + i + '"]:checked');
          if (!el) { var m = document.getElementById("quizMsg"); m.textContent = "请答完所有题再查看～"; m.style.color = "#ffb300"; return; }
          scores.push(el.value);
        }
        var res = quizResult(q, scores);
        try { localStorage.setItem("df-quiz", JSON.stringify(scores)); } catch (e) {}
        document.getElementById("quizResult").innerHTML =
          '<div class="quiz-result"><div class="qr-icon">' + res.icon + '</div>' +
            '<div class="qr-name">' + esc(res.name) + '</div>' +
            '<div class="qr-desc">' + esc(res.desc) + '</div>' +
            '<div class="qr-tip">💡 ' + esc(res.tip) + '</div>' +
            '<div class="quiz-actions"><button class="btn-primary" id="quizShare">复制结果分享</button>' +
            '<button class="btn ghost" id="quizAgain">再测一次</button></div>' +
            '<span class="t-msg" id="quizShareMsg"></span></div>';
        document.getElementById("quizShare").onclick = function () {
          var txt = "我是「" + res.name + "」型三角洲电竞选手！" + res.desc + "（来自三角洲情报台）";
          try { navigator.clipboard.writeText(txt); } catch (e) {}
          var s = document.getElementById("quizShareMsg"); s.textContent = "已复制，去分享吧！"; s.style.color = "#2ecc71";
        };
        document.getElementById("quizAgain").onclick = function () {
          document.querySelectorAll('.quiz-opt input').forEach(function (r) { r.checked = false; });
          document.getElementById("quizResult").innerHTML = "";
        };
      }
      var go = document.getElementById("quizGo"); if (go) go.onclick = showResult;
      var retake = document.getElementById("quizRetake"); if (retake) retake.onclick = function () { localStorage.removeItem("df-quiz"); D.render("quiz"); };
    }

    /* ---------------- 小知识（分享 / 点赞 / 复制） ---------------- */
    var USER_KEY = "df-trivia-user", LIKE_KEY = "df-trivia-likes";
    function userTrivia() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "[]"); } catch (e) { return []; } }
    function likeMap() { try { return JSON.parse(localStorage.getItem(LIKE_KEY) || "{}"); } catch (e) { return {}; } }
    function saveUserTrivia(a) { try { localStorage.setItem(USER_KEY, JSON.stringify(a)); } catch (e) {} }
    function saveLikeMap(m) { try { localStorage.setItem(LIKE_KEY, JSON.stringify(m)); } catch (e) {} }
    function triviaCard(t, idx, mine) {
      var likes = likeMap();
      var n = (t.likes || 0) + (likes[t.id] ? 1 : 0);
      var liked = likes[t.id] ? " liked" : "";
      return '<div class="trivia-card' + (mine ? " mine" : "") + '">' +
        '<div class="trivia-top"><span class="trivia-tag">' + esc(t.tag || "小知识") + "</span>" + (mine ? '<span class="trivia-mine">我分享的</span>' : "") + "</div>" +
        '<div class="trivia-title">' + esc(t.title) + "</div>" +
        '<div class="trivia-body">' + esc(t.body) + "</div>" +
        '<div class="trivia-actions"><button class="t-btn like-btn' + liked + '" data-id="' + esc(t.id) + '">👍 <span>' + n + "</span></button>" +
        '<button class="t-btn copy-btn" data-id="' + esc(t.id) + '">📋 复制</button>' +
        (mine ? '<button class="t-btn del-btn" data-id="' + esc(t.id) + '">🗑 撤回</button>' : "") + "</div></div>";
    }
    function triviaHtmlBody(o) {
      var base = (o.trivia || []).map(function (t, i) { return triviaCard({ id: "s" + i, tag: t.tag, title: t.title, body: t.body, likes: 0 }, i, false); });
      var mine = userTrivia().map(function (t) { return triviaCard(t, 0, true); });
      return base.concat(mine).join("");
    }
    function triviaHtml(o) {
      return '<div class="section-title">🧠 三角洲小知识 · 战友分享</div>' +
        '<p class="guide-intro">看到好用的技巧？点「分享小知识」发布，所有访客都能看到你的分享。觉得有用就点赞 👍。</p>' +
        '<div class="trivia-sharebar">' +
          '<input id="tTitle" class="t-input" placeholder="一句话标题，如：撤离点要等倒计时">' +
          '<input id="tTag" class="t-input t-tag" placeholder="标签(可选)">' +
          '<textarea id="tBody" class="t-area" placeholder="详细内容…"></textarea>' +
          '<div class="trivia-sharebar-actions"><button class="btn-primary" id="tSubmit">分享小知识</button><span class="t-msg" id="tMsg"></span></div>' +
        "</div>" +
        '<div class="trivia-grid" id="triviaGrid">' + triviaHtmlBody(o) + "</div>";
    }
    function triviaInit(D) {
      function refresh() { var g = document.getElementById("triviaGrid"); if (g) g.innerHTML = triviaHtmlBody(D.getData()); }
      var submit = document.getElementById("tSubmit");
      if (submit) submit.addEventListener("click", function () {
        var title = document.getElementById("tTitle").value.trim();
        var body = document.getElementById("tBody").value.trim();
        var tag = document.getElementById("tTag").value.trim() || "分享";
        var msg = document.getElementById("tMsg");
        if (title.length < 2 || body.length < 4) { msg.textContent = "标题/内容太短啦"; msg.style.color = "#ff6b6b"; return; }
        var arr = userTrivia();
        arr.unshift({ id: "u" + Date.now(), tag: tag, title: title, body: body, likes: 0 });
        saveUserTrivia(arr);
        document.getElementById("tTitle").value = ""; document.getElementById("tBody").value = ""; document.getElementById("tTag").value = "";
        msg.textContent = "已分享！"; msg.style.color = "#2ecc71"; refresh();
      });
      var grid = document.getElementById("triviaGrid");
      if (grid) grid.addEventListener("click", function (e) {
        var like = e.target.closest(".like-btn"), copy = e.target.closest(".copy-btn"), del = e.target.closest(".del-btn");
        if (like) {
          var id = like.getAttribute("data-id"), m = likeMap();
          if (m[id]) delete m[id]; else m[id] = 1; saveLikeMap(m); refresh();
        } else if (copy) {
          var card = copy.closest(".trivia-card");
          var txt = card.querySelector(".trivia-title").textContent + "\n" + card.querySelector(".trivia-body").textContent;
          try { navigator.clipboard.writeText(txt); } catch (ee) {}
          var old = copy.textContent; copy.textContent = "✅ 已复制"; setTimeout(function () { copy.textContent = old; }, 1200);
        } else if (del) {
          var id2 = del.getAttribute("data-id"); saveUserTrivia(userTrivia().filter(function (t) { return t.id !== id2; })); refresh();
        }
      });
    }

    /* ---------------- 资料库：改枪方案 ---------------- */
    function gunBuildsHtml(o) {
      var list = (o.gunBuilds || []).map(function (b) {
        var tags = (b.tags || []).map(function (t) { return '<span class="pill">' + esc(t) + "</span>"; }).join("");
        var att = (b.attachments || []).map(function (a) { return '<span class="att-chip">' + esc(a) + "</span>"; }).join("");
        var img = b.image ? '<div class="gb-img"><img src="' + esc(b.image) + '" alt="' + esc(b.name) + '"></div>' : "";
        return '<div class="gb-card">' + img +
          '<div class="gb-head"><b>' + esc(b.name) + '</b><span class="gb-w">' + esc(b.weapon || "") + '</span></div>' +
          '<div class="gb-tags">' + tags + "</div>" +
          (b.desc ? '<div class="gb-desc">' + esc(b.desc) + "</div>" : "") +
          '<div class="gb-att">' + att + "</div></div>";
      }).join("");
      return '<div class="section-title">🔧 改枪方案</div><p class="guide-intro">参考职业与高分玩家的配装思路，按手感微调配件。</p>' +
        (list || '<div class="card"><p style="color:var(--muted)">暂无方案，管理员可在后台添加。</p></div>');
    }

    /* ---------------- 资料库：密码门 ---------------- */
    function doorCodesHtml(o) {
      var rows = (o.doorCodes || []).map(function (d) {
        return "<tr><td>" + esc(d.map) + "</td><td>" + esc(d.location) + "</td><td class='code-strong'>" + esc(d.code) + "</td><td>" + esc(d.note || "") + "</td></tr>";
      }).join("");
      return '<div class="section-title">🔑 密码门速查</div><p class="guide-intro">部分地图门禁/电子门密码（每日可能刷新，以游戏内为准）。</p>' +
        '<div class="card"><table class="tbl"><thead><tr><th>地图</th><th>位置</th><th>密码</th><th>说明</th></tr></thead><tbody>' + (rows || "<tr><td colspan=4>暂无</td></tr>") + "</tbody></table></div>";
    }

    /* ---------------- 资料库：活动日历 ---------------- */
    function eventsHtml(o) {
      var list = (o.events || []).map(function (e) {
        return '<div class="ev-card"><div class="ev-name">' + esc(e.name) + '</div><div class="ev-period">📅 ' + esc(e.period || "") + '</div><div class="ev-reward">🎁 ' + esc(e.reward || "") + '</div></div>';
      }).join("");
      return '<div class="section-title">📅 活动日历</div><p class="guide-intro">当前赛季限时活动一览，过期活动不再可参与。</p>' +
        '<div class="ev-grid">' + (list || '<div class="card"><p style="color:var(--muted)">暂无活动。</p></div>') + "</div>";
    }

    /* ---------------- 资料库：主播设置 ---------------- */
    function streamerHtml(o) {
      var rows = (o.streamer || []).map(function (s) {
        return "<tr><td>" + esc(s.name) + "</td><td class='code-strong'>" + esc(s.value) + "</td><td>" + esc(s.note || "") + "</td></tr>";
      }).join("");
      return '<div class="section-title">🎮 主播游戏设置一览</div><p class="guide-intro">高分主播的灵敏度/画质参考，新手可按手感微调。</p>' +
        '<div class="card"><table class="tbl"><thead><tr><th>项目</th><th>设置</th><th>备注</th></tr></thead><tbody>' + (rows || "<tr><td colspan=3>暂无</td></tr>") + "</tbody></table></div>";
    }

    /* ---------------- 资料库：干员个人任务 ---------------- */
    function opTasksHtml(o) {
      var rows = (o.opTasks || []).map(function (t) {
        return "<tr><td>" + esc(t.op) + "</td><td>" + esc(t.task) + "</td><td>" + esc(t.reward || "") + "</td></tr>";
      }).join("");
      return '<div class="section-title">🪖 干员个人任务一览</div><p class="guide-intro">各干员的专属挑战与奖励（示例，以游戏内为准）。</p>' +
        '<div class="card"><table class="tbl"><thead><tr><th>干员</th><th>个人任务</th><th>奖励</th></tr></thead><tbody>' + (rows || "<tr><td colspan=3>暂无</td></tr>") + "</tbody></table></div>";
    }

    /* ---------------- 资料库：近战武器 ---------------- */
    function meleeHtml(o) {
      var rows = (o.melee || []).map(function (m) {
        return "<tr><td>" + esc(m.name) + "</td><td class='code-strong'>" + esc(m.dmg) + "</td><td>" + esc(m.speed || "") + "</td><td>" + esc(m.note || "") + "</td></tr>";
      }).join("");
      return '<div class="section-title">🔪 近战武器基础数据</div><p class="guide-intro">近战武器伤害与出手速度参考。</p>' +
        '<div class="card"><table class="tbl"><thead><tr><th>名称</th><th>伤害</th><th>出手</th><th>说明</th></tr></thead><tbody>' + (rows || "<tr><td colspan=4>暂无</td></tr>") + "</tbody></table></div>";
    }

    /* ---------------- 宝藏开箱模拟 ---------------- */
    function treasureHtml(o) {
      var boxes = (o.containers || []).map(function (c) { return c.name; });
      var opts = boxes.map(function (b) { return '<option>' + esc(b) + "</option>"; }).join("");
      return '<div class="section-title">🎁 宝藏开箱模拟</div>' +
        '<div class="tool-card"><p class="guide-intro">模拟开箱，看看今天手气如何。结果随机，纯娱乐。</p>' +
          '<div class="tool-row"><label>选择容器</label><select id="trBox">' + opts + "</select></div>" +
          '<div class="tool-row"><label>开箱次数</label><input id="trN" type="number" min="1" max="20" value="3"></div>' +
          '<button class="btn-primary" id="trGo">开箱！</button><div class="tool-result" id="trResult"></div></div>';
    }
    function treasureInit(D) {
      var btn = document.getElementById("trGo"); if (!btn) return;
      btn.addEventListener("click", function () {
        var o = D.getData();
        var box = document.getElementById("trBox").value;
        var n = Math.max(1, Math.min(20, +document.getElementById("trN").value || 1));
        var container = (o.containers || []).find(function (c) { return c.name === box; }) || { output: "未知物资" };
        var pool = ["传说武器箱", "金条×1", "高级配件", "医疗包", "弹药盒", "工具零件", "空", "空", "普通物资", container.output];
        var res = [];
        for (var i = 0; i < n; i++) res.push(pool[Math.floor(Math.random() * pool.length)]);
        document.getElementById("trResult").innerHTML = res.map(function (r, i) {
          return '<div class="loot-line"><span class="loot-i">#' + (i + 1) + "</span><span class=\"loot-x\">" + esc(r) + "</span></div>";
        }).join("");
      });
    }

    /* ---------------- 随机舔包 ---------------- */
    function lootHtml() {
      return '<div class="section-title">🥡 随机舔包生成器</div>' +
        '<div class="tool-card"><p class="guide-intro">帮你随机生成一套撤离背包配置，作为配装思路参考。</p>' +
          '<button class="btn-primary" id="loGo">帮我舔一包</button><div class="tool-result" id="loResult"></div></div>';
    }
    function lootInit(D) {
      var btn = document.getElementById("loGo"); if (!btn) return;
      var guns = ["AKM", "M4A1", "M250", "ASVAL", "AWM", "MP5", "M870", "G18"];
      var armor = ["轻甲", "中甲", "重甲", "无甲"];
      var item = ["医疗包", "绷带×3", "能量饮料", "破片雷", "震撼弹", "止痛药", "工具箱", "安全箱扩容"];
      btn.addEventListener("click", function () {
        function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
        var bag = [pick(guns), pick(armor), pick(item), pick(item), pick(item)];
        document.getElementById("loResult").innerHTML = bag.map(function (b, i) {
          return '<div class="loot-line"><span class="loot-i">槽' + (i + 1) + '</span><span class="loot-x">' + esc(b) + "</span></div>";
        }).join("");
      });
    }

    /* ---------------- 散落物资点 ---------------- */
    function scatterHtml(o) {
      var rows = (o.scatter || []).map(function (s) {
        return "<tr><td>" + esc(s.map) + "</td><td>" + esc(s.points) + "</td></tr>";
      }).join("");
      return '<div class="section-title">📍 散落物资点一览</div>' +
        '<div class="card"><table class="tbl"><thead><tr><th>地图</th><th>常见散落点</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<p class="guide-intro">散落点为非钥匙房、地图中自然刷新的物资位置，跑图顺路就能舔。</p>';
    }

    /* ---------------- 注册 ---------------- */
    D.VIEWS.guides = { html: function () { return guidesHtml(D.getData()); } };
    D.VIEWS.quiz = { html: function () { return quizHtml(D.getData()); }, init: function () { quizInit(D); } };
    D.VIEWS.trivia = { html: function () { return triviaHtml(D.getData()); }, init: function () { triviaInit(D); } };
    D.VIEWS.gunbuilds = { html: function () { return gunBuildsHtml(D.getData()); } };
    D.VIEWS.doorcodes = { html: function () { return doorCodesHtml(D.getData()); } };
    D.VIEWS.events = { html: function () { return eventsHtml(D.getData()); } };
    D.VIEWS.streamer = { html: function () { return streamerHtml(D.getData()); } };
    D.VIEWS.optasks = { html: function () { return opTasksHtml(D.getData()); } };
    D.VIEWS.melee = { html: function () { return meleeHtml(D.getData()); } };
    D.VIEWS.treasure = { html: function () { return treasureHtml(D.getData()); }, init: function () { treasureInit(D); } };
    D.VIEWS.loot = { html: function () { return lootHtml(); }, init: function () { lootInit(D); } };
    D.VIEWS.scatter = { html: function () { return scatterHtml(D.getData()); } };

    D.MENU.push(
      { group: "攻略", items: [
        { route: "guides", label: "新手攻略", ico: "🎯" },
        { route: "quiz", label: "电竞测试", ico: "🎮" },
        { route: "trivia", label: "三角洲小知识", ico: "🧠" }
      ] },
      { group: "资料库", items: [
        { route: "gunbuilds", label: "改枪方案", ico: "🔧" },
        { route: "doorcodes", label: "密码门", ico: "🔑" },
        { route: "events", label: "活动日历", ico: "📅" },
        { route: "streamer", label: "主播设置", ico: "🎮" },
        { route: "optasks", label: "干员任务", ico: "🪖" },
        { route: "melee", label: "近战武器", ico: "🔪" }
      ] },
      { group: "工具", items: [
        { route: "treasure", label: "宝藏开箱", ico: "🎁" },
        { route: "loot", label: "随机舔包", ico: "🥡" },
        { route: "scatter", label: "散落物资点", ico: "📍" }
      ] }
    );
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
