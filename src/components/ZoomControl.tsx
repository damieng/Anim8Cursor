import { ZoomIn } from 'lucide-preact'
import { Dropdown } from './Dropdown'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}

export function ZoomControl({ value, onChange, min = 1, max = 10 }: Props) {
  return (
    <Dropdown
      button={<><ZoomIn size={14} />{value * 100}%</>}
      buttonClass="px-2 py-1 bg-white hover:bg-blue-50 rounded border border-gray-300 font-medium flex items-center gap-1 text-xs"
      popupClass="py-2 px-3 flex items-center gap-2"
      align="right"
    >
      {() => (
        <>
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onInput={(e) => onChange(parseInt((e.target as HTMLInputElement).value))}
            class="w-40"
          />
          <span class="text-sm whitespace-nowrap">{value * 100}%</span>
        </>
      )}
    </Dropdown>
  )
}
