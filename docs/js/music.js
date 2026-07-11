/* =========================================================
 * music.js — 悬浮音乐播放器 + 音乐台视图
 * 默认用 Web Audio 程序化合成“三角洲风格”曲目（无需任何版权音频文件即可播放）。
 * 若你在仓库根放 audio/<id>.mp3 并在 data.json 的 music 里写 file 字段，会自动改用真实音轨。
 * ========================================================= */
(function () {
  "use strict";

  var BUILTIN = [
    { title: "战区序曲", bpm: 84, wave: "sine", root: 220, scale: [0, 3, 5, 7, 10, 12], bass: [0, 0, 7, 5], virtualSec: 110, mood: "calm" },
    { title: "行动准备", bpm: 104, wave: "triangle", root: 233, scale: [0, 2, 3, 7, 9, 12], bass: [0, 0, 5, 7], virtualSec: 95, mood: "tense" },
    { title: "交火", bpm: 140, wave: "sawtooth", root: 196, scale: [0, 1, 3, 6, 7, 10], bass: [0, 0, 0, 7], virtualSec: 80, mood: "intense" },
    { title: "撤离成功", bpm: 120, wave: "square", root: 262, scale: [0, 4, 7, 9, 12, 16], bass: [0, 7, 0, 7], virtualSec: 90, mood: "triumph" },
    { title: "静默潜入", bpm: 70, wave: "sine", root: 174, scale: [0, 3, 5, 8, 10], bass: [0, null, 5, null], virtualSec: 120, mood: "ambient" },
    { title: "结算界面", bpm: 96, wave: "triangle", root: 246, scale: [0, 2, 4, 7, 9, 11], bass: [0, 4, 7, 4], virtualSec: 100, mood: "mellow" }
  ];

  var STATE = { tracks: BUILTIN.slice(), idx: 0, playing: false, volume: 0.7, mode: "synth", audioEl: null };
  var ctx = null, master = null, timer = null, nextTime = 0, step = 0, startedAt = 0, lastElapsed = 0;
  var melodies = {};

  function ensureCtx() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = STATE.volume; master.connect(ctx.destination); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function seedMelody(seed, len, scale, density) {
    var arr = [], s = seed >>> 0;
    for (var i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var r = s / 0x7fffffff;
      if (r < density) arr.push(scale[s % scale.length]); else arr.push(null);
    }
    return arr;
  }
  function freq(root, semi) { return root * Math.pow(2, semi / 12); }
  function beep(f, time, dur, wave, amp) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave || "sine"; o.frequency.value = f; o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(amp, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.start(time); o.stop(time + dur + 0.03);
  }
  function curTrack() { return STATE.tracks[STATE.idx]; }

  function buildMelody(t, i) {
    if (!melodies[i]) melodies[i] = seedMelody((i + 1) * 97 + t.bpm, 32, t.scale, t.mood === "intense" ? 0.6 : t.mood === "ambient" ? 0.3 : 0.45);
    return melodies[i];
  }

  function stopSynth() { if (timer) { clearInterval(timer); timer = null; } }
  function startSynth() {
    if (!ensureCtx()) return;
    stopSynth();
    var t = curTrack();
    nextTime = ctx.currentTime + 0.1; step = 0; startedAt = ctx.currentTime; lastElapsed = 0;
    var spb = 60 / t.bpm / 4;
    timer = setInterval(function () {
      while (nextTime < ctx.currentTime + 0.12) {
        var mel = buildMelody(t, STATE.idx);
        var m = mel[step % mel.length];
        if (m !== null) beep(freq(t.root, m), nextTime, spb * 0.9, t.wave, 0.16);
        if (step % 4 === 0) {
          var bn = t.bass[(step / 4) % t.bass.length];
          if (bn !== null) beep(freq(t.root / 2, bn), nextTime, spb * 3.4, "sine", 0.22);
        }
        nextTime += spb; step++;
      }
      var el = ctx.currentTime - startedAt;
      if (el >= t.virtualSec) { startedAt = ctx.currentTime; next(); }
    }, 25);
  }

  function stopAudio() { if (STATE.audioEl) { try { STATE.audioEl.pause(); } catch (e) {} STATE.audioEl = null; } }
  function useFile(t) {
    if (!t.file) return false;
    try {
      var a = new Audio("audio/" + t.file);
      a.loop = false; a.volume = STATE.volume;
      a.addEventListener("ended", function () { next(); });
      a.addEventListener("error", function () { /* 文件缺失，回落合成 */ });
      STATE.audioEl = a; a.play().catch(function () {});
      STATE.mode = "file"; return true;
    } catch (e) { return false; }
  }

  function play() {
    var t = curTrack();
    STATE.playing = true;
    if (useFile(t)) { STATE.mode = "file"; }
    else { STATE.mode = "synth"; startSynth(); }
    refreshBar();
  }
  function pause() {
    STATE.playing = false;
    stopSynth(); stopAudio();
    refreshBar();
  }
  function toggle() { STATE.playing ? pause() : play(); }
  function next() {
    stopSynth(); stopAudio();
    STATE.idx = (STATE.idx + 1) % STATE.tracks.length;
    if (STATE.playing) play(); else refreshBar();
  }
  function prev() {
    stopSynth(); stopAudio();
    STATE.idx = (STATE.idx - 1 + STATE.tracks.length) % STATE.tracks.length;
    if (STATE.playing) play(); else refreshBar();
  }
  function selectTrack(i) {
    stopSynth(); stopAudio();
    STATE.idx = i; play();
  }
  function setVolume(v) {
    STATE.volume = v;
    if (master) master.gain.value = v;
    if (STATE.audioEl) STATE.audioEl.volume = v;
  }

  /* ---------- 悬浮播放条 ---------- */
  function buildBar() {
    if (document.getElementById("musicBar")) return;
    var bar = document.createElement("div");
    bar.id = "musicBar"; bar.className = "music-bar";
    bar.innerHTML =
      '<button class="mb-btn" id="mbPrev" title="上一首">⏮</button>' +
      '<button class="mb-btn mb-play" id="mbPlay" title="播放/暂停">▶</button>' +
      '<button class="mb-btn" id="mbNext" title="下一首">⏭</button>' +
      '<div class="mb-meta"><div class="mb-title" id="mbTitle">未播放</div><div class="mb-sub">三角洲情报台 · 音乐台</div></div>' +
      '<div class="mb-progress" id="mbProg"><div class="mb-fill" id="mbFill"></div></div>' +
      '<input type="range" id="mbVol" min="0" max="100" value="70" title="音量">' +
      '<button class="mb-btn mb-open" id="mbOpen" title="打开音乐台">🎵</button>';
    document.body.appendChild(bar);
    document.getElementById("mbPlay").addEventListener("click", toggle);
    document.getElementById("mbPrev").addEventListener("click", prev);
    document.getElementById("mbNext").addEventListener("click", next);
    document.getElementById("mbVol").addEventListener("input", function () { setVolume(+this.value / 100); });
    document.getElementById("mbOpen").addEventListener("click", function () {
      if (window.DF) window.DF.navigate("music");
    });
    setInterval(refreshBar, 250);
  }
  function refreshBar() {
    var bar = document.getElementById("musicBar"); if (!bar) return;
    var t = curTrack();
    document.getElementById("mbTitle").textContent = (STATE.playing ? "♪ " : "") + (t ? t.title : "—");
    document.getElementById("mbPlay").textContent = STATE.playing ? "⏸" : "▶";
    var p = 0;
    if (STATE.playing) {
      if (STATE.mode === "file" && STATE.audioEl && STATE.audioEl.duration) p = STATE.audioEl.currentTime / STATE.audioEl.duration;
      else if (ctx) p = ((ctx.currentTime - startedAt) % (t ? t.virtualSec : 100)) / (t ? t.virtualSec : 100);
    }
    document.getElementById("mbFill").style.width = Math.max(0, Math.min(100, p * 100)) + "%";
  }

  /* ---------- 音乐台视图 ---------- */
  function musicHtml(D) {
    var tracks = STATE.tracks;
    var rows = tracks.map(function (t, i) {
      return '<div class="song-row' + (i === STATE.idx ? " active" : "") + '" data-i="' + i + '">' +
        '<button class="song-play">' + (i === STATE.idx && STATE.playing ? "⏸" : "▶") + "</button>" +
        '<div class="song-info"><div class="song-name">' + D.esc(t.title) + '</div><div class="song-sub">' + (t.mood || "synth") + " · " + t.bpm + " BPM</div></div>" +
        '<span class="song-wave">' + (t.wave || "sine") + "</span></div>";
    }).join("");
    return '<div class="section-title">🎵 音乐台</div>' +
      '<div class="card music-intro">用 Web Audio 实时合成三角洲风格氛围音乐，无需任何版权音频即可播放。' +
      '想换成游戏原声？把 mp3 放到仓库 <code>audio/</code> 目录，并在 <code>data.json</code> 的 <code>music</code> 数组里给对应曲目加 <code>"file":"xxx.mp3"</code> 即可自动切换。</div>' +
      '<div class="song-list">' + rows + "</div>";
  }
  function musicInit(D) {
    document.querySelectorAll(".song-row").forEach(function (el) {
      el.addEventListener("click", function () { selectTrack(+el.getAttribute("data-i")); D.render("music"); });
    });
  }

  function reg(D) {
    // 允许 data.json 覆盖曲目
    var data = D.getData() || {};
    if (data.music && data.music.length) {
      // 仅保留带合成参数的（file 仅作真实音轨开关）
      STATE.tracks = data.music.map(function (m, i) {
        return {
          title: m.title || ("曲目 " + (i + 1)),
          bpm: m.bpm || 100, wave: m.wave || "sine", root: m.root || 220,
          scale: m.scale || [0, 3, 5, 7, 10, 12], bass: m.bass || [0, 0, 7, 5],
          virtualSec: m.virtualSec || 100, mood: m.mood || "synth", file: m.file || null
        };
      });
    }
    D.VIEWS.music = { html: function () { return musicHtml(D); }, init: function () { musicInit(D); } };
    D.MENU.push({ group: "娱乐", items: [{ route: "music", label: "音乐台", ico: "🎵" }] });
  }

  // 全局播放条（与视图无关，随时可播放）
  function boot() {
    buildBar();
    window.DFmusic = { play: play, pause: pause, toggle: toggle, next: next, prev: prev, select: selectTrack, setVolume: setVolume };
  }
  if (window.DF) { reg(window.DF); boot(); }
  else {
    (window.__df_plugins = window.__df_plugins || []).push(function (D) { reg(D); });
    // 播放条不依赖 DF，直接初始化
    if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
  }
})();
