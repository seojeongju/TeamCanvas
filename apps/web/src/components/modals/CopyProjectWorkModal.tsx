import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { ProjectTaskSelectPanel } from "./ProjectTaskSelectPanel";
import { useCopyProjectWorkFrom, useProjects } from "../../hooks/useData";
import type { Project } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export function CopyProjectWorkModal({ open, onClose, project }: Props) {
  const { data, isLoading } = useProjects();
  const copyWork = useCopyProjectWorkFrom();
  const [sourceProjectId, setSourceProjectId] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [includeMilestones, setIncludeMilestones] = useState(false);
  const [includeSchedules, setIncludeSchedules] = useState(true);
  const [resetStatus, setResetStatus] = useState(true);

  const projects = useMemo(
    () => (data?.projects ?? []).filter((p) => p.id !== project.id),
    [data?.projects, project.id],
  );

  useEffect(() => {
    if (!open) return;
    setSourceProjectId("");
    setSelectedTaskIds(new Set());
    setIncludeMilestones(false);
    setIncludeSchedules(true);
    setResetStatus(true);
  }, [open]);

  const handleSelectProject = (id: string) => {
    setSourceProjectId(id);
    setSelectedTaskIds(new Set());
  };

  const canSubmit =
    !!sourceProjectId && (selectedTaskIds.size > 0 || includeMilestones) && !copyWork.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await copyWork.mutateAsync({
      targetProjectId: project.id,
      sourceProjectId,
      taskIds: [...selectedTaskIds],
      includeMilestones,
      includeSchedules,
      resetStatus,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="다른 프로젝트에서 가져오기">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          원본 프로젝트를 선택한 뒤, 가져올 업무를 체크하세요. 선택한 업무의 체크리스트·하위 업무도
          함께 복사됩니다.
        </p>

        <ProjectTaskSelectPanel
          projects={projects}
          projectsLoading={isLoading}
          selectedProjectId={sourceProjectId}
          onSelectProject={handleSelectProject}
          selectedTaskIds={selectedTaskIds}
          onChangeTaskIds={setSelectedTaskIds}
          taskSourceProjectId={sourceProjectId}
          projectSearchPlaceholder="원본 프로젝트 검색"
          emptyProjectsText="가져올 프로젝트가 없습니다."
        />

        <div className="space-y-2 rounded-2xl bg-sky-50/60 p-3 text-sm text-navy-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeMilestones}
              onChange={(e) => setIncludeMilestones(e.target.checked)}
              className="h-4 w-4 rounded border-sky-200"
            />
            마일스톤 전체 포함
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

        <Button type="submit" fullWidth disabled={!canSubmit}>
          {copyWork.isPending
            ? "가져오는 중..."
            : selectedTaskIds.size > 0
              ? `선택한 업무 ${selectedTaskIds.size}건 가져오기`
              : "마일스톤만 가져오기"}
        </Button>
      </form>
    </Modal>
  );
}
