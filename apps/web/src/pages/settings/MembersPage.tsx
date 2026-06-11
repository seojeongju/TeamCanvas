import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, CreditCard, Link2, Copy, ScrollText, X, ChevronRight, Pencil } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { GlassCard } from "../../components/ui/GlassCard";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ToastMessage } from "../../components/ui/ToastMessage";
import {
  useOrgMembers,
  useInviteOrgMember,
  useCreateInviteLink,
  useOrgInvites,
  useRevokeOrgInvite,
  useUpdateOrgMember,
  useRemoveOrgMember,
  useUpdateProfile,
} from "../../hooks/useAdmin";
import { MemberEditModal } from "../../components/settings/MemberEditModal";
import { useHasPermission } from "../../hooks/usePermissions";
import { useAuthStore } from "../../stores/authStore";
import type { OrgInvite, OrgMember } from "../../lib/types";
import { cn } from "../../lib/cn";
import { useCurrentOrgId } from "../../stores/orgStore";

const roleLabels: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  invited: "초대됨",
};

export function MembersPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const orgId = useCurrentOrgId();
  const actorRole =
    useAuthStore((s) => s.organizations.find((o) => o.id === orgId)?.role) ?? "member";
  const canManage = useHasPermission("members:manage");
  const { data, isLoading } = useOrgMembers();
  const updateMember = useUpdateOrgMember();
  const removeMember = useRemoveOrgMember();
  const updateProfile = useUpdateProfile();
  const { data: invitesData } = useOrgInvites();
  const invite = useInviteOrgMember();
  const createLink = useCreateInviteLink();
  const revokeInvite = useRevokeOrgInvite();
  const [email, setEmail] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkDomain, setLinkDomain] = useState("");
  const [inviteType, setInviteType] = useState<"multi" | "single">("multi");
  const [maxUses, setMaxUses] = useState<"unlimited" | "limited">("unlimited");
  const [maxUsesLimit, setMaxUsesLimit] = useState("50");
  const [expiryDays, setExpiryDays] = useState("7");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ email: email.trim(), role: "member" });
      setEmail("");
      setToast({ tone: "info", message: "멤버 초대를 완료했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "초대 실패" });
    }
  };

  const handleCreateLink = async () => {
    try {
      const payload: Parameters<typeof createLink.mutateAsync>[0] = {
        inviteType,
        expiryDays: Number(expiryDays) || 7,
        label: linkLabel.trim() || undefined,
      };
      if (linkEmail.trim()) payload.email = linkEmail.trim();
      if (linkDomain.trim()) payload.emailDomain = linkDomain.trim();
      if (inviteType === "multi") {
        payload.maxUses =
          maxUses === "unlimited" ? null : Math.max(1, Number(maxUsesLimit) || 50);
      }
      const res = await createLink.mutateAsync(payload);
      setLastLink(res.inviteUrl);
      if (res.email?.devLink) setLastLink(res.email.devLink);
      setToast({ tone: "info", message: "팀 초대 링크를 생성했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "링크 생성 실패" });
    }
  };

  const copyToClipboard = async (url: string, message = "초대 링크를 복사했습니다.") => {
    try {
      await navigator.clipboard.writeText(url);
      setToast({ tone: "info", message });
    } catch {
      setToast({ tone: "error", message: "링크 복사에 실패했습니다." });
    }
  };

  const copyLink = () => {
    if (!lastLink) return;
    void copyToClipboard(lastLink);
  };

  const formatRemaining = (expiresAt: number) => {
    const diff = Math.max(0, expiresAt - Date.now());
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `${days}일 ${hours}시간 남음`;
    const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `${minutes}분 남음`;
  };

  const formatUsage = (inv: OrgInvite) => {
    const max = inv.max_uses;
    if (inv.invite_type === "single" || max === 1) {
      return inv.use_count > 0 ? "사용됨" : "1회용 · 미사용";
    }
    if (max === null) return `${inv.use_count}명 / 무제한`;
    return `${inv.use_count}명 / ${max}명`;
  };

  const inviteRestrictionLabel = (inv: OrgInvite) => {
    if (inv.email) return inv.email;
    if (inv.email_domain) return `${inv.email_domain} 도메인`;
    return "제한 없음";
  };

  const canOpenMember = (member: OrgMember) => canManage || member.user_id === currentUser?.id;

  const handleSaveMember = async (payload: { name: string; role?: string; status?: string }) => {
    if (!editingMember) return;
    const isSelf = editingMember.user_id === currentUser?.id;
    try {
      if (isSelf && !canManage) {
        await updateProfile.mutateAsync({ name: payload.name });
      } else {
        await updateMember.mutateAsync({ userId: editingMember.user_id, ...payload });
      }
      setEditingMember(null);
      setToast({ tone: "info", message: "멤버 정보를 저장했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "저장 실패" });
    }
  };

  const handleRemoveMember = async () => {
    if (!editingMember) return;
    if (!window.confirm(`${editingMember.name}님을 조직에서 제거할까요?`)) return;
    try {
      await removeMember.mutateAsync(editingMember.user_id);
      setEditingMember(null);
      setToast({ tone: "info", message: "멤버를 조직에서 제거했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "제거 실패" });
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId);
      setToast({ tone: "info", message: "초대 링크를 비활성화했습니다." });
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "비활성화 실패" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="멤버 관리"
        subtitle={data?.limits ? `${data.limits.current} / ${data.limits.limit}명` : undefined}
      />

      {canManage && (
        <>
          <GlassCard className="space-y-3 p-4">
            <form onSubmit={handleInvite} className="space-y-3">
              <label className="text-sm font-medium text-navy-800">가입된 사용자 초대</label>
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
            </form>
          </GlassCard>

          <GlassCard className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary-500" />
              <label className="text-sm font-medium text-navy-800">팀 초대 링크</label>
            </div>

            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="링크 이름 (예: 2025 신규입사)"
            />

            <div className="flex gap-2">
              {(["multi", "single"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInviteType(type)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-medium transition",
                    inviteType === type
                      ? "bg-primary-400 text-white"
                      : "bg-sky-100/60 text-navy-700",
                  )}
                >
                  {type === "multi" ? "다회용 (팀)" : "1회용 (개인)"}
                </button>
              ))}
            </div>

            {inviteType === "multi" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy-700">사용 횟수</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxUses("unlimited")}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-xs font-medium",
                      maxUses === "unlimited" ? "bg-primary-400/15 text-primary-700" : "bg-navy-800/5",
                    )}
                  >
                    무제한
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaxUses("limited")}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-xs font-medium",
                      maxUses === "limited" ? "bg-primary-400/15 text-primary-700" : "bg-navy-800/5",
                    )}
                  >
                    최대 인원
                  </button>
                </div>
                {maxUses === "limited" && (
                  <Input
                    type="number"
                    min={1}
                    value={maxUsesLimit}
                    onChange={(e) => setMaxUsesLimit(e.target.value)}
                    placeholder="최대 인원"
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {["7", "30", "14"].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setExpiryDays(days)}
                  className={cn(
                    "rounded-xl py-2 text-xs font-medium",
                    expiryDays === days ? "bg-primary-400 text-white" : "bg-navy-800/5 text-navy-700",
                  )}
                >
                  {days}일
                </button>
              ))}
            </div>

            <Input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="이메일 제한 (선택)"
            />
            <Input
              value={linkDomain}
              onChange={(e) => setLinkDomain(e.target.value)}
              placeholder="도메인 제한 (선택, 예: wow-campus.com)"
            />

            <Button type="button" onClick={handleCreateLink} disabled={createLink.isPending} className="w-full">
              링크 생성
            </Button>
            {lastLink && (
              <div className="flex gap-2">
                <Input value={lastLink} readOnly className="text-xs" />
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-xl bg-navy-800/5 px-3"
                  aria-label="복사"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {(invitesData?.invites ?? []).length > 0 && (
        <GlassCard className="p-4">
          <p className="mb-2 text-sm font-medium text-navy-800">활성 초대 링크</p>
          <ul className="space-y-2 text-xs text-navy-600">
            {invitesData!.invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-navy-800/5 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">
                    {inv.label || inviteRestrictionLabel(inv)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-navy-600">
                    {inv.invite_type === "multi" ? "다회용" : "1회용"} · {roleLabels[inv.role] ?? inv.role} ·{" "}
                    {formatUsage(inv)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-navy-500">
                    {inviteRestrictionLabel(inv)} · {formatRemaining(inv.expires_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {inv.invite_url && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-primary-600 hover:bg-primary-50"
                      aria-label="링크 복사"
                      onClick={() => void copyToClipboard(inv.invite_url!)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="링크 비활성화"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={revokeInvite.isPending}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {isLoading ? (
        <p className="text-sm text-navy-600">로딩 중...</p>
      ) : (
        <div className="space-y-2">
          {(data?.members ?? []).map((m) => {
            const editable = canOpenMember(m);
            return (
              <GlassCard
                key={m.user_id}
                className={cn(
                  "flex items-center gap-4 p-4",
                  editable && "cursor-pointer transition hover:bg-white/90",
                )}
                onClick={editable ? () => setEditingMember(m) : undefined}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-400/10 text-sm font-semibold text-primary-600">
                  {m.name?.[0] ?? <Users className="h-5 w-5 text-primary-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy-900">{m.name}</p>
                  <p className="truncate text-xs text-navy-600">{m.email}</p>
                  {(m.teams?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.teams!.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.status !== "active" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-700">
                      {statusLabels[m.status] ?? m.status}
                    </span>
                  )}
                  <span className="rounded-full bg-navy-800/5 px-2 py-1 text-xs font-medium text-navy-700">
                    {roleLabels[m.role] ?? m.role}
                  </span>
                  {editable &&
                    (canManage ? (
                      <Pencil className="h-4 w-4 text-navy-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-navy-400" />
                    ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <MemberEditModal
        member={editingMember}
        open={!!editingMember}
        onClose={() => setEditingMember(null)}
        canManage={canManage}
        isSelf={editingMember?.user_id === currentUser?.id}
        actorRole={actorRole}
        onSave={handleSaveMember}
        onRemove={canManage ? handleRemoveMember : undefined}
        saving={updateMember.isPending || updateProfile.isPending}
        removing={removeMember.isPending}
      />

      <button
        type="button"
        onClick={() => navigate("/settings/billing")}
        className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
      >
        <CreditCard className="h-5 w-5 text-primary-500" />
        <span className="text-sm font-medium text-navy-900">구독 · 플랜 보기</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/settings/audit")}
        className="glass flex w-full items-center gap-3 rounded-2xl p-4 text-left"
      >
        <ScrollText className="h-5 w-5 text-primary-500" />
        <span className="text-sm font-medium text-navy-900">감사 로그</span>
      </button>

      {toast && (
        <ToastMessage
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

