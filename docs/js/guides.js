/* =========================================================
 * guides.js — 攻略 / 小知识 / 实用工具 插件
 * 注册：VIEWS.guides(新手攻略) / VIEWS.trivia(三角洲小知识) /
 *       VIEWS.treasure(宝藏开箱) / VIEWS.loot(随机舔包) / VIEWS.scatter(散落物资点)
 * 向 DF.MENU 注入「攻略」「工具」分组。
 * 小知识支持：提交分享、点赞、复制（localStorage 持久化，无后端）。
 * ========================================================= */
(function () {
  "use strict";
  function reg(D) {
    var esc = D.esc, fmt = D.fmt;

    /* ---------------- 新手攻略 ---------------- */
    function guideSection(title, icon, rows) {
      var list = rows.map(function (r) {
        return '<div class="guide-row">' +
          '<div class="guide-k">' + esc(r.k) + "</div>" +
          '<div class="guide-v">' + esc(r.v) + "</div>" +
        "</div>";
      }).join("");
      return '<div class="guide-card">' +
        '<div class="guide-head"><span class="guide-ico">' + icon + "</span>" + esc(title) + "</div>" +
        '<div class="guide-list">' + list + "</div>" +
      "</div>";
    }
    function guidesHtml(o) {
      var rigs = (o.rigs || []).map(function (r) { return { k: r.name, v: "槽位 " + r.slots + " · 容量 " + r.capacity + " · " + r.weight + " — " + r.desc }; });
      var keys = (o.keyRooms || []).map(function (r) { return { k: r.map + " · " + r.name, v: "钥匙：" + r.key + " · 产出：" + r.loot }; });
      var up = (o.upgrades || []).map(function (r) { return { k: "特勤处 " + r.level, v: "花费 " + r.cost + " · " + r.bonus }; });
      var ex = (o.expansion || []).map(function (r) { return { k: r.name, v: r.price + " · " + r.capacity }; });
      var sc = (o.scopes || []).map(function (r) { return { k: r.name, v: r.type + " · 倍率 " + r.zoom + " · " + r.style }; });
      var np = (o.npc || []).map(function (r) { return { k: r.name, v: "血量 " + r.hp + " · 护甲 " + r.armor + " · 出现：" + r.map }; });
      return '<div class="section-title">🎯 新手攻略 · 从零上手三角洲行动</div>' +
        '<p class="guide-intro">整合胸挂选择、钥匙房、特勤处升级、扩容箱、瞄具、敌人、容器等入门要点。数据与官方存在版本差异时，以游戏内为准。</p>' +
        '<div class="guide-grid">' +
          guideSection("胸挂怎么选", "🎒", rigs) +
          guideSection("钥匙房在哪", "🔑", keys) +
          guideSection("特勤处升级路线", "🏭", up) +
          guideSection("安全箱 / 扩容箱", "📦", ex) +
          guideSection("瞄具怎么挑", "🔭", sc) +
          guideSection("常见敌人与BOSS", "👾", np) +
        "</div>" +
        '<div class="guide-tip card">💡 <b>入门三步曲：</b>①先在「特勤处产物推荐」挑耗时短、小时利润高的产物刷钱；②进图优先开钥匙房与容器；③把贵重物资放进安全箱，阵亡不掉落。</div>';
    }

    /* ---------------- 三角洲小知识（分享 / 点赞 / 复制） ---------------- */
    var USER_KEY = "df-trivia-user";
    var LIKE_KEY = "df-trivia-likes";
    function userTrivia() { try { return JSON.parse(localStorage.getItem(USER_KEY) || "[]"); } catch (e) { return []; } }
    function likeMap() { try { return JSON.parse(localStorage.getItem(LIKE_KEY) || "{}"); } catch (e) { return {}; } }
    function saveUserTrivia(a) { try { localStorage.setItem(USER_KEY, JSON.stringify(a)); } catch (e) {} }
    function saveLikeMap(m) { try { localStorage.setItem(LIKE_KEY, JSON.stringify(m)); } catch (e) {} }
    function triviaCard(t, idx, mine) {
      var likes = likeMap();
      var n = (t.likes || 0) + (likes[t.id] ? 1 : 0);
      var liked = likes[t.id] ? " liked" : "";
      return '<div class="trivia-card' + (mine ? " mine" : "") + '">' +
        '<div class="trivia-top">' +
          '<span class="trivia-tag">' + esc(t.tag || "小知识") + "</span>" +
          (mine ? '<span class="trivia-mine">我分享的</span>' : "") +
        "</div>" +
        '<div class="trivia-title">' + esc(t.title) + "</div>" +
        '<div class="trivia-body">' + esc(t.body) + "</div>" +
        '<div class="trivia-actions">' +
          '<button class="t-btn like-btn' + liked + '" data-id="' + esc(t.id) + '">👍 <span>' + n + "</span></button>" +
          '<button class="t-btn copy-btn" data-id="' + esc(t.id) + '">📋 复制</button>' +
          (mine ? '<button class="t-btn del-btn" data-id="' + esc(t.id) + '">🗑 撤回</button>' : "") +
        "</div></div>";
    }
    function triviaHtml(o) {
      var base = (o.trivia || []).map(function (t, i) { return triviaCard({ id: "s" + i, tag: t.tag, title: t.title, body: t.body, likes: 0 }, i, false); });
      var mine = userTrivia().map(function (t) { return triviaCard(t, 0, true); });
      return '<div class="section-title">🧠 三角洲小知识 · 战友分享</div>' +
        '<p class="guide-intro">看到好用的技巧？点「分享小知识」发布，所有访客都能看到你的分享（保存在本机，刷新不丢）。觉得有用就点赞 👍。</p>' +
        '<div class="trivia-sharebar">' +
          '<input id="tTitle" class="t-input" placeholder="一句话标题，如：撤离点要等倒计时">' +
          '<input id="tTag" class="t-input t-tag" placeholder="标签(可选)">' +
          '<textarea id="tBody" class="t-area" placeholder="详细内容…"></textarea>' +
          '<div class="trivia-sharebar-actions">' +
            '<button class="btn-primary" id="tSubmit">分享小知识</button>' +
            '<span class="t-msg" id="tMsg"></span>' +
          "</div>" +
        "</div>" +
        '<div class="trivia-grid" id="triviaGrid">' + base.concat(mine).join("") + "</div>";
    }
    function triviaInit(D) {
      function refresh() { var g = document.getElementById("triviaGrid"); if (g) g.innerHTML = triviaHtmlBody(D.getData()); }
      function triviaHtmlBody(o) {
        var base = (o.trivia || []).map(function (t, i) { return triviaCard({ id: "s" + i, tag: t.tag, title: t.title, body: t.body, likes: 0 }, i, false); });
        var mine = userTrivia().map(function (t) { return triviaCard(t, 0, true); });
        return base.concat(mine).join("");
      }
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
        document.getElementById("tTitle").value = "";
        document.getElementById("tBody").value = "";
        document.getElementById("tTag").value = "";
        msg.textContent = "已分享！"; msg.style.color = "#2ecc71";
        refresh();
      });
      document.getElementById("triviaGrid").addEventListener("click", function (e) {
        var like = e.target.closest(".like-btn");
        var copy = e.target.closest(".copy-btn");
        var del = e.target.closest(".del-btn");
        if (like) {
          var id = like.getAttribute("data-id");
          var m = likeMap();
          if (m[id]) delete m[id]; else m[id] = 1;
          saveLikeMap(m);
          refresh();
        } else if (copy) {
          var card = copy.closest(".trivia-card");
          var txt = card.querySelector(".trivia-title").textContent + "\n" + card.querySelector(".trivia-body").textContent;
          try { navigator.clipboard.writeText(txt); } catch (ee) {}
          var old = copy.textContent; copy.textContent = "✅ 已复制"; setTimeout(function () { copy.textContent = old; }, 1200);
        } else if (del) {
          var id2 = del.getAttribute("data-id");
          var arr2 = userTrivia().filter(function (t) { return t.id !== id2; });
          saveUserTrivia(arr2); refresh();
        }
      });
    }

    /* ---------------- 宝藏开箱模拟 ---------------- */
    function treasureHtml(o) {
      var boxes = (o.containers || []).map(function (c) { return c.name; });
      var opts = boxes.map(function (b) { return '<option>' + esc(b) + "</option>"; }).join("");
      return '<div class="section-title">🎁 宝藏开箱模拟</div>' +
        '<div class="tool-card">' +
          '<p class="guide-intro">模拟开箱，看看今天手气如何。结果随机，纯娱乐。</p>' +
          '<div class="tool-row"><label>选择容器</label><select id="trBox">' + opts + "</select></div>" +
          '<div class="tool-row"><label>开箱次数</label><input id="trN" type="number" min="1" max="20" value="3"></div>' +
          '<button class="btn-primary" id="trGo">开箱！</button>' +
          '<div class="tool-result" id="trResult"></div>' +
        "</div>";
    }
    function treasureInit(D) {
      var btn = document.getElementById("trGo");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var o = D.getData();
        var box = document.getElementById("trBox").value;
        var n = Math.max(1, Math.min(20, +document.getElementById("trN").value || 1));
        var container = (o.containers || []).find(function (c) { return c.name === box; }) || { output: "未知物资" };
        var pool = ["传说武器箱", "金条×1", "高级配件", "医疗包", "弹药盒", "工具零件", "空", "空", "普通物资", container.output];
        var res = [];
        for (var i = 0; i < n; i++) res.push(pool[Math.floor(Math.random() * pool.length)]);
        document.getElementById("trResult").innerHTML = res.map(function (r, i) {
          return '<div class="loot-line"><span class="loot-i">#' + (i + 1) + "</span>" +
            '<span class="loot-x">' + esc(r) + "</span></div>";
        }).join("");
      });
    }

    /* ---------------- 随机舔包 ---------------- */
    function lootHtml() {
      return '<div class="section-title">🥡 随机舔包生成器</div>' +
        '<div class="tool-card">' +
          '<p class="guide-intro">帮你随机生成一套撤离背包配置，作为配装思路参考。</p>' +
          '<button class="btn-primary" id="loGo">帮我舔一包</button>' +
          '<div class="tool-result" id="loResult"></div>' +
        "</div>";
    }
    function lootInit(D) {
      var btn = document.getElementById("loGo");
      if (!btn) return;
      var guns = ["AKM", "M4A1", "M250", "ASVAL", "AWM", "MP5", "M870", "G18"];
      var armor = ["轻甲", "中甲", "重甲", "无甲"];
      var item = ["医疗包", "绷带×3", "能量饮料", "破片雷", "震撼弹", "止痛药", "工具箱", "安全箱扩容"];
      btn.addEventListener("click", function () {
        function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
        var bag = [pick(guns), pick(armor), pick(item), pick(item), pick(item)];
        document.getElementById("loResult").innerHTML = bag.map(function (b, i) {
          return '<div class="loot-line"><span class="loot-i">槽' + (i + 1) + "</span><span class=\"loot-x\">" + esc(b) + "</span></div>";
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
    D.VIEWS.trivia = { html: function () { return triviaHtml(D.getData()); }, init: function () { triviaInit(D); } };
    D.VIEWS.treasure = { html: function () { return treasureHtml(D.getData()); }, init: function () { treasureInit(D); } };
    D.VIEWS.loot = { html: function () { return lootHtml(); }, init: function () { lootInit(D); } };
    D.VIEWS.scatter = { html: function () { return scatterHtml(D.getData()); } };

    D.MENU.push(
      { group: "攻略", items: [
        { route: "guides", label: "新手攻略", ico: "🎯" },
        { route: "trivia", label: "三角洲小知识", ico: "🧠" }
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
