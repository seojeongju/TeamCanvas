import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateProjectFromTemplate, useOrgProjectTemplates, useTeams } from "../../hooks/useData";
import { PROJECT_COLORS, PROJECT_STATUS_OPTIONS } from "../../lib/projectUtils";
import { listBuiltinTemplates, resolveProjectTemplate } from "../../lib/projectTemplates";
import { cn } from "../../lib/cn";
import type { ProjectStatus } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

const MEMBER_ROLE_LABELS: Record<string, string> = {
  manager: "매니저",
  member: "멤버",
  viewer: "뷰어",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
};

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const createFromTemplate = useCreateProjectFromTemplate();
  const { data: teamsData } = useTeams();
  const { data: orgTemplatesData } = useOrgProjectTemplates();
  const teams = teamsData?.teams ?? [];
  const orgTemplates = orgTemplatesData?.templates ?? [];
  const templateOptions = [
    ...listBuiltinTemplates(),
    ...orgTemplates.map((t) => ({
      id: `org:${t.id}`,
      name: t.name,
      description: t.description ?? "",
      milestones: t.milestones,
      tasks: t.tasks ?? [],
      memberSlots: t.memberSlots ?? [],
      source: "org" as const,
    })),
  ];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [teamId, setTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [templateId, setTemplateId] = useState("builtin:blank");

  const selectedTemplate = useMemo(
    () => resolveProjectTemplate(templateId, orgTemplates),
    [templateId, orgTemplates],
  );

  const reset = () => {
    setName("");
    setDescription("");
    setStatus("planning");
    setColor(PROJECT_COLORS[0]);
    setTeamId("");
    setStartDate("");
    setEndDate("");
    setTemplateId("builtin:blank");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const startAt = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endAt = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

    const result = await createFromTemplate.mutateAsync({
      templateId,
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      color,
      teamId: teamId || null,
      startAt,
      endAt,
    });

    handleClose();
    onCreated?.(result.id);
  };

  return (
    <Modal open={open} onClose={handleClose} title="프로젝트 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="프로젝트 이름"
          placeholder="예: Q2 웹사이트 리뉴얼"
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
            placeholder="프로젝트 목표·범위"
            className={cn(selectClass, "min-h-[72px] resize-none py-3")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-navy-700">템플릿</label>
            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate("/settings/project-templates");
              }}
              className="text-xs text-primary-600 hover:underline"
            >
              템플릿 설정
            </button>
          </div>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={selectClass}>
            {templateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.source === "org" ? "[조직] " : ""}
                {t.name} — {t.description}
              </option>
            ))}
          </select>
          {selectedTemplate &&
            (selectedTemplate.milestones.length > 0 ||
              selectedTemplate.tasks.length > 0 ||
              selectedTemplate.memberSlots.length > 0) && (
              <div className="rounded-xl bg-sky-50/60 px-3 py-2.5 text-xs text-navy-600">
                {selectedTemplate.milestones.length > 0 && (
                  <p>마일스톤 {selectedTemplate.milestones.length}개</p>
                )}
                {selectedTemplate.tasks.length > 0 && <p>기본 업무 {selectedTemplate.tasks.length}개</p>}
                {selectedTemplate.memberSlots.length > 0 && (
                  <p className="mt-1 text-navy-500">
                    권장 역할:{" "}
                    {selectedTemplate.memberSlots
                      .map((s) => `${s.label}(${MEMBER_ROLE_LABELS[s.role] ?? s.role})`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}
          {templateId.startsWith("org:") && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate(`/settings/project-templates?edit=${templateId.slice(4)}`);
              }}
              className="self-start text-xs text-primary-600 hover:underline"
            >
              선택한 템플릿 수정
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={selectClass}>
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <Input label="시작일 (선택)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="종료일 (선택)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <Button type="submit" fullWidth disabled={createFromTemplate.isPending}>
          {createFromTemplate.isPending ? "생성 중..." : "프로젝트 저장"}
        </Button>
      </form>
    </Modal>
  );
}
