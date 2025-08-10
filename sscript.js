// sscript.js — fixed: add/edit/remove/shuffle players + spin + modal + bottle 50px width
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const $ = sel => document.querySelector(sel);

  // Elements (match your indor.html)
  const canvas = $('#bottleCanvas');
  const canvasWrap = $('#canvas-wrap');
  const playersListEl = $('#playersList');
  const addPlayerBtn = $('#addPlayerBtn');
  const shuffleNamesBtn = $('#shuffleNamesBtn');
  const spinBtn = $('#spinBtn');
  const stopBtn = $('#stopBtn');
  const strengthRange = $('#strengthRange');
  const truthsTA = $('#truths');
  const daresTA = $('#dares');
  const resetPromptsBtn = $('#resetPrompts');
  const exportSettingsBtn = $('#exportSettings');
  const selectedNameEl = $('#selectedName');
  const modeSelect = $('#modeSelect');
  const currentModeEl = $('#currentMode');
  const ringEl = $('#ring');
  const modal = $('#resultModal');
  const resultTitle = $('#resultTitle');
  const resultText = $('#resultText');
  const closeModalBtn = $('#closeModal');
  const newSpinBtn = $('#newSpin');
  const copyBtn = $('#copyBtn');

  if (!canvas || !canvasWrap || !playersListEl || !ringEl) {
    console.error('Missing core DOM elements — check IDs in your HTML.');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true });

  // image (bottle.png) with fallback
  const bottleImg = new Image();
  let imgLoaded = false;
  bottleImg.src = 'bottle.png';
  bottleImg.onload = () => { imgLoaded = true; resizeCanvas(); updateRing(); };
  bottleImg.onerror = () => { imgLoaded = false; /* fallback used */ };

  // canvas sizing
  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let canvasW = 0, canvasH = 0;
  function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    const w = rect.width || Math.max(360, window.innerWidth * 0.5);
    const h = rect.height || Math.max(300, window.innerHeight * 0.45);
    canvasW = Math.max(300, Math.round(w));
    canvasH = Math.max(240, Math.round(h));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvasW * DPR;
    canvas.height = canvasH * DPR;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    updateRing();
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvasWrap);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  setTimeout(resizeCanvas, 30);

  // players array & UI
  const defaultPlayers = ['Vamshi','Ganesh','Srinu','Karthik','Arun','Tharun'];
  let players = [...defaultPlayers];
