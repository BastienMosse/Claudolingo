// Client side of the Claudolingo panel: counters, bars, crab/owl behaviour, live updates.
(function () {
  const vscode = acquireVsCodeApi();
  const state = JSON.parse(document.getElementById('state').textContent);
  const locale = state.lang === 'en' ? 'en-US' : 'fr-FR';

  const app = document.getElementById('app');
  const sceneWrap = document.querySelector('.scene-wrap');
  const scene = document.getElementById('scene');
  const crab = document.getElementById('crab');
  const owl = document.getElementById('owl');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  let sceneState = state.scene;

  // --- Formatting (mirrors src/format.ts) ---

  function formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }
  const formatters = {
    tokens: formatTokens,
    int: n => Math.round(n).toLocaleString(locale),
  };

  // --- Counters and bars, animated from their previous value ---

  const previous = { counts: {}, dims: {} };

  function animateCounts(root, fromZero) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.key;
      const to = Number(el.dataset.count);
      const fmt = formatters[el.dataset.format] || formatters.int;
      const from = fromZero ? 0 : (previous.counts[key] ?? to);
      previous.counts[key] = to;
      if (from === to) { el.textContent = fmt(to); return; }

      const duration = 1100;
      let start = null;
      const step = now => {
        if (start === null) start = now;
        const t = Math.max(0, Math.min(1, (now - start) / duration));
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = fmt(from);
      requestAnimationFrame(step);
    });
  }

  function animateDims(root, fromZero) {
    const els = [...root.querySelectorAll('[data-target]')];
    els.forEach(el => {
      const dim = el.dataset.dim || 'width';
      const from = fromZero ? 0 : (previous.dims[el.dataset.key] ?? Number(el.dataset.target));
      el.style.transition = 'none';
      el.style[dim] = from + '%';
    });
    void root.offsetWidth; // commit the start values before transitioning
    requestAnimationFrame(() => els.forEach(el => {
      const dim = el.dataset.dim || 'width';
      el.style.transition = '';
      el.style[dim] = el.dataset.target + '%';
      previous.dims[el.dataset.key] = Number(el.dataset.target);
    }));
  }

  // --- Scene ---

  /** Shrinks the bubble text until it fits. */
  function fitBubble() {
    if (!bubbleText) return;
    const box = bubbleText.parentElement;
    let size = 38;
    bubbleText.style.fontSize = size + 'px';
    while (size > 12 && (bubbleText.offsetHeight > box.clientHeight || bubbleText.scrollWidth > box.clientWidth)) {
      size -= 1;
      bubbleText.style.fontSize = size + 'px';
    }
  }

  function restartClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
  }

  /** French spacing: keeps "?" or "!" from wrapping alone onto a new line. */
  function nbsp(text) {
    return text.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
  }

  function setBubble(text) {
    if (!bubbleText) return;
    bubbleText.textContent = nbsp(text);
    fitBubble();
    restartClass(bubble, 'pop');
  }

  /** Centers the flame + "N jours" group on the sign (its width depends on the text). */
  function centerSignTitle() {
    const title = document.getElementById('sign-title');
    if (!title) return;
    title.removeAttribute('transform');
    const box = title.getBBox();
    title.setAttribute('transform', `translate(${195 - (box.x + box.width / 2)} 0)`);
  }

  function applyScene(s) {
    const bubbleChanged = s.bubble !== sceneState.bubble;
    sceneState = s;
    scene.dataset.mood = s.mood;
    scene.dataset.full = s.full ? '1' : '0';
    sceneWrap.dataset.fire = String(s.fire);

    const label = document.getElementById('counter-text');
    if (label) {
      label.textContent = s.streakLabel;
      document.getElementById('sign-fill').setAttribute('width', s.barW);
      document.getElementById('sign-fill-hl').setAttribute('width', s.barHlW);
      document.getElementById('sign-crack').setAttribute('transform', `translate(${s.crackX} 150)`);
      centerSignTitle();
    }
    if (bubbleChanged) setBubble(s.bubble);
  }

  /** Blinks at random intervals, sometimes twice. */
  function blinkLoop(el, min, max) {
    if (!el) return;
    const blink = () => {
      el.classList.add('blink');
      setTimeout(() => el.classList.remove('blink'), 140);
    };
    const loop = () => {
      blink();
      if (Math.random() < 0.25) setTimeout(blink, 280);
      setTimeout(loop, min + Math.random() * (max - min));
    };
    setTimeout(loop, min);
  }

  function crabReact(newMessage) {
    restartClass(crab, 'jump');
    restartClass(scene, 'jumping');
    restartClass(owl, 'startle');
    if (newMessage) {
      const current = bubbleText ? bubbleText.textContent : '';
      const pool = sceneState.messages.filter(m => m !== current);
      if (pool.length) setBubble(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  if (crab) {
    crab.addEventListener('click', () => crabReact(true));
    crab.addEventListener('animationend', e => {
      if (e.animationName === 'crab-jump') {
        crab.classList.remove('jump');
        scene.classList.remove('jumping');
      }
    });
  }
  if (owl) {
    owl.addEventListener('animationend', e => {
      if (e.animationName === 'startle') owl.classList.remove('startle');
    });
  }

  // --- Easter egg ---

  function confetti() {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const colors = ['#ff9600', '#ffc800', '#ea623e', '#ffffff', '#ff4b4b', '#ffb84d'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('i');
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.8 + 's';
      piece.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      piece.style.setProperty('--dx', (Math.random() * 140 - 70) + 'px');
      piece.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4500);
  }

  // --- Refresh button & messages from the extension ---

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="refresh"]');
    if (btn) {
      btn.classList.add('spinning');
      vscode.postMessage({ command: 'refresh' });
      return;
    }
    const tab = e.target.closest('.lb-tab');
    if (tab) { setBoard(tab.dataset.board); return; }
    const edit = e.target.closest('[data-action="edit-pseudo"]');
    if (edit) {
      const form = edit.closest('.card')?.querySelector('[data-form="pseudo"]');
      if (form) {
        form.classList.toggle('hidden');
        const input = form.querySelector('.lb-input');
        if (input && !form.classList.contains('hidden')) input.focus();
      }
    }
  });

  // --- Leaderboard: pseudo form & tab switching ---

  let activeBoard = 'alltime';

  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-form="pseudo"]');
    if (!form) return;
    e.preventDefault();
    const pseudo = (form.querySelector('.lb-input')?.value || '').trim();
    if (pseudo) vscode.postMessage({ command: 'setPseudo', pseudo });
  });

  function setBoard(board) {
    activeBoard = board;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.board === board));
    document.querySelectorAll('.lb-panel').forEach(p => p.classList.toggle('active', p.dataset.board === board));
  }

  function stopSpinning() {
    document.querySelectorAll('.btn.spinning').forEach(b => b.classList.remove('spinning'));
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'update') {
      applyScene(msg.scene);
      const dash = document.getElementById('dashboard');
      if (dash) {
        app.classList.add('updated');
        dash.innerHTML = msg.dashboard;
        setBoard(activeBoard); // the swap resets tabs; restore the one in view
        animateCounts(dash, false);
        animateDims(dash, false);
      }
      stopSpinning();
    } else if (msg.type === 'still-missing') {
      // Error page: still no stats, the crab complains
      crabReact(true);
      stopSpinning();
    }
  });

  // --- Boot ---

  if (bubbleText) bubbleText.textContent = nbsp(bubbleText.textContent);

  document.fonts.ready.then(() => {
    centerSignTitle();
    fitBubble();
    setTimeout(() => {
      scene.classList.add('ready');
      restartClass(bubble, 'pop');
    }, 350);
  });

  blinkLoop(crab, 2200, 5200);
  blinkLoop(owl, 2600, 6000);

  const dash = document.getElementById('dashboard');
  if (dash) {
    setTimeout(() => animateCounts(dash, true), 250);
    animateDims(dash, true);
  }
  if (app && app.dataset.billion) setTimeout(confetti, 600);
})();
