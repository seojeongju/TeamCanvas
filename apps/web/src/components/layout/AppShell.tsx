import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { OrgSwitcher } from "./OrgSwitcher";

export function AppShell() {
  return (
    <div className="bg-mesh mx-auto min-h-dvh max-w-lg">
      <main className="safe-top px-5 pb-28 pt-6">
        <div className="mb-4">
          <OrgSwitcher />
        </div>
        <EmailVerificationBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