let zoomScale = 1; // normal size
  function createPlayerElement(name, idx) {
    const el = document.createElement('div');
    el.className = 'player-chip';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = name || `Player ${idx+1}`;
    input.dataset.idx = String(idx);
    input.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.idx);
      if (!Number.isNaN(i)) {
        players[i] = e.target.value;
        updateRing();
      }
    });

    const rem = document.createElement('button');
    rem.className = 'btn ghost';
    rem.textContent = '✕';
    rem.style.padding = '6px';
    rem.addEventListener('click', () => {
      players.splice(idx, 1);
      renderPlayers();
    });

    el.appendChild(input);
    el.appendChild(rem);
    return el;
  }

  function renderPlayers() {
    playersListEl.innerHTML = '';
    players.forEach((p, i) => {
      playersListEl.appendChild(createPlayerElement(p, i));
    });
    updateRing();
  }

  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', () => {
      players.push('Player ' + (players.length + 1));
      renderPlayers();
      setTimeout(() => {
        const inputs = playersListEl.querySelectorAll('input[type="text"]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 40);
    });
  }

  if (shuffleNamesBtn) {
    shuffleNamesBtn.addEventListener('click', () => {
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }
      renderPlayers();
    });
  }

  function getListFromTextarea(ta) {
    return ta && ta.value ? ta.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  }
  if (resetPromptsBtn) {
    resetPromptsBtn.addEventListener('click', () => {
      truthsTA.value = "What's your most embarrassing moment?\nWho was your secret crush?\nHave you ever lied to a friend?";
      daresTA.value = "Do 20 jumping jacks.\nSing the chorus of a song.\nWear socks on your hands for 5 minutes.";
    });
  }
  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', () => {
      const data = { players, truths: getListFromTextarea(truthsTA), dares: getListFromTextarea(daresTA) };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'tod_settings.json'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ---------- spin physics ----------
  let spinning = false;
  let angularVelocity = 0;
  let bottleAngle = 0;

  function startSpin() {
    if (spinning) return;
    spinning = true;
    const s = Number(strengthRange?.value) || 6;
    const sign = Math.random() < 0.5 ? 1 : -1;
    angularVelocity = (8 + Math.random() * 4) * s * sign;
    if (spinBtn) spinBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
  }
  if (spinBtn) spinBtn.addEventListener('click', startSpin);

  function stopSpinImmediate() {
    angularVelocity *= 0.05;
  }
  if (stopBtn) stopBtn.addEventListener('click', stopSpinImmediate);

  function finalizeSpin() {
  // stop physics and enable buttons
  spinning = false;
  if (spinBtn) spinBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;

  const twoPI = Math.PI * 2;
  const n = Math.max(1, players.length);
  const sector = twoPI / n;

  // compute pointer/top direction of the bottle:
  // the bottle graphic's top points at angle (bottleAngle - PI/2)
  const pointerAngle = ((bottleAngle - Math.PI / 2) % twoPI + twoPI) % twoPI;

  // find which player angle is closest to pointerAngle
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < n; i++) {
    const playerAngle = ((i / n) * twoPI - Math.PI / 2 + twoPI) % twoPI;
    // circular difference
    let diff = Math.abs(pointerAngle - playerAngle);
    if (diff > Math.PI) diff = twoPI - diff;
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  // animate a short snap so the bottle visually centers on that player
  const targetPlayerAngle = ((closestIdx / n) * twoPI - Math.PI / 2 + twoPI) % twoPI;
  let targetBottleAngle = targetPlayerAngle + Math.PI / 2; // pointer = bottleAngle - PI/2 => bottleAngle = pointer + PI/2

  // choose nearest wrap of targetBottleAngle to current bottleAngle
  while (targetBottleAngle - bottleAngle > Math.PI) targetBottleAngle -= twoPI;
  while (targetBottleAngle - bottleAngle < -Math.PI) targetBottleAngle += twoPI;

  const start = bottleAngle;
  const duration = 420; // ms
  const startTime = performance.now();

  function snapStep() {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    bottleAngle = start + (targetBottleAngle - start) * ease;
    if (t < 1) requestAnimationFrame(snapStep);
    else {
      // ensure canonical angle
      bottleAngle = ((targetBottleAngle % twoPI) + twoPI) % twoPI;
      // show result
      showResultModal(players[closestIdx] || `Player ${closestIdx + 1}`);
    }
  }

  requestAnimationFrame(snapStep);
}

  // ---------- bottle drawing ----------
  function drawBottleImage(cx, cy, baseScale, rotation) {
    if (imgLoaded && bottleImg.width && bottleImg.height) {
      const scale = baseScale;
      const bottleH = bottleImg.height * scale;
      const bottleW = bottleImg.width * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.drawImage(bottleImg, -bottleW / 2, -bottleH / 2, bottleW, bottleH);
      ctx.restore();
    }
  }

  // ---------- animation loop ----------
  let lastTime = performance.now();
  function render(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (spinning) {
      bottleAngle += angularVelocity * dt;
      angularVelocity -= angularVelocity * 2.2 * dt;
      angularVelocity += (Math.random() - 0.5) * 0.0008;
      if (Math.abs(angularVelocity) < 0.06) {
        finalizeSpin();
      }
    }

    ctx.clearRect(0, 0, canvasW, canvasH);
    const cx = canvasW / 2;
    const cy = canvasH / 2 + 8;
    // bottle fixed at 50px wide
      
    // 50px starting bottle height
const baseScale = (250 / bottleImg.height) * zoomScale;
drawBottleImage(cx, cy, baseScale, bottleAngle);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---------- ring rendering ----------
  function updateRing() {
    if (!canvasW || !canvasH) resizeCanvas();
    ringEl.innerHTML = '';
    const n = Math.max(1, players.length);
    const radius = Math.min(190, Math.max(110, Math.min(canvasW, canvasH) * 0.33)) * zoomScale;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const badge = document.createElement('div');
      badge.className = 'player-badge';
      badge.style.left = '50%';
      badge.style.top = '50%';
      badge.style.transform = `translate(-50%,-50%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = players[i] ? players[i].charAt(0).toUpperCase() : '?';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = players[i] || `Player ${i+1}`;
      badge.appendChild(avatar);
      badge.appendChild(name);
      ringEl.appendChild(badge);
    }
  }

  // ---------- modal ----------
  function showResultModal(name) {
    const old = modal.querySelector('.modal-player-badge');
    if (old) old.remove();

    const badge = document.createElement('div');
    badge.className = 'player-badge modal-player-badge';
    badge.style.position = 'relative';
    badge.style.left = 'auto';
    badge.style.top = 'auto';
    badge.style.transform = 'none';
    badge.style.margin = '0 auto 8px';
    badge.style.width = '140px';
    badge.style.pointerEvents = 'none';
    badge.style.display = 'flex';
    badge.style.flexDirection = 'column';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = name ? name.charAt(0).toUpperCase() : '?';
    avatar.style.width = '56px';
    avatar.style.height = '56px';
    avatar.style.fontSize = '20px';

    const pname = document.createElement('div');
    pname.className = 'name';
    pname.textContent = name;
    pname.style.fontSize = '15px';

    badge.appendChild(avatar);
    badge.appendChild(pname);
    modal.insertBefore(badge, resultTitle);

    if (selectedNameEl) selectedNameEl.textContent = name;

    const mode = modeSelect.value;
    let chosenType;
    if (mode === 'truthOrDare') chosenType = Math.random() < 0.5 ? 'Truth' : 'Dare';
    else chosenType = mode === 'truthOnly' ? 'Truth' : 'Dare';
    const pool = chosenType === 'Truth' ? getListFromTextarea(truthsTA) : getListFromTextarea(daresTA);
    const item = pool.length ? pool[Math.floor(Math.random() * pool.length)] :
      (chosenType === 'Truth' ? 'Share something...' : 'Do a silly dare...');

    resultTitle.textContent = `${chosenType}`;
    resultText.textContent = item;
    modal.classList.add('show');
    modal.style.display = 'block';
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    modal.style.display = 'none';
  });
  if (newSpinBtn) newSpinBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    modal.style.display = 'none';
    startSpin();
  });
  if (copyBtn) copyBtn.addEventListener('click', () => {
    try {
      navigator.clipboard?.writeText(`${resultTitle.textContent}: ${resultText.textContent}`);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 1000);
    } catch (e) {}
  });

  if (modeSelect && currentModeEl) {
    currentModeEl.textContent = modeSelect.options[modeSelect.selectedIndex].text;
    modeSelect.addEventListener('change', (e) => {
      currentModeEl.textContent = e.target.options[e.target.selectedIndex].text;
    });
  }

  renderPlayers();
  setTimeout(() => { resizeCanvas(); updateRing(); }, 80);
document.getElementById('zoomRange').addEventListener('input', (e) => {
  zoomScale = parseFloat(e.target.value);
  updateRing();
});
});