import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { useAdminCreateOrganization, useAdminOrganizations } from "../../hooks/useAdmin";

const statusColors: Record<string, string> = {
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
  const { data, isLoading } = useAdminOrganizations(search);
  const createOrg = useAdminCreateOrganization();

  return (
    <div className="space-y-6">
      <PageHeader title="조직 관리" subtitle="전체 테넌트 목록" />

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
        <button
          type="submit"
          className="rounded-xl bg-primary-400 px-4 text-sm font-medium text-white"
        >
          검색
        </button>
      </form>

      <GlassCard className="space-y-3 p-4">
        <p className="text-sm font-semibold text-navy-900">조직 생성 (플랫폼 관리자)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="새 조직 이름"
          />
          <Input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="소유자 이메일(필수)"
          />
        </div>
        <button
          type="button"
          disabled={createOrg.isPending || !newOrgName.trim() || !ownerEmail.trim()}
          onClick={async () => {
            try {
              await createOrg.mutateAsync({ name: newOrgName.trim(), ownerEmail: ownerEmail.trim() });
              setNewOrgName("");
              setOwnerEmail("");
            } catch (err) {
              alert(err instanceof Error ? err.message : "조직 생성 실패");
            }
          }}
          className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createOrg.isPending ? "생성 중..." : "조직 생성"}
        </button>
      </GlassCard>

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="space-y-2">
          {(data?.organizations ?? []).map((org) => (
            <Link key={org.id} to={`/admin/organizations/${org.id}`}>
              <GlassCard className="flex items-center gap-4 p-4 transition hover:shadow-soft">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-900 truncate">{org.name}</p>
                  <p className="text-xs text-navy-600">
                    {org.slug} · 멤버 {org.member_count}명
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium text-navy-800">{org.plan_name ?? "—"}</p>
                  <p className={statusColors[org.subscription_status ?? ""] ?? "text-navy-600"}>
                    {org.subscription_status ?? "—"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-navy-600/30" />
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
