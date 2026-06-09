import { useState } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useTaskChecklist,
  useUpdateChecklistItem,
} from "../../hooks/useData";
import { cn } from "../../lib/cn";

export function TaskChecklistSection({ taskId }: { taskId: string }) {
  const { data } = useTaskChecklist(taskId);
  const create = useCreateChecklistItem();
  const update = useUpdateChecklistItem();
  const remove = useDeleteChecklistItem();
  const [newTitle, setNewTitle] = useState("");

  const items = data?.items ?? [];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-navy-600" />
        <h3 className="text-sm font-semibold text-navy-800">
          체크리스트 {items.length > 0 ? `${doneCount}/${items.length}` : ""}
        </h3>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-xl bg-sky-50/80 px-2 py-1.5">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() =>
                update.mutate({ taskId, itemId: item.id, done: !item.done })
              }
              className="h-4 w-4 rounded border-sky-300 text-primary-500"
            />
            <span
              className={cn(
                "min-w-0 flex-1 text-sm text-navy-800",
                item.done && "text-navy-500 line-through",
              )}
            >
              {item.title}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate({ taskId, itemId: item.id })}
              className="rounded-lg p-1 text-red-500 hover:bg-red-50"
              aria-label="항목 삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          await create.mutateAsync({ taskId, title: newTitle.trim() });
          setNewTitle("");
        }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="체크리스트 항목 추가"
          className="flex-1"
        />
        <Button type="submit" disabled={create.isPending || !newTitle.trim()} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
