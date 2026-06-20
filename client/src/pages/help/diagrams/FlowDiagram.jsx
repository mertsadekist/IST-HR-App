/**
 * A simple left-to-right (RTL-aware) flow of labeled, numbered step chips with
 * arrows between them. Used for workflows (onboarding stages, ATS pipeline,
 * leave approval, payroll run, offboarding). Rendered with HTML so Arabic/RTL
 * text displays natively; the parent <html dir> handles direction.
 *
 * props.steps: ['First step', 'Second step', …]
 */
import { ChevronRight } from 'lucide-react';

export default function FlowDiagram({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4">
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="w-5 h-5 shrink-0 rounded-full bg-brand-gradient text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-xs font-medium text-surface-700 whitespace-nowrap">{label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight size={16} className="text-surface-300 rtl:rotate-180" />}
          </div>
        ))}
      </div>
    </div>
  );
}
