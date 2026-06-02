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
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const { isFetching, isError } = useAuthInit();

  if (isLoading || isFetching) return <LoadingScreen />;
  if (isError || !isAuthenticated) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return children;
}
