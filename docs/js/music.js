/* =========================================================
 * music.js — 音乐台（仿 鼠鼠音乐 / shushu.fan 风格）
 *   - 左侧播放列表 + 右侧大播放器（封面 / 标题 / 艺人）
 *   - 用 B站 内嵌播放器真播完整歌曲（type: "bilibili"）
 *   - 也支持直链音频（type: "audio"，用 HTML5 <audio> 真播）
 *   - 仅有外链时用按钮跳源站（type: "link"）
 *   data.json.music 可自由增删，字段见 DEFAULT_TRACKS。
 * ========================================================= */
(function () {
  "use strict";

  // 真实可播的三角洲行动 OST（B站内嵌可真播完整歌曲）
  var DEFAULT_TRACKS = [
    { title: "OST 合集（S8/S9 全配乐）", artist: "三角洲行动", type: "bilibili", bvid: "BV1fwroYAEGY", page: 1, dur: "1:26:21", tag: "合集" },
    { title: "永不回头 Perforation（殊死一搏）", artist: "贯穿原声带", type: "bilibili", bvid: "BV1jQSdYJEP9", dur: "06:31", tag: "战斗" },
    { title: "CC音乐彩蛋·各赛季主题曲", artist: "渡鸦音乐", type: "bilibili", bvid: "BV1QFuezXEqW", dur: "系列", tag: "主题曲" },
    { title: "大厅 BGM", artist: "三角洲行动", type: "bilibili", bvid: "BV1fvSbYLEZ8", dur: "02:57", tag: "大厅" },
    { title: "庇护者行动 主题曲 Fight", artist: "S2 主题曲", type: "bilibili", bvid: "BV1fwroYAEGY", page: 53, dur: "04:16", tag: "主题曲" },
    { title: "攀升 / 临界点 Rise", artist: "临界原作者带", type: "bilibili", bvid: "BV1jQSdYJEP9", page: 2, dur: "04:50", tag: "战斗" }
  ];

  var STATE = { tracks: DEFAULT_TRACKS.slice(), current: 0, audio: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(t) {
    return {
      title: t.title || "未命名曲目",
      artist: t.artist || "三角洲行动",
      type: t.type || (t.bvid ? "bilibili" : (t.src ? "audio" : "link")),
      bvid: t.bvid || "",
      page: t.page || 1,
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
    var c = palette[i % palette.length];
    return "grad:" + c;
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
      var icon = tn.type === "bilibili" ? "📺" : (tn.type === "audio" ? "🎵" : "🔗");
      return '<div class="pl-item' + active + '" data-i="' + i + '">' +
        cover +
        '<div class="pl-meta"><div class="pl-title">' + esc(tn.title) + '</div>' +
        '<div class="pl-artist">' + esc(tn.artist) + '</div></div>' +
        '<div class="pl-right"><span class="pl-tag">' + esc(tn.tag) + '</span>' +
        '<span class="pl-dur">' + esc(tn.dur) + '</span>' +
        '<span class="pl-src">' + icon + '</span></div>' +
      '</div>';
    }).join("");
  }

  function playerHtml() {
    var t = norm(STATE.tracks[STATE.current]);
    var cv = coverFor(t, STATE.current);
    var cover = cv.indexOf("grad:") === 0
      ? '<div class="pl-big-cover" style="background:linear-gradient(135deg,' + cv.slice(5) + ',#0d1b2a)">' + esc(t.title.slice(0, 1)) + '</div>'
      : '<div class="pl-big-cover" style="background:url(' + esc(cv) + ') center/cover"></div>';

    var stage = "";
    if (t.type === "bilibili" && t.bvid) {
      var embed = "https://player.bilibili.com/player.html?bvid=" + encodeURIComponent(t.bvid) +
        "&page=" + (t.page || 1) + "&high_quality=1&danmaku=0&autoplay=0&theme=#19c3a6";
      stage = '<iframe class="pl-embed" src="' + embed + '" scrolling="no" border="0" frameborder="no" ' +
        'allowfullscreen="true" allow="autoplay; encrypted-media"></iframe>';
    } else if (t.type === "audio" && t.src) {
      stage = '<audio class="pl-audio" src="' + esc(t.src) + '" controls autoplay style="width:100%"></audio>';
    } else {
      stage = '<div class="pl-nostage">本曲为外链，点击下方按钮到源站播放。<br>' +
        '<a class="btn" href="' + esc(t.url) + '" target="_blank" rel="noopener">▶ 在源站播放</a></div>';
    }

    return '<div class="pl-player">' +
      cover +
      '<div class="pl-now"><div class="pl-now-title">' + esc(t.title) + '</div>' +
      '<div class="pl-now-artist">' + esc(t.artist) + '</div></div>' +
      '<div class="pl-stage">' + stage + '</div>' +
      (t.type === "bilibili" ? '<div class="pl-tip">▲ 上方为 B站 内嵌播放器，可直接播放完整歌曲。下一首/上一首会切换视频。</div>' : '') +
    '</div>';
  }

  function musicHtml(D) {
    return '<div class="section-title">🎵 音乐台</div>' +
      '<div class="music-intro">收录《三角洲行动》官方 OST 与赛季主题曲，点击曲目即可内嵌播放完整歌曲。' +
      '管理员可在后台「音乐」维护里增删曲目（支持 B站 / 直链音频 / 外链）。</div>' +
      '<div class="music-layout">' +
        '<div class="music-list"><div class="music-list-head">播放列表 · ' + STATE.tracks.length + ' 首</div>' +
          '<div id="plItems">' + playlistHtml() + '</div></div>' +
        '<div class="music-stage" id="plStage">' + playerHtml() + '</div>' +
      '</div>';
  }
  function musicInit(D) {
    document.querySelectorAll("#plItems .pl-item").forEach(function (el) {
      el.addEventListener("click", function () {
        STATE.current = +el.getAttribute("data-i");
        renderStage(); renderPlaylist();
      });
    });
  }
  function renderStage() {
    var s = document.getElementById("plStage"); if (s) s.innerHTML = playerHtml();
  }
  function renderPlaylist() {
    var p = document.getElementById("plItems"); if (p) p.innerHTML = playlistHtml();
    document.querySelectorAll("#plItems .pl-item").forEach(function (el) {
      el.addEventListener("click", function () {
        STATE.current = +el.getAttribute("data-i");
        renderStage(); renderPlaylist();
      });
    });
  }

  /* ---------- 底部迷你条 ---------- */
  function miniBarHtml() {
    var t = norm(STATE.tracks[STATE.current]);
    return '<div id="musicBar" class="music-bar">' +
      '<div class="mb-cover">' + esc(t.title.slice(0, 1)) + '</div>' +
      '<div class="mb-meta"><div class="mb-title">♪ ' + esc(t.title) + '</div>' +
      '<div class="mb-sub">' + esc(t.artist) + '</div></div>' +
      '<button class="mb-btn" id="mbPrev" title="上一首">⏮</button>' +
      '<button class="mb-btn" id="mbOpen" title="打开音乐台">🎵</button>' +
      '<button class="mb-btn" id="mbNext" title="下一首">⏭</button>' +
    '</div>';
  }
  function buildBar() {
    if (document.getElementById("musicBar")) return;
    var bar = document.createElement("div"); bar.innerHTML = miniBarHtml();
    document.body.appendChild(bar.firstElementChild);
    bindBar();
  }
  function bindBar() {
    var prev = document.getElementById("mbPrev"), open = document.getElementById("mbOpen"), next = document.getElementById("mbNext");
    if (prev) prev.addEventListener("click", function () { STATE.current = (STATE.current - 1 + STATE.tracks.length) % STATE.tracks.length; renderStage(); renderPlaylist(); refreshBar(); });
    if (next) next.addEventListener("click", function () { STATE.current = (STATE.current + 1) % STATE.tracks.length; renderStage(); renderPlaylist(); refreshBar(); });
    if (open) open.addEventListener("click", function () { if (window.DF) window.DF.navigate("music"); });
  }
  function refreshBar() {
    var bar = document.getElementById("musicBar"); if (!bar) return;
    bar.outerHTML = miniBarHtml();
    bindBar();
  }

  function reg(D) {
    var data = D.getData() || {};
    if (data.music && data.music.length) {
      STATE.tracks = data.music.map(norm);
    }
    D.VIEWS.music = { html: function () { return musicHtml(D); }, init: function () { musicInit(D); } };
    D.MENU.push({ group: "娱乐", items: [{ route: "music", label: "音乐台", ico: "🎵" }] });
  }

  if (window.DF) { reg(window.DF); buildBar(); }
  else {
    (window.__df_plugins = window.__df_plugins || []).push(function (D) { reg(D); });
    if (document.readyState !== "loading") buildBar(); else document.addEventListener("DOMContentLoaded", buildBar);
  }
})();
