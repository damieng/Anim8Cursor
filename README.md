# Anim8Cursor

A web-based editor for Windows animated mouse cursor (.ani) files, built with Preact, TypeScript, and Tailwind CSS.

## Features

- Open and save `.ani` files (RIFF/ACON format)
- Frame-by-frame RGBA pixel editor with draw, erase, and hotspot tools
- Per-frame hotspot positioning
- Animated preview with playback controls
- Per-frame rate and global speed (jiffies) support
- Frame management: add, duplicate, delete, reorder
- MDI window layout with draggable, resizable panes
- Auto-persists all open cursors, window positions, and state to localStorage

## Stack

- [Preact](https://preactjs.com/) + [@preact/signals](https://preactjs.com/guide/v10/signals)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Vite](https://vite.dev/)
- [Lucide](https://lucide.dev/) icons

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Usage

1. Open a `.ani` file via the file picker or drag-and-drop
2. Click a frame in the grid to select it — the editor opens automatically
3. Use **Draw** to paint pixels, **Erase** for transparency, **Hotspot** to set the click point
4. Use **Preview** to watch the animation loop
5. **Save .ani** exports the current state as a downloadable file

## License

MIT
