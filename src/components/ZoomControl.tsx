export function ZoomControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="flex items-center gap-1">
      <button
        class="px-1.5 py-0.5 bg-white hover:bg-blue-50 rounded border border-gray-300 text-sm font-bold"
        onClick={() => onChange(Math.max(1, value - 1))}
      >−</button>
      <span class="text-sm font-medium w-12 text-center">{value}×</span>
      <button
        class="px-1.5 py-0.5 bg-white hover:bg-blue-50 rounded border border-gray-300 text-sm font-bold"
        onClick={() => onChange(Math.min(16, value + 1))}
      >+</button>
    </div>
  )
}
