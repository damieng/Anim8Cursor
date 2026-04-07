import { useRef, useEffect, useState } from 'preact/hooks'
import { type CursorInstance } from '../store'
import type { CursorFrame } from '../aniFormat'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-preact'

export function PreviewPane({ cursor }: { cursor: CursorInstance }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(true)
  const [frameIdx, setFrameIdx] = useState(0)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const frameIdxRef = useRef(0)
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const frames = cursor.frames.value
  const seq = cursor.seq.value
  const displaySeq = seq ?? frames.map((_: CursorFrame, i: number) => i)

  useEffect(() => {
    if (!playing || displaySeq.length === 0) return
    lastTimeRef.current = 0

    function animate(time: number) {
      if (lastTimeRef.current === 0) lastTimeRef.current = time
      const cur = cursorRef.current
      const rates = cur.rates.value
      const globalSpeed = cur.speed.value * (1000 / 60)
      const curFrame = displaySeq[frameIdxRef.current % displaySeq.length] ?? 0
      const msPerFrame = (rates && curFrame < rates.length) ? rates[curFrame] * (1000 / 60) : globalSpeed
      if (time - lastTimeRef.current >= msPerFrame) {
        lastTimeRef.current = time
        setFrameIdx(prev => {
          const next = (prev + 1) % displaySeq.length
          frameIdxRef.current = next
          return next
        })
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, displaySeq.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const realIdx = displaySeq[frameIdx % displaySeq.length] ?? 0
    const frame = frames[realIdx]
    if (!frame) return

    const scale = 4
    canvas.width = frame.width * scale
    canvas.height = frame.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const imgData = ctx.createImageData(frame.width, frame.height)
    for (let i = 0; i < frame.width * frame.height; i++) {
      imgData.data[i * 4] = frame.pixels[i * 4]
      imgData.data[i * 4 + 1] = frame.pixels[i * 4 + 1]
      imgData.data[i * 4 + 2] = frame.pixels[i * 4 + 2]
      imgData.data[i * 4 + 3] = frame.pixels[i * 4 + 3]
    }
    const tmp = document.createElement('canvas')
    tmp.width = frame.width
    tmp.height = frame.height
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)

    const hx = frame.hotspotX * scale
    const hy = frame.hotspotY * scale
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(hx - 4, hy)
    ctx.lineTo(hx + 4, hy)
    ctx.moveTo(hx, hy - 4)
    ctx.lineTo(hx, hy + 4)
    ctx.stroke()
  }, [frames, frameIdx, displaySeq])

  return (
    <div class="flex flex-col items-center gap-3 p-4 h-full">
      <canvas ref={canvasRef} class="border border-gray-600 rounded" style={{ imageRendering: 'pixelated' }} />
      <div class="flex items-center gap-2">
        <button class="p-1.5 bg-white hover:bg-blue-50 rounded border border-gray-300" onClick={() => setFrameIdx(0)}>
          <SkipBack size={14} />
        </button>
        <button
          class={`px-3 py-1.5 rounded border font-medium ${playing ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300'}`}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button class="p-1.5 bg-white hover:bg-blue-50 rounded border border-gray-300" onClick={() => setFrameIdx(displaySeq.length - 1)}>
          <SkipForward size={14} />
        </button>
        <span class="text-sm text-gray-500 ml-2">
          Frame {displaySeq[frameIdx % displaySeq.length] ?? 0}/{frames.length} ({displaySeq.length} steps)
        </span>
      </div>
    </div>
  )
}

export function PreviewTitle({ cursor }: { cursor: CursorInstance }) {
  return <span>Preview — {cursor.fileName.value}</span>
}
