import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { EntityFilesSection } from "../ui/EntityFilesSection";
import { useTeams, useUpdateProject } from "../../hooks/useData";
import {
  parseDateInputEnd,
  parseDateInputStart,
  PROJECT_COLORS,
  PROJECT_STATUS_OPTIONS,
  toDateInputValue,
} from "../../lib/projectUtils";
import { cn } from "../../lib/cn";
import type { Project, ProjectStatus, ProjectVisibility } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

type Props = {
  project: Project | null;
  onClose: () => void;
};

export function EditProjectModal({ project, onClose }: Props) {
  const updateProject = useUpdateProject();
  const { data: teamsData } = useTeams();
  const teams = teamsData?.teams ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [teamId, setTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shareWithOrganization, setShareWithOrganization] = useState(true);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setColor(project.color);
    setTeamId(project.teamId ?? "");
    setStartDate(toDateInputValue(project.startAt));
    setEndDate(toDateInputValue(project.endAt));
    setShareWithOrganization(project.visibility !== "members");
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;
    const visibility: ProjectVisibility = shareWithOrganization ? "organization" : "members";
    await updateProject.mutateAsync({
      id: project.id,
      name: name.trim(),
      description: description.trim() || null,
      status,
      color,
      teamId: teamId || null,
      startAt: parseDateInputStart(startDate),
      endAt: parseDateInputEnd(endDate),
      visibility,
    });
    onClose();
  };

  return (
    <Modal open={!!project} onClose={onClose} title="프로젝트 수정">
      {project && (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            label="프로젝트 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="프로젝트 목표·범위"
              className={cn(selectClass, "min-h-[72px] resize-none py-3")}
            />
          </div>

          <EntityFilesSection entityType="project" entityId={project.id} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className={selectClass}
            >
              {PROJECT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="시작일 (선택)"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="종료일 (선택)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {teams.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-navy-700">팀 (선택)</label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={selectClass}>
                <option value="">팀 없음</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sky-100/80 bg-sky-50/50 px-3 py-3">
            <input
              type="checkbox"
              checked={shareWithOrganization}
              onChange={(e) => setShareWithOrganization(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-sky-300 text-primary-500 focus:ring-primary-400"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-navy-800">조직 전체에 공유</span>
              <span className="mt-0.5 block text-xs text-navy-500">
                조직 멤버 모두가 프로젝트를 보고 협업할 수 있습니다.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-navy-700">색상</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition",
                    color === c ? "border-navy-800 scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`색상 ${c}`}
                />
              ))}
            </div>
          </div>

          <Button type="submit" fullWidth disabled={updateProject.isPending || !name.trim()}>
            {updateProject.isPending ? "저장 중..." : "변경 저장"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
