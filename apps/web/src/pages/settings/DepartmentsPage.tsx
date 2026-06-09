import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  useDepartments,
  useCreateDepartment,
  useDeleteDepartment,
} from "../../hooks/useOrgSettings";
import { useHasPermission } from "../../hooks/usePermissions";

export function DepartmentsPage() {
  const canEdit = useHasPermission("org:settings");
  const { data, isLoading } = useDepartments();
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createDept.mutateAsync({ name: name.trim() });
      setName("");
      setShowCreate(false);
      setToast({ tone: "info", message: "부서를 추가했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "생성 실패" });
    }
  };

  const handleDelete = async (deptId: string, deptName: string) => {
    if (!confirm(`「${deptName}」 부서를 삭제할까요?`)) return;
    try {
      await deleteDept.mutateAsync(deptId);
      setToast({ tone: "info", message: "부서를 삭제했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "삭제 실패" });
    }
  };

  const departments = data?.departments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="부서 관리"
        subtitle={`${departments.length}개 부서`}
        action={
          canEdit ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600"
            >
              <Plus className="h-4 w-4" />
              부서 추가
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : departments.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-navy-600">등록된 부서가 없습니다.</p>
          <p className="mt-1 text-xs text-navy-500">팀 생성 시 부서를 지정할 수 있습니다.</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <GlassCard key={dept.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{dept.name}</p>
                <p className="text-xs text-navy-600">팀 {dept.teamCount}개</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(dept.id, dept.name)}
                  disabled={deleteDept.isPending}
                  className="text-red-500"
                  aria-label="부서 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="부서 추가">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="부서 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 개발본부"
            required
            autoFocus
          />
          <Button type="submit" disabled={createDept.isPending} className="w-full">
            {createDept.isPending ? "추가 중..." : "추가"}
          </Button>
        </form>
      </Modal>

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
