import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArrowLeft, Copy, FolderKanban, LayoutTemplate, Trash2, UserCog } from "lucide-react";
import { DuplicateProjectModal } from "../components/modals/DuplicateProjectModal";
import { EditProjectModal } from "../components/modals/EditProjectModal";
import { SaveProjectAsTemplateModal } from "../components/modals/SaveProjectAsTemplateModal";
import { TransferProjectOwnershipModal } from "../components/modals/TransferProjectOwnershipModal";
import { ProjectActivityFolder } from "../components/projects/ProjectActivityFolder";
import { ProjectCommentsSection } from "../components/projects/ProjectCommentsSection";
import { ProjectActivitySection } from "../components/projects/ProjectActivitySection";
import { EntityFilesSection } from "../components/ui/EntityFilesSection";
import { ProjectTasksSection } from "../components/projects/ProjectTasksSection";
import { ProjectMilestonesSection } from "../components/projects/ProjectMilestonesSection";
import { ProjectOverviewStats } from "../components/projects/ProjectOverviewStats";
import { ProjectMembersSection } from "../components/projects/ProjectMembersSection";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { useDeleteProject, useProject, useProjectMembers, useProjectMilestones, useTasks, useUpdateProject } from "../hooks/useData";
import { useCurrentOrgRole, useHasPermission } from "../hooks/usePermissions";
import { useAuthStore } from "../stores/authStore";
import {
  canDeleteEntity,
  isOrgAdminRole,
  projectHasCollaborationLinks,
} from "../lib/deletePermissions";
import {
  canEditProjectMeta,
  formatProjectDateRange,
  projectStatusLabel,
  projectStatusTone,
} from "../lib/projectUtils";
import { ProjectProgressBar } from "../components/projects/ProjectProgressBadge";
import { cn } from "../lib/cn";

const TABS = [
  { id: "overview", label: "개요" },
  { id: "tasks", label: "업무" },
  { id: "milestones", label: "마일스톤" },
  { id: "members", label: "멤버" },
  { id: "activity", label: "활동" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError } = useProject(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const canDeletePerm = useHasPermission("projects:delete");
  const orgRole = useCurrentOrgRole();
  const isAdmin = isOrgAdminRole(orgRole);
  const user = useAuthStore((s) => s.user);
  const { data: membersData } = useProjectMembers(projectId);

  const project = data?.project;
  const { data: tasksData } = useTasks(project ? { projectId: project.id } : undefined);
  const { data: milestonesData } = useProjectMilestones(project?.id);
  const hasCollaboration = project
    ? projectHasCollaborationLinks(
        project,
        (membersData?.members ?? []).map((m) => m.userId),
        (tasksData?.tasks ?? []).map((t) => ({
          assigneeId: t.assigneeId,
          creatorId: t.creatorId,
        })),
      )
    : false;
  const canDelete = project
    ? canDeleteEntity({
        isOrgAdmin: isAdmin,
        hasAdminDeletePermission: canDeletePerm,
        isCreator: project.isOwner ?? project.ownerId === user?.id,
        hasCollaborationLinks: hasCollaboration,
      })
    : false;
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, [searchParams]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) return;
    await deleteProject.mutateAsync(project.id);
    navigate("/projects", { replace: true });
  };

  const handleArchive = async () => {
    if (!project) return;
    const next = project.status === "archived" ? "done" : "archived";
    const label = next === "archived" ? "보관" : "보관 해제";
    if (!window.confirm(`"${project.name}" 프로젝트를 ${label}할까요?`)) return;
    await updateProject.mutateAsync({ id: project.id, status: next });
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
              {project.progressPercent != null ? ` · ${project.progressPercent}%` : ""}
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
        <>
          <ProjectOverviewStats
            project={project}
            tasks={tasksData?.tasks ?? []}
            milestones={milestonesData?.milestones ?? []}
          />
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
            {project.visibility === "organization" ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                조직 공유
              </span>
            ) : (
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs text-navy-600">
                초대 멤버만
              </span>
            )}
            {project.teamName && (
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs text-navy-600">
                {project.teamName}
              </span>
            )}
          </div>

          {project.progressPercent != null && (
            <div className="mt-4">
              <ProjectProgressBar percent={project.progressPercent} color={project.color} />
            </div>
          )}

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
            <p className="text-sm text-navy-700 whitespace-pre-wrap">
              {project.description?.trim() || "설명이 없습니다."}
            </p>
          </div>

          {(canEditProjectMeta(project.currentUserRole) || project.isOwner || canDelete) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {canEditProjectMeta(project.currentUserRole) && (
                <>
                  <Button variant="secondary" onClick={() => setShowEdit(true)}>
                    수정
                  </Button>
                  <Button variant="secondary" onClick={() => setShowSaveTemplate(true)}>
                    <LayoutTemplate className="mr-1.5 h-4 w-4" />
                    템플릿으로 저장
                  </Button>
                  <Button variant="secondary" onClick={() => setShowDuplicate(true)}>
                    <Copy className="mr-1.5 h-4 w-4" />
                    복제
                  </Button>
                  <Button variant="secondary" onClick={handleArchive} disabled={updateProject.isPending}>
                    <Archive className="mr-1.5 h-4 w-4" />
                    {project.status === "archived" ? "보관 해제" : "보관"}
                  </Button>
                </>
              )}
              {project.isOwner && (
                <Button variant="secondary" onClick={() => setShowTransfer(true)}>
                  <UserCog className="mr-1.5 h-4 w-4" />
                  소유권 이전
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

          <EntityFilesSection entityType="project" entityId={project.id} />

          <ProjectCommentsSection project={project} />

          <div className="mt-5">
            <ProjectActivityFolder projectId={project.id} />
          </div>
        </GlassCard>
        </>
      )}

      {tab === "tasks" && <ProjectTasksSection project={project} />}
      {tab === "milestones" && <ProjectMilestonesSection project={project} />}
      {tab === "members" && <ProjectMembersSection project={project} />}
      {tab === "activity" && <ProjectActivitySection projectId={project.id} />}

      <EditProjectModal
        project={showEdit ? project : null}
        onClose={() => setShowEdit(false)}
      />

      <SaveProjectAsTemplateModal
        open={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        project={project}
      />

      <DuplicateProjectModal
        open={showDuplicate}
        onClose={() => setShowDuplicate(false)}
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
