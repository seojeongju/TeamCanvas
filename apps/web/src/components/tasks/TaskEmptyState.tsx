import type { ReactNode } from "react";
import { ClipboardList, Hand, LayoutGrid, Plus } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";

export function TaskEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <GlassCard className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400/10 text-primary-500">
        <ClipboardList className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <p className="text-base font-semibold text-navy-900">표시할 프로젝트가 없습니다</p>
      <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-navy-600">
        필터를 조정하거나 새 프로젝트를 추가해 보세요.
      </p>

      {onCreate && (
        <Button type="button" className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          프로젝트 추가
        </Button>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Tip icon={<Hand className="h-3 w-3" />} label="탭하면 상세" />
        <Tip icon={<LayoutGrid className="h-3 w-3" />} label="스와이프로 상태 변경" />
      </div>
    </GlassCard>
  );
}

function Tip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-navy-600">
      {icon}
      {label}
    </span>
  );
}
