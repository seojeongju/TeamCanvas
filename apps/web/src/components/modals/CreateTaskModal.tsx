import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateTask, useTeams } from "../../hooks/useData";
import { useOrgMembers } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import { PRIORITY_OPTIONS } from "../../lib/taskUtils";
import type { TaskPriority, TaskStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultStatus?: TaskStatus;
}

export function CreateTaskModal({ open, onClose, defaultStatus = "todo" }: CreateTaskModalProps) {
  const createTask = useCreateTask();
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

  const members = membersData?.members ?? [];
  const teams = teamsData?.teams ?? [];

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setAssigneeId(userId ?? "");
    }
  }, [open, defaultStatus, userId]);

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
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssigneeId(userId ?? "");
    setPriority("medium");
    setTeamId("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="프로젝트 제목"
          placeholder="할 일을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-navy-700">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="프로젝트 설명"
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
          {createTask.isPending ? "저장 중..." : "프로젝트 저장"}
        </Button>
      </form>
    </Modal>
  );
}
