import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import { useAdminCreateOrganization, useAdminOrganizations } from "../../hooks/useAdmin";
import { ORG_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "../../lib/adminLabels";
import { cn } from "../../lib/cn";

const statusTone: Record<string, string> = {
  active: "text-emerald-600",
  trialing: "text-primary-600",
  past_due: "text-amber-600",
  canceled: "text-red-500",
  suspended: "text-navy-500",
};

export function AdminOrganizationsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const { data, isLoading } = useAdminOrganizations(search);
  const createOrg = useAdminCreateOrganization();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="space-y-6">
      <PageHeader title="조직 관리" subtitle="전체 테넌트 목록" />

      <GlassCard className="space-y-2 p-4 text-xs">
        <p className="font-semibold text-navy-900">운영 안내</p>
        <p className="text-navy-600">
          조직을 선택하면 플랜·멤버·소유자를 관리할 수 있습니다. 유료 플랜은 고객 문의 확인 후
          조직 상세에서 적용하세요.
        </p>
      </GlassCard>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-600/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="조직명·슬러그 검색"
            className="pl-9"
          />
        </div>
        <Button type="submit">검색</Button>
      </form>

      <GlassCard className="space-y-3 p-4">
        <p className="text-sm font-semibold text-navy-900">조직 생성</p>
        <p className="text-xs text-navy-600">소유자 이메일은 가입된 계정이어야 합니다.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="조직 이름"
            label="조직 이름"
          />
          <Input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@example.com"
            label="소유자 이메일"
          />
        </div>
        <Button
          type="button"
          disabled={createOrg.isPending || !newOrgName.trim() || !ownerEmail.trim()}
          onClick={async () => {
            try {
              await createOrg.mutateAsync({ name: newOrgName.trim(), ownerEmail: ownerEmail.trim() });
              setNewOrgName("");
              setOwnerEmail("");
              setToast({ tone: "info", message: "조직을 생성했습니다." });
            } catch (err) {
              setToast({
                tone: "error",
                message: err instanceof Error ? err.message : "조직 생성 실패",
              });
            }
          }}
        >
          {createOrg.isPending ? "생성 중…" : "조직 생성"}
        </Button>
      </GlassCard>

      {isLoading ? (
        <p className="text-sm text-navy-600">불러오는 중…</p>
      ) : (data?.organizations ?? []).length === 0 ? (
        <p className="text-sm text-navy-600">조직이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {(data?.organizations ?? []).map((org) => (
            <Link key={org.id} to={`/admin/organizations/${org.id}`}>
              <GlassCard className="flex items-center gap-4 p-4 transition hover:shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900">{org.name}</p>
                  <p className="text-xs text-navy-600">
                    {org.slug} · 멤버 {org.member_count}명 ·{" "}
                    {ORG_STATUS_LABELS[org.status ?? "active"] ?? org.status}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium text-navy-800">{org.plan_name ?? "—"}</p>
                  <p
                    className={cn(
                      statusTone[org.subscription_status ?? ""] ?? "text-navy-600",
                    )}
                  >
                    {SUBSCRIPTION_STATUS_LABELS[org.subscription_status ?? ""] ??
                      org.subscription_status ??
                      "—"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-navy-600/30" />
              </GlassCard>
            </Link>
          ))}
        </div>
      )}

      {toast && (
        <ToastMessage message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
