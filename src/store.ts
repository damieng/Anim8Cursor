import { signal, type Signal } from '@preact/signals'
import { parseAni, writeAni, createEmptyFrame } from './aniFormat'
import type { AniFile, CursorFrame } from './aniFormat'
import { UndoHistory, snapshotFrame, beginPaintStroke, commitPaintStroke, execSetHotspot, execAddFrame, execDuplicateFrame, execDeleteFrame, execMoveFrame, execPasteFrame } from './undoHistory'

export { UndoHistory } from './undoHistory'

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
  undoHistory: UndoHistory
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
    undoHistory: new UndoHistory(),
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

export function setPixel(cursor: CursorInstance, frameIdx: number, x: number, y: number, color: string, isStrokeStart: boolean) {
  const frames = cursor.frames.value
  if (frameIdx < 0 || frameIdx >= frames.length) return
  const frame = frames[frameIdx]
  if (x < 0 || x >= frame.width || y < 0 || y >= frame.height) return

  if (isStrokeStart) beginPaintStroke(frameIdx, frame)

  const newFrames = [...frames]
  const f = { ...newFrames[frameIdx], pixels: new Uint8Array(newFrames[frameIdx].pixels), andMask: new Uint8Array(newFrames[frameIdx].andMask) }
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

export function commitPaint(cursor: CursorInstance) {
  commitPaintStroke(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
  )
}

export function setHotspot(cursor: CursorInstance, frameIdx: number, hx: number, hy: number) {
  execSetHotspot(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    frameIdx, hx, hy,
  )
}

export function addFrame(cursor: CursorInstance) {
  const frames = cursor.frames.value
  const ref = frames[0] ?? { width: 32, height: 32 }
  const newFrame = createEmptyFrame(ref.width, ref.height)
  execAddFrame(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    newFrame,
  )
}

export function duplicateFrame(cursor: CursorInstance, idx: number) {
  execDuplicateFrame(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    idx,
  )
}

export function deleteFrame(cursor: CursorInstance, idx: number) {
  execDeleteFrame(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (i) => { cursor.selectedFrame.value = i },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    idx,
  )
}

export function moveFrame(cursor: CursorInstance, fromIdx: number, toIdx: number) {
  execMoveFrame(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (i) => { cursor.selectedFrame.value = i },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    fromIdx, toIdx,
  )
}

export function undo(cursor: CursorInstance) {
  cursor.undoHistory.undo()
}

export function redo(cursor: CursorInstance) {
  cursor.undoHistory.redo()
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

let clipboard: CursorFrame | null = null

export function copyFrame(cursor: CursorInstance, idx: number) {
  const frames = cursor.frames.value
  if (idx < 0 || idx >= frames.length) return
  clipboard = snapshotFrame(frames[idx])
}

export function pasteFrame(cursor: CursorInstance, idx: number) {
  if (!clipboard) return
  execPasteFrame(
    () => cursor.frames.value,
    (f) => { cursor.frames.value = f },
    (i) => { cursor.selectedFrame.value = i },
    (d) => { cursor.dirty.value = d },
    cursor.undoHistory,
    idx,
    clipboard,
  )
}

export function hasClipboard(): boolean {
  return clipboard !== null
}

export type ScaleMode = 'nearest' | 'bilinear'

export function scaleFrame(frame: CursorFrame, newW: number, newH: number, mode: ScaleMode): CursorFrame {
  const { width, height, pixels } = frame
  const out = createEmptyFrame(newW, newH)
  out.hotspotX = Math.round(frame.hotspotX * newW / width)
  out.hotspotY = Math.round(frame.hotspotY * newH / height)

  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const dstOff = (y * newW + x) * 4

      if (mode === 'nearest') {
        const sx = Math.min(Math.floor(x * width / newW), width - 1)
        const sy = Math.min(Math.floor(y * height / newH), height - 1)
        const srcOff = (sy * width + sx) * 4
        out.pixels[dstOff] = pixels[srcOff]
        out.pixels[dstOff + 1] = pixels[srcOff + 1]
        out.pixels[dstOff + 2] = pixels[srcOff + 2]
        out.pixels[dstOff + 3] = pixels[srcOff + 3]
      } else {
        const fx = x * width / newW - 0.5
        const fy = y * height / newH - 0.5
        const x0 = Math.max(0, Math.floor(fx))
        const y0 = Math.max(0, Math.floor(fy))
        const x1 = Math.min(width - 1, x0 + 1)
        const y1 = Math.min(height - 1, y0 + 1)
        const dx = fx - x0
        const dy = fy - y0
        const w00 = (1 - dx) * (1 - dy)
        const w10 = dx * (1 - dy)
        const w01 = (1 - dx) * dy
        const w11 = dx * dy
        const i00 = (y0 * width + x0) * 4
        const i10 = (y0 * width + x1) * 4
        const i01 = (y1 * width + x0) * 4
        const i11 = (y1 * width + x1) * 4
        for (let c = 0; c < 4; c++) {
          out.pixels[dstOff + c] = Math.round(
            pixels[i00 + c] * w00 +
            pixels[i10 + c] * w10 +
            pixels[i01 + c] * w01 +
            pixels[i11 + c] * w11
          )
        }
      }
    }
  }

  return out
}

export function resizeCursor(cursor: CursorInstance, newW: number, newH: number, mode: ScaleMode) {
  const frames = cursor.frames.value.map((f: CursorFrame) => scaleFrame(f, newW, newH, mode))
  const before = cursor.frames.value
  cursor.frames.value = frames
  cursor.dirty.value = true

  cursor.undoHistory.push({
    name: 'Resize',
    execute() { cursor.frames.value = frames; cursor.dirty.value = true },
    undo() { cursor.frames.value = before; cursor.dirty.value = true },
  })
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
