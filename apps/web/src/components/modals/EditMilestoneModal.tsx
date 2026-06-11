import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useUpdateProjectMilestone } from "../../hooks/useData";
import { MILESTONE_STATUS_OPTIONS, toDateInputValue, parseDateInputEnd } from "../../lib/projectUtils";
import { cn } from "../../lib/cn";
import type { MilestoneStatus, ProjectMilestone } from "../../lib/types";

const selectClass =
  "w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

type Props = {
  milestone: ProjectMilestone | null;
  onClose: () => void;
};

export function EditMilestoneModal({ milestone, onClose }: Props) {
  const updateMilestone = useUpdateProjectMilestone();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("pending");

  useEffect(() => {
    if (!milestone) return;
    setTitle(milestone.title);
    setDescription(milestone.description ?? "");
    setDueDate(toDateInputValue(milestone.dueAt));
    setStatus(milestone.status);
  }, [milestone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestone || !title.trim()) return;

    await updateMilestone.mutateAsync({
      milestoneId: milestone.id,
      projectId: milestone.projectId,
      title: title.trim(),
      description: description.trim() || null,
      dueAt: dueDate ? parseDateInputEnd(dueDate) : null,
      status,
    });
    onClose();
  };

  return (
    <Modal open={!!milestone} onClose={onClose} title="마일스톤 수정">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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

        <Input
          label="마감일 (선택)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
            className={selectClass}
          >
            {MILESTONE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" fullWidth disabled={updateMilestone.isPending || !title.trim()}>
          {updateMilestone.isPending ? "저장 중..." : "변경 사항 저장"}
        </Button>
      </form>
    </Modal>
  );
}
