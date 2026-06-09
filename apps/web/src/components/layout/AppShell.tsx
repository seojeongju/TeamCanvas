import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { SessionActivityRefresher } from "../auth/SessionActivityRefresher";
import { SessionExpiryBanner } from "../auth/SessionExpiryBanner";
import { SubscriptionStatusBanner } from "../auth/SubscriptionStatusBanner";
import { OrgDeletionBanner } from "../auth/OrgDeletionBanner";
import { AppHeader } from "./AppHeader";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell() {
  return (
    <div className="bg-mesh mx-auto min-h-dvh w-full max-w-lg">
      <SessionActivityRefresher />
      <main className="safe-top px-5 pb-28 pt-6">
        <AppHeader />
        <OfflineBanner />
        <EmailVerificationBanner />
        <SessionExpiryBanner />
        <SubscriptionStatusBanner />
        <OrgDeletionBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
