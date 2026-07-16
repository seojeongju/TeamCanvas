import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useAuthInit } from "../../hooks/useAuth";

function LoadingScreen() {
  return (
    <div className="bg-mesh flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
        <p className="text-sm text-navy-600">로딩 중...</p>
      </div>
    </div>
  );
}

export function PlatformAdminGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const { data, isFetching, isLoading: queryLoading } = useAuthInit();
  const hasSession = Boolean(data?.user || user);
  const hasAdminAccess = Boolean(data?.isPlatformAdmin) || isPlatformAdmin;

  if ((queryLoading || isFetching) && !hasSession) return <LoadingScreen />;
  if (!hasSession) return <Navigate to="/login" replace />;
  if (!hasAdminAccess) return <Navigate to="/" replace />;

  return children;
}
