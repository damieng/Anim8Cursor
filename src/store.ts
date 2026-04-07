import { signal, type Signal } from '@preact/signals'
import { parseAni, writeAni, createEmptyFrame } from './aniFormat'
import type { AniFile, CursorFrame } from './aniFormat'

export interface CursorInstance {
  id: string
  fileName: Signal<string>
  frames: Signal<CursorFrame[]>
  seq: Signal<number[] | null>
  rates: Signal<number[] | null>
  speed: Signal<number>
  selectedFrame: Signal<number>
  editorOpen: Signal<boolean>
  previewOpen: Signal<boolean>
  gridZoom: Signal<number>
  dirty: Signal<boolean>
  paintColor: Signal<string>
  paintVersion: Signal<number>
}

let nextId = 1

export function createCursor(
  frames?: CursorFrame[],
  name?: string,
  speed?: number,
  seq?: number[] | null,
  rates?: number[] | null,
): CursorInstance {
  const id = `cursor-${nextId++}`
  return {
    id,
    fileName: signal(name ?? 'untitled.ani'),
    frames: signal(frames ?? [createEmptyFrame(32, 32)]),
    seq: signal(seq ?? null),
    rates: signal(rates ?? null),
    speed: signal(speed || 6),
    selectedFrame: signal(0),
    editorOpen: signal(false),
    previewOpen: signal(false),
    gridZoom: signal(4),
    dirty: signal(false),
    paintColor: signal('#000000'),
    paintVersion: signal(0),
  }
}

export function loadAniFile(buffer: ArrayBuffer, fileName: string): CursorInstance {
  const ani = parseAni(buffer)
  return createCursor(ani.frames, fileName, ani.header.nSpeed, ani.seq, ani.rates)
}

export function saveAniFile(cursor: CursorInstance): Uint8Array {
  const frames = cursor.frames.value
  const speed = cursor.speed.value
  const seq = cursor.seq.value
  const rates = cursor.rates.value
  const frame0 = frames[0]

  const ani: AniFile = {
    header: {
      cbSize: 36,
      nFrames: frames.length,
      nSteps: seq?.length ?? frames.length,
      iWidth: frame0?.width ?? 32,
      iHeight: frame0?.height ?? 32,
      iBitCount: 32,
      nSpeed: speed,
      dwFlags: 0x01,
    },
    frames,
    seq,
    rates,
  }

  const buf = writeAni(ani)
  cursor.dirty.value = false
  return new Uint8Array(buf)
}

export function setPixel(cursor: CursorInstance, frameIdx: number, x: number, y: number, color: string) {
  const frames = cursor.frames.value
  if (frameIdx < 0 || frameIdx >= frames.length) return
  const frame = frames[frameIdx]
  if (x < 0 || x >= frame.width || y < 0 || y >= frame.height) return

  const newFrames = [...frames]
  const f = { ...newFrames[frameIdx], pixels: new Uint8Array(newFrames[frameIdx].pixels) }
  const off = (y * f.width + x) * 4

  if (color === 'transparent') {
    f.pixels[off + 3] = 0
    const mByte = y * Math.ceil(f.width / 8) + Math.floor(x / 8)
    const mBit = 7 - (x % 8)
    f.andMask[mByte] |= (1 << mBit)
  } else {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    f.pixels[off] = r
    f.pixels[off + 1] = g
    f.pixels[off + 2] = b
    f.pixels[off + 3] = 255
    const mByte = y * Math.ceil(f.width / 8) + Math.floor(x / 8)
    const mBit = 7 - (x % 8)
    f.andMask[mByte] &= ~(1 << mBit)
  }

  newFrames[frameIdx] = f
  cursor.frames.value = newFrames
  cursor.dirty.value = true
  cursor.paintVersion.value++
}

export function setHotspot(cursor: CursorInstance, frameIdx: number, hx: number, hy: number) {
  const frames = cursor.frames.value
  if (frameIdx < 0 || frameIdx >= frames.length) return
  const newFrames = [...frames]
  newFrames[frameIdx] = { ...newFrames[frameIdx], hotspotX: hx, hotspotY: hy }
  cursor.frames.value = newFrames
  cursor.dirty.value = true
}

export function addFrame(cursor: CursorInstance) {
  const frames = cursor.frames.value
  const ref = frames[0] ?? { width: 32, height: 32 }
  const newFrame = createEmptyFrame(ref.width, ref.height)
  cursor.frames.value = [...frames, newFrame]
  cursor.dirty.value = true
}

