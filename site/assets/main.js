/* Winner Capital · main.js
   HTML, CSS e JavaScript puros. Sem dependências. */
(() => {
  'use strict';

  /* ===== Contato: troque aqui ======================================
     whatsapp: número com DDI e DDD, só dígitos (ex.: '5511999999999').
     Enquanto estiver vazio, o formulário copia a mensagem e leva ao
     Direct do Instagram da Winner Capital. */
  const CONTATO = {
    whatsapp: '',
    instagram: 'winner_capital'
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => {
    const t = clamp((p - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const rng = seed => {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  };

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.add('js');

  // abas escondidas pausam todo loop de CSS
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused', document.hidden);
  });

  /* ===== Divisão de texto (uma vez, com semente) ===== */
  function split(el, seed) {
    const mode = el.dataset.split;
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    const em = (el.dataset.em || '').split('|').filter(Boolean);
    const r = rng(seed);
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);

    if (mode === 'blur') {
      el.classList.add('blurpair');
      for (const cls of ['soft', 'sharp']) {
        const s = document.createElement('span');
        s.className = cls;
        s.setAttribute('aria-hidden', 'true');
        s.textContent = text;
        el.appendChild(s);
      }
      return;
    }

    const vis = document.createElement('span');
    vis.className = 'split';
    vis.setAttribute('aria-hidden', 'true');
    const words = text.split(' ');
    const punch = !!el.closest('.fx-punch');
    const spread = +(el.dataset.spread || (mode === 'chars' ? 0.55 : punch ? 0.4 : 0.5));
    words.forEach((w, wi) => {
      const ws = document.createElement('span');
      ws.className = 'w';
      if (em.includes(w)) ws.classList.add('em');
      if (mode === 'chars') {
        for (const ch of w) {
          const cs = document.createElement('span');
          cs.className = 'c';
          cs.textContent = ch;
          cs.style.setProperty('--th', (r() * spread).toFixed(3));
          cs.style.setProperty('--jx', ((r() - 0.5) * 150).toFixed(1) + 'px');
          cs.style.setProperty('--jy', ((r() - 0.5) * 96).toFixed(1) + 'px');
          cs.style.setProperty('--jr', ((r() - 0.5) * 70).toFixed(1) + 'deg');
          ws.appendChild(cs);
        }
      } else {
        ws.textContent = w;
        ws.style.setProperty('--th', ((wi / Math.max(1, words.length - 1)) * spread + r() * 0.04).toFixed(3));
      }
      vis.appendChild(ws);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.appendChild(vis);
  }
  $$('[data-split]').forEach((el, i) => split(el, 7919 * (i + 3)));

  /* ===== Hero de scroll ===== */
  // portões do hero estático: idênticos, caractere por caractere, ao styles.css
  const GATES = [
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const MQLS = GATES.map(q => matchMedia(q)); // referências mantidas de propósito

  // duas versões do mesmo vídeo: a completa (16:9) e um recorte central em retrato,
  // mais leve e mais rápido de decodificar, para celular e tablet em pé
  const VIDEOS = {
    paisagem: { url: 'assets/hero-scrub.mp4', bytes: 4147067 },        // bytes: recuo quando Content-Length falta
    retrato: { url: 'assets/hero-scrub-retrato.mp4', bytes: 2523358 }
  };
  const RETRATO = matchMedia('(max-aspect-ratio: 4/5)');
  const wantVariant = () => (RETRATO.matches ? 'retrato' : 'paisagem');
  const POSTER_URL = 'assets/hero-poster.jpg';
  const ENDING_URL = 'assets/hero-ending.jpg';

  const hero = $('.hero-scrub');
  const stage = $('.stage');
  const video = $('#hero-video');
  const posterLayer = $('.poster');
  const posterEnd = $('.poster-end');
  const loader = $('.loader');
  const ring = $('.ring');

  const bands = $$('.band').map((el, i, arr) => ({
    el,
    a: +el.dataset.from,
    b: +el.dataset.to,
    ramp: el.dataset.ramp ? +el.dataset.ramp : 0,
    first: i === 0,
    last: i === arr.length - 1,
    op: -1,
    k: -1,
    on: null
  }));

  let scrubOn = false;
  let heroInit = false;
  let videoReady = false;
  let videoFailed = false;
  let target = 0;
  let shown = 0;
  let rafId = null;
  let lastTick = 0;
  let heroOnScreen = true;
  let loadK = 0;
  let loadRampStarted = false;
  let cueHidden = null;
  let atEnd = null;
  let loadId = 0;        // cada carga de vídeo tem um número; cargas antigas se descartam sozinhas
  let variant = null;    // 'paisagem' ou 'retrato', a versão carregada agora
  let objectUrl = null;
  let primed = false;

  // o intervalo de scroll é a altura do hero menos a do palco fixo (100lvh), e não innerHeight:
  // no celular a barra do navegador muda innerHeight o tempo todo, o palco não
  function heroRange() {
    return Math.max(1, hero.offsetHeight - stage.offsetHeight);
  }
  function heroProgress() {
    return clamp(-hero.getBoundingClientRect().top / heroRange(), 0, 1);
  }

  function updateCaptions(p) {
    for (const b of bands) {
      const f = Math.min(0.02, (b.b - b.a) / 3);
      const inE = b.first ? 1 : smoothstep(p, b.a, b.a + f);
      const outE = b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b);
      const op = Math.round(inE * outE * 1000) / 1000;
      let k = clamp((p - b.a) / (b.ramp || Math.min(0.025, (b.b - b.a) * 0.35)), 0, 1);
      if (b.first) k = Math.max(k, loadK);

      if (op !== b.op) {
        b.op = op;
        b.el.style.opacity = op;
        const on = op > 0.02;
        if (on !== b.on) {
          b.on = on;
          b.el.classList.toggle('on', on);
        }
      }
      if (k !== b.k && (Math.abs(k - b.k) >= 0.008 || k === 0 || k === 1)) {
        b.k = k;
        b.el.style.setProperty('--k', k.toFixed(3));
      }
    }
    const hide = p > 0.015;
    if (hide !== cueHidden) {
      cueHidden = hide;
      stage.classList.toggle('scrolled', hide);
    }
    if (videoFailed) {
      const end = p > 0.82;
      if (end !== atEnd) {
        atEnd = end;
        stage.classList.toggle('at-end', end);
      }
    }
  }

  // seeks travados: nunca dois ao mesmo tempo, sempre o alvo mais novo
  let seekBusy = false;
  let pendingTime = null;
  function requestSeek(t) {
    if (!video.duration) return;
    t = clamp(t, 0, video.duration - 0.05);
    if (seekBusy) {
      pendingTime = t;
      return;
    }
    if (Math.abs(video.currentTime - t) < 0.002) return;
    seekBusy = true;
    video.currentTime = t;
  }
  video.addEventListener('seeked', () => {
    seekBusy = false;
    if (pendingTime !== null) {
      const t = pendingTime;
      pendingTime = null;
      requestSeek(t);
    }
  });
  video.addEventListener('error', () => {
    seekBusy = false;
    pendingTime = null;
    if (heroInit) failVideo();
  });

  // interpolação normalizada por dt; o loop descansa quando converge
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) {
      shown = target;
      rafId = null;
      lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    if (videoReady) requestSeek(shown * video.duration);
    updateCaptions(shown);
  }

  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }

  // girar o aparelho muda a altura do hero (ele é medido em alturas de tela):
  // devolve o visitante ao mesmo ponto da jornada em vez de jogá-lo na seção seguinte
  let lastHeroH = 0;
  let lastP = 0;
  function onResize() {
    const h = hero.offsetHeight;
    if (lastHeroH && h !== lastHeroH && lastP > 0 && lastP < 1) {
      const top = hero.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + lastP * heroRange(), behavior: 'instant' });
    }
    lastHeroH = h;
    onScroll();
  }
  addEventListener('scroll', () => {
    if (scrubOn) { lastP = heroProgress(); lastHeroH = hero.offsetHeight; }
  }, { passive: true });

  new IntersectionObserver(([e]) => {
    heroOnScreen = e.isIntersecting;
    if (heroOnScreen && scrubOn) onScroll();
  }).observe(hero);

  function initHeroOnce() {
    if (heroInit) return;
    heroInit = true;
    // o pôster vence a corrida de banda: o blob só começa depois dele
    posterLayer.style.backgroundImage = `url('${POSTER_URL}')`;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      startVideoLoad();
    };
    const img = new Image();
    img.onload = start;
    img.onerror = start;
    img.src = POSTER_URL;
    setTimeout(start, 4000);
  }

  function startVideoLoad() {
    const id = ++loadId;
    variant = wantVariant();
    videoReady = false;
    seekBusy = false;
    pendingTime = null;
    stage.classList.remove('video-ready');
    ring.style.setProperty('--ld', 126);
    loadHeroBlob(id, VIDEOS[variant]).catch(() => {
      if (id === loadId) failVideo();
    });
  }

  async function loadHeroBlob(id, src) {
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(src.url, { priority: 'low', signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('Content-Length')) || src.bytes;
    let blob;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      let lastRing = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (id !== loadId) {   // o aparelho girou no meio da carga: esta já não serve
          clearTimeout(watchdog);
          ctrl.abort();
          return;
        }
        if (done) break;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => ctrl.abort(), 20000);
        chunks.push(value);
        got += value.length;
        const frac = Math.min(1, got / total);
        const now = performance.now();
        if (now - lastRing > 100 || frac === 1) {
          lastRing = now;
          ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
        }
      }
      blob = new Blob(chunks);
    } else {
      blob = await res.blob();
    }
    clearTimeout(watchdog);
    if (id !== loadId) return;
    ring.style.setProperty('--ld', 0);
    const ready = () => {
      if (id !== loadId || videoReady) return;
      videoReady = true;
      stage.classList.add('video-ready');
      requestSeek(shown * video.duration);
    };
    // o primeiro que chegar: alguns navegadores de celular não disparam canplay sem reprodução
    video.addEventListener('loadeddata', ready, { once: true });
    video.addEventListener('canplay', ready, { once: true });
    const old = objectUrl;
    objectUrl = URL.createObjectURL(blob);
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;
    video.load();
    if (old) URL.revokeObjectURL(old);
    primeVideo();
  }

  // iPhone e alguns Android só desenham o quadro buscado depois que o vídeo tocou uma vez.
  // Um play() mudo seguido de pause() destrava; se o aparelho bloquear (modo de economia),
  // o primeiro toque na tela destrava.
  function primeVideo() {
    if (primed) return;
    let p;
    try { p = video.play(); } catch (err) { p = null; }
    if (p && typeof p.then === 'function') {
      p.then(() => {
        primed = true;
        video.pause();
        if (videoReady) requestSeek(shown * video.duration);
      }).catch(armGesturePrime);
    } else {
      armGesturePrime();
    }
  }
  let gestureArmed = false;
  function armGesturePrime() {
    if (gestureArmed || primed) return;
    gestureArmed = true;
    const onGesture = () => {
      removeEventListener('touchstart', onGesture);
      removeEventListener('pointerdown', onGesture);
      gestureArmed = false;
      primeVideo();
    };
    addEventListener('touchstart', onGesture, { passive: true });
    addEventListener('pointerdown', onGesture, { passive: true });
  }
  video.addEventListener('play', () => {
    if (primed && !video.paused && scrubOn) video.pause();   // o vídeo nunca toca sozinho; quem manda é o scroll
  });

  function failVideo() {
    if (videoFailed) return;
    videoFailed = true;
    videoReady = false;
    stage.classList.add('video-failed');
    posterEnd.style.backgroundImage = `url('${ENDING_URL}')`;
    // uma seta de scroll honesta no lugar de um anel travado
    loader.innerHTML = '<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    atEnd = null;
    updateCaptions(shown);
  }

  // a faixa 1 abre montada: rampa única no carregamento, depois o scroll comanda
  function runLoadRamp() {
    if (loadRampStarted) return;
    loadRampStarted = true;
    const t0 = performance.now();
    const step = now => {
      const x = clamp((now - t0 - 200) / 1500, 0, 1);
      loadK = 1 - Math.pow(1 - x, 3);
      if (scrubOn) updateCaptions(shown);
      if (x < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // teclado: focar um botão de uma faixa leva o scroll até ela
  bands.forEach(b => b.el.addEventListener('focusin', () => {
    if (!scrubOn || b.op > 0.9) return;
    const top = hero.getBoundingClientRect().top + scrollY;
    const mid = b.last ? 1 : (b.a + b.b) / 2;
    scrollTo({ top: top + mid * heroRange(), behavior: 'instant' });
    shown = target = mid;
    updateCaptions(shown);
    if (videoReady) requestSeek(shown * video.duration);
  }));

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    initHeroOnce();
    if (variant && variant !== wantVariant() && !videoFailed) startVideoLoad();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize, { passive: true });
    lastHeroH = hero.offsetHeight;
    bands.forEach(b => { b.op = -1; b.k = -1; b.on = null; });
    cueHidden = null;
    atEnd = null;
    unpinFinalStates();
    target = shown = heroProgress();
    updateCaptions(shown);
    runLoadRamp();
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastTick = 0;
    }
  }
  function applyHeroMode() {
    if (MQLS.some(m => m.matches)) disableScrub();
    else enableScrub();
  }

  /* ===== Entradas das seções ===== */
  const revealIO = new IntersectionObserver(entries => {
    const batch = entries.filter(e => e.isIntersecting).map(e => e.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    batch.forEach((el, i) => {
      el.style.setProperty('--d', i);
      el.classList.add('in');
      revealIO.unobserve(el);
      // aposenta o atraso do escalonamento depois da entrada
      setTimeout(() => el.classList.add('settled'), i * 90 + 1300);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('.rv').forEach(el => revealIO.observe(el));

  // um elemento vivo por seção, só enquanto a seção está na tela
  const liveIO = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('live', e.isIntersecting));
  });
  $$('.sec').forEach(s => liveIO.observe(s));

  /* ===== Poeira de ouro no ambiente ===== */
  (() => {
    const dust = $('.ambient-dust');
    const r = rng(42);
    const n = innerWidth < 720 ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const m = document.createElement('i');
      m.style.cssText =
        `left:${(r() * 100).toFixed(2)}%;top:${(30 + r() * 80).toFixed(2)}%;` +
        `--s:${(1 + r() * 2.2).toFixed(2)}px;--o:${(0.16 + r() * 0.38).toFixed(2)};` +
        `--dur:${(50 + r() * 50).toFixed(1)}s;--del:-${(r() * 100).toFixed(1)}s;--dx:${((r() - 0.5) * 140).toFixed(0)}px`;
      dust.appendChild(m);
    }
  })();

  /* ===== O placar e a navegação ===== */
  const nav = $('.nav');
  const scoreBox = $('.score');
  const scoreVal = $('[data-score-val]');
  const scoreSecs = $$('[data-score]');
  const heroSec = $('.hero');
  let curScore = scoreVal.textContent;
  let navSolid = null;
  let uiQueued = false;

  function updateUI() {
    uiQueued = false;
    const mid = innerHeight * 0.5;
    let s = '0';
    for (const sec of scoreSecs) {
      if (sec.getBoundingClientRect().top <= mid) s = sec.dataset.score;
    }
    if (s !== curScore) {
      curScore = s;
      scoreVal.textContent = s;
      scoreBox.classList.toggle('game', s === 'Game');
      if (!RM.matches && scoreVal.animate) {
        scoreVal.animate(
          [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
    }
    const solid = heroSec.getBoundingClientRect().bottom < 96;
    if (solid !== navSolid) {
      navSolid = solid;
      nav.classList.toggle('solid', solid);
    }
  }
  function queueUI() {
    if (uiQueued) return;
    uiQueued = true;
    requestAnimationFrame(updateUI);
  }
  addEventListener('scroll', queueUI, { passive: true });
  addEventListener('resize', queueUI, { passive: true });
  updateUI();

  /* ===== O momento interativo: segurar para sacar ===== */
  const serve = (() => {
    const sec = $('#metodo');
    const btn = $('.serve', sec);
    const label = $('.serve-label', sec);
    const hint = $('.serve-hint', sec);
    const ball = $('.court .ball', sec);
    const shadow = $('.court .ball-shadow', sec);
    const HOLD = 1300;   // ms segurando para a bola cruzar a quadra
    const BACK = 650;    // ms para voltar quando solta cedo
    const LABEL = 'Segure para sacar';
    const HINT = hint.textContent;
    let p = 0;
    let lastP = -1;
    let holding = false;
    let done = false;
    let pinned = false;
    let raf = null;
    let last = 0;

    function draw() {
      if (p === lastP) return;
      lastP = p;
      // trajetória no chão em linha reta, altura em parábola: igual ao traço "M70 300Q400 40 730 140"
      const gx = 70 + 660 * p;
      const gy = 300 - 160 * p;
      const arc = 4 * p * (1 - p);
      ball.setAttribute('transform', `translate(${gx.toFixed(1)} ${(gy - 90 * arc).toFixed(1)}) scale(${(1 + 0.45 * arc).toFixed(3)})`);
      shadow.setAttribute('transform', `translate(${gx.toFixed(1)} ${(gy + 5).toFixed(1)}) scale(${(1 - 0.5 * arc).toFixed(3)})`);
      shadow.style.opacity = (1 - 0.6 * arc).toFixed(3);
      btn.style.setProperty('--p', p.toFixed(3));
    }

    function loop(now) {
      const dt = Math.min(64, now - (last || now));
      last = now;
      if (holding) p = Math.min(1, p + dt / HOLD);
      else p = Math.max(0, p - (dt / BACK) * (0.35 + p));   // desce suave, nunca estala
      draw();
      if (p >= 1) {
        raf = null;
        last = 0;
        complete();
        return;
      }
      if (holding || p > 0) raf = requestAnimationFrame(loop);
      else { raf = null; last = 0; }
    }

    function complete() {
      done = true;
      holding = false;
      p = 1;
      draw();
      btn.classList.remove('holding');
      sec.classList.add('served');
      label.textContent = 'Bola dentro. Sacar de novo';
      hint.textContent = 'Bola na linha. Os quatro tempos do método estão acesos.';
    }

    function reset() {
      done = false;
      holding = false;
      p = 0;
      draw();
      sec.classList.remove('served');
      label.textContent = LABEL;
      hint.textContent = HINT;
    }

    function start(e) {
      if (e) e.preventDefault();
      if (RM.matches) {   // movimento reduzido: estado final na hora, sem segurar
        if (!done) complete();
        pinned = false;
        return;
      }
      if (done) reset();
      pinned = false;
      holding = true;
      btn.classList.add('holding');
      if (raf === null) raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (!holding) return;
      holding = false;
      btn.classList.remove('holding');
      if (raf === null && !done) raf = requestAnimationFrame(loop);
    }

    btn.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      start(e);
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('keydown', e => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) start();
    });
    btn.addEventListener('keyup', e => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      stop();
    });
    btn.addEventListener('blur', stop);
    btn.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('click', e => e.preventDefault());

    draw();
    return {
      pin() {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = 0; }
        if (!done) { complete(); pinned = true; }
      },
      unpin() {
        if (pinned) { pinned = false; reset(); }
      }
    };
  })();

  /* ===== Estados finais fixados (movimento reduzido ao vivo) ===== */
  let pinnedReveals = [];
  function pinToFinalStates() {
    pinnedReveals = $$('.rv:not(.in)');
    pinnedReveals.forEach(el => el.classList.add('in', 'settled'));
    serve.pin();
  }
  function unpinFinalStates() {
    if (pinnedReveals.length) {
      pinnedReveals.forEach(el => {
        el.classList.remove('in', 'settled');
        revealIO.observe(el);   // se já estiver na tela, entra de novo na hora
      });
      pinnedReveals = [];
    }
    serve.unpin();
  }

  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  // tablet girou: troca para a versão do vídeo que cobre a nova forma da tela
  RETRATO.addEventListener('change', () => {
    if (scrubOn && variant && variant !== wantVariant() && !videoFailed) startVideoLoad();
  });
  RM.addEventListener('change', e => {
    if (e.matches) pinToFinalStates();
    else applyHeroMode();
    if (!e.matches) unpinFinalStates();
  });
  if (RM.matches) pinToFinalStates();
  applyHeroMode();

  /* ===== Formulário ===== */
  (() => {
    const form = $('#form');
    const errEl = $('.form-error', form);
    const note = $('[data-form-note]', form);
    const doneBox = $('.form-done', form);
    const doneText = $('[data-done-text]', form);
    const doneMsg = $('[data-done-msg]', form);
    const doneLink = $('[data-done-link]', form);
    const wa = String(CONTATO.whatsapp || '').replace(/\D/g, '');

    note.textContent = wa
      ? 'Ao enviar, abrimos o WhatsApp da Winner Capital com a sua mensagem pronta.'
      : 'Ao enviar, copiamos a sua mensagem e levamos você ao Direct da Winner Capital no Instagram.';

    // máscara leve de telefone
    const tel = $('#f-tel', form);
    tel.addEventListener('input', () => {
      const d = tel.value.replace(/\D/g, '').slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
      tel.value = out;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const nome = String(fd.get('nome') || '').trim();
      const fone = String(fd.get('whatsapp') || '').trim();
      const obj = String(fd.get('objetivo') || '');
      const msg = String(fd.get('mensagem') || '').trim();

      const errs = [];
      if (!nome) errs.push(['f-nome', 'Diga como podemos te chamar.']);
      if (fone.replace(/\D/g, '').length < 10) errs.push(['f-tel', 'Confira o WhatsApp com DDD.']);
      if (!obj) errs.push(['f-obj', 'Escolha o seu objetivo.']);
      $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
      if (errs.length) {
        errs.forEach(([id]) => $('#' + id).setAttribute('aria-invalid', 'true'));
        errEl.textContent = errs[0][1];
        $('#' + errs[0][0]).focus();
        return;
      }
      errEl.textContent = '';

      const text = `Olá, Winner Capital! Sou ${nome}. Meu objetivo: ${obj.toLowerCase()}.` +
        (msg ? ` ${msg}` : '') + ` Meu WhatsApp: ${fone}.`;

      if (wa) {
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
        doneLink.href = url;
        doneLink.textContent = 'Abrir o WhatsApp';
        doneText.textContent = 'Abrimos o WhatsApp da Winner Capital com a sua mensagem pronta. Se não abriu, toque no botão abaixo.';
        doneMsg.textContent = '';
        window.open(url, '_blank', 'noopener');
      } else {
        let copied = false;
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (err) { /* sem permissão de cópia: a mensagem fica visível abaixo */ }
        doneLink.href = `https://ig.me/m/${CONTATO.instagram}`;
        doneLink.textContent = 'Abrir o Direct';
        doneText.textContent = copied
          ? 'Sua mensagem foi copiada. Abra o Direct da Winner Capital e cole para enviar.'
          : 'Sua mensagem está pronta. Abra o Direct da Winner Capital e envie este texto:';
        doneMsg.textContent = text;
      }
      form.classList.add('done');
      doneBox.focus();
    });

    $('[data-form-reset]', form).addEventListener('click', () => {
      form.reset();
      form.classList.remove('done');
      $('#f-nome', form).focus();
    });
  })();
})();
