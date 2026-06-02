import { hashToken, newId, now } from "./helpers";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createOrgInvite(
  db: D1Database,
  orgId: string,
  invitedBy: string,
  options: { email?: string | null; role?: string },
): Promise<{ id: string; rawToken: string; expiresAt: number }> {
  const raw = generateRawToken();
  const tokenHash = await hashToken(raw);
  const ts = now();
  const expiresAt = ts + INVITE_EXPIRY_MS;
  const id = newId();

  await db
    .prepare(
      `INSERT INTO org_invites (id, organization_id, email, role, token_hash, invited_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      orgId,
      options.email?.trim().toLowerCase() ?? null,
      options.role ?? "member",
      tokenHash,
      invitedBy,
      expiresAt,
      ts,
    )
    .run();

  return { id, rawToken: raw, expiresAt };
}

export async function findValidInvite(
  db: D1Database,
  rawToken: string,
): Promise<{
  id: string;
  organizationId: string;
  orgName: string;
  email: string | null;
  role: string;
  expiresAt: number;
} | null> {
  const tokenHash = await hashToken(rawToken);
  const row = await db
    .prepare(
      `SELECT i.id, i.organization_id, i.email, i.role, i.expires_at, o.name as org_name
       FROM org_invites i
       JOIN organizations o ON o.id = i.organization_id
       WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > ? AND o.status = 'active'`,
    )
    .bind(tokenHash, now())
    .first<{
      id: string;
      organization_id: string;
      email: string | null;
      role: string;
      expires_at: number;
      org_name: string;
    }>();

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    orgName: row.org_name,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
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
      `SELECT id, organization_id, email, role FROM org_invites
       WHERE id = ? AND accepted_at IS NULL AND expires_at > ?`,
    )
    .bind(inviteId, now())
    .first<{ id: string; organization_id: string; email: string | null; role: string }>();

  if (!invite) return { error: "초대가 만료되었거나 유효하지 않습니다." };

  if (invite.email && userEmail && invite.email !== userEmail.toLowerCase()) {
    return { error: "이 초대는 다른 이메일 주소용입니다." };
  }

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

  const ts = now();
  if (existing) {
    if (existing.status === "active") return { error: "이미 조직 멤버입니다." };
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
    .prepare("UPDATE org_invites SET accepted_at = ?, accepted_by = ? WHERE id = ?")
    .bind(ts, userId, inviteId)
    .run();

  return { organizationId: invite.organization_id };
}

export async function listOrgInvites(db: D1Database, orgId: string) {
  const { results } = await db
    .prepare(
      `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, u.name as invited_by_name
       FROM org_invites i
       JOIN users u ON u.id = i.invited_by
       WHERE i.organization_id = ? AND i.accepted_at IS NULL AND i.expires_at > ?
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
      `DELETE FROM org_invites
       WHERE id = ? AND organization_id = ? AND accepted_at IS NULL`,
    )
    .bind(inviteId, orgId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
