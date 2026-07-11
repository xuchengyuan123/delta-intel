// 三角洲情报台 前端：情报展示 + 论坛 + 管理员登录（纯静态 / localStorage）
(function () {
  "use strict";

  /* ===================== 管理员账号（可自行修改） =====================
   * 纯静态网站没有后端，这里是“前端管理员”，用于删帖/置顶等管理操作。
   * 想改用户名/密码，直接改下面两行即可。
   * 提示：前端密码任何人看源码都能看到，仅用于日常管理、防误改，
   *      不要用它保护真正机密的东西。
   * ================================================================ */
  var ADMIN_USER = "admin";
  var ADMIN_PASS = "delta2026";

  var $content = document.getElementById("content");
  var LS_POSTS = "deltaintel_posts_v1";
  var SS_ADMIN = "deltaintel_admin";

  // ---------- 小工具 ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
    return el;
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString(); }
  function fmtTime(ts) {
    var d = new Date(ts);
    function p(x) { return String(x).padStart(2, "0"); }
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function isAdmin() { return sessionStorage.getItem(SS_ADMIN) === "1"; }

  // ===================== 一、情报展示 =====================
  function fetchData() {
    return fetch("data.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("data.json " + r.status); return r.json(); });
  }

  function renderStats(data) {
    var maps = (data.maps || []).length;
    var items = (data.items || []).length;
    var profit = 0;
    (data.items || []).forEach(function (it) { profit += (it.profit || 0); });
    return h("div", { class: "stats" }, [
      h("div", { class: "stat" }, [h("div", { class: "num" }, [String(maps)]), h("div", { class: "label" }, ["今日地图"])]),
      h("div", { class: "stat" }, [h("div", { class: "num" }, [String(items)]), h("div", { class: "label" }, ["推荐产物"])]),
      h("div", { class: "stat" }, [h("div", { class: "num" }, [fmtNum(profit)]), h("div", { class: "label" }, ["合计时利润"])])
    ]);
  }

  function renderMaps(data) {
    var cards = (data.maps || []).map(function (m) {
      return h("div", { class: "card map" }, [
        h("div", { class: "name" }, [m.name || ""]),
        h("div", { class: "pwd" }, [m.code || "----"]),
        h("div", { class: "time" }, [m.date || ""])
      ]);
    });
    return h("div", { class: "section" }, [
      h("h2", null, ["每日地图密码"]),
      h("div", { class: "grid maps" }, cards)
    ]);
  }

  function renderItems(data) {
    var rows = (data.items || []).map(function (it) {
      return h("tr", null, [
        h("td", null, [it.station || ""]),
        h("td", null, [it.name || ""]),
        h("td", null, [fmtNum(it.profit)]),
        h("td", null, [fmtNum(it.price)]),
        h("td", null, [it.sell || ""])
      ]);
    });
    return h("div", { class: "section" }, [
      h("h2", null, ["特勤处制作产物推荐（Top）"]),
      h("div", { class: "table-wrap" }, [
        h("table", null, [
          h("thead", null, [h("tr", null, [
            h("th", null, ["工作台"]), h("th", null, ["产物"]),
            h("th", null, ["当前利润"]), h("th", null, ["理想售价"]), h("th", null, ["建议卖"])
          ])]),
          h("tbody", null, rows)
        ])
      ])
    ]);
  }

  function renderBullets(data) {
    var rows = (data.bullets || []).map(function (b, i) {
      return h("tr", null, [
        h("td", null, [String(i + 1)]),
        h("td", null, [b.name || ""]),
        h("td", null, [fmtNum(b.profit)])
      ]);
    });
    return h("div", { class: "section" }, [
      h("h2", null, ["热门子弹利润"]),
      h("div", { class: "table-wrap" }, [
        h("table", null, [
          h("thead", null, [h("tr", null, [
            h("th", null, ["#"]), h("th", null, ["子弹"]), h("th", null, ["利润"])
          ])]),
          h("tbody", null, rows)
        ])
      ])
    ]);
  }

  function renderEventItems(data) {
    var ev = data.eventItems;
    if (!ev || !ev.items || !ev.items.length) return null;
    var rows = ev.items.map(function (it) {
      return h("tr", null, [
        h("td", null, [it.name || ""]),
        h("td", null, [fmtNum(it.cur)]),
        h("td", null, [fmtNum(it.ideal)]),
        h("td", null, [it.cur > it.ideal ? "高于理想价" : "低于理想价"])
      ]);
    });
    return h("div", { class: "section" }, [
      h("h2", null, [ev.title || "活动物品需求"]),
      ev.period ? h("p", { class: "sub", style: "margin-bottom:12px" }, ["活动时间：" + ev.period]) : null,
      h("div", { class: "table-wrap" }, [
        h("table", null, [
          h("thead", null, [h("tr", null, [
            h("th", null, ["物品"]), h("th", null, ["当前售价"]),
            h("th", null, ["理想售价"]), h("th", null, ["提示"])
          ])]),
          h("tbody", null, rows)
        ])
      ])
    ]);
  }

  function renderMaterials(data) {
    var mats = data.materials || [];
    if (!mats.length) return null;
    var rows = mats.map(function (m) {
      return h("tr", null, [
        h("td", null, [m.name || ""]),
        h("td", null, [fmtNum(m.cur)]),
        h("td", null, [fmtNum(m.min)]),
        h("td", null, [fmtNum(m.max)]),
        h("td", null, [m.buy || ""]),
        h("td", null, [m.sell || ""])
      ]);
    });
    return h("div", { class: "section" }, [
      h("h2", null, ["高价格浮动制造材料（Top 4）"]),
      h("div", { class: "table-wrap" }, [
        h("table", null, [
          h("thead", null, [h("tr", null, [
            h("th", null, ["材料"]), h("th", null, ["当前"]), h("th", null, ["最低"]),
            h("th", null, ["最高"]), h("th", null, ["建议买"]), h("th", null, ["建议卖"])
          ])]),
          h("tbody", null, rows)
        ])
      ])
    ]);
  }

  function renderIntel(data) {
    $content.innerHTML = "";
    $content.appendChild(renderStats(data));
    $content.appendChild(renderMaps(data));
    $content.appendChild(renderItems(data));
    $content.appendChild(renderBullets(data));
    var ev = renderEventItems(data); if (ev) $content.appendChild(ev);
    var mats = renderMaterials(data); if (mats) $content.appendChild(mats);
    var upd = document.createElement("p");
    upd.style.cssText = "text-align:center;color:var(--muted);font-size:12px;margin-top:16px";
    upd.textContent = "最后更新：" + (data.updatedAt ? fmtTime(data.updatedAt) : "未知");
    $content.appendChild(upd);
  }

  // ===================== 二、论坛（localStorage） =====================
  function loadPosts() {
    try { return JSON.parse(localStorage.getItem(LS_POSTS) || "[]"); }
    catch (e) { return []; }
  }
  function savePosts(posts) {
    localStorage.setItem(LS_POSTS, JSON.stringify(posts));
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function addPost(author, body) {
    var posts = loadPosts();
    posts.push({ id: newId(), author: author, body: body, time: Date.now(), pinned: false, replies: [] });
    savePosts(posts);
  }
  function addReply(postId, author, body) {
    var posts = loadPosts();
    var p = posts.find(function (x) { return x.id === postId; });
    if (p) {
      p.replies = p.replies || [];
      p.replies.push({ id: newId(), author: author, body: body, time: Date.now() });
      savePosts(posts);
    }
  }
  function deletePost(postId) {
    savePosts(loadPosts().filter(function (x) { return x.id !== postId; }));
  }
  function deleteReply(postId, replyId) {
    var posts = loadPosts();
    var p = posts.find(function (x) { return x.id === postId; });
    if (p) { p.replies = (p.replies || []).filter(function (r) { return r.id !== replyId; }); savePosts(posts); }
  }
  function togglePin(postId) {
    var posts = loadPosts();
    var p = posts.find(function (x) { return x.id === postId; });
    if (p) { p.pinned = !p.pinned; savePosts(posts); }
  }

  function getNick() { return (document.getElementById("nickInput").value || "").trim(); }

  function renderForum() {
    var list = document.getElementById("postList");
    list.innerHTML = "";
    var posts = loadPosts().slice();
    // 置顶优先，其余按时间倒序
    posts.sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.time - a.time;
    });

    if (!posts.length) {
      list.appendChild(h("div", { class: "empty" }, ["还没有人发帖，来当第一个吧～"]));
      return;
    }

    posts.forEach(function (p) {
      var meta = h("div", { class: "forum-meta" }, [
        h("span", null, [
          p.pinned ? h("span", { class: "pin-tag" }, ["置顶"]) : null,
          h("span", { class: "forum-author" }, [p.author || "匿名"])
        ]),
        h("span", null, [fmtTime(p.time)])
      ]);

      var actions = h("div", { class: "forum-actions" }, []);
      var replyBtn = h("button", { class: "btn small" }, ["回复"]);
      var replyBox = h("div", { class: "reply-box" }, []);
      var rNick = h("input", { placeholder: "昵称", maxlength: "20" });
      var rBody = h("input", { placeholder: "回复内容", maxlength: "300" });
      var rSend = h("button", { class: "btn small primary" }, ["发送回复"]);
      rSend.onclick = function () {
        var nick = (rNick.value || getNick() || "匿名").trim();
        var body = (rBody.value || "").trim();
        if (!body) return;
        addReply(p.id, nick, body);
        renderForum();
      };
      replyBox.appendChild(h("div", { class: "forum-row", style: "margin-bottom:8px" }, [rNick]));
      replyBox.appendChild(h("div", { class: "forum-row", style: "gap:8px" }, [rBody, rSend]));
      replyBtn.onclick = function () { replyBox.classList.toggle("show"); };
      actions.appendChild(replyBtn);

      if (isAdmin()) {
        var pinBtn = h("button", { class: "btn small" }, [p.pinned ? "取消置顶" : "置顶"]);
        pinBtn.onclick = function () { togglePin(p.id); renderForum(); };
        var delBtn = h("button", { class: "btn small danger" }, ["删除"]);
        delBtn.onclick = function () { if (confirm("删除这条帖子？")) { deletePost(p.id); renderForum(); } };
        actions.appendChild(pinBtn);
        actions.appendChild(delBtn);
      }

      var item = h("div", { class: "forum-item" + (p.pinned ? " pinned" : "") }, [
        meta,
        h("div", { class: "forum-body" }, [p.body || ""]),
        actions,
        replyBox
      ]);

      // 回复列表
      (p.replies || []).forEach(function (r) {
        var rMeta = h("div", { class: "forum-meta" }, [
          h("span", { class: "forum-author" }, [r.author || "匿名"]),
          h("span", null, [fmtTime(r.time)])
        ]);
        var rChildren = [rMeta, h("div", { class: "forum-body" }, [r.body || ""])];
        if (isAdmin()) {
          var rDel = h("button", { class: "btn small danger", style: "margin-top:6px" }, ["删除回复"]);
          rDel.onclick = function () { deleteReply(p.id, r.id); renderForum(); };
          rChildren.push(rDel);
        }
        item.appendChild(h("div", { class: "reply" }, rChildren));
      });

      list.appendChild(item);
    });
  }

  function bindForum() {
    document.getElementById("postBtn").onclick = function () {
      var nick = getNick() || "匿名";
      var body = (document.getElementById("postInput").value || "").trim();
      if (!body) { alert("说点什么再发布吧"); return; }
      addPost(nick, body);
      document.getElementById("postInput").value = "";
      renderForum();
    };
  }

  // ===================== 三、管理员登录 =====================
  function refreshTopbar() {
    var bar = document.getElementById("topbar");
    bar.innerHTML = "";
    if (isAdmin()) {
      bar.appendChild(h("span", { class: "admin-badge" }, ["● 管理员已登录"]));
      var out = h("button", { class: "btn small" }, ["退出管理"]);
      out.onclick = function () { sessionStorage.removeItem(SS_ADMIN); refreshTopbar(); renderForum(); };
      bar.appendChild(out);
    } else {
      var login = h("button", { class: "btn small" }, ["管理登录"]);
      login.onclick = function () { document.getElementById("adminModal").classList.add("show"); };
      bar.appendChild(login);
    }
  }

  function bindAdmin() {
    var modal = document.getElementById("adminModal");
    var err = document.getElementById("adminErr");
    function close() {
      modal.classList.remove("show");
      err.textContent = "";
      document.getElementById("adminUser").value = "";
      document.getElementById("adminPass").value = "";
    }
    document.getElementById("adminCancel").onclick = close;
    modal.onclick = function (e) { if (e.target === modal) close(); };
    document.getElementById("adminLogin").onclick = function () {
      var u = document.getElementById("adminUser").value.trim();
      var pw = document.getElementById("adminPass").value;
      if (u === ADMIN_USER && pw === ADMIN_PASS) {
        sessionStorage.setItem(SS_ADMIN, "1");
        close();
        refreshTopbar();
        renderForum();
      } else {
        err.textContent = "用户名或密码错误";
      }
    };
  }

  // ===================== 启动 =====================
  fetchData()
    .then(renderIntel)
    .catch(function (err) {
      $content.innerHTML = '<p style="text-align:center;color:var(--red)">数据加载失败：' + err.message + "</p>";
    });

  bindForum();
  bindAdmin();
  refreshTopbar();
  renderForum();
})();
