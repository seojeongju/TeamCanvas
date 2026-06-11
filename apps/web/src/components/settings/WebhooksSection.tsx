import { useState } from "react";
import { Plus, Trash2, Webhook } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateOrgWebhook,
  useDeleteOrgWebhook,
  useOrgWebhooks,
  useUpdateOrgWebhook,
} from "../../hooks/useOrgSettings";

const EVENT_LABELS: Record<string, string> = {
  "event.created": "일정 생성",
  "task.assigned": "업무 배정",
  "task.completed": "업무 완료",
};

export function WebhooksSection() {
  const { data, isLoading } = useOrgWebhooks();
  const createWebhook = useCreateOrgWebhook();
  const updateWebhook = useUpdateOrgWebhook();
  const deleteWebhook = useDeleteOrgWebhook();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<"slack" | "generic" | "kakaowork">("slack");
  const [events, setEvents] = useState<string[]>(["event.created", "task.assigned"]);

  const webhooks = data?.webhooks ?? [];
  const available = data?.availableEvents ?? [];

  const toggleEvent = (ev: string) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) return;
    await createWebhook.mutateAsync({ name: name.trim(), url: url.trim(), provider, events });
    setName("");
    setUrl("");
  };

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-500">웹훅 불러오는 중…</GlassCard>;
  }

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Webhook className="h-5 w-5 text-primary-500" />
        <div>
          <h3 className="font-semibold text-navy-900">외부 알림 (웹훅)</h3>
          <p className="text-xs text-navy-500">Slack·카카오워크 등으로 팀 알림을 보냅니다.</p>
        </div>
      </div>

      {webhooks.length > 0 && (
        <ul className="mb-4 space-y-2">
          {webhooks.map((wh) => (
            <li
              key={wh.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-sky-100/80 bg-white/70 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-navy-800">{wh.name}</p>
                <p className="truncate text-xs text-navy-500">{wh.url}</p>
                <p className="mt-1 text-[10px] text-navy-400">
                  {wh.provider === "slack"
                    ? "Slack"
                    : wh.provider === "kakaowork"
                      ? "카카오워크"
                      : "일반"}{" "}
                  · {wh.events.map((e) => EVENT_LABELS[e] ?? e).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateWebhook.mutate({ webhookId: wh.id, enabled: !wh.enabled })
                  }
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium ${
                    wh.enabled ? "bg-emerald-50 text-emerald-700" : "bg-navy-100 text-navy-500"
                  }`}
                >
                  {wh.enabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteWebhook.mutate(wh.id)}
                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-xl bg-sky-50/50 p-4">
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 팀 Slack"
        />
        <Input
          label="Webhook URL (https)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/..."
        />
        <div>
          <p className="mb-1 text-xs font-medium text-navy-700">형식</p>
          <select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as "slack" | "generic" | "kakaowork")
            }
            className="w-full rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-sm"
          >
            <option value="slack">Slack Incoming Webhook</option>
            <option value="kakaowork">카카오워크 Incoming Webhook</option>
            <option value="generic">일반 JSON</option>
          </select>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-navy-700">알림 이벤트</p>
          <div className="flex flex-wrap gap-2">
            {available.map((ev) => (
              <button
                key={ev}
                type="button"
                onClick={() => toggleEvent(ev)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  events.includes(ev)
                    ? "bg-primary-400 text-white"
                    : "bg-white text-navy-600 ring-1 ring-sky-200"
                }`}
              >
                {EVENT_LABELS[ev] ?? ev}
              </button>
            ))}
          </div>
        </div>
        <Button
          onClick={handleCreate}
          disabled={createWebhook.isPending || !name.trim() || !url.trim()}
          className="w-full !min-h-10"
        >
          <Plus className="h-4 w-4" />
          웹훅 추가
        </Button>
      </div>
    </GlassCard>
  );
}
