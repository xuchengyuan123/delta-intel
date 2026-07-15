/* =========================================================
 * music.js — 悬浮常驻音乐播放器（跨页续播）
 *   - 实际播放器（iframe/audio）常驻 document.body，切换页面不中断
 *   - 右下角悬浮条：封面 / 标题 / 上一首 / 展开 / 收起 / 隐藏
 *   - 音乐台视图只展示播放列表 + 当前曲目，点击切歌驱动悬浮播放器
 *   - 使用 QQ音乐官方 outchain 外链播放器在页面内直接播放（type: "qq"，需 songid 纯数字）
 *   - 也支持：直链音频（type: "audio"，HTML5 <audio>）、外链（type: "link"）
 *   data.json.music 字段：title, artist, type, songid, dur, tag, cover
 * ========================================================= */
(function () {
  "use strict";

  var STATE = { tracks: [], current: 0, mini: false, hidden: false };

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
  function coverHtml(t, i) {
    var cv = coverFor(t, i);
    if (cv.indexOf("grad:") === 0) {
      return '<div class="mf-cover" style="background:linear-gradient(135deg,' + cv.slice(5) + ',#0d1b2a)">' + esc(t.title.slice(0, 1)) + "</div>";
    }
    return '<div class="mf-cover" style="background:url(' + esc(cv) + ') center/cover"></div>';
  }

  /* ---------- 播放列表（音乐台视图内） ---------- */
  function playlistHtml() {
    return STATE.tracks.map(function (t, i) {
      var tn = norm(t);
      var active = i === STATE.current ? " active" : "";
      var cv = coverFor(tn, i);
      var cover = cv.indexOf("grad:") === 0
        ? '<div class="pl-cover" style="background:linear-gradient(135deg,' + cv.slice(5) + ',#0d1b2a)">' + esc(tn.title.slice(0, 1)) + "</div>"
        : '<div class="pl-cover" style="background:url(' + esc(cv) + ') center/cover"></div>';
      var icon = tn.type === "qq" ? "🎵" : (tn.type === "audio" ? "🎧" : "🔗");
      return '<div class="pl-item' + active + '" data-i="' + i + '">' + cover +
        '<div class="pl-meta"><div class="pl-title">' + esc(tn.title) + '</div><div class="pl-artist">' + esc(tn.artist) + "</div></div>" +
        '<div class="pl-right"><span class="pl-tag">' + esc(tn.tag) + '</span><span class="pl-dur">' + esc(tn.dur) + '</span><span class="pl-src">' + icon + "</span></div></div>";
    }).join("");
  }

  /* ---------- 悬浮播放器（常驻 body） ---------- */
  function stageInner() {
    var t = norm(STATE.tracks[STATE.current]);
    if (t.type === "qq" && t.songid) {
      var embed = "https://i.y.qq.com/n2/m/outchain/player/index.html?songid=" + encodeURIComponent(t.songid) + "&songtype=0";
      return '<iframe class="mf-embed" src="' + embed + '" scrolling="no" border="0" frameborder="no" ' +
        'allowfullscreen="true" allow="autoplay; encrypted-media"></iframe>';
    } else if (t.type === "audio" && t.src) {
      return '<audio class="mf-audio" src="' + esc(t.src) + '" controls autoplay style="width:100%"></audio>';
    } else if (t.type === "qq" && !t.songid) {
      return '<div class="mf-nostage">本曲尚未配置 QQ音乐 songid。<br>' +
        '<a class="btn" href="https://y.qq.com/portal/search.html#t=song&w=' + encodeURIComponent(t.title) + '" target="_blank" rel="noopener">🔍 去 QQ音乐 搜索</a></div>';
    }
    return '<div class="mf-nostage">本曲为外链，点击下方按钮到源站播放。<br>' +
      '<a class="btn" href="' + esc(t.url) + '" target="_blank" rel="noopener">▶ 在源站播放</a></div>';
  }

  function floatHtml() {
    if (!STATE.tracks.length) return "";
    var t = norm(STATE.tracks[STATE.current]);
    var cls = "music-float" + (STATE.mini ? " mini" : "") + (STATE.hidden ? " hidden" : "");
    return '<div id="musicFloat" class="' + cls + '">' +
      '<div class="mf-bar">' +
        coverHtml(t, STATE.current) +
        '<div class="mf-now"><div class="mf-title" id="mfTitle">♪ ' + esc(t.title) + '</div>' +
          '<div class="mf-artist" id="mfArtist">' + esc(t.artist) + '</div></div>' +
        '<div class="mf-mini-info" id="mfMini">' + esc(t.title) + ' - ' + esc(t.artist) + '</div>' +
        '<div class="mf-ctrls">' +
          '<button class="mf-btn" id="mfPrev" title="上一首">⏮</button>' +
          '<button class="mf-btn mf-play" id="mfPlay" title="播放/暂停">▶</button>' +
          '<button class="mf-btn" id="mfNext" title="下一首">⏭</button>' +
        '</div>' +
        '<button class="mf-toggle" id="mfToggle" title="收起/展开">' + (STATE.mini ? "展开 ▲" : "收起 ▼") + '</button>' +
      '</div>' +
      '<div class="mf-stage">' + stageInner() + '</div>' +
    '</div>' +
    '<button id="mfShow" class="mf-show" title="显示音乐播放器" style="display:' + (STATE.hidden ? "flex" : "none") + '">🎵</button>';
  }

  function ensureFloat() {
    if (document.getElementById("musicFloat")) { renderFloatStage(); return; }
    var d = (window.DF && window.DF.getData && window.DF.getData()) || {};
    if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
    if (STATE.current >= STATE.tracks.length) STATE.current = 0;
    if (!STATE.tracks.length) return;
    var w = document.createElement("div"); w.innerHTML = floatHtml();
    document.body.appendChild(w.firstElementChild);
    bindFloat();
  }

  function renderFloatStage() {
    var s = document.getElementById("musicFloat");
    if (s) { var st = s.querySelector(".mf-stage"); if (st) st.innerHTML = stageInner(); }
  }
  function renderFloatMeta() {
    var s = document.getElementById("musicFloat");
    if (!s) return;
    var t = norm(STATE.tracks[STATE.current]);
    var title = s.querySelector("#mfTitle"); if (title) title.textContent = "♪ " + t.title;
    var artist = s.querySelector("#mfArtist"); if (artist) artist.textContent = t.artist;
    var mini = s.querySelector("#mfMini"); if (mini) mini.textContent = t.title + " - " + t.artist;
    var oldCover = s.querySelector(".mf-cover"); if (oldCover) oldCover.outerHTML = coverHtml(t, STATE.current);
  }
  function selectTrack(i, fromView) {
    STATE.current = (i + STATE.tracks.length) % STATE.tracks.length;
    renderFloatStage(); renderFloatMeta();
    // 显示悬浮播放器（若被隐藏）
    var f = document.getElementById("musicFloat");
    if (f) f.classList.remove("hidden");
    var show = document.getElementById("mfShow"); if (show) show.style.display = "none";
    // 同步音乐台视图的播放列表高亮
    if (fromView !== false) {
      var p = document.getElementById("plItems");
      if (p) { p.innerHTML = playlistHtml(); bindPlaylist(); }
      var np = document.getElementById("npTitle"); if (np) np.textContent = norm(STATE.tracks[STATE.current]).title;
    }
  }
  function togglePlay() {
    var f = document.getElementById("musicFloat"); if (!f) return;
    var t = norm(STATE.tracks[STATE.current]);
    if (t.type === "audio" && t.src) {
      var au = f.querySelector("audio.mf-audio");
      if (!au) return;
      if (au.paused) au.play().catch(function () {}); else au.pause();
    } else {
      // QQ 外链 / 外链：展开浮层以显示播放器（iframe 自动播放 / 源站按钮）
      if (STATE.mini) {
        STATE.mini = false;
        f.classList.remove("mini");
        var tg = document.getElementById("mfToggle"); if (tg) tg.textContent = "收起 ▼";
      }
    }
  }

  function bindFloat() {
    var f = document.getElementById("musicFloat"); if (!f) return;
    var prev = document.getElementById("mfPrev"),
        play = document.getElementById("mfPlay"),
        next = document.getElementById("mfNext"),
        toggle = document.getElementById("mfToggle"),
        show = document.getElementById("mfShow");
    if (prev) prev.onclick = function () { selectTrack(STATE.current - 1); };
    if (play) play.onclick = function () { togglePlay(); };
    if (next) next.onclick = function () { selectTrack(STATE.current + 1); };
    if (toggle) toggle.onclick = function () {
      STATE.mini = !STATE.mini;
      f.classList.toggle("mini", STATE.mini);
      toggle.textContent = STATE.mini ? "展开 ▲" : "收起 ▼";
    };
    // 音频播放状态同步到播放按钮
    var au = f.querySelector("audio.mf-audio");
    if (au) {
      au.addEventListener("play", function () { var b = document.getElementById("mfPlay"); if (b) b.textContent = "⏸"; });
      au.addEventListener("pause", function () { var b = document.getElementById("mfPlay"); if (b) b.textContent = "▶"; });
    }
    if (show) show.onclick = function () { f.classList.remove("hidden"); show.style.display = "none"; if (!document.getElementById("musicFloat")) ensureFloat(); };
  }
  function bindPlaylist() {
    document.querySelectorAll("#plItems .pl-item").forEach(function (el) {
      el.onclick = function () { selectTrack(+el.getAttribute("data-i")); };
    });
  }

  /* ---------- 音乐台视图（只展示列表 + 当前曲目） ---------- */
  function musicHtml(D) {
    var d = (D && D.getData && D.getData()) || {};
    if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
    if (STATE.current >= STATE.tracks.length) STATE.current = 0;
    var t = norm(STATE.tracks[STATE.current] || {});
    return '<div class="section-title">🎵 音乐台</div>' +
      '<div class="music-intro">收录《三角洲行动》OST 与主题曲，使用 QQ音乐外链播放器在页面内直接播放（像 QQ音乐一样）。' +
      '切换其它页面时，右下角的悬浮播放器会<b>继续播放</b>，不会中断。</div>' +
      '<div class="music-now"><div class="mn-cover">' + (STATE.tracks.length ? coverHtml(t, STATE.current) : "") + "</div>" +
        '<div class="mn-info"><div class="mn-title" id="npTitle">' + esc(t.title || "暂无曲目") + "</div>" +
        '<div class="mn-artist">' + esc(t.artist || "") + "</div>" +
        '<div class="mn-tip">▶ 正在悬浮播放器播放，可在右下角控制。</div></div></div>' +
      '<div class="music-layout"><div class="music-list"><div class="music-list-head">播放列表 · ' + STATE.tracks.length + " 首</div>" +
        '<div id="plItems">' + playlistHtml() + "</div></div></div>";
  }
  function musicInit(D) {
    bindPlaylist();
    // 视图挂载后确保悬浮播放器存在
    if (!document.getElementById("musicFloat")) ensureFloat();
  }

  function reg(D) {
    var data = D.getData() || {};
    if (data.music && data.music.length) STATE.tracks = data.music.map(norm);
    D.VIEWS.music = { html: function () { return musicHtml(D); }, init: function () { musicInit(D); } };
    D.MENU.push({ group: "娱乐", items: [{ route: "music", label: "音乐台", ico: "🎵" }] });
  }
  if (window.DF) { reg(window.DF); }
  else { (window.__df_plugins = window.__df_plugins || []).push(function (D) { reg(D); }); }
  // 数据加载完成后，全站构建悬浮播放器（跨页常驻）
  window.addEventListener("df:data", function () {
    try {
      var d = (window.DF && window.DF.getData && window.DF.getData()) || {};
      if (!STATE.tracks.length && d.music && d.music.length) STATE.tracks = d.music.map(norm);
      if (STATE.current >= STATE.tracks.length) STATE.current = 0;
      if (!document.getElementById("musicFloat")) ensureFloat();
    } catch (e) {}
  });
})();
