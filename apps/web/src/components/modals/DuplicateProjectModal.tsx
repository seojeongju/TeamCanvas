import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useDuplicateProject } from "../../hooks/useData";
import type { Project } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export function DuplicateProjectModal({ open, onClose, project }: Props) {
  const navigate = useNavigate();
  const duplicate = useDuplicateProject();
  const [name, setName] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeSchedules, setIncludeSchedules] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(`${project.name} (복사)`);
    setIncludeTasks(true);
    setIncludeSchedules(true);
  }, [open, project.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await duplicate.mutateAsync({
      projectId: project.id,
      name: name.trim(),
      includeTasks,
      includeMilestones: true,
      includeSchedules,
    });
    onClose();
    navigate(`/projects/${result.id}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 복제">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          마일스톤·업무·하위 업무·체크리스트·의존 관계를 복사합니다. 업무 상태는 할 일로 초기화됩니다.
        </p>

        <Input
          label="새 프로젝트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={includeTasks}
            onChange={(e) => setIncludeTasks(e.target.checked)}
            className="h-4 w-4 rounded border-sky-200"
          />
          업무·체크리스트·하위 업무 포함
        </label>

        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={includeSchedules}
            onChange={(e) => setIncludeSchedules(e.target.checked)}
            className="h-4 w-4 rounded border-sky-200"
            disabled={!includeTasks}
          />
          연결된 일정(캘린더) 포함
        </label>

        <Button type="submit" fullWidth disabled={duplicate.isPending || !name.trim()}>
          {duplicate.isPending ? "복제 중..." : "복제하기"}
        </Button>
      </form>
    </Modal>
  );
}
