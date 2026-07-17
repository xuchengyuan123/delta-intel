/* 三角洲情报台 · 全站共享脚本
 * 职责：公告横幅、登录态读取、通用评论组件、全站搜索调用。
 * 所有页面引入本文件即可获得上述能力（配合 #siteAnnounce 容器）。
 */
(function () {
  "use strict";
  window.DELTA_API = window.DELTA_API || "https://api.delta.shopping";
  var API = window.DELTA_API;
  var KT = "di_user_token", KID = "di_user_id", KR = "di_user_role";

  function getToken() { try { return localStorage.getItem(KT) || ""; } catch (e) { return ""; } }
  function getId() { try { return localStorage.getItem(KID) || ""; } catch (e) { return ""; } }
  function getRole() { try { return localStorage.getItem(KR) || ""; } catch (e) { return ""; } }
  function isLogin() { return !!getToken(); }
  function esc(s){s=String(s==null?'':s);var q=String.fromCharCode(34);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(new RegExp(q,'g'),'&quot;').replace(/'/g,'&#39;');}
  function fmt(ts) {
    try { var d = new Date(ts); if (isNaN(d)) return "";
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
    catch (e) { return ""; }
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers["Content-Type"] = "application/json";
    var t = getToken();
    if (t) opts.headers["Authorization"] = "Bearer " + t;
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return { error: "服务器返回异常" }; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }

  /* ===== 公告横幅 ===== */
  function renderAnnouncements() {
    var box = document.getElementById("siteAnnounce");
    if (!box) return;
    api("/api/announce", { method: "GET" }).then(function (j) {
      var list = (j.announcements || []);
      if (!list.length) { box.innerHTML = ""; return; }
      var dismissed = {};
      try { dismissed = JSON.parse(localStorage.getItem("di_ann_dismiss") || "{}"); } catch (e) {}
      var html = list.filter(function (a) { return !dismissed[a.id]; }).map(function (a) {
        var color = a.color || "info";
        return '<div class="ann-bar ' + esc(color) + '" data-id="' + esc(a.id) + '">' +
          '<span class="ann-text">' + esc(a.text) + '</span>' +
          '<button class="ann-close" data-id="' + esc(a.id) + '" title="不再显示">✕</button></div>';
      }).join("");
      box.innerHTML = html;
      box.querySelectorAll(".ann-close").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          dismissed[id] = 1;
          try { localStorage.setItem("di_ann_dismiss", JSON.stringify(dismissed)); } catch (e) {}
          var bar = box.querySelector('.ann-bar[data-id="' + CSS.escape(id) + '"]');
          if (bar) bar.remove();
        });
      });
    }).catch(function () { box.innerHTML = ""; });
  }

  /* ===== 通用评论组件 =====
   * 用法：<div id="cmtWrap" data-target="ugc:xxxx"></div>
   *       mountComments(document.getElementById("cmtWrap"))
   */
  function mountComments(wrap) {
    if (!wrap) return;
    var target = wrap.getAttribute("data-target") || wrap.dataset.target;
    if (!target) return;
    wrap.innerHTML = '<div class="cmt-list"><div class="status">加载评论…</div></div>' +
      '<div class="cmt-box">' +
      (isLogin()
        ? '<textarea id="cmtInput" placeholder="写下你的评论…"></textarea><div style="text-align:right;margin-top:6px"><button class="btn sm" id="cmtSend">发表评论</button></div>'
        : '<div class="login-hint">登录后才能评论，<a href="forum.html">去登录</a>。</div>') +
      '</div>';
    function load() {
      var listEl = wrap.querySelector(".cmt-list");
      api("/api/comments?target=" + encodeURIComponent(target), { method: "GET" }).then(function (j) {
        var list = j.comments || [];
        if (!list.length) { listEl.innerHTML = '<div class="status" style="padding:10px">还没有评论，抢沙发～</div>'; return; }
        listEl.innerHTML = list.map(function (c) {
          return '<div class="cmt"><span class="cauthor">' + esc(c.author) + '</span> · <span style="color:var(--muted);font-size:12px">' + fmt(c.createdAt) + '</span>' +
            '<div class="cbody">' + esc(c.body) + '</div></div>';
        }).join("");
      }).catch(function () { listEl.innerHTML = '<div class="status err">评论加载失败</div>'; });
    }
    var send = wrap.querySelector("#cmtSend");
    if (send) send.addEventListener("click", function () {
      var txt = wrap.querySelector("#cmtInput").value.trim();
      if (!txt) { alert("评论内容不能为空"); return; }
      send.disabled = true;
      api("/api/comments", { method: "POST", body: JSON.stringify({ target: target, body: txt }) })
        .then(function () { wrap.querySelector("#cmtInput").value = ""; load(); })
        .catch(function (e) { alert(e.message || "评论失败"); })
        .then(function () { send.disabled = false; });
    });
    load();
  }

  /* ===== 好友 / 私聊 / 头像 / 在线状态 ===== */
  function me() { return api("/api/me", { method: "GET" }); }
  function friends() { return api("/api/friends", { method: "GET" }); }
  function friendSearch(q) { return api("/api/friends/search?q=" + encodeURIComponent(q || ""), { method: "GET" }); }
  function friendRequest(to) { return api("/api/friends/request", { method: "POST", body: JSON.stringify({ to: to }) }); }
  function friendRespond(from, action) { return api("/api/friends/respond", { method: "POST", body: JSON.stringify({ from: from, action: action }) }); }
  function friendRemove(id) { return api("/api/friends/" + encodeURIComponent(id), { method: "DELETE" }); }
  function messages(withId) { return api("/api/messages?with=" + encodeURIComponent(withId), { method: "GET" }); }
  function sendMessage(to, text) { return api("/api/messages", { method: "POST", body: JSON.stringify({ to: to, text: text }) }); }
  function uploadAvatar(dataUrl) { return api("/api/user/avatar", { method: "PUT", body: JSON.stringify({ image: dataUrl }) }); }
  /* ===== 好友群聊 ===== */
  function myGroups() { return api("/api/groups/mine", { method: "GET" }); }
  function createGroup(name, members) { return api("/api/groups", { method: "POST", body: JSON.stringify({ name: name, members: members || [] }) }); }
  function groupInfo(id) { return api("/api/groups/" + encodeURIComponent(id), { method: "GET" }); }
  function groupChat(id) { return api("/api/groups/" + encodeURIComponent(id) + "/chat", { method: "GET" }); }
  function sendGroupMessage(id, text) { return api("/api/groups/" + encodeURIComponent(id) + "/chat", { method: "POST", body: JSON.stringify({ text: text }) }); }
  function groupAdd(id, email) { return api("/api/groups/" + encodeURIComponent(id) + "/add", { method: "POST", body: JSON.stringify({ email: email }) }); }
  function groupLeave(id) { return api("/api/groups/" + encodeURIComponent(id) + "/leave", { method: "POST" }); }
  /* ===== 战队群聊 ===== */
  function teamChat(id) { return api("/api/teams/" + encodeURIComponent(id) + "/chat", { method: "GET" }); }
  function sendTeamMessage(id, text) { return api("/api/teams/" + encodeURIComponent(id) + "/chat", { method: "POST", body: JSON.stringify({ text: text }) }); }
  function poll(fn, ms) { if (typeof fn !== "function") return null; var t = setInterval(fn, ms || 20000); fn(); return t; }

  window.DeltaCommon = {
    API: API, api: api, getToken: getToken, getId: getId, getRole: getRole, isLogin: isLogin,
    esc: esc, fmt: fmt, renderAnnouncements: renderAnnouncements, mountComments: mountComments,
    me: me, friends: friends, friendSearch: friendSearch, friendRequest: friendRequest,
    friendRespond: friendRespond, friendRemove: friendRemove, messages: messages,
    sendMessage: sendMessage, uploadAvatar: uploadAvatar,
    myGroups: myGroups, createGroup: createGroup, groupInfo: groupInfo, groupChat: groupChat,
    sendGroupMessage: sendGroupMessage, groupAdd: groupAdd, groupLeave: groupLeave,
    teamChat: teamChat, sendTeamMessage: sendTeamMessage, poll: poll
  };

  // 页面加载后自动渲染公告横幅
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderAnnouncements);
  else renderAnnouncements();
})();
