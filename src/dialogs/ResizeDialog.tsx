import { useState } from 'preact/hooks'
import { type CursorInstance, resizeCursor, type ScaleMode } from '../store'
import { DialogOverlay } from '../components/DialogOverlay'
import { Maximize2 } from 'lucide-preact'

interface Props {
  cursor: CursorInstance
  onClose: () => void
}

export function ResizeDialog({ cursor, onClose }: Props) {
  const frames = cursor.frames.value
  const curW = frames[0]?.width ?? 32
  const curH = frames[0]?.height ?? 32
  const [width, setWidth] = useState(curW)
  const [height, setHeight] = useState(curH)
  const [mode, setMode] = useState<ScaleMode>('nearest')

  const changed = width !== curW || height !== curH

  const presets = [
    { label: '16×16', w: 16, h: 16 },
    { label: '24×24', w: 24, h: 24 },
    { label: '32×32', w: 32, h: 32 },
    { label: '48×48', w: 48, h: 48 },
    { label: '64×64', w: 64, h: 64 },
    { label: '96×96', w: 96, h: 96 },
    { label: '128×128', w: 128, h: 128 },
  ]

  function handleApply() {
    if (!changed) return
    resizeCursor(cursor, width, height, mode)
    onClose()
  }

  return (
    <DialogOverlay onClose={onClose} label="Resize Frames">
      <div class="bg-white rounded-lg shadow-2xl border border-gray-300 p-5 flex flex-col gap-4 min-w-[380px]">
        <div class="flex items-center">
          <h2 class="font-bold text-lg">Resize Frames</h2>
          <button
            class="ml-auto text-gray-400 hover:text-red-500 leading-none text-lg font-bold"
            onClick={onClose}
            title="Close"
          >×</button>
        </div>

        <div class="text-sm text-gray-500">
          Current size: {curW}×{curH} · {frames.length} frame{frames.length !== 1 ? 's' : ''}
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm w-16">Width</span>
            <input
              type="number" min={1} max={256} value={width}
              onInput={(e) => setWidth(Math.max(1, Math.min(256, parseInt((e.target as HTMLInputElement).value) || 1)))}
              class="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm w-16">Height</span>
            <input
              type="number" min={1} max={256} value={height}
              onInput={(e) => setHeight(Math.max(1, Math.min(256, parseInt((e.target as HTMLInputElement).value) || 1)))}
              class="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-1">
          {presets.map(p => (
            <button
              key={p.label}
              class={`px-2 py-1 rounded border text-xs ${width === p.w && height === p.h ? 'bg-blue-100 border-blue-400 font-medium' : 'border-gray-300 hover:bg-gray-50'}`}
              onClick={() => { setWidth(p.w); setHeight(p.h) }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <hr class="border-gray-200" />

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">Scaling</span>
          <div class="flex gap-2">
            {([
              { id: 'nearest' as ScaleMode, label: 'Nearest neighbor', desc: 'Pixel-perfect, crisp edges' },
              { id: 'bilinear' as ScaleMode, label: 'Bilinear', desc: 'Smooth, anti-aliased' },
            ]).map(m => (
              <button
                key={m.id}
                class={`flex-1 p-2 rounded border text-left ${mode === m.id ? 'bg-blue-50 border-blue-400' : 'border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setMode(m.id)}
              >
                <div class="text-sm font-medium">{m.label}</div>
                <div class="text-xs text-gray-400">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="ml-auto flex items-center gap-2">
            <button
              class="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              class="px-4 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 text-sm"
              onClick={handleApply}
              disabled={!changed}
            >
              Resize
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  )
}

export function SizeButton({ cursor }: { cursor: CursorInstance }) {
  const [open, setOpen] = useState(false)
  const frames = cursor.frames.value
  const w = frames[0]?.width ?? 32
  const h = frames[0]?.height ?? 32

  return (
    <>
      <button
        class="px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium flex items-center gap-1 text-sm"
        onClick={() => setOpen(true)}
        title="Resize frames"
      >
        <Maximize2 size={14} />
        {w}×{h}
      </button>
      {open && <ResizeDialog cursor={cursor} onClose={() => setOpen(false)} />}
    </>
  )
}
