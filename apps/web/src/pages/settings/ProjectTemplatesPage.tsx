import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  useCreateOrgProjectTemplate,
  useDeleteOrgProjectTemplate,
  useOrgProjectTemplates,
  useUpdateOrgProjectTemplate,
} from "../../hooks/useData";
import { useHasPermission } from "../../hooks/usePermissions";
import { listBuiltinTemplates } from "../../lib/projectTemplates";
import type { OrgProjectTemplate } from "../../lib/types";
import { cn } from "../../lib/cn";

type MilestoneDraft = { title: string; offsetDays: string };

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-primary-400";

export function ProjectTemplatesPage() {
  const navigate = useNavigate();
  const canWrite = useHasPermission("projects:write");
  const { data, isLoading } = useOrgProjectTemplates();
  const createTemplate = useCreateOrgProjectTemplate();
  const updateTemplate = useUpdateOrgProjectTemplate();
  const deleteTemplate = useDeleteOrgProjectTemplate();

  const orgTemplates = data?.templates ?? [];
  const builtins = listBuiltinTemplates();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OrgProjectTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([{ title: "", offsetDays: "0" }]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setMilestones([{ title: "", offsetDays: "0" }]);
    setShowModal(true);
  };

  const openEdit = (t: OrgProjectTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setMilestones(
      t.milestones.length > 0
        ? t.milestones.map((m) => ({
            title: m.title,
            offsetDays: m.offsetDays != null ? String(m.offsetDays) : "",
          }))
        : [{ title: "", offsetDays: "0" }],
    );
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m) => ({
          title: m.title.trim(),
          offsetDays: m.offsetDays ? Number(m.offsetDays) : undefined,
        })),
    };
    if (editing) {
      await updateTemplate.mutateAsync({ templateId: editing.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (t: OrgProjectTemplate) => {
    if (!window.confirm(`"${t.name}" 템플릿을 삭제할까요?`)) return;
    await deleteTemplate.mutateAsync(t.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="프로젝트 템플릿"
        subtitle="조직 전용 템플릿 관리"
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
        <div className="space-y-2">
          {builtins.map((t) => (
            <GlassCard key={t.id} className="p-4">
              <p className="font-medium text-navy-900">{t.name}</p>
              <p className="text-xs text-navy-500">{t.description}</p>
              {t.milestones.length > 0 && (
                <p className="mt-1 text-xs text-navy-400">
                  마일스톤 {t.milestones.length}개 · {t.milestones.map((m) => m.title).join(" → ")}
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
            {canWrite && " 위 버튼으로 추가할 수 있습니다."}
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {orgTemplates.map((t) => (
              <GlassCard key={t.id} className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => canWrite && openEdit(t)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-medium text-navy-900">{t.name}</p>
                  <p className="text-xs text-navy-500">{t.description ?? "설명 없음"}</p>
                  <p className="mt-0.5 text-xs text-navy-400">마일스톤 {t.milestones.length}개</p>
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {canWrite && <ChevronRight className="h-4 w-4 text-navy-400" />}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => navigate("/projects")}
        className="text-sm text-primary-600 hover:underline"
      >
        프로젝트 목록으로
      </button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "템플릿 수정" : "템플릿 추가"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy-700">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(selectClass, "resize-none py-3")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-navy-700">마일스톤</label>
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="제목"
                  value={m.title}
                  onChange={(e) => {
                    const next = [...milestones];
                    next[i] = { ...next[i], title: e.target.value };
                    setMilestones(next);
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="일"
                  value={m.offsetDays}
                  onChange={(e) => {
                    const next = [...milestones];
                    next[i] = { ...next[i], offsetDays: e.target.value };
                    setMilestones(next);
                  }}
                  className="w-20"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMilestones([...milestones, { title: "", offsetDays: "" }])}
            >
              마일스톤 행 추가
            </Button>
          </div>

          <Button type="submit" fullWidth disabled={createTemplate.isPending || updateTemplate.isPending}>
            저장
          </Button>
        </form>
      </Modal>
    </div>
  );
}
