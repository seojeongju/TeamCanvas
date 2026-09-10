import { Download, Monitor } from "lucide-react";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import {
  DESKTOP_APP_VERSION,
  getDesktopDownloadUrl,
  isDesktopShell,
  isLikelyWindows,
} from "../../lib/desktopDownload";

type Props = {
  /** 홈 고정 카드 vs 설정 페이지 */
  compact?: boolean;
};

export function DesktopDownloadCard({ compact = false }: Props) {
  if (isDesktopShell()) return null;

  const href = getDesktopDownloadUrl();
  const onWindows = isLikelyWindows();

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = href;
    link.download = "TeamCanvas-Setup.exe";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <GlassCard className={compact ? "p-4" : "p-4 sm:p-5"}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-800/10">
          <Monitor className="h-5 w-5 text-navy-800" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-900">Windows 데스크톱 앱</p>
          <p className="mt-0.5 text-xs leading-relaxed text-navy-600">
            설치하면 창을 닫아도 트레이에서 계속 실행됩니다. 알림·빠른 실행에 유리합니다.
            {!onWindows && " (Windows PC에서 설치해 주세요.)"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" className="!min-h-9 !px-4 !py-2 text-sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              설치 파일 받기
            </Button>
            <span className="text-[11px] text-navy-500">v{DESKTOP_APP_VERSION} · NSIS · x64</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
