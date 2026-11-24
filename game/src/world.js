// Vespera — the rain-slicked neon canal city. Deterministic generation from a seed.
// Streets on a 400px grid; two canals cut the city with bridges at every crossing.

import { mulberry32, pick, range, rangeInt, clamp } from './random.js';
import { WORLD, COLORS } from './config.js';

const STREET_CENTERS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const CANAL_V = { x0: 1520, x1: 1680 }; // vertical canal band
export const CANAL_H = { y0: 1920, y1: 2080 }; // horizontal canal band

const CAR_COLORS = ['#ff2d78', '#00e5ff', '#ffea00', '#e8e8f0', '#ff7a00', '#b967ff', '#2ecc71', '#c0c8d8', '#ff4040', '#3a6cff'];
const CAR_MODELS = ['Hatch', 'Sedan', 'Coupe', 'Van', 'Taxi', 'Truck'];

export function generateWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const lamps = [];
  const signs = [];
  const parked = [];
  const props = [];

  const isCanal = (x, y) =>
    (x > CANAL_V.x0 && x < CANAL_V.x1) || (y > CANAL_H.y0 && y < CANAL_H.y1);

  // Special plots (kept clear of buildings): safehouse, garage, hospital, VPD, pier, market, docks
  const clearPlots = [
    { x: 620, y: 620, w: 220, h: 220 },   // safehouse block
    { x: 1100, y: 620, w: 220, h: 220 },  // garage block
    { x: 2420, y: 620, w: 220, h: 220 },  // hospital block
    { x: 2420, y: 2420, w: 260, h: 260 }, // VPD block
    { x: 1420, y: 2300, w: 220, h: 220 }, // old pier (on canal bank)
    { x: 2570, y: 1100, w: 220, h: 220 }, // night market
    { x: 2570, y: 2820, w: 260, h: 220 }, // south docks
  ];
  const inClear = (x, y, w, h) => clearPlots.some(p =>
    x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);

  // Blocks: between road edges. Roads are 84 wide around each street center.
  const half = WORLD.road / 2;
  for (let bx = 0; bx < 8; bx++) {
    for (let by = 0; by < 8; by++) {
      const x0 = STREET_CENTERS[bx] + half + 14;
      const x1 = (STREET_CENTERS[bx + 1] ?? WORLD.size + 42) - half - 14;
      const y0 = STREET_CENTERS[by] + half + 14;
      const y1 = (STREET_CENTERS[by + 1] ?? WORLD.size + 42) - half - 14;
      const w = x1 - x0, h = y1 - y0;
      if (w < 60 || h < 60) continue;
      // Canal runs through this block: leave water + quays, buildings on the sides.
      const crossesV = x0 < CANAL_V.x1 && x1 > CANAL_V.x0;
      const crossesH = y0 < CANAL_H.y1 && y1 > CANAL_H.y0;
      if (crossesV && !crossesH) {
        // two building strips left/right of the canal
        addStrip(buildings, signs, rng, x0, y0, CANAL_V.x0 - 16 - x0, h, 'v');
        addStrip(buildings, signs, rng, CANAL_V.x1 + 16, y0, x1 - (CANAL_V.x1 + 16), h, 'v');
        continue;
      }
      if (crossesH && !crossesV) {
        addStrip(buildings, signs, rng, x0, y0, w, CANAL_H.y0 - 16 - y0, 'h');
        addStrip(buildings, signs, rng, x0, CANAL_H.y1 + 16, w, y1 - (CANAL_H.y1 + 16), 'h');
        continue;
      }
      if (crossesV && crossesH) { // canal crossing block: four corner buildings
        addStrip(buildings, signs, rng, x0, y0, CANAL_V.x0 - 16 - x0, CANAL_H.y0 - 16 - y0, 'c');
        addStrip(buildings, signs, rng, CANAL_V.x1 + 16, y0, x1 - (CANAL_V.x1 + 16), CANAL_H.y0 - 16 - y0, 'c');
        addStrip(buildings, signs, rng, x0, CANAL_H.y1 + 16, CANAL_V.x0 - 16 - x0, y1 - (CANAL_H.y1 + 16), 'c');
        addStrip(buildings, signs, rng, CANAL_V.x1 + 16, CANAL_H.y1 + 16, x1 - (CANAL_V.x1 + 16), y1 - (CANAL_H.y1 + 16), 'c');
        continue;
      }
      if (inClear(x0, y0, w, h)) continue;
      // Normal block: 1-4 buildings.
      const n = rangeInt(rng, 1, 4);
      if (n === 1) {
        addBuilding(buildings, signs, rng, x0, y0, w, h);
      } else {
        const vertical = rng() < 0.5;
        for (let i = 0; i < n; i++) {
          if (vertical) {
            const bw = w / n;
            addBuilding(buildings, signs, rng, x0 + i * bw + 6, y0 + 6, bw - 12, h - 12);
          } else {
            const bh = h / n;
            addBuilding(buildings, signs, rng, x0 + 6, y0 + i * bh + 6, w - 12, bh - 12);
          }
        }
      }
    }
  }

  // Lamps at intersections.
  for (const sx of STREET_CENTERS) for (const sy of STREET_CENTERS) {
    if (isCanal(sx, sy)) continue;
    lamps.push({ x: sx + 52, y: sy + 52 });
    lamps.push({ x: sx - 52, y: sy - 52 });
  }

  // Neon signs on random buildings.
  for (const b of buildings) {
    if (rng() < 0.55) {
      signs.push({
        x: b.x + b.w / 2, y: b.y - 6,
        text: pick(rng, ['NOODLE', 'NEON', 'HOTEL', 'BAR', '24H', 'TIDE', 'RAMEN', 'CLUB', 'KTV', 'PIER', 'DANCE', 'SUSHI']),
        color: pick(rng, COLORS.neon), w: range(rng, 46, 90),
      });
    }
  }

  // Parked cars along roads.
  for (let i = 0; i < 46; i++) {
    const horiz = rng() < 0.5;
    const s = pick(rng, STREET_CENTERS);
    const t = range(rng, 120, WORLD.size - 120);
    let x = horiz ? t : s + (rng() < 0.5 ? 30 : -30);
    let y = horiz ? s + (rng() < 0.5 ? 30 : -30) : t;
    if (isCanal(x, y)) continue;
    const model = pick(rng, CAR_MODELS);
    parked.push({ x, y, angle: horiz ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), color: pick(rng, CAR_COLORS), model, taken: false, len: (model === 'Van' || model === 'Truck') ? 52 : 42, wid: 22, hp: 100, maxHp: 100, speed: 0 });
  }

  // Docks props: containers, cranes silhouettes.
  for (let i = 0; i < 10; i++) {
    props.push({ kind: 'container', x: 2560 + (i % 5) * 56, y: 2840 + Math.floor(i / 5) * 60, color: pick(rng, ['#b03a2e', '#1f618d', '#7d6608', '#145a32']) });
  }

  return { buildings, lamps, signs, parked, props, rng };
}

