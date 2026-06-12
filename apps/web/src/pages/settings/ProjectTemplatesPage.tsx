import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  ProjectTemplateEditorModal,
  emptyTemplateFormValues,
  formValuesToPayload,
  templateToFormValues,
  type ProjectTemplateFormValues,
} from "../../components/modals/ProjectTemplateEditorModal";
import {
  useCreateOrgProjectTemplate,
  useDeleteOrgProjectTemplate,
  useOrgProjectTemplates,
  useUpdateOrgProjectTemplate,
} from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { listBuiltinTemplates } from "../../lib/projectTemplates";
import type { OrgProjectTemplate } from "../../lib/types";

export function ProjectTemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useHasPermission("projects:write");
  const { data, isLoading } = useOrgProjectTemplates();
  const createTemplate = useCreateOrgProjectTemplate();
  const updateTemplate = useUpdateOrgProjectTemplate();
  const deleteTemplate = useDeleteOrgProjectTemplate();

  const orgTemplates = data?.templates ?? [];
  const builtins = listBuiltinTemplates();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OrgProjectTemplate | null>(null);
  const [formValues, setFormValues] = useState<ProjectTemplateFormValues>(emptyTemplateFormValues());
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormValues(emptyTemplateFormValues());
  };

  const openCreate = () => {
    setEditing(null);
    setFormValues(emptyTemplateFormValues());
    setShowModal(true);
  };

  const openEdit = (template: OrgProjectTemplate) => {
    setEditing(template);
    setFormValues(templateToFormValues(template));
    setShowModal(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || isLoading || !canWrite) return;

    const template = orgTemplates.find((t) => t.id === editId);
    if (!template) return;

    openEdit(template);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [searchParams, orgTemplates, isLoading, canWrite, setSearchParams]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.name.trim()) return;

    const payload = formValuesToPayload(formValues, !!editing);

    try {
      if (editing) {
        await updateTemplate.mutateAsync({ templateId: editing.id, ...payload });
        setToast({ tone: "info", message: `"${payload.name}" 템플릿을 수정했습니다.` });
      } else {
        await createTemplate.mutateAsync({
          name: payload.name,
          description: payload.description ?? undefined,
          milestones: payload.milestones,
          tasks: payload.tasks,
          memberSlots: payload.memberSlots,
        });
        setToast({ tone: "info", message: `"${payload.name}" 템플릿을 추가했습니다.` });
      }
      closeModal();
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "템플릿 저장에 실패했습니다.",
      });
    }
  };

  const handleDelete = async (template: OrgProjectTemplate) => {
    if (!window.confirm(`"${template.name}" 템플릿을 삭제할까요?`)) return;

    try {
      await deleteTemplate.mutateAsync(template.id);
      if (editing?.id === template.id) closeModal();
      setToast({ tone: "info", message: `"${template.name}" 템플릿을 삭제했습니다.` });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "템플릿 삭제에 실패했습니다.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="프로젝트 템플릿"
        subtitle="마일스톤·기본 업무·권장 역할을 포함한 프로젝트 템플릿"
        action={
          canWrite ? (
            <button
              type="button"
              onClick={openCreate}
              className="glass flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-primary-600"
            >
              <Plus className="h-4 w-4" />
              템플릿 추가
            </button>
          ) : undefined
        }
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy-800">기본 템플릿</h2>
        <p className="mb-2 text-xs text-navy-500">기본 템플릿은 수정할 수 없습니다. 조직 템플릿으로 복사해 사용하세요.</p>
        <div className="space-y-2">
          {builtins.map((t) => (
            <GlassCard key={t.id} className="p-4">
              <p className="font-medium text-navy-900">{t.name}</p>
              <p className="text-xs text-navy-500">{t.description}</p>
              {(t.milestones.length > 0 || t.tasks.length > 0) && (
                <p className="mt-1 text-xs text-navy-400">
                  마일스톤 {t.milestones.length}개
                  {t.tasks.length > 0 ? ` · 업무 ${t.tasks.length}개` : ""}
                  {t.milestones.length > 0 ? ` · ${t.milestones.map((m) => m.title).join(" → ")}` : ""}
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy-800">조직 템플릿</h2>
        {isLoading ? (
          <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
        ) : orgTemplates.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-navy-500">
            조직 전용 템플릿이 없습니다.
            {canWrite && " 위 버튼으로 추가하거나 프로젝트 상세에서 템플릿으로 저장할 수 있습니다."}
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {orgTemplates.map((t) => (
              <GlassCard key={t.id} className="flex items-center gap-2 p-4">
                <button
                  type="button"
                  onClick={() => canWrite && openEdit(t)}
                  disabled={!canWrite}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <p className="font-medium text-navy-900">{t.name}</p>
                  <p className="text-xs text-navy-500">{t.description ?? "설명 없음"}</p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    마일스톤 {t.milestones.length}개
                    {(t.tasks?.length ?? 0) > 0 ? ` · 업무 ${t.tasks!.length}개` : ""}
                    {(t.memberSlots?.length ?? 0) > 0 ? ` · 역할 ${t.memberSlots!.length}개` : ""}
                    {t.milestones.length > 0 ? ` · ${t.milestones.map((m) => m.title).join(" → ")}` : ""}
                  </p>
                </button>
                {canWrite && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-primary-600"
                      aria-label={`${t.name} 수정`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      disabled={deleteTemplate.isPending}
                      className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`${t.name} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
                  </>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <ProjectTemplateEditorModal
        open={showModal}
        onClose={closeModal}
        editing={editing}
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSave}
        isPending={createTemplate.isPending || updateTemplate.isPending}
      />

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
