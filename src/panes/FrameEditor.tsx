import { useRef, useEffect, useState } from 'preact/hooks'
import { type CursorInstance, setPixel, setHotspot } from '../store'
import { NumField } from '../components/NumField'

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
      setPixel(cursor, idx, x, y, 'transparent')
    } else {
      const paintColor = a === 0 || frame.pixels[off] !== parseInt(color.slice(1, 3), 16)
        ? color : 'transparent'
      painting.current = paintColor
      setPixel(cursor, idx, x, y, paintColor)
    }
  }

  function handleMove(e: MouseEvent) {
    if (painting.current === null) return
    const cell = getCellFromEvent(e)
    if (!cell) return
    setPixel(cursor, idx, cell[0], cell[1], painting.current)
  }

  function handleUp() {
    painting.current = null
  }

  useEffect(() => {
    document.addEventListener('mouseup', handleUp)
    return () => document.removeEventListener('mouseup', handleUp)
  }, [])

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-2 shrink-0">
        {(['draw', 'eraser', 'hotspot'] as const).map(t => (
          <button
            key={t}
            class={`px-2 py-1 rounded border text-sm font-medium ${
              tool === t ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 hover:bg-blue-50'
            }`}
            onClick={() => setTool(t)}
          >
            {t === 'draw' ? '✏️ Draw' : t === 'eraser' ? '🧹 Erase' : '⊕ Hotspot'}
          </button>
        ))}
        <div class="h-4 w-px bg-gray-300" />
        <label class="flex items-center gap-1 text-sm">
          Color
          <input
            type="color"
            value={color}
            class="w-8 h-6 border border-gray-300 rounded cursor-pointer"
            onInput={(e) => { cursor.paintColor.value = (e.target as HTMLInputElement).value }}
          />
        </label>
        <div class="h-4 w-px bg-gray-300" />
        <NumField
          label="Hotspot X:"
          value={frame.hotspotX}
          onChange={(v) => setHotspot(cursor, idx, Math.max(0, Math.min(w - 1, v)), frame.hotspotY)}
          min={0}
          max={w - 1}
        />
        <NumField
          label="Y:"
          value={frame.hotspotY}
          onChange={(v) => setHotspot(cursor, idx, frame.hotspotX, Math.max(0, Math.min(h - 1, v)))}
          min={0}
          max={h - 1}
        />
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
