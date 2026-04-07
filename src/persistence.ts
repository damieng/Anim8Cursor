import type { CursorInstance, WindowRect } from './store'
import type { CursorFrame } from './aniFormat'
import { createCursor } from './store'

const CURSORS_KEY = 'cursor-editor-cursors'
const LAYOUT_KEY = 'cursor-editor-layout'

interface StoredFrame {
  width: number
  height: number
  hotspotX: number
  hotspotY: number
  pixels: string
  andMask: string
}

interface StoredCursor {
  fileName: string
  frames: StoredFrame[]
  seq: number[] | null
  rates: number[] | null
  speed: number
  selectedFrame: number
  editorOpen: boolean
  previewOpen: boolean
  gridZoom: number
  paintColor: string
}

interface StoredLayout {
  windows: Record<string, WindowRect>
  focusedId: string
}

function frameToStored(f: CursorFrame): StoredFrame {
  return {
    width: f.width,
    height: f.height,
    hotspotX: f.hotspotX,
    hotspotY: f.hotspotY,
    pixels: Array.from(f.pixels).map(b => b.toString(16).padStart(2, '0')).join(''),
    andMask: Array.from(f.andMask).map(b => b.toString(16).padStart(2, '0')).join(''),
  }
}

function storedToFrame(s: StoredFrame): CursorFrame {
  const pixels = new Uint8Array(s.pixels.length / 2)
  for (let i = 0; i < pixels.length; i++) pixels[i] = parseInt(s.pixels.substr(i * 2, 2), 16)
  const andMask = new Uint8Array(s.andMask.length / 2)
  for (let i = 0; i < andMask.length; i++) andMask[i] = parseInt(s.andMask.substr(i * 2, 2), 16)
  return { width: s.width, height: s.height, hotspotX: s.hotspotX, hotspotY: s.hotspotY, pixels, andMask }
}

function cursorToStored(c: CursorInstance): StoredCursor {
  return {
    fileName: c.fileName.value,
    frames: c.frames.value.map(frameToStored),
    seq: c.seq.value,
    rates: c.rates.value,
    speed: c.speed.value,
    selectedFrame: c.selectedFrame.value,
    editorOpen: c.editorOpen.value,
    previewOpen: c.previewOpen.value,
    gridZoom: c.gridZoom.value,
    paintColor: c.paintColor.value,
  }
}

function storedToCursor(s: StoredCursor): CursorInstance {
  const frames = s.frames.map(storedToFrame)
  const c = createCursor(frames, s.fileName, s.speed, s.seq, s.rates)
  c.selectedFrame.value = s.selectedFrame
  c.editorOpen.value = s.editorOpen
  c.previewOpen.value = s.previewOpen
  c.gridZoom.value = s.gridZoom
  c.paintColor.value = s.paintColor
  return c
}

export function saveCursorsToStorage(cursors: CursorInstance[]) {
  try {
    const data = cursors.map(cursorToStored)
    localStorage.setItem(CURSORS_KEY, JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

export function loadCursorsFromStorage(): CursorInstance[] | null {
  try {
    const raw = localStorage.getItem(CURSORS_KEY)
    if (!raw) return null
    const data: StoredCursor[] = JSON.parse(raw)
    if (!Array.isArray(data) || data.length === 0) return null
    return data.map(storedToCursor)
  } catch { return null }
}

export function saveLayoutToStorage(
  windows: Record<string, WindowRect>,
  focusedId: string,
) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ windows, focusedId }))
  } catch { /* ignore */ }
}

export function loadLayoutFromStorage(): StoredLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredLayout
  } catch { return null }
}

export function setupAutoSave(
  getCursors: () => CursorInstance[],
  getWindows: () => Record<string, WindowRect>,
  getFocusedId: () => string,
): () => void {
  let timer = 0
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      saveCursorsToStorage(getCursors())
      saveLayoutToStorage(getWindows(), getFocusedId())
    }, 500) as unknown as number
  }

  const interval = setInterval(schedule, 2000)

  return () => {
    clearInterval(interval)
    clearTimeout(timer)
  }
}
