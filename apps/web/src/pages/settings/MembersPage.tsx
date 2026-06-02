import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, CreditCard } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useOrgMembers, useInviteOrgMember } from "../../hooks/useAdmin";
import { useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import { useCurrentOrgId } from "../../stores/orgStore";

const roleLabels: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

export function MembersPage() {
  const navigate = useNavigate();
  const canManage = useHasPermission("members:manage");
  const { data, isLoading } = useOrgMembers();
  const invite = useInviteOrgMember();
  const [email, setEmail] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role: "member" });
      setEmail("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "초대 실패");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="멤버 관리"
        subtitle={data?.limits ? `${data.limits.current} / ${data.limits.limit}명` : undefined}
      />

      {canManage && (
        <GlassCard className="p-4">
          <form onSubmit={handleInvite} className="space-y-3">
            <label className="text-sm font-medium text-navy-800">이메일로 초대</label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
              />
              <Button type="submit" disabled={invite.isPending}>
                초대
              </Button>
            </div>
            <p className="text-xs text-navy-600">가입된 이메일만 초대할 수 있습니다.</p>
          </form>
        </GlassCard>
      )}

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="space-y-2">
          {(data?.members ?? []).map((m) => (
            <GlassCard key={m.user_id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10">
                <Users className="h-5 w-5 text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{m.name}</p>
                <p className="truncate text-xs text-navy-600">{m.email}</p>
              </div>
              <span className="rounded-full bg-navy-800/5 px-2 py-1 text-xs font-medium text-navy-700">
                {roleLabels[m.role] ?? m.role}
              </span>
            </GlassCard>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/settings/billing")}
        className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
      >
        <CreditCard className="h-5 w-5 text-primary-500" />
        <span className="text-sm font-medium text-navy-900">구독 · 플랜 보기</span>
      </button>
    </div>
  );
}

export function BillingPage() {
  const orgId = useCurrentOrgId();
  const org = useAuthStore((s) => s.organizations.find((o) => o.id === orgId));
  const sub = org?.subscription;

  return (
    <div className="space-y-6">
      <PageHeader title="구독 · 플랜" subtitle="조직 요금제 및 기능" />

      <GlassCard className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-500" />
          <h2 className="font-semibold text-navy-900">{sub?.planName ?? "Free"}</h2>
        </div>
        <p className="text-sm text-navy-600">상태: {sub?.status ?? "active"}</p>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-600">
            포함 기능
          </p>
          <div className="flex flex-wrap gap-1">
            {(sub?.features ?? ["calendar", "tasks"]).map((f) => (
              <span
                key={f}
                className="rounded-full bg-primary-400/10 px-2 py-1 text-xs text-primary-600"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-navy-600">
          결제 연동(Stripe 등)은 추후 Phase에서 연결됩니다. 플랜 변경은 플랫폼 관리자에게 문의하세요.
        </p>
      </GlassCard>
    </div>
  );
}
