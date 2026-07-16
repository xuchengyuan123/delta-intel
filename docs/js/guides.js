/* =========================================================
 * guides.js — 攻略 / 资料库 / 小知识 / 实用工具 插件
 * 注册：
 *  VIEWS.guides(新手攻略·卡片式) / VIEWS.quiz(电竞测试·卡片化) / VIEWS.trivia(小知识)
 *  VIEWS.gunbuilds(改枪方案) / VIEWS.doorcodes(密码门) / VIEWS.events(活动日历)
 *  VIEWS.streamer(主播设置) / VIEWS.optasks(干员任务) / VIEWS.melee(近战武器)
 *  VIEWS.treasure(宝藏开箱) / VIEWS.loot(随机舔包) / VIEWS.scatter(散落物资点)
 * 向 DF.MENU 注入分组（实际菜单在 app.js 统一编排）。
 * ========================================================= */
(function () {
  "use strict";
  function reg(D) {
    var esc = D.esc;

    /* ---------- 本插件自带的卡片样式（一次性注入，避免依赖缺失的全局类） ---------- */
    D.addStyle("guides-cards", `
      /* 新手攻略卡片（KK日报风格模块化卡片） */
      .df-guides{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
      .df-gmod{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 16px 18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;}
      .df-gmod-head{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;color:var(--text);padding-bottom:10px;border-bottom:1px solid var(--border);}
      .df-gmod-head .ico{font-size:20px;}
      .df-gcards{display:flex;flex-direction:column;gap:10px;}
      .df-gcard{background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;padding:11px 13px;transition:.12s;}
      .df-gcard:hover{border-color:var(--accent);transform:translateY(-1px);}
      .df-gcard .gt{font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:7px;}
      .df-gcard .gt::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);flex:0 0 auto;}
      .df-gcard .gx{font-size:13px;color:var(--muted);line-height:1.75;}

      /* DFTI 电竞测试 · 卡片化 */
      .df-quiz{max-width:780px;margin:0 auto;}
      .df-quiz-progress{display:flex;align-items:center;gap:10px;margin:4px 0 18px;font-size:13px;color:var(--muted);}
      .df-quiz-bar{flex:1;height:6px;background:var(--bg-soft);border-radius:6px;overflow:hidden;border:1px solid var(--border);}
      .df-quiz-bar > span{display:block;height:100%;background:var(--accent);border-radius:6px;transition:width .25s;}
      .df-qcard{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px;box-shadow:var(--shadow);}
      .df-qhead{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;}
      .df-qnum{flex:0 0 30px;height:30px;border-radius:9px;background:var(--accent);color:#11161f;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px;}
      .df-qt{font-size:16px;font-weight:700;color:var(--text);line-height:1.55;padding-top:3px;}
      .df-qopts{display:grid;gap:10px;}
      .df-qopt{position:relative;display:flex;align-items:center;gap:11px;padding:12px 14px;background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:14px;color:var(--text);transition:.15s;}
      .df-qopt:hover{border-color:var(--accent);background:var(--bg-elev);}
      .df-qopt.is-sel{border-color:var(--accent);background:var(--bg-elev);font-weight:700;}
      .df-qopt.is-sel::after{content:"✓";margin-left:auto;color:var(--accent);font-weight:800;}
      .df-qopt input{position:absolute;opacity:0;pointer-events:none;}
      .df-quiz-actions{display:flex;align-items:center;gap:12px;margin-top:6px;flex-wrap:wrap;}
      .df-quiz-actions .btn-primary{padding:11px 22px;}
      .df-qprev{background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--muted);margin-bottom:14px;}
      .df-qprev b{color:var(--accent);}
      .df-result{background:var(--card);border:1px solid var(--accent);border-radius:var(--radius);padding:24px;text-align:center;box-shadow:var(--shadow);}
      .df-result .rico{font-size:52px;margin-bottom:8px;}
      .df-result .rname{font-size:24px;font-weight:800;color:var(--accent);margin-bottom:10px;}
      .df-result .rdesc{font-size:15px;color:var(--text);line-height:1.7;margin-bottom:10px;}
      .df-result .rtip{font-size:13px;color:var(--muted);margin-bottom:16px;}
      .df-result .df-quiz-actions{justify-content:center;}

      /* 宝藏开箱 / 随机舔包 结果卡片 */
      .df-tool{max-width:620px;}
      .df-tool-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
      .df-tool-row label{flex:0 0 76px;color:var(--muted);font-size:13px;}
      .df-tool-row select,.df-tool-row input{flex:1;}
      .df-loot-grid{display:grid;gap:8px;margin-top:14px;}
      .df-loot-line{display:flex;align-items:center;gap:12px;background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:14px;}
      .df-loot-line .li{flex:0 0 44px;color:var(--muted);font-size:13px;}
      .df-loot-line .lx{flex:1;color:var(--text);font-weight:600;}
      .df-loot-line.rare{border-color:var(--accent);background:var(--bg-elev);}
      .df-loot-line.rare .lx{color:var(--accent);}
      @media (max-width:640px){
        .df-guides{grid-template-columns:1fr;}
        .df-tool-row{flex-direction:column;align-items:stretch;gap:6px;}
        .df-tool-row label{flex:none;}
      }
    `);

    /* ---------------- 新手攻略（卡片式） ---------------- */
    function guidesHtml(o) {
      var g = o.guides || { modules: [] };
      var mods = (g.modules || []).map(function (m) {
        var cards = (m.cards || []).map(function (c) {
          return '<div class="df-gcard"><div class="gt">' + esc(c.title) + '</div><div class="gx">' + esc(c.text) + '</div></div>';
        }).join("");
        return '<div class="df-gmod"><div class="df-gmod-head"><span class="ico">' + esc(m.icon || "📌") + '</span>' + esc(m.title) + '</div>' +
          '<div class="df-gcards">' + (cards || '<div class="df-gcard"><div class="gx">暂无要点</div></div>') + '</div></div>';
      }).join("");
      return '<div class="section-title">🎯 新手攻略</div>' +
        '<p class="guide-intro">' + esc(g.intro || "从零上手《三角洲行动》。") + "</p>" +
        '<div class="df-guides">' + (mods || '<div class="card"><p style="color:var(--muted)">暂无攻略模块，管理员可在后台添加。</p></div>') + '</div>';
    }

    /* ---------------- 电竞选手测试（卡片化） ---------------- */
    function quizResult(q, scores) {
      var results = [];
      if (Array.isArray(q.results)) {
        results = q.results;
      } else if (q.results && typeof q.results === "object") {
        results = Object.keys(q.results).map(function (k) { return Object.assign({ key: k }, q.results[k]); });
      }
      if (!results.length) return { key: "", icon: "🎮", name: "未知结果", desc: "", tip: "再测一次吧" };
      var cnt = {};
      scores.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; });
      var best = results[0].key, max = -1;
      results.forEach(function (r) { if ((cnt[r.key] || 0) > max) { max = cnt[r.key] || 0; best = r.key; } });
      return results.find(function (r) { return r.key === best; }) || results[0];
    }
    function quizCard(Q, i) {
      var opts = Q.options.map(function (op) {
        return '<label class="df-qopt" data-q="' + i + '">' +
          '<input type="radio" name="qq' + i + '" value="' + esc(op.s) + '">' +
          '<span>' + esc(op.text) + '</span></label>';
      }).join("");
      return '<div class="df-qcard"><div class="df-qhead"><div class="df-qnum">' + (i + 1) + '</div>' +
        '<div class="df-qt">' + esc(Q.q) + '</div></div><div class="df-qopts">' + opts + '</div></div>';
    }
    function quizHtml(o) {
      var q = o.quiz;
      if (!q) return '<div class="section-title">🎮 电竞选手测试</div><div class="card">暂无测试数据。</div>';
      var prevHtml = "";
      try {
        var pr = JSON.parse(localStorage.getItem("df-quiz") || "null");
        if (pr) { var res = quizResult(q, pr); prevHtml = '<div class="df-qprev">你上次的测试结果：<b>' + (res.icon || "🎮") + " " + esc(res.name) + '</b> · <button class="btn ghost sm" id="quizRetake">重新测试</button></div>'; }
      } catch (e) {}
      var qs = q.questions.map(function (Q, i) { return quizCard(Q, i); }).join("");
      return '<div class="section-title">🎮 ' + esc(q.title) + "</div>" +
        '<p class="guide-intro">' + esc(q.sub || "") + '</p>' + prevHtml +
        '<div class="df-quiz">' +
          '<div class="df-quiz-progress"><span id="quizProgText">0 / ' + q.questions.length + ' 题已答</span>' +
          '<div class="df-quiz-bar"><span id="quizProgBar" style="width:0%"></span></div></div>' +
          '<div id="quizBox">' + qs + '</div>' +
          '<div class="df-quiz-actions"><button class="btn-primary" id="quizGo">查看我的结果</button><span class="t-msg" id="quizMsg"></span></div>' +
        '</div>' +
        '<div id="quizResult"></div>';
    }
    function quizInit(D) {
      function refresh() {
        var q = D.getData().quiz; if (!q) return;
        var total = q.questions.length, done = 0;
        for (var i = 0; i < total; i++) {
          var el = document.querySelector('input[name="qq' + i + '"]:checked');
          var labs = document.querySelectorAll('.df-qopt[data-q="' + i + '"]');
          labs.forEach(function (lab) { lab.classList.remove("is-sel"); });
          if (el) { done++; el.closest(".df-qopt").classList.add("is-sel"); }
        }
        var bar = document.getElementById("quizProgBar"), txt = document.getElementById("quizProgText");
        if (bar) bar.style.width = (done / total * 100) + "%";
        if (txt) txt.textContent = done + " / " + total + " 题已答";
      }
      var box = document.getElementById("quizBox");
      if (box) box.addEventListener("change", function (e) { if (e.target && e.target.name && e.target.name.indexOf("qq") === 0) refresh(); });

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
          '<div class="df-result"><div class="rico">' + (res.icon || "🎮") + '</div>' +
            '<div class="rname">' + esc(res.name) + '</div>' +
            '<div class="rdesc">' + esc(res.desc) + '</div>' +
            '<div class="rtip">💡 ' + esc(res.tip || res.suggest || "多练习，战无不胜！") + '</div>' +
            '<div class="df-quiz-actions"><button class="btn-primary" id="quizShare">复制结果分享</button>' +
            '<button class="btn ghost" id="quizAgain">再测一次</button></div>' +
            '<span class="t-msg" id="quizShareMsg"></span></div>';
        document.getElementById("quizShare").onclick = function () {
          var txt = "我是「" + res.name + "」型三角洲电竞选手！" + res.desc + "（来自三角洲情报台）";
          try { navigator.clipboard.writeText(txt); } catch (e) {}
          var s = document.getElementById("quizShareMsg"); s.textContent = "已复制，去分享吧！"; s.style.color = "#2ecc71";
        };
        document.getElementById("quizAgain").onclick = function () {
          document.querySelectorAll('.df-qopt input').forEach(function (r) { r.checked = false; });
          document.querySelectorAll('.df-qopt').forEach(function (l) { l.classList.remove("is-sel"); });
          document.getElementById("quizResult").innerHTML = ""; refresh();
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
          '<div class="gb-head"><b>' + esc(b.name) + '</b>' + (b.weapon && String(b.name).indexOf(b.weapon) === -1 ? '<span class="gb-w">' + esc(b.weapon) + '</span>' : '') + '</div>' +
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

    /* ---------------- 资料库：近战武器（数值面板） ---------------- */
    function meleeHtml(o) {
      var cards = (o.melee || []).map(function (m) {
        var stats = [
          { k: '伤害（多段）', v: m.dmgStages || '—' },
          { k: '护甲伤害', v: m.armorDmg || '—' },
          { k: '穿甲等级', v: m.penLevel || '—' },
          { k: '爆头倍率', v: m.headshot || '—' },
          { k: '装备时移速（奔跑）', v: m.runSpeed || '—' },
          { k: '装备时移速（步行）', v: m.walkSpeed || '—' },
          { k: '攻击速度', v: m.attackSpeed || '—' },
          { k: '攻击范围', v: m.range || '—' }
        ];
        var rows = stats.map(function (s) {
          return '<div class="ml-stat"><span class="ml-stat-k">' + esc(s.k) + '</span><span class="ml-stat-v">' + esc(s.v) + '</span></div>';
        }).join('');
        var tags = [m.category, m.tier, m.quality].filter(function (x) { return x; }).map(function (x) { return '<span class="ml-tag">' + esc(x) + '</span>'; }).join('');
        return '<div class="ml-card">' +
          '<div class="ml-header">' +
            '<div class="ml-name">' + esc(m.name) + '</div>' +
            '<div class="ml-tags">' + tags + '</div>' +
          '</div>' +
          '<div class="ml-stats">' + rows + '</div>' +
          '<div class="ml-desc">' + esc(m.desc || m.note || '') + '</div>' +
        '</div>';
      }).join('');
      return '<div class="section-title">🔪 近战武器 / 刀皮数值面板</div>' +
        '<p class="guide-intro">每把近战武器的完整数值面板，数据以游戏内为准。空值表示管理员尚未填写。</p>' +
        '<div class="ml-grid">' + (cards || '<div class="kk-empty">暂无数据</div>') + '</div>';
    }

    /* ---------------- 宝藏开箱模拟（接入 data.json 容器与产出归类） ---------------- */
    function buildLootPools() {
      var CAT = {
        "工具": ["扳手", "螺丝刀", "机械零件", "工业材料", "钛合金板", "碳纤维"],
        "零件": ["齿轮", "轴承", "弹簧", "精密螺丝", "导线"],
        "材料": ["铝合金", "聚合物", "战术布料", "橡胶垫"],
        "枪械": ["M4A1 上机匣", "AK-12 枪管", "K416 护木", "Vector 机匣", "SR-25 枪身"],
        "配件": ["战术枪托", "红点瞄具", "全息瞄具", "垂直握把", "补偿器", "消音器", "扩容弹匣", "快拆弹匣"],
        "药品": ["绷带", "弹力绷带", "急救包", "野战急救包", "止血带", "战术快拆手术包", "止疼片", "体能强化剂", "强效注射器"],
        "电子": ["显卡", "内存条", "主控芯片", "电路板", "精密镜头", "固态硬盘", "电容"],
        "元件": ["电阻", "晶振", "继电器", "传感器"],
        "弹药": ["M855A1 子弹×120", "M62 子弹×120", "PBP 子弹×120", "12号霰弹×60", "穿甲弹×90", "独头弹×40"],
        "情报": ["机密文件", "情报硬盘", "研究手稿", "人员名单", "通行证"],
        "文件": ["行动记录", "蓝图", "合同"]
      };
      var RARE = ["金条", "显卡", "镜头", "固态硬盘", "名表", "钻石", "古董"];
      return { CAT: CAT, RARE: RARE };
    }
    function treasureHtml(o) {
      var boxes = (o.containers || []).map(function (c) { return c.name; });
      var opts = boxes.map(function (b) { return '<option>' + esc(b) + "</option>"; }).join("");
      return '<div class="section-title">🎁 宝藏开箱模拟</div>' +
        '<div class="tool-card df-tool"><p class="guide-intro">模拟开箱，看看今天手气如何。结果随机，纯娱乐；物品按容器产出类型归类（稀有物概率更低）。</p>' +
          '<div class="df-tool-row"><label>选择容器</label><select id="trBox">' + (opts || "<option>无容器</option>") + "</select></div>" +
          '<div class="df-tool-row"><label>开箱次数</label><input id="trN" type="number" min="1" max="20" value="3"></div>' +
          '<button class="btn-primary" id="trGo">开箱！</button><div class="tool-result" id="trResult"></div></div>';
    }
    function treasureInit(D) {
      var btn = document.getElementById("trGo"); if (!btn) return;
      btn.addEventListener("click", function () {
        var o = D.getData();
        var box = document.getElementById("trBox").value;
        var n = Math.max(1, Math.min(20, +document.getElementById("trN").value || 1));
        var container = (o.containers || []).find(function (c) { return c.name === box; }) || { output: "普通物资" };
        var pools = buildLootPools();
        var pick = [];
        Object.keys(pools.CAT).forEach(function (k) { if (container.output && container.output.indexOf(k) > -1) pick = pick.concat(pools.CAT[k]); });
        if (!pick.length) pick = ["普通物资", "零件", "材料", "工具"];
        var res = [];
        for (var i = 0; i < n; i++) {
          var item = (Math.random() < 0.10) ? pools.RARE[Math.floor(Math.random() * pools.RARE.length)] : pick[Math.floor(Math.random() * pick.length)];
          res.push(item);
        }
        document.getElementById("trResult").innerHTML = '<div class="df-loot-grid">' + res.map(function (r, i) {
          var rare = pools.RARE.indexOf(r) > -1;
          return '<div class="df-loot-line' + (rare ? ' rare' : '') + '"><span class="li">#' + (i + 1) + '</span><span class="lx">' + esc(r) + '</span></div>';
        }).join("") + '</div>';
      });
    }

    /* ---------------- 随机舔包（接入 data.json 武器/护甲库） ---------------- */
    function lootHtml() {
      return '<div class="section-title">🥡 随机舔包生成器</div>' +
        '<div class="tool-card df-tool"><p class="guide-intro">随机生成一套撤离背包配置，作为配装思路参考。武器/护甲取自本站图鉴与护甲库。</p>' +
          '<button class="btn-primary" id="loGo">帮我舔一包</button><div class="tool-result" id="loResult"></div></div>';
    }
    function lootInit(D) {
      var btn = document.getElementById("loGo"); if (!btn) return;
      var o = D.getData();
      var guns = (o.weaponCodex || []).map(function (w) { return w.name; }).filter(Boolean);
      if (!guns.length) guns = ["M4A1", "AK-12", "K416", "M7", "AS Val", "AWM", "SR-25", "MP5", "MP7", "M870", "G18", "沙漠之鹰", "P90", "M250", "Vector"];
      var armor = (o.armors || []).map(function (a) { return a.name; });
      if (!armor.length) armor = ["无甲", "3级 TG-H 防弹衣", "4级 MK-2 战术背心", "5级 重型突击背心", "6级 特里克 MAS2.0 装甲"];
      var meds = ["绷带", "弹力绷带", "急救包", "野战急救包", "止血带", "战术快拆手术包", "止疼片", "体能强化剂", "强效注射器", "护甲维修包", "工具箱"];
      var ammo = ["5.56x45mm M855A1", "9x19mm PBP", "7.62x51mm M62", "5.45x39mm PP", "12号独头弹"];
      btn.addEventListener("click", function () {
        function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
        var bag = [
          { slot: "主武器", item: pick(guns) },
          { slot: "防具", item: pick(armor) },
          { slot: "药品", item: pick(meds) },
          { slot: "药品", item: pick(meds) },
          { slot: "弹药", item: pick(ammo) }
        ];
        document.getElementById("loResult").innerHTML = '<div class="df-loot-grid">' + bag.map(function (b) {
          return '<div class="df-loot-line"><span class="li">' + esc(b.slot) + '</span><span class="lx">' + esc(b.item) + '</span></div>';
        }).join("") + '</div>';
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
