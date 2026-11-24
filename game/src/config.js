// NEON TIDE — config: world, weapons, ranks, radio, dialogue.
// Original work. City, characters, story, names and art are all invented here.

export const WORLD = {
  size: 3200,
  block: 400, // street grid pitch
  road: 84, // road width
  canalV: { x: 1400, w: 160 }, // vertical canal band
  canalH: { y: 1800, w: 160 }, // horizontal canal band
  seed: 20261124,
};

export const COLORS = {
  ground: '#0a0c14',
  road: '#12141f',
  roadLine: '#3a3f5e',
  sidewalk: '#181b2a',
  canal: '#0a2a3d',
  canalDeep: '#06202f',
  building: ['#1b1e30', '#221c33', '#1a2436', '#2a1e2e', '#16242a'],
  neon: ['#ff2d78', '#00e5ff', '#ffea00', '#7cff00', '#ff7a00', '#b967ff'],
  lamp: '#ffd9a0',
  playerRue: '#ff2d78',
  playerMarlowe: '#00e5ff',
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', key: '1', damage: 25, rate: 320, range: 42, ammo: Infinity, spread: 0, auto: false, color: '#ffb37a' },
  { id: 'pistol', name: 'P-9 Pistol', key: '2', damage: 34, rate: 260, range: 420, ammo: 60, spread: 0.04, auto: false, color: '#ffd24a' },
  { id: 'smg', name: 'Vesper SMG', key: '3', damage: 18, rate: 85, range: 380, ammo: 180, spread: 0.09, auto: true, color: '#00e5ff' },
  { id: 'shotgun', name: 'Tide Shotgun', key: '4', damage: 22, rate: 700, range: 300, ammo: 30, spread: 0.16, pellets: 6, auto: false, color: '#ff7a00' },
];

export const RANKS = [
  { min: 0, name: 'Street Rat' },
  { min: 150, name: 'Runner' },
  { min: 400, name: 'Hustler' },
  { min: 800, name: 'Made' },
  { min: 1500, name: 'Kingpin of the Tide' },
];

export const UPGRADES = {
  engine: [
    { name: 'Stock Engine', cost: 0, top: 1.0, accel: 1.0 },
    { name: 'Tuned Engine', cost: 400, top: 1.22, accel: 1.25 },
    { name: 'Harbor Turbo', cost: 1200, top: 1.45, accel: 1.5 },
  ],
  armor: [
    { name: 'No Plating', cost: 0, hp: 1.0 },
    { name: 'Door Plates', cost: 350, hp: 1.5 },
    { name: 'Armored Hull', cost: 1000, hp: 2.2 },
  ],
  tires: [
    { name: 'Street Tires', cost: 0, grip: 1.0 },
    { name: 'Rain Treads', cost: 300, grip: 1.3 },
    { name: 'Hydro Grips', cost: 900, grip: 1.6 },
  ],
  neon: [
    { name: 'No Underglow', cost: 0, color: null },
    { name: 'Pink Underglow', cost: 200, color: '#ff2d78' },
    { name: 'Cyan Underglow', cost: 200, color: '#00e5ff' },
    { name: 'Gold Underglow', cost: 350, color: '#ffea00' },
  ],
};

export const CREW = [
  { id: 'vex', name: 'Vex', role: 'Getaway Driver', bonus: 'Car handling +25%', mission: 6 },
  { id: 'sable', name: 'Sable', role: 'Signal Hacker', bonus: 'Wanted cools down 40% faster', mission: 7 },
  { id: 'brutus', name: 'Brutus', role: 'Muscle', bonus: 'Weapon damage +25%', mission: 9 },
];

export const LEADS = {
  rue: {
    id: 'rue', name: 'RUE', full: 'Rue Calloway', color: '#ff2d78',
    desc: 'Ex-courier. Fast on foot, hot-wires any car in seconds.',
    speed: 1.18, hp: 100, melee: 1.0, carjack: 0.4,
  },
  marlowe: {
    id: 'marlowe', name: 'MARLOWE', full: 'Marlowe Voss', color: '#00e5ff',
    desc: 'Ex-dock enforcer. Tougher, hits twice as hard up close.',
    speed: 1.0, hp: 140, melee: 2.0, carjack: 1.0,
  },
};

