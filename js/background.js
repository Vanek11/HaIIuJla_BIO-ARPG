/* =========================================================
   background.js — shared interactive background
   Used by BOTH the hub and the game (loaded in an iframe),
   so they share the exact same particle field + custom cursor.
   Exposes: window.initBackground(canvasId), window.initCursor(selector)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Interactive particle field ---------- */
  function initBackground(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const mouse = { x: null, y: null, radius: 150 };

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
    window.addEventListener('mouseout', () => { mouse.x = undefined; mouse.y = undefined; });

    function Particle() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 2 + 1;
      this.baseX = this.x;
      this.baseY = this.y;
      this.density = (Math.random() * 30) + 1;
      this.color = Math.random() > 0.5 ? '#00f3ff' : '#bc13fe';
    }
    Particle.prototype.draw = function () {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    };
    Particle.prototype.update = function () {
      if (mouse.x === undefined || mouse.y === undefined) return;
      let dx = mouse.x - this.x;
      let dy = mouse.y - this.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      let maxDistance = mouse.radius;
      let forceDirectionX = dx / distance;
      let forceDirectionY = dy / distance;
      let force = (maxDistance - distance) / maxDistance;
      let directionX = forceDirectionX * force * this.density;
      let directionY = forceDirectionY * force * this.density;

      if (distance < mouse.radius) {
        this.x -= directionX;
        this.y -= directionY;
      } else {
        if (this.x !== this.baseX) this.x -= (this.x - this.baseX) / 10;
        if (this.y !== this.baseY) this.y -= (this.y - this.baseY) / 10;
      }
    };

    function initParticles() {
      particles = [];
      const numberOfParticles = (width * height) / 9000;
      for (let i = 0; i < numberOfParticles; i++) particles.push(new Particle());
    }
    function connectParticles() {
      let opacityValue = 1;
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          let distance = ((particles[a].x - particles[b].x) * (particles[a].x - particles[b].x))
                       + ((particles[a].y - particles[b].y) * (particles[a].y - particles[b].y));
          if (distance < (width / 10) * (height / 10)) {
            opacityValue = 1 - (distance / 20000);
            ctx.strokeStyle = 'rgba(0, 243, 255, ' + (opacityValue * 0.2) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    }
    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      connectParticles();
      requestAnimationFrame(animate);
    }

    resize();
    animate();
  }

  /* ---------- Custom neon cursor ---------- */
  function initCursor(selector) {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;
    const INTERACTIVE = selector ||
      'button, a, input, select, textarea, label, [data-call], .action-card, .node, .slot, .inv-cell, .loot-chest';

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      const hit = e.target && e.target.closest ? e.target.closest(INTERACTIVE) : null;
      cursor.classList.toggle('hovering', !!hit);
      /* follow the player's neon colour choice once the game state exists */
      const col = window.state && window.state.profile && window.state.profile.color;
      if (col) cursor.style.setProperty('--cur', col);
    }, { passive: true });
    document.addEventListener('mousedown', () => cursor.classList.add('pressing'));
    document.addEventListener('mouseup', () => cursor.classList.remove('pressing'));
    document.documentElement.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
    document.documentElement.addEventListener('mouseenter', () => { cursor.style.opacity = '.95'; });
  }

  window.initBackground = initBackground;
  window.initCursor = initCursor;
})();
