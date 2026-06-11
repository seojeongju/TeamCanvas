import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { LabelPillPicker } from "../ui/LabelPillPicker";
import {
  useCreateTask,
  useCreateTaskLabel,
  useDeleteTaskLabel,
  useTaskLabels,
  useTeams,
} from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import { PRIORITY_OPTIONS } from "../../lib/taskUtils";
import type { TaskPriority, TaskStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultStatus?: TaskStatus;
  defaultProjectId?: string | null;
  defaultTeamId?: string | null;
}

export function CreateTaskModal({
  open,
  onClose,
  defaultStatus = "todo",
  defaultProjectId = null,
  defaultTeamId = null,
}: CreateTaskModalProps) {
  const createTask = useCreateTask();
  const { data: labelsData } = useTaskLabels();
  const createLabel = useCreateTaskLabel();
  const deleteLabel = useDeleteTaskLabel();
  const { data: membersData } = useOrgMembers();
  const { data: teamsData } = useTeams();
  const userId = useAuthStore((s) => s.user?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];
  const labels = labelsData?.labels ?? [];

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setAssigneeId(userId ?? "");
      setTeamId(defaultTeamId ?? "");
      setLabelIds([]);
    }
  }, [open, defaultStatus, defaultTeamId, userId]);

  const selectClass =
    "min-h-12 w-full rounded-2xl border border-sky-200/80 bg-white/80 px-4 text-[15px] text-navy-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title: title.trim(),
      status,
      description: description.trim() || undefined,
      dueAt: dueDate ? new Date(dueDate).getTime() : undefined,
      assigneeId: assigneeId || undefined,
      priority,
      teamId: teamId || null,
      projectId: defaultProjectId,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssigneeId(userId ?? "");
    setPriority("medium");
    setTeamId("");
    setLabelIds([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="업무 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <LabelPillPicker
          title="라벨"
          labels={labels}
          selectedIds={labelIds}
          onChange={setLabelIds}
          mode="multiple"
          onCreateLabel={(data) => createLabel.mutateAsync(data)}
          onDeleteLabel={(labelId) => deleteLabel.mutateAsync(labelId)}
          isCreating={createLabel.isPending}
          isDeleting={deleteLabel.isPending}
          emptyMessage="새 라벨을 만들어 업무를 분류하세요."
        />

        <Input
          label="업무 제목"
          placeholder="할 일을 입력하세요"
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
            placeholder="업무 설명"
            className={cn(selectClass, "min-h-[72px] resize-none py-3")}
          />
        </div>

        <Input
          label="마감일 (선택)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">담당자</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
            <option value="">미배정</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">우선순위</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={selectClass}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
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

        <Button type="submit" fullWidth disabled={createTask.isPending}>
          {createTask.isPending ? "저장 중..." : "업무 저장"}
        </Button>
      </form>
    </Modal>
  );
}
