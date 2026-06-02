import { useAuthStore } from "../../stores/authStore";
import { useOrgStore } from "../../stores/orgStore";
import { ChevronDown, Building2 } from "lucide-react";
import { useState } from "react";

export function OrgSwitcher() {
  const organizations = useAuthStore((s) => s.organizations);
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const [open, setOpen] = useState(false);

  if (organizations.length <= 1) {
    const org = organizations[0];
    if (!org) return null;
    return (
      <div className="flex items-center gap-2 text-sm text-navy-600">
        <Building2 className="h-4 w-4 text-primary-500" />
        <span className="font-medium text-navy-800">{org.name}</span>
        {org.subscription && (
          <span className="rounded-full bg-primary-400/10 px-2 py-0.5 text-xs text-primary-600">
            {org.subscription.planName}
          </span>
        )}
      </div>
    );
  }

  const current = organizations.find((o) => o.id === currentOrgId) ?? organizations[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
      >
        <Building2 className="h-4 w-4 text-primary-500" />
        <span className="font-medium text-navy-900">{current?.name}</span>
        <ChevronDown className="h-4 w-4 text-navy-600/50" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="glass-strong absolute left-0 z-40 mt-2 min-w-[220px] overflow-hidden rounded-xl shadow-soft">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setCurrentOrgId(org.id);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-primary-400/5"
              >
                <span className="font-medium text-navy-900">{org.name}</span>
                <span className="text-xs text-navy-600">
                  {org.role} · {org.subscription?.planName ?? "Free"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
