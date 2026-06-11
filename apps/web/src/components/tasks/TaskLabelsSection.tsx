import { LabelPillPicker } from "../ui/LabelPillPicker";
import {
  useCreateTaskLabel,
  useDeleteTaskLabel,
  useTaskLabels,
  useUpdateTask,
} from "../../hooks/useData";
import type { Task } from "../../lib/types";

export function TaskLabelsSection({ task }: { task: Task }) {
  const { data: labelsData } = useTaskLabels();
  const createLabel = useCreateTaskLabel();
  const deleteLabel = useDeleteTaskLabel();
  const updateTask = useUpdateTask();

  const allLabels = labelsData?.labels ?? [];
  const taskLabelIds = (task.labels ?? []).map((l) => l.id);

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <LabelPillPicker
        labels={allLabels}
        selectedIds={taskLabelIds}
        onChange={(ids) => updateTask.mutate({ id: task.id, labelIds: ids })}
        onCreateLabel={(data) => createLabel.mutateAsync(data)}
        onDeleteLabel={(labelId) => deleteLabel.mutateAsync(labelId)}
        isCreating={createLabel.isPending}
        isDeleting={deleteLabel.isPending}
        emptyMessage="라벨을 만들어 업무를 분류하세요."
      />
    </div>
  );
}
