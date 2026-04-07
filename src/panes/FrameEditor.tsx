import { useRef, useEffect, useState } from 'preact/hooks'
import { type CursorInstance, setPixel, setHotspot, commitPaint, undo, redo, copyFrame, pasteFrame } from '../store'
import { ChevronDown } from 'lucide-preact'

function ColorDropdown({ color, onChange, framePixels }: {
  color: string
  onChange: (c: string) => void
  framePixels: Uint8Array
}) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  const usedColors = new Set<string>()
  for (let i = 0; i < framePixels.length; i += 4) {
    const a = framePixels[i + 3]
    if (a === 0) continue
    const hex = '#' +
      framePixels[i].toString(16).padStart(2, '0') +
      framePixels[i + 1].toString(16).padStart(2, '0') +
      framePixels[i + 2].toString(16).padStart(2, '0')
    usedColors.add(hex)
  }
  const palette = Array.from(usedColors)

  return (
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 text-sm font-medium"
        onClick={() => setOpen(prev => !prev)}
      >
        <span
          class="w-4 h-4 rounded-sm border border-gray-400 inline-block"
          style={{ backgroundColor: color }}
        />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
          <div class="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
          {palette.length > 0 && (
            <div class="grid gap-1 mb-2" style={{ gridTemplateColumns: `repeat(${Math.min(palette.length, 8)}, 24px)` }}>
              {palette.map(c => (
                <button
                  key={c}
                  class={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform ${color === c ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => { onChange(c); setOpen(false) }}
                  title={c}
                />
              ))}
            </div>
          )}
          <div class="flex items-center gap-2 border-t border-gray-100 pt-2">
            <button
              class="w-6 h-6 rounded border-2 border-gray-300 hover:border-blue-400 flex items-center justify-center text-gray-400 text-xs"
              style={{
                background: 'linear-gradient(135deg, #fff 45%, #ddd 45%, #ddd 50%, #fff 50%, #fff 95%, #ddd 95%)',
                backgroundSize: '6px 6px',
              }}
              onClick={() => { onChange('#000000'); setOpen(false) }}
              title="Transparent"
            >T</button>
            <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              <span
                class="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center"
                style={{
                  background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                }}
                onClick={() => pickerRef.current?.click()}
              >+</span>
              <input
                ref={pickerRef}
                type="color"
                value={color}
                class="sr-only"
                onInput={(e) => { onChange((e.target as HTMLInputElement).value); setOpen(false) }}
              />
              Custom
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export function FrameEditor({ cursor }: { cursor: CursorInstance }) {
  const painting = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 400, h: 400 })
  const [tool, setTool] = useState<'draw' | 'hotspot' | 'eraser'>('draw')

  const idx = cursor.selectedFrame.value
  const frames = cursor.frames.value
  const frame = frames[idx]
  if (!frame) return <div class="p-4 text-gray-400">No frame selected</div>

  const w = frame.width
  const h = frame.height
  const color = cursor.paintColor.value

  const maxCell = Math.max(1, Math.floor(Math.min(
    (containerSize.w - 2) / w,
    (containerSize.h - 2) / h,
  )))
  const cellSize = Math.min(maxCell, 40)
  const gridW = cellSize * w
  const gridH = cellSize * h

  cursor.paintVersion.value

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    const obs = new ResizeObserver(update)
    obs.observe(el)
    update()
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = gridW
    canvas.height = gridH
    const ctx = canvas.getContext('2d')!

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const off = (y * w + x) * 4
        const r = frame.pixels[off]
        const g = frame.pixels[off + 1]
        const b = frame.pixels[off + 2]
        const a = frame.pixels[off + 3]

        const px = x * cellSize
        const py = y * cellSize

        if (a === 0) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#cbd5e1'
        } else {
          ctx.fillStyle = `rgb(${r},${g},${b})`
        }
        ctx.fillRect(px, py, cellSize, cellSize)
      }
    }

    if (cellSize >= 4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= w; x++) {
        ctx.beginPath()
        ctx.moveTo(x * cellSize, 0)
        ctx.lineTo(x * cellSize, gridH)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * cellSize)
        ctx.lineTo(gridW, y * cellSize)
        ctx.stroke()
      }
    }

    const hx = frame.hotspotX
    const hy = frame.hotspotY
    if (hx >= 0 && hx < w && hy >= 0 && hy < h) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      const cx = hx * cellSize + cellSize / 2
      const cy = hy * cellSize + cellSize / 2
      const r = Math.max(3, cellSize / 3)
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()
    }
  }, [frame, cellSize, gridW, gridH])

  function getCellFromEvent(e: MouseEvent): [number, number] | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / cellSize)
    const y = Math.floor((e.clientY - rect.top) / cellSize)
    if (x < 0 || x >= w || y < 0 || y >= h) return null
    return [x, y]
  }

  function handleDown(e: MouseEvent) {
    e.preventDefault()
    const cell = getCellFromEvent(e)
    if (!cell) return
    const [x, y] = cell

    if (tool === 'hotspot') {
      setHotspot(cursor, idx, x, y)
      return
    }

    const off = (y * w + x) * 4
    const a = frame.pixels[off + 3]

    if (tool === 'eraser') {
      painting.current = 'transparent'
      setPixel(cursor, idx, x, y, 'transparent', true)
    } else {
      const paintColor = a === 0 || frame.pixels[off] !== parseInt(color.slice(1, 3), 16)
        ? color : 'transparent'
      painting.current = paintColor
      setPixel(cursor, idx, x, y, paintColor, true)
    }
  }

  function handleMove(e: MouseEvent) {
    if (painting.current === null) return
    const cell = getCellFromEvent(e)
    if (!cell) return
    setPixel(cursor, idx, cell[0], cell[1], painting.current, false)
  }

  function handleUp() {
    if (painting.current !== null) commitPaint(cursor)
    painting.current = null
  }

  useEffect(() => {
    document.addEventListener('mouseup', handleUp)
    return () => document.removeEventListener('mouseup', handleUp)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo(cursor)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo(cursor)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        copyFrame(cursor, idx)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        pasteFrame(cursor, idx)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cursor, idx])

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-2 shrink-0">
        <button
          class={`px-2 py-1 rounded border text-sm font-medium ${
            tool === 'draw' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 hover:bg-blue-50'
          }`}
          onClick={() => setTool('draw')}
        >
          ✏️ Draw
        </button>
        <ColorDropdown
          color={color}
          onChange={(c) => { cursor.paintColor.value = c }}
          framePixels={frame.pixels}
        />
        <button
          class={`px-2 py-1 rounded border text-sm font-medium ${
            tool === 'eraser' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 hover:bg-blue-50'
          }`}
          onClick={() => setTool('eraser')}
        >
          🧹 Erase
        </button>
        <button
          class={`px-2 py-1 rounded border text-sm font-medium ${
            tool === 'hotspot' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 hover:bg-blue-50'
          }`}
          onClick={() => setTool('hotspot')}
        >
          ⊕ Hotspot
        </button>
      </div>
      <div ref={containerRef} class="flex-1 min-h-0 flex items-center justify-center overflow-auto">
        <canvas
          ref={canvasRef}
          class="cursor-crosshair"
          style={{ width: gridW, height: gridH, imageRendering: 'pixelated' }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
        />
      </div>
    </div>
  )
}

export function EditorTitle({ cursor }: { cursor: CursorInstance }) {
  const idx = cursor.selectedFrame.value
  return <span>Frame {idx} — {cursor.fileName.value}</span>
}
