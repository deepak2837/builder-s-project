'use client';

import { WIZARD_STEPS } from '@/engine/constants';

/**
 * The five-step progress rail. Steps already visited are clickable so the user
 * can jump back without losing anything - all state lives above this.
 */
export function WizardStepper({
  current,
  furthest,
  onJump,
}: {
  current: number;
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav className="no-print" aria-label="Report steps">
      <ol className="flex items-start justify-between gap-1">
        {WIZARD_STEPS.map((step, idx) => {
          const state = idx === current ? 'current' : idx < furthest || idx <= furthest ? 'done' : 'todo';
          const reachable = idx <= furthest;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${idx === 0 ? 'bg-transparent' : idx <= furthest ? 'bg-brand-500' : 'bg-ink-200'}`} />
                <button
                  onClick={() => reachable && onJump(idx)}
                  disabled={!reachable}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition ${
                    state === 'current'
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : idx < current || idx <= furthest
                        ? 'bg-brand-500 text-white hover:bg-brand-600'
                        : 'bg-ink-200 text-ink-500'
                  } ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {idx + 1}
                </button>
                <span
                  className={`h-0.5 flex-1 ${idx === WIZARD_STEPS.length - 1 ? 'bg-transparent' : idx < furthest ? 'bg-brand-500' : 'bg-ink-200'}`}
                />
              </div>
              <span
                className={`mt-1.5 truncate text-center text-[11px] ${
                  idx === current ? 'font-semibold text-ink-900' : 'text-ink-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
