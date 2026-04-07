import { type CursorInstance, addFrame, duplicateFrame, deleteFrame, openEditor, moveFrame } from '../store'
import type { CursorFrame } from '../aniFormat'
import { FrameTile } from '../components/FrameTile'
import { ZoomControl } from '../components/ZoomControl'
import { Plus, Copy, Trash2, ArrowLeft, ArrowRight } from 'lucide-preact'

export function CursorPane({ cursor }: { cursor: CursorInstance }) {
  const frames = cursor.frames.value
  const selected = cursor.selectedFrame.value
  const zoom = cursor.gridZoom.value
  const tileSize = Math.max(frames[0]?.width ?? 32, frames[0]?.height ?? 32) * zoom

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-3 flex-wrap shrink-0">
        <button
          class="px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium flex items-center gap-1"
          onClick={() => addFrame(cursor)}
          title="Add frame"
        >
          <Plus size={14} /> Add
        </button>
        <button
          class="px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium flex items-center gap-1"
          onClick={() => duplicateFrame(cursor, selected)}
          title="Duplicate frame"
        >
          <Copy size={14} /> Duplicate
        </button>
        <button
          class="px-2 py-1 bg-white hover:bg-red-50 rounded border border-gray-300 font-medium flex items-center gap-1 text-red-600"
          onClick={() => deleteFrame(cursor, selected)}
          title="Delete frame"
          disabled={frames.length <= 1}
        >
          <Trash2 size={14} />
        </button>
        <div class="h-4 w-px bg-gray-300" />
        <button
          class="px-1.5 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300"
          onClick={() => moveFrame(cursor, selected, selected - 1)}
          disabled={selected <= 0}
          title="Move frame left"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          class="px-1.5 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300"
          onClick={() => moveFrame(cursor, selected, selected + 1)}
          disabled={selected >= frames.length - 1}
          title="Move frame right"
        >
          <ArrowRight size={14} />
        </button>
        <div class="ml-auto">
          <ZoomControl value={zoom} onChange={(v) => { cursor.gridZoom.value = v }} />
        </div>
      </div>
      <div class="flex-1 overflow-auto min-h-0">
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
            />
          ))}
        </div>
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
