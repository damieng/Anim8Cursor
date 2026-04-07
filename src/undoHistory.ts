import type { CursorFrame } from './aniFormat'

export interface UndoCommand {
  name: string
  execute(): void
  undo(): void
}

const MAX_HISTORY = 100

export class UndoHistory {
  private undoStack: UndoCommand[] = []
  private redoStack: UndoCommand[] = []

  push(cmd: UndoCommand) {
    this.undoStack.push(cmd)
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
    this.redoStack.length = 0
  }

  undo(): boolean {
    const cmd = this.undoStack.pop()
    if (!cmd) return false
    cmd.undo()
    this.redoStack.push(cmd)
    return true
  }

  redo(): boolean {
    const cmd = this.redoStack.pop()
    if (!cmd) return false
    cmd.execute()
    this.undoStack.push(cmd)
    return true
  }

  clear() {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}

// --- Frame snapshot helpers ---

export function snapshotFrame(frame: CursorFrame): CursorFrame {
  return {
    ...frame,
    pixels: new Uint8Array(frame.pixels),
    andMask: new Uint8Array(frame.andMask),
  }
}

export function restoreFrame(frames: CursorFrame[], index: number, snapshot: CursorFrame): CursorFrame[] {
  const newFrames = [...frames]
  newFrames[index] = snapshot
  return newFrames
}

// --- Command factories ---

let pendingStroke: {
  before: CursorFrame
  frameIdx: number
} | null = null

export function beginPaintStroke(frameIdx: number, frame: CursorFrame) {
  pendingStroke = { before: snapshotFrame(frame), frameIdx }
}

export function commitPaintStroke(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
) {
  if (!pendingStroke) return
  const { before, frameIdx } = pendingStroke
  pendingStroke = null

  const frames = getFrames()
  const after = snapshotFrame(frames[frameIdx])

  let changed = false
  for (let i = 0; i < before.pixels.length; i++) {
    if (before.pixels[i] !== after.pixels[i]) { changed = true; break }
  }
  if (!changed) return

  setDirty(true)
  const cmd: UndoCommand = {
    name: 'Paint',
    execute() { setFrames(restoreFrame(getFrames(), frameIdx, snapshotFrame(after))); setDirty(true) },
    undo() { setFrames(restoreFrame(getFrames(), frameIdx, snapshotFrame(before))); setDirty(true) },
  }
  history.push(cmd)
}

export function execSetHotspot(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  frameIdx: number,
  hx: number,
  hy: number,
) {
  const frames = getFrames()
  const before = snapshotFrame(frames[frameIdx])
  const newFrames = [...frames]
  newFrames[frameIdx] = { ...newFrames[frameIdx], hotspotX: hx, hotspotY: hy }
  setFrames(newFrames)
  setDirty(true)

  history.push({
    name: 'Set Hotspot',
    execute() {
      const f = getFrames()
      const nf = [...f]
      nf[frameIdx] = { ...nf[frameIdx], hotspotX: hx, hotspotY: hy }
      setFrames(nf); setDirty(true)
    },
    undo() { setFrames(restoreFrame(getFrames(), frameIdx, snapshotFrame(before))); setDirty(true) },
  })
}

export function execAddFrame(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  newFrame: CursorFrame,
) {
  const frames = getFrames()
  setFrames([...frames, newFrame])
  setDirty(true)

  history.push({
    name: 'Add Frame',
    execute() { setFrames([...getFrames(), newFrame]); setDirty(true) },
    undo() { setFrames(getFrames().slice(0, -1)); setDirty(true) },
  })
}

export function execDuplicateFrame(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  frameIdx: number,
) {
  const frames = getFrames()
  const src = frames[frameIdx]
  const dup = snapshotFrame(src)
  const newFrames = [...frames]
  newFrames.splice(frameIdx + 1, 0, dup)
  setFrames(newFrames)
  setDirty(true)

  history.push({
    name: 'Duplicate Frame',
    execute() {
      const f = getFrames()
      const nf = [...f]
      nf.splice(frameIdx + 1, 0, snapshotFrame(src))
      setFrames(nf); setDirty(true)
    },
    undo() {
      const f = getFrames()
      setFrames(f.filter((_: CursorFrame, i: number) => i !== frameIdx + 1))
      setDirty(true)
    },
  })
}

export function execDeleteFrame(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setSelected: (i: number) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  frameIdx: number,
) {
  const frames = getFrames()
  if (frames.length <= 1) return
  const removed = snapshotFrame(frames[frameIdx])
  const newFrames = frames.filter((_: CursorFrame, i: number) => i !== frameIdx)
  setFrames(newFrames)
  if (frameIdx >= newFrames.length) setSelected(newFrames.length - 1)
  setDirty(true)

  history.push({
    name: 'Delete Frame',
    execute() {
      const f = getFrames()
      const nf = [...f]
      nf.splice(frameIdx, 0, removed)
      setFrames(nf); setDirty(true)
    },
    undo() {
      const f = getFrames()
      setFrames(f.filter((_: CursorFrame, i: number) => i !== frameIdx))
      setDirty(true)
    },
  })
}

export function execPasteFrame(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  _setSelected: (i: number) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  frameIdx: number,
  pasted: CursorFrame,
) {
  const frames = getFrames()
  const before = snapshotFrame(frames[frameIdx])
  setFrames(restoreFrame(frames, frameIdx, snapshotFrame(pasted)))
  setDirty(true)

  history.push({
    name: 'Paste Frame',
    execute() { setFrames(restoreFrame(getFrames(), frameIdx, snapshotFrame(pasted))); setDirty(true) },
    undo() { setFrames(restoreFrame(getFrames(), frameIdx, snapshotFrame(before))); setDirty(true) },
  })
}

export function execMoveFrame(
  getFrames: () => CursorFrame[],
  setFrames: (frames: CursorFrame[]) => void,
  setSelected: (i: number) => void,
  setDirty: (d: boolean) => void,
  history: UndoHistory,
  fromIdx: number,
  toIdx: number,
) {
  const frames = [...getFrames()]
  const [moved] = frames.splice(fromIdx, 1)
  frames.splice(toIdx, 0, moved)
  setFrames(frames)
  setSelected(toIdx)
  setDirty(true)

  history.push({
    name: 'Move Frame',
    execute() {
      const f = [...getFrames()]
      const [m] = f.splice(fromIdx, 1)
      f.splice(toIdx, 0, m)
      setFrames(f); setSelected(toIdx); setDirty(true)
    },
    undo() {
      const f = [...getFrames()]
      const [m] = f.splice(toIdx, 1)
      f.splice(fromIdx, 0, m)
      setFrames(f); setSelected(fromIdx); setDirty(true)
    },
  })
}
