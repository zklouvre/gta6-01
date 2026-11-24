// NEON TIDE — entities: player, cars, traffic, pedestrians, police, helicopter, enemies.
// Arcade physics tuned for wet neon streets: rain lowers grip, upgrades raise it.

import { WORLD } from './config.js';
import { clamp, angleDiff, dist, mulberry32, pick, range } from './random.js';
import { isRoad, isWater, onBridge, nearestStreet, collideBuildings, isBlocked } from './world.js';

const CAR_COLORS = ['#ff2d78', '#00e5ff', '#ffea00', '#e8e8f0', '#ff7a00', '#b967ff', '#2ecc71', '#c0c8d8', '#ff4040', '#3a6cff'];
const CAR_MODELS = ['Hatch', 'Sedan', 'Coupe', 'Van', 'Taxi', 'Truck'];
const STREET_CENTERS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];

export function makeCar(x, y, angle, rng, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || pick(rng, CAR_COLORS),
    model: opts.model || pick(rng, CAR_MODELS),
    len: opts.model === 'Van' || opts.model === 'Truck' ? 52 : 42,
    wid: 22,
    hp: opts.hp ?? 100, maxHp: opts.hp ?? 100,
    stolen: !!opts.stolen, police: !!opts.police, van: !!opts.van,
    driver: opts.driver ?? null, // 'traffic' | 'parked' | null
  };
}

export function driveCar(car, input, dt, grip, topMul, accelMul, world) {
  const maxSpeed = 460 * topMul;
  const accel = 340 * accelMul;
  const brake = 520;
  const reverseMax = 160;
  if (input.up) car.speed += accel * dt;
  if (input.down) {
    if (car.speed > 20) car.speed -= brake * dt;
    else car.speed -= accel * 0.6 * dt;
  }
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 140 * dt;
  car.speed = clamp(car.speed, -reverseMax, maxSpeed);
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const gripFactor = grip; // 1.0 dry-ish, lower in heavy rain
  car.angle += steer * 2.4 * dt * clamp(Math.abs(car.speed) / 160, 0, 1) * Math.sign(car.speed || 1) * gripFactor;
  // wet slide: lateral drift
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const slide = (1 - gripFactor) * 0.35;
  car.x = nx + (Math.random() - 0.5) * slide * Math.abs(car.speed) * dt * 8;
  car.y = ny + (Math.random() - 0.5) * slide * Math.abs(car.speed) * dt * 8;
  // buildings block; water blocks unless on a bridge
  const fixed = collideBuildings(world.buildings, car.x, car.y, 18);
  if (isWater(car.x, car.y) && !onBridge(car.x, car.y)) {
    car.x -= Math.cos(car.angle) * car.speed * dt;
    car.y -= Math.sin(car.angle) * car.speed * dt;
    car.speed *= 0.4;
  } else { car.x = fixed.x; car.y = fixed.y; }
  car.x = clamp(car.x, 30, WORLD.size - 30);
  car.y = clamp(car.y, 30, WORLD.size - 30);
  return car;
}

export class Player {
  constructor(lead, x, y) {
    this.lead = lead;
    this.x = x; this.y = y; this.angle = -Math.PI / 2;
    this.speed = 0;
    this.hp = lead.hp; this.maxHp = lead.hp; this.armor = 0;
    this.cash = 200; this.respect = 0;
    this.weapon = 1; // pistol default
    this.ammo = [Infinity, 60, 180, 30];
    this.inCar = null;
    this.wanted = 0; this.heat = 0; // heat 0..100, stars = floor(heat/20)
    this.lastSeen = 0; this.bustedTimer = 0;
    this.upgrades = { engine: 0, armor: 0, tires: 0, neon: 0 };
    this.crew = null; this.unlockedCrew = [];
    this.missionsDone = 0;
    this.rainGrip = 1;
  }
  footSpeed() { return 235 * this.lead.speed; }
  moveFoot(input, dt, world) {
    const sp = this.footSpeed() * (input.run ? 1.45 : 1);
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      this.angle = Math.atan2(dy, dx);
      const nx = this.x + dx * sp * dt, ny = this.y + dy * sp * dt;
      if (!isBlocked(world.buildings, nx, this.y, 13)) this.x = nx;
      if (!isBlocked(world.buildings, this.x, ny, 13)) this.y = ny;
      this.speed = sp;
    } else this.speed = 0;
    this.x = clamp(this.x, 24, WORLD.size - 24);
    this.y = clamp(this.y, 24, WORLD.size - 24);
  }
}

