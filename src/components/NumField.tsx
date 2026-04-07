export function NumField({ value, onChange, min, max, label }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
}) {
  return (
    <label class="flex items-center gap-1 text-sm">
      {label && <span class="text-gray-600">{label}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        class="w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-sm"
        onChange={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value)
          if (!isNaN(v)) onChange(v)
        }}
      />
    </label>
  )
}
