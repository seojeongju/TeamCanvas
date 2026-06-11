import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FolderKanban, Trash2 } from "lucide-react";
import { ProjectTasksSection } from "../components/projects/ProjectTasksSection";
import { ProjectMilestonesSection } from "../components/projects/ProjectMilestonesSection";
import { ProjectMembersSection } from "../components/projects/ProjectMembersSection";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { useDeleteProject, useProject, useUpdateProject } from "../hooks/useData";
import { useHasPermission } from "../hooks/usePermissions";
import {
  formatProjectDateRange,
  PROJECT_STATUS_OPTIONS,
  projectStatusLabel,
  projectStatusTone,
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
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const canWrite = useHasPermission("projects:write");
  const canDelete = useHasPermission("projects:delete");

  const project = data?.project;
  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");

  const startEdit = () => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!project || !name.trim()) return;
    await updateProject.mutateAsync({
      id: project.id,
      name: name.trim(),
      description: description.trim() || null,
      status,
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
              </>
            ) : (
              <p className="text-sm text-navy-700 whitespace-pre-wrap">
                {project.description?.trim() || "설명이 없습니다."}
              </p>
            )}
          </div>

          {canWrite && (
            <div className="mt-5 flex flex-wrap gap-2">
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
                <Button variant="secondary" onClick={startEdit}>
                  수정
                </Button>
              )}
              {canDelete && (
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
        </GlassCard>
      )}

      {tab === "tasks" && <ProjectTasksSection project={project} />}
      {tab === "milestones" && <ProjectMilestonesSection project={project} />}
      {tab === "members" && <ProjectMembersSection project={project} />}
    </div>
  );
}