function addStrip(buildings, signs, rng, x, y, w, h, _axis) {
  if (w < 40 || h < 40) return;
  if (w > 120 || h > 120) {
    // split long strip into two buildings
    if (w >= h) {
      addBuilding(buildings, signs, rng, x, y, w / 2 - 6, h);
      addBuilding(buildings, signs, rng, x + w / 2 + 6, y, w / 2 - 6, h);
    } else {
      addBuilding(buildings, signs, rng, x, y, w, h / 2 - 6);
      addBuilding(buildings, signs, rng, x, y + h / 2 + 6, w, h / 2 - 6);
    }
  } else addBuilding(buildings, signs, rng, x, y, w, h);
}

function addBuilding(buildings, signs, rng, x, y, w, h) {
  if (w < 24 || h < 24) return;
  buildings.push({
    x, y, w, h,
    color: pick(rng, COLORS.building),
    neon: rng() < 0.5 ? pick(rng, COLORS.neon) : null,
    tall: range(rng, 0.4, 1.6),
  });
}

// ---- Queries used by physics / AI ----
export function isWater(x, y) {
  return (x > CANAL_V.x0 && x < CANAL_V.x1) || (y > CANAL_H.y0 && y < CANAL_H.y1);
}
export function onBridge(x, y) {
  const onV = x > CANAL_V.x0 && x < CANAL_V.x1;
  const onH = y > CANAL_H.y0 && y < CANAL_H.y1;
  if (onV && !onH) return STREET_CENTERS.some(c => Math.abs(y - c) < WORLD.road / 2 + 6);
  if (onH && !onV) return STREET_CENTERS.some(c => Math.abs(x - c) < WORLD.road / 2 + 6);
  return false;
}
// Solid for a walking player or a car: buildings block; water blocks unless on a bridge.
export function isBlocked(buildings, x, y, r = 14) {
  if (x < 20 || y < 20 || x > WORLD.size - 20 || y > WORLD.size - 20) return true;
  if (isWater(x, y) && !onBridge(x, y)) return true;
  for (const b of buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  return false;
}
export function isRoad(x, y) {
  const near = STREET_CENTERS.some(c => Math.abs(x - c) < WORLD.road / 2) ||
    STREET_CENTERS.some(c => Math.abs(y - c) < WORLD.road / 2);
  return (near && !isWater(x, y)) || onBridge(x, y);
}
export function nearestStreet(v) {
  let best = STREET_CENTERS[0], bd = 1e9;
  for (const c of STREET_CENTERS) { const d = Math.abs(v - c); if (d < bd) { bd = d; best = c; } }
  return best;
}
export function collideBuildings(buildings, x, y, r) {
  // returns corrected {x, y} after pushing a circle out of building rects
  for (const b of buildings) {
    const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.001) { x = b.x - r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r; y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}
