// NEON TIDE — mission engine. 10 story missions, each a list of steps.
// Step types: goto | talk | steal | deliver | pickup | timed | kill | destroy | escape.
// The engine owns the marker, the timer, spawning (enemies, the convoy van) and rewards.

import { MISSIONS } from './config.js';
import { dist, clamp, range } from './random.js';
import { Enemy, makeCar } from './entities.js';

export class MissionEngine {
  constructor(game) {
    this.game = game;
    this.index = 0; // current mission (0-based)
    this.step = 0;
    this.state = 'idle'; // idle | active | talk | done
    this.timer = 0;
    this.kills = 0;
    this.destroyed = 0;
    this.marker = null; // {x, y, label}
    this.talkLines = null; this.talkIdx = 0;
    this.spawned = [];
    this.escaped = false;
    this.convoyVan = null;
  }
  current() { return MISSIONS[this.index] || null; }
  isFinished() { return this.index >= MISSIONS.length; }
  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }
  start() {
    if (this.isFinished()) return;
    this.state = 'active'; this.step = 0; this.kills = 0; this.destroyed = 0;
    this.timer = 0; this.spawned = []; this.convoyVan = null;
    this.game.audio.phone();
    this.enterStep();
  }
  enterStep() {
    const s = this.currentStep();
    const g = this.game;
    if (!s) { this.completeMission(); return; }
    this.marker = null;
    if (s.type === 'goto' || s.type === 'talk' || s.type === 'pickup' || s.type === 'deliver' || s.type === 'timed') {
      this.marker = { x: s.x, y: s.y, label: s.label, radius: s.radius || 90 };
    }
    if (s.type === 'timed') this.timer = s.seconds;
    if (s.type === 'escape') {
      this.timer = s.seconds || 150;
      if (s.forceStars) g.setWanted(s.forceStars);
    }
    if (s.type === 'kill') {
      this.kills = 0;
      this.marker = { x: s.at.x, y: s.at.y, label: s.label, radius: s.radius || 300 };
      const rng = g.rng;
      for (let i = 0; i < s.count; i++) {
        const a = range(rng, 0, Math.PI * 2), r = range(rng, 40, s.radius * 0.7);
        const e = new Enemy(s.at.x + Math.cos(a) * r, s.at.y + Math.sin(a) * r, rng);
        g.enemies.push(e); this.spawned.push(e);
      }
    }
    if (s.type === 'destroy') {
      this.destroyed = 0;
      this.marker = { x: s.spots[0].x, y: s.spots[0].y, label: s.label, radius: 260 };
      g.fuseBoxes = s.spots.map(p => ({ x: p.x, y: p.y, hp: 60, dead: false }));
    }
    if (s.type === 'steal' && s.van) {
      // convoy van waiting at the east bridge
      const van = makeCar(2900, 1900, Math.PI, g.rng, { model: 'Truck', color: '#2c2c34', van: true, hp: 220 });
      van.driver = 'parked';
      g.worldParked.push(van);
      this.convoyVan = van;
      this.marker = { x: 2900, y: 1900, label: 'Steal the armored van', radius: 120 };
    }
    g.hud('mission', this.stepLabel());
  }
  stepLabel() {
    const m = this.current();
    if (!m) return '';
    const s = this.currentStep();
    if (!s) return '';
    let label = s.label || '';
    if (s.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${this.kills}/${s.count})`);
    if (s.type === 'destroy') label = label.replace(/\(\d+\/\d+\)/, `(${this.destroyed}/${s.count})`);
    return `M${m.id} ${m.title} — ${label}`;
  }
  onKill() {
    const s = this.currentStep();
    if (s && s.type === 'kill') {
      this.kills++;
      this.game.hud('mission', this.stepLabel());
      if (this.kills >= s.count) this.nextStep();
    }
  }
  onDestroy() {
    const s = this.currentStep();
    if (s && s.type === 'destroy') {
      this.destroyed++;
      if (this.destroyed >= s.count) { this.nextStep(); return; }
      const next = s.spots[this.destroyed];
      this.marker = { x: next.x, y: next.y, label: s.label, radius: 260 };
      this.game.hud('mission', this.stepLabel());
    }
  }
  onCarStolen(van) {
    const s = this.currentStep();
    if (s && s.type === 'steal') {
      if (s.van && van !== this.convoyVan) return; // need the convoy van
      this.nextStep();
    }
  }
  nextStep() {
    this.step++;
    this.game.audio.pickup();
    this.enterStep();
  }
  completeMission() {
    const m = this.current();
    const g = this.game;
    g.player.cash += m.reward.cash;
    g.player.respect += m.reward.respect;
    g.player.missionsDone++;
    if (m.reward.crew) {
      g.player.unlockedCrew.push(m.reward.crew);
      g.banner(`Crew unlocked: ${m.reward.crew.toUpperCase()} joined the tide!`, 4);
    }
    g.banner(`MISSION COMPLETE — ${m.title}  +$${m.reward.cash}  +${m.reward.respect} respect`, 4);
    g.audio.mission();
    g.saveGame();
    this.index++;
    this.state = this.isFinished() ? 'done' : 'idle';
    this.step = 0; this.marker = null;
    if (this.isFinished()) {
      g.banner('KING OF THE TIDE — Vespera is yours. The story is complete.', 8);
    } else {
      g.hud('mission', `Next: M${MISSIONS[this.index].id} ${MISSIONS[this.index].title} — go to the yellow marker (press T to start)`);
      g.setStartMarker();
    }
  }
  startTalk(lines) {
    this.state = 'talk';
    this.talkLines = lines; this.talkIdx = 0;
    this.game.showTalk(lines[0]);
  }
  advanceTalk() {
    this.talkIdx++;
    if (this.talkIdx >= this.talkLines.length) {
      this.game.hideTalk();
      this.state = 'active';
      this.nextStep();
    } else this.game.showTalk(this.talkLines[this.talkIdx]);
  }
  update(dt) {
    if (this.state !== 'active') return;
    const g = this.game;
    const s = this.currentStep();
    if (!s) return;
    const p = g.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (s.type === 'goto' || s.type === 'pickup' || s.type === 'deliver') {
      if (dist(px, py, s.x, s.y) < (s.radius || 90)) {
        if (s.type === 'pickup') g.audio.pickup();
        this.nextStep();
      }
    }
    if (s.type === 'talk') {
      if (dist(px, py, s.x, s.y) < (s.radius || 90)) this.startTalk(s.lines);
    }
    if (s.type === 'timed') {
      this.timer -= dt;
      g.hud('timer', `DELIVER IN ${Math.max(0, Math.ceil(this.timer))}s`);
      if (dist(px, py, s.x, s.y) < (s.radius || 110)) { g.hud('timer', ''); this.nextStep(); return; }
      if (this.timer <= 0) {
        g.hud('timer', '');
        g.banner('Too slow — the case went cold. Mission failed, try again (T).', 4);
        g.audio.fail();
        this.state = 'idle'; this.step = 0; this.marker = null;
        g.setStartMarker();
      }
    }
    if (s.type === 'escape') {
      this.timer -= dt;
      g.hud('timer', `LOSE THE POLICE — ${Math.max(0, Math.ceil(this.timer))}s left`);
      if (p.wanted === 0) {
        g.hud('timer', '');
        this.nextStep();
        return;
      }
      if (this.timer <= 0) {
        g.hud('timer', '');
        g.banner('The net closed in. Mission failed, try again (T).', 4);
        g.audio.fail();
        this.state = 'idle'; this.step = 0; this.marker = null;
        g.setStartMarker();
      }
    }
  }
}
