import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useCopyProjectWorkFrom, useProjects } from "../../hooks/useData";
import { cn } from "../../lib/cn";
import type { Project } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export function SendProjectWorkModal({ open, onClose, project }: Props) {
  const { data, isLoading } = useProjects();
  const copyWork = useCopyProjectWorkFrom();
  const [targetProjectId, setTargetProjectId] = useState("");
  const [includeMilestones, setIncludeMilestones] = useState(true);
  const [includeSchedules, setIncludeSchedules] = useState(true);
  const [resetStatus, setResetStatus] = useState(true);
  const [query, setQuery] = useState("");

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.projects ?? [])
      .filter((p) => p.id !== project.id)
      .filter((p) => {
        if (!q) return true;
        return p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false);
      });
  }, [data?.projects, project.id, query]);

  useEffect(() => {
    if (!open) return;
    setTargetProjectId("");
    setIncludeMilestones(true);
    setIncludeSchedules(true);
    setResetStatus(true);
    setQuery("");
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId) return;
    await copyWork.mutateAsync({
      targetProjectId,
      sourceProjectId: project.id,
      includeMilestones,
      includeSchedules,
      resetStatus,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="다른 프로젝트로 복사">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          이 프로젝트의 업무·하위 업무·체크리스트·연결 일정을 다른 프로젝트에 복사합니다. 복사 후 대상
          프로젝트에서 자유롭게 수정할 수 있습니다.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="적용할 프로젝트 검색"
          className="w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-primary-400"
        />

        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-sky-100/80 p-2">
          {isLoading ? (
            <p className="p-3 text-center text-sm text-navy-500">불러오는 중...</p>
          ) : projects.length === 0 ? (
            <p className="p-3 text-center text-sm text-navy-500">적용할 프로젝트가 없습니다.</p>
          ) : (
            projects.map((p) => {
              const selected = targetProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTargetProjectId(p.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition",
                    selected ? "bg-primary-400/10" : "hover:bg-sky-50/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
                      selected ? "border-primary-500 bg-primary-500" : "border-sky-200",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-navy-900">{p.name}</span>
                    <span className="text-xs text-navy-500">
                      업무 {p.taskCount ?? 0}건 · 마일스톤 {p.milestoneCount ?? 0}건
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-2 rounded-2xl bg-sky-50/60 p-3 text-sm text-navy-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeMilestones}
              onChange={(e) => setIncludeMilestones(e.target.checked)}
              className="h-4 w-4 rounded border-sky-200"
            />
            마일스톤 포함
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSchedules}
              onChange={(e) => setIncludeSchedules(e.target.checked)}
              className="h-4 w-4 rounded border-sky-200"
            />
            연결된 일정(캘린더) 포함
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={resetStatus}
              onChange={(e) => setResetStatus(e.target.checked)}
              className="h-4 w-4 rounded border-sky-200"
            />
            업무·마일스톤 상태를 초기화 (할 일 / 대기)
          </label>
        </div>

        <Button type="submit" fullWidth disabled={copyWork.isPending || !targetProjectId}>
          {copyWork.isPending ? "복사 중..." : "선택한 프로젝트에 복사"}
        </Button>
      </form>
    </Modal>
  );
}
