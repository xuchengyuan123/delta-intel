/* =========================================================
 * music.js — 音乐台（QQ音乐式在线播放）
 *   - 左侧播放列表 + 右侧大播放器（封面 / 标题 / 艺人）
 *   - 使用 QQ音乐官方 outchain 外链播放器在页面内直接播放（type: "qq"，需 songid 纯数字）
 *   - 也支持：直链音频（type: "audio"，HTML5 <audio>）、外链（type: "link"）
 *   data.json.music 字段：title, artist, type, songid, dur, tag, cover
 * ========================================================= */
(function () {
  "use strict";

  var STATE = { tracks: [], current: 0, audio: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(t) {
    return {
      title: t.title || "未命名曲目",
      artist: t.artist || "三角洲行动",
      type: t.type || (t.songid ? "qq" : (t.src ? "audio" : "link")),
      songid: t.songid || "",
      src: t.src || "",
      url: t.url || "",
      dur: t.dur || "",
      tag: t.tag || "",
      cover: t.cover || ""
    };
  }
  function coverFor(t, i) {
    if (t.cover) return t.cover;
    var palette = ["#19c3a6", "#3a7bd5", "#a06bff", "#ff7a59", "#ffb300", "#2ecc71"];
    return "grad:" + palette[i % palette.length];
  }

  /* ---------- 渲染 ---------- */
  function playlistHtml() {
    return STATE.tracks.map(function (t, i) {
      var tn = norm(t);
      var active = i === STATE.current ? " active" : "";
      var cv = coverFor(tn, i);
      var cover = cv.indexOf("grad:") === 0
        ? '<div class="pl-cover" style="background:linear-gradient(135deg,' + cv.slice(5) + ',#0d1b2a)">' + esc(tn.title.slice(0, 1)) + '</div>'
        : '<div class="pl-cover" style="background:url(' + esc(cv) + ') center/cover"></div>';
      var icon = tn.type === "qq" ? "🎵" : (tn.type === "audio" ? "🎧" : "🔗");
      return '<div class="pl-item' + active + '" data-i="' + i + '">' + cover +
        '<div class="pl-meta"><div class="pl-title">' + esc(tn.title) + '</div><div class="pl-artist">' + esc(tn.artist) + '</div></div>' +
        '<div class="pl-right"><span class="pl-tag">' + esc(tn.tag) + '</span><span class="pl-dur">' + esc(tn.dur) + '</span><span class="pl-src">' + icon + '</span></div></div>';
    }).join("");
  }

  function playerHtml() {
    if (!STATE.tracks.length) {
      return '<div class="pl-player"><div class="pl-nostage">音乐列表为空，请在后台「音乐管理」添加曲目并填写 QQ音乐 songid。</div></div>';
    }
    var t = norm(STATE.tracks[STATE.current]);
    var cv = coverFor(t, STATE.current);
    var cover = cv.indexOf("grad:") === 0
      ? '<div class="pl-big-cover" style="background:linear-gradient(135deg,' + cv.slice(5) + ',#0d1b2a)">' + esc(t.title.slice(0, 1)) + '</div>'
      : '<div class="pl-big-cover" style="background:url(' + esc(cv) + ') center/cover"></div>';

    var stage = "";
    if (t.type === "qq" && t.songid) {
      // QQ音乐官方外链播放器：页面内直接播放，像 QQ音乐一样
      var embed = "https://i.y.qq.com/n2/m/outchain/player/index.html?songid=" + encodeURIComponent(t.songid) + "&songtype=0";
      stage = '<iframe class="pl-embed" src="' + embed + '" scrolling="no" border="0" frameborder="no" ' +
        'allowfullscreen="true" allow="autoplay; encrypted-media"></iframe>';
    } else if (t.type === "audio" && t.src) {
      stage = '<audio class="pl-audio" src="' + esc(t.src) + '" controls autoplay style="width:100%"></audio>';
    } else if (t.type === "qq" && !t.songid) {
      stage = '<div class="pl-nostage">本曲尚未配置 QQ音乐 songid。<br>' +
        '<span class="pl-tip-in">请在后台「音乐管理」填写 QQ音乐 网页版分享链接里的纯数字 songid，即可像 QQ音乐一样在页面内播放。</span><br>' +
        '<a class="btn" href="https://y.qq.com/portal/search.html#t=song&w=' + encodeURIComponent(t.title) + '" target="_blank" rel="noopener">🔍 去 QQ音乐 搜索</a></div>';
    } else {
      stage = '<div class="pl-nostage">本曲为外链，点击下方按钮到源站播放。<br>' +
        '<a class="btn" href="' + esc(t.url) + '" target="_blank" rel="noopener">▶ 在源站播放</a></div>';
    }

    return '<div class="pl-player">' + cover +
      '<div class="pl-now"><div class="pl-now-title">' + esc(t.title) + '</div><div class="pl-now-artist">' + esc(t.artist) + '</div></div>' +
      '<div class="pl-stage">' + stage + "</div>" +
      (t.type === "qq" && t.songid ? '<div class="pl-tip">▲ 上方为 QQ音乐外链播放器，在页面内直接播放完整歌曲（歌曲版权受限时可能无声）。</div>' : "") +
    "</div>";
  }

  function musicHtml(D) {
    // 注册时数据可能尚未异步加载完成（app.js 先拉 data.json），此处按最新数据补齐播放列表
    var d = (D && D.getData && D.getData()) || {};
    if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
    if (STATE.current >= STATE.tracks.length) STATE.current = 0;
    return '<div class="section-title">🎵 音乐台</div>' +
      '<div class="music-intro">收录《三角洲行动》OST 与主题曲，使用 QQ音乐外链播放器在页面内直接播放（像 QQ音乐一样）。' +
      '管理员可在后台「音乐管理」增删曲目并填写 QQ音乐 songid。</div>' +
      '<div class="music-layout"><div class="music-list"><div class="music-list-head">播放列表 · ' + STATE.tracks.length + ' 首</div>' +
        '<div id="plItems">' + playlistHtml() + '</div></div>' +
      '<div class="music-stage" id="plStage">' + playerHtml() + '</div></div>';
  }
  function musicInit(D) {
    document.querySelectorAll("#plItems .pl-item").forEach(function (el) {
      el.addEventListener("click", function () { STATE.current = +el.getAttribute("data-i"); renderStage(); renderPlaylist(); });
    });
  }
  function renderStage() { var s = document.getElementById("plStage"); if (s) s.innerHTML = playerHtml(); }
  function renderPlaylist() {
    var p = document.getElementById("plItems"); if (p) p.innerHTML = playlistHtml();
    document.querySelectorAll("#plItems .pl-item").forEach(function (el) {
      el.addEventListener("click", function () { STATE.current = +el.getAttribute("data-i"); renderStage(); renderPlaylist(); });
    });
  }

  /* ---------- 底部迷你条 ---------- */
  function miniBarHtml() {
    var raw = STATE.tracks[STATE.current];
    if (!raw) return ""; // 数据尚未加载（无曲目）时不渲染迷你条，避免崩溃
    var t = norm(raw);
    return '<div id="musicBar" class="music-bar"><div class="mb-cover">' + esc(t.title.slice(0, 1)) + '</div>' +
      '<div class="mb-meta"><div class="mb-title">♪ ' + esc(t.title) + '</div><div class="mb-sub">' + esc(t.artist) + '</div></div>' +
      '<button class="mb-btn" id="mbPrev" title="上一首">⏮</button><button class="mb-btn" id="mbOpen" title="打开音乐台">🎵</button><button class="mb-btn" id="mbNext" title="下一首">⏭</button></div>';
  }
  function buildBar() {
    if (document.getElementById("musicBar")) return;
    var d = (window.DF && window.DF.getData && window.DF.getData()) || {};
    if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
    if (STATE.current >= STATE.tracks.length) STATE.current = 0;
    var bar = document.createElement("div"); bar.innerHTML = miniBarHtml();
    document.body.appendChild(bar.firstElementChild); bindBar();
  }
  function bindBar() {
    var prev = document.getElementById("mbPrev"), open = document.getElementById("mbOpen"), next = document.getElementById("mbNext");
    if (prev) prev.addEventListener("click", function () { STATE.current = (STATE.current - 1 + STATE.tracks.length) % STATE.tracks.length; renderStage(); renderPlaylist(); refreshBar(); });
    if (next) next.addEventListener("click", function () { STATE.current = (STATE.current + 1) % STATE.tracks.length; renderStage(); renderPlaylist(); refreshBar(); });
    if (open) open.addEventListener("click", function () { if (window.DF) window.DF.navigate("music"); });
  }
  function refreshBar() { var bar = document.getElementById("musicBar"); if (!bar) return; bar.outerHTML = miniBarHtml(); bindBar(); }

  function reg(D) {
    var data = D.getData() || {};
    if (data.music && data.music.length) STATE.tracks = data.music.map(norm);
    D.VIEWS.music = { html: function () { return musicHtml(D); }, init: function () { musicInit(D); } };
    D.MENU.push({ group: "娱乐", items: [{ route: "music", label: "音乐台", ico: "🎵" }] });
  }
  if (window.DF) { reg(window.DF); }
  else { (window.__df_plugins = window.__df_plugins || []).push(function (D) { reg(D); }); }
  // 数据加载完成后再构建迷你条（此刻 DATA 才就绪，避免 norm(undefined) 崩溃）
  window.addEventListener("df:data", function () {
    try {
      var d = (window.DF && window.DF.getData && window.DF.getData()) || {};
      if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
      if (STATE.current >= STATE.tracks.length) STATE.current = 0;
      buildBar();
    } catch (e) {}
  });
})();
