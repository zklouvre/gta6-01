// NEON TIDE — renderer. Top-down night city: wet roads, neon glow, canal reflections,
// headlights, rain. All drawing is plain Canvas 2D; glow comes from shadowBlur + gradients.

import { WORLD, COLORS } from './config.js';
import { CANAL_V, CANAL_H, isRoad, onBridge } from './world.js';

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.mm = minimapCanvas; this.mmCtx = minimapCanvas.getContext('2d');
    this.rain = [];
    for (let i = 0; i < 260; i++) this.rain.push({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random() * 0.9, s: 0.9 + Math.random() * 0.7 });
    this.time = 0;
    this.flash = 0; this.flashTimer = 14 + Math.random() * 10;
  }
  resize(w, h) { this.cv.width = w; this.cv.height = h; }

  draw(game, dt) {
    const ctx = this.ctx;
    const W = this.cv.width, H = this.cv.height;
    this.time += dt;
    const cam = game.camera;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 - cam.x, H / 2 - cam.y);

    const view = { x0: cam.x - W / 2 - 80, y0: cam.y - H / 2 - 80, x1: cam.x + W / 2 + 80, y1: cam.y + H / 2 + 80 };
    this.drawGround(ctx, game, view);
    this.drawCanals(ctx, game, view);
    this.drawRoads(ctx, game, view);
    this.drawBuildings(ctx, game, view);
    this.drawProps(ctx, game, view);
    this.drawParked(ctx, game, view);
    this.drawPeds(ctx, game, view);
    this.drawTraffic(ctx, game, view);
    this.drawEnemies(ctx, game, view);
    this.drawPolice(ctx, game, view);
    this.drawPlayer(ctx, game, view);
    this.drawHeli(ctx, game, view);
    this.drawMarker(ctx, game, view);
    this.drawBullets(ctx, game, view);
    this.drawPickups(ctx, game, view);
    this.drawRain(ctx, game, W, H);
    ctx.restore();
    this.drawVignette(ctx, W, H);
    this.drawMinimap(game);
  }

  drawGround(ctx, game, view) {
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // sidewalk tint around roads is drawn with the roads
  }
  drawCanals(ctx, game, view) {
    const t = this.time;
    // vertical canal
    ctx.fillStyle = COLORS.canalDeep;
    ctx.fillRect(CANAL_V.x0, view.y0, CANAL_V.x1 - CANAL_V.x0, view.y1 - view.y0);
    ctx.fillStyle = COLORS.canal;
    ctx.fillRect(view.x0, CANAL_H.y0, view.x1 - view.x0, CANAL_H.y1 - CANAL_H.y0);
    // shimmering reflection lines
    ctx.strokeStyle = 'rgba(0,229,255,0.16)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = view.y0 + ((i * 173 + t * 22) % (view.y1 - view.y0));
      ctx.beginPath(); ctx.moveTo(CANAL_V.x0 + 14, y); ctx.lineTo(CANAL_V.x1 - 14, y); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = view.x0 + ((i * 211 + t * 18) % (view.x1 - view.x0));
      ctx.beginPath(); ctx.moveTo(x, CANAL_H.y0 + 14); ctx.lineTo(x, CANAL_H.y1 - 14); ctx.stroke();
    }
    // quays
    ctx.fillStyle = '#1c2032';
    ctx.fillRect(CANAL_V.x0 - 10, view.y0, 10, view.y1 - view.y0);
    ctx.fillRect(CANAL_V.x1, view.y0, 10, view.y1 - view.y0);
    ctx.fillRect(view.x0, CANAL_H.y0 - 10, view.x1 - view.x0, 10);
    ctx.fillRect(view.x0, CANAL_H.y1, view.x1 - view.x0, 10);
  }
  drawRoads(ctx, game, view) {
    const centers = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
    const half = WORLD.road / 2;
    ctx.fillStyle = COLORS.road;
    for (const c of centers) {
      ctx.fillRect(view.x0, c - half, view.x1 - view.x0, WORLD.road);
      ctx.fillRect(c - half, view.y0, WORLD.road, view.y1 - view.y0);
    }
    // wet sheen: pale streaks along roads
    ctx.fillStyle = 'rgba(120,160,255,0.045)';
    for (const c of centers) {
      ctx.fillRect(view.x0, c - half + 8, view.x1 - view.x0, 6);
      ctx.fillRect(c - half + 8, view.y0, 6, view.y1 - view.y0);
    }
    // lane dashes
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    for (const c of centers) {
      ctx.moveTo(view.x0, c); ctx.lineTo(view.x1, c);
      ctx.moveTo(c, view.y0); ctx.lineTo(c, view.y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // bridges over canals
    ctx.fillStyle = '#232838';
    for (const c of centers) {
      ctx.fillRect(CANAL_V.x0 - 8, c - half - 4, CANAL_V.x1 - CANAL_V.x0 + 16, WORLD.road + 8);
      ctx.fillRect(c - half - 4, CANAL_H.y0 - 8, WORLD.road + 8, CANAL_H.y1 - CANAL_H.y0 + 16);
    }
    // intersection crosswalks
    ctx.fillStyle = 'rgba(220,225,255,0.10)';
    for (const cx of centers) for (const cy of centers) {
      if (cx > CANAL_V.x0 - 100 && cx < CANAL_V.x1 + 100) continue;
      if (cy > CANAL_H.y0 - 100 && cy < CANAL_H.y1 + 100) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 11 - 4, cy - half + 6, 7, 10);
        ctx.fillRect(cx + i * 11 - 4, cy + half - 16, 7, 10);
      }
    }
  }
  drawBuildings(ctx, game, view) {
    for (const b of game.world.buildings) {
      if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
      // drop shadow (tall)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(b.x + 6 * b.tall, b.y + 8 * b.tall, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // roof detail
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // lit windows
      ctx.fillStyle = 'rgba(255,214,120,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (((i * 7 + j * 13 + (b.x | 0)) % 5) < 2) {
          ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 10, 12);
        }
      }
      if (b.neon) {
        ctx.strokeStyle = b.neon; ctx.lineWidth = 2;
        ctx.shadowColor = b.neon; ctx.shadowBlur = 14;
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        ctx.shadowBlur = 0;
      }
    }
    // neon signs
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    for (const s of game.world.signs) {
      if (s.x < view.x0 || s.x > view.x1 || s.y < view.y0 || s.y > view.y1) continue;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color; ctx.shadowBlur = 12;
      ctx.fillRect(s.x - s.w / 2, s.y - 9, s.w, 18);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0c14';
      ctx.fillText(s.text, s.x, s.y + 0.5);
    }
    // lamp glow
    for (const l of game.world.lamps) {
      if (l.x < view.x0 || l.x > view.x1 || l.y < view.y0 || l.y > view.y1) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 60);
      g.addColorStop(0, 'rgba(255,217,160,0.28)');
      g.addColorStop(1, 'rgba(255,217,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(l.x - 60, l.y - 60, 120, 120);
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
  }
  drawProps(ctx, game, view) {
    for (const p of game.world.props) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      if (p.kind === 'container') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 48, 26);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.strokeRect(p.x, p.y, 48, 26);
      }
    }
    // safehouse / garage / hospital / VPD markers (drawn as glowing plots)
    const spots = [
      { x: 700, y: 700, color: '#7cff00', label: 'SAFEHOUSE' },
      { x: 1180, y: 700, color: '#ffea00', label: 'GARAGE' },
      { x: 2500, y: 700, color: '#ff8fb0', label: 'HOSPITAL' },
      { x: 2500, y: 2500, color: '#3a6cff', label: 'VPD' },
    ];
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    for (const s of spots) {
      if (s.x < view.x0 - 120 || s.x > view.x1 + 120 || s.y < view.y0 - 120 || s.y > view.y1 + 120) continue;
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.shadowColor = s.color; ctx.shadowBlur = 10;
      ctx.strokeRect(s.x - 70, s.y - 70, 140, 140);
      ctx.shadowBlur = 0;
      ctx.fillStyle = s.color;
      ctx.fillText(s.label, s.x, s.y - 80);
    }
  }

  drawCarShape(ctx, car, headlights) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.len || 42, Wd = car.wid || 22;
    // neon underglow
    if (car.neon) {
      ctx.shadowColor = car.neon; ctx.shadowBlur = 18;
      ctx.fillStyle = car.neon;
      ctx.fillRect(-L / 2 - 2, -Wd / 2 - 2, L + 4, Wd + 4);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 6);
    ctx.fill();
    // cabin + windshield
    ctx.fillStyle = 'rgba(10,14,24,0.9)';
    ctx.beginPath();
    ctx.roundRect(-L / 6, -Wd / 2 + 4, L / 3, Wd - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,220,255,0.55)';
    ctx.fillRect(L / 6 - 2, -Wd / 2 + 4, 3, Wd - 8);
    if (car.police) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-L / 2 + 2, -Wd / 2 + 2, L - 4, 5);
      ctx.fillStyle = (Math.floor(this.time * 4) % 2 === 0) ? '#ff2d2d' : '#2d5bff';
      ctx.fillRect(-4, -Wd / 2 - 2, 8, 5);
    }
    if (headlights) {
      const g = ctx.createRadialGradient(L / 2, 0, 4, L / 2, 0, 130);
      g.addColorStop(0, 'rgba(255,244,200,0.35)');
      g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L / 2, -8); ctx.lineTo(L / 2 + 130, -42); ctx.lineTo(L / 2 + 130, 42); ctx.lineTo(L / 2, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 3, 5);
      ctx.fillRect(L / 2 - 2, Wd / 2 - 7, 3, 5);
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(-L / 2 - 1, -Wd / 2 + 2, 3, 5);
      ctx.fillRect(-L / 2 - 1, Wd / 2 - 7, 3, 5);
    }
    ctx.restore();
  }
  drawParked(ctx, game, view) {
    for (const c of game.worldParked) {
      if (c === game.player.inCar) continue; // the player's ride is drawn by drawPlayer
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      this.drawCarShape(ctx, c, false);
    }
  }
  drawTraffic(ctx, game, view) {
    for (const t of game.traffic) {
      const c = t.car;
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      this.drawCarShape(ctx, c, true);
    }
  }
  drawPeds(ctx, game, view) {
    for (const p of game.peds) {
      if (p.dead || p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(2, 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  drawEnemies(ctx, game, view) {
    for (const e of game.enemies) {
      if (e.dead || e.x < view.x0 || e.x > view.x1 || e.y < view.y0 || e.y > view.y1) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = '#ff4040';
      ctx.shadowColor = '#ff4040'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a0505';
      ctx.fillRect(6, -2, 12, 4);
      ctx.restore();
      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 14, e.y - 20, 28, 4);
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(e.x - 14, e.y - 20, 28 * (e.hp / 100), 4);
    }
    // fuse boxes
    for (const f of game.fuseBoxes || []) {
      if (f.dead) continue;
      ctx.fillStyle = '#ffea00';
      ctx.shadowColor = '#ffea00'; ctx.shadowBlur = 12;
      ctx.fillRect(f.x - 10, f.y - 10, 20, 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111';
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText('⚡', f.x, f.y + 1);
    }
  }
  drawPolice(ctx, game, view) {
    for (const p of game.police) {
      const c = p.car;
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      this.drawCarShape(ctx, c, true);
    }
    // roadblocks at 3+ stars: striped barriers ahead of the player
    if (game.player.wanted >= 3) {
      for (const rb of game.roadblocks) {
        if (rb.x < view.x0 || rb.x > view.x1 || rb.y < view.y0 || rb.y > view.y1) continue;
        ctx.save();
        ctx.translate(rb.x, rb.y); ctx.rotate(rb.angle);
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(-40, -8, 80, 16);
        ctx.fillStyle = '#111';
        for (let i = -3; i <= 3; i++) ctx.fillRect(i * 11, -8, 6, 16);
        ctx.restore();
      }
    }
  }
  drawPlayer(ctx, game, view) {
    const p = game.player;
    if (p.inCar) {
      this.drawCarShape(ctx, p.inCar, true);
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.shadowColor = p.lead.color; ctx.shadowBlur = 16;
    ctx.fillStyle = p.lead.color;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0c14';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    // gun direction
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.restore();
    // aim line (faint)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 90, p.y + Math.sin(p.angle) * 90);
    ctx.stroke();
  }
  drawHeli(ctx, game, view) {
    const h = game.heli;
    if (!h) return;
    ctx.save();
    ctx.translate(h.x, h.y);
    // spotlight cone on the player
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const py = game.player.inCar ? game.player.inCar.y : game.player.y;
    const g = ctx.createRadialGradient(px, py, 10, px, py, 130);
    g.addColorStop(0, 'rgba(255,244,200,0.30)');
    g.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, 130, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(h.blade * 0.05);
    ctx.fillStyle = '#22283a';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 34); ctx.stroke();
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawMarker(ctx, game, view) {
    const m = game.missions.marker;
    if (!m) return;
    const pulse = 1 + Math.sin(this.time * 4) * 0.15;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = '#ffea00'; ctx.lineWidth = 3;
    ctx.shadowColor = '#ffea00'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // off-screen direction arrow
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const py = game.player.inCar ? game.player.inCar.y : game.player.y;
    if (m.x < view.x0 || m.x > view.x1 || m.y < view.y0 || m.y > view.y1) {
      const a = Math.atan2(m.y - py, m.x - px);
      const ex = px + Math.cos(a) * 260, ey = py + Math.sin(a) * 260;
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = '#ffea00';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  drawBullets(ctx, game, view) {
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.stroke();
    }
    // muzzle flashes
    for (const f of game.flashes) {
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath(); ctx.arc(f.x, f.y, 8 * f.life, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawPickups(ctx, game, view) {
    for (const pk of game.pickups) {
      if (pk.x < view.x0 || pk.x > view.x1 || pk.y < view.y0 || pk.y > view.y1) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.fillStyle = pk.kind === 'health' ? '#7cff00' : pk.kind === 'ammo' ? '#00e5ff' : '#ffea00';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0c14';
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', 0, 3.5);
      ctx.restore();
    }
  }
  drawRain(ctx, game, W, H) {
    // lightning flash, rare
    this.flashTimer -= 1 / 60;
    if (this.flashTimer <= 0) { this.flash = 0.12; this.flashTimer = 12 + Math.random() * 18; }
    const intensity = game.rain; // 0..1
    ctx.strokeStyle = `rgba(170,200,255,${0.25 + intensity * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of this.rain) {
      const x = ((r.x + this.time * 0.02) % 1) * W;
      const y = ((r.y + this.time * r.s * (0.5 + intensity)) % 1) * H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 12 * r.l);
    }
    ctx.stroke();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,220,255,${this.flash})`;
      ctx.fillRect(0, 0, W, H);
      this.flash -= 1 / 60;
    }
  }
  drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  drawMinimap(game) {
    const mm = this.mmCtx;
    const S = this.mm.width, scale = S / WORLD.size;
    mm.fillStyle = 'rgba(5,8,16,0.92)';
    mm.fillRect(0, 0, S, S);
    mm.fillStyle = '#1a2036';
    const centers = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
    for (const c of centers) {
      mm.fillRect(0, c * scale - 2, S, 4);
      mm.fillRect(c * scale - 2, 0, 4, S);
    }
    mm.fillStyle = '#0a4a6b';
    mm.fillRect(CANAL_V.x0 * scale, 0, (CANAL_V.x1 - CANAL_V.x0) * scale, S);
    mm.fillRect(0, CANAL_H.y0 * scale, S, (CANAL_H.y1 - CANAL_H.y0) * scale);
    // mission marker
    const m = game.missions.marker;
    if (m) {
      mm.fillStyle = '#ffea00';
      mm.beginPath(); mm.arc(m.x * scale, m.y * scale, 5, 0, Math.PI * 2); mm.fill();
    }
    // police
    mm.fillStyle = '#3a6cff';
    for (const p of game.police) {
      mm.beginPath(); mm.arc(p.car.x * scale, p.car.y * scale, 3.5, 0, Math.PI * 2); mm.fill();
    }
    // player arrow
    const pl = game.player;
    const px = pl.inCar ? pl.inCar.x : pl.x, py = pl.inCar ? pl.inCar.y : pl.y;
    mm.save();
    mm.translate(px * scale, py * scale);
    mm.rotate(pl.inCar ? pl.inCar.angle : pl.angle);
    mm.fillStyle = pl.lead.color;
    mm.beginPath(); mm.moveTo(7, 0); mm.lineTo(-5, -5); mm.lineTo(-5, 5); mm.closePath(); mm.fill();
    mm.restore();
    // north label
    mm.fillStyle = 'rgba(255,255,255,0.7)';
    mm.font = 'bold 9px monospace';
    mm.fillText('N', 4, 11);
  }
}
