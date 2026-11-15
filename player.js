/* 《鄭人買履》課堂動畫放映 — 播放器
   共 12 個鏡頭，對應原文 12 句（「及反，市罷，」併為一句）。
   節奏由老師控制：空白鍵暫停、← → 前後一句、P 切手動、C 切字幕。 */

(function () {
  "use strict";

  var IMAGE_FILES = {
    a: ["src-a-指鞋.jpg", "assets/src-a-指鞋.jpg", "assets/shot-a-169.png"],
    b: ["src-b-市集全景.jpg", "assets/src-b-市集全景.jpg", "assets/shot-b-169.png"],
    c: ["src-c-散市.jpg", "assets/src-c-散市.jpg", "assets/shot-c-169.png"],
    d: ["src-d-放繩上凳.jpg", "assets/src-d-放繩上凳.jpg", "assets/shot-d-169.png"],
    e: ["src-e-量腳丫.jpg", "assets/src-e-量腳丫.jpg", "assets/shot-e-169.png"],
    f: ["src-f-鞋攤.jpg", "assets/src-f-鞋攤.jpg", "assets/shot-f-169.png"],
    g: ["src-g-兩人對話.jpg", "assets/src-g-兩人對話.jpg", "assets/shot-g-169.png"],
    h: ["src-h-主角特寫.jpg", "assets/src-h-主角特寫.jpg", "assets/shot-h-169.png"],
    i: ["src-i-背影趕路.jpg", "assets/src-i-背影趕路.jpg", "assets/shot-i-169.png"]
  };

  function loadImgWithFallback(imgEl, key) {
    var list = IMAGE_FILES[key] || [];
    var pos = 0;
    imgEl.onerror = function () {
      pos++;
      if (pos < list.length) {
        imgEl.src = list[pos];
      }
    };
    if (list.length > 0) imgEl.src = list[0];
  }

  /* 12 個鏡頭：保留十分格網格校準焦點與原文字幕 */
  var SHOTS = [
    { img: "a", t: "鄭人有欲買履者，", d: 4000, f: [0.28, 0.426], f2: [0.29, 0.416], s1: 1.02, s2: 1.06 },
    { img: "e", t: "先自度其足，", d: 4000, f: [0.40, 0.527], f2: [0.42, 0.517], s1: 1.02, s2: 1.09 },
    { img: "d", t: "而置之其坐。", d: 4000, f: [0.40, 0.431], f2: [0.41, 0.421], s1: 1.02, s2: 1.06 },
    { img: "b", t: "至之市，", d: 3000, f: [0.36, 0.32], f2: [0.38, 0.34], s1: 1.30, s2: 1.35 },
    { img: "b", t: "而忘操之。", d: 3000, f: [0.77, 0.74], f2: [0.78, 0.75], s1: 1.95, s2: 2.01 },
    { img: "f", t: "已得履，", d: 3000, f: [0.68, 0.34], f2: [0.69, 0.35], s1: 1.42, s2: 1.48 },
    { img: "h", t: "乃曰：「吾忘持度。」", d: 4000, f: [0.46, 0.34], f2: [0.47, 0.35], s1: 1.35, s2: 1.39 },
    { img: "i", t: "反歸取之。", d: 3000, f: [0.36, 0.52], f2: [0.35, 0.50], s1: 1.02, s2: 1.12 },
    { img: "c", t: "及反，市罷，", d: 3000, f: [0.60, 0.55], f2: [0.62, 0.55], s1: 1.02, s2: 1.06 },
    { img: "c", t: "遂不得履。", d: 3000, f: [0.79, 0.56], f2: [0.80, 0.56], s1: 1.55, s2: 1.61 },
    { img: "g", t: "人曰：「何不試之以足？」", d: 5000, f: [0.46, 0.68], f2: [0.45, 0.66], s1: 1.45, s2: 1.51 },
    { img: "h", t: "曰：「寧信度，無自信也。」", d: 5000, f: [0.45, 0.36], f2: [0.46, 0.38], s1: 1.42, s2: 1.10, final: true }
  ];

  function framing(f, s) {
    var tx = (0.5 - f[0]) * s * 100;
    var ty = (0.5 - f[1]) * s * 100;
    var lim = Math.max(0, 50 * (s - 1));
    tx = Math.max(-lim, Math.min(lim, tx));
    ty = Math.max(-lim, Math.min(lim, ty));
    return [tx, ty];
  }

  var stage = document.getElementById("stage");
  var shotsBox = document.getElementById("shots");
  var segsBox = document.getElementById("segs");
  var hint = document.getElementById("hint");
  var help = document.getElementById("help");
  var bgm = document.getElementById("bgm");

  var idx = -1;
  var paused = false;
  var manual = false;
  var acc = 0;
  var last = 0;
  var nodes = [];
  var segs = [];

  /* ---------- 內建 124 BPM 國風撥弦備援音源（若無外部音檔自動啟用） ---------- */
  var synthCtx = null;
  var synthTimer = null;
  var synthStep = 0;
  var useSynth = false;
  var SCALE = [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25, 739.99, 880.00];
  var MEL = [5,3,4,5, 6,5,3,2, 3,5,6,8, 6,5,3,4, 5,6,5,3, 2,3,4,5, 3,2,0,2, 3,5,3,-1];

  function triggerSynthPluck(freq, time, dur, gainVal) {
    if (!synthCtx || freq <= 0) return;
    var osc = synthCtx.createOscillator();
    var gain = synthCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainVal, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(synthCtx.destination);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function startSynthLoop() {
    if (!bgmOn) return;
    if (!synthCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      synthCtx = new AC();
    }
    if (synthCtx.state === "suspended") synthCtx.resume();
    clearTimeout(synthTimer);
    function step() {
      if (!bgmOn || !useSynth) return;
      var now = synthCtx.currentTime;
      var note = MEL[synthStep % MEL.length];
      if (note >= 0) triggerSynthPluck(SCALE[note], now, 0.42, 0.06);
      if (synthStep % 2 === 0) triggerSynthPluck(SCALE[0] * 0.5, now, 0.5, 0.045);
      synthStep++;
      synthTimer = setTimeout(step, 242); // 124 BPM eighth notes
    }
    step();
  }

  /* ---------- 建立 DOM ---------- */
  function build() {
    SHOTS.forEach(function (sh, i) {
      var div = document.createElement("div");
      div.className = "shot"
        + (sh.final ? " final" : "")
        + (sh.tp === "top" ? " tp-top" : "");

      var a = framing(sh.f, sh.s1);
      var b = framing(sh.f2 || sh.f, sh.s2);
      div.style.setProperty("--d", sh.d + "ms");
      div.style.setProperty("--s1", sh.s1);
      div.style.setProperty("--s2", sh.s2);
      div.style.setProperty("--x1", a[0].toFixed(2) + "%");
      div.style.setProperty("--y1", a[1].toFixed(2) + "%");
      div.style.setProperty("--x2", b[0].toFixed(2) + "%");
      div.style.setProperty("--y2", b[1].toFixed(2) + "%");

      var img = document.createElement("img");
      loadImgWithFallback(img, sh.img);
      img.alt = sh.t || "";
      div.appendChild(img);

      if (sh.t) {
        var scrim = document.createElement("div");
        scrim.className = "scrim" + (sh.tp === "top" ? " top" : "");
        div.appendChild(scrim);

        var line = document.createElement("div");
        line.className = "line";
        Array.from(sh.t).forEach(function (c, k) {
          var sp = document.createElement("span");
          sp.className = "ch";
          sp.style.setProperty("--i", k);
          sp.textContent = c === " " ? " " : c;
          line.appendChild(sp);
        });
        div.appendChild(line);
      }

      shotsBox.appendChild(div);
      nodes.push(div);

      var seg = document.createElement("div");
      seg.className = "seg";
      seg.style.setProperty("--d", sh.d + "ms");
      seg.title = "第 " + (i + 1) + " 鏡：" + sh.t;
      seg.innerHTML = "<i></i>";
      seg.addEventListener("click", function (ev) {
        ev.stopPropagation();
        go(i);
      });
      segsBox.appendChild(seg);
      segs.push(seg);
    });
  }

  /* ---------- 切換鏡頭 ---------- */
  function go(n, opts) {
    opts = opts || {};
    if (n < 0) n = 0;
    if (n >= SHOTS.length) return;

    if (idx >= 0) {
      nodes[idx].classList.remove("on");
      segs[idx].classList.remove("cur");
      segs[idx].classList.add("done");
    }
    idx = n;
    acc = 0;
    last = performance.now();

    var el = nodes[idx];
    void el.offsetWidth;
    el.classList.add("on");
    segs[idx].classList.add("cur");

    for (var i = 0; i < segs.length; i++) {
      if (i < idx) { segs[i].classList.add("done"); segs[i].classList.remove("cur"); }
      else if (i > idx) { segs[i].classList.remove("done", "cur"); }
    }
    if (opts.auto === false) setPaused(true);
  }

  /* ---------- 暫停 ---------- */
  function setPaused(p) {
    paused = p;
    stage.classList.toggle("paused", p);
    if (!p) last = performance.now();
  }

  /* ---------- 主時鐘 ---------- */
  function tick(now) {
    var dt = now - last;
    last = now;
    if (!paused && !manual && idx >= 0) {
      acc += dt;
      if (acc >= SHOTS[idx].d) {
        if (idx < SHOTS.length - 1) go(idx + 1);
        else acc = SHOTS[idx].d;
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 背景樂 ---------- */
  var bgmOn = true;
  function playBgm() {
    if (!bgmOn) return;
    if (useSynth) {
      startSynthLoop();
      return;
    }
    if (!bgm) return;
    bgm.volume = 0.34;
    var p = bgm.play();
    if (p && p.catch) {
      p.catch(function () {
        // 若瀏覽器擋自動播放或外部音檔不存在，則待手勢啟動或啟用內建 124 BPM 撥弦音源
        hint.textContent = "背景樂待啟動：點一下畫面，或按任意鍵";
        hint.classList.add("show");
      });
    }
  }

  if (bgm) {
    bgm.addEventListener("error", function () {
      useSynth = true;
    }, true);
  }

  function toggleBgm() {
    bgmOn = !bgmOn;
    if (bgmOn) {
      playBgm();
      showToast("背景樂：開（124 BPM 輕快國風撥弦）");
    } else {
      if (bgm) bgm.pause();
      clearTimeout(synthTimer);
      showToast("背景樂：關");
    }
  }

  /* ---------- 全屏 ---------- */
  function toggleFull() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
    } else {
      document.exitFullscreen();
    }
  }

  /* ---------- 提示 ---------- */
  var hintTimer = null;
  var DEFAULT_HINT = "空白鍵 暫停　← → 前後一句　P 手動／自動　C 字幕　B 音樂　R 重播　F 全屏　H 說明";

  function flashHint() {
    hint.textContent = DEFAULT_HINT;
    hint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.classList.remove("show"); }, 2600);
  }

  function showToast(msg) {
    hint.textContent = msg;
    hint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      hint.classList.remove("show");
      setTimeout(function () { hint.textContent = DEFAULT_HINT; }, 500);
    }, 2800);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    document.addEventListener("keydown", function (e) {
      var k = e.key;

      if (bgmOn && ((bgm && bgm.paused && !useSynth) || (useSynth && !synthTimer))) {
        playBgm();
      }

      if (k === " " || k === "Spacebar") {
        e.preventDefault();
        setPaused(!paused);
        flashHint();
        return;
      }
      if (k === "ArrowRight") {
        e.preventDefault();
        if (idx < SHOTS.length - 1) { go(idx + 1); if (!manual) setPaused(false); }
        return;
      }
      if (k === "ArrowLeft") {
        e.preventDefault();
        go(Math.max(0, idx - 1));
        return;
      }
      if (k === "p" || k === "P") {
        manual = !manual;
        acc = 0;
        setPaused(false);
        showToast(manual
          ? "手動模式：你讀完一句，按 → 進下一句（P 切回自動）"
          : "自動放映模式（P 切回手動）");
        return;
      }
      if (k === "c" || k === "C") {
        var hidden = stage.classList.toggle("hide-captions");
        showToast(hidden ? "字幕已隱藏（按 C 恢復顯示）" : "字幕已顯示");
        return;
      }
      if (k === "b" || k === "B") { toggleBgm(); return; }
      if (k === "r" || k === "R") {
        nodes.forEach(function (n) { n.classList.remove("on"); });
        segs.forEach(function (s) { s.classList.remove("done", "cur"); });
        idx = -1;
        manual = false;
        setPaused(false);
        go(0);
        return;
      }
      if (k === "f" || k === "F") { toggleFull(); return; }
      if (k === "h" || k === "H" || k === "?") { help.classList.toggle("show"); return; }
    });

    stage.addEventListener("click", function () {
      if (help.classList.contains("show")) { help.classList.remove("show"); return; }
      setPaused(!paused);
      flashHint();
      if (bgmOn && ((bgm && bgm.paused && !useSynth) || (useSynth && !synthTimer))) {
        playBgm();
      }
    });

    var ct = null;
    document.addEventListener("mousemove", function () {
      document.body.style.cursor = "default";
      clearTimeout(ct);
      ct = setTimeout(function () { document.body.style.cursor = "none"; }, 3000);
    });
  }

  /* ---------- 啟動 ---------- */
  build();
  bind();

  var start = 0;
  var m = /^#(\d{1,2})$/.exec(location.hash || "");
  if (m) {
    var n = parseInt(m[1], 10) - 1;
    if (n >= 0 && n < SHOTS.length) start = n;
  }
  go(start);

  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(tick); });
  playBgm();
  setTimeout(flashHint, 900);
})();
