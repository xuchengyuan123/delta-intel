/* =========================================================
 * games.js — 三角洲小游戏（对应 KK日报 的 5 款挑战）
 *   1) 摩斯密码门：听摩斯音，输入对应数字密码
 *   2) 破译电脑：记忆并输入屏幕上闪过的电脑密码
 *   3) 快速反应：绿灯亮起瞬间点击，测反应毫秒
 *   4) 脑机密码门：记忆并重现闪光序列（Simon）
 *   5) 指纹破译：从候选指纹中选出正确的那一枚
 * 全部带计分 / 连击。
 * ========================================================= */
(function () {
  "use strict";

  var MORSE_NUM = {
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
  };
  var GAME = {
    tab: "morse",
    morse: { len: 3, loop: true, timed: false, time: 60, running: false, score: 0, streak: 0, best: 0, answer: "", input: "", timeLeft: 0, timer: null, loopTimer: null, bgmOsc: null, bgmGain: null, bgmVol: 30, morseVol: 40 },
    fp: { target: 0, picked: [], score: 0, streak: 0, best: 0 },
    react: { state: "idle", startedAt: 0, best: 0, last: 0, rounds: 0, sum: 0, timer: null },
    brain: { seq: [], step: 0, input: [], score: 0, streak: 0, best: 0, showing: false },
    pc: { code: "", display: false, input: "", score: 0, streak: 0, best: 0, revealTimer: null }
  };

  /* ---------- 音频 ---------- */
  var actx = null;
  function ensureCtx() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function beep(tone, duration, vol, type) {
    var ctx = ensureCtx(); if (!ctx) return;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || "sine"; osc.frequency.value = tone;
    osc.connect(gain); gain.connect(ctx.destination);
    var now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now); osc.stop(now + duration + 0.03);
  }
  function playMorseNum(str) {
    var ctx = ensureCtx(); if (!ctx) return;
    var unit = 0.18, now = ctx.currentTime + 0.05, vol = GAME.morse.morseVol / 100, tone = 880;
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
      now += unit * 2;
    }
  }
  function startBgm() {
    stopBgm();
    var ctx = ensureCtx(); if (!ctx) return;
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = 110;
    gain.gain.value = (GAME.morse.bgmVol / 100) * 0.12;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); GAME.morse.bgmOsc = osc; GAME.morse.bgmGain = gain;
  }
  function stopBgm() {
    if (GAME.morse.bgmOsc) { try { GAME.morse.bgmOsc.stop(); } catch (e) {} GAME.morse.bgmOsc = null; }
    GAME.morse.bgmGain = null;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function shuffle(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = rand(0, i); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; }

  /* ================= 1. 摩斯密码门 ================= */
  function genCode() { var s = ""; for (var i = 0; i < GAME.morse.len; i++) s += rand(0, 9); return s; }
  function startMorse() {
    var m = GAME.morse; m.running = true; m.score = 0; m.streak = 0; m.input = ""; m.timeLeft = +m.time;
    startBgm(); nextMorse(); if (m.timed) { clearInterval(m.timer); m.timer = setInterval(function () { m.timeLeft--; if (m.timeLeft <= 0) stopMorse(); renderMorse(); }, 1000); } renderMorse();
  }
  function stopMorse() { var m = GAME.morse; m.running = false; stopBgm(); clearInterval(m.timer); clearTimeout(m.loopTimer); renderMorse(); }
  function nextMorse() {
    var m = GAME.morse; if (!m.running) return;
    m.answer = genCode(); m.input = ""; playMorseNum(m.answer);
    if (m.loop) { clearTimeout(m.loopTimer); m.loopTimer = setTimeout(function loop() { if (m.running) { playMorseNum(m.answer); m.loopTimer = setTimeout(loop, Math.max(2000, m.answer.length * 800)); } }, Math.max(2000, m.answer.length * 800)); }
    if (m.best < m.score) m.best = m.score; renderMorse();
  }
  function inputDigit(d) {
    var m = GAME.morse; if (!m.running || m.input.length >= m.len) return;
    m.input += d;
    if (m.input.length === m.len) {
      if (m.input === m.answer) { m.streak++; m.score += 10 + m.streak * 2; beep(1200, 0.15, 0.3); setTimeout(nextMorse, 400); }
      else { m.streak = 0; beep(200, 0.3, 0.3, "sawtooth"); setTimeout(function () { m.input = ""; renderMorse(); }, 600); }
    }
    renderMorse();
  }
  function morsePanel() {
    var m = GAME.morse;
    var inputs = ""; for (var i = 0; i < m.len; i++) { var v = m.input[i] || ""; inputs += '<div class="morse-input-box ' + (v ? "filled" : "") + '">' + esc(v) + '</div>'; }
    var keypad = ""; for (var d = 1; d <= 9; d++) keypad += '<button class="numkey" data-d="' + d + '">' + d + '</button>';
    keypad += '<button class="numkey numkey-wide" data-d="0">0</button><button class="numkey numkey-wide" id="mgBack">⌫</button>';
    var status = m.running ? '⏱ ' + m.timeLeft + 's · 得分 <b>' + m.score + '</b> · 连击 <b>' + m.streak + '</b> · 最高 <b>' + m.best + '</b>' : '点击「开始挑战」开始游戏';
    return '<div class="morse-game">' +
      '<div class="morse-config">' +
        '<div class="cfg-row"><label>密码长度</label>' +
          '<label class="radio"><input type="radio" name="mgLen" value="3" ' + (m.len === 3 ? "checked" : "") + '> 三位</label>' +
          '<label class="radio"><input type="radio" name="mgLen" value="4" ' + (m.len === 4 ? "checked" : "") + '> 四位</label></div>' +
        '<div class="cfg-row"><label>设定</label>' +
          '<label class="checkbox"><input type="checkbox" id="mgLoop" ' + (m.loop ? "checked" : "") + '> 循环播放</label>' +
          '<label class="checkbox"><input type="checkbox" id="mgTimed" ' + (m.timed ? "checked" : "") + '> 限时挑战</label></div>' +
        '<div class="cfg-row"><label>BGM音量</label><input type="range" id="bgmVol" min="0" max="100" value="' + m.bgmVol + '"><span class="val">' + m.bgmVol + '</span></div>' +
        '<div class="cfg-row"><label>摩斯音量</label><input type="range" id="morseVol" min="0" max="100" value="' + m.morseVol + '"><span class="val">' + m.morseVol + '</span></div>' +
        '<div class="cfg-row"><label>挑战秒数</label><input type="range" id="mgTime" min="10" max="120" value="' + m.time + '"><span class="val">' + m.time + '</span></div>' +
      '</div>' +
      '<div class="morse-actions"><button class="btn-primary" id="mgStart">开始挑战</button><button class="btn-ghost" id="mgStop">停止</button></div>' +
      '<div class="morse-screen"><div class="morse-status">' + status + '</div>' +
        '<div class="morse-answer-row">' + inputs + '</div>' +
        '<div class="morse-hint">' + (m.running ? '正在播放摩斯音，请输入对应数字' : '请输入密码') + '</div></div>' +
      '<div class="numkeypad">' + keypad + '</div>' +
    '</div>';
  }
  function bindMorse() {
    document.querySelectorAll('input[name="mgLen"]').forEach(function (r) { r.addEventListener("change", function () { GAME.morse.len = +r.value; }); });
    document.getElementById("mgLoop").addEventListener("change", function () { GAME.morse.loop = this.checked; });
    document.getElementById("mgTimed").addEventListener("change", function () { GAME.morse.timed = this.checked; });
    document.getElementById("bgmVol").addEventListener("input", function () { GAME.morse.bgmVol = +this.value; if (GAME.morse.bgmGain) GAME.morse.bgmGain.gain.value = (GAME.morse.bgmVol / 100) * 0.12; renderMorse(); });
    document.getElementById("morseVol").addEventListener("input", function () { GAME.morse.morseVol = +this.value; renderMorse(); });
    document.getElementById("mgTime").addEventListener("input", function () { GAME.morse.time = +this.value; renderMorse(); });
    document.getElementById("mgStart").addEventListener("click", startMorse);
    document.getElementById("mgStop").addEventListener("click", stopMorse);
    document.querySelectorAll(".numkey").forEach(function (b) { b.addEventListener("click", function () { var d = b.getAttribute("data-d"); if (d) inputDigit(d); }); });
    document.getElementById("mgBack").addEventListener("click", function () { var m = GAME.morse; if (!m.running) return; m.input = m.input.slice(0, -1); renderMorse(); });
  }
  function renderMorse() { var p = document.getElementById("gamePanel"); if (!p) return; p.innerHTML = morsePanel(); bindMorse(); }

  /* ================= 2. 破译电脑 ================= */
  var PC_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function genPcCode() { var s = ""; for (var i = 0; i < 6; i++) s += PC_CHARS[rand(0, PC_CHARS.length - 1)]; return s; }
  function startPc() {
    var c = GAME.pc; c.code = genPcCode(); c.display = true; c.input = ""; c.running = true;
    renderPc();
    clearTimeout(c.revealTimer);
    c.revealTimer = setTimeout(function () { if (GAME.pc.running) { GAME.pc.display = false; renderPc(); } }, 3500);
  }
  function submitPc() {
    var c = GAME.pc; if (!c.running) return;
    if (c.input.toUpperCase() === c.code) { c.streak++; c.score += 20 + c.streak * 3; beep(1200, 0.15, 0.3); }
    else { c.streak = 0; beep(200, 0.3, 0.3, "sawtooth"); }
    if (c.best < c.score) c.best = c.score;
    startPc();
  }
  function pcPanel() {
    var c = GAME.pc;
    var screen = c.display
      ? '<div class="pc-code-show">' + c.code.split("").map(function (ch) { return '<span>' + esc(ch) + '</span>'; }).join("") + '</div><div class="pc-hint">记住这串密码！</div>'
      : '<div class="pc-code-hidden">••••••</div><div class="pc-hint">密码已隐藏，请输入你记住的密码</div>';
    return '<div class="pc-game">' +
      '<div class="pc-terminal"><div class="pc-bar"><span></span><span></span><span></span></div>' +
        '<div class="pc-screen">' + screen + '</div></div>' +
      '<div class="pc-actions"><button class="btn-ghost" id="pcShow">显示密码</button>' +
        '<input class="pc-input" id="pcInput" maxlength="6" placeholder="输入密码" value="' + esc(c.input) + '">' +
        '<button class="btn-primary" id="pcSubmit">破译</button></div>' +
      '<div class="pc-score">得分 <b>' + c.score + '</b> · 连击 <b>' + c.streak + '</b> · 最高 <b>' + c.best + '</b></div>' +
    '</div>';
  }
  function bindPc() {
    document.getElementById("pcShow").addEventListener("click", function () { GAME.pc.display = true; renderPc(); clearTimeout(GAME.pc.revealTimer); GAME.pc.revealTimer = setTimeout(function () { if (GAME.pc.running) { GAME.pc.display = false; renderPc(); } }, 3000); });
    var inp = document.getElementById("pcInput");
    inp.addEventListener("input", function () { GAME.pc.input = inp.value; });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submitPc(); });
    document.getElementById("pcSubmit").addEventListener("click", submitPc);
  }
  function renderPc() { var p = document.getElementById("gamePanel"); if (!p) return; if (!GAME.pc.running) { p.innerHTML = '<div class="pc-start"><button class="btn-primary" id="pcStart">开始破译电脑</button></div>'; document.getElementById("pcStart").addEventListener("click", startPc); return; } p.innerHTML = pcPanel(); bindPc(); }

  /* ================= 3. 快速反应 ================= */
  function reactPanel() {
    var r = GAME.react;
    var box = r.state === "wait" ? '<div class="react-box wait" id="reactBox">等待绿灯…</div>'
      : r.state === "go" ? '<div class="react-box go" id="reactBox">点击！</div>'
      : '<div class="react-box idle" id="reactBox">准备</div>';
    var stat = r.rounds ? ('上次 <b>' + r.last + '</b> ms · 平均 <b>' + Math.round(r.sum / r.rounds) + '</b> ms · 最佳 <b>' + r.best + '</b> ms · 回合 <b>' + r.rounds + '</b>') : '点击下方开始，绿灯亮起瞬间点击';
    return '<div class="react-game">' + box +
      '<div class="react-stat">' + stat + '</div>' +
      '<div class="react-actions"><button class="btn-primary" id="reactStart">开始</button>' +
      '<button class="btn-ghost" id="reactReset">重置</button></div></div>';
  }
  function bindReact() {
    document.getElementById("reactStart").addEventListener("click", function () {
      var r = GAME.react; if (r.state === "wait" || r.state === "go") return;
      r.state = "wait"; renderReact();
      clearTimeout(r.timer);
      r.timer = setTimeout(function () { r.state = "go"; r.startedAt = (window.performance ? performance.now() : Date.now()); renderReact(); }, rand(1500, 4000));
    });
    document.getElementById("reactReset").addEventListener("click", function () { var r = GAME.react; r.state = "idle"; r.rounds = 0; r.sum = 0; r.best = 0; r.last = 0; renderReact(); });
    var box = document.getElementById("reactBox");
    if (box) box.addEventListener("click", function () {
      var r = GAME.react;
      if (r.state === "go") {
        var dt = Math.round((window.performance ? performance.now() : Date.now()) - r.startedAt);
        r.last = dt; r.rounds++; r.sum += dt; if (dt < r.best || r.best === 0) r.best = dt;
        r.state = "idle"; beep(1300, 0.12, 0.3); renderReact();
      } else if (r.state === "wait") {
        r.state = "idle"; clearTimeout(r.timer); renderReact();
        var s = document.querySelector(".react-stat"); if (s) s.innerHTML = '❌ 太快了！请等绿灯亮起再点';
      }
    });
  }
  function renderReact() { var p = document.getElementById("gamePanel"); if (!p) return; p.innerHTML = reactPanel(); bindReact(); }

  /* ================= 4. 脑机密码门 ================= */
  var BRAIN_COLORS = ["#19c3a6", "#3a7bd5", "#ff7a59", "#a06bff"];
  function brainStart() { GAME.brain.seq = [rand(0, 3)]; GAME.brain.step = 0; GAME.brain.input = []; GAME.brain.score = 0; GAME.brain.streak = 0; showBrainSeq(); }
  function showBrainSeq() {
    var b = GAME.brain; b.showing = true; b.input = []; renderBrain();
    var i = 0;
    function flash() {
      if (i >= b.seq.length) { b.showing = false; renderBrain(); return; }
      var pad = document.querySelector('.brain-pad[data-p="' + b.seq[i] + '"]');
      if (pad) { pad.classList.add("lit"); setTimeout(function () { pad.classList.remove("lit"); }, 420); }
      i++; setTimeout(flash, 620);
    }
    setTimeout(flash, 400);
  }
  function brainClick(p) {
    var b = GAME.brain; if (b.showing) return;
    var pad = document.querySelector('.brain-pad[data-p="' + p + '"]'); if (pad) { pad.classList.add("lit"); setTimeout(function () { pad.classList.remove("lit"); }, 200); }
    if (b.seq[b.input.length] === p) {
      b.input.push(p);
      if (b.input.length === b.seq.length) {
        b.streak++; b.score += 10 + b.seq.length * 5; if (b.best < b.score) b.best = b.score;
        b.seq.push(rand(0, 3)); setTimeout(showBrainSeq, 500);
      }
    } else {
      b.streak = 0; beep(200, 0.3, 0.3, "sawtooth");
      if (b.best < b.score) b.best = b.score;
      showBrainSeq();
    }
  }
  function brainPanel() {
    var b = GAME.brain;
    var pads = BRAIN_COLORS.map(function (c, i) {
      return '<div class="brain-pad" data-p="' + i + '" style="background:' + c + '"></div>';
    }).join("");
    var status = b.showing ? '观察闪光顺序…' : '按记忆顺序点击（当前长度 ' + b.seq.length + '）';
    return '<div class="brain-game"><div class="brain-grid">' + pads + '</div>' +
      '<div class="brain-status">' + status + '</div>' +
      '<div class="brain-score">得分 <b>' + b.score + '</b> · 连击 <b>' + b.streak + '</b> · 最高 <b>' + b.best + '</b></div>' +
      '<div class="react-actions"><button class="btn-primary" id="brainStart">开始 / 重玩</button></div></div>';
  }
  function bindBrain() {
    document.querySelectorAll(".brain-pad").forEach(function (el) { el.addEventListener("click", function () { brainClick(+el.getAttribute("data-p")); }); });
    document.getElementById("brainStart").addEventListener("click", brainStart);
  }
  function renderBrain() { var p = document.getElementById("gamePanel"); if (!p) return; p.innerHTML = brainPanel(); bindBrain(); }

  /* ================= 5. 指纹破译 ================= */
  function fingerprintSVG(seed) {
    var s = '<svg viewBox="0 0 220 260" class="fp-svg">';
    s += '<ellipse cx="110" cy="130" rx="85" ry="110" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"/>';
    for (var i = 0; i < 28; i++) {
      var ry = 30 + i * 5, rx = 40 + i * 4, cy = 130 + (i % 2 === 0 ? -1 : 1) * (i * 1.5), sw = 1 + (i % 3) * 0.5;
      s += '<ellipse cx="110" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" stroke="rgba(255,255,255,.18)" stroke-width="' + sw + '" fill="none"/>';
    }
    for (var k = 0; k < 5; k++) {
      var ang = (k * 72 + seed * 17) * Math.PI / 180, r = 55 + (k % 3) * 15;
      var x = 110 + Math.cos(ang) * r, y = 130 + Math.sin(ang) * r * 0.8;
      s += '<rect x="' + (x - 9) + '" y="' + (y - 9) + '" width="18" height="18" rx="2" stroke="#19c3a6" stroke-width="1.5" fill="rgba(0,0,0,.35)"/>';
      s += '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" fill="#19c3a6" font-size="11" font-weight="700">' + (k + 1) + '</text>';
    }
    return s + '</svg>';
  }
  function miniFp(idx) { return '<svg viewBox="0 0 60 80" class="fp-mini"><ellipse cx="30" cy="40" rx="24" ry="32" stroke="rgba(255,255,255,.2)" stroke-width="1" fill="none"/><ellipse cx="30" cy="40" rx="16" ry="24" stroke="rgba(255,255,255,.15)" stroke-width="1" fill="none"/><ellipse cx="30" cy="40" rx="8" ry="16" stroke="rgba(255,255,255,.12)" stroke-width="1" fill="none"/></svg>'; }
  function startFp() { GAME.fp.target = rand(0, 5); GAME.fp.picked = []; renderFp(); }
  function pickFp(idx) {
    var f = GAME.fp; if (f.picked.indexOf(idx) > -1) return; f.picked.push(idx);
    if (idx === f.target) { f.streak++; f.score += 15 + f.streak * 2; beep(1200, 0.15, 0.3); setTimeout(startFp, 500); }
    else { f.streak = 0; beep(200, 0.3, 0.3, "sawtooth"); renderFp(); }
    renderFp();
  }
  function fpPanel() {
    var f = GAME.fp;
    var cands = ""; for (var i = 0; i < 6; i++) {
      var wrong = f.picked.indexOf(i) > -1 && i !== f.target, right = f.picked.indexOf(i) > -1 && i === f.target;
      cands += '<div class="fp-candidate" data-i="' + i + '">' + miniFp(i) + '<div class="fp-cand-label">候选 ' + (i + 1) + '</div>' +
        (wrong ? '<div class="fp-x">✗</div>' : '') + (right ? '<div class="fp-check">✓</div>' : '') + '</div>';
    }
    return '<div class="fp-game">' +
      '<div class="fp-left"><div class="fp-avatar"></div><div class="fp-role">未知角色</div>' +
        '<div class="fp-meta">N.145672_x0000D_</div><div class="fp-meta">>>_x000D_</div><div class="fp-meta">生物识别信息___</div></div>' +
      '<div class="fp-center"><div class="fp-title">等待开始挑战…</div><div class="fp-print">' + fingerprintSVG(f.target) + '</div></div>' +
      '<div class="fp-right"><div class="fp-right-title">>> 请选择正确的指纹___</div><div class="fp-candidates">' + cands + '</div></div>' +
      '<div class="fp-score">得分 <b>' + f.score + '</b> · 连击 <b>' + f.streak + '</b> · 最高 <b>' + f.best + '</b></div>' +
    '</div>';
  }
  function bindFp() { document.querySelectorAll(".fp-candidate").forEach(function (el) { el.addEventListener("click", function () { pickFp(+el.getAttribute("data-i")); }); }); }
  function renderFp() { var p = document.getElementById("gamePanel"); if (!p) return; if (!GAME.fp.picked.length && GAME.fp.score === 0) { p.innerHTML = '<div class="pc-start"><button class="btn-primary" id="fpStart">开始指纹破译</button></div>'; document.getElementById("fpStart").addEventListener("click", startFp); return; } p.innerHTML = fpPanel(); bindFp(); }

  /* ================= 外壳 ================= */
  var TABS = [
    { key: "morse", label: "🔢 摩斯密码门" },
    { key: "pc", label: "💻 破译电脑" },
    { key: "react", label: "⚡ 快速反应" },
    { key: "brain", label: "🧠 脑机密码门" },
    { key: "fp", label: "🖐 指纹破译" }
  ];
  function gamesHtml(D) {
    var tabs = TABS.map(function (t) { return '<button class="seg-btn' + (GAME.tab === t.key ? " active" : "") + '" data-tab="' + t.key + '">' + t.label + '</button>'; }).join("");
    return '<div class="section-title">🎮 三角洲小游戏</div>' +
      '<p class="sub">对应 KK日报 的 5 款挑战：听摩斯输入密码、记忆破译电脑密码、测反应速度、记忆脑机序列、辨认指纹。</p>' +
      '<div class="seg">' + tabs + '</div><div id="gamePanel"></div>';
  }
  function gamesInit(D) {
    document.querySelectorAll(".seg-btn[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { GAME.tab = b.getAttribute("data-tab"); D.render("games"); });
    });
    var p = document.getElementById("gamePanel");
    if (GAME.tab === "morse") { p.innerHTML = morsePanel(); bindMorse(); }
    else if (GAME.tab === "pc") renderPc();
    else if (GAME.tab === "react") renderReact();
    else if (GAME.tab === "brain") renderBrain();
    else renderFp();
  }

  function reg(D) {
    D.VIEWS.games = { html: function () { return gamesHtml(D); }, init: function () { gamesInit(D); } };
    D.MENU.push({ group: "小游戏", items: [{ route: "games", label: "三角洲小游戏", ico: "🎮" }] });
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
