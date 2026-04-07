import { type CursorInstance, saveAniFile, setSpeed } from '../store'
import { Save } from 'lucide-preact'
import { NumField } from './NumField'

export function SaveBar({ cursor }: { cursor: CursorInstance }) {
  function handleSave() {
    const data = saveAniFile(cursor)
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = cursor.fileName.value
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      class="p-1.5 bg-white hover:bg-blue-50 rounded border border-gray-300 flex items-center justify-center"
      onClick={handleSave}
      title="Save .ani"
    >
      <Save size={18} />
    </button>
  )
}

export function SpeedControl({ cursor }: { cursor: CursorInstance }) {
  return (
    <NumField
      label="Jiffies:"
      value={cursor.speed.value}
      onChange={(v) => setSpeed(cursor, Math.max(1, v))}
      min={1}
      max={6000}
    />
  )
}
