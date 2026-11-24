// NEON TIDE — staged screenshot scenes for ?shot=start|play|chase|mission.
// Each one plays the real game forward from a set-up state (never a mockup) and
// sets window.__shotReady after ~110 frames so a screenshot tool can capture it.

import { makeCar } from './entities.js';
import { Helicopter, PoliceCar } from './entities.js';

export function stageShot(game, name) {
  const p = game.player;
  game.shotCountdown = 110;
  if (name === 'start') {
    game.state = 'menu';
    game.show('menu');
    game.hide('pause'); game.hide('gameover'); game.hide('garage');
    return;
  }
  game.state = 'playing';
  game.hide('menu');
  if (name === 'play') {
    const car = makeCar(1000, 1000, 0, game.rng, { color: '#ff2d78', model: 'Coupe' });
    game.worldParked.push(car);
    p.inCar = car;
    car.speed = 330;
    p.angle = 0;
    game.input.keys.KeyW = true; // keep the car rolling for the shot
    game.camera.x = 1000; game.camera.y = 1000;
    game.rain = 0.95; game.rainTarget = 0.95;
    game.audio.init();
    game.missions.marker = { x: 1500, y: 2380, label: 'M1 First Rain — go to the Old Pier', radius: 90 };
    game.hud('mission', 'M1 First Rain — Go to the Old Pier');
    return;
  }
  if (name === 'chase') {
    const car = makeCar(1800, 1400, Math.PI / 2, game.rng, { color: '#00e5ff', model: 'Sedan' });
    game.worldParked.push(car);
    p.inCar = car;
    car.speed = 380;
    game.input.keys.KeyW = true; // keep the car rolling for the shot
    game.camera.x = 1800; game.camera.y = 1400;
    game.rain = 0.8; game.rainTarget = 0.8;
    game.setWanted(3);
    game.audio.init();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      game.police.push(new PoliceCar(game.rng, 1800 + Math.cos(a) * 320, 1400 + Math.sin(a) * 320));
    }
    game.heli = new Helicopter(1800, 1150);
    game.repositionRoadblocks();
    game.roadblocks = [{ x: 1800, y: 1900, angle: 0 }, { x: 2050, y: 1900, angle: 0 }];
    game.banner('WANTED — 3 STARS', 6);
    game.hud('mission', 'M4 The Drowned Court — Lose the police');
    return;
  }
  if (name === 'mission') {
    p.x = 2620; p.y = 2780; p.angle = -Math.PI / 2;
    p.weapon = 2; // SMG
    p.hp = 1000; p.maxHp = 1000; // staged scene: survive the crossfire for the shot
    game.input.mouse.x = 820; game.input.mouse.y = 600;
    game.input.mouse.down = true; // return fire toward the docks
    game.camera.x = 2620; game.camera.y = 2780;
    game.rain = 0.6; game.rainTarget = 0.6;
    game.audio.init();
    game.missions.index = 4; // Harbor Lights
    game.missions.start();
    game.missions.nextStep(); // skip the goto, enter the kill step (spawns 5 enforcers)
    game.hud('mission', game.missions.stepLabel());
    game.banner('M5 HARBOR LIGHTS — clear the docks', 6);
    return;
  }
  // unknown shot name: just play
  game.state = 'playing';
}
