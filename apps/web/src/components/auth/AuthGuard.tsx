import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useAuthHydrated, useAuthInit } from "../../hooks/useAuth";

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

export function AuthGuard({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const { data, isFetching, isLoading: queryLoading, isPending } = useAuthInit();
  const hasSession = Boolean(data?.user || user);
  const orgCount = data?.organizations.length ?? organizations.length;

  if (!hydrated || ((queryLoading || isFetching || isPending) && !hasSession)) {
    return <LoadingScreen />;
  }
  if (!hasSession) return <Navigate to="/login" replace />;
  if (orgCount === 0) return <Navigate to="/onboarding" replace />;

  return children;
}

export function AuthOnly({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const { data, isFetching, isLoading: queryLoading, isPending } = useAuthInit();
  const hasSession = Boolean(data?.user || user);

  if (!hydrated || ((queryLoading || isFetching || isPending) && !hasSession)) {
    return <LoadingScreen />;
  }
  if (!hasSession) return <Navigate to="/login" replace />;

  return children;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, isFetching, isLoading: queryLoading, isPending } = useAuthInit();
  const hasSession = Boolean(data?.user || user || isAuthenticated);

  if (!hydrated || ((queryLoading || isFetching || isPending) && !hasSession)) {
    return <LoadingScreen />;
  }
  if (hasSession) return <Navigate to="/" replace />;

  return children;
}
