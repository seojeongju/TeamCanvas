import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateEvent } from "../../hooks/useData";
import { fromDatetimeLocal, toDatetimeLocal } from "../../lib/dates";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEventModal({ open, onClose }: CreateEventModalProps) {
  const createEvent = useCreateEvent();
  const defaultStart = toDatetimeLocal(Date.now() + 3600000);
  const defaultEnd = toDatetimeLocal(Date.now() + 7200000);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [allDay, setAllDay] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createEvent.mutateAsync({
      title: title.trim(),
      startAt: fromDatetimeLocal(start),
      endAt: fromDatetimeLocal(end),
      allDay,
    });
    setTitle("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="일정 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="제목"
          placeholder="회의, 마감, 이벤트..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded accent-primary-400"
          />
          종일 일정
        </label>
        {!allDay && (
          <>
            <Input
              label="시작"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Input
              label="종료"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}
        <Button type="submit" fullWidth disabled={createEvent.isPending}>
          {createEvent.isPending ? "저장 중..." : "일정 저장"}
        </Button>
      </form>
    </Modal>
  );
}
