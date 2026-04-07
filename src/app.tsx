import { Fragment } from 'preact'
import { BasePane } from './components/BasePane'
import { AppPane, AppTitle } from './panes/AppPane'
import { CursorPane, CursorPaneTitle, CursorStatusBar } from './panes/CursorPane'
import { FrameEditor, EditorTitle } from './panes/FrameEditor'
import { PreviewPane, PreviewTitle } from './panes/PreviewPane'
import { SaveBar, SpeedControl } from './components/Toolbar'
import { cursors, activeCursorId, removeCursor, storedFocusedId, openPreview } from './store'
import { Play } from 'lucide-preact'
import './app.css'

export function App() {
  const focusedId = storedFocusedId.value
  const allCursors = cursors.value
  const TOP = 100

  function getZIndex(windowId: string): number {
    return windowId === focusedId ? TOP : 1
  }

  function setFocus(id: string) {
    storedFocusedId.value = id
  }

  function focusCursor(windowId: string, cursorId: string) {
    setFocus(windowId)
    activeCursorId.value = cursorId
  }

  function handleClose(cursorId: string) {
    removeCursor(cursorId)
  }

  return (
    <div class="relative w-screen h-screen overflow-hidden bg-gray-200">
      <BasePane
        title={<AppTitle />}
        windowId="cursor-editor"
        initialX={16}
        initialY={16}
        initialW={320}
        zIndex={getZIndex('cursor-editor')}
        onFocus={() => setFocus('cursor-editor')}
      >
        <AppPane />
      </BasePane>

      {allCursors.map((cursor, i) => (
        <Fragment key={cursor.id}>
          {cursor.editorOpen.value && (
            <BasePane
              title={<EditorTitle cursor={cursor} />}
              windowId={`editor-${cursor.id}`}
              initialX={16 + i * 30}
              initialY={120 + i * 30}
              initialW={420}
              initialH={480}
              resizable
              zIndex={getZIndex(`editor-${cursor.id}`)}
              onFocus={() => focusCursor(`editor-${cursor.id}`, cursor.id)}
              onClose={() => { cursor.editorOpen.value = false }}
            >
              <div class="flex flex-col gap-2 p-2 h-full">
                <FrameEditor cursor={cursor} />
              </div>
            </BasePane>
          )}

          <BasePane
            title={<CursorPaneTitle cursor={cursor} />}
            windowId={`grid-${cursor.id}`}
            initialX={360 + i * 30}
            initialY={16 + i * 30}
            initialW={700}
            initialH={500}
            resizable
            statusBar={<CursorStatusBar cursor={cursor} />}
            zIndex={getZIndex(`grid-${cursor.id}`)}
            onFocus={() => focusCursor(`grid-${cursor.id}`, cursor.id)}
            onClose={() => handleClose(cursor.id)}
          >
            <div class="p-3 h-full flex flex-col overflow-hidden">
              <div class="flex items-center gap-2 mb-2 shrink-0">
                <SaveBar cursor={cursor} />
                <SpeedControl cursor={cursor} />
                <button
                  class="px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium flex items-center gap-1"
                  onClick={() => openPreview(cursor)}
                >
                  <Play size={14} />
                  Preview
                </button>
              </div>
              <CursorPane cursor={cursor} />
            </div>
          </BasePane>

          {cursor.previewOpen.value && (
            <BasePane
              title={<PreviewTitle cursor={cursor} />}
              windowId={`preview-${cursor.id}`}
              initialX={200 + i * 30}
              initialY={200 + i * 30}
              initialW={400}
              initialH={400}
              resizable
              zIndex={getZIndex(`preview-${cursor.id}`)}
              onFocus={() => setFocus(`preview-${cursor.id}`)}
              onClose={() => { cursor.previewOpen.value = false }}
            >
              <PreviewPane cursor={cursor} />
            </BasePane>
          )}
        </Fragment>
      ))}
    </div>
  )
}
