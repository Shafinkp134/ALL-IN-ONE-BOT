# ALL-IN-ONE SA-MP Gamemode

This directory contains a lightweight SA-MP (San Andreas Multiplayer) gamemode scaffold you can compile with the Pawn compiler.

## Features
- Clean startup/shutdown flow
- Simple login-free player stats (kills, deaths, money earned)
- Basic commands: `/help`, `/stats`, `/givecash`, `/setskin`
- Spawn setup with a few default classes

## Build
1. Install the SA-MP server package and Pawn compiler (pawncc).
2. Copy `samp-gamemode/gamemodes/allinone.pwn` into your SA-MP `gamemodes/` folder.
3. Compile with `pawncc`.
4. Set `gamemode0 allinone` in `server.cfg`.

## Notes
This is intended as a starter template. Expand it with jobs, pickups, vehicles, or a database layer as needed.
