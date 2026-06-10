import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import type { PwaInstallPlatform } from "../../lib/pwaInstall";

interface PwaInstallPanelProps {
  variant?: "banner" | "card";
  platform: PwaInstallPlatform;
  canNativeInstall: boolean;
  installed: boolean;
  onInstall: () => void;
  onDismiss?: () => void;
  installPending?: boolean;
}

export function PwaInstallPanel({
  variant = "card",
  platform,
  canNativeInstall,
  installed,
  onInstall,
  onDismiss,
  installPending,
}: PwaInstallPanelProps) {
  if (installed) {
    return (
      <GlassCard className={cn("p-4", variant === "banner" && "shadow-soft")}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
            <Smartphone className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">앱이 설치되어 있습니다</p>
            <p className="text-xs text-navy-600">홈 화면 또는 앱 목록에서 TeamCanvas를 실행 중입니다.</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const isBanner = variant === "banner";

  return (
    <GlassCard
      className={cn(
        "p-4",
        isBanner && "border border-primary-200/80 bg-white/95 shadow-glow backdrop-blur-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-400/15">
          <Download className="h-5 w-5 text-primary-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-900">TeamCanvas 앱 설치</p>
          <p className="mt-0.5 text-xs leading-relaxed text-navy-600">
            설치하면 홈 화면에서 바로 열고, 더 빠르게 알림을 받을 수 있습니다.
          </p>

          {platform === "ios" && (
            <ol className="mt-3 space-y-1.5 text-xs text-navy-700">
              <li className="flex items-center gap-2">
                <Share className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                <span>
                  Safari 하단 <strong>공유</strong> 버튼 탭
                </span>
              </li>
              <li>
                <strong>홈 화면에 추가</strong> 선택 후 추가
              </li>
            </ol>
          )}

          {platform === "other" && !canNativeInstall && (
            <p className="mt-3 text-xs text-navy-600">
              Chrome 또는 Edge 주소창의 <strong>설치</strong> 아이콘(⊕)을 눌러 앱을 추가하세요.
            </p>
          )}

          <div className={cn("mt-3 flex flex-wrap gap-2", isBanner && "items-center")}>
            {canNativeInstall && (
              <Button
                type="button"
                className="!min-h-9 !px-4 !py-2 text-sm"
                onClick={onInstall}
                disabled={installPending}
              >
                {installPending ? "설치 중..." : "지금 설치"}
              </Button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl px-3 py-2 text-xs font-medium text-navy-500 transition hover:bg-sky-50 hover:text-navy-700"
              >
                나중에
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
