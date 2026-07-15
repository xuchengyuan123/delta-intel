/* =========================================================
 * workbench.js — 零代码开发工作台（后台专用）
 * 功能：版本迭代/功能项目管理、新页面生成器、站点设置、一键发版
 * 数据：存于 data.json.works[] / data.json.site / data.json.generatedPages
 * ========================================================= */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return "w-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(s) { return s || "-"; }
  function tagHtml(tags) {
    return (tags || []).map(function (t) { return '<span class="wb-tag">' + esc(t) + '</span>'; }).join("");
  }
  function parseTags(v) {
    return String(v || "").split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function mountWorkbench(c) {
    // 仅总管理员可用
    if (typeof activeRole !== "undefined" && activeRole !== "super") {
      c.innerHTML = '<div class="status" style="color:#ff5b5b">仅总管理员可使用开发工作台。</div>';
      return;
    }

    var works = [];
    var dataObj = null;

    function loadData() {
      return getDataObj().then(function (d) {
        dataObj = d.obj;
        works = dataObj.works || [];
        return d;
      });
    }

    function saveWorks(msgEl) {
      dataObj.works = works;
      return putDataObj(dataObj, "更新开发工作台", msgEl);
    }

    function saveData(action, msgEl) {
      return putDataObj(dataObj, action, msgEl);
    }

    /* ---------- 视图：工作列表 ---------- */
    function renderList() {
      c.innerHTML = '<div class="panel-card"><h3>🛠 开发工作台</h3>' +
        '<p class="panel-tip">管理版本迭代与功能项目，零代码生成新页面、修改站点设置、一键发版。</p>' +
        '<div class="row" style="margin-bottom:14px;gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="wbNew">＋ 新建工作</button>' +
          '<button class="btn ghost" id="wbRel">🚀 一键发版</button>' +
        '</div>' +
        '<div id="wbList"></div></div>';
      renderListBody();
      c.querySelector("#wbNew").onclick = function () { renderForm(); };
      c.querySelector("#wbRel").onclick = function () { renderRelease(); };
    }

    function renderListBody() {
      var box = c.querySelector("#wbList");
      if (!works.length) { box.innerHTML = '<div class="status">还没有工作，点击「新建工作」开始。</div>'; return; }
      var html = '<div class="wb-grid">';
      works.forEach(function (w) {
        var statusText = { todo: "待开始", doing: "进行中", done: "已完成" }[w.status] || w.status;
        var typeText = { version: "版本迭代", feature: "功能项目" }[w.type] || w.type;
        html += '<div class="wb-card" data-id="' + esc(w.id) + '">' +
          '<div class="wb-card-head"><span class="wb-type">' + esc(typeText) + '</span><span class="wb-status st-' + esc(w.status) + '">' + esc(statusText) + '</span></div>' +
          '<div class="wb-title">' + esc(w.title) + '</div>' +
          '<div class="wb-meta">优先级：' + esc(w.priority || "中") + ' &nbsp;|&nbsp; 负责人：' + esc(w.owner || "-") + '</div>' +
          '<div class="wb-meta">预计完成：' + fmtDate(w.dueAt) + '</div>' +
          '<div class="wb-tags">' + tagHtml(w.tags) + '</div>' +
          '<div class="wb-card-actions">' +
            '<button class="btn sm" data-open="' + esc(w.id) + '">打开</button>' +
            '<button class="btn ghost sm" data-edit="' + esc(w.id) + '">编辑</button>' +
            '<button class="btn danger sm" data-del="' + esc(w.id) + '">删除</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
      box.innerHTML = html;
      box.querySelectorAll("[data-open]").forEach(function (b) {
        b.onclick = function () { renderDetail(b.getAttribute("data-open")); };
      });
      box.querySelectorAll("[data-edit]").forEach(function (b) {
        b.onclick = function () { renderForm(b.getAttribute("data-edit")); };
      });
      box.querySelectorAll("[data-del]").forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute("data-del");
          if (!confirm("确定删除该工作？关联页面不会被删除，但工作记录会丢失。")) return;
          works = works.filter(function (w) { return w.id !== id; });
          saveWorks().then(function () { renderList(); }).catch(function () { alert("保存失败"); });
        };
      });
    }

    /* ---------- 视图：新建/编辑工作 ---------- */
    function renderForm(id) {
      var w = id ? works.find(function (x) { return x.id === id; }) : null;
      if (id && !w) { renderList(); return; }
      c.innerHTML = '<div class="panel-card"><h3>' + (w ? "✏ 编辑工作" : "＋ 新建工作") + '</h3>' +
        '<p class="panel-tip">填写工作的基本信息。类型可在「版本迭代」与「功能项目」间切换。</p>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>工作名称</label><input id="wbTitle" placeholder="如：V42 版本迭代 / 活动页"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>类型</label><select id="wbType"><option value="version">版本迭代</option><option value="feature">功能项目</option></select></div>' +
        '</div>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:1;min-width:140px;"><label>状态</label><select id="wbStatus"><option value="todo">待开始</option><option value="doing">进行中</option><option value="done">已完成</option></select></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>优先级</label><select id="wbPriority"><option>低</option><option selected>中</option><option>高</option><option>紧急</option></select></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>负责人</label><input id="wbOwner" placeholder="管理员"></div>' +
        '</div>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:1;min-width:140px;"><label>标签（用逗号分隔）</label><input id="wbTags" placeholder="界面, 音乐, 活动"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>开始时间</label><input id="wbStart" type="date"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>预计完成</label><input id="wbDue" type="date"></div>' +
          '<div class="field" style="flex:1;min-width:140px;"><label>实际完成</label><input id="wbDone" type="date"></div>' +
        '</div>' +
        '<div class="field"><label>工作说明 / 目标</label><textarea id="wbDesc" rows="4" placeholder="描述这次工作要做什么，完成后验收标准是什么"></textarea></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="wbSave">保存</button>' +
          '<button class="btn ghost" id="wbCancel">取消</button>' +
          '<span class="msg" id="wbMsg"></span>' +
        '</div></div>';

      if (w) {
        c.querySelector("#wbTitle").value = w.title || "";
        c.querySelector("#wbType").value = w.type || "version";
        c.querySelector("#wbStatus").value = w.status || "todo";
        c.querySelector("#wbPriority").value = w.priority || "中";
        c.querySelector("#wbOwner").value = w.owner || "";
        c.querySelector("#wbTags").value = (w.tags || []).join(", ");
        c.querySelector("#wbStart").value = w.startAt || "";
        c.querySelector("#wbDue").value = w.dueAt || "";
        c.querySelector("#wbDone").value = w.doneAt || "";
        c.querySelector("#wbDesc").value = w.desc || "";
      } else {
        c.querySelector("#wbStart").value = today();
      }

      c.querySelector("#wbCancel").onclick = function () { renderList(); };
      c.querySelector("#wbSave").onclick = function () {
        var title = c.querySelector("#wbTitle").value.trim();
        if (!title) { alert("请输入工作名称"); return; }
        var rec = w || { id: uid(), createdAt: today(), pages: [], moduleChanges: [] };
        rec.title = title;
        rec.type = c.querySelector("#wbType").value;
        rec.status = c.querySelector("#wbStatus").value;
        rec.priority = c.querySelector("#wbPriority").value;
        rec.owner = c.querySelector("#wbOwner").value.trim();
        rec.tags = parseTags(c.querySelector("#wbTags").value);
        rec.startAt = c.querySelector("#wbStart").value;
        rec.dueAt = c.querySelector("#wbDue").value;
        rec.doneAt = c.querySelector("#wbDone").value;
        rec.desc = c.querySelector("#wbDesc").value.trim();
        if (!w) works.unshift(rec);
        saveWorks(c.querySelector("#wbMsg")).then(function () { renderList(); }).catch(function () {});
      };
    }

    /* ---------- 视图：工作详情 ---------- */
    function renderDetail(id) {
      var w = works.find(function (x) { return x.id === id; });
      if (!w) { renderList(); return; }
      var typeText = { version: "版本迭代", feature: "功能项目" }[w.type] || w.type;
      var statusText = { todo: "待开始", doing: "进行中", done: "已完成" }[w.status] || w.status;
      c.innerHTML = '<div class="panel-card"><h3>📁 ' + esc(w.title) + ' <span class="tag" style="background:var(--bg-soft);color:var(--muted);">' + esc(typeText) + '</span></h3>' +
        '<p class="panel-tip">' + esc(w.desc || "无说明") + '</p>' +
        '<div class="wb-detail-grid">' +
          '<div class="wb-ditem"><b>状态</b><span>' + esc(statusText) + '</span></div>' +
          '<div class="wb-ditem"><b>优先级</b><span>' + esc(w.priority || "中") + '</span></div>' +
          '<div class="wb-ditem"><b>负责人</b><span>' + esc(w.owner || "-") + '</span></div>' +
          '<div class="wb-ditem"><b>预计完成</b><span>' + fmtDate(w.dueAt) + '</span></div>' +
          '<div class="wb-ditem"><b>标签</b><span>' + tagHtml(w.tags) + '</span></div>' +
        '</div>' +
        '<div class="row" style="gap:10px;margin:16px 0;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="wbAddPage">＋ 生成新页面</button>' +
          '<button class="btn ghost" id="wbSite">⚙ 站点设置</button>' +
          '<button class="btn ghost" id="wbBack">← 返回列表</button>' +
        '</div>' +
        '<h4 style="margin:16px 0 8px;font-size:14px;">本工作已生成页面</h4>' +
        '<div id="wbPages"></div></div>';
      c.querySelector("#wbBack").onclick = function () { renderList(); };
      c.querySelector("#wbAddPage").onclick = function () { renderPageGenerator(id); };
      c.querySelector("#wbSite").onclick = function () { renderSiteSettings(); };
      renderPagesList(w);
    }

    function renderPagesList(w) {
      var box = c.querySelector("#wbPages");
      var pages = w.pages || [];
      if (!pages.length) { box.innerHTML = '<div class="status">还没有生成页面。</div>'; return; }
      var html = '<table class="item-table"><thead><tr><th>页面</th><th>模板</th><th>路径</th><th>操作</th></tr></thead><tbody>';
      pages.forEach(function (p) {
        html += '<tr><td>' + esc(p.title) + '</td><td>' + esc(p.template) + '</td><td><code>' + esc(p.path) + '</code></td>' +
          '<td><a class="btn sm" href="' + esc(p.path) + '" target="_blank">预览</a></td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    }

    /* ---------- 视图：新页面生成器 ---------- */
    function renderPageGenerator(workId) {
      c.innerHTML = '<div class="panel-card"><h3>＋ 生成新页面</h3>' +
        '<p class="panel-tip">选择页面模板并填写内容，保存后会自动生成 HTML 文件并写入仓库。</p>' +
        '<div class="row" style="gap:12px;flex-wrap:wrap;">' +
          '<div class="field" style="flex:2;min-width:220px;"><label>页面标题</label><input id="pgTitle" placeholder="如：暑期活动"></div>' +
          '<div class="field" style="flex:1;min-width:160px;"><label>文件名（英文/数字/短横线）</label><input id="pgSlug" placeholder="如：summer-event"></div>' +
        '</div>' +
        '<div class="field"><label>模板</label><select id="pgTemplate">' +
          '<option value="blank">空白页</option>' +
          '<option value="list">列表页</option>' +
          '<option value="article">图文页</option>' +
          '<option value="link">链接跳转页</option>' +
        '</select></div>' +
        '<div class="field" id="pgContentWrap"><label>页面内容（支持 HTML）</label><textarea id="pgContent" rows="12" placeholder="根据模板填写内容"></textarea></div>' +
        '<div class="field" id="pgLinksWrap" style="display:none;"><label>链接列表（每行一个：标题|URL）</label><textarea id="pgLinks" rows="6" placeholder="B站官方|https://www.bilibili.com&#10;QQ群|https://qm.qq.com"></textarea></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="pgGen">生成页面</button>' +
          '<button class="btn ghost" id="pgCancel">取消</button>' +
          '<span class="msg" id="pgMsg"></span>' +
        '</div>' +
        '<div class="panel-tip" id="pgPreview" style="margin-top:12px;"></div></div>';

      var tmplSel = c.querySelector("#pgTemplate");
      var contentWrap = c.querySelector("#pgContentWrap");
      var linksWrap = c.querySelector("#pgLinksWrap");
      var contentArea = c.querySelector("#pgContent");
      tmplSel.onchange = function () {
        var t = tmplSel.value;
        if (t === "link") { contentWrap.style.display = "none"; linksWrap.style.display = "block"; }
        else { contentWrap.style.display = "block"; linksWrap.style.display = "none"; }
        contentArea.placeholder = t === "blank" ? "可留空，后续再编辑" :
          t === "list" ? "每行一个列表项，如：\n新活动上线\n每日密码更新" :
          t === "article" ? "写入正文 HTML / 纯文本，支持 <p> <img> <h2> 等标签" : "";
      };
      tmplSel.onchange();

      c.querySelector("#pgCancel").onclick = function () { if (workId) renderDetail(workId); else renderList(); };
      c.querySelector("#pgGen").onclick = function () {
        var title = c.querySelector("#pgTitle").value.trim();
        var slug = c.querySelector("#pgSlug").value.trim().replace(/[^a-zA-Z0-9-]/g, "").replace(/-+/g, "-").toLowerCase();
        if (!title) { alert("请输入页面标题"); return; }
        if (!slug) { slug = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 30); }
        var tmpl = tmplSel.value;
        var path = slug + ".html";
        var html = buildPageHtml(title, tmpl, c.querySelector("#pgContent").value, c.querySelector("#pgLinks").value);
        var msg = c.querySelector("#pgMsg");
        var preview = c.querySelector("#pgPreview");
        msg.className = "msg"; msg.textContent = "正在生成并上传…";
        putFile("docs/" + path, b64utf8(html), "[workbench] 新建页面 " + title, msg)
          .then(function () {
            preview.textContent = "已生成：docs/" + path;
            // 记录到工作
            if (workId) {
              var w = works.find(function (x) { return x.id === workId; });
              if (w) {
                w.pages = w.pages || [];
                w.pages.push({ title: title, template: tmpl, path: path, createdAt: today() });
                // 同时记录到全局 generatedPages
                dataObj.generatedPages = dataObj.generatedPages || [];
                dataObj.generatedPages.push({ title: title, path: path, workId: workId, createdAt: today() });
                return saveWorks().then(function () { renderDetail(workId); });
              }
            }
            // 无工作关联时直接保存 generatedPages
            dataObj.generatedPages = dataObj.generatedPages || [];
            dataObj.generatedPages.push({ title: title, path: path, workId: workId || null, createdAt: today() });
            return saveData("记录生成页面", msg).then(function () { renderList(); });
          })
          .catch(function (e) { msg.className = "msg err"; msg.textContent = "❌ " + (e && e.message ? e.message : "生成失败"); });
      };
    }

    function buildPageHtml(title, tmpl, content, links) {
      var body = "";
      if (tmpl === "blank") {
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(title) + '</h1><div class="panel-card">' + (content || "<p>页面内容待补充。</p>") + '</div></div>';
      } else if (tmpl === "list") {
        var items = String(content || "").split("\n").filter(Boolean).map(function (x) { return '<li>' + esc(x.trim()) + '</li>'; }).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(title) + '</h1><div class="panel-card"><ul class="wb-page-list">' + (items || "<li>暂无内容</li>") + '</ul></div></div>';
      } else if (tmpl === "article") {
        body = '<div class="page-wrap"><article class="panel-card wb-article"><h1>' + esc(title) + '</h1>' + (content || "<p>正文待补充。</p>") + '</article></div>';
      } else if (tmpl === "link") {
        var rows = String(links || "").split("\n").filter(Boolean).map(function (line) {
          var parts = line.split(/\|/);
          var t = parts[0].trim();
          var u = (parts[1] || "").trim();
          if (!t || !u) return "";
          return '<a class="wb-link-card" href="' + esc(u) + '" target="_blank" rel="noopener"><span>' + esc(t) + '</span><span>→</span></a>';
        }).filter(Boolean).join("");
        body = '<div class="page-wrap"><h1 class="section-title">' + esc(title) + '</h1><div class="wb-link-grid">' + (rows || "<p>暂无链接</p>") + '</div></div>';
      }
      return '<!DOCTYPE html>\n<html lang="zh-CN" class="dark">\n<head>' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">\n' +
        '<title>' + esc(title) + ' · 三角洲情报台</title>\n' +
        '<link rel="stylesheet" href="css/style.css?v=42">\n' +
        '<script src="js/app.js?v=42"><\/script>\n' +
        '</head>\n<body>' + body + '</body>\n</html>';
    }

    /* ---------- 视图：站点设置 ---------- */
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
        '<h4 style="margin:16px 0 8px;font-size:14px;">顶部导航菜单</h4>' +
        '<div class="panel-tip">格式：route|图标|标题，每行一个。route 对应页面文件名（不含 .html）。</div>' +
        '<div class="field"><textarea id="stMenu" rows="8"></textarea></div>' +
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
      c.querySelector("#stMenu").value = menuToText(dataObj.menu || []);

      c.querySelector("#stCancel").onclick = function () { renderList(); };
      c.querySelector("#stSave").onclick = function () {
        dataObj.site = dataObj.site || {};
        dataObj.site.name = c.querySelector("#stName").value.trim();
        dataObj.site.afdianUrl = c.querySelector("#stAfdian").value.trim();
        dataObj.site.accent2 = c.querySelector("#stAccent").value.trim();
        dataObj.site.havkVoiceUrl = c.querySelector("#stHavkVoice").value.trim();
        dataObj.site.apiBase = c.querySelector("#stApiBase").value.trim();
        dataObj.menu = textToMenu(c.querySelector("#stMenu").value);
        saveData("更新站点设置与导航", c.querySelector("#stMsg")).then(function () { renderList(); }).catch(function () {});
      };
    }

    function menuToText(menu) {
      return menu.map(function (m) { return (m.route || "") + "|" + (m.ico || "") + "|" + (m.label || ""); }).join("\n");
    }
    function textToMenu(text) {
      return String(text || "").split("\n").map(function (line) {
        var p = line.split("|");
        return { route: p[0] ? p[0].trim() : "", ico: p[1] ? p[1].trim() : "", label: p[2] ? p[2].trim() : "" };
      }).filter(function (m) { return m.route && m.label; });
    }

    /* ---------- 视图：一键发版 ---------- */
    function renderRelease() {
      c.innerHTML = '<div class="panel-card"><h3>🚀 一键发版</h3>' +
        '<p class="panel-tip">自动完成：全站版本号 +1、修改 sw.js 缓存名、在 changelog 头部写入本次更新。确认后继续。</p>' +
        '<div class="field"><label>本次版本标题</label><input id="relTitle" placeholder="如：V42 · 开发工作台与音乐播放器优化"></div>' +
        '<div class="field"><label>更新内容（每行一条）</label><textarea id="relItems" rows="6" placeholder="新增开发工作台\n优化音乐播放器默认形态"></textarea></div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<button class="btn role-c" id="relGo">确认发版</button>' +
          '<button class="btn ghost" id="relCancel">取消</button>' +
          '<span class="msg" id="relMsg"></span>' +
        '</div>' +
        '<div id="relLog" style="margin-top:12px;font-size:13px;color:var(--muted);line-height:1.6;"></div></div>';

      c.querySelector("#relCancel").onclick = function () { renderList(); };
      c.querySelector("#relGo").onclick = function () {
        var title = c.querySelector("#relTitle").value.trim();
        var items = String(c.querySelector("#relItems").value || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        if (!title) { alert("请输入版本标题"); return; }
        if (!items.length) { alert("请至少填写一条更新内容"); return; }
        var log = c.querySelector("#relLog");
        var msg = c.querySelector("#relMsg");
        log.innerHTML += "开始检测当前版本…<br>";
        doRelease(title, items, log, msg).catch(function (e) { msg.className = "msg err"; msg.textContent = "❌ " + (e && e.message ? e.message : "发版失败"); });
      };
    }

    function doRelease(title, items, log, msg) {
      // 1. 找当前版本号
      var currentVer = 40; // fallback
      var htmlFiles = ["index.html", "admin.html", "music.html", "news.html", "guns.html", "profile.html", "zhanji.html", "forum.html", "friends.html", "kzb.html", "search.html", "tujian.html", "ugc.html", "feedback.html"];
      var jsFiles = ["js/app.js", "js/music.js", "js/workbench.js"];
      var allFiles = htmlFiles.concat(jsFiles);

      return Promise.resolve().then(function () {
        // 从 index.html 或 app.js 读取当前版本
        return fetchFile("index.html").then(function (txt) {
          var m = txt.match(/v=(\d+)/);
          if (m) currentVer = parseInt(m[1], 10);
          log.innerHTML += "当前版本号：v" + currentVer + "<br>";
        }).catch(function () { log.innerHTML += "无法读取 index.html，使用默认 v40<br>"; });
      }).then(function () {
        var nextVer = currentVer + 1;
        var oldToken = "v=" + currentVer;
        var newToken = "v=" + nextVer;
        var oldCache = "delta-intel-v" + currentVer;
        var newCache = "delta-intel-v" + nextVer;
        log.innerHTML += "目标版本号：v" + nextVer + "<br>";

        // 2. 批量替换所有文件
        var tasks = allFiles.map(function (f) {
          return fetchFile(f).then(function (txt) {
            var newTxt = txt.split(oldToken).join(newToken);
            if (f === "sw.js") newTxt = newTxt.split(oldCache).join(newCache);
            if (newTxt === txt) return { file: f, changed: false };
            return writeFile(f, b64utf8(newTxt), "[release] bump " + oldToken + " -> " + newToken).then(function () {
              return { file: f, changed: true };
            });
          }).catch(function (e) { return { file: f, error: e && e.message ? e.message : String(e) }; });
        });
        return Promise.all(tasks).then(function (results) {
          var changed = results.filter(function (r) { return r.changed; });
          var errs = results.filter(function (r) { return r.error; });
          log.innerHTML += "文件更新：" + changed.length + " 个成功，" + errs.length + " 个失败<br>";
          if (errs.length) {
            errs.forEach(function (e) { log.innerHTML += "- " + e.file + " 失败：" + e.error + "<br>"; });
            throw new Error("部分文件更新失败");
          }
          // 3. 更新 data.json changelog
          return getDataObj().then(function (d) {
            dataObj = d.obj;
            dataObj.changelog = dataObj.changelog || [];
            dataObj.changelog.unshift({ date: today(), title: title, items: items });
            dataObj.changelog = dataObj.changelog.slice(0, 30);
            return saveData("一键发版 v" + nextVer, msg);
          });
        }).then(function () {
          msg.className = "msg ok"; msg.textContent = "✅ 已发版 v" + nextVer + "，请 Ctrl+F5 强刷。";
          log.innerHTML += "完成：v" + nextVer + "<br>";
        });
      });
    }

    function fetchFile(path) {
      if (adminMode() === "worker") {
        return wkFetch("/api/admin/file?path=" + encodeURIComponent(path)).then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); return j.content || ""; });
      }
      return fetch(API + "/repos/" + REPO + "/contents/" + path, { headers: headers(true) })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { return decodeURIComponent(escape(atob(j.content))); });
    }

    function writeFile(path, base64, message) {
      if (typeof putFile === "function") return putFile(path, base64, message);
      // fallback：GitHub API 直接写（无 sha 版本，新建文件）
      return fetch(API + "/repos/" + REPO + "/contents/" + path, {
        method: "PUT", headers: headers(true),
        body: JSON.stringify({ message: message, content: base64 })
      }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.message); }); });
    }

    function b64utf8(s) {
      return btoa(unescape(encodeURIComponent(s)));
    }

    function b64utf8(s) { return window.__admin && window.__admin.b64utf8 ? window.__admin.b64utf8(s) : btoa(unescape(encodeURIComponent(s))); }

    function adminMode() { return window.__admin && window.__admin.adminMode ? window.__admin.adminMode() : "github"; }
    function headers(auth) { return window.__admin && window.__admin.headers ? window.__admin.headers(auth) : {}; }
    function wkFetch(u, o) { return window.__admin && window.__admin.wkFetch ? window.__admin.wkFetch(u, o) : fetch(u, o); }
    function getDataObj() { return window.__admin && window.__admin.getDataObj ? window.__admin.getDataObj() : Promise.reject(new Error("工作台未挂载")); }
    function putDataObj(obj, action, msgEl) { return window.__admin && window.__admin.putDataObj ? window.__admin.putDataObj(obj, action, msgEl) : Promise.reject(new Error("工作台未挂载")); }
    function putFile(path, base64, message, msgEl) { return window.__admin && window.__admin.putFile ? window.__admin.putFile(path, base64, message, msgEl) : Promise.reject(new Error("工作台未挂载")); }

    loadData().then(function () { renderList(); }).catch(function (e) {
      c.innerHTML = '<div class="status" style="color:#ff5b5b">加载数据失败：' + esc(e.message) + '</div>';
    });
  }

  window.mountWorkbench = mountWorkbench;
})();
