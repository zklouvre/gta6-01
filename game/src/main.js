// NEON TIDE — main game. State machine, wanted system, police, shooting, carjacking,
// garage, weapon wheel, saves, radio, weather. Original game, built on plain Canvas 2D.

import { WORLD, COLORS, WEAPONS, RANKS, UPGRADES, CREW, LEADS, RADIO, START, SAFEHOUSE, GARAGE, HOSPITAL, POLICE_HQ, MISSIONS, rankFor } from './config.js';
import { mulberry32, clamp, dist, angleDiff, range, pick } from './random.js';
import { generateWorld, isRoad, isWater, onBridge, nearestStreet, isBlocked } from './world.js';
import { Player, TrafficCar, Ped, PoliceCar, Helicopter, Enemy, makeCar, driveCar } from './entities.js';
import { MissionEngine } from './missions.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'neon-tide-save-v1';
const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = new Renderer(this.canvas, $('minimap'));
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.state = 'menu'; // menu | playing | paused | talk | garage | over
    this.leadId = 'rue';
    this.rng = mulberry32(WORLD.seed);
    this.world = generateWorld(WORLD.seed);
    this.worldParked = [...this.world.parked];
    this.player = new Player(LEADS.rue, START.x, START.y);
    this.camera = { x: START.x, y: START.y };
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = null;
    this.enemies = [];
    this.fuseBoxes = [];
    this.bullets = [];
    this.flashes = [];
    this.pickups = [];
    this.roadblocks = [];
    this.missions = new MissionEngine(this);
    this.rain = 0.7; this.rainTarget = 0.7; this.rainTimer = 0;
    this.clockMin = 2 * 60 + 14; // 02:14
    this.timeScale = 1;
    this.bannerTimer = 0;
    this.wheelOpen = false;
    this.shootCd = 0;
    this.policeTimer = 0;
    this.saveFlash = 0;
    this.shotMode = null;
    this.debug = new URLSearchParams(location.search);
    this.setupMenu();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  // ---------- menu / save ----------
  setupMenu() {
    document.querySelectorAll('.leadcard').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.leadcard').forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
        this.leadId = el.dataset.lead;
      });
    });
    $('btn-new').addEventListener('click', () => this.newGame());
    $('btn-continue').addEventListener('click', () => { if (!this.loadGame()) this.newGame(); else this.startPlaying(); });
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-save').addEventListener('click', () => { this.saveGame(); $('pause-stats').textContent = 'Saved. The tide remembers.'; });
    $('btn-quit').addEventListener('click', () => { this.saveGame(); this.state = 'menu'; this.show('menu'); this.hide('pause'); });
    $('btn-garage-close').addEventListener('click', () => { this.state = 'playing'; this.hide('garage'); });
    $('btn-retry').addEventListener('click', () => { this.respawn(); });
    // continue button state
    $('btn-continue').style.opacity = localStorage.getItem(SAVE_KEY) ? '1' : '0.4';
  }
  show(id) { $(id).style.display = id === 'menu' || id === 'gameover' ? 'flex' : 'block'; }
  hide(id) { $(id).style.display = 'none'; }
  newGame() {
    this.audio.init(); this.audio.resume();
    this.rng = mulberry32(WORLD.seed);
    this.world = generateWorld(WORLD.seed);
    this.worldParked = [...this.world.parked];
    this.player = new Player(LEADS[this.leadId], START.x, START.y);
    this.traffic = []; this.peds = []; this.police = []; this.heli = null;
    this.enemies = []; this.fuseBoxes = []; this.bullets = []; this.pickups = []; this.roadblocks = [];
    this.missions = new MissionEngine(this);
    for (let i = 0; i < 14; i++) this.traffic.push(new TrafficCar(this.rng, this.world));
    for (let i = 0; i < 24; i++) this.peds.push(new Ped(this.rng, this.world));
    this.camera = { x: START.x, y: START.y };
    this.clockMin = 2 * 60 + 14;
    this.setStartMarker();
    this.startPlaying();
    this.banner('Welcome to Vespera. Press T to start your first job.', 5);
  }
  startPlaying() {
    this.state = 'playing';
    this.hide('menu'); this.hide('pause'); this.hide('gameover'); this.hide('garage');
    this.audio.init(); this.audio.resume();
  }
  resume() { this.state = 'playing'; this.hide('pause'); this.audio.resume(); }
  setStartMarker() {
    const m = this.missions.current();
    if (!m) { this.missions.marker = null; return; }
    const s = m.steps[0];
    if (s.x !== undefined) this.missions.marker = { x: s.x, y: s.y, label: `M${m.id} ${m.title} — press T`, radius: 90 };
    else this.missions.marker = { x: START.x, y: START.y, label: `M${m.id} ${m.title} — press T`, radius: 90 };
  }
  saveGame() {
    const p = this.player;
    const data = {
      lead: p.lead.id, x: p.x, y: p.y, hp: p.hp, cash: p.cash, respect: p.respect,
      ammo: p.ammo.map((a) => (a === Infinity ? -1 : a)), weapon: p.weapon, upgrades: p.upgrades, crew: p.crew,
      unlockedCrew: p.unlockedCrew, missionsDone: p.missionsDone, missionIndex: this.missions.index,
      clockMin: this.clockMin,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.saveFlash = 1.5; } catch {}
  }
  loadGame() {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
    if (!data) return false;
    this.newGame();
    const p = this.player;
    p.lead = LEADS[data.lead] || LEADS.rue;
    p.x = data.x; p.y = data.y; p.hp = data.hp; p.cash = data.cash; p.respect = data.respect;
    p.ammo = (data.ammo || [Infinity, 60, 180, 30]).map((a) => (a === -1 || a === null ? Infinity : a)); p.weapon = data.weapon; p.upgrades = data.upgrades;
    p.crew = data.crew; p.unlockedCrew = data.unlockedCrew || [];
    p.missionsDone = data.missionsDone || 0;
    this.missions.index = data.missionIndex || 0;
    this.clockMin = data.clockMin || 134;
    this.camera = { x: p.x, y: p.y };
    this.setStartMarker();
    return true;
  }
  respawn() {
    const p = this.player;
    p.hp = p.maxHp; p.wanted = 0; p.heat = 0;
    p.inCar = null;
    p.x = HOSPITAL.x; p.y = HOSPITAL.y;
    this.police = []; this.heli = null; this.audio.stopSiren();
    this.camera = { x: p.x, y: p.y };
    this.state = 'playing';
    this.hide('gameover');
    this.banner('Patched up at St. Anselm. The city is still out there.', 4);
  }

  // ---------- wanted ----------
  starsFor(heat) { return heat <= 0 ? 0 : Math.max(1, Math.min(5, Math.floor(heat / 20))); }
  setWanted(stars) { this.player.heat = stars * 20 + 1; this.player.wanted = stars; }
  addHeat(n) {
    const p = this.player;
    p.heat = clamp(p.heat + n, 0, 100);
    const stars = this.starsFor(p.heat);
    if (stars !== p.wanted) {
      p.wanted = stars;
      if (stars > 0) { this.audio.phone(); this.banner(stars >= 3 ? `WANTED — ${stars} STARS. The whole VPD is coming.` : `Wanted level ${stars}. Lose them.`, 3); }
    }
  }
  updateWanted(dt) {
    const p = this.player;
    if (p.wanted === 0) return;
    // seen? any police within 520px or heli present
    let seen = !!this.heli;
    for (const pc of this.police) {
      if (dist(pc.car.x, pc.car.y, p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y) < 520) { seen = true; break; }
    }
    if (!seen) {
      let rate = 2.2;
      if (p.crew === 'sable') rate *= 1.4;
      p.heat -= rate * dt;
      if (p.heat <= 0) { p.heat = 0; p.wanted = 0; this.banner('You lost them. The tide goes quiet.', 3); }
      else p.wanted = this.starsFor(p.heat);
    }
    // police population scales with stars
    const want = p.wanted >= 4 ? 4 : p.wanted >= 3 ? 3 : p.wanted >= 1 ? 2 : 0;
    this.policeTimer -= dt;
    if (this.police.length < want && this.policeTimer <= 0) {
      this.policeTimer = 1.2;
      const a = Math.random() * Math.PI * 2;
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      this.police.push(new PoliceCar(this.rng,
        clamp(px + Math.cos(a) * 650, 60, WORLD.size - 60),
        clamp(py + Math.sin(a) * 650, 60, WORLD.size - 60)));
      this.audio.startSiren();
    }
    if (this.police.length > want) this.police.pop();
    // helicopter at 4+
    if (p.wanted >= 4 && !this.heli) {
      this.heli = new Helicopter(p.x, p.y - 300);
      this.banner('VPD helicopter overhead. Stay out of the spotlight.', 3);
    }
    if (p.wanted < 4 && this.heli) this.heli = null;
    // roadblocks at 3+
    if (p.wanted >= 3 && this.roadblocks.length === 0) {
      this.roadblocks = [{ x: 0, y: 0, angle: 0 }, { x: 0, y: 0, angle: 0 }];
      this.repositionRoadblocks();
    }
    if (p.wanted < 3) this.roadblocks = [];
    if (p.wanted === 0 && this.police.length === 0) this.audio.stopSiren();
  }
  repositionRoadblocks() {
    const p = this.player;
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    const heading = p.inCar ? p.inCar.angle : p.angle;
    // place ahead on the nearest street axis
    const ahead = 420;
    for (let i = 0; i < this.roadblocks.length; i++) {
      const off = (i === 0 ? -1 : 1) * 260;
      const bx = px + Math.cos(heading) * ahead + Math.cos(heading + Math.PI / 2) * off;
      const by = py + Math.sin(heading) * ahead + Math.sin(heading + Math.PI / 2) * off;
      this.roadblocks[i].x = clamp(bx, 80, WORLD.size - 80);
      this.roadblocks[i].y = clamp(by, 80, WORLD.size - 80);
      this.roadblocks[i].angle = heading + Math.PI / 2;
    }
  }

  // ---------- actions ----------
  tryEnterCar() {
    const p = this.player;
    if (p.inCar) { // exit
      const c = p.inCar;
      p.inCar = null;
      p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 30;
      p.y = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
      p.angle = c.angle;
      this.audio.stopEngine();
      return;
    }
    let best = null, bd = 70;
    for (const c of this.worldParked) {
      if (c.taken) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    for (const t of this.traffic) {
      const d = dist(p.x, p.y, t.car.x, t.car.y);
      if (d < bd) { bd = d; best = t.car; best._traffic = t; }
    }
    if (!best) return;
    const wasTraffic = !!best._traffic;
    if (wasTraffic) {
      // carjacking: driver flees, heat rises
      const t = best._traffic;
      this.traffic = this.traffic.filter((x) => x !== t);
      this.peds.push(Object.assign(new Ped(this.rng, this.world), { x: best.x + 30, y: best.y + 30, flee: 3 }));
      this.addHeat(20);
      this.banner('Carjacked! The VPD saw that.', 2.5);
      this.missions.onCarStolen(best);
    } else {
      best.taken = true;
      this.missions.onCarStolen(best);
    }
    delete best._traffic;
    p.inCar = best;
    p.angle = best.angle;
    this.audio.startEngine();
    this.audio.pickup();
  }
  nearestCar() {
    const p = this.player;
    let best = null, bd = 70;
    for (const c of this.worldParked) {
      if (c.taken) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    for (const t of this.traffic) {
      const d = dist(p.x, p.y, t.car.x, t.car.y);
      if (d < bd) { bd = d; best = t.car; }
    }
    return best;
  }
  shoot() {
    const p = this.player;
    if (p.inCar) return; // no drive-by shooting in this build
    const w = WEAPONS[p.weapon];
    if (this.shootCd > 0) return;
    if (p.ammo[p.weapon] <= 0) { this.hud('ammo', 'NO AMMO — find pickups or rest at the safehouse'); return; }
    this.shootCd = w.rate / 1000;
    if (p.ammo[p.weapon] !== Infinity) p.ammo[p.weapon]--;
    this.audio.shot();
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * w.spread * 2;
      this.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, angle: a, speed: 900, life: w.range / 900, damage: w.damage * (p.crew === 'brutus' ? 1.25 : 1), fromPlayer: true });
    }
    this.flashes.push({ x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26, life: 1 });
    // firing near police / peds raises heat and scares peds
    if (Math.random() < 0.5) this.addHeat(4);
    for (const pd of this.peds) if (dist(pd.x, pd.y, p.x, p.y) < 300) pd.flee = 2.5;
  }
  melee() {
    const p = this.player;
    if (this.shootCd > 0) return;
    this.shootCd = WEAPONS[0].rate / 1000;
    this.audio.melee();
    const rangePx = WEAPONS[0].range;
    const dmg = WEAPONS[0].damage * p.lead.melee;
    for (const e of this.enemies) {
      if (!e.dead && dist(p.x, p.y, e.x, e.y) < rangePx) this.damageEnemy(e, dmg);
    }
    for (const pd of this.peds) {
      if (!pd.dead && dist(p.x, p.y, pd.x, pd.y) < rangePx) { pd.dead = true; this.addHeat(10); }
    }
  }
  damageEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.missions.onKill();
      this.player.cash += 40;
      // drop a pickup
      const roll = Math.random();
      this.pickups.push({ x: e.x, y: e.y, kind: roll < 0.4 ? 'cash' : roll < 0.7 ? 'ammo' : 'health' });
    }
  }

  // ---------- HUD / UI ----------
  hud(kind, text) {
    if (kind === 'mission') $('mission').textContent = text;
    if (kind === 'timer') $('timer').textContent = text;
    if (kind === 'ammo') $('ammo').textContent = text;
  }
  banner(text, seconds) {
    const b = $('banner');
    b.textContent = text;
    b.style.display = 'block';
    this.bannerTimer = seconds;
  }
  showTalk(line) {
    const [who, ...rest] = line.split(':');
    $('talk').innerHTML = `<span class="who">${who}:</span> ${rest.join(':')}`;
    $('talk').style.display = 'block';
    this.state = 'talk';
  }
  hideTalk() { $('talk').style.display = 'none'; }
  updateHud() {
    const p = this.player;
    const stars = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
    $('stars').innerHTML = `<span>${'★'.repeat(p.wanted)}</span><span class="off">${'☆'.repeat(5 - p.wanted)}</span>`;
    $('health-fill').style.width = `${clamp(p.hp / p.maxHp * 100, 0, 100)}%`;
    $('armor-fill').style.width = `${clamp(p.armor, 0, 100)}%`;
    $('cashline').textContent = `$${p.cash.toLocaleString()}  ·  ${p.lead.name}`;
    $('rankline').textContent = `${rankFor(p.respect).name} · ${p.respect} respect · ${p.missionsDone}/10 jobs`;
    const hh = String(Math.floor(this.clockMin / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(this.clockMin % 60)).padStart(2, '0');
    $('clock').textContent = `${hh}:${mm}`;
    const rainWord = this.rain < 0.45 ? 'LIGHT' : this.rain < 0.75 ? 'STEADY' : 'HEAVY';
    $('weather').textContent = `RAIN — ${rainWord} · ${this.daylight() > 0.5 ? 'DAY' : this.daylight() > 0.2 ? 'DAWN' : 'NIGHT'}`;
    $('radio').textContent = this.audio.muted ? 'RADIO MUTED' : this.audio.stationName();
    const w = WEAPONS[p.weapon];
    $('weapon').textContent = w.name;
    $('ammo').textContent = p.ammo[p.weapon] === Infinity ? '∞' : `${p.ammo[p.weapon]} rounds`;
    $('speed').textContent = p.inCar ? `${Math.round(Math.abs(p.inCar.speed) * 0.24)} km/h` : '';
    if (this.saveFlash > 0) { $('cashline').textContent += '  ·  SAVED'; this.saveFlash -= 1 / 60; }
    $('pause-stats').textContent = `${p.lead.full} · $${p.cash} · ${rankFor(p.respect).name} · ${p.missionsDone}/10 jobs done · Wanted ${p.wanted}★`;
    $('crew-list').textContent = p.unlockedCrew.length ? p.unlockedCrew.join(', ') : 'none yet';
    $('crew-active').textContent = p.crew ? `Active crew: ${p.crew} (${CREW.find((c) => c.id === p.crew)?.bonus || ''}) — press 5 to cycle` : '';
  }
  daylight() {
    // 0 = deep night, 1 = midday. Game starts 02:14; full cycle ~7.5 real minutes.
    const h = (this.clockMin / 60) % 24;
    if (h < 5 || h >= 20) return 0;
    if (h < 7) return (h - 5) / 2 * 0.5;
    if (h < 17) return 0.5 + (1 - Math.abs(h - 12) / 5) * 0.5;
    if (h < 20) return 0.5 * (20 - h) / 3;
    return 0;
  }
  openGarage() {
    this.state = 'garage';
    this.show('garage');
    const p = this.player;
    const box = $('upgrades');
    box.innerHTML = '';
    for (const [key, levels] of Object.entries(UPGRADES)) {
      const cur = p.upgrades[key];
      const next = levels[cur + 1];
      const row = document.createElement('div');
      row.className = 'upg';
      row.innerHTML = `<span>${key.toUpperCase()}: ${levels[cur].name}</span>`;
      if (next) {
        const b = document.createElement('button');
        b.className = 'btn'; b.textContent = `Upgrade — $${next.cost}`;
        b.addEventListener('click', () => {
          if (p.cash >= next.cost) {
            p.cash -= next.cost; p.upgrades[key]++;
            this.audio.pickup();
            this.openGarage();
          } else b.textContent = 'NOT ENOUGH CASH';
        });
        row.appendChild(b);
      } else {
        const s = document.createElement('span');
        s.textContent = 'MAXED'; s.style.color = '#7cff00';
        row.appendChild(s);
      }
      box.appendChild(row);
    }
    $('garage-cash').textContent = `Cash: $${p.cash}`;
  }
  drawWheel() {
    const w = $('wheel');
    const ctx = w.getContext('2d');
    ctx.clearRect(0, 0, 300, 300);
    ctx.fillStyle = 'rgba(5,8,16,0.9)';
    ctx.beginPath(); ctx.arc(150, 150, 140, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(150, 150, 140, 0, Math.PI * 2); ctx.stroke();
    const p = this.player;
    WEAPONS.forEach((wp, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / WEAPONS.length);
      const x = 150 + Math.cos(a) * 95, y = 150 + Math.sin(a) * 95;
      ctx.fillStyle = i === p.weapon ? wp.color : 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${i + 1} ${wp.name}`, x, y);
      if (i === p.weapon) {
        ctx.strokeStyle = wp.color;
        ctx.beginPath(); ctx.arc(x, y - 4, 34, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  // ---------- update ----------
  update(dt) {
    const p = this.player;
    const inp = this.input;
    const mv = inp.move();

    // weather cycle
    this.rainTimer -= dt;
    if (this.rainTimer <= 0) {
      this.rainTarget = 0.3 + Math.random() * 0.7;
      this.rainTimer = 25 + Math.random() * 30;
    }
    this.rain += (this.rainTarget - this.rain) * dt * 0.2;
    this.audio.setRain(this.rain);
    this.clockMin += dt * (60 / 45); // 1 game hour per 45 real seconds
    p.rainGrip = 1 - this.rain * 0.3 + p.upgrades.tires * 0.1;
    if (p.crew === 'vex') p.rainGrip += 0.08;

    // aim with mouse (on foot)
    if (!p.inCar) {
      const wx = this.camera.x + (inp.mouse.x - window.innerWidth / 2);
      const wy = this.camera.y + (inp.mouse.y - window.innerHeight / 2);
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }

    // movement
    if (p.inCar) {
      const up = UPGRADES.engine[p.upgrades.engine];
      const neon = UPGRADES.neon[p.upgrades.neon];
      p.inCar.neon = neon.color;
      driveCar(p.inCar, mv, dt, clamp(p.rainGrip, 0.5, 1.2), up.top, up.accel, this.world);
      this.audio.setEngine(Math.abs(p.inCar.speed) / 460, true);
      // roadblock collision
      for (const rb of this.roadblocks) {
        if (dist(p.inCar.x, p.inCar.y, rb.x, rb.y) < 46) {
          p.inCar.speed *= 0.15;
          p.inCar.hp -= 8;
          this.audio.crash();
          this.addHeat(6);
        }
      }
      // car wrecked
      if (p.inCar.hp <= 0) {
        const c = p.inCar;
        p.inCar = null; p.x = c.x + 30; p.y = c.y;
        this.audio.stopEngine(); this.audio.crash();
        this.banner('Your ride is scrap. Find another.', 3);
      }
    } else {
      p.moveFoot(mv, dt, this.world);
      this.audio.setEngine(0, false);
    }

    // interactions
    if (inp.hit('KeyE') || inp.hit('KeyF')) {
      if (this.nearGarage() && p.inCar) this.openGarage();
      else if (this.nearSafehouse() && !p.inCar) this.safehouseRest();
      else this.tryEnterCar();
    }
    if (inp.hit('KeyC') && this.nearSafehouse() && !p.inCar) this.switchLead();
    if (inp.hit('KeyT')) {
      if (this.missions.state === 'idle' && !this.missions.isFinished()) {
        this.missions.start();
        this.hud('mission', this.missions.stepLabel());
      }
    }
    if (inp.hit('KeyR')) { this.audio.cycleStation(); }
    if (inp.hit('KeyM')) { this.audio.setMuted(!this.audio.muted); }
    if (inp.hit('Digit5')) {
      if (p.unlockedCrew.length) {
        const i = p.unlockedCrew.indexOf(p.crew);
        p.crew = p.unlockedCrew[(i + 1) % p.unlockedCrew.length];
        this.banner(`Crew active: ${p.crew}`, 2);
      }
    }
    // weapons
    for (let i = 0; i < 4; i++) if (inp.hit(`Digit${i + 1}`)) p.weapon = i;
    if (inp.wheelDelta !== 0) p.weapon = (p.weapon + (inp.wheelDelta > 0 ? 1 : 3)) % 4;
    // weapon wheel
    if (inp.down('KeyQ')) {
      if (!this.wheelOpen) { this.wheelOpen = true; $('wheel').style.display = 'block'; }
      this.drawWheel();
      const a = Math.atan2(inp.mouse.y - window.innerHeight / 2, inp.mouse.x - window.innerWidth / 2);
      let idx = Math.round(((a + Math.PI / 2) / (Math.PI * 2)) * 4) % 4;
      if (idx < 0) idx += 4;
      p.weapon = idx;
    } else if (this.wheelOpen) { this.wheelOpen = false; $('wheel').style.display = 'none'; }

    // shooting
    this.shootCd -= dt;
    const w = WEAPONS[p.weapon];
    if (!p.inCar && (inp.mouse.down || inp.mouse.clicked)) {
      if (p.weapon === 0) this.melee();
      else if (w.auto ? inp.mouse.down : inp.mouse.clicked) this.shoot();
    }

    // bullets
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    for (const f of this.flashes) f.life -= dt * 6;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.resolveBullets();

    // world life
    for (const t of this.traffic) t.update(dt, this.world, this.traffic);
    const danger = this.bullets.length ? { x: p.x, y: p.y } : null;
    for (const pd of this.peds) pd.update(dt, this.world, danger);
    this.peds = this.peds.filter((pd) => !pd.dead);
    this.missions.update(dt);
    for (const e of this.enemies) {
      const ev = e.update(dt, this.world, p);
      if (ev && ev.shot) {
        p.hp -= ev.damage;
        this.flashes.push({ x: ev.fromX, y: ev.fromY, life: 1 });
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // fuse boxes: bullets destroy them
    for (const f of this.fuseBoxes) {
      if (f.dead) continue;
      for (const b of this.bullets) {
        if (b.fromPlayer && dist(b.x, b.y, f.x, f.y) < 18) { f.hp -= 30; b.life = 0; }
      }
      if (f.hp <= 0) { f.dead = true; this.missions.onDestroy(); }
    }
    // pickups
    for (const pk of this.pickups) {
      const d = dist(p.x, p.y, pk.x, pk.y);
      if (d < 30) {
        pk.taken = true;
        if (pk.kind === 'cash') { p.cash += 50; }
        if (pk.kind === 'ammo') { p.ammo[1] += 24; p.ammo[2] += 60; p.ammo[3] += 8; }
        if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 40); }
        this.audio.pickup();
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken);

    // police
    this.updateWanted(dt);
    for (const pc of this.police) {
      const ev = pc.update(dt, this.world, p, p.wanted);
      if (ev && ev.shot) this.flashes.push({ x: ev.fromX, y: ev.fromY, life: 1 });
    }
    // busted check: cop on top of you on foot
    if (!p.inCar && p.wanted > 0) {
      for (const pc of this.police) {
        if (dist(pc.car.x, pc.car.y, p.x, p.y) < 42) {
          p.bustedTimer += dt;
          if (p.bustedTimer > 1.2) { this.busted(); return; }
        }
      }
    } else p.bustedTimer = 0;
    if (this.heli) this.heli.update(dt, p);
    if (p.wanted >= 3 && Math.random() < dt * 0.25) this.repositionRoadblocks();
    this.audio.updateSiren(dt);

    // health / death
    if (p.hp <= 0) { this.wasted(); return; }
    if (p.inCar && p.inCar.hp <= 0) { /* handled above */ }

    // camera (clamped so the frame never shows void beyond the city edge)
    const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 4);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 4);
    this.camera.x = clamp(this.camera.x, window.innerWidth / 2, WORLD.size - window.innerWidth / 2);
    this.camera.y = clamp(this.camera.y, window.innerHeight / 2, WORLD.size - window.innerHeight / 2);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) $('banner').style.display = 'none';
    }
    this.updateHud();
    this.input.endFrame();
  }
  resolveBullets() {
    const p = this.player;
    for (const b of this.bullets) {
      if (!b.fromPlayer) continue;
      if (b.life <= 0) continue;
      // enemies
      for (const e of this.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 14) { this.damageEnemy(e, b.damage); b.life = 0; break; }
      }
      if (b.life <= 0) continue;
      // peds (collateral)
      for (const pd of this.peds) {
        if (!pd.dead && dist(b.x, b.y, pd.x, pd.y) < 12) {
          pd.dead = true; b.life = 0; this.addHeat(10);
          for (const q of this.peds) if (dist(q.x, q.y, pd.x, pd.y) < 260) q.flee = 2.5;
          break;
        }
      }
      if (b.life <= 0) continue;
      // police cars
      for (const pc of this.police) {
        if (dist(b.x, b.y, pc.car.x, pc.car.y) < 22) {
          pc.car.hp -= b.damage; b.life = 0;
          this.addHeat(8);
          if (pc.car.hp <= 0) {
            pc.car.hp = 1; // disabled, not destroyed
            pc.car.speed = 0;
            this.pickups.push({ x: pc.car.x, y: pc.car.y, kind: 'ammo' });
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // buildings stop bullets
      if (isBlocked(this.world.buildings, b.x, b.y, 0)) b.life = 0;
    }
  }
  nearGarage() {
    const p = this.player;
    const x = p.inCar ? p.inCar.x : p.x, y = p.inCar ? p.inCar.y : p.y;
    return dist(x, y, GARAGE.x, GARAGE.y) < GARAGE.r;
  }
  nearSafehouse() {
    const p = this.player;
    return dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < SAFEHOUSE.r;
  }
  safehouseRest() {
    const p = this.player;
    p.hp = p.maxHp; p.armor = 50;
    p.ammo = [Infinity, 60, 180, 30];
    p.heat = 0; p.wanted = 0;
    this.police = []; this.heli = null; this.audio.stopSiren();
    this.saveGame();
    this.banner('Safehouse. Patched up, re-armed, heat gone. Game saved.', 3.5);
    this.audio.pickup();
  }
  switchLead() {
    const p = this.player;
    const other = p.lead.id === 'rue' ? LEADS.marlowe : LEADS.rue;
    const keepHp = p.hp / p.maxHp;
    p.lead = other;
    p.maxHp = other.hp;
    p.hp = Math.round(other.hp * keepHp);
    this.banner(`Now playing as ${other.full}. ${other.desc}`, 3.5);
    this.audio.pickup();
  }
  busted() {
    const p = this.player;
    const fine = Math.floor(p.cash * 0.1);
    p.cash -= fine; p.wanted = 0; p.heat = 0; p.bustedTimer = 0;
    p.inCar = null;
    p.x = POLICE_HQ.x; p.y = POLICE_HQ.y;
    this.police = []; this.heli = null; this.audio.stopSiren();
    this.camera = { x: p.x, y: p.y };
    this.banner(`BUSTED — the VPD took $${fine}. You walk out of Central with nothing but the rain.`, 4);
    this.audio.fail();
  }
  wasted() {
    const p = this.player;
    const lost = Math.floor(p.cash * 0.15);
    p.cash -= lost;
    $('go-title').textContent = 'WASTED';
    $('go-text').textContent = `The tide took you under. The hospital kept $${lost} for the trouble. Your story continues — Vespera doesn't wait.`;
    this.state = 'over';
    this.show('gameover');
    this.audio.fail(); this.audio.stopEngine(); this.audio.stopSiren();
  }

  // ---------- frame ----------
  frame(dt) {
    // HUD only exists in-game, never over the menu
    const inMenu = this.state === 'menu';
    document.querySelectorAll('.hud').forEach((el) => {
      el.style.visibility = inMenu ? 'hidden' : 'visible';
    });
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'talk') {
      if (this.input.hit('KeyE') || this.input.hit('Space') || this.input.mouse.clicked) this.missions.advanceTalk();
      this.input.endFrame();
    } else if (this.state === 'paused' || this.state === 'garage' || this.state === 'menu' || this.state === 'over') {
      this.input.endFrame();
    }
    if (this.state !== 'menu') {
      this.renderer.draw(this, dt);
      // daylight overlay: night is the game's home, dawn/day lighten the frame
      const dl = this.daylight();
      if (dl > 0.02) {
        const ctx = this.renderer.ctx;
        ctx.fillStyle = `rgba(190,215,255,${(dl * 0.22).toFixed(3)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      // menu backdrop: slow pan over the city
      this.camera.x = 1600 + Math.cos(performance.now() / 9000) * 500;
      this.camera.y = 1600 + Math.sin(performance.now() / 11000) * 500;
      this.renderer.draw(this, dt);
    }
    this.updateHud();
  }

  boot() {
    // pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') { this.state = 'paused'; this.show('pause'); }
        else if (this.state === 'paused') this.resume();
      }
    });
    // staged screenshot mode: ?shot=start|play|chase|mission
    const shot = this.debug.get('shot');
    if (shot) {
      this.newGame();
      stageShot(this, shot);
    }
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try { this.frame(dt); } catch (err) { console.error('frame error (recovered):', err); }
      if (this.shotCountdown !== undefined && this.shotCountdown > 0) {
        this.shotCountdown--;
        if (this.shotCountdown === 0) window.__shotReady = true;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

const game = new Game();
window.__game = game;
game.boot();

