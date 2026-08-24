/* ============================================================
   audio.js — fully synthesised SFX + chiptune loop (zero assets)
   Everything is short, dry and punchy: arcade-crisp, no reverb.
   ============================================================ */
'use strict';

var Sound = (function () {
  var ac = null;
  var master, sfxBus, musicBus, noiseBuf;
  var muted = false;
  var musicRunning = false;
  var schedTimer = null;
  var nextStepTime = 0;
  var stepIndex = 0;
  var bpm = 128;

  /* ---------- core ---------- */

  function ensure() {
    if (ac) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }

    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ac.destination);

    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);

    musicBus = ac.createGain();
    musicBus.gain.value = 0.0;
    musicBus.connect(master);

    var len = Math.floor(ac.sampleRate * 0.8);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (ac.state === 'suspended') ac.resume();
  }

  function now() { return ac.currentTime; }

  function gainNode(t0, peak, attack, decay) {
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  function tone(opts) {
    if (!ensure() || muted) return;
    var t0 = (opts.at || now()) + 0;
    var osc = ac.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 !== undefined) {
      if (opts.linear) osc.frequency.linearRampToValueAtTime(opts.f1, t0 + opts.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    }
    var g = gainNode(t0, opts.gain || 0.3, opts.attack || 0.005, opts.dur);
    var tail = g;
    if (opts.filter) {
      var f = ac.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.setValueAtTime(opts.filterF || 1200, t0);
      g.connect(f);
      tail = f;
    }
    osc.connect(g);
    tail.connect(opts.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + (opts.attack || 0.005) + opts.dur + 0.05);
  }

  function noise(opts) {
    if (!ensure() || muted) return;
    var t0 = (opts.at || now());
    var src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opts.rate || 1;

    var filt = ac.createBiquadFilter();
    filt.type = opts.filter || 'lowpass';
    filt.Q.value = opts.q || 1;
    filt.frequency.setValueAtTime(opts.ff0 || 2000, t0);
    if (opts.ff1 !== undefined) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.ff1), t0 + opts.dur);
    }

    var g = gainNode(t0, opts.gain || 0.3, opts.attack || 0.004, opts.dur);
    src.connect(filt); filt.connect(g); g.connect(opts.bus || sfxBus);
    src.start(t0);
    src.stop(t0 + (opts.attack || 0.004) + opts.dur + 0.05);
  }

  /* ---------- SFX ---------- */

  var api = {};

  /* 1. Hammer slam */
  api.thwack = function (power) {
    power = power === undefined ? 1 : power;
    var t = ensure() ? now() : 0;
    noise({ at: t, dur: 0.11, ff0: 3800, ff1: 420, gain: 0.34 * power, filter: 'lowpass' });
    tone({ at: t, type: 'sine', f0: 150, f1: 42, dur: 0.16, gain: 0.42 * power });
    tone({ at: t, type: 'square', f0: 220, f1: 90, dur: 0.06, gain: 0.10 * power });
  };

  /* 2. Mole hit — bonk + yelp */
  api.bonk = function () {
    var t = ensure() ? now() : 0;
    tone({ at: t, type: 'triangle', f0: 620, f1: 150, dur: 0.26, gain: 0.42 });
    tone({ at: t + 0.02, type: 'sine', f0: 90, f1: 55, dur: 0.2, gain: 0.35 });
    noise({ at: t, dur: 0.09, ff0: 2400, ff1: 500, gain: 0.2 });
    tone({ at: t + 0.14, type: 'square', f0: 880, f1: 1320, dur: 0.09, gain: 0.10 });
    tone({ at: t + 0.23, type: 'square', f0: 1180, f1: 620, dur: 0.12, gain: 0.09 });
  };

  /* 3. Burrow */
  api.dig = function (soft) {
    var t = ensure() ? now() : 0;
    var g = soft ? 0.11 : 0.2;
    noise({ at: t, dur: 0.16, ff0: 900, ff1: 220, q: 2.5, gain: g, filter: 'bandpass' });
    tone({ at: t, type: 'sine', f0: 260, f1: 90, dur: 0.12, gain: g * 0.6 });
  };

  /* 4. Surface pop */
  api.pop = function (pitch) {
    var t = ensure() ? now() : 0;
    var p = pitch || 1;
    tone({ at: t, type: 'sine', f0: 300 * p, f1: 980 * p, dur: 0.085, gain: 0.26 });
    noise({ at: t, dur: 0.05, ff0: 1600, ff1: 3000, gain: 0.08 });
  };

  /* 5. Close call */
  api.whoosh = function () {
    var t = ensure() ? now() : 0;
    noise({ at: t, dur: 0.13, ff0: 500, ff1: 3200, q: 1.6, gain: 0.2, filter: 'bandpass' });
    noise({ at: t + 0.13, dur: 0.14, ff0: 3200, ff1: 480, q: 1.6, gain: 0.15, filter: 'bandpass' });
  };

  /* Combo ding — rising pitch per tier */
  api.ding = function (tier) {
    var t = ensure() ? now() : 0;
    var f = 660 * Math.pow(1.26, (tier || 1) - 1);
    tone({ at: t, type: 'square', f0: f, dur: 0.1, gain: 0.14 });
    tone({ at: t + 0.05, type: 'square', f0: f * 1.5, dur: 0.12, gain: 0.10 });
  };

  /* 6. Game over — comedic deflation into a sad slide */
  api.gameOver = function () {
    var t = ensure() ? now() : 0;
    tone({ at: t, type: 'sawtooth', f0: 330, f1: 300, dur: 0.22, gain: 0.16, filter: 'lowpass', filterF: 1400 });
    tone({ at: t + 0.24, type: 'sawtooth', f0: 294, f1: 262, dur: 0.24, gain: 0.16, filter: 'lowpass', filterF: 1300 });
    tone({ at: t + 0.5, type: 'sawtooth', f0: 247, f1: 110, dur: 0.85, gain: 0.19, filter: 'lowpass', filterF: 1100 });
    noise({ at: t + 0.5, dur: 0.7, ff0: 700, ff1: 160, gain: 0.05 });
  };

  /* 7. Wildcard announce — chime, colour-coded by pitch set */
  var CHIME = {
    lockdown: [392, 330, 262],
    extralife: [523, 659, 784],
    frenzy: [440, 554, 880],
    decoy: [587, 494, 587],
    quake: [196, 165, 147],
    golden: [523, 659, 784, 1047]
  };
  api.chime = function (kind) {
    var notes = CHIME[kind] || [523, 659];
    var t = ensure() ? now() : 0;
    for (var i = 0; i < notes.length; i++) {
      tone({ at: t + i * 0.075, type: 'triangle', f0: notes[i], dur: 0.34, gain: 0.16 });
      tone({ at: t + i * 0.075, type: 'sine', f0: notes[i] * 2, dur: 0.22, gain: 0.06 });
    }
  };

  /* 8. Fanfare — new high score / milestone */
  api.fanfare = function () {
    var t = ensure() ? now() : 0;
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
      tone({ at: t + i * 0.085, type: 'square', f0: notes[i], dur: 0.16, gain: 0.13 });
    }
    tone({ at: t + 0.34, type: 'square', f0: 1047, dur: 0.4, gain: 0.14 });
  };

  api.milestone = function () {
    var t = ensure() ? now() : 0;
    tone({ at: t, type: 'square', f0: 784, dur: 0.1, gain: 0.11 });
    tone({ at: t + 0.08, type: 'square', f0: 1047, dur: 0.2, gain: 0.12 });
  };

  /* Forced eject — spring-loaded SPROING */
  api.sproing = function () {
    if (!ensure() || muted) return;
    var t = now();
    var osc = ac.createOscillator();
    osc.type = 'triangle';
    var g = gainNode(t, 0.28, 0.005, 0.42);
    osc.frequency.setValueAtTime(180, t);
    for (var i = 0; i < 14; i++) {
      var f = 180 + 620 * Math.exp(-i * 0.16) * (i % 2 ? -0.5 : 1);
      osc.frequency.linearRampToValueAtTime(Math.max(90, f), t + i * 0.03);
    }
    osc.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.5);
    noise({ at: t, dur: 0.08, ff0: 1800, ff1: 600, gain: 0.1 });
  };

  api.collect = function () {
    var t = ensure() ? now() : 0;
    var notes = [659, 784, 988, 1319];
    for (var i = 0; i < notes.length; i++) {
      tone({ at: t + i * 0.06, type: 'sine', f0: notes[i], dur: 0.18, gain: 0.16 });
    }
  };

  api.blocked = function () {
    var t = ensure() ? now() : 0;
    tone({ at: t, type: 'square', f0: 150, f1: 90, dur: 0.09, gain: 0.12 });
    noise({ at: t, dur: 0.07, ff0: 700, ff1: 200, gain: 0.1 });
  };

  api.select = function () {
    var t = ensure() ? now() : 0;
    tone({ at: t, type: 'square', f0: 880, dur: 0.06, gain: 0.09 });
  };

  api.rumble = function () {
    var t = ensure() ? now() : 0;
    noise({ at: t, dur: 2.6, ff0: 180, ff1: 90, gain: 0.14, attack: 0.3 });
    tone({ at: t, type: 'sine', f0: 60, f1: 45, dur: 2.4, gain: 0.16, attack: 0.3 });
  };

  /* ---------- music: 4-bar chiptune loop, tempo follows difficulty ---------- */

  var CHORDS = [
    { bass: 110.00, arp: [220.0, 261.6, 329.6] },  /* Am */
    { bass: 87.31,  arp: [174.6, 220.0, 261.6] },  /* F  */
    { bass: 130.81, arp: [261.6, 329.6, 392.0] },  /* C  */
    { bass: 98.00,  arp: [196.0, 246.9, 293.7] }   /* G  */
  ];

  function playStep(i, t) {
    if (muted) return;
    var bar = Math.floor(i / 8) % 4;
    var beat = i % 8;
    var ch = CHORDS[bar];

    if (beat === 0 || beat === 3 || beat === 6) {
      tone({ at: t, type: 'triangle', f0: ch.bass, dur: 0.22, gain: 0.5, bus: musicBus });
    }
    var arpF = ch.arp[[0, 1, 2, 1, 0, 2, 1, 2][beat]];
    tone({ at: t, type: 'square', f0: arpF, dur: 0.11, gain: 0.13, bus: musicBus,
           filter: 'lowpass', filterF: 2600 });
    if (beat === 0 || beat === 4) {
      tone({ at: t, type: 'sine', f0: 150, f1: 48, dur: 0.1, gain: 0.55, bus: musicBus });
    }
    if (beat % 2 === 1) {
      noise({ at: t, dur: 0.03, ff0: 7000, q: 1, gain: 0.05, bus: musicBus, filter: 'highpass' });
    }
  }

  function scheduler() {
    if (!ac) return;
    var spb = (60 / bpm) / 2; /* eighth notes */
    while (nextStepTime < ac.currentTime + 0.18) {
      if (nextStepTime > ac.currentTime - 0.05) playStep(stepIndex, nextStepTime);
      nextStepTime += spb;
      stepIndex++;
    }
  }

  api.startMusic = function () {
    if (!ensure()) return;
    if (musicRunning) return;
    musicRunning = true;
    stepIndex = 0;
    nextStepTime = ac.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.3, ac.currentTime + 0.6);
    schedTimer = setInterval(scheduler, 25);
  };

  api.stopMusic = function (fade) {
    if (!ac || !musicRunning) return;
    musicRunning = false;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + (fade === undefined ? 0.4 : fade));
    clearInterval(schedTimer);
    schedTimer = null;
  };

  api.setTempo = function (v) { bpm = Math.max(90, Math.min(210, v)); };

  /* ---------- mute ---------- */

  api.setMuted = function (m) {
    muted = !!m;
    if (ac && master) {
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.02);
    }
  };
  api.isMuted = function () { return muted; };
  api.toggleMute = function () { api.setMuted(!muted); return muted; };
  api.unlock = unlock;
  api.ready = function () { return !!ac; };

  return api;
})();
