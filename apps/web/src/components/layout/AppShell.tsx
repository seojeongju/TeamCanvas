import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";

export function AppShell() {
  return (
    <div className="bg-mesh mx-auto min-h-dvh max-w-lg">
      <main className="safe-top px-5 pb-28 pt-6">
        <EmailVerificationBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
