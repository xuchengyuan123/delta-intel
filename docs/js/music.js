/* =========================================================
 * music.js — 悬浮常驻音乐播放器（音乐台同款：Meting API + 真实 <audio>）
 *   - 与 music.html 的「音乐台」采用同一套播放逻辑（多源 Meting API，自动选可用源）
 *   - 后台 data.json.music[] 的歌曲，按歌名经音乐台多源搜索解析出可播放链接（与音乐台获取链接方式一致）
 *   - 悬浮条：封面 / 标题·歌手 / 上一首·播放·下一首 / <audio> / 收起(胶囊)展开
 *   - 展开后可在站内直接搜歌并加入播放列表（搜索结果追加，不去覆盖后台歌单）
 *   - 默认载入三角洲行动主题曲《Unbreakable》（与音乐台一致）
 *   data.json.music 字段：title, artist, type, songid, dur, tag, cover
 * ========================================================= */
(function () {
  "use strict";

  // 与 music.html 音乐台一致的多源 API
  var APIS = {
    netease: "https://api.i-meto.com/meting/api",
    tencent: "https://metingapi.nanorocky.top/",
    kugou: "https://api.i-meto.com/meting/api",
    kuwo: "https://api.i-meto.com/meting/api",
    baidu: "https://api.i-meto.com/meting/api"
  };
  // 解析播放链接统一走「音乐台」多源搜索（与 music.html 一致）：搜索结果里的 url 即为可播放链接
  // resolved（顶部已声明）按 歌名 缓存解析结果，避免重复搜索

  var playlist = [];
  var cur = 0;
  var audio = null;
  var floatEl = null;
  var isMini = true;          // 全站悬浮默认折叠
  var isOrb = true;           // 更进一步的迷你圆球态（默认小圆球，点击展开）
  var seeded = false;
  var resolved = {};          // 歌名 -> {url, pic} 缓存，避免重复搜索

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 搜索结果归一化（Meting 直接返回 url/pic）
  function normalize(it) {
    return {
      title: it.title || it.name || "未知",
      author: it.author || it.artist || "未知",
      url: it.url || "",
      pic: it.pic || it.cover || "",
      songid: it.songid || "",
      server: it.server || "netease",
      type: "meting"
    };
  }

  // 默认主题曲（与 music.html 一致）
  function defaultUnbreakable() {
    return {
      title: "Unbreakable（坚不可摧）",
      author: "三角洲行动 / Andreas Ohnhaus",
      url: "https://api.i-meto.com/meting/api?server=netease&type=url&id=3392592976&auth=af0a0cec9075e78ebd30a4bf58690a28032e4767",
      pic: "https://api.i-meto.com/meting/api?server=netease&type=pic&id=109951173367356607&auth=e066f3fa54c4b109f501a3ebdd1d5e36fdba4194",
      server: "netease", songid: "", type: "meting"
    };
  }

  // 用后台 data.json.music[] 播种（按歌名搜索解析，无 songid 的曲目也能播）
  function seedFromData(D) {
    if (seeded) return;
    seeded = true;
    playlist = [defaultUnbreakable()];
    var d = (D && D.getData && D.getData()) || {};
    (d.music || []).forEach(function (m) {
      var title = m.title || "未命名曲目";
      if (playlist.some(function (p) { return p.title === title; })) return;
      playlist.push({
        title: title,
        author: m.artist || "三角洲行动",
        songid: m.songid || "",
        server: (m.type === "qq" ? "tencent" : "netease"),
        pic: m.cover || "",
        url: "", type: m.type || "qq"
      });
    });
  }

  // 解析播放链接：已有直链直接用；否则按歌名经音乐台多源搜索拿到可播放链接（与音乐台一致）
  function resolve(item) {
    if (item.url) return Promise.resolve(item);
    if (resolved["t:" + item.title]) {
      var c = resolved["t:" + item.title];
      item.url = c.url; if (!item.pic) item.pic = c.pic;
      return Promise.resolve(item);
    }
    return searchFirst(item.title, item.server || "tencent").then(function (n) {
      if (!n || !n.url) return Promise.reject(new Error("no-result"));
      resolved["t:" + item.title] = { url: n.url, pic: n.pic };
      item.url = n.url; if (!item.pic) item.pic = n.pic;
      return item;
    });
  }

  // 多端点回退搜索，返回首个带可播放链接的结果（复用音乐台 searchWith）
  function searchFirst(q, server) {
    return new Promise(function (resolveP, rejectP) {
      var endpoints = [];
      var primary = APIS[server] || APIS.netease;
      endpoints.push(primary);
      if (server !== "netease" && primary !== APIS.netease) endpoints.push(APIS.netease);
      if (server !== "tencent" && primary !== APIS.tencent) endpoints.push(APIS.tencent);
      (function tryNext(idx) {
        if (idx >= endpoints.length) { rejectP(new Error("not-found")); return; }
        searchWith(endpoints[idx], q, server).then(function (arr) {
          if (!Array.isArray(arr) || !arr.length) { tryNext(idx + 1); return; }
          var n = normalize(arr[0]);
          if (!n.url) { tryNext(idx + 1); return; }
          resolveP(n);
        }).catch(function () { tryNext(idx + 1); });
      })(0);
    });
  }

  function tip(msg) {
    ["muTip", "muViewTip"].forEach(function (id) {
      var el = document.getElementById(id); if (el && msg != null) el.textContent = msg;
    });
  }
  function setPlayBtn(s) { var b = document.getElementById("muPlay"); if (b) b.textContent = s; }

  function updateBar(it) {
    var c = document.getElementById("muBarCover"); if (c) c.src = it.pic || "";
    var t = document.getElementById("muBarTitle"); if (t) t.textContent = it.title || "未命名";
    var a = document.getElementById("muBarArtist"); if (a) a.textContent = it.author || "未知";
    var m = document.getElementById("muMiniInfo"); if (m) m.textContent = (it.title || "未命名") + " - " + (it.author || "未知");
    renderLists();
  }

  function playIndex(i) {
    if (i < 0 || i >= playlist.length) return;
    cur = i;
    var it = playlist[i];
    setPlayBtn("…");
    resolve(it).then(function (res) {
      if (!res.url) { tip("无法获取《" + res.title + "》的播放链接，换一首试试。"); setPlayBtn("▶"); return; }
      audio.src = res.url;
      audio.play().then(function () { setPlayBtn("⏸"); }).catch(function () { setPlayBtn("▶"); });
      updateBar(res);
    }).catch(function () {
      tip("无法获取《" + it.title + "》的播放链接（可能该源暂不可用）。");
      setPlayBtn("▶");
    });
  }

  function togglePlay() {
    if (!audio.src && playlist.length) { playIndex(cur); return; }
    if (audio.paused) {
      if (isOrb) expand();
      audio.play().then(function () { setPlayBtn("⏸"); }).catch(function () {});
    } else { audio.pause(); setPlayBtn("▶"); }
  }

  function setView(orb, mini) {
    isOrb = orb;
    isMini = mini;
    if (floatEl) {
      floatEl.classList.toggle("orb", isOrb);
      floatEl.classList.toggle("mini", isMini && !isOrb);
    }
    var tg = document.getElementById("muToggle");
    if (tg) tg.textContent = (isOrb || isMini) ? "展开 ▲" : "收起 ▼";
  }
  function expand() { setView(false, false); }

  function renderLists() {
    renderListInto("muList");
    renderListInto("muListView");
  }
  function renderListInto(id) {
    var box = document.getElementById(id); if (!box) return;
    if (!playlist.length) { box.innerHTML = ""; return; }
    box.innerHTML = playlist.map(function (it, i) {
      var n = it;
      return '<div class="mu-card' + (i === cur ? " playing" : "") + '" data-i="' + i + '">' +
        '<img class="mu-cover" src="' + esc(n.pic) + '" onerror="this.style.visibility=\'hidden\'">' +
        '<div class="mu-info"><div class="mu-name">' + esc(n.title) + '</div>' +
        '<div class="mu-artist">' + esc(n.author) + "</div></div></div>";
    }).join("");
    box.querySelectorAll(".mu-card").forEach(function (el) {
      el.addEventListener("click", function () { playIndex(parseInt(el.getAttribute("data-i"), 10)); });
    });
  }

  // 搜歌（多端点回退，结果追加到播放列表）
  function searchWith(endpoint, q, server) {
    var url = endpoint + (endpoint.indexOf("?") > 0 ? "&" : "?");
    if (endpoint.indexOf("metingapi.nanorocky.top") > -1) {
      url += "server=" + encodeURIComponent(server) + "&type=search&id=0&keyword=" + encodeURIComponent(q) + "&_=" + Date.now();
    } else {
      url += "server=" + encodeURIComponent(server) + "&type=search&id=" + encodeURIComponent(q) + "&_=" + Date.now();
    }
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function doSearch(q, server) {
    if (!q) { tip("请先输入关键词。"); return; }
    tip("搜索中…");
    var endpoints = [];
    var primary = APIS[server] || APIS.netease;
    endpoints.push(primary);
    if (server !== "netease" && primary !== APIS.netease) endpoints.push(APIS.netease);
    if (server !== "tencent" && primary !== APIS.tencent) endpoints.push(APIS.tencent);
    function tryNext(idx) {
      if (idx >= endpoints.length) { tip("未找到相关歌曲，换个关键词或平台试试。"); return; }
      searchWith(endpoints[idx], q, server).then(function (arr) {
        if (!Array.isArray(arr) || !arr.length) { tryNext(idx + 1); return; }
        var before = playlist.length;
        arr.forEach(function (it) {
          var n = normalize(it);
          if (!n.title) return;
          if (playlist.some(function (p) { return p.title === n.title; })) return;
          playlist.push(n);
        });
        var added = playlist.length - before;
        tip(added ? ("已添加 " + added + " 首（共 " + playlist.length + " 首）") : "没有新的结果，换关键词试试。");
        renderLists();
        if (added) playIndex(before);
      }).catch(function () { tryNext(idx + 1); });
    }
    tryNext(0);
  }

  /* ---------- 构建悬浮播放器（仅一次，常驻 body） ---------- */
  function floatHtml() {
    return '<div class="mu-float' + (isOrb ? " orb" : (isMini ? " mini" : "")) + '" id="muFloat">' +
      '<div class="mu-orb" id="muOrb" title="展开音乐台">' +
        '<button id="muOrbPlay" class="play" title="播放/暂停">▶</button>' +
      '</div>' +
      '<div class="mu-bar-head">' +
        '<img id="muBarCover" alt="">' +
        '<div class="mu-now"><div class="t" id="muBarTitle">未在播放</div><div class="a" id="muBarArtist">—</div></div>' +
        '<div class="mu-mini-info" id="muMiniInfo">未在播放</div>' +
        '<div class="mu-ctrl">' +
          '<button id="muPrev" title="上一首">⏮</button>' +
          '<button id="muPlay" class="play" title="播放/暂停">▶</button>' +
          '<button id="muNext" title="下一首">⏭</button>' +
        '</div>' +
        '<audio id="muAudio" controls preload="none"></audio>' +
        '<button class="mu-toggle" id="muToggle" title="收起/展开">' + (isMini ? "展开 ▲" : "收起 ▼") + "</button>" +
      "</div>" +
      '<div class="mu-search">' +
        '<input id="muQ" placeholder="搜歌、歌手或歌单，如：周杰伦 / 孤勇者">' +
        '<select id="muServer">' +
          '<option value="netease">网易云</option>' +
          '<option value="tencent" selected>QQ音乐</option>' +
          '<option value="kugou">酷狗</option>' +
          '<option value="kuwo">酷我</option>' +
          '<option value="baidu">千千音乐</option>' +
        "</select>" +
        '<button class="mu-btn" id="muSearch">🔍 搜索</button>' +
      "</div>" +
      '<div class="mu-tip" id="muTip">点击 ▶ 播放《' + esc(playlist[0] ? playlist[0].title : "") + '》</div>' +
      '<div class="mu-list" id="muList"></div>' +
    "</div>";
  }

  function buildFloat() {
    if (document.getElementById("muFloat")) return; // 已在音乐台页面内则不再重复
    var w = document.createElement("div");
    w.innerHTML = floatHtml();
    document.body.appendChild(w.firstElementChild);
    floatEl = document.getElementById("muFloat");
    audio = document.getElementById("muAudio");
    bindFloat();
    updateBar(playlist[0] || {});
  }

  function bindFloat() {
    var prev = document.getElementById("muPrev"),
        play = document.getElementById("muPlay"),
        next = document.getElementById("muNext"),
        toggle = document.getElementById("muToggle"),
        orb = document.getElementById("muOrb"),
        orbPlay = document.getElementById("muOrbPlay");
    if (prev) prev.onclick = function () { if (playlist.length) playIndex((cur - 1 + playlist.length) % playlist.length); };
    if (play) play.onclick = togglePlay;
    if (next) next.onclick = function () { if (playlist.length) playIndex((cur + 1) % playlist.length); };
    if (toggle) toggle.onclick = function () { setView(true, true); };
    if (orb) orb.onclick = expand;
    if (orbPlay) orbPlay.onclick = function (e) { e.stopPropagation(); togglePlay(); };
    if (audio) {
      audio.addEventListener("ended", function () { if (playlist.length) playIndex((cur + 1) % playlist.length); });
      audio.addEventListener("play", function () { setPlayBtn("⏸"); });
      audio.addEventListener("pause", function () { setPlayBtn("▶"); });
      audio.addEventListener("error", function () { tip("当前音频加载失败，点击播放或换一首试试。"); });
    }
    var sb = document.getElementById("muSearch");
    if (sb) sb.onclick = function () {
      var q = document.getElementById("muQ").value.trim();
      var s = document.getElementById("muServer").value;
      doSearch(q, s);
    };
    var qe = document.getElementById("muQ");
    if (qe) qe.addEventListener("keydown", function (e) { if (e.key === "Enter") document.getElementById("muSearch").click(); });
  }

  /* ---------- SPA「音乐台」视图（与音乐台页面一致的逻辑） ---------- */
  function viewHtml() {
    return '<div class="section-title">🎵 音乐台</div>' +
      '<p class="mu-sub" style="color:var(--muted);font-size:13px;margin:0 0 12px;">调用多个公共 Meting API（网易云 / QQ音乐 / 酷狗 / 酷我 / 千千），自动选择可用源，点击即播。后台「音乐管理」里的歌曲会显示在这里，也可直接搜歌加入播放列表。</p>' +
      '<div class="mu-search" id="muViewSearch">' +
        '<input id="muViewQ" placeholder="搜歌、歌手或歌单关键词">' +
        '<select id="muViewServer">' +
          '<option value="netease">网易云</option>' +
          '<option value="tencent" selected>QQ音乐</option>' +
          '<option value="kugou">酷狗</option>' +
          '<option value="kuwo">酷我</option>' +
          '<option value="baidu">千千音乐</option>' +
        "</select>" +
        '<button class="mu-btn" id="muViewSearchBtn">🔍 搜索</button>' +
      "</div>" +
      '<div class="mu-tip" id="muViewTip">后台添加的歌曲已载入播放列表，点击播放。</div>' +
      '<div class="mu-list" id="muListView"></div>';
  }
  function viewInit() {
    renderListInto("muListView");
    var sb = document.getElementById("muViewSearchBtn");
    if (sb) sb.onclick = function () {
      var q = document.getElementById("muViewQ").value.trim();
      var s = document.getElementById("muViewServer").value;
      doSearch(q, s);
    };
    var qe = document.getElementById("muViewQ");
    if (qe) qe.addEventListener("keydown", function (e) { if (e.key === "Enter") document.getElementById("muViewSearchBtn").click(); });
  }

  function reg(D) {
    seedFromData(D);
    D.VIEWS.music = { html: function () { return viewHtml(); }, init: function () { viewInit(); } };
    D.MENU.push({ group: "娱乐", items: [{ route: "music", label: "音乐台", ico: "🎵" }] });
    buildFloat();
  }

  if (window.DF) { reg(window.DF); }
  else { (window.__df_plugins = window.__df_plugins || []).push(function (D) { reg(D); }); }

  // 数据加载完成后（可能晚于插件注册）再补种一次并刷新悬浮条
  window.addEventListener("df:data", function () {
    try {
      seedFromData(window.DF);
      if (!document.getElementById("muFloat")) buildFloat();
      else { audio = document.getElementById("muAudio"); updateBar(playlist[cur] || playlist[0] || {}); renderLists(); }
    } catch (e) {}
  });
})();
