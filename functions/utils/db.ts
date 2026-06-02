import type { AuthUser, AuthOrg } from "../types";
import { newId, now } from "./helpers";
import { hashPassword, verifyPassword } from "./password";
import { defaultNameFromEmail, normalizeEmail } from "./validate";

function toAuthUser(row: {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified?: number | null;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    emailVerified: Boolean(row.email_verified),
  };
}

export async function upsertOAuthUser(
  db: D1Database,
  provider: "google" | "kakao",
  providerUserId: string,
  profile: { name: string; email: string | null; avatarUrl?: string | null },
): Promise<AuthUser> {
  const existing = await db
    .prepare(
      "SELECT u.id, u.email, u.name, u.avatar_url FROM oauth_accounts o JOIN users u ON u.id = o.user_id WHERE o.provider = ? AND o.provider_user_id = ?",
    )
    .bind(provider, providerUserId)
    .first<{ id: string; email: string | null; name: string; avatar_url: string | null }>();

  if (existing) {
    await db
      .prepare(
        "UPDATE users SET name = ?, email = COALESCE(?, email), avatar_url = ?, email_verified = 1, updated_at = ? WHERE id = ?",
      )
      .bind(profile.name, profile.email, profile.avatarUrl ?? null, now(), existing.id)
      .run();
    const user = await db
      .prepare("SELECT id, email, name, avatar_url, email_verified FROM users WHERE id = ?")
      .bind(existing.id)
      .first<{ id: string; email: string | null; name: string; avatar_url: string | null; email_verified: number }>();
    return toAuthUser(user!);
  }

  const userId = newId();
  const ts = now();
  await db
    .prepare(
      "INSERT INTO users (id, email, name, avatar_url, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(userId, profile.email, profile.name, profile.avatarUrl ?? null, ts, ts)
    .run();

  await db
    .prepare(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)",
    )
    .bind(newId(), userId, provider, providerUserId)
    .run();

  return toAuthUser({
    id: userId,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.avatarUrl ?? null,
    email_verified: 1,
  });
}

export async function registerEmailUser(
  db: D1Database,
  email: string,
  password: string,
  name: string,
): Promise<AuthUser | { error: string; status: number }> {
  const normalized = normalizeEmail(email);
  const existing = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string; password_hash: string | null }>();

  if (existing?.password_hash) {
    return { error: "이미 등록된 이메일입니다.", status: 409 };
  }

  const passwordHash = await hashPassword(password);
  const ts = now();

  if (existing) {
    await db
      .prepare(
        "UPDATE users SET name = ?, password_hash = ?, email_verified = 0, updated_at = ? WHERE id = ?",
      )
      .bind(name, passwordHash, ts, existing.id)
      .run();
    return toAuthUser({
      id: existing.id,
      email: normalized,
      name,
      avatar_url: null,
      email_verified: 0,
    });
  }

  const userId = newId();
  await db
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(userId, normalized, name, passwordHash, ts, ts)
    .run();

  return toAuthUser({
    id: userId,
    email: normalized,
    name,
    avatar_url: null,
    email_verified: 0,
  });
}

export async function loginEmailUser(
  db: D1Database,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const normalized = normalizeEmail(email);
  const user = await db
    .prepare(
      "SELECT id, email, name, avatar_url, password_hash, email_verified FROM users WHERE email = ?",
    )
    .bind(normalized)
    .first<{
      id: string;
      email: string | null;
      name: string;
      avatar_url: string | null;
      password_hash: string | null;
      email_verified: number;
    }>();

  if (!user?.password_hash) return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  return toAuthUser(user);
}

export function resolveDisplayName(name: string | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return defaultNameFromEmail(email);
}

export async function getUserOrganizations(db: D1Database, userId: string): Promise<AuthOrg[]> {
  const { results } = await db
    .prepare(
      `SELECT o.id, o.name, o.slug, m.role
       FROM memberships m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.name`,
    )
    .bind(userId)
    .all<{ id: string; name: string; slug: string; role: string }>();

  return (results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
  }));
}

export async function createOrganization(
  db: D1Database,
  userId: string,
  name: string,
  slug: string,
): Promise<AuthOrg> {
  const orgId = newId();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(orgId, name, slug, userId, ts, ts)
    .run();

  await db
    .prepare(
      `INSERT INTO memberships (id, organization_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?)`,
    )
    .bind(newId(), orgId, userId, ts)
    .run();

  const defaultTeamId = newId();
  await db
    .prepare(
      `INSERT INTO teams (id, organization_id, name, color, created_at) VALUES (?, ?, '기본 팀', '#4A9FE8', ?)`,
    )
    .bind(defaultTeamId, orgId, ts)
    .run();

  await db
    .prepare(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'lead')`)
    .bind(defaultTeamId, userId)
    .run();

  return { id: orgId, name, slug, role: "owner" };
}

export async function getOrgStats(db: D1Database, orgId: string) {
  const members = await db
    .prepare("SELECT COUNT(*) as c FROM memberships WHERE organization_id = ? AND status = 'active'")
    .bind(orgId)
    .first<{ c: number }>();

  const teams = await db
    .prepare("SELECT COUNT(*) as c FROM teams WHERE organization_id = ?")
    .bind(orgId)
    .first<{ c: number }>();

  return {
    members: members?.c ?? 0,
    teams: teams?.c ?? 0,
  };
}
