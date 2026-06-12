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

  useEffect(() => {
    if (!open) return;
    setName(`${project.name} (복사)`);
    setIncludeTasks(true);
  }, [open, project.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await duplicate.mutateAsync({
      projectId: project.id,
      name: name.trim(),
      includeTasks,
    });
    onClose();
    navigate(`/projects/${result.id}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 복제">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          마일스톤 구조를 복사합니다. 업무는 선택에 따라 미완료 상태로 복제됩니다.
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
          연결된 업무도 함께 복제 (상태는 할 일로 초기화)
        </label>

        <Button type="submit" fullWidth disabled={duplicate.isPending || !name.trim()}>
          {duplicate.isPending ? "복제 중..." : "복제하기"}
        </Button>
      </form>
    </Modal>
  );
}