export function duplicateFrame(cursor: CursorInstance, idx: number) {
  const frames = cursor.frames.value
  if (idx < 0 || idx >= frames.length) return
  const src = frames[idx]
  const dup: CursorFrame = {
    ...src,
    pixels: new Uint8Array(src.pixels),
    andMask: new Uint8Array(src.andMask),
  }
  const newFrames = [...frames]
  newFrames.splice(idx + 1, 0, dup)
  cursor.frames.value = newFrames
  cursor.dirty.value = true
}

export function deleteFrame(cursor: CursorInstance, idx: number) {
  const frames = cursor.frames.value
  if (frames.length <= 1) return
  const newFrames = frames.filter((_: CursorFrame, i: number) => i !== idx)
  cursor.frames.value = newFrames
  if (cursor.selectedFrame.value >= newFrames.length) {
    cursor.selectedFrame.value = newFrames.length - 1
  }
  cursor.dirty.value = true
}

export function moveFrame(cursor: CursorInstance, fromIdx: number, toIdx: number) {
  const frames = [...cursor.frames.value]
  if (fromIdx < 0 || fromIdx >= frames.length) return
  if (toIdx < 0 || toIdx >= frames.length) return
  const [moved] = frames.splice(fromIdx, 1)
  frames.splice(toIdx, 0, moved)
  cursor.frames.value = frames
  cursor.selectedFrame.value = toIdx
  cursor.dirty.value = true
}

export function setFrameRate(cursor: CursorInstance, frameIdx: number, rate: number) {
  const current = cursor.rates.value
  if (!current || current.length === 0) return
  const newRates = [...current]
  if (frameIdx >= 0 && frameIdx < newRates.length) {
    newRates[frameIdx] = rate
    cursor.rates.value = newRates
    cursor.dirty.value = true
  }
}

export function setSpeed(cursor: CursorInstance, speed: number) {
  cursor.speed.value = speed
  cursor.dirty.value = true
}

// --- Global state ---

import {
  loadCursorsFromStorage, loadLayoutFromStorage, setupAutoSave,
} from './persistence'

const restored = loadCursorsFromStorage()
export const cursors = signal<CursorInstance[]>(restored ?? [createCursor()])
export const activeCursorId = signal<string>(cursors.value.length > 0 ? cursors.value[0].id : '')
export const storedFocusedId = signal<string>('cursor-editor')

export interface WindowRect { x: number; y: number; w: number; h: number }
export const windowLayouts = signal<Record<string, WindowRect>>({})

const restoredLayout = loadLayoutFromStorage()
if (restoredLayout) {
  if (restoredLayout.windows) windowLayouts.value = restoredLayout.windows
  if (restoredLayout.focusedId) storedFocusedId.value = restoredLayout.focusedId
}

setupAutoSave(
  () => cursors.value,
  () => windowLayouts.value,
  () => storedFocusedId.value,
)

export function updateWindowLayout(id: string, rect: Partial<WindowRect>) {
  const current = windowLayouts.value[id] ?? { x: 0, y: 0, w: 0, h: 0 }
  windowLayouts.value = { ...windowLayouts.value, [id]: { ...current, ...rect } }
}

export function addCursor(cursor: CursorInstance) {
  const current = cursors.value
  const isEmptyUntitled = current.length === 1
    && !current[0].dirty.value
    && current[0].fileName.value === 'untitled.ani'
    && current[0].frames.value.length === 1
    && current[0].frames.value[0].pixels.every((b: number) => b === 0)

  if (isEmptyUntitled) {
    cursors.value = [cursor]
  } else {
    cursors.value = [...current, cursor]
  }
  activeCursorId.value = cursor.id
  storedFocusedId.value = `grid-${cursor.id}`
}

export function removeCursor(id: string) {
  const remaining = cursors.value.filter(c => c.id !== id)
  cursors.value = remaining
  if (activeCursorId.value === id) {
    activeCursorId.value = remaining.length > 0 ? remaining[0].id : ''
  }
}

export function openEditor(cursor: CursorInstance) {
  cursor.editorOpen.value = true
  storedFocusedId.value = `editor-${cursor.id}`
}

export function openPreview(cursor: CursorInstance) {
  cursor.previewOpen.value = true
  storedFocusedId.value = `preview-${cursor.id}`
}
