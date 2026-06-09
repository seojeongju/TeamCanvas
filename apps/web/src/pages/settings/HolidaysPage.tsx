import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useHolidays, useCreateHoliday, useDeleteHoliday } from "../../hooks/useOrgSettings";
import { useHasPermission } from "../../hooks/usePermissions";

export function HolidaysPage() {
  const canEdit = useHasPermission("org:settings");
  const { data, isLoading } = useHolidays();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [yearly, setYearly] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date.trim()) return;
    try {
      await createHoliday.mutateAsync({ name: name.trim(), date: date.trim(), yearly });
      setName("");
      setDate("");
      setShowCreate(false);
      setToast({ tone: "info", message: "휴일을 추가했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "추가 실패" });
    }
  };

  const handleDelete = async (id: string, holidayName: string) => {
    if (!confirm(`「${holidayName}」 휴일을 삭제할까요?`)) return;
    try {
      await deleteHoliday.mutateAsync(id);
      setToast({ tone: "info", message: "휴일을 삭제했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "삭제 실패" });
    }
  };

  const holidays = data?.holidays ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="휴일 캘린더"
        subtitle="조직 공휴일·기념일"
        action={
          canEdit ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-primary-600"
            >
              <Plus className="h-4 w-4" />
              휴일 추가
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <GlassCard className="p-4 text-sm text-navy-600">불러오는 중...</GlassCard>
      ) : holidays.length === 0 ? (
        <GlassCard className="p-6 text-center text-sm text-navy-600">등록된 휴일이 없습니다.</GlassCard>
      ) : (
        <div className="space-y-2">
          {holidays.map((h) => (
            <GlassCard key={h.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{h.name}</p>
                <p className="text-xs text-navy-600">
                  {h.date} {h.yearly ? "· 매년 반복" : "· 1회"}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(h.id, h.name)}
                  className="text-red-500"
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="휴일 추가">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 설날"
            required
          />
          <Input
            label={yearly ? "날짜 (MM-DD)" : "날짜 (YYYY-MM-DD)"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder={yearly ? "01-01" : "2026-01-01"}
            required
          />
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              checked={yearly}
              onChange={(e) => setYearly(e.target.checked)}
              className="rounded"
            />
            매년 반복
          </label>
          <Button type="submit" disabled={createHoliday.isPending} className="w-full">
            {createHoliday.isPending ? "추가 중..." : "추가"}
          </Button>
        </form>
      </Modal>

      {toast && <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
