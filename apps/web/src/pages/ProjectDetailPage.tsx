import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FolderKanban, LayoutTemplate, Trash2, UserCog } from "lucide-react";
import { SaveProjectAsTemplateModal } from "../components/modals/SaveProjectAsTemplateModal";
import { TransferProjectOwnershipModal } from "../components/modals/TransferProjectOwnershipModal";
import { ProjectActivityFolder } from "../components/projects/ProjectActivityFolder";
import { EntityFilesSection } from "../components/ui/EntityFilesSection";
import { ProjectTasksSection } from "../components/projects/ProjectTasksSection";
import { ProjectMilestonesSection } from "../components/projects/ProjectMilestonesSection";
import { ProjectMembersSection } from "../components/projects/ProjectMembersSection";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { useDeleteProject, useProject, useTeams, useUpdateProject } from "../hooks/useData";
import { useHasPermission } from "../hooks/usePermissions";
import {
  canEditProjectMeta,
  formatProjectDateRange,
  parseDateInputEnd,
  parseDateInputStart,
  PROJECT_COLORS,
  PROJECT_STATUS_OPTIONS,
  projectStatusLabel,
  projectStatusTone,
  toDateInputValue,
} from "../lib/projectUtils";
import { cn } from "../lib/cn";
import type { ProjectStatus } from "../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

const TABS = [
  { id: "overview", label: "개요" },
  { id: "tasks", label: "업무" },
  { id: "milestones", label: "마일스톤" },
  { id: "members", label: "멤버" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProject(projectId);
  const { data: teamsData } = useTeams();
  const updateProject = useUpdateProject();
  const teams = teamsData?.teams ?? [];
  const deleteProject = useDeleteProject();
  const canDelete = useHasPermission("projects:delete");

  const project = data?.project;
  const [tab, setTab] = useState<TabId>("overview");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [teamId, setTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const startEdit = () => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setColor(project.color);
    setTeamId(project.teamId ?? "");
    setStartDate(toDateInputValue(project.startAt));
    setEndDate(toDateInputValue(project.endAt));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!project || !name.trim()) return;
    await updateProject.mutateAsync({
      id: project.id,
      name: name.trim(),
      description: description.trim() || null,
      status,
      color,
      teamId: teamId || null,
      startAt: parseDateInputStart(startDate),
      endAt: parseDateInputEnd(endDate),
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) return;
    await deleteProject.mutateAsync(project.id);
    navigate("/projects", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="프로젝트" />
        <GlassCard className="p-6 text-center text-sm text-navy-600">불러오는 중...</GlassCard>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="space-y-4">
        <PageHeader title="프로젝트" />
        <GlassCard className="p-6 text-center text-sm text-navy-600">프로젝트를 찾을 수 없습니다.</GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <button
        type="button"
        onClick={() => navigate("/projects")}
        className="flex items-center gap-1 text-sm text-navy-600 hover:text-navy-900"
      >
        <ArrowLeft className="h-4 w-4" />
        프로젝트 목록
      </button>

      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${project.color}22` }}
          >
            <FolderKanban className="h-6 w-6" style={{ color: project.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-navy-900">{project.name}</h1>
            <p className="truncate text-xs text-navy-500">
              {projectStatusLabel(project.status)}
              {project.teamName ? ` · ${project.teamName}` : ""}
              {project.taskCount ? ` · 업무 ${project.taskCount}건` : ""}
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition",
              tab === t.id ? "bg-primary-400/15 text-primary-700" : "text-navy-600 hover:bg-white/80",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <GlassCard className="p-5">
          <div className="mt-0 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                projectStatusTone(project.status),
              )}
            >
              {projectStatusLabel(project.status)}
            </span>
            {project.teamName && (
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs text-navy-600">
                {project.teamName}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-sky-100/80 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-navy-500">기간</span>
              <span className="text-right text-navy-800">
                {formatProjectDateRange(project.startAt, project.endAt)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-navy-500">담당자</span>
              <span className="text-navy-800">{project.ownerName}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium text-navy-700">설명</p>
            {editing ? (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(selectClass, "mb-2 font-semibold")}
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className={cn(selectClass, "mb-2")}
                >
                  {PROJECT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="프로젝트 설명"
                  className={cn(selectClass, "min-h-[80px] resize-none py-3")}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">시작일</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={selectClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">종료일</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={selectClass}
                    />
                  </div>
                </div>
                {teams.length > 0 && (
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">팀 없음</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
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
              </>
            ) : (
              <p className="text-sm text-navy-700 whitespace-pre-wrap">
                {project.description?.trim() || "설명이 없습니다."}
              </p>
            )}
          </div>

          {(canEditProjectMeta(project.currentUserRole) || project.isOwner || canDelete) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {canEditProjectMeta(project.currentUserRole) && (
                <>
                  {editing ? (
                    <>
                      <Button onClick={handleSave} disabled={updateProject.isPending || !name.trim()}>
                        {updateProject.isPending ? "저장 중..." : "저장"}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(false)}>
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={startEdit}>
                        수정
                      </Button>
                      <Button variant="secondary" onClick={() => setShowSaveTemplate(true)}>
                        <LayoutTemplate className="mr-1.5 h-4 w-4" />
                        템플릿으로 저장
                      </Button>
                    </>
                  )}
                </>
              )}
              {project.isOwner && (
                <Button variant="secondary" onClick={() => setShowTransfer(true)}>
                  <UserCog className="mr-1.5 h-4 w-4" />
                  소유권 이전
                </Button>
              )}
              {canDelete && (project.isOwner || project.currentUserRole === "owner") && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteProject.isPending}
                  className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteProject.isPending ? "삭제 중..." : "삭제"}
                </button>
              )}
            </div>
          )}

          <EntityFilesSection entityType="project" entityId={project.id} />

          <div className="mt-5">
            <ProjectActivityFolder projectId={project.id} />
          </div>
        </GlassCard>
      )}

      {tab === "tasks" && <ProjectTasksSection project={project} />}
      {tab === "milestones" && <ProjectMilestonesSection project={project} />}
      {tab === "members" && <ProjectMembersSection project={project} />}

      <SaveProjectAsTemplateModal
        open={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        project={project}
      />

      <TransferProjectOwnershipModal
        project={project}
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
      />
    </div>
  );
}
