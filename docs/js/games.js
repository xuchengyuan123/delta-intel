/* =========================================================
 * games.js — 摩斯密码小游戏三合一
 *   1) 听摩斯密码：播放音频，听写解码
 *   2) 破解电脑摩斯密码：终端显示摩斯串，手动解码
 *   3) 破解指纹摩斯密码：指纹纹路中藏摩斯点划，解码
 * 计分 + 连击，纯前端 Web Audio，无外部依赖。
 * ========================================================= */
(function () {
  "use strict";

  var MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----." };
  var REV = {}; Object.keys(MORSE).forEach(function (k) { REV[MORSE[k]] = k; });
  var WORDS = ["SOS", "HELP", "DELTA", "ALPHA", "ECHO", "TANGO", "RADIO", "GHOST", "STORM", "TIGER", "WOLF", "NOVA", "BUNKER", "EXTRACT", "SNIPER", "MEDIC", "OPERATION", "ZERO", "XRAY", "DELTAFORCE"];

  function toMorse(text) {
    return text.toUpperCase().split("").map(function (c) { return MORSE[c] || ""; }).filter(Boolean).join(" ");
  }
  function fromMorse(str) {
    return str.trim().split(/\s+/).map(function (m) { return REV[m] || "?"; }).join("");
  }
  function rndWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

  var actx = null;
  function ensureCtx() {
    if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function playMorse(text, wpm) {
    var ctx = ensureCtx(); if (!ctx) { alert("当前浏览器不支持音频播放"); return; }
    var unit = 1.2 / (wpm || 12);
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 620;
    osc.connect(gain); gain.connect(ctx.destination);
    var t = ctx.currentTime + 0.05; gain.gain.value = 0.0001; osc.start(t);
    var seq = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
    for (var i = 0; i < seq.length; i++) {
      var ch = seq[i];
      if (ch === " ") { t += unit * 7; continue; }
      var code = MORSE[ch] || "";
      for (var j = 0; j < code.length; j++) {
        var dur = code[j] === "." ? unit : unit * 3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
        gain.gain.setValueAtTime(0.3, t + dur - 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        t += dur + unit;
      }
      t += unit * 2;
    }
    gain.gain.setValueAtTime(0.0001, t + 0.1);
    osc.stop(t + 0.2);
  }

  function fingerprintSVG(morse) {
    var s = '<svg viewBox="0 0 200 200" class="fp-svg" aria-label="指纹摩斯">';
    s += '<g stroke="rgba(25,195,166,.32)" stroke-width="2" fill="none">';
    for (var r = 18; r <= 92; r += 11) s += '<ellipse cx="100" cy="100" rx="' + r + '" ry="' + (r * 0.82) + '"/>';
    s += '<path d="M30 100 Q100 30 170 100"/>';
    s += '<path d="M44 116 Q100 70 156 116"/>';
    s += '<path d="M60 132 Q100 104 140 132"/>';
    s += "</g>";
    var x = 18, y = 178;
    s += '<g>';
    for (var i = 0; i < morse.length; i++) {
      var c = morse[i];
      if (c === ".") { s += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#19c3a6"/>'; x += 18; }
      else if (c === "-") { s += '<rect x="' + x + '" y="' + (y - 3) + '" width="22" height="6" rx="3" fill="#19c3a6"/>'; x += 34; }
      else { x += 24; }
    }
    s += "</g></svg>";
    return s;
  }

  /* ---------- 状态 ---------- */
  var S = { listen: { word: "", score: 0, streak: 0 }, comp: { word: "", score: 0, streak: 0 }, fp: { word: "", score: 0, streak: 0 } };
  var TAB = "listen";

  function newPuzzle(tab) {
    S[tab].word = rndWord();
  }

  function listenHtml(D) {
    newPuzzle("listen");
    return '<div class="morse-game">' +
      '<div class="mg-info">🎧 戴上耳机，点击播放，把听到的内容（字母/数字）输入下方。例：<code>DELTA</code></div>' +
      '<div class="mg-actions">' +
        '<button class="btn-primary" id="mgPlay">▶ 播放摩斯</button>' +
        '<button class="btn-ghost" id="mgReplay">↻ 重播</button>' +
      "</div>" +
      '<input id="mgInput" class="mg-input" placeholder="输入你听到的词" autocomplete="off">' +
      '<div class="mg-actions">' +
        '<button class="btn-primary" id="mgCheck">提交</button>' +
        '<button class="btn-ghost" id="mgSkip">换一题</button>' +
      "</div>" +
      '<div id="mgMsg" class="mg-msg"></div>' +
      '<div class="mg-score">得分 <b id="mgScore">' + S.listen.score + '</b> · 连击 <b id="mgStreak">' + S.listen.streak + '</b></div>' +
      "</div>";
  }
  function listenInit(D) {
    document.getElementById("mgPlay").addEventListener("click", function () { playMorse(S.listen.word); });
    document.getElementById("mgReplay").addEventListener("click", function () { playMorse(S.listen.word); });
    document.getElementById("mgSkip").addEventListener("click", function () { newPuzzle("listen"); document.getElementById("mgInput").value = ""; document.getElementById("mgMsg").innerHTML = ""; updateScore("listen"); });
    document.getElementById("mgCheck").addEventListener("click", function () {
      var v = (document.getElementById("mgInput").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      var msg = document.getElementById("mgMsg");
      if (!v) { msg.innerHTML = '<span class="err">先输入内容哦</span>'; return; }
      if (v === S.listen.word) {
        S.listen.streak++; S.listen.score += 10 + S.listen.streak * 2;
        msg.innerHTML = '<span class="ok">✓ 正确！+' + (10 + S.listen.streak * 2) + " 分</span>";
        newPuzzle("listen"); document.getElementById("mgInput").value = "";
        setTimeout(function () { msg.innerHTML = ""; }, 1200);
      } else {
        S.listen.streak = 0;
        msg.innerHTML = '<span class="err">✗ 正确答案：' + S.listen.word + "（" + toMorse(S.listen.word) + "）</span>";
        newPuzzle("listen"); document.getElementById("mgInput").value = "";
      }
      updateScore("listen");
    });
  }

  function compHtml(D) {
    newPuzzle("comp");
    var code = toMorse(S.comp.word);
    return '<div class="morse-game">' +
      '<div class="mg-info">💻 终端截获一段摩斯电码，手动解码为原文。</div>' +
      '<div class="terminal"><div class="term-bar"><span></span><span></span><span></span></div>' +
        '<pre class="term-code">' + D.esc(code) + "</pre>" +
        '<div class="term-actions"><button class="btn-ghost" id="mgCompPlay">🔊 听这段</button></div>' +
      "</div>" +
      '<input id="mgCompInput" class="mg-input" placeholder="输入解码结果，如 DELTA" autocomplete="off">' +
      '<div class="mg-actions">' +
        '<button class="btn-primary" id="mgCompCheck">提交</button>' +
        '<button class="btn-ghost" id="mgCompSkip">换一题</button>' +
      "</div>" +
      '<div id="mgCompMsg" class="mg-msg"></div>' +
      '<div class="mg-score">得分 <b>' + S.comp.score + '</b> · 连击 <b id="mgCompStreak">' + S.comp.streak + '</b></div>' +
      "</div>";
  }
  function compInit(D) {
    document.getElementById("mgCompPlay").addEventListener("click", function () { playMorse(S.comp.word); });
    document.getElementById("mgCompSkip").addEventListener("click", function () { newPuzzle("comp"); D.render("games"); });
    document.getElementById("mgCompCheck").addEventListener("click", function () {
      var v = (document.getElementById("mgCompInput").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      var msg = document.getElementById("mgCompMsg");
      if (v === S.comp.word) {
        S.comp.streak++; S.comp.score += 10 + S.comp.streak * 2;
        msg.innerHTML = '<span class="ok">✓ 破解成功！+' + (10 + S.comp.streak * 2) + " 分</span>";
        newPuzzle("comp"); D.render("games");
      } else {
        S.comp.streak = 0;
        msg.innerHTML = '<span class="err">✗ 正确答案：' + S.comp.word + "</span>";
        newPuzzle("comp"); D.render("games");
      }
    });
  }

  function fpHtml(D) {
    newPuzzle("fp");
    var code = toMorse(S.fp.word);
    return '<div class="morse-game">' +
      '<div class="mg-info">🔍 指纹纹路中藏有一段摩斯密码（青绿点=·，横线=—），解码它。</div>' +
      '<div class="fp-wrap">' + fingerprintSVG(code) + '<button class="btn-ghost" id="mgFpPlay">🔊 听指纹</button></div>' +
      '<input id="mgFpInput" class="mg-input" placeholder="输入解码结果" autocomplete="off">' +
      '<div class="mg-actions">' +
        '<button class="btn-primary" id="mgFpCheck">提交</button>' +
        '<button class="btn-ghost" id="mgFpSkip">换一题</button>' +
      "</div>" +
      '<div id="mgFpMsg" class="mg-msg"></div>' +
      '<div class="mg-score">得分 <b>' + S.fp.score + '</b> · 连击 <b id="mgFpStreak">' + S.fp.streak + '</b></div>' +
      "</div>";
  }
  function fpInit(D) {
    document.getElementById("mgFpPlay").addEventListener("click", function () { playMorse(S.fp.word); });
    document.getElementById("mgFpSkip").addEventListener("click", function () { newPuzzle("fp"); D.render("games"); });
    document.getElementById("mgFpCheck").addEventListener("click", function () {
      var v = (document.getElementById("mgFpInput").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      var msg = document.getElementById("mgFpMsg");
      if (v === S.fp.word) {
        S.fp.streak++; S.fp.score += 15 + S.fp.streak * 2;
        msg.innerHTML = '<span class="ok">✓ 指纹破译成功！+' + (15 + S.fp.streak * 2) + " 分</span>";
        newPuzzle("fp"); D.render("games");
      } else {
        S.fp.streak = 0;
        msg.innerHTML = '<span class="err">✗ 正确答案：' + S.fp.word + "</span>";
        newPuzzle("fp"); D.render("games");
      }
    });
  }

  function updateScore(tab) {
    var id = tab === "listen" ? "mgStreak" : (tab === "comp" ? "mgCompStreak" : "mgFpStreak");
    var el = document.getElementById(id);
    if (el) el.textContent = S[tab].streak;
    var sEl = document.getElementById(tab === "listen" ? "mgScore" : (tab === "comp" ? "mgCompScore" : "mgFpScore"));
    if (sEl) sEl.textContent = S[tab].score;
  }

  function gamesHtml(D) {
    return '<div class="section-title">摩斯密码小游戏</div>' +
      '<div class="seg">' +
        '<button class="seg-btn' + (TAB === "listen" ? " active" : "") + '" data-tab="listen">🎧 听摩斯</button>' +
        '<button class="seg-btn' + (TAB === "comp" ? " active" : "") + '" data-tab="comp">💻 电脑摩斯</button>' +
        '<button class="seg-btn' + (TAB === "fp" ? " active" : "") + '" data-tab="fp">🔍 指纹摩斯</button>' +
      "</div>" +
      '<div id="gamePanel"></div>';
  }
  function gamesInit(D) {
    document.querySelectorAll(".seg-btn[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { TAB = b.getAttribute("data-tab"); D.render("games"); });
    });
    var p = document.getElementById("gamePanel");
    if (TAB === "listen") { p.innerHTML = listenHtml(D); listenInit(D); }
    else if (TAB === "comp") { p.innerHTML = compHtml(D); compInit(D); }
    else { p.innerHTML = fpHtml(D); fpInit(D); }
  }

  function reg(D) {
    D.VIEWS.games = { html: function () { return gamesHtml(D); }, init: function () { gamesInit(D); } };
    D.MENU.push({ group: "小游戏", items: [{ route: "games", label: "摩斯密码小游戏", ico: "📡" }] });
  }
  if (window.DF) reg(window.DF);
  else (window.__df_plugins = window.__df_plugins || []).push(reg);
})();
