import { useRef, useEffect } from 'preact/hooks'
import type { CursorFrame } from '../aniFormat'

export function FrameTile({
  frame,
  size,
  selected,
  active,
  index,
  onClick,
}: {
  frame: CursorFrame
  size: number
  selected: boolean
  active: boolean
  index: number
  onClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height, pixels } = frame
    const maxDim = Math.max(width, height)
    const scale = size / maxDim
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    const cw = canvas.width
    const ch = canvas.height
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, cw, ch)
    const sz = scale
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#cbd5e1'
          ctx.fillRect(Math.round(x * sz), Math.round(y * sz), Math.ceil(sz), Math.ceil(sz))
        }
      }
    }

    const imgData = ctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      imgData.data[i * 4] = pixels[i * 4]
      imgData.data[i * 4 + 1] = pixels[i * 4 + 1]
      imgData.data[i * 4 + 2] = pixels[i * 4 + 2]
      imgData.data[i * 4 + 3] = pixels[i * 4 + 3]
    }
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    ctx.drawImage(tmp, 0, 0, cw, ch)

    const hx = frame.hotspotX
    const hy = frame.hotspotY
    if (hx >= 0 && hx < width && hy >= 0 && hy < height) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(Math.round(hx * sz + sz / 2), Math.round(hy * sz + sz / 2), Math.max(2, sz / 3), 0, Math.PI * 2)
      ctx.fill()
    }
  }, [frame, size, frame.pixels])

  return (
    <div
      class={`inline-flex flex-col items-center cursor-pointer border-2 rounded p-0.5 transition-colors ${
        active ? 'border-blue-500 bg-blue-50' : selected ? 'border-blue-300 bg-blue-50/50' : 'border-transparent hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      <canvas ref={canvasRef} class="block" />
      <span class="text-xs text-gray-500 mt-0.5 leading-tight">{index}</span>
    </div>
  )
}
