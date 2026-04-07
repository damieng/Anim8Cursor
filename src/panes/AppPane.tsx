import { useState } from 'preact/hooks'
import { FolderOpen, FilePlus, MousePointer } from 'lucide-preact'
import { createCursor, addCursor, loadAniFile } from '../store'

export function AppPane() {
  const [dragOver, setDragOver] = useState(false)

  function openFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ani,.cur,.ico'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const buf = await file.arrayBuffer()
      try {
        const cursor = loadAniFile(buf, file.name)
        addCursor(cursor)
      } catch (e) {
        alert(`Error loading file: ${(e as Error).message}`)
      }
    }
    input.click()
  }

  function newCursor() {
    const size = prompt('Cursor size (e.g. 32):', '32')
    const s = parseInt(size ?? '32')
    if (isNaN(s) || s < 1 || s > 256) return
    addCursor(createCursor(undefined, undefined, undefined))
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const cursor = loadAniFile(reader.result as ArrayBuffer, file.name)
        addCursor(cursor)
      } catch (err) {
        alert(`Error loading file: ${(err as Error).message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div class="p-4 flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <MousePointer size={24} class="text-blue-600" />
        <h1 class="text-lg font-bold text-gray-800">ANI Cursor Editor</h1>
        <span class="text-xs text-gray-400 ml-auto">v{__APP_VERSION__}</span>
      </div>

      <div class="flex flex-col gap-2">
        <button
          class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          onClick={openFile}
        >
          <FolderOpen size={16} />
          Open .ani / .cur / .ico
        </button>
        <button
          class="flex items-center gap-2 px-3 py-2 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium"
          onClick={newCursor}
        >
          <FilePlus size={16} />
          New Cursor
        </button>
      </div>

      <div
        class={`border-2 border-dashed rounded-lg p-6 text-center text-sm transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        Drop .ani file here
      </div>

      <div class="text-xs text-gray-400 space-y-1">
        <p>Supports Windows animated cursor format (.ani)</p>
        <p>Each frame is an RGBA image with a hotspot</p>
      </div>
    </div>
  )
}

export function AppTitle() {
  return <span class="flex items-center gap-1"><MousePointer size={14} /> ANI Cursor Editor</span>
}
