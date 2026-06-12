import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useConvertTaskToProject } from "../../hooks/useData";
import type { Task } from "../../lib/types";

type Props = {
  task: Task | null;
  onClose: () => void;
  onConverted?: (projectId: string) => void;
};

export function ConvertTaskToProjectModal({ task, onClose, onConverted }: Props) {
  const convert = useConvertTaskToProject();
  const [name, setName] = useState("");
  const [includeChecklist, setIncludeChecklist] = useState(true);

  useEffect(() => {
    if (!task) return;
    setName(task.title);
    setIncludeChecklist(true);
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !name.trim()) return;

    const result = await convert.mutateAsync({
      taskId: task.id,
      name: name.trim(),
      includeChecklistAsMilestones: includeChecklist,
    });
    onClose();
    onConverted?.(result.projectId);
  };

  return (
    <Modal open={!!task} onClose={onClose} title="프로젝트로 전환">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          이 업무를 새 프로젝트로 승격합니다. 업무는 프로젝트에 연결된 상태로 유지되며, 설명·팀·마감일이
          프로젝트에 반영됩니다.
        </p>

        <Input
          label="프로젝트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <label className="flex items-start gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={includeChecklist}
            onChange={(e) => setIncludeChecklist(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-sky-200 text-primary-500"
          />
          <span>
            체크리스트를 마일스톤으로 변환
            <span className="mt-0.5 block text-xs text-navy-500">체크리스트 항목이 있을 때만 적용됩니다.</span>
          </span>
        </label>

        <Button type="submit" fullWidth disabled={convert.isPending || !name.trim()}>
          {convert.isPending ? "전환 중..." : "프로젝트 생성"}
        </Button>
      </form>
    </Modal>
  );
}
