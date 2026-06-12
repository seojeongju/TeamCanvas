import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import {
  DASHBOARD_WIDGET_LABELS,
  moveDashboardWidget,
  resetDashboardWidgetPrefs,
  toggleDashboardWidgetHidden,
  type DashboardWidgetId,
  type DashboardWidgetPrefs,
} from "../../lib/dashboardWidgetPrefs";
import { cn } from "../../lib/cn";

type Props = {
  open: boolean;
  prefs: DashboardWidgetPrefs;
  onClose: () => void;
  onChange: (prefs: DashboardWidgetPrefs) => void;
};

export function DashboardWidgetSettingsModal({ open, prefs, onClose, onChange }: Props) {
  const hidden = new Set(prefs.hidden);

  const handleToggle = (id: DashboardWidgetId) => {
    onChange(toggleDashboardWidgetHidden(prefs, id));
  };

  const handleMove = (id: DashboardWidgetId, direction: "up" | "down") => {
    onChange(moveDashboardWidget(prefs, id, direction));
  };

  const handleReset = () => {
    onChange(resetDashboardWidgetPrefs());
  };

  return (
    <Modal open={open} onClose={onClose} title="홈 위젯 설정">
      <div className="space-y-4 px-6 pb-6">
        <p className="text-sm text-navy-600">
          표시할 위젯을 선택하고 순서를 조정하세요. 설정은 이 기기에 저장됩니다.
        </p>

        <ul className="space-y-2">
          {prefs.order.map((id, index) => {
            const visible = !hidden.has(id);
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5",
                  visible ? "border-sky-100/80 bg-white/70" : "border-transparent bg-navy-50/50",
                )}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => handleToggle(id)}
                    className="h-4 w-4 rounded border-sky-200 text-primary-500"
                  />
                  <span className={cn("text-sm font-medium", visible ? "text-navy-900" : "text-navy-500")}>
                    {DASHBOARD_WIDGET_LABELS[id]}
                  </span>
                </label>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(id, "up")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-500 hover:bg-sky-50 disabled:opacity-30"
                    aria-label="위로"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === prefs.order.length - 1}
                    onClick={() => handleMove(id, "down")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-navy-500 hover:bg-sky-50 disabled:opacity-30"
                    aria-label="아래로"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" className="!min-h-10" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            기본값으로
          </Button>
          <Button className="!min-h-10 flex-1" onClick={onClose}>
            완료
          </Button>
        </div>
      </div>
    </Modal>
  );
}
