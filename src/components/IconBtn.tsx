import type { ComponentChildren } from 'preact'

interface Props {
  onClick: () => void
  children: ComponentChildren
  title?: string
}

export function IconBtn({ onClick, children, title }: Props) {
  return (
    <button
      class="p-1.5 bg-white hover:bg-blue-50 rounded border border-gray-300 flex items-center justify-center"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}
