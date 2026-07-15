/* =========================================================
 * workbench.js — 零代码开发工作台（后台专用）
 * 三级结构：应用 → 模块 → 页面
 * 模板：内容展示(空白/列表/图文/链接/卡片/图库) + 表单收集 + 数据看板
 * 数据：应用结构存 WORKBENCH KV（/api/admin/apps），未绑定时回退 data.json.apps
 * 生成页面：经 Worker 写站点根（putFile 传纯文件名，Worker 自动加 docs/ 前缀）
 * 导航：应用/页面可一键「进前台导航」，写入 data.json.menu
 * ========================================================= */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return "w-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(s) { return s || "-"; }
  function slugify(s) {
    return String(s || "").trim().toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 40) || ("p-" + Date.now().toString(36));
  }
  function tagHtml(tags) {
    return (tags || []).map(function (t) { return '<span class="wb-tag">' + esc(t) + '</span>'; }).join("");
  }
  function parseTags(v) {
    return String(v || "").split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function b64utf8(s) { return btoa(unescape(encodeURIComponent(s))); }

  /* ---------- 模板元信息 ---------- */
  var TEMPLATES = {
    blank:    { name: "空白页",     group: "content",   icon: "📄" },
    list:     { name: "列表页",     group: "content",   icon: "📋" },
    article:  { name: "图文页",     group: "content",   icon: "📰" },
    links:    { name: "链接集合页", group: "content",   icon: "🔗" },
    grid:     { name: "卡片网格页", group: "content",   icon: "🧩" },
    gallery:  { name: "图库页",     group: "content",   icon: "🖼️" },
    form:     { name: "表单收集页", group: "form",      icon: "📝" },
    dashboard:{ name: "数据看板页", group: "dashboard", icon: "📊" }
  };
  var APP_TYPES = [
    { v: "activity", t: "活动" }, { v: "tool", t: "工具" }, { v: "info", t: "资讯" },
    { v: "community", t: "社区" }, { v: "shop", t: "商城" }, { v: "game", t: "小游戏" }, { v: "other", t: "其它" }
  ];

  /* ---------- 后台桥接（由 admin.html 经 window.__admin 注入） ---------- */
  function adminMode() { return window.__admin && window.__admin.adminMode ? window.__admin.adminMode() : "github"; }
  function getDataObj() { return window.__admin && window.__admin.getDataObj ? window.__admin.getDataObj() : Promise.reject(new Error("工作台未挂载")); }
  function putDataObj(obj, action, msgEl) { return window.__admin && window.__admin.putDataObj ? window.__admin.putDataObj(obj, action, msgEl) : Promise.reject(new Error("工作台未挂载")); }
  function putFile(path, base64, message, msgEl) { return window.__admin && window.__admin.putFile ? window.__admin.putFile(path, base64, message, msgEl) : Promise.reject(new Error("工作台未挂载")); }
  function wkFetch(u, o) { return window.__admin && window.__admin.wkFetch ? window.__admin.wkFetch(u, o) : fetch(u, o); }

  /* ---------- 挂载 ---------- */
  function mountWorkbench(c) {
    if (typeof activeRole !== "undefined" && activeRole !== "super") {
      c.innerHTML = '<div class="status" style="color:#ff5b5b">仅总管理员可使用开发工作台。</div>';
      return;
    }

    var apps = [];
    var dataObj = null;
    var apiBase = "https://api.delta.shopping";

    /* ----- 数据读写 ----- */
    function loadApps() {
      return getDataObj().then(function (d) {
        dataObj = d.obj;
        apiBase = (dataObj.site && dataObj.site.apiBase) || apiBase;
        if (adminMode() === "worker") {
          return wkFetch("/api/admin/apps").then(function (r) { return r.json(); })
            .then(function (j) { if (j.error) throw new Error(j.error); return j.apps || []; })
            .catch(function () { return dataObj.apps || []; });
        }
        return dataObj.apps || [];
      }).then(function (a) { apps = a; return a; });
    }
    function saveApps(msgEl) {
      if (adminMode() === "worker") {
        return wkFetch("/api/admin/apps", { method: "PUT", body: JSON.stringify({ apps: apps }) })
          .then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); return j; })
          .catch(function () { dataObj.apps = apps; return putDataObj(dataObj, "更新开发工作台", msgEl); });
      }
      dataObj.apps = apps;
      return putDataObj(dataObj, "更新开发工作台", msgEl);
    }
    function saveMenu(msgEl) {
      dataObj.menu = dataObj.menu || [];
      return putDataObj(dataObj, "更新前台导航菜单", msgEl);
    }
    function findApp(id) { return apps.find(function (x) { return x.id === id; }); }
    function findModule(app, id) { return app && app.modules ? app.modules.find(function (m) { return m.id === id; }) : null; }
    function findPage(mod, id) { return mod && mod.pages ? mod.pages.find(function (p) { return p.id === id; }) : null; }

    /* ----- 前台导航同步 ----- */
    function ensureNav(item) {
      dataObj.menu = dataObj.menu || [];
      var i = dataObj.menu.findIndex(function (m) { return m._wb === item._wb; });
      if (i >= 0) dataObj.menu[i] = item; else dataObj.menu.push(item);
    }
    function removeNav(key) {
      dataObj.menu = (dataObj.menu || []).filter(function (m) { return m._wb !== key; });
    }
    function syncAppNav(app) {
      if (app.inNav) ensureNav({ _wb: "app:" + app.id, href: "app-" + app.slug + ".html", ico: app.icon || "📦", label: app.navLabel || app.name });
      else removeNav("app:" + app.id);
    }
    function syncPageNav(page, app) {
      if (page.inNav) ensureNav({ _wb: "page:" + page.id, href: page.slug + ".html", ico: (app && app.icon) || "📄", label: page.navLabel || page.title });
      else removeNav("page:" + page.id);
    }

    /* ====================== 视图：总览 ====================== */
    function renderHome() {
      var appN = apps.length, modN = 0, pageN = 0, pubN = 0;
      apps.forEach(function (a) { (a.modules || []).forEach(function (m) { modN++; (m.pages || []).forEach(function (p) { pageN++; if (p.status === "published") pubN++; }); }); });
      c.innerHTML = '<div class="panel-card"><h3>🛠 零代码开发工作台</h3>' +
        '<p class="panel-tip">在这里零代码开发网站：先建「应用」，应用下加「模块」，模块下加「页面」。页面支持列表/图文/链接/卡片/图库/表单收集/数据看板等模板，点一下就能生成并上线，无需写代码。</p>' +
        '<div class="wb-stat-row">' +
          stat(appN, "应用") + stat(modN, "模块") + stat(pageN, "页面") + stat(pubN, "已发布") +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:14px;">' +
          '<button class="btn role-c" id="wbApps">📦 应用管理</button>' +
          '<button class="btn ghost" id="wbSite">⚙ 站点设置</button>' +
          '<button class="btn ghost" id="wbRel">🚀 一键发版</button>' +
        '</div></div>';
      c.querySelector("#wbApps").onclick = renderApps;
      c.querySelector("#wbSite").onclick = renderSiteSettings;
      c.querySelector("#wbRel").onclick = renderRelease;
    }
    function stat(n, label) {
      return '<div class="wb-stat"><div class="wb-stat-n">' + n + '</div><div class="wb-stat-l">' + label + '</div></div>';
    }

    /* ====================== 视图：应用列表 ====================== */
    function renderApps() {
      c.innerHTML = '<div class="panel-card"><h3>📦 应用管理</h3>' +
        '<p class="panel-tip">应用 = 一个可上线的功能模块（如活动中心、商城、投票）。点击进入后可加模块与页面。</p>' +
        '<div class="row" style="margin-bottom:14px;gap:10px;flex-wrap:wrap;">' +
          '<input id="wbSearch" class="inp" style="flex:1;min-width:160px;" placeholder="搜索应用名称…">' +
          '<button class="btn role-c" id="wbNewApp">＋ 新建应用</button>' +
          '<button class="btn ghost" id="wbHome">← 总览</button>' +
        '</div><div id="wbAppList"></div></div>';
      var box = c.querySelector("#wbAppList");
      function draw() {
        var q = c.querySelector("#wbSearch").value.trim().toLowerCase();
        var list = apps.filter(function (a) { return !q || (a.name || "").toLowerCase().indexOf(q) >= 0; });
        if (!list.length) { box.innerHTML = '<div class="status">还没有应用，点击「新建应用」。</div>'; return; }
        var html = '<div class="wb-grid">';
        list.forEach(function (a) {
          var st = { dev: "开发中", online: "已上线", offline: "已下线" }[a.status] || a.status || "开发中";
          var modN = (a.modules || []).length, pageN = (a.modules || []).reduce(function (s, m) { return s + (m.pages || []).length; }, 0);
          html += '<div class="wb-card" data-id="' + esc(a.id) + '">' +
            '<div class="wb-card-head"><span class="wb-type">' + (a.icon || "📦") + ' ' + esc(a.name || "未命名") + '</span>' +
              '<span class="wb-status st-' + esc(a.status || "dev") + '">' + esc(st) + '</span></div>' +
            '<div class="wb-meta">类型：' + esc((APP_TYPES.find(function (t) { return t.v === a.type; }) || {}).t || a.type || "-") + ' &nbsp;|&nbsp; 模块 ' + modN + ' · 页面 ' + pageN + '</div>' +
            (a.inNav ? '<div class="wb-meta">✅ 已进前台导航</div>' : '') +
            '<div class="wb-card-actions">' +
              '<button class="btn sm" data-open="' + esc(a.id) + '">打开</button>' +
              '<button class="btn ghost sm" data-edit="' + esc(a.id) + '">编辑</button>' +
              '<button class="btn danger sm" data-del="' + esc(a.id) + '">删除</button>' +
            '</div></div>';
        });
        html += '</div>';
        box.innerHTML = html;
        box.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { renderAppDetail(b.getAttribute("data-open")); }; });
        box.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { renderAppForm(b.getAttribute("data-edit")); }; });
        box.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () {
          if (!confirm("确定删除该应用及其下所有模块/页面？此操作不可恢复。")) return;
          apps = apps.filter(function (a) { return a.id !== b.getAttribute("data-del"); });
          saveApps().then(draw).catch(function () { alert("保存失败"); });
        }; });
      }
      c.querySelector("#wbSearch").oninput = draw;
      c.querySelector("#wbNewApp").onclick = function () { renderAppForm(); };
      c.querySelector("#wbHome").onclick = renderHome;
      draw();
    }

    /* ====================== 视图：应用表单 ====================== */
    function renderAppForm(id) {
      var a = id ? findApp(id) : null;
      if (id && !a) { renderApps(); return; }
      var typeOpts = APP_TYPES.map(function (t) { return '<option value="' + t.v + '"' + (a && a.type === t.v ? " selected" : "") + '>' + t.t + '</option>'; }).join("");
      c.innerHTML = '<div class="panel-card"><h3>' + (a ? "✏ 编辑应用" : "＋ 新建应用") + '</h3>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>应用名称</label><input id="aName" placeholder="如：暑期活动中心"></div>' +
          '<div class="field" style="flex:1;min-width:120px;"><label>图标(emoji)</label><input id="aIcon" placeholder="📦" maxlength="4"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>类型</label><select id="aType">' + typeOpts + '</select></div>' +
        '</div>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:1;min-width:140px;"><label>状态</label><select id="aStatus">' +
            '<option value="dev">开发中</option><option value="online">已上线</option><option value="offline">已下线</option></select></div>' +
          '<div class="field" style="flex:1;min-width:160px;"><label>前台导航名</label><input id="aNavLabel" placeholder="留空则用应用名"></div>' +
          '<div class="field" style="flex:1;min-width:120px;display:flex;align-items:flex-end;"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="aInNav"> 进前台导航</label></div>' +
        '</div>' +
        '<div class="field"><label>应用简介</label><textarea id="aDesc" rows="3" placeholder="这个应用是做什么的"></textarea></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="aSave">保存</button>' +
          '<button class="btn ghost" id="aCancel">取消</button>' +
          '<span class="msg" id="aMsg"></span>' +
        '</div></div>';
      if (a) {
        c.querySelector("#aName").value = a.name || "";
        c.querySelector("#aIcon").value = a.icon || "";
        c.querySelector("#aType").value = a.type || "other";
        c.querySelector("#aStatus").value = a.status || "dev";
        c.querySelector("#aNavLabel").value = a.navLabel || "";
        c.querySelector("#aDesc").value = a.desc || "";
        c.querySelector("#aInNav").checked = !!a.inNav;
      }
      c.querySelector("#aCancel").onclick = renderApps;
      c.querySelector("#aSave").onclick = function () {
        var name = c.querySelector("#aName").value.trim();
        if (!name) { alert("请输入应用名称"); return; }
        var rec = a || { id: uid(), createdAt: today(), slug: "", modules: [] };
        rec.name = name;
        rec.icon = c.querySelector("#aIcon").value.trim() || "📦";
        rec.type = c.querySelector("#aType").value;
        rec.status = c.querySelector("#aStatus").value;
        rec.navLabel = c.querySelector("#aNavLabel").value.trim();
        rec.desc = c.querySelector("#aDesc").value.trim();
        var inNav = c.querySelector("#aInNav").checked;
        if (!rec.slug) rec.slug = slugify(name);
        if (a) { if (a.inNav !== inNav) { rec.inNav = inNav; syncAppNav(rec); } }
        else { rec.inNav = inNav; if (inNav) syncAppNav(rec); }
        if (!a) apps.unshift(rec);
        saveApps(c.querySelector("#aMsg")).then(function () {
          if (rec.inNav) return saveMenu().then(function () { renderApps(); });
          renderApps();
        }).catch(function () {});
      };
    }

    /* ====================== 视图：应用详情 ====================== */
    function renderAppDetail(appId) {
      var a = findApp(appId);
      if (!a) { renderApps(); return; }
      var st = { dev: "开发中", online: "已上线", offline: "已下线" }[a.status] || a.status;
      c.innerHTML = '<div class="panel-card"><h3>' + esc(a.icon || "📦") + ' ' + esc(a.name) + ' <span class="tag" style="background:var(--bg-soft);color:var(--muted);">' + esc(st) + '</span></h3>' +
        '<p class="panel-tip">' + esc(a.desc || "无简介") + '</p>' +
        '<div class="row" style="gap:10px;margin:12px 0;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="wbNewMod">＋ 新建模块</button>' +
          '<button class="btn ghost" id="wbGenHome">🌐 生成应用首页</button>' +
          '<button class="btn ghost" id="wbToggleNav">' + (a.inNav ? "🚫 取消进导航" : "✅ 进前台导航") + '</button>' +
          '<button class="btn ghost" id="wbEditApp">✏ 编辑</button>' +
          '<button class="btn ghost" id="wbBack">← 应用列表</button>' +
        '</div>' +
        '<h4 style="margin:14px 0 8px;font-size:14px;">模块（' + ((a.modules || []).length) + '）</h4>' +
        '<div id="wbModList"></div></div>';
      c.querySelector("#wbBack").onclick = renderApps;
      c.querySelector("#wbNewMod").onclick = function () { renderModuleForm(appId); };
      c.querySelector("#wbEditApp").onclick = function () { renderAppForm(appId); };
      c.querySelector("#wbGenHome").onclick = function () { generateAppHome(a); };
      c.querySelector("#wbToggleNav").onclick = function () {
        a.inNav = !a.inNav;
        if (a.inNav) { if (!a.slug) a.slug = slugify(a.name); syncAppNav(a); }
        else removeNav("app:" + a.id);
        saveApps().then(function () { if (a.inNav) return saveMenu().then(function () { renderAppDetail(appId); }); renderAppDetail(appId); }).catch(function () {});
      };
      var box = c.querySelector("#wbModList");
      var mods = a.modules || [];
      if (!mods.length) { box.innerHTML = '<div class="status">还没有模块，点击「新建模块」。</div>'; return; }
      var html = '<div class="wb-grid">';
      mods.forEach(function (m) {
        var pageN = (m.pages || []).length;
        html += '<div class="wb-card" data-id="' + esc(m.id) + '">' +
          '<div class="wb-card-head"><span class="wb-type">' + (m.icon || "📁") + ' ' + esc(m.name) + '</span><span class="wb-meta">页面 ' + pageN + '</span></div>' +
          (m.desc ? '<div class="wb-meta">' + esc(m.desc) + '</div>' : '') +
          '<div class="wb-card-actions">' +
            '<button class="btn sm" data-open="' + esc(m.id) + '">打开</button>' +
            '<button class="btn ghost sm" data-edit="' + esc(m.id) + '">编辑</button>' +
            '<button class="btn danger sm" data-del="' + esc(m.id) + '">删除</button>' +
          '</div></div>';
      });
      html += '</div>';
      box.innerHTML = html;
      box.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { renderModuleDetail(appId, b.getAttribute("data-open")); }; });
      box.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { renderModuleForm(appId, b.getAttribute("data-edit")); }; });
      box.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () {
        if (!confirm("删除该模块及其下所有页面？")) return;
        a.modules = a.modules.filter(function (m) { return m.id !== b.getAttribute("data-del"); });
        saveApps().then(function () { renderAppDetail(appId); }).catch(function () { alert("保存失败"); });
      }; });
    }

    /* ====================== 视图：模块表单 ====================== */
    function renderModuleForm(appId, moduleId) {
      var a = findApp(appId); if (!a) { renderApps(); return; }
      var m = moduleId ? findModule(a, moduleId) : null;
      c.innerHTML = '<div class="panel-card"><h3>' + (m ? "✏ 编辑模块" : "＋ 新建模块") + ' · ' + esc(a.name) + '</h3>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>模块名称</label><input id="mName" placeholder="如：报名通道"></div>' +
          '<div class="field" style="flex:1;min-width:120px;"><label>图标(emoji)</label><input id="mIcon" placeholder="📁" maxlength="4"></div>' +
        '</div>' +
        '<div class="field"><label>模块简介</label><input id="mDesc" placeholder="这个模块是做什么的"></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="mSave">保存</button>' +
          '<button class="btn ghost" id="mCancel">取消</button>' +
        '</div></div>';
      if (m) { c.querySelector("#mName").value = m.name || ""; c.querySelector("#mIcon").value = m.icon || ""; c.querySelector("#mDesc").value = m.desc || ""; }
      c.querySelector("#mCancel").onclick = function () { renderAppDetail(appId); };
      c.querySelector("#mSave").onclick = function () {
        var name = c.querySelector("#mName").value.trim();
        if (!name) { alert("请输入模块名称"); return; }
        var rec = m || { id: uid(), createdAt: today(), pages: [] };
        rec.name = name; rec.icon = c.querySelector("#mIcon").value.trim() || "📁"; rec.desc = c.querySelector("#mDesc").value.trim();
        if (!m) { a.modules = a.modules || []; a.modules.push(rec); }
        saveApps().then(function () { renderAppDetail(appId); }).catch(function () {});
      };
    }

    /* ====================== 视图：模块详情（页面列表） ====================== */
    function renderModuleDetail(appId, moduleId) {
      var a = findApp(appId); if (!a) { renderApps(); return; }
      var m = findModule(a, moduleId); if (!m) { renderAppDetail(appId); return; }
      c.innerHTML = '<div class="panel-card"><h3>' + esc(m.icon || "📁") + ' ' + esc(m.name) + '</h3>' +
        '<p class="panel-tip">' + esc(m.desc || "无简介") + '</p>' +
        '<div class="row" style="gap:10px;margin:12px 0;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="wbNewPage">＋ 新建页面</button>' +
          '<button class="btn ghost" id="wbEditMod">✏ 编辑模块</button>' +
          '<button class="btn ghost" id="wbBack">← 应用</button>' +
        '</div>' +
        '<h4 style="margin:14px 0 8px;font-size:14px;">页面（' + ((m.pages || []).length) + '）</h4>' +
        '<div id="wbPageList"></div></div>';
      c.querySelector("#wbBack").onclick = function () { renderAppDetail(appId); };
      c.querySelector("#wbEditMod").onclick = function () { renderModuleForm(appId, moduleId); };
      c.querySelector("#wbNewPage").onclick = function () { renderPageEditor(appId, moduleId); };
      drawPages(a, m);
    }
    function drawPages(a, m) {
      var box = c.querySelector("#wbPageList");
      var pages = m.pages || [];
      if (!pages.length) { box.innerHTML = '<div class="status">还没有页面，点击「新建页面」。</div>'; return; }
      var html = '<table class="item-table"><thead><tr><th>标题</th><th>模板</th><th>状态</th><th>前台导航</th><th>操作</th></tr></thead><tbody>';
      pages.forEach(function (p) {
        var tpl = (TEMPLATES[p.template] || {}).name || p.template;
        html += '<tr><td>' + esc(p.title) + '</td><td>' + esc(tpl) + '</td>' +
          '<td>' + (p.status === "published" ? "✅ 已发布" : "📝 草稿") + '</td>' +
          '<td>' + (p.inNav ? "✅" : "—") + '</td>' +
          '<td class="row" style="gap:6px;flex-wrap:wrap;">' +
            '<button class="btn sm" data-edit="' + esc(p.id) + '">编辑</button>' +
            '<button class="btn ghost sm" data-gen="' + esc(p.id) + '">生成</button>' +
            (p.template === "form" ? '<button class="btn ghost sm" data-sub="' + esc(p.id) + '">提交</button>' : '') +
            '<button class="btn danger sm" data-del="' + esc(p.id) + '">删除</button>' +
          '</td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
      box.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { renderPageEditor(appId, moduleId, b.getAttribute("data-edit")); }; });
      box.querySelectorAll("[data-gen]").forEach(function (b) { b.onclick = function () { generatePage(a, m, findPage(m, b.getAttribute("data-gen"))); }; });
      box.querySelectorAll("[data-sub]").forEach(function (b) { b.onclick = function () { renderSubmissions(a, m, findPage(m, b.getAttribute("data-sub"))); }; });
      box.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () {
        if (!confirm("删除该页面？（已生成的 HTML 文件不会自动删除，需手动处理）")) return;
        m.pages = m.pages.filter(function (p) { return p.id !== b.getAttribute("data-del"); });
        saveApps().then(function () { drawPages(a, m); }).catch(function () { alert("保存失败"); });
      }; });
    }

    /* ====================== 视图：页面编辑器（核心） ====================== */
    function renderPageEditor(appId, moduleId, pageId) {
      var a = findApp(appId); if (!a) { renderApps(); return; }
      var m = findModule(a, moduleId); if (!m) { renderAppDetail(appId); return; }
      var p = pageId ? findPage(m, pageId) : null;

      var tplOpts = "";
      ["content", "form", "dashboard"].forEach(function (g) {
        var items = Object.keys(TEMPLATES).filter(function (k) { return TEMPLATES[k].group === g; });
        tplOpts += '<optgroup label="' + ({ content: "内容展示", form: "表单收集", dashboard: "数据看板" }[g]) + '">' +
          items.map(function (k) { return '<option value="' + k + '">' + TEMPLATES[k].icon + ' ' + TEMPLATES[k].name + '</option>'; }).join("") + '</optgroup>';
      });

      c.innerHTML = '<div class="panel-card"><h3>' + (p ? "✏ 编辑页面" : "＋ 新建页面") + ' · ' + esc(a.name) + ' / ' + esc(m.name) + '</h3>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>页面标题</label><input id="pTitle" placeholder="如：活动报名"></div>' +
          '<div class="field" style="flex:1;min-width:160px;"><label>文件名(英文)</label><input id="pSlug" placeholder="如：signup"></div>' +
          '<div class="field" style="flex:1;min-width:160px;"><label>模板</label><select id="pTpl">' + tplOpts + '</select></div>' +
        '</div>' +
        '<div id="pConfig"></div>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;margin-top:6px;">' +
          '<div class="field" style="flex:1;min-width:120px;display:flex;align-items:flex-end;"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="pPublished"> 发布（生成后前台可访问）</label></div>' +
          '<div class="field" style="flex:1;min-width:120px;display:flex;align-items:flex-end;"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="pInNav"> 进前台导航</label></div>' +
          '<div class="field" style="flex:1;min-width:160px;"><label>前台导航名</label><input id="pNavLabel" placeholder="留空用页面标题"></div>' +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:6px;">' +
          '<button class="btn role-c" id="pSave">保存并生成</button>' +
          '<button class="btn ghost" id="pCancel">取消</button>' +
          '<span class="msg" id="pMsg"></span>' +
        '</div>' +
        '<div class="panel-tip" id="pPreview" style="margin-top:10px;"></div></div>';

      if (p) {
        c.querySelector("#pTitle").value = p.title || "";
        c.querySelector("#pSlug").value = p.slug || "";
        c.querySelector("#pTpl").value = p.template || "blank";
        c.querySelector("#pPublished").checked = p.status === "published";
        c.querySelector("#pInNav").checked = !!p.inNav;
        c.querySelector("#pNavLabel").value = p.navLabel || "";
      }
      var tplSel = c.querySelector("#pTpl");
      tplSel.onchange = function () { renderConfig(tplSel.value, p); };
      renderConfig(tplSel.value, p);

      c.querySelector("#pCancel").onclick = function () { renderModuleDetail(appId, moduleId); };
      c.querySelector("#pSave").onclick = function () {
        var title = c.querySelector("#pTitle").value.trim();
        if (!title) { alert("请输入页面标题"); return; }
        var tpl = tplSel.value;
        var slug = c.querySelector("#pSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
        if (!slug) slug = slugify(title);
        var cfg = collectConfig(tpl);
        var rec = p || { id: uid(), createdAt: today() };
        rec.title = title; rec.slug = slug; rec.template = tpl;
        rec.status = c.querySelector("#pPublished").checked ? "published" : "draft";
        rec.navLabel = c.querySelector("#pNavLabel").value.trim();
        rec.inNav = c.querySelector("#pInNav").checked;
        rec.config = cfg; rec.updatedAt = today();
        rec.path = slug + ".html";
        if (!p) { m.pages = m.pages || []; m.pages.push(rec); }
        var msg = c.querySelector("#pMsg");
        msg.className = "msg"; msg.textContent = "生成中…";
        generatePage(a, m, rec).then(function () {
          if (rec.inNav) { if (!p || !p.inNav) syncPageNav(rec, a); }
          else if (p && p.inNav) { removeNav("page:" + rec.id); }
          return saveApps(msg).then(function () { if (rec.inNav) return saveMenu(msg); });
        }).then(function () {
          msg.className = "msg ok"; msg.textContent = "✅ 已生成：" + rec.path + (rec.status === "published" ? "（已发布）" : "（草稿）");
        }).catch(function (e) { msg.className = "msg err"; msg.textContent = "❌ " + (e && e.message ? e.message : "生成失败"); });
      };
    }

    /* ----- 按模板渲染配置区 ----- */
    function renderConfig(tpl, p) {
      var box = c.querySelector("#pConfig");
      var cfg = (p && p.config) || {};
      var h = "";
      if (tpl === "blank") {
        h = field("页面内容（支持 HTML）", '<textarea id="cfgBlank" rows="8" placeholder="留空则显示占位文字">' + esc(cfg.body || "") + '</textarea>');
      } else if (tpl === "article") {
        h = field("正文内容（支持 HTML，如 &lt;h2&gt; &lt;p&gt; &lt;img&gt;）", '<textarea id="cfgArticle" rows="10" placeholder="写入正文">' + esc(cfg.body || "") + '</textarea>');
      } else if (tpl === "list") {
        h = field("列表项（每行一项）", '<textarea id="cfgList" rows="8" placeholder="第一项\n第二项">' + esc((cfg.items || []).join("\n")) + '</textarea>');
      } else if (tpl === "links") {
        h = field("链接（每行：标题|URL）", '<textarea id="cfgLinks" rows="8" placeholder="官网|https://...\nB站|https://...">' + esc((cfg.links || []).map(function (x) { return x.title + "|" + x.url; }).join("\n")) + '</textarea>');
      } else if (tpl === "grid") {
        h = field("卡片（每行：标题|描述|图标|URL，URL 可空）", '<textarea id="cfgGrid" rows="8" placeholder="报名|点击报名|📝|https://...\n规则|查看规则|📜|">' + esc((cfg.cards || []).map(function (x) { return [x.title, x.desc, x.icon, x.url].join("|"); }).join("\n")) + '</textarea>');
      } else if (tpl === "gallery") {
        h = field("图片（每行：图片URL|说明）", '<textarea id="cfgGallery" rows="8" placeholder="https://.../a.jpg|活动现场\nhttps://.../b.jpg|颁奖">' + esc((cfg.images || []).map(function (x) { return x.url + "|" + x.caption; }).join("\n")) + '</textarea>');
      } else if (tpl === "form") {
        h = '<p class="panel-tip" style="margin-top:8px;">配置收集字段，访客提交后存到后台，可在「提交」里查看/导出。</p>' +
          '<div id="cfgFields"></div>' +
          '<button class="btn ghost sm" id="addField" style="margin-top:8px;">＋ 添加字段</button>' +
          field("提交成功提示", '<input id="cfgOk" placeholder="提交成功，我们会尽快联系您" value="' + esc(cfg.successText || "") + '">');
        box.innerHTML = h;
        var fbox = c.querySelector("#cfgFields");
        function drawFields() {
          var fs = cfg.fields || [];
          if (!fs.length) { fbox.innerHTML = '<div class="status">还没有字段，点「添加字段」。</div>'; return; }
          var fh = "";
          fs.forEach(function (f, i) {
            fh += '<div class="wb-field-row" data-i="' + i + '">' +
              '<input class="wf-label" placeholder="字段名" value="' + esc(f.label || "") + '">' +
              '<select class="wf-type"><option value="text"' + (f.type === "text" ? " selected" : "") + '>单行文本</option>' +
                '<option value="textarea"' + (f.type === "textarea" ? " selected" : "") + '>多行文本</option>' +
                '<option value="number"' + (f.type === "number" ? " selected" : "") + '>数字</option>' +
                '<option value="email"' + (f.type === "email" ? " selected" : "") + '>邮箱</option>' +
                '<option value="tel"' + (f.type === "tel" ? " selected" : "") + '>电话</option>' +
                '<option value="radio"' + (f.type === "radio" ? " selected" : "") + '>单选</option>' +
                '<option value="checkbox"' + (f.type === "checkbox" ? " selected" : "") + '>多选</option></select>' +
              '<label class="wf-req"><input type="checkbox" class="wf-required"' + (f.required ? " checked" : "") + '>必填</label>' +
              '<input class="wf-opt" placeholder="选项(每行一个，单选/多选用)" value="' + esc((f.options || []).join("\n")) + '">' +
              '<button class="btn danger sm wf-del">删</button></div>';
          });
          fbox.innerHTML = fh;
          fbox.querySelectorAll(".wf-del").forEach(function (b) { b.onclick = function () {
            var i = parseInt(b.parentElement.getAttribute("data-i"), 10); cfg.fields.splice(i, 1); drawFields();
          }; });
        }
        drawFields();
        c.querySelector("#addField").onclick = function () { cfg.fields = cfg.fields || []; cfg.fields.push({ label: "", type: "text", required: false, options: [] }); drawFields(); };
        return;
      } else if (tpl === "dashboard") {
        var metrics = [
          { k: "site_name", t: "站点名称" }, { k: "version", t: "当前版本" }, { k: "updates", t: "更新条数" },
          { k: "visits", t: "浏览记录数" }, { k: "forum_posts", t: "论坛帖数" }, { k: "members", t: "注册用户数" },
          { k: "online", t: "当前在线数" }, { k: "apps", t: "应用数(本页)" }, { k: "pages", t: "页面数(本页)" }
        ];
        var mh = metrics.map(function (mt) {
          var on = (cfg.metrics || []).some(function (x) { return x.k === mt.k; });
          return '<label style="display:flex;gap:6px;align-items:center;margin:4px 0;"><input type="checkbox" class="wb-metric" value="' + mt.k + '"' + (on ? " checked" : "") + '> ' + mt.t + '</label>';
        }).join("");
        h = field("勾选要在看板上展示的指标", '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px;">' + mh + '</div>');
      }
      box.innerHTML = h;
    }
    function field(label, control) {
      return '<div class="field"><label>' + label + '</label>' + control + '</div>';
    }
    function collectConfig(tpl) {
      var cfg = {};
      if (tpl === "blank") cfg.body = val("#cfgBlank");
      else if (tpl === "article") cfg.body = val("#cfgArticle");
      else if (tpl === "list") cfg.items = splitLines(val("#cfgList"));
      else if (tpl === "links") cfg.links = splitLines(val("#cfgLinks")).map(function (l) { var p = l.split("|"); return { title: (p[0] || "").trim(), url: (p[1] || "").trim() }; }).filter(function (x) { return x.title && x.url; });
      else if (tpl === "grid") cfg.cards = splitLines(val("#cfgGrid")).map(function (l) { var p = l.split("|"); return { title: (p[0] || "").trim(), desc: (p[1] || "").trim(), icon: (p[2] || "").trim(), url: (p[3] || "").trim() }; }).filter(function (x) { return x.title; });
      else if (tpl === "gallery") cfg.images = splitLines(val("#cfgGallery")).map(function (l) { var p = l.split("|"); return { url: (p[0] || "").trim(), caption: (p[1] || "").trim() }; }).filter(function (x) { return x.url; });
      else if (tpl === "form") {
        cfg.successText = val("#cfgOk");
        cfg.fields = [];
        c.querySelectorAll("#cfgFields .wb-field-row").forEach(function (row) {
          var label = row.querySelector(".wf-label").value.trim();
          if (!label) return;
          cfg.fields.push({
            label: label,
            type: row.querySelector(".wf-type").value,
            required: row.querySelector(".wf-required").checked,
            options: splitLines(row.querySelector(".wf-opt").value)
          });
        });
      } else if (tpl === "dashboard") {
        cfg.metrics = [];
        c.querySelectorAll(".wb-metric:checked").forEach(function (cb) {
          var k = cb.value;
          var t = cb.parentElement.textContent.trim();
          cfg.metrics.push({ k: k, label: t });
        });
      }
      return cfg;
    }
    function val(sel) { var el = c.querySelector(sel); return el ? el.value : ""; }
    function splitLines(s) { return String(s || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean); }

    /* ====================== 生成页面 HTML ====================== */
    function generatePage(a, m, p) {
      var html = buildPageHtml(a, m, p, apiBase);
      return putFile(p.path, b64utf8(html), "[workbench] 生成页面 " + p.title, null);
    }
    function generateAppHome(a) {
      if (!a.slug) a.slug = slugify(a.name);
      var html = buildAppHomeHtml(a, apiBase);
      var path = "app-" + a.slug + ".html";
      var msg = { className: "", textContent: "" };
      return putFile(path, b64utf8(html), "[workbench] 生成应用首页 " + a.name, msg)
        .then(function () { alert("已生成应用首页：" + path + "\n可进前台导航让访客访问。"); renderAppDetail(a.id); })
        .catch(function (e) { alert("生成失败：" + (e && e.message ? e.message : e)); });
    }

    function buildPageHtml(a, m, p, apiBase) {
      var cfg = p.config || {};
      var body = "";
      if (p.template === "blank") {
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1><div class="panel-card">' + (cfg.body || "<p>页面内容待补充。</p>") + '</div></div>';
      } else if (p.template === "list") {
        var items = (cfg.items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1><div class="panel-card"><ul class="wb-page-list">' + (items || "<li>暂无内容</li>") + '</ul></div></div>';
      } else if (p.template === "article") {
        body = '<div class="page-wrap"><article class="panel-card wb-article"><h1>' + esc(p.title) + '</h1>' + (cfg.body || "<p>正文待补充。</p>") + '</article></div>';
      } else if (p.template === "links") {
        var links = (cfg.links || []).map(function (x) {
          return '<a class="wb-link-card" href="' + esc(x.url) + '" target="_blank" rel="noopener"><span>' + esc(x.title) + '</span><span>→</span></a>';
        }).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1><div class="wb-link-grid">' + (links || "<p>暂无链接</p>") + '</div></div>';
      } else if (p.template === "grid") {
        var cards = (cfg.cards || []).map(function (x) {
          var inner = '<span class="wb-card-ico">' + esc(x.icon || "📦") + '</span><span class="wb-card-title">' + esc(x.title) + '</span>' + (x.desc ? '<span class="wb-card-desc">' + esc(x.desc) + '</span>' : '');
          return x.url ? '<a class="wb-grid-card" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="wb-grid-card">' + inner + '</div>';
        }).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1><div class="wb-grid-cards">' + (cards || "<p>暂无卡片</p>") + '</div></div>';
      } else if (p.template === "gallery") {
        var imgs = (cfg.images || []).map(function (x) {
          return '<figure class="wb-fig"><img src="' + esc(x.url) + '" alt="' + esc(x.caption || "") + '" loading="lazy"><figcaption>' + esc(x.caption || "") + '</figcaption></figure>';
        }).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1><div class="wb-gallery">' + (imgs || "<p>暂无图片</p>") + '</div></div>';
      } else if (p.template === "form") {
        var fields = (cfg.fields || []).map(function (f, i) {
          var req = f.required ? " required" : "";
          var ctrl;
          if (f.type === "textarea") ctrl = '<textarea name="f' + i + '"' + req + '></textarea>';
          else if (f.type === "number") ctrl = '<input type="number" name="f' + i + '"' + req + '>';
          else if (f.type === "email") ctrl = '<input type="email" name="f' + i + '"' + req + '>';
          else if (f.type === "tel") ctrl = '<input type="tel" name="f' + i + '"' + req + '>';
          else if (f.type === "radio") ctrl = (f.options || []).map(function (o, j) { return '<label><input type="radio" name="f' + i + '" value="' + esc(o) + '"' + (j === 0 ? req : "") + '> ' + esc(o) + '</label>'; }).join(" ");
          else if (f.type === "checkbox") ctrl = (f.options || []).map(function (o) { return '<label><input type="checkbox" name="f' + i + '" value="' + esc(o) + '"> ' + esc(o) + '</label>'; }).join(" ");
          else ctrl = '<input type="text" name="f' + i + '"' + req + '>';
          return '<div class="wb-form-field"><label>' + esc(f.label) + (f.required ? ' <span style="color:#ff5b5b">*</span>' : '') + '</label>' + ctrl + '</div>';
        }).join("");
        var okText = cfg.successText || "提交成功，我们会尽快联系您。";
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1>' +
          '<div class="panel-card"><form id="wbForm" class="wb-form">' + fields + '<button type="submit" class="btn role-c">提交</button><div id="wbFormMsg" class="msg"></div></form>' +
          '<script>document.getElementById("wbForm").addEventListener("submit",function(e){e.preventDefault();' +
          'var fd=new FormData(this);var fields={};fd.forEach(function(v,k){fields[k]=v;});' +
          'fetch("' + apiBase + '/api/app/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appId:"' + a.id + '",pageId:"' + p.id + '",fields:fields})})' +
          '.then(function(r){return r.json();}).then(function(j){var m=document.getElementById("wbFormMsg");if(j.ok){m.className="msg ok";m.textContent="' + esc(okText) + '";document.getElementById("wbForm").reset();}else{throw new Error(j.error||"提交失败");}})' +
          '.catch(function(err){var m=document.getElementById("wbFormMsg");m.className="msg err";m.textContent="❌ "+err.message;});});<\/script></div></div>';
      } else if (p.template === "dashboard") {
        var metrics = cfg.metrics || [];
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(p.title) + '</h1>' +
          '<div class="panel-card"><div id="wbDash" class="wb-dash">加载中…</div>' +
          '<script>fetch("data.json").then(function(r){return r.json();}).then(function(d){' +
          'var site=d.site||{};var mf=' + JSON.stringify(metrics) + ';' +
          'var rows=mf.map(function(mt){var v="-";' +
          'if(mt.k==="site_name")v=site.name||"-";' +
          'else if(mt.k==="version")v=(site.version||(d.changelog&&d.changelog[0]?d.changelog[0].title:"-"));' +
          'else if(mt.k==="updates")v=(d.changelog?d.changelog.length:0);' +
          'else if(mt.k==="visits")v=(d.browses?d.browses.length:0);' +
          'else if(mt.k==="forum_posts")v=(d.forum&&d.forum.posts?d.forum.posts.length:0);' +
          'else if(mt.k==="members")v=(d.users?d.users.length:0);' +
          'else if(mt.k==="online")v="—（需登录）";' +
          'else if(mt.k==="apps")v=(d.apps?d.apps.length:0);' +
          'else if(mt.k==="pages")v=(d.apps?d.apps.reduce(function(s,a){return s+(a.modules||[]).reduce(function(ss,m){return ss+(m.pages||[]).length;},0);},0):0);' +
          'return "<div class=\\"wb-dash-item\\"><div class=\\"n\\">"+v+"</div><div class=\\"l\\">"+mt.label+"</div></div>";});' +
          'document.getElementById("wbDash").innerHTML=rows.join("");}).catch(function(){document.getElementById("wbDash").textContent="加载失败";});' +
          '<\/script></div></div>';
      }
      return pageShell(p.title, body);
    }

    function buildAppHomeHtml(a, apiBase) {
      var mods = a.modules || [];
      var secs = mods.map(function (m) {
        var pages = (m.pages || []).map(function (p) {
          var badge = p.status === "published" ? "" : ' <span style="color:#ffb020;font-size:12px;">[草稿]</span>';
          return '<li><a href="' + esc(p.slug) + '.html">' + esc(p.title) + '</a>' + badge + '</li>';
        }).join("");
        return '<section class="panel-card"><h2>' + (m.icon || "📁") + ' ' + esc(m.name) + '</h2>' + (m.desc ? '<p style="color:var(--muted);">' + esc(m.desc) + '</p>' : '') +
          (pages ? '<ul class="wb-page-list">' + pages + '</ul>' : '<p style="color:var(--muted);">该模块暂无页面。</p>') + '</section>';
      }).join("");
      var body = '<div class="page-wrap"><h1 class="section-title">' + (a.icon || "📦") + ' ' + esc(a.name) + '</h1>' +
        (a.desc ? '<p class="panel-card">' + esc(a.desc) + '</p>' : '') + secs + '</div>';
      return pageShell(a.name, body);
    }

    function pageShell(title, body) {
      return '<!DOCTYPE html>\n<html lang="zh-CN" class="dark">\n<head>' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">\n' +
        '<title>' + esc(title) + ' · 三角洲情报台</title>\n' +
        '<link rel="stylesheet" href="css/style.css">\n' +
        '</head>\n<body>' + body + '\n<a class="wb-back" href="index.html">← 返回首页</a></body>\n</html>';
    }

    /* ====================== 视图：表单提交查看 ====================== */
    function renderSubmissions(a, m, p) {
      c.innerHTML = '<div class="panel-card"><h3>📥 提交记录 · ' + esc(p.title) + '</h3>' +
        '<p class="panel-tip">来自「' + esc(a.name) + '/' + esc(m.name) + '」表单收集页的访客提交。</p>' +
        '<div class="row" style="gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
          '<button class="btn ghost" id="subRefresh">🔄 刷新</button>' +
          '<button class="btn ghost" id="subExport">⬇ 导出 CSV</button>' +
          '<button class="btn ghost" id="subBack">← 页面</button>' +
        '</div><div id="subBox"></div></div>';
      var box = c.querySelector("#subBox");
      function load() {
        if (adminMode() !== "worker") { box.innerHTML = '<div class="status">仅 Worker 模式下可查看提交（需绑定 WORKBENCH KV）。</div>'; return; }
        wkFetch("/api/admin/app-submissions?app=" + encodeURIComponent(a.id) + "&page=" + encodeURIComponent(p.id))
          .then(function (r) { return r.json(); }).then(function (j) {
            if (j.error) throw new Error(j.error);
            var rows = j.rows || [];
            if (!rows.length) { box.innerHTML = '<div class="status">暂无提交。</div>'; return; }
            var cols = [];
            rows.forEach(function (r) { Object.keys(r.fields || {}).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
            var html = '<table class="item-table"><thead><tr><th>时间</th>' + cols.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join("") + '</tr></thead><tbody>';
            rows.forEach(function (r) {
              html += '<tr><td>' + new Date(r.at).toLocaleString() + '</td>' + cols.map(function (k) { return '<td>' + esc((r.fields || {})[k]) + '</td>'; }).join("") + '</tr>';
            });
            html += '</tbody></table>';
            box.innerHTML = html;
            box._csv = [["时间"].concat(cols).join(",")].concat(rows.map(function (r) {
              return [new Date(r.at).toLocaleString()].concat(cols.map(function (k) { return '"' + String((r.fields || {})[k] || "").replace(/"/g, '""') + '"'; })).join(",");
            })).join("\n");
          }).catch(function (e) { box.innerHTML = '<div class="status" style="color:#ff5b5b">加载失败：' + esc(e.message) + '</div>'; });
      }
      c.querySelector("#subBack").onclick = function () { renderModuleDetail(a.id, m.id); };
      c.querySelector("#subRefresh").onclick = load;
      c.querySelector("#subExport").onclick = function () {
        if (!box._csv) return;
        var blob = new Blob([box._csv], { type: "text/csv;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var aEl = document.createElement("a"); aEl.href = url; aEl.download = p.slug + "_submissions.csv"; aEl.click();
        URL.revokeObjectURL(url);
      };
      load();
    }

    /* ====================== 视图：站点设置（保留） ====================== */
    function renderSiteSettings() {
      c.innerHTML = '<div class="panel-card"><h3>⚙ 站点设置</h3>' +
        '<p class="panel-tip">修改全站基础信息与导航菜单，保存后即时生效。</p>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>站点名称</label><input id="stName" placeholder="三角洲情报台"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>辅助主题色</label><input id="stAccent" type="color"></div>' +
        '</div>' +
        '<div class="field"><label>赞助链接（爱发电等）</label><input id="stAfdian" placeholder="https://afdian.com/a/xxx"></div>' +
        '<div class="field"><label>登录欢迎语音 URL（留空则用 TTS）</label><input id="stHavkVoice" placeholder="assets/login-voice.wav"></div>' +
        '<div class="field"><label>API Base</label><input id="stApiBase" placeholder="https://api.delta.shopping"></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="stSave">保存</button>' +
          '<button class="btn ghost" id="stCancel">取消</button>' +
          '<span class="msg" id="stMsg"></span>' +
        '</div></div>';
      var s = dataObj.site || {};
      c.querySelector("#stName").value = s.name || "";
      c.querySelector("#stAfdian").value = s.afdianUrl || "";
      c.querySelector("#stAccent").value = s.accent2 || "#19c3a6";
      c.querySelector("#stHavkVoice").value = s.havkVoiceUrl || "";
      c.querySelector("#stApiBase").value = s.apiBase || "https://api.delta.shopping";
      c.querySelector("#stCancel").onclick = renderHome;
      c.querySelector("#stSave").onclick = function () {
        dataObj.site = dataObj.site || {};
        dataObj.site.name = c.querySelector("#stName").value.trim();
        dataObj.site.afdianUrl = c.querySelector("#stAfdian").value.trim();
        dataObj.site.accent2 = c.querySelector("#stAccent").value.trim();
        dataObj.site.havkVoiceUrl = c.querySelector("#stHavkVoice").value.trim();
        dataObj.site.apiBase = c.querySelector("#stApiBase").value.trim();
        putDataObj(dataObj, "更新站点设置", c.querySelector("#stMsg")).then(function () { renderHome(); }).catch(function () {});
      };
    }

    /* ====================== 视图：一键发版（保留） ====================== */
    function renderRelease() {
      c.innerHTML = '<div class="panel-card"><h3>🚀 一键发版</h3>' +
        '<p class="panel-tip">自动完成：全站版本号 +1、修改 sw.js 缓存名、在 changelog 头部写入本次更新。确认后继续。</p>' +
        '<div class="field"><label>本次版本标题</label><input id="relTitle" placeholder="如：V45 · 零代码开发工作台"></div>' +
        '<div class="field"><label>更新内容（每行一条）</label><textarea id="relItems" rows="6" placeholder="新增零代码开发工作台（应用→模块→页面）\n支持列表/图文/链接/卡片/图库/表单收集/数据看板模板"></textarea></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="relGo">确认发版</button>' +
          '<button class="btn ghost" id="relCancel">取消</button>' +
          '<span class="msg" id="relMsg"></span>' +
        '</div><div id="relLog" style="margin-top:12px;font-size:13px;color:var(--muted);line-height:1.6;"></div></div>';
      c.querySelector("#relCancel").onclick = renderHome;
      c.querySelector("#relGo").onclick = function () {
        var title = c.querySelector("#relTitle").value.trim();
        var items = splitLines(c.querySelector("#relItems").value);
        if (!title) { alert("请输入版本标题"); return; }
        if (!items.length) { alert("请至少填写一条更新内容"); return; }
        var log = c.querySelector("#relLog"), msg = c.querySelector("#relMsg");
        log.innerHTML += "开始检测当前版本…<br>";
        doRelease(title, items, log, msg).catch(function (e) { msg.className = "msg err"; msg.textContent = "❌ " + (e && e.message ? e.message : "发版失败"); });
      };
    }
    function doRelease(title, items, log, msg) {
      var currentVer = 44, htmlFiles = ["index.html", "admin.html", "music.html", "news.html", "guns.html", "profile.html", "zhanji.html", "forum.html", "friends.html", "kzb.html", "search.html", "tujian.html", "ugc.html", "feedback.html"], jsFiles = ["js/app.js", "js/music.js", "js/workbench.js"], allFiles = htmlFiles.concat(jsFiles);
      return Promise.resolve().then(function () {
        return fetchFile("index.html").then(function (txt) { var m = txt.match(/v=(\d+)/); if (m) currentVer = parseInt(m[1], 10); log.innerHTML += "当前版本号：v" + currentVer + "<br>"; }).catch(function () { log.innerHTML += "无法读取 index.html，用默认 v44<br>"; });
      }).then(function () {
        var nextVer = currentVer + 1, oldToken = "v=" + currentVer, newToken = "v=" + nextVer, oldCache = "delta-intel-v" + currentVer, newCache = "delta-intel-v" + nextVer;
        log.innerHTML += "目标版本号：v" + nextVer + "<br>";
        return Promise.all(allFiles.map(function (f) {
          return fetchFile(f).then(function (txt) {
            var newTxt = txt.split(oldToken).join(newToken);
            if (f === "sw.js") newTxt = newTxt.split(oldCache).join(newCache);
            if (newTxt === txt) return { file: f, changed: false };
            return putFileRaw(f, b64utf8(newTxt), "[release] bump " + oldToken + " -> " + newToken).then(function () { return { file: f, changed: true }; });
          }).catch(function (e) { return { file: f, error: e && e.message ? e.message : String(e) }; });
        })).then(function (results) {
          var changed = results.filter(function (r) { return r.changed; }), errs = results.filter(function (r) { return r.error; });
          log.innerHTML += "文件更新：" + changed.length + " 个成功，" + errs.length + " 个失败<br>";
          if (errs.length) { errs.forEach(function (e) { log.innerHTML += "- " + e.file + " 失败：" + e.error + "<br>"; }); throw new Error("部分文件更新失败"); }
          return getDataObj().then(function (d) {
            dataObj = d.obj; dataObj.changelog = dataObj.changelog || [];
            dataObj.changelog.unshift({ date: today(), title: title, items: items });
            dataObj.changelog = dataObj.changelog.slice(0, 30);
            return putDataObj(dataObj, "一键发版 v" + nextVer, msg);
          });
        }).then(function () { msg.className = "msg ok"; msg.textContent = "✅ 已发版 v" + nextVer + "，请 Ctrl+F5 强刷。"; log.innerHTML += "完成：v" + nextVer + "<br>"; });
      });
    }
    function fetchFile(path) {
      if (adminMode() === "worker") return wkFetch("/api/admin/file?path=" + encodeURIComponent(path)).then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); return j.content || ""; });
      return fetch(API + "/repos/" + REPO + "/contents/" + path, { headers: headers(true) }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) { return decodeURIComponent(escape(atob(j.content))); });
    }
    function putFileRaw(path, base64, message) {
      if (typeof putFile === "function") return putFile(path, base64, message);
      return fetch(API + "/repos/" + REPO + "/contents/" + path, { method: "PUT", headers: headers(true), body: JSON.stringify({ message: message, content: base64 }) }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.message); }); });
    }
    function headers(auth) { return window.__admin && window.__admin.headers ? window.__admin.headers(auth) : {}; }
    var API = "https://api.github.com", REPO = "xuchengyuan123/delta-intel";

    /* ---------- 启动 ---------- */
    loadApps().then(function () { renderHome(); }).catch(function (e) {
      c.innerHTML = '<div class="status" style="color:#ff5b5b">加载数据失败：' + esc(e.message) + '</div>';
    });
  }

  window.mountWorkbench = mountWorkbench;
})();
