import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Link2, Unlink } from "lucide-react";
import { Button } from "../ui/Button";
import { useEvents, useUpdateTask } from "../../hooks/useData";
import { formatEventTimeRange } from "../../lib/dates";
import type { Task } from "../../lib/types";

export function TaskLinkedEventSection({ task }: { task: Task }) {
  const navigate = useNavigate();
  const updateTask = useUpdateTask();
  const [pickerOpen, setPickerOpen] = useState(false);

  const now = Date.now();
  const from = now - 30 * 86400000;
  const to = now + 90 * 86400000;
  const { data: eventsData } = useEvents(from, to);

  const linkableEvents = useMemo(
    () =>
      (eventsData?.events ?? []).filter(
        (e) => e.sourceType === "event" && e.id !== task.linkedEvent?.id,
      ),
    [eventsData?.events, task.linkedEvent?.id],
  );

  const linked = task.linkedEvent;

  const handleLink = async (eventId: string) => {
    await updateTask.mutateAsync({ id: task.id, eventId });
    setPickerOpen(false);
  };

  const handleUnlink = async () => {
    if (!window.confirm("연결된 일정을 해제할까요?")) return;
    await updateTask.mutateAsync({ id: task.id, eventId: null });
  };

  return (
    <div className="rounded-2xl border border-sky-100/80 bg-sky-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-navy-800">연결된 일정</h3>
      </div>

      {linked ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate(`/calendar?event=${encodeURIComponent(linked.id)}`)}
            className="flex w-full items-start gap-2 rounded-xl bg-white/80 px-3 py-2 text-left hover:bg-white"
          >
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-800">{linked.title}</p>
              <p className="text-xs text-navy-500">
                {formatEventTimeRange(linked.startAt, linked.endAt, linked.allDay)}
              </p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            className="!min-h-9 w-full text-navy-600"
            onClick={handleUnlink}
            disabled={updateTask.isPending}
          >
            <Unlink className="h-4 w-4" />
            연결 해제
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-navy-500">관련 일정을 연결하면 캘린더에서 함께 확인할 수 있습니다.</p>
          {!pickerOpen ? (
            <Button
              type="button"
              variant="secondary"
              className="!min-h-9 w-full"
              onClick={() => setPickerOpen(true)}
            >
              <Link2 className="h-4 w-4" />
              일정 연결
            </Button>
          ) : (
            <div className="space-y-2">
              <select
                className="w-full rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-sm text-navy-800"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) void handleLink(e.target.value);
                }}
                disabled={updateTask.isPending}
              >
                <option value="">일정 선택…</option>
                {linkableEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {formatEventTimeRange(e.startAt, e.endAt, e.allDay)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                className="!min-h-8 w-full text-xs"
                onClick={() => setPickerOpen(false)}
              >
                취소
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
