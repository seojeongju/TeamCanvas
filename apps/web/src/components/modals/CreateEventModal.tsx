import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useCreateEvent, useEventParticipants } from "../../hooks/useData";
import { fromDatetimeLocal, toDatetimeLocal } from "../../lib/dates";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEventModal({ open, onClose }: CreateEventModalProps) {
  const createEvent = useCreateEvent();
  const { data: participantsData } = useEventParticipants();
  const defaultStart = toDatetimeLocal(Date.now() + 3600000);
  const defaultEnd = toDatetimeLocal(Date.now() + 7200000);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [allDay, setAllDay] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "team" | "org">("org");
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createEvent.mutateAsync({
      title: title.trim(),
      startAt: fromDatetimeLocal(start),
      endAt: fromDatetimeLocal(end),
      allDay,
      visibility,
      attendeeUserIds,
      reminderMinutes: [reminderMinutes],
      recurrenceRule:
        recurrence === "none"
          ? null
          : recurrence === "daily"
            ? "FREQ=DAILY"
            : recurrence === "weekly"
              ? "FREQ=WEEKLY"
              : "FREQ=MONTHLY",
    });
    setTitle("");
    setVisibility("org");
    setReminderMinutes(10);
    setAttendeeUserIds([]);
    setRecurrence("none");
    onClose();
  };

  const participants = (participantsData?.participants ?? []).filter((p) => p.id);

  const toggleAttendee = (userId: string) => {
    setAttendeeUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
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
        <label className="block text-sm text-navy-700">
          공유 범위
          <select
            className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "private" | "team" | "org")}
          >
            <option value="private">나만 보기</option>
            <option value="team">팀 공유</option>
            <option value="org">조직 공유</option>
          </select>
        </label>
        <label className="block text-sm text-navy-700">
          알림 시점
          <select
            className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(Number(e.target.value))}
          >
            <option value={10}>10분 전</option>
            <option value={30}>30분 전</option>
            <option value={60}>1시간 전</option>
            <option value={1440}>1일 전</option>
          </select>
        </label>
        <label className="block text-sm text-navy-700">
          반복
          <select
            className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly")}
          >
            <option value="none">반복 없음</option>
            <option value="daily">매일</option>
            <option value="weekly">매주</option>
            <option value="monthly">매월</option>
          </select>
        </label>
        <div>
          <p className="text-sm text-navy-700">공유 대상(참석자)</p>
          <div className="mt-2 max-h-32 space-y-1 overflow-auto rounded-xl border border-sky-100 bg-sky-50/40 p-2">
            {participants.length === 0 ? (
              <p className="text-xs text-navy-500">선택 가능한 멤버가 없습니다.</p>
            ) : (
              participants.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-navy-700">
                  <input
                    type="checkbox"
                    checked={attendeeUserIds.includes(p.id)}
                    onChange={() => toggleAttendee(p.id)}
                    className="h-3.5 w-3.5 rounded accent-primary-400"
                  />
                  <span>{p.name}</span>
                  <span className="text-navy-500">{p.email ?? ""}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <Button type="submit" fullWidth disabled={createEvent.isPending}>
          {createEvent.isPending ? "저장 중..." : "일정 저장"}
        </Button>
      </form>
    </Modal>
  );
}
