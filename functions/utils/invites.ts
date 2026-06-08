import { hashToken, newId, now } from "./helpers";
import { checkMemberLimit } from "./subscriptions";

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeEmailDomain(domain: string | null | undefined): string | null {
  if (!domain?.trim()) return null;
  const d = domain.trim().toLowerCase();
  return d.startsWith("@") ? d : `@${d}`;
}

function emailMatchesDomain(userEmail: string | null, emailDomain: string | null): boolean {
  if (!emailDomain) return true;
  if (!userEmail) return false;
  return userEmail.toLowerCase().endsWith(emailDomain);
}

export type CreateInviteOptions = {
  email?: string | null;
  emailDomain?: string | null;
  role?: string;
  inviteType?: "single" | "multi";
  maxUses?: number | null;
  expiryDays?: number;
  label?: string | null;
};

export async function createOrgInvite(
  db: D1Database,
  orgId: string,
  invitedBy: string,
  options: CreateInviteOptions,
): Promise<{ id: string; rawToken: string; expiresAt: number }> {
  const inviteType = options.inviteType ?? "multi";
  const role = inviteType === "multi" ? "member" : (options.role ?? "member");
  if (role !== "member" && inviteType === "multi") {
    throw new Error("다회용 링크는 멤버 역할만 허용됩니다.");
  }

  let maxUses: number | null;
  if (inviteType === "single") {
    maxUses = 1;
  } else {
    maxUses = options.maxUses === undefined ? null : options.maxUses;
    if (maxUses !== null && maxUses < 1) maxUses = 1;
  }

  const raw = generateRawToken();
  const tokenHash = await hashToken(raw);
  const ts = now();
  const expiryDays = Math.min(90, Math.max(1, options.expiryDays ?? 7));
  const expiresAt = ts + expiryDays * 24 * 60 * 60 * 1000;
  const id = newId();

  await db
    .prepare(
      `INSERT INTO org_invites (
        id, organization_id, email, email_domain, role, token_hash, invited_by,
        expires_at, created_at, invite_type, max_uses, use_count, label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .bind(
      id,
      orgId,
      options.email?.trim().toLowerCase() ?? null,
      normalizeEmailDomain(options.emailDomain),
      role,
      tokenHash,
      invitedBy,
      expiresAt,
      ts,
      inviteType,
      maxUses,
      options.label?.trim() || null,
    )
    .run();

  return { id, rawToken: raw, expiresAt };
}

function isInviteExhausted(row: {
  max_uses: number | null;
  use_count: number;
  accepted_at: number | null;
  invite_type: string;
}): boolean {
  if (row.accepted_at !== null && row.invite_type === "single") return true;
  if (row.max_uses !== null && row.use_count >= row.max_uses) return true;
  return false;
}

export async function findValidInvite(
  db: D1Database,
  rawToken: string,
): Promise<{
  id: string;
  organizationId: string;
  orgName: string;
  email: string | null;
  emailDomain: string | null;
  role: string;
  expiresAt: number;
  inviteType: string;
  maxUses: number | null;
  useCount: number;
} | null> {
  const tokenHash = await hashToken(rawToken);
  const row = await db
    .prepare(
      `SELECT i.id, i.organization_id, i.email, i.email_domain, i.role, i.expires_at,
              i.invite_type, i.max_uses, i.use_count, i.accepted_at, o.name as org_name
       FROM org_invites i
       JOIN organizations o ON o.id = i.organization_id
       WHERE i.token_hash = ? AND i.revoked_at IS NULL AND i.expires_at > ? AND o.status = 'active'`,
    )
    .bind(tokenHash, now())
    .first<{
      id: string;
      organization_id: string;
      email: string | null;
      email_domain: string | null;
      role: string;
      expires_at: number;
      invite_type: string;
      max_uses: number | null;
      use_count: number;
      accepted_at: number | null;
      org_name: string;
    }>();

  if (!row || isInviteExhausted(row)) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    orgName: row.org_name,
    email: row.email,
    emailDomain: row.email_domain,
    role: row.role,
    expiresAt: row.expires_at,
    inviteType: row.invite_type,
    maxUses: row.max_uses,
    useCount: row.use_count,
  };
}

export async function acceptOrgInvite(
  db: D1Database,
  inviteId: string,
  userId: string,
  userEmail: string | null,
): Promise<{ organizationId: string } | { error: string }> {
  const invite = await db
    .prepare(
      `SELECT id, organization_id, email, email_domain, role, invite_type, max_uses, use_count, accepted_at, expires_at, revoked_at
       FROM org_invites WHERE id = ?`,
    )
    .bind(inviteId)
    .first<{
      id: string;
      organization_id: string;
      email: string | null;
      email_domain: string | null;
      role: string;
      invite_type: string;
      max_uses: number | null;
      use_count: number;
      accepted_at: number | null;
      expires_at: number;
      revoked_at: number | null;
    }>();

  if (!invite) return { error: "초대가 만료되었거나 유효하지 않습니다." };
  if (invite.revoked_at) return { error: "비활성화된 초대 링크입니다." };
  if (invite.expires_at <= now()) return { error: "초대가 만료되었습니다." };
  if (isInviteExhausted(invite)) return { error: "초대 링크 사용 한도에 도달했습니다." };

  if (invite.email && userEmail && invite.email !== userEmail.toLowerCase()) {
    return { error: "이 초대는 다른 이메일 주소용입니다." };
  }

  if (!emailMatchesDomain(userEmail, invite.email_domain)) {
    return { error: `이 초대는 ${invite.email_domain} 이메일만 사용할 수 있습니다.` };
  }

  const priorRedemption = await db
    .prepare("SELECT 1 FROM org_invite_redemptions WHERE invite_id = ? AND user_id = ?")
    .bind(inviteId, userId)
    .first();
  if (priorRedemption) return { error: "이미 이 링크로 참여했습니다." };

  const activeMembership = await db
    .prepare(
      "SELECT organization_id FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1",
    )
    .bind(userId)
    .first<{ organization_id: string }>();
  if (activeMembership && activeMembership.organization_id !== invite.organization_id) {
    return { error: "한 사용자는 하나의 조직에만 가입할 수 있습니다." };
  }

  const existing = await db
    .prepare("SELECT id, status FROM memberships WHERE organization_id = ? AND user_id = ?")
    .bind(invite.organization_id, userId)
    .first<{ id: string; status: string }>();

  if (existing?.status === "active") {
    return { error: "이미 조직 멤버입니다." };
  }

  if (!existing) {
    const limits = await checkMemberLimit(db, invite.organization_id);
    if (!limits.ok) {
      return { error: `조직 멤버 한도(${limits.limit}명)에 도달했습니다.` };
    }
  }

  const ts = now();

  if (existing) {
    await db
      .prepare("UPDATE memberships SET role = ?, status = 'active', joined_at = ? WHERE id = ?")
      .bind(invite.role, ts, existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, ?, 'active', ?)`,
      )
      .bind(newId(), invite.organization_id, userId, invite.role, ts)
      .run();
  }

  await db
    .prepare(
      "INSERT INTO org_invite_redemptions (id, invite_id, user_id, redeemed_at) VALUES (?, ?, ?, ?)",
    )
    .bind(newId(), inviteId, userId, ts)
    .run();

  const newUseCount = invite.use_count + 1;
  const exhausted =
    invite.max_uses !== null && newUseCount >= invite.max_uses;

  if (exhausted || invite.invite_type === "single") {
    await db
      .prepare(
        "UPDATE org_invites SET use_count = ?, accepted_at = ?, accepted_by = ? WHERE id = ?",
      )
      .bind(newUseCount, ts, userId, inviteId)
      .run();
  } else {
    await db
      .prepare("UPDATE org_invites SET use_count = ? WHERE id = ?")
      .bind(newUseCount, inviteId)
      .run();
  }

  return { organizationId: invite.organization_id };
}

export async function listOrgInvites(db: D1Database, orgId: string) {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.email, i.email_domain, i.role, i.expires_at, i.created_at,
              i.invite_type, i.max_uses, i.use_count, i.label, u.name as invited_by_name
       FROM org_invites i
       JOIN users u ON u.id = i.invited_by
       WHERE i.organization_id = ?
         AND i.revoked_at IS NULL
         AND i.expires_at > ?
         AND (i.max_uses IS NULL OR i.use_count < i.max_uses)
         AND (i.accepted_at IS NULL OR i.invite_type = 'multi')
       ORDER BY i.created_at DESC`,
    )
    .bind(orgId, now())
    .all();
  return results ?? [];
}

export async function revokeOrgInvite(
  db: D1Database,
  orgId: string,
  inviteId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE org_invites SET revoked_at = ?
       WHERE id = ? AND organization_id = ? AND revoked_at IS NULL`,
    )
    .bind(now(), inviteId, orgId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
