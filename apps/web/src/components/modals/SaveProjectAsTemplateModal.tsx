import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateOrgProjectTemplate, useProjectMilestones, useTasks } from "../../hooks/useData";
import { milestonesFromProject, tasksFromProject } from "../../lib/projectTemplates";
import { cn } from "../../lib/cn";
import type { Project } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export function SaveProjectAsTemplateModal({ open, onClose, project }: Props) {
  const { data: milestonesData } = useProjectMilestones(open ? project.id : undefined);
  const { data: tasksData } = useTasks(open ? { projectId: project.id } : undefined);
  const createTemplate = useCreateOrgProjectTemplate();
  const milestones = milestonesData?.milestones ?? [];
  const projectTasks = tasksData?.tasks ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(`${project.name} 템플릿`);
    setDescription(project.description?.trim() ?? "");
    setIncludeTasks(true);
  }, [open, project.id, project.name, project.description]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createTemplate.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      milestones: milestonesFromProject(milestones, project.startAt),
      tasks: includeTasks
        ? tasksFromProject(
            projectTasks.map((t) => ({
              title: t.title,
              description: t.description,
              status: t.status,
              dueAt: t.dueAt ?? null,
            })),
            project.startAt,
          )
        : [],
    });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="템플릿으로 저장">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          이 프로젝트의 마일스톤·업무 구성을 조직 템플릿으로 저장합니다.
        </p>

        <Input
          label="템플릿 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(selectClass, "resize-none py-3")}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={includeTasks}
            onChange={(e) => setIncludeTasks(e.target.checked)}
            className="h-4 w-4 rounded border-sky-200"
          />
          연결된 업무 {projectTasks.length}건도 포함
        </label>

        {milestones.length > 0 || projectTasks.length > 0 ? (
          <div className="rounded-xl bg-sky-50/60 px-3 py-2.5 text-xs text-navy-600">
            {milestones.length > 0 && <p>마일스톤 {milestones.length}개</p>}
            {includeTasks && projectTasks.length > 0 && <p>업무 {projectTasks.length}개</p>}
            {project.startAt
              ? " (시작일 기준 일수 오프셋으로 변환)"
              : " (시작일이 없어 제목 위주로 저장)"}
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50/80 px-3 py-2.5 text-xs text-amber-800">
            마일스톤·업무가 없습니다. 제목과 설명만 템플릿으로 저장됩니다.
          </div>
        )}

        <Button type="submit" fullWidth disabled={createTemplate.isPending}>
          {createTemplate.isPending ? "저장 중..." : "템플릿 저장"}
        </Button>
      </form>
    </Modal>
  );
}