export class TrafficCar {
  constructor(rng, world) {
    const horiz = rng() < 0.5;
    const street = pick(rng, STREET_CENTERS);
    const along = range(rng, 100, WORLD.size - 100);
    this.axis = horiz ? 'h' : 'v';
    this.street = street;
    this.dir = rng() < 0.5 ? 1 : -1;
    this.pos = along;
    this.speed = range(rng, 110, 190);
    this.car = makeCar(horiz ? along : street + (this.dir > 0 ? 20 : -20),
      horiz ? street + (this.dir > 0 ? 20 : -20) : along,
      horiz ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2), rng, { driver: 'traffic' });
    this.wait = 0;
  }
  update(dt, world, others) {
    if (this.wait > 0) { this.wait -= dt; return; }
    // slow for a car ahead in the same lane
    let target = this.speed;
    for (const o of others) {
      if (o === this) continue;
      if (o.axis !== this.axis || o.street !== this.street || o.dir !== this.dir) continue;
      const gap = (o.pos - this.pos) * this.dir;
      if (gap > 0 && gap < 90) { target = 0; break; }
    }
    this.pos += this.dir * target * dt;
    if (this.pos < 60 || this.pos > WORLD.size - 60) {
      this.pos = clamp(this.pos, 60, WORLD.size - 60);
      this.dir *= -1;
      this.car.angle += Math.PI;
    }
    // turn at an intersection sometimes
    const nearCross = STREET_CENTERS.find(c => Math.abs(this.pos - c) < 6);
    if (nearCross !== undefined && Math.random() < 0.004) {
      const oldAxis = this.axis;
      this.axis = oldAxis === 'h' ? 'v' : 'h';
      this.street = nearCross;
      this.pos = this.axis === 'h' ? this.car.y : this.car.x;
      this.dir = Math.random() < 0.5 ? 1 : -1;
    }
    if (this.axis === 'h') {
      this.car.x = this.pos;
      this.car.y = this.street + (this.dir > 0 ? 20 : -20);
      this.car.angle = this.dir > 0 ? 0 : Math.PI;
    } else {
      this.car.x = this.street + (this.dir > 0 ? 20 : -20);
      this.car.y = this.pos;
      this.car.angle = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // keep off the canals: bridges only carry the road; traffic stays on roads by construction
    this.car.speed = target;
  }
}

