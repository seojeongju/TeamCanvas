import { Bell, Webhook, Zap } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import {
  useAutomationPresets,
  useUpdateAutomationPreset,
} from "../../hooks/useOrgSettings";
import { cn } from "../../lib/cn";
import type { AutomationPreset } from "../../lib/types";

function PresetToggle({
  preset,
  onToggle,
  disabled,
}: {
  preset: AutomationPreset;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-sky-100/80 bg-white/70 p-3">
      <div className="min-w-0">
        <p className="font-medium text-navy-800">{preset.name}</p>
        <p className="mt-0.5 text-xs text-navy-500">{preset.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={preset.enabled}
        disabled={disabled}
        onClick={() => onToggle(!preset.enabled)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition",
          preset.enabled ? "bg-primary-400" : "bg-navy-200",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            preset.enabled ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function AutomationPresetsSection() {
  const { data, isLoading } = useAutomationPresets();
  const update = useUpdateAutomationPreset();

  const presets = data?.presets ?? [];
  const notifications = presets.filter((p) => p.category === "notification");
  const webhooks = presets.filter((p) => p.category === "webhook");

  const handleToggle = (key: string, enabled: boolean) => {
    update.mutate({ key, enabled });
  };

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-500">자동화 규칙 불러오는 중…</GlassCard>;
  }

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary-500" />
        <div>
          <h3 className="font-semibold text-navy-900">자동화 프리셋</h3>
          <p className="text-xs text-navy-500">
            자주 쓰는 알림·웹훅 규칙을 켜고 끌 수 있습니다.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-600">
            <Bell className="h-3.5 w-3.5" />
            인앱·푸시 알림
          </div>
          <div className="space-y-2">
            {notifications.map((preset) => (
              <PresetToggle
                key={preset.key}
                preset={preset}
                disabled={update.isPending}
                onToggle={(enabled) => handleToggle(preset.key, enabled)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-600">
            <Webhook className="h-3.5 w-3.5" />
            외부 웹훅 (Slack·카카오워크)
          </div>
          <p className="mb-2 text-[10px] text-navy-400">
            아래 웹훅 연동 설정과 함께 사용합니다.
          </p>
          <div className="space-y-2">
            {webhooks.map((preset) => (
              <PresetToggle
                key={preset.key}
                preset={preset}
                disabled={update.isPending}
                onToggle={(enabled) => handleToggle(preset.key, enabled)}
              />
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
