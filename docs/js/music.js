/* =========================================================
 * music.js — 音乐台：汇总 QQ音乐 / Bilibili / 网易云 等外链
 * 点击后在新标签页播放三角洲行动相关音乐，避免版权问题。
 * 在 data.json 的 music 数组里可自由增删链接。
 * ========================================================= */
(function () {
  "use strict";

  var DEFAULT_TRACKS = [
    { title: "三角洲行动 官方主题曲", source: "Bilibili", url: "https://www.bilibili.com/video/BV1yH4y1c7ZA", icon: "📺", desc: "官方宣传/主题曲视频" },
    { title: "三角洲行动 大厅BGM", source: "QQ音乐", url: "https://y.qq.com/n/ryqq/search?w=三角洲行动", icon: "🎵", desc: "在 QQ音乐 搜索收听" },
    { title: "三角洲行动 枪声/战斗配乐", source: "Bilibili", url: "https://search.bilibili.com/all?keyword=三角洲行动%20BGM", icon: "📺", desc: "B站搜索合集" },
    { title: "三角洲行动 原声/OST", source: "网易云音乐", url: "https://music.163.com/#/search/m/?s=三角洲行动", icon: "☁", desc: "网易云搜索试听" }
  ];

  var STATE = { tracks: DEFAULT_TRACKS.slice(), lastPlayed: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function sourceColor(source) {
    if (source === "Bilibili") return "#fb7299";
    if (source === "QQ音乐") return "#31c27c";
    if (source === "网易云音乐") return "#c20c0c";
    return "#19c3a6";
  }

  function playTrack(i) {
    var t = STATE.tracks[i]; if (!t || !t.url) return;
    STATE.lastPlayed = i;
    try { window.open(t.url, "_blank", "noopener,noreferrer"); } catch (e) { location.href = t.url; }
    refreshMiniBar();
  }

  function miniBarHtml() {
    var t = STATE.lastPlayed !== null ? STATE.tracks[STATE.lastPlayed] : null;
    return '<div id="musicBar" class="music-bar">' +
      '<div class="mb-meta">' +
        '<div class="mb-title">' + (t ? "♪ " + esc(t.title) : "音乐台") + '</div>' +
        '<div class="mb-sub">' + (t ? esc(t.source) : "点击曲目外链播放") + '</div>' +
      '</div>' +
      '<button class="mb-btn mb-open" id="mbOpen" title="打开音乐台">🎵</button>' +
    '</div>';
  }
  function buildBar() {
    if (document.getElementById("musicBar")) return;
    var bar = document.createElement("div"); bar.innerHTML = miniBarHtml();
    document.body.appendChild(bar.firstElementChild);
    document.getElementById("mbOpen").addEventListener("click", function () {
      if (window.DF) window.DF.navigate("music");
    });
  }
  function refreshMiniBar() {
    var bar = document.getElementById("musicBar"); if (!bar) return;
    bar.outerHTML = miniBarHtml();
    document.getElementById("mbOpen").addEventListener("click", function () {
      if (window.DF) window.DF.navigate("music");
    });
  }

  function musicHtml(D) {
    var rows = STATE.tracks.map(function (t, i) {
      var c = sourceColor(t.source);
      return '<div class="song-row" data-i="' + i + '">' +
        '<span class="song-play" style="background:' + c + '">▶</span>' +
        '<div class="song-info">' +
          '<div class="song-name">' + esc(t.title) + '</div>' +
          '<div class="song-sub">' + esc(t.icon || "🎧") + ' ' + esc(t.source) + ' · ' + esc(t.desc || "外链播放") + '</div>' +
        '</div>' +
        '<span class="song-source" style="color:' + c + '">' + esc(t.source) + '</span>' +
      '</div>';
    }).join("");
    return '<div class="section-title">🎵 音乐台</div>' +
      '<div class="card music-intro">以下音乐链接指向 QQ音乐、Bilibili、网易云音乐等第三方平台，' +
      '点击即可在新标签页收听《三角洲行动》相关音乐与视频，本站不托管任何音频文件。</div>' +
      '<div class="song-list">' + rows + '</div>';
  }
  function musicInit(D) {
    document.querySelectorAll(".song-row").forEach(function (el) {
      el.addEventListener("click", function () { playTrack(+el.getAttribute("data-i")); });
    });
  }

  function reg(D) {
    var data = D.getData() || {};
    if (data.music && data.music.length) {
      STATE.tracks = data.music.map(function (m) {
        return {
          title: m.title || "未命名曲目",
          source: m.source || "外部链接",
          url: m.url || "#",
          icon: m.icon || "🎵",
          desc: m.desc || "点击外链播放"
        };
      });
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
