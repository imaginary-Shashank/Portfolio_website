/**
 * main.js — Atomic Orbital Particle Cloud Animation
 *
 * Pattern & Layout:
 *   - Traces the 16-lobe 2-shell atomic orbital probability density pattern from the reference image.
 *   - Outer electron clouds span across the full viewport to the very edges of the landing page.
 *   - White background (#ffffff).
 *   - Reference image white/grey lobes -> Slate Grey cloud particles.
 *   - Reference image blue lobes       -> Vibrant Orange cloud particles.
 *   - Soft fading probability clouds spanning across the full landing page without hard boundaries.
 *
 * Interaction & Motion:
 *   - Latent / Stationary: Orbital particles are dormant & translucent (~0.035 alpha), almost invisible against the white bg.
 *   - Cursor Movement: Triggers a gentle, slow, high-precision vibrational motion + a cinematic slow wave impulse that propagates gracefully through the atomic cloud in the direction of cursor travel.
 *   - Smooth, fluid wave speed and gradual decay back to dormant state when cursor stops.
 */

(function () {
  'use strict';

  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════════
     ATOMIC ORBITAL WAVE & VIBRATION ENGINE
     ═══════════════════════════════════════════════════════ */

  const AtomicOrbitalEngine = (function () {

    /* ── Configuration ─────────────────────────────────── */
    const NUM_PARTICLES = 4200; // Rich quantum point cloud spanning full viewport

    // Palette: Slate Grey & Vibrant Orange
    const COLOR_GREY = { r: 110, g: 120, b: 135 }; // Slate grey (ref white/grey)
    const COLOR_ORANGE = { r: 240, g: 115, b: 35 }; // Vibrant orange (ref blue)

    // Orbital geometry parameters (2 concentric shells of 8 lobes each)
    const LOBE_COUNT = 8;

    /* ── State ─────────────────────────────────────────── */
    let canvas, ctx, dpr;
    let W = 0, H = 0;
    let particles = [];
    let heroContentEl = null;

    // Cursor tracking & physics
    let mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, speed: 0, active: false };
    let smoothMouse = { x: -9999, y: -9999 };

    // Excitation & wave pulse parameters
    let excitation = 0;         // Overall system energy [0..1]
    let wavePulse = {
      x: 0, y: 0,               // Pulse center
      dirX: 1, dirY: 0,         // Direction vector
      time: 0,                  // Age of pulse
      speed: 0,                 // Pulse intensity
    };

    let rafId = null;
    let resizeTimer = null;
    let startTime = 0;
    let lastTs = 0;

    /* ── Particle Generator ────────────────────────────── */

    /**
     * Samples points distributed according to the reference atomic orbital density map:
     * - Inner shell: 8 lobes at radius R1 (4 Grey, 4 Orange alternating)
     * - Outer shell: 8 lobes at radius R2 (4 Orange, 4 Grey alternating opposite phase)
     * - Outer edge spans all the way to the full edges of the landing page!
     */
    function buildOrbitalCloud() {
      particles = [];

      // Calculate maximum distance to cover the entire viewport corners
      const maxScreenR = Math.hypot(W, H) * 0.58;

      // 3 Radial shells / layers to create a continuous full-viewport span
      const rInner = maxScreenR * 0.22;
      const rMid = maxScreenR * 0.52;
      const rOuter = maxScreenR * 0.88;

      for (let i = 0; i < NUM_PARTICLES; i++) {
        // Pick shell layer: 30% inner, 40% mid, 30% outer
        const randShell = Math.random();
        let targetRadius, spreadR, isOuter;

        if (randShell < 0.30) {
          targetRadius = rInner;
          spreadR = rInner * 0.40;
          isOuter = false;
        } else if (randShell < 0.70) {
          targetRadius = rMid;
          spreadR = rMid * 0.35;
          isOuter = true;
        } else {
          targetRadius = rOuter;
          spreadR = rOuter * 0.38;
          isOuter = true;
        }

        // Pick one of the 8 angular lobe directions (0, 45°, 90°, 135°, ...)
        const lobeIdx = Math.floor(Math.random() * LOBE_COUNT);
        const lobeAngle = (lobeIdx * Math.PI * 2) / LOBE_COUNT;

        // Angular jitter around lobe center (Gaussian distribution approximation)
        const angleJitter = (Math.random() + Math.random() - 1.0) * 0.35;
        const angle = lobeAngle + angleJitter;

        // Radial jitter from lobe center
        const radialJitter = (Math.random() + Math.random() - 1.0) * spreadR;
        const dist = Math.max(10, targetRadius + radialJitter);

        // Normalized relative position from center
        const relX = dist * Math.cos(angle);
        const relY = dist * Math.sin(angle);

        // Determine color according to reference pattern:
        // Inner shell: even lobes = GREY, odd lobes = ORANGE
        // Outer shell: even lobes = ORANGE, odd lobes = GREY
        let isOrange;
        if (!isOuter) {
          isOrange = (lobeIdx % 2 !== 0);
        } else {
          isOrange = (lobeIdx % 2 === 0);
        }

        const color = isOrange ? COLOR_ORANGE : COLOR_GREY;

        // Particle size (fine stippled dots)
        const baseSize = isOrange
          ? (1.2 + Math.random() * 1.8)
          : (1.0 + Math.random() * 1.5);

        // Individual vibration frequency (slower, organic micro-wobble)
        const vibFreq = 4.5 + Math.random() * 6.5;
        const vibPhase = Math.random() * Math.PI * 2;

        particles.push({
          relX,              // Offset from canvas center X
          relY,              // Offset from canvas center Y
          dist,              // Distance from center
          angle,             // Angle from center
          color,             // RGB color
          isOrange,
          baseSize,
          vibFreq,
          vibPhase,
          // Runtime state
          x: 0,
          y: 0,
          currentAlpha: 0.135, // Base visibility increased by 10% (0.135)
          currentSize: baseSize,
        });
      }
    }

    /* ── Physics & Animation Update ────────────────────── */

    function update(t, dt) {
      const centerX = W * 0.5;
      const centerY = H * 0.5;

      // 1. Calculate cursor speed and smooth mouse position
      if (mouse.active) {
        const dx = mouse.x - mouse.px;
        const dy = mouse.y - mouse.py;
        const distMoved = Math.hypot(dx, dy);

        mouse.speed = distMoved;

        // Trigger wave pulse with a much lower speed cutoff threshold (0.005)
        if (distMoved > 0.8) {
          const invLen = 1 / distMoved;
          mouse.vx = dx * invLen;
          mouse.vy = dy * invLen;

          // Trigger / update directional wave pulse
          wavePulse.x = mouse.x;
          wavePulse.y = mouse.y;
          wavePulse.dirX = mouse.vx;
          wavePulse.dirY = mouse.vy;
          wavePulse.speed = Math.min(1.0, distMoved / 10.0);
          wavePulse.time = t;
        }

        mouse.px = mouse.x;
        mouse.py = mouse.y;
      } else {
        mouse.speed *= 0.965; // Slower mouse speed falloff
      }

      // Smooth cursor lerp
      smoothMouse.x += (mouse.x - smoothMouse.x) * 0.06;
      smoothMouse.y += (mouse.y - smoothMouse.y) * 0.06;

      // 2. Excitation surge / decay (slower color and energy decay)
      const targetExcitation = Math.min(1.0, mouse.speed / 14.0);
      if (targetExcitation > excitation) {
        excitation += (targetExcitation - excitation) * 0.15;
      } else {
        excitation *= 0.985; // Slower, lingering color & energy decay (~5s fade)
      }

      // 2.5. Update central text opacity dynamically based on cursor excitation
      if (heroContentEl) {
        // Base opacity at rest = 0.25; full opacity on movement = 1.0
        const targetOpacity = 0.25 + excitation * 0.75;
        let currentOpacity = parseFloat(heroContentEl.style.opacity || "1.0");
        if (isNaN(currentOpacity)) currentOpacity = 1.0;

        const nextOpacity = currentOpacity + (targetOpacity - currentOpacity) * 0.04;
        heroContentEl.style.opacity = nextOpacity.toFixed(3);
      }

      // Baseline energy (increased base visibility by 10%)
      const effectiveEnergy = Math.max(0.135, excitation);

      // 3. Update each particle position, vibration, & wave displacement
      const numP = particles.length;
      const SPEED_CUTOFF = 0.003; // Very low speed cutoff threshold (0.003)
      const MAX_WAVE_DURATION = 7.0; // Slower wave decay duration (7.0 seconds!)

      for (let i = 0; i < numP; i++) {
        const p = particles[i];

        // Base resting position centered on screen
        const restX = centerX + p.relX;
        const restY = centerY + p.relY;

        // --- A. Vibrational Motion ---
        const vibTime = t * p.vibFreq + p.vibPhase;
        const vibAmp = 0.6 + effectiveEnergy * 5.5; // Soft vibrational amplitude
        const vibX = Math.sin(vibTime) * vibAmp;
        const vibY = Math.cos(vibTime * 1.2 + p.vibPhase) * vibAmp;

        // --- B. Directional Wave Impulse (Slower 7-Second Linear Decay Physics) ---
        const pdx = restX - wavePulse.x;
        const pdy = restY - wavePulse.y;
        const pDistFromCursor = Math.hypot(pdx, pdy);

        const waveAge = Math.max(0, t - wavePulse.time);

        // Slower linear decay factor: smoothly fades from 1.0 to 0.0 over 7.0 seconds
        const linearTimeDecay = Math.max(0, 1.0 - (waveAge / MAX_WAVE_DURATION));

        let waveDisp = 0;
        let waveExcitation = 0;

        if (linearTimeDecay > 0 && wavePulse.speed > SPEED_CUTOFF) {
          const waveFrontDist = waveAge * 200; // Smooth wave propagation speed (200px/sec)
          const distToFront = Math.abs(pDistFromCursor - waveFrontDist);

          // Wider linear spatial fade around the wave front
          const spatialEnvelope = Math.max(0, 1.0 - (distToFront / 420));

          // Combined linear envelope
          const totalLinearEnvelope = linearTimeDecay * spatialEnvelope * wavePulse.speed;

          waveDisp = Math.sin(pDistFromCursor * 0.015 - waveAge * 4.8) * 22.0 * totalLinearEnvelope;
          waveExcitation = totalLinearEnvelope;
        }

        // Apply directional wave displacement along cursor travel direction
        const waveX = wavePulse.dirX * waveDisp;
        const waveY = wavePulse.dirY * waveDisp;

        // --- C. Proximity Excitation ---
        const cursorRadius = 420;
        const proxFactor = Math.max(0, 1 - pDistFromCursor / cursorRadius);
        const proxExcitation = Math.pow(proxFactor, 1.5) * (mouse.speed > 0.3 ? 0.9 : 0.2);

        // --- F. Resting Heartbeat Wave (Radial outward single contraction wave) ---
        const heartPeriod = 6.4; // 6.4s cycle ~ 9 BPM
        const heartSpeed = 130;  // Wave speed maintained at 130px/sec
        let tCycle = (t - p.dist / heartSpeed) % heartPeriod;
        if (tCycle < 0) tCycle += heartPeriod;

        let heartDisp = 0;
        let heartExcitation = 0;

        // Single smooth pulse: 2.2 seconds active beat duration
        if (tCycle < 2.20) {
          const peak = Math.sin((tCycle / 2.20) * Math.PI);
          heartDisp = peak * 25.0;         // Outward expansion amplitude
          heartExcitation = peak * 0.70;   // Brightness/glow amplitude
        }

        // Heartbeat dominates only when cursor is at rest
        const heartFactor = Math.max(0, 1.0 - excitation * 1.5);
        heartDisp *= heartFactor;
        heartExcitation *= heartFactor;

        // --- D. Position Assignment ---
        p.x = restX + vibX + waveX + Math.cos(p.angle) * heartDisp;
        p.y = restY + vibY + waveY + Math.sin(p.angle) * heartDisp;

        // --- E. Central Text Clearance (Smaller particle size near center text) ---
        const centerDist = Math.hypot(p.relX, p.relY);
        const textZoneRadius = 320;
        const centerNorm = Math.min(1.0, centerDist / textZoneRadius);
        const centerSizeScale = 0.50 + 0.50 * Math.pow(centerNorm, 1.4);

        // Target Alpha: dormant (0.135) up to active (1.0) when excited
        const totalActivity = Math.min(1.0, effectiveEnergy * 0.75 + waveExcitation * 0.85 + proxExcitation * 0.80 + heartExcitation * 0.65);
        const targetAlpha = 0.135 + totalActivity * 0.65;

        // Silkier alpha transition
        p.currentAlpha += (targetAlpha - p.currentAlpha) * 0.035;

        // Size expansion under excitement multiplied by central clearance scaling
        p.currentSize = p.baseSize * (1.0 + totalActivity * 0.35) * centerSizeScale;

        // Save state values for the firefly glow renderer
        p.waveExcitation = waveExcitation;
        p.heartExcitation = heartExcitation;
      }
    }

    /* ── Render ───────────────────────────────────────── */

    // Draw frame with dynamic firefly glows synced to wave age and heartbeat
    function draw(t) {
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear canvas
      ctx.clearRect(0, 0, W, H);

      const numP = particles.length;

      // Draw all atomic cloud particles
      for (let i = 0; i < numP; i++) {
        const p = particles[i];
        if (p.currentAlpha < 0.012) continue;

        const { r, g, b } = p.color;

        // 1. Draw the glowing firefly halo (Subtle glow, increased by 20%)
        const glowFactor = Math.min(1.0, p.waveExcitation * 1.5 + excitation * 0.38 + p.heartExcitation * 0.60) * 0.30;
        if (glowFactor > 0.01) {
          // Soft high-frequency firefly pulsation (increased by 20%)
          const flutter = Math.sin(t * 15.0 + p.vibPhase) * 0.30;
          const glowSize = p.currentSize * (1.18 + glowFactor * 4.2 + flutter * 0.6);
          const glowAlpha = p.currentAlpha * glowFactor * 0.46;

          ctx.beginPath();
          ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha.toFixed(3)})`;
          ctx.fill();
        }

        // 2. Draw the solid core particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.currentSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.currentAlpha.toFixed(3)})`;
        ctx.fill();
      }

      ctx.restore();
    }

    /* ── RAF Loop ─────────────────────────────────────── */

    function loop(ts) {
      const t = (ts - startTime) / 1000;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      update(t, dt);
      draw(t);
      rafId = requestAnimationFrame(loop);
    }

    /* ── Resize Handler ───────────────────────────────── */

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      buildOrbitalCloud();
    }

    /* ── Event Listeners ──────────────────────────────── */

    function onMouseMove(e) {
      if (!mouse.active) {
        mouse.px = e.clientX;
        mouse.py = e.clientY;
      }
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }

    function onMouseLeave() {
      mouse.active = false;
    }

    function onTouchMove(e) {
      const touch = e.touches[0];
      if (!mouse.active) {
        mouse.px = touch.clientX;
        mouse.py = touch.clientY;
      }
      mouse.x = touch.clientX;
      mouse.y = touch.clientY;
      mouse.active = true;
    }

    function onTouchEnd() {
      mouse.active = false;
    }

    /* ── Public Init ──────────────────────────────────── */

    function init(canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      heroContentEl = document.querySelector('.hero-content');

      resize();

      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mouseleave', onMouseLeave, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });

      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (rafId) cancelAnimationFrame(rafId);
          resize();
          startTime = performance.now();
          lastTs = startTime;
          rafId = requestAnimationFrame(loop);
        }, 120);
      }, { passive: true });

      if (prefersReducedMotion) {
        // Reduced motion snapshot
        update(0, 0);
        draw();
      } else {
        startTime = performance.now();
        lastTs = startTime;
        rafId = requestAnimationFrame(loop);
      }
    }

    return { init };
  })();

  /* ═══════════════════════════════════════════════════════
     ENTRANCE SEQUENCE
     ═══════════════════════════════════════════════════════ */

  function runEntrance() {
    const wordmark = document.querySelector('.wordmark');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const eyebrow = document.querySelector('.hero-eyebrow');
    const nameLines = Array.from(document.querySelectorAll('.name-line'));
    const statement = document.querySelector('.hero-statement');
    const scrollInd = document.querySelector('.scroll-indicator');
    const graphicBtn = document.querySelector('.graphic-info-btn');

    if (prefersReducedMotion) {
      if (wordmark) wordmark.style.opacity = '1';
      navLinks.forEach(l => { l.style.opacity = '1'; });
      if (eyebrow) eyebrow.classList.add('is-visible');
      nameLines.forEach(l => l.classList.add('is-visible'));
      if (statement) statement.classList.add('is-visible');
      if (scrollInd) scrollInd.classList.add('is-visible');
      if (graphicBtn) graphicBtn.classList.add('is-visible');
      return;
    }

    setTimeout(() => {
      if (wordmark) wordmark.style.opacity = '1';
      navLinks.forEach((l, i) =>
        setTimeout(() => { l.style.opacity = '1'; }, i * 90)
      );
    }, 220);

    setTimeout(() => { if (eyebrow) eyebrow.classList.add('is-visible'); }, 400);
    setTimeout(() => { nameLines.forEach(l => l.classList.add('is-visible')); }, 600);
    setTimeout(() => { if (statement) statement.classList.add('is-visible'); }, 880);
    setTimeout(() => {
      if (scrollInd) scrollInd.classList.add('is-visible');
      if (graphicBtn) graphicBtn.classList.add('is-visible');
    }, 1300);
  }

  /* ── Header Scroll State ──────────────────────────── */

  function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('is-scrolled', window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Boot ─────────────────────────────────────────── */

  function boot() {
    const canvas = document.getElementById('benzene-canvas');
    if (canvas) AtomicOrbitalEngine.init(canvas);

    initHeaderScroll();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runEntrance);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(runEntrance));
    }
  }

  boot();

})();
