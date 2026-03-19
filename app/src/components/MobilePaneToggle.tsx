'use client';

/**
 * Below `lg` the split view collapses to one pane at a time. This segmented
 * control switches between them, so the assistant stays reachable on a phone
 * instead of being hidden off-layout.
 */
export function MobilePaneToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="no-print flex gap-1 rounded-lg bg-ink-100 p-1 lg:hidden">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition ${
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
