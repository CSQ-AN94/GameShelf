# GameShelf

GameShelf is a local-first private game library for Windows. It is designed for visual novels, indie games, and other locally installed games across different content ratings.

The distinguishing idea is the **Play Profile**: one reproducible way to play a game, combining a launch target, selected packages, a save branch, and optional launch helpers.

## Current milestone

- Local SQLite library
- Poster grid and game details
- Add a local Windows executable
- Launch and record play sessions
- Safe View for sensitive entries

Mod/package management, save snapshots, routes, metadata providers, and advanced launch helpers are planned after the first end-to-end milestone is stable.

## Development

```bash
npm install
npm start
```

Build a Windows installer on Windows:

```bash
npm run make
```
