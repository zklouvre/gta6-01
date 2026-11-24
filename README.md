[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zklouvre/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zklouvre/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON TIDE — an open-world crime game in Vespera

**NEON TIDE** is an original open-world crime game set in Vespera, a rain-slicked neon canal city at 2:14 AM. Two leads — **Rue Calloway**, an ex-courier who hot-wires any car in seconds, and **Marlowe Voss**, an ex-dock enforcer who hits twice as hard — owe a debt to the Drowned Court, and ten jobs stand between them and owning the tide.

Everything here is invented: the city, the characters, the story, the art, the music. No Rockstar Games content, no real GTA names.

## What is in the game

- **A city on foot and by car** — 3.2 km of streets, two canals with bridges, neon-signed blocks, docks, a night market, a hospital, VPD Central.
- **Traffic and pedestrians** — AI cars drive the grid, peds walk the sidewalks and flee gunfire.
- **Carjacking** — walk up to any parked or driven car and take it. The VPD notices.
- **Wanted 1–5 stars** — named VPD dispatch units chase and ram you, roadblocks at 3 stars, a helicopter with a spotlight at 4–5 stars. Lose them by breaking line of sight, or lay low at the safehouse.
- **10 story missions** with a real arc — from a first meeting on the Old Pier to taking the Harbor Master's yacht. Timed deliveries, shootouts, a convoy ambush, a four-star storm escape.
- **Combat with 4 weapons** — fists, P-9 pistol, Vesper SMG, Tide shotgun — plus a weapon wheel (hold Q).
- **HUD with a live minimap** — health/armor, cash, respect rank, wanted stars, clock, radio, speed, mission tracker.
- **Start screen and save** — pick your lead, continue from a localStorage save, autosave on every completed mission.
- **Radio** — three fully procedural stations (VESPERA FM synthwave, CANAL 9 lo-fi, TIDE TALK news) synthesized live with WebAudio. No audio files.
- **Garage upgrades** — engine, armor, rain tires and neon underglow, bought with job cash at Vex Garage.
- **Respect ranks** — Street Rat → Runner → Hustler → Made → Kingpin of the Tide.
- **Day/night + rain weather** — the clock runs, dawn breaks over the canals, and heavy rain genuinely lowers your grip (rain tires fix it).
- **Two playable leads** — switch between Rue and Marlowe at the safehouse (C). Different speed, health and melee.
- **Crew abilities** — Vex (getaway driver), Sable (signal hacker), Brutus (muscle) join through the story and grant passive bonuses.

## Run it

No build step, no network. Open `game/index.html` in a desktop browser (Chrome recommended), or serve the folder:

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Shift | Run |
| Mouse | Aim (on foot) |
| Click | Shoot (hold for SMG) |
| E | Enter / exit car · steal a car · talk · use safehouse / garage |
| 1–4 | Weapons (fists / pistol / SMG / shotgun) |
| Q (hold) | Weapon wheel |
| Wheel | Cycle weapons |
| T | Start the next story mission |
| C | Switch lead (at the safehouse) |
| R | Cycle radio station |
| M | Mute |
| 5 | Cycle active crew member |
| Esc / P | Pause (save from here) |

## Screenshots

Staged from the live game (`?shot=start|play|chase|mission` plays the real rules forward and sets `window.__shotReady`):

1. `screenshots/1-start.jpg` — title screen over the city
2. `screenshots/2-play.jpg` — driving the neon streets in heavy rain
3. `screenshots/3-chase.jpg` — 5-star VPD chase with helicopter and roadblocks
4. `screenshots/4-mission.jpg` — M5 Harbor Lights: clearing the docks

## Tech

Plain Canvas 2D + WebAudio, zero dependencies, zero network requests at runtime. Entry point `main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=ddjvdkr0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
