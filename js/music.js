/* =========================================================
 * music.js — 悬浮常驻音乐播放器
 * 关键：播放器 DOM 挂在 document.body 上（不在视图片段里），
 *       因此切换页面（preview.innerHTML 被替换）时播放不会中断。
 * 数据来源：data.json 的 music 数组（外链，如网易云/QQ音乐外链）。
 * ========================================================= */
(function () {
  "use strict";

  var STATE = { built: false, tracks: [], current: 0, hidden: false, playing: false };

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;");
  }
  function trackUrl(t) {
    if (!t) return "";
    return t.url || t.link || t.src || "";
  }

  function floatHtml() {
    return '' +
      '<div class="mf-bar">' +
        '<div class="mf-cover">🎵</div>' +
        '<div class="mf-meta">' +
          '<div class="mf-title" id="mfTitle">未播放</div>' +
          '<div class="mf-sub" id="mfSub">点列表里的歌开始播放</div>' +
        '</div>' +
        '<div class="mf-ctrls">' +
          '<button class="mf-btn" id="mfPrev" title="上一首">⏮</button>' +
          '<button class="mf-btn" id="mfToggle" title="展开/收起">▾</button>' +
          '<button class="mf-btn" id="mfHide" title="隐藏播放器">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="mf-stage" id="mfStage"><div class="mf-empty">还没有选择歌曲</div></div>' +
      '<button class="mf-show" id="mfShow" title="显示播放器" hidden>🎵</button>';
  }

  function ensureFloat() {
    if (STATE.built) return;
    var el = document.createElement("div");
    el.id = "musicFloat";
    el.className = "music-float";
    el.innerHTML = floatHtml();
    document.body.appendChild(el);
    bindFloat();
    STATE.built = true;
    // 不在加载时自动播放，等用户在「音乐台」点击曲目
  }

  function bindFloat() {
    document.getElementById("mfHide").addEventListener("click", function () {
      STATE.hidden = true;
      document.getElementById("musicFloat").classList.add("hidden");
      document.getElementById("mfShow").hidden = false;
    });
    document.getElementById("mfShow").addEventListener("click", function () {
      STATE.hidden = false;
      document.getElementById("musicFloat").classList.remove("hidden");
      document.getElementById("mfShow").hidden = true;
    });
    document.getElementById("mfToggle").addEventListener("click", function () {
      document.getElementById("musicFloat").classList.toggle("expanded");
    });
    document.getElementById("mfPrev").addEventListener("click", function () {
      if (STATE.tracks.length) selectTrack(STATE.current - 1);
    });
  }

  function selectTrack(i, silent) {
    if (!STATE.tracks.length) return;
    STATE.current = (i % STATE.tracks.length + STATE.tracks.length) % STATE.tracks.length;
    STATE.playing = true;
    try { localStorage.setItem("di-music-current", String(STATE.current)); } catch (e) {}

    var t = STATE.tracks[STATE.current];
    var titleEl = document.getElementById("mfTitle");
    var subEl = document.getElementById("mfSub");
    if (titleEl) titleEl.textContent = t.name || "未命名";
    if (subEl) subEl.textContent = t.artist || (t.src || "");

    var mn = document.getElementById("mnName");
    if (mn) mn.textContent = (t.name || "") + (t.artist ? " — " + t.artist : "");

    var stage = document.getElementById("mfStage");
    if (stage) {
      var u = trackUrl(t);
      if (u && /\.(mp3|m4a|ogg|wav|aac)(\?|$)/i.test(u)) {
        stage.innerHTML = '<audio controls autoplay src="' + escAttr(u) + '"></audio>';
      } else if (u) {
        stage.innerHTML = '<iframe allow="autoplay" scrolling="no" frameborder="0" src="' + escAttr(u) + '"></iframe>';
      } else {
        stage.innerHTML = '<div class="mf-empty">该曲目没有可播放的外链</div>';
      }
    }

    document.querySelectorAll(".pl-item").forEach(function (x, idx) {
      x.classList.toggle("active", idx === STATE.current);
    });
  }

  // 来自音乐台视图：同步播放列表（不自动加载，避免重启播放）
  window.addEventListener("music:render", function (e) {
    STATE.tracks = e.detail || [];
    ensureFloat();
    if (!STATE.playing) return;
    document.querySelectorAll(".pl-item").forEach(function (x, idx) {
      x.classList.toggle("active", idx === STATE.current);
    });
  });
  // 用户点击播放列表切歌
  window.addEventListener("music:select", function (e) {
    ensureFloat();
    selectTrack(e.detail);
  });
  // 数据就绪：预建悬浮条（不自动播放，等用户点歌）
  window.addEventListener("app:data", function (e) {
    var m = (e.detail && e.detail.music) || [];
    if (m.length) {
      STATE.tracks = m;
      var saved = 0;
      try { saved = parseInt(localStorage.getItem("di-music-current") || "0", 10); } catch (err) {}
      if (saved >= 0 && saved < m.length) STATE.current = saved;
      ensureFloat();
    }
  });
})();
