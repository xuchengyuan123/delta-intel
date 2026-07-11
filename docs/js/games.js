/* =========================================================
 * games.js — 三角洲小游戏二合一
 *   1) 数字摩斯密码：像原站截图一样，三位/四位密码，听摩斯音用数字键盘输入
 *   2) 指纹选择：从候选指纹中选出正确的那一枚
 * ========================================================= */
(function () {
  "use strict";

  var MORSE_NUM = {
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
  };

  var CONFIG = {
    len: 3,           // 3 或 4
    loop: true,
    timed: false,
    bgmVol: 30,
    morseVol: 40,
    time: 60
  };

  var GAME = {
    tab: "morse",     // morse | fingerprint
    running: false,
    score: 0, streak: 0, best: 0,
    answer: "",       // 当前正确答案
    input: "",        // 当前输入
    timeLeft: 0,
    timer: null, loopTimer: null,
    bgmOsc: null, bgmGain: null,
    // 指纹
    fpTarget: 0,      // 正确候选索引
    fpPicked: []      // 已选记录
  };

  /* ---------- 音频上下文 ---------- */
  var actx = null;
  function ensureCtx() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { alert("当前浏览器不支持音频，无法玩摩斯密码。"); return null; }
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }

  function beep(tone, duration, vol, type) {
    var ctx = ensureCtx(); if (!ctx) return;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = tone;
    osc.connect(gain); gain.connect(ctx.destination);
    var now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now); osc.stop(now + duration + 0.03);
  }

  function playMorseNum(str) {
    var ctx = ensureCtx(); if (!ctx) return;
    var unit = 0.18; // 每个点 0.18s
    var now = ctx.currentTime + 0.05;
    var vol = CONFIG.morseVol / 100;
    var tone = 880;
    for (var i = 0; i < str.length; i++) {
      var code = MORSE_NUM[str[i]] || "";
      for (var j = 0; j < code.length; j++) {
        var dur = code[j] === "." ? unit : unit * 3;
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = tone;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.start(now); osc.stop(now + dur + 0.02);
        now += dur + unit;
      }
      now += unit * 2; // 数字之间停顿
    }
  }

  /* BGM：持续低音嗡鸣 + 节奏 */
  function startBgm() {
    stopBgm();
    var ctx = ensureCtx(); if (!ctx) return;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = 110;
    gain.gain.value = (CONFIG.bgmVol / 100) * 0.12;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); GAME.bgmOsc = osc; GAME.bgmGain = gain;
  }
  function stopBgm() {
    if (GAME.bgmOsc) { try { GAME.bgmOsc.stop(); } catch (e) {} GAME.bgmOsc = null; }
    GAME.bgmGain = null;
  }
  function updateBgmVolume() {
    if (GAME.bgmGain) GAME.bgmGain.gain.value = (CONFIG.bgmVol / 100) * 0.12;
  }

  /* ---------- 数字摩斯密码 ---------- */
  function genCode() {
    var s = "";
    for (var i = 0; i < CONFIG.len; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function startMorseGame() {
    if (GAME.running) return;
    GAME.running = true;
    GAME.score = 0; GAME.streak = 0; GAME.input = ""; GAME.answer = "";
    GAME.timeLeft = +CONFIG.time;
    startBgm();
    nextMorseCode();
    if (CONFIG.timed) startCountdown();
    renderMorse();
  }
  function stopMorseGame() {
    GAME.running = false;
    stopBgm();
    clearInterval(GAME.timer); GAME.timer = null;
    clearTimeout(GAME.loopTimer); GAME.loopTimer = null;
    renderMorse();
  }
  function nextMorseCode() {
    if (!GAME.running) return;
    GAME.answer = genCode();
    GAME.input = "";
    playMorseNum(GAME.answer);
    if (CONFIG.loop) {
      clearTimeout(GAME.loopTimer);
      GAME.loopTimer = setTimeout(function loop() {
        if (GAME.running) { playMorseNum(GAME.answer); GAME.loopTimer = setTimeout(loop, Math.max(2000, GAME.answer.length * 800)); }
      }, Math.max(2000, GAME.answer.length * 800));
    }
    if (GAME.best < GAME.score) GAME.best = GAME.score;
    renderMorse();
  }
  function startCountdown() {
    clearInterval(GAME.timer);
    GAME.timer = setInterval(function () {
      GAME.timeLeft--;
      if (GAME.timeLeft <= 0) { stopMorseGame(); }
      renderMorse();
    }, 1000);
  }
  function inputDigit(d) {
    if (!GAME.running || GAME.input.length >= CONFIG.len) return;
    GAME.input += d;
    if (GAME.input.length === CONFIG.len) {
      if (GAME.input === GAME.answer) {
        GAME.streak++; GAME.score += 10 + GAME.streak * 2;
        beep(1200, 0.15, 0.3, "sine");
        setTimeout(nextMorseCode, 400);
      } else {
        GAME.streak = 0;
        beep(200, 0.3, 0.3, "sawtooth");
        setTimeout(function () { GAME.input = ""; renderMorse(); }, 600);
      }
    }
    renderMorse();
  }
  function backspace() {
    if (!GAME.running) return;
    GAME.input = GAME.input.slice(0, -1); renderMorse();
  }

  /* ---------- 指纹选择 ---------- */
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function startFpGame() {
    GAME.fpTarget = rand(0, 5); // 0..5 候选
    GAME.fpPicked = [];
    renderFp();
  }
  function pickFp(idx) {
    if (GAME.fpPicked.indexOf(idx) > -1) return;
    GAME.fpPicked.push(idx);
    if (idx === GAME.fpTarget) {
      GAME.streak++; GAME.score += 15 + GAME.streak * 2;
      beep(1200, 0.15, 0.3, "sine");
      setTimeout(startFpGame, 500);
    } else {
      GAME.streak = 0;
      beep(200, 0.3, 0.3, "sawtooth");
      renderFp();
    }
    renderFp();
  }

  /* ---------- 渲染 ---------- */
  function html(D) { return D.esc ? D.esc : function (s) { return String(s); }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function morsePanel() {
    var inputs = "";
    for (var i = 0; i < CONFIG.len; i++) {
      var v = GAME.input[i] || "";
      inputs += '<div class="morse-input-box ' + (v ? "filled" : "") + '">' + esc(v) + '</div>';
    }
    var keypad = "";
    for (var d = 1; d <= 9; d++) {
      keypad += '<button class="numkey" data-d="' + d + '">' + d + '</button>';
    }
    keypad += '<button class="numkey numkey-wide" data-d="0">0</button>';
    keypad += '<button class="numkey numkey-wide" id="mgBack">⌫</button>';

    var status = GAME.running
      ? '⏱ ' + GAME.timeLeft + 's · 得分 <b>' + GAME.score + '</b> · 连击 <b>' + GAME.streak + '</b> · 最高 <b>' + GAME.best + '</b>'
      : '点击「开始挑战」开始游戏';

    return '<div class="morse-game">' +
      '<div class="morse-config">' +
        '<div class="cfg-row"><label>摩斯密码长度</label>' +
          '<label class="radio"><input type="radio" name="mgLen" value="3" ' + (CONFIG.len === 3 ? "checked" : "") + '> 三位摩斯密码</label>' +
          '<label class="radio"><input type="radio" name="mgLen" value="4" ' + (CONFIG.len === 4 ? "checked" : "") + '> 四位摩斯密码</label></div>' +
        '<div class="cfg-row"><label>自定义设定</label>' +
          '<label class="checkbox"><input type="checkbox" id="mgLoop" ' + (CONFIG.loop ? "checked" : "") + '> 循环播放摩斯密码</label>' +
          '<label class="checkbox"><input type="checkbox" id="mgTimed" ' + (CONFIG.timed ? "checked" : "") + '> 限时挑战</label></div>' +
        '<div class="cfg-row"><label>BGM音频音量</label><input type="range" id="bgmVol" min="0" max="100" value="' + CONFIG.bgmVol + '"><span class="val">' + CONFIG.bgmVol + '</span></div>' +
        '<div class="cfg-row"><label>摩斯音频音量</label><input type="range" id="morseVol" min="0" max="100" value="' + CONFIG.morseVol + '"><span class="val">' + CONFIG.morseVol + '</span></div>' +
        '<div class="cfg-row"><label>挑战时间 (秒)</label><input type="range" id="mgTime" min="10" max="120" value="' + CONFIG.time + '"><span class="val">' + CONFIG.time + '</span></div>' +
      '</div>' +
      '<div class="morse-actions">' +
        '<button class="btn-primary" id="mgStart">开始挑战</button>' +
        '<button class="btn-ghost" id="mgStop">停止挑战</button>' +
      '</div>' +
      '<div class="morse-screen">' +
        '<div class="morse-status">' + status + '</div>' +
        '<div class="morse-answer-row">' + inputs + '</div>' +
        '<div class="morse-hint">' + (GAME.running ? '正在播放摩斯音，请输入对应数字' : '请输入密码') + '</div>' +
      '</div>' +
      '<div class="numkeypad">' + keypad + '</div>' +
    '</div>';
  }

  function fingerprintSVG(seed) {
    var s = '<svg viewBox="0 0 220 260" class="fp-svg">';
    // 外轮廓
    s += '<ellipse cx="110" cy="130" rx="85" ry="110" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"/>';
    // 纹路（按 seed 生成一些随机弧）
    for (var i = 0; i < 28; i++) {
      var ry = 30 + i * 5;
      var rx = 40 + i * 4;
      var cy = 130 + (i % 2 === 0 ? -1 : 1) * (i * 1.5);
      var sw = 1 + (i % 3) * 0.5;
      s += '<ellipse cx="110" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" stroke="rgba(255,255,255,.18)" stroke-width="' + sw + '" fill="none"/>';
    }
    // 分叉点
    for (var k = 0; k < 5; k++) {
      var ang = (k * 72 + seed * 17) * Math.PI / 180;
      var r = 55 + (k % 3) * 15;
      var x = 110 + Math.cos(ang) * r;
      var y = 130 + Math.sin(ang) * r * 0.8;
      s += '<rect x="' + (x - 9) + '" y="' + (y - 9) + '" width="18" height="18" rx="2" stroke="#19c3a6" stroke-width="1.5" fill="rgba(0,0,0,.35)"/>';
      s += '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" fill="#19c3a6" font-size="11" font-weight="700">' + (k + 1) + '</text>';
    }
    s += '</svg>';
    return s;
  }
  function miniFingerprintSVG(idx) {
    return '<svg viewBox="0 0 60 80" class="fp-mini">' +
      '<ellipse cx="30" cy="40" rx="24" ry="32" stroke="rgba(255,255,255,.2)" stroke-width="1" fill="none"/>' +
      '<ellipse cx="30" cy="40" rx="16" ry="24" stroke="rgba(255,255,255,.15)" stroke-width="1" fill="none"/>' +
      '<ellipse cx="30" cy="40" rx="8" ry="16" stroke="rgba(255,255,255,.12)" stroke-width="1" fill="none"/>' +
      '</svg>';
  }
  function fpPanel() {
    var candidates = "";
    for (var i = 0; i < 6; i++) {
      var wrong = GAME.fpPicked.indexOf(i) > -1 && i !== GAME.fpTarget;
      var right = GAME.fpPicked.indexOf(i) > -1 && i === GAME.fpTarget;
      candidates += '<div class="fp-candidate" data-i="' + i + '">' + miniFingerprintSVG(i) +
        '<div class="fp-cand-label">候选 ' + (i + 1) + '</div>' +
        (wrong ? '<div class="fp-x">✗</div>' : '') +
        (right ? '<div class="fp-check">✓</div>' : '') +
      '</div>';
    }
    return '<div class="fp-game">' +
      '<div class="fp-left">' +
        '<div class="fp-avatar"></div>' +
        '<div class="fp-role">未知角色</div>' +
        '<div class="fp-meta">N.145672_x0000D_</div>' +
        '<div class="fp-meta">>>_x000D_</div>' +
        '<div class="fp-meta">生物识别信息___</div>' +
      '</div>' +
      '<div class="fp-center">' +
        '<div class="fp-title">等待开始挑战…</div>' +
        '<div class="fp-print">' + fingerprintSVG(GAME.fpTarget) + '</div>' +
      '</div>' +
      '<div class="fp-right">' +
        '<div class="fp-right-title">>> 请选择正确的指纹___</div>' +
        '<div class="fp-candidates">' + candidates + '</div>' +
      '</div>' +
    '</div>';
  }

  function gamesHtml(D) {
    return '<div class="section-title">三角洲小游戏</div>' +
      '<div class="seg">' +
        '<button class="seg-btn' + (GAME.tab === "morse" ? " active" : "") + '" data-tab="morse">📟 数字摩斯密码</button>' +
        '<button class="seg-btn' + (GAME.tab === "fingerprint" ? " active" : "") + '" data-tab="fingerprint">🖐 指纹选择</button>' +
      '</div>' +
      '<div id="gamePanel"></div>';
  }
  function gamesInit(D) {
    document.querySelectorAll(".seg-btn[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { GAME.tab = b.getAttribute("data-tab"); D.render("games"); });
    });
    var panel = document.getElementById("gamePanel");
    if (GAME.tab === "morse") {
      panel.innerHTML = morsePanel();
      bindMorseConfig();
      bindMorseGame();
    } else {
      panel.innerHTML = fpPanel();
      bindFpGame();
    }
  }
  function bindMorseConfig() {
    document.querySelectorAll('input[name="mgLen"]').forEach(function (r) {
      r.addEventListener("change", function () { CONFIG.len = +r.value; });
    });
    document.getElementById("mgLoop").addEventListener("change", function () { CONFIG.loop = this.checked; });
    document.getElementById("mgTimed").addEventListener("change", function () { CONFIG.timed = this.checked; });
    document.getElementById("bgmVol").addEventListener("input", function () { CONFIG.bgmVol = +this.value; updateBgmVolume(); renderMorse(); });
    document.getElementById("morseVol").addEventListener("input", function () { CONFIG.morseVol = +this.value; renderMorse(); });
    document.getElementById("mgTime").addEventListener("input", function () { CONFIG.time = +this.value; renderMorse(); });
  }
  function bindMorseGame() {
    document.getElementById("mgStart").addEventListener("click", startMorseGame);
    document.getElementById("mgStop").addEventListener("click", stopMorseGame);
    document.querySelectorAll(".numkey").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = b.getAttribute("data-d");
        if (d) inputDigit(d);
      });
    });
    document.getElementById("mgBack").addEventListener("click", backspace);
  }
  function bindFpGame() {
    document.querySelectorAll(".fp-candidate").forEach(function (el) {
      el.addEventListener("click", function () { pickFp(+el.getAttribute("data-i")); });
    });
  }
  function renderMorse() {
    var panel = document.getElementById("gamePanel"); if (!panel) return;
    panel.innerHTML = morsePanel();
    bindMorseConfig(); bindMorseGame();
  }
  function renderFp() {
    var panel = document.getElementById("gamePanel"); if (!panel) return;
    panel.innerHTML = fpPanel();
    bindFpGame();
  }

  function reg(D) {
    D.VIEWS.games = { html: function () { return gamesHtml(D); }, init: function () { gamesInit(D); } };
    D.MENU.push({ group: "小游戏", items: [{ route: "games", label: "三角洲小游戏", ico: "🎮" }] });
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
