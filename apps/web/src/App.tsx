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
import { MembersPage, BillingPage } from "./pages/settings/MembersPage";
import { AuditLogsPage } from "./pages/settings/AuditLogsPage";
import { NotificationSettingsPage } from "./pages/settings/NotificationSettingsPage";
import { OrgSettingsPage } from "./pages/settings/OrgSettingsPage";
import { TeamsPage } from "./pages/settings/TeamsPage";
import { TeamDetailPage } from "./pages/settings/TeamDetailPage";
import { PermissionsPage } from "./pages/settings/PermissionsPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminOrganizationsPage } from "./pages/admin/AdminOrganizationsPage";
import { AdminOrgDetailPage } from "./pages/admin/AdminOrgDetailPage";
import { AdminPlansPage } from "./pages/admin/AdminPlansPage";

function ProtectedLayout() {
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
        <Route
          path="/onboarding"
          element={
            <AuthOnly>
              <OnboardingPage />
            </AuthOnly>
          }
        />
        <Route element={<ProtectedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="settings/org" element={<OrgSettingsPage />} />
          <Route path="settings/teams" element={<TeamsPage />} />
          <Route path="settings/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="settings/members" element={<MembersPage />} />
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="settings/permissions" element={<PermissionsPage />} />
          <Route path="settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="settings/audit" element={<AuditLogsPage />} />
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