export const RADIO = [
  { id: 'vespera', name: 'VESPERA FM', genre: 'Neon Synthwave', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { id: 'canal9', name: 'CANAL 9', genre: 'Rainy Lo-Fi', bpm: 76, root: 65.41, scale: [0, 3, 5, 7, 10], wave: 'triangle' },
  { id: 'tide', name: 'TIDE TALK', genre: 'Night News & Talk', bpm: 96, root: 49, scale: [0, 4, 7], wave: 'square' },
];

export const START = { x: 760, y: 760, angle: -Math.PI / 2 };
export const SAFEHOUSE = { x: 700, y: 700, r: 90, name: 'Safehouse — The Gull Roost' };
export const GARAGE = { x: 1180, y: 700, r: 90, name: 'Vex Garage' };
export const HOSPITAL = { x: 2500, y: 700, r: 90, name: 'St. Anselm Hospital' };
export const POLICE_HQ = { x: 2500, y: 2500, r: 110, name: 'VPD Central' };

export function rankFor(respect) {
  let r = RANKS[0];
  for (const x of RANKS) if (respect >= x.min) r = x;
  return r;
}

// ---- Story: 10 missions. Steps: goto | talk | steal | deliver | kill | destroy | escape | pickup
export const MISSIONS = [
  {
    id: 1, title: 'First Rain', giver: 'Marlowe',
    brief: 'Meet Marlowe at the old pier. The tide is coming in, and so is trouble.',
    reward: { cash: 150, respect: 60 },
    steps: [
      { type: 'goto', x: 1500, y: 2380, label: 'Go to the Old Pier', radius: 90 },
      { type: 'talk', x: 1500, y: 2380, label: 'Talk to Marlowe', lines: ['MARLOWE: You came. Good. Vespera eats people who hesitate.', 'RUE: Then let\'s not hesitate. What\'s the job?', 'MARLOWE: The Drowned Court owns this city\'s debts. We\'re going to own them back.'] },
    ],
  },
  {
    id: 2, title: 'Hot Wire', giver: 'Marlowe',
    brief: 'Steal any car on the street and bring it to Vex Garage. No questions, no witnesses.',
    reward: { cash: 250, respect: 80 },
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { type: 'deliver', x: 1180, y: 700, label: 'Deliver the car to Vex Garage', radius: 110 },
    ],
  },
  {
    id: 3, title: 'Neon Run', giver: 'Vex',
    brief: 'A sealed case for the Canal District. 90 seconds. The rain will not slow down for you.',
    reward: { cash: 400, respect: 100 },
    steps: [
      { type: 'pickup', x: 1180, y: 700, label: 'Pick up the case at Vex Garage', radius: 100 },
      { type: 'timed', x: 2650, y: 2650, label: 'Deliver the case to the Canal District', radius: 110, seconds: 90 },
    ],
  },
  {
    id: 4, title: 'The Drowned Court', giver: 'Sable',
    brief: 'Meet Sable at the market. Then run — the VPD has your plates.',
    reward: { cash: 500, respect: 120 },
    steps: [
      { type: 'goto', x: 2650, y: 1180, label: 'Meet Sable at the Night Market', radius: 90 },
      { type: 'talk', x: 2650, y: 1180, label: 'Hear Sable out', lines: ['SABLE: The Court moves money through the harbor at midnight.', 'SABLE: Take their ledger and the city tilts our way.', 'RUE: Then we take the ledger.'] },
      { type: 'escape', label: 'Lose the police (get your wanted level to 0)', seconds: 150 },
    ],
  },
  {
    id: 5, title: 'Harbor Lights', giver: 'Marlowe',
    brief: 'Court enforcers hold the south docks. Clear them out. Weapons free.',
    reward: { cash: 700, respect: 150 },
    steps: [
      { type: 'goto', x: 2650, y: 2900, label: 'Reach the South Docks', radius: 120 },
      { type: 'kill', count: 5, label: 'Take out the Court enforcers (0/5)', radius: 320, at: { x: 2650, y: 2900 } },
    ],
  },
  {
    id: 6, title: 'Rain Check', giver: 'Vex',
    brief: 'Vex is cornered by a Court crew near the bridge. Get her out — she drives for us now.',
    reward: { cash: 600, respect: 140, crew: 'vex' },
    steps: [
      { type: 'goto', x: 1500, y: 1180, label: 'Reach Vex at the North Bridge', radius: 110 },
      { type: 'kill', count: 3, label: 'Clear the Court crew (0/3)', radius: 300, at: { x: 1500, y: 1180 } },
      { type: 'pickup', x: 1500, y: 1180, label: 'Pick up Vex', radius: 90 },
    ],
  },
  {
    id: 7, title: 'Blackout', giver: 'Sable',
    brief: 'Shoot out three junction boxes so Sable can slip the Court ledger out of the grid.',
    reward: { cash: 800, respect: 160, crew: 'sable' },
    steps: [
      { type: 'destroy', count: 3, label: 'Destroy the junction boxes (0/3)', spots: [{ x: 700, y: 1500 }, { x: 2300, y: 1500 }, { x: 1500, y: 2900 }] },
    ],
  },
  {
    id: 8, title: 'Tide Turner', giver: 'Marlowe',
    brief: 'A Court convoy crosses the east bridge. Ram the armored van, steal it, bring it home.',
    reward: { cash: 1000, respect: 200 },
    steps: [
      { type: 'goto', x: 2900, y: 1900, label: 'Ambush the convoy at the East Bridge', radius: 130 },
      { type: 'steal', label: 'Steal the armored van (press E by it)', van: true },
      { type: 'deliver', x: 1180, y: 700, label: 'Deliver the van to Vex Garage', radius: 120 },
    ],
  },
  {
    id: 9, title: 'Storm Surge', giver: 'Vex',
    brief: 'The whole city is awake. Survive a four-star storm and make it to the safehouse.',
    reward: { cash: 1200, respect: 220, crew: 'brutus' },
    steps: [
      { type: 'goto', x: 700, y: 2650, label: 'Reach the storm rally point', radius: 110 },
      { type: 'escape', label: 'Survive and lose the police (wanted to 0)', seconds: 180, forceStars: 4 },
    ],
  },
  {
    id: 10, title: 'King of the Tide', giver: 'Marlowe',
    brief: 'The Harbor Master\'s yacht is moored at the south canal. End the Court tonight.',
    reward: { cash: 2500, respect: 400 },
    steps: [
      { type: 'goto', x: 1500, y: 2900, label: 'Reach the Harbor Master\'s yacht', radius: 120 },
      { type: 'kill', count: 8, label: 'Clear the yacht guards (0/8)', radius: 340, at: { x: 1500, y: 2900 } },
      { type: 'talk', x: 1500, y: 2900, label: 'Face the Harbor Master', lines: ['HARBOR MASTER: You think the tide answers to you, child?', 'RUE: No. The tide answers to no one. That\'s why it\'s ours now.', 'MARLOWE: Vespera is free tonight.'] },
    ],
  },
];
