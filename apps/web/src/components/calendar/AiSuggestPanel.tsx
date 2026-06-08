import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { useSuggestEventTimes } from "../../hooks/useData";
import { cn } from "../../lib/cn";
import type { EventSuggestion } from "../../lib/types";

export function AiSuggestPanel({
  attendeeUserIds,
  durationMinutes,
  onApply,
}: {
  attendeeUserIds: string[];
  durationMinutes: number;
  onApply: (suggestion: EventSuggestion) => void;
}) {
  const suggest = useSuggestEventTimes();
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<EventSuggestion[]>([]);
  const [aiUsed, setAiUsed] = useState(false);

  const handleSuggest = async () => {
    const res = await suggest.mutateAsync({
      prompt: prompt.trim() || "팀 회의",
      durationMinutes,
      attendeeUserIds,
    });
    setResults(res.suggestions);
    setAiUsed(res.aiUsed);
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <p className="text-sm font-medium text-navy-800">AI 일정 제안</p>
      </div>

      <input
        type="text"
        placeholder="예: 다음 주 팀 회의, 1:1 미팅 잡아줘"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm text-navy-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
      />

      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={suggest.isPending}
        onClick={handleSuggest}
      >
        {suggest.isPending ? "분석 중..." : "시간 제안 받기"}
      </Button>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-navy-500">
            {aiUsed ? "Workers AI가 추천한 시간" : "규칙 기반 추천 (AI 미연결 시)"}
          </p>
          {results.map((s, i) => (
            <button
              key={`${s.startAt}-${i}`}
              type="button"
              onClick={() => onApply(s)}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left transition hover:border-violet-300 hover:bg-white",
                i === 0 ? "border-violet-300 bg-white" : "border-sky-100 bg-white/60",
              )}
            >
              <p className="text-sm font-medium text-navy-900">
                {new Date(s.startAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" – "}
                {new Date(s.endAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-0.5 text-xs text-navy-600">{s.reason}</p>
              {s.suggestedTitle && (
                <p className="mt-0.5 text-[10px] text-violet-600">제안 제목: {s.suggestedTitle}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {suggest.isError && (
        <p className="text-xs text-red-500">제안을 가져오지 못했습니다. 다시 시도해 주세요.</p>
      )}
    </div>
  );
}
