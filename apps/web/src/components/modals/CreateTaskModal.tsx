import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateTask } from "../../hooks/useData";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultStatus?: "todo" | "doing" | "done";
}

export function CreateTaskModal({ open, onClose, defaultStatus = "todo" }: CreateTaskModalProps) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask.mutateAsync({
      title: title.trim(),
      status: defaultStatus,
      dueAt: dueDate ? new Date(dueDate).getTime() : undefined,
    });
    setTitle("");
    setDueDate("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="업무 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="업무 제목"
          placeholder="할 일을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          label="마감일 (선택)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <Button type="submit" fullWidth disabled={createTask.isPending}>
          {createTask.isPending ? "저장 중..." : "업무 저장"}
        </Button>
      </form>
    </Modal>
  );
}
