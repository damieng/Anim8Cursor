import { signal } from '@preact/signals'
import { FilePlus, FolderOpen } from 'lucide-preact'
import { createCursor, addCursor, loadAniFile } from '../store'
import { IconBtn } from '../components/IconBtn'

const ICON = 18
const APP_VERSION = __APP_VERSION__

const CHANGELOG = [
  { version: '0.1.0', changes: [
    'Initial release',
    'Load and save .ani files',
    'Frame-by-frame RGBA pixel editor',
    'Hotspot positioning',
    'Animated preview with per-frame rates',
    'Frame management: add, duplicate, delete, reorder',
    'Color dropdown with palette from current frame',
    'localStorage persistence across refresh',
  ] },
]

const showChangelog = signal(false)

export function AppTitle() {
  return (
    <span class="flex items-center w-full gap-1">
      <span class="font-black tracking-tight">Anim8Cursor</span>
      <span class="flex-1" />
      <button
        class="font-normal text-xs text-gray-400 hover:text-blue-500"
        onClick={(e) => { e.stopPropagation(); showChangelog.value = !showChangelog.value }}
        title="Show changelog"
      >
        v{APP_VERSION}
      </button>
      <span class="flex-1" />
    </span>
  )
}

export function AppPane() {
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
    addCursor(createCursor())
  }

  return (
    <div>
      <div class="flex items-center gap-3 px-3 py-2">
        <IconBtn onClick={newCursor} title="New cursor">
          <FilePlus size={ICON} />
        </IconBtn>
        <IconBtn onClick={openFile} title="Open .ani file">
          <FolderOpen size={ICON} />
        </IconBtn>
        <span class="w-px h-6 bg-gray-300 mx-0.5" />
        <div class="flex flex-col">
          <span class="text-sm text-gray-600">Windows Animated Cursor Editor</span>
          <a
            class="text-sm text-blue-500 hover:text-blue-700 underline"
            href="https://github.com/damieng/Anim8Cursor"
            target="_blank"
          >
            https://github.com/damieng/Anim8Cursor
          </a>
        </div>
      </div>
      {showChangelog.value && (
        <div class="px-3 pb-3 border-t border-gray-200 mt-1 pt-2 max-h-48 overflow-y-auto">
          {CHANGELOG.map((release) => (
            <div key={release.version} class="mb-2 last:mb-0">
              <div class="text-xs font-bold text-gray-600">
                v{release.version}
              </div>
              <ul class="text-xs text-gray-500 ml-3 list-disc">
                {release.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