export class Ped {
  constructor(rng, world) {
    const sx = pick(rng, STREET_CENTERS), sy = pick(rng, STREET_CENTERS);
    this.x = clamp(sx + range(rng, -160, 160), 40, WORLD.size - 40);
    this.y = clamp(sy + range(rng, -160, 160), 40, WORLD.size - 40);
    this.angle = range(rng, 0, Math.PI * 2);
    this.speed = range(rng, 40, 75);
    this.color = pick(rng, ['#ff8fb0', '#7fd4ff', '#ffe08a', '#9dff8a', '#e0aaff', '#ffb27a']);
    this.flee = 0; this.wait = range(rng, 0, 3);
    this.hp = 100; this.dead = false;
  }
  update(dt, world, danger) {
    if (this.dead) return;
    if (danger) { this.flee = 2.5; this.fleeAngle = Math.atan2(this.y - danger.y, this.x - danger.x); }
    if (this.flee > 0) {
      this.flee -= dt;
      this.angle = this.fleeAngle ?? this.angle;
      const sp = 150;
      const nx = this.x + Math.cos(this.angle) * sp * dt;
      const ny = this.y + Math.sin(this.angle) * sp * dt;
      if (!isBlocked(world.buildings, nx, this.y, 10)) this.x = nx;
      if (!isBlocked(world.buildings, this.x, ny, 10)) this.y = ny;
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    if (isBlocked(world.buildings, nx, ny, 10) || isWater(nx, ny)) {
      this.angle = range(Math.random, 0, Math.PI * 2);
      this.wait = range(Math.random, 0.5, 2);
      return;
    }
    this.x = nx; this.y = ny;
    if (Math.random() < 0.002) this.angle += range(Math.random, -1, 1);
    if (Math.random() < 0.001) this.wait = range(Math.random, 1, 4);
  }
}

export class PoliceCar {
  constructor(rng, x, y) {
    this.car = makeCar(x, y, 0, rng, { color: '#1a2cff', model: 'Interceptor', police: true, hp: 160 });
    this.car.hp = 160; this.car.maxHp = 160;
    this.stuck = 0; this.shootCd = 0;
  }
  update(dt, world, player, stars) {
    const c = this.car;
    const tx = player.inCar ? player.inCar.x : player.x;
    const ty = player.inCar ? player.inCar.y : player.y;
    const d = dist(c.x, c.y, tx, ty);
    const want = Math.atan2(ty - c.y, tx - c.x);
    // pursue: steer toward the player, faster at higher stars
    const targetSpeed = stars >= 4 ? 430 : stars >= 2 ? 390 : 350;
    const diff = angleDiff(c.angle, want);
    c.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    c.speed = clamp(c.speed + 300 * dt, 0, targetSpeed);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!isBlocked(world.buildings, nx, ny, 16) && !(isWater(nx, ny) && !onBridge(nx, ny))) {
      c.x = nx; c.y = ny; this.stuck = 0;
    } else {
      // reverse out of a wall
      c.x -= Math.cos(c.angle) * c.speed * dt * 0.5;
      c.y -= Math.sin(c.angle) * c.speed * dt * 0.5;
      c.angle += 1.4 * dt;
      this.stuck += dt;
    }
    if (this.stuck > 4) { // respawn the unit elsewhere rather than stay wedged
      const a = Math.random() * Math.PI * 2;
      c.x = clamp(tx + Math.cos(a) * 700, 60, WORLD.size - 60);
      c.y = clamp(ty + Math.sin(a) * 700, 60, WORLD.size - 60);
      this.stuck = 0;
    }
    // ram damage
    if (d < 46) {
      if (player.inCar) {
        player.inCar.hp -= 14 * dt;
        c.speed *= 0.6;
      } else {
        player.hp -= 10 * dt;
      }
    }
    // at 3+ stars, cops shoot when close
    this.shootCd -= dt;
    if (stars >= 3 && d < 320 && this.shootCd <= 0 && !player.inCar) {
      this.shootCd = 0.9;
      player.hp -= 6;
      return { shot: true, fromX: c.x, fromY: c.y };
    }
    return null;
  }
}

export class Helicopter {
  constructor(x, y) {
    this.x = x; this.y = y; this.angle = 0; this.blade = 0;
  }
  update(dt, player) {
    const tx = player.inCar ? player.inCar.x : player.x;
    const ty = player.inCar ? player.inCar.y : player.y;
    const want = Math.atan2(ty - this.y, tx - this.x);
    this.angle += angleDiff(this.angle, want) * dt * 1.2;
    const d = dist(this.x, this.y, tx, ty);
    if (d > 60) {
      this.x += Math.cos(want) * 260 * dt;
      this.y += Math.sin(want) * 260 * dt;
    }
    this.blade += dt * 30;
  }
}

export class Enemy {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = range(rng, 0, Math.PI * 2);
    this.hp = 100; this.dead = false;
    this.shootCd = range(rng, 0.3, 1.2);
    this.color = '#ff4040';
    this.speed = range(rng, 55, 85);
  }
  update(dt, world, player) {
    if (this.dead) return null;
    const d = dist(this.x, this.y, player.inCar ? player.inCar.x : player.x, player.inCar ? player.inCar.y : player.y);
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    this.angle = Math.atan2(py - this.y, px - this.x);
    this.shootCd -= dt;
    if (d < 380 && d > 90) {
      const nx = this.x + Math.cos(this.angle) * this.speed * dt;
      const ny = this.y + Math.sin(this.angle) * this.speed * dt;
      if (!isBlocked(world.buildings, nx, ny, 12)) { this.x = nx; this.y = ny; }
    }
    if (d < 420 && this.shootCd <= 0) {
      this.shootCd = 1.3;
      return { shot: true, fromX: this.x, fromY: this.y, damage: 6 };
    }
    return null;
  }
}
