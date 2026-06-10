import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AdminShell } from "./components/layout/AdminShell";
import { AuthGuard, GuestGuard, AuthOnly } from "./components/auth/AuthGuard";
import { PlatformAdminGuard } from "./components/auth/PlatformAdminGuard";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { TasksPage } from "./pages/TasksPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { MorePage } from "./pages/MorePage";
import { SearchPage } from "./pages/SearchPage";
import { MembersPage, BillingPage } from "./pages/settings/MembersPage";
import { AuditLogsPage } from "./pages/settings/AuditLogsPage";
import { NotificationSettingsPage } from "./pages/settings/NotificationSettingsPage";
import { OrgSettingsPage } from "./pages/settings/OrgSettingsPage";
import { TeamsPage } from "./pages/settings/TeamsPage";
import { TeamDetailPage } from "./pages/settings/TeamDetailPage";
import { PermissionsPage } from "./pages/settings/PermissionsPage";
import { DepartmentsPage } from "./pages/settings/DepartmentsPage";
import { HolidaysPage } from "./pages/settings/HolidaysPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminOrganizationsPage } from "./pages/admin/AdminOrganizationsPage";
import { AdminOrgDetailPage } from "./pages/admin/AdminOrgDetailPage";
import { AdminPlansPage } from "./pages/admin/AdminPlansPage";
import { AppSettingsPage } from "./pages/settings/AppSettingsPage";
import { PwaInstallBanner } from "./components/layout/PwaInstallBanner";
import { LandingPage } from "./pages/LandingPage";
import { SharedEventPage } from "./pages/SharedEventPage";
import { useAuthInit } from "./hooks/useAuth";
import { useAuthStore } from "./stores/authStore";

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

/** 비로그인 → 랜딩, 로그인 → 앱 셸 */
function AppRoot() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isFetching } = useAuthInit();

  if (isLoading || isFetching) return <LoadingScreen />;
  if (!isAuthenticated) return <LandingPage />;

  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}

function AdminLayout() {
  return (
    <PlatformAdminGuard>
      <AdminShell />
    </PlatformAdminGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PwaInstallBanner />
      <Routes>
        <Route
          path="/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        <Route path="/share/:token" element={<SharedEventPage />} />
        <Route
          path="/onboarding"
          element={
            <AuthOnly>
              <OnboardingPage />
            </AuthOnly>
          }
        />
        <Route element={<AppRoot />}>
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings/org" element={<OrgSettingsPage />} />
          <Route path="settings/departments" element={<DepartmentsPage />} />
          <Route path="settings/holidays" element={<HolidaysPage />} />
          <Route path="settings/teams" element={<TeamsPage />} />
          <Route path="settings/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="settings/members" element={<MembersPage />} />
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/permissions" element={<PermissionsPage />} />
          <Route path="settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="settings/audit" element={<AuditLogsPage />} />
          <Route path="settings/app" element={<AppSettingsPage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="organizations" element={<AdminOrganizationsPage />} />
          <Route path="organizations/:orgId" element={<AdminOrgDetailPage />} />
          <Route path="plans" element={<AdminPlansPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
