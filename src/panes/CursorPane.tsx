import { useState } from 'preact/hooks'
import { type CursorInstance, addFrame, duplicateFrame, deleteFrame, openEditor, moveFrame } from '../store'
import type { CursorFrame } from '../aniFormat'
import { FrameTile, AddFrameTile } from '../components/FrameTile'

export function CursorPane({ cursor }: { cursor: CursorInstance }) {
  const frames = cursor.frames.value
  const selected = cursor.selectedFrame.value
  const zoom = cursor.gridZoom.value
  const tileSize = Math.max(frames[0]?.width ?? 32, frames[0]?.height ?? 32) * zoom
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ idx: number; x: number; y: number } | null>(null)

  function handleDragStart(i: number, e: DragEvent) {
    setDragIdx(i)
    e.dataTransfer!.effectAllowed = 'move'
  }

  function handleDragOver(_i: number, e: DragEvent) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
  }

  function handleDrop(i: number, e: DragEvent) {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== i) {
      moveFrame(cursor, dragIdx, i)
    }
    setDragIdx(null)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  function handleContextMenu(i: number, e: MouseEvent) {
    e.preventDefault()
    setCtxMenu({ idx: i, x: e.clientX, y: e.clientY })
  }

  return (
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-auto min-h-0 relative">
        <div class="flex flex-wrap gap-2 content-start">
          {frames.map((frame: CursorFrame, i: number) => (
            <FrameTile
              key={i}
              frame={frame}
              size={tileSize}
              selected={i === selected}
              active={i === selected}
              index={i}
              onClick={() => {
                cursor.selectedFrame.value = i
                openEditor(cursor)
              }}
              onContextMenu={(e) => handleContextMenu(i, e)}
              onDragStart={(e) => handleDragStart(i, e)}
              onDragOver={(e) => handleDragOver(i, e)}
              onDrop={(e) => handleDrop(i, e)}
              onDragEnd={handleDragEnd}
            />
          ))}
          <AddFrameTile size={tileSize} onClick={() => addFrame(cursor)} />
        </div>
        {ctxMenu && (
          <>
            <div class="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
            <div
              class="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
            >
              <button
                class="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 text-gray-700"
                onClick={() => { duplicateFrame(cursor, ctxMenu.idx); setCtxMenu(null) }}
              >
                Duplicate frame
              </button>
              <button
                class="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 disabled:text-gray-300"
                disabled={frames.length <= 1}
                onClick={() => { deleteFrame(cursor, ctxMenu.idx); setCtxMenu(null) }}
              >
                Delete frame
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function CursorPaneTitle({ cursor }: { cursor: CursorInstance }) {
  return <span>Frames — {cursor.fileName.value}</span>
}

export function CursorStatusBar({ cursor }: { cursor: CursorInstance }) {
  const frames = cursor.frames.value
  const sel = cursor.selectedFrame.value
  const frame = frames[sel]
  return (
    <>
      <span>{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
      <span>{frame ? `${frame.width}×${frame.height} px` : ''}</span>
      <span>{frame ? `Hotspot: (${frame.hotspotX}, ${frame.hotspotY})` : ''}</span>
      <span>JIFFIE: {cursor.speed.value}</span>
      {cursor.dirty.value && <span class="text-orange-500 font-medium">● Modified</span>}
    </>
  )
}
