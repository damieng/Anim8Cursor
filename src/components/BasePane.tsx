import { useRef, useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { windowLayouts, updateWindowLayout } from '../store'

interface Props {
  title: string | ComponentChildren
  children: ComponentChildren
  statusBar?: ComponentChildren
  windowId?: string
  initialX: number
  initialY: number
  initialW?: number
  initialH?: number
  resizable?: boolean
  onFocus?: () => void
  onClose?: () => void
  zIndex?: number
}

export function BasePane({
  title, children, statusBar, windowId, initialX, initialY,
  initialW, initialH, resizable,
  onFocus, onClose, zIndex = 1
}: Props) {
  const stored = windowId ? windowLayouts.value[windowId] : undefined
  const [pos, setPos] = useState({ x: stored?.x ?? initialX, y: stored?.y ?? initialY })
  const [size, setSize] = useState({ w: stored?.w ?? (initialW ?? 0), h: stored?.h ?? (initialH ?? 0) })

  useEffect(() => {
    if (windowId) {
      updateWindowLayout(windowId, { x: pos.x, y: pos.y, w: size.w, h: size.h })
    }
  }, [])

  const dragging = useRef(false)
  const resizing = useRef(false)
  const posRef = useRef(pos)
  const sizeRef = useRef(size)
  posRef.current = pos
  sizeRef.current = size
  const offset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  function onTitleMouseDown(e: MouseEvent) {
    e.preventDefault()
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    onFocus?.()
  }

  function onResizeMouseDown(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    onFocus?.()
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragging.current) {
        const next = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }
        posRef.current = next
        setPos(next)
      }
      if (resizing.current) {
        const dx = e.clientX - resizeStart.current.x
        const dy = e.clientY - resizeStart.current.y
        const next = { w: Math.max(150, resizeStart.current.w + dx), h: Math.max(100, resizeStart.current.h + dy) }
        sizeRef.current = next
        setSize(next)
      }
    }
    function onMouseUp() {
      const wasActive = dragging.current || resizing.current
      dragging.current = false
      resizing.current = false
      if (wasActive && windowId) {
        const p = posRef.current, s = sizeRef.current
        updateWindowLayout(windowId, { x: p.x, y: p.y, w: s.w, h: s.h })
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [windowId])

  return (
    <div
      class="absolute rounded-lg shadow-xl border border-gray-300 bg-white overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, zIndex, width: size.w || undefined, height: size.h || undefined }}
      onMouseDown={() => onFocus?.()}
    >
      <div
        class={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-300 cursor-move select-none shrink-0 ${zIndex > 1 ? 'bg-blue-100' : 'bg-gray-100'}`}
        onMouseDown={onTitleMouseDown}
      >
        <span class="font-bold text-sm flex-1">{title}</span>
        {onClose && (
          <button
            class="ml-auto text-gray-400 hover:text-red-500 leading-none text-lg font-bold"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            title="Close"
          >
            ×
          </button>
        )}
      </div>
      <div class="overflow-auto flex-1">
        {children}
      </div>
      {statusBar && (
        <div class="flex items-center justify-between px-3 py-1 bg-gray-50 border-t border-gray-300 text-xs text-gray-500 shrink-0">
          {statusBar}
        </div>
      )}
      {resizable && (
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={onResizeMouseDown}
        >
          <svg viewBox="0 0 16 16" class="w-4 h-4 text-gray-400">
            <path d="M14 14L8 14L14 8Z" fill="currentColor" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
