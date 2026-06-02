import { hashToken, newId, now } from "./helpers";

export type AuthTokenType = "email_verify" | "password_reset";

const EXPIRY_MS: Record<AuthTokenType, number> = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAuthToken(
  db: D1Database,
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  await db
    .prepare(
      `DELETE FROM auth_tokens WHERE user_id = ? AND type = ? AND (used_at IS NOT NULL OR expires_at < ?)`,
    )
    .bind(userId, type, now())
    .run();

  const raw = generateRawToken();
  const tokenHash = await hashToken(raw);
  const ts = now();

  await db
    .prepare(
      `INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), userId, type, tokenHash, ts + EXPIRY_MS[type], ts)
    .run();

  return raw;
}

export async function findValidToken(
  db: D1Database,
  rawToken: string,
  type: AuthTokenType,
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = await hashToken(rawToken);
  const row = await db
    .prepare(
      `SELECT id, user_id FROM auth_tokens
       WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(tokenHash, type, now())
    .first<{ id: string; user_id: string }>();

  if (!row) return null;
  return { id: row.id, userId: row.user_id };
}

export async function consumeAuthToken(db: D1Database, tokenId: string): Promise<void> {
  await db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").bind(now(), tokenId).run();
}

export async function canResendVerification(db: D1Database, userId: string): Promise<boolean> {
  const recent = await db
    .prepare(
      `SELECT created_at FROM auth_tokens
       WHERE user_id = ? AND type = 'email_verify' AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{ created_at: number }>();

  if (!recent) return true;
  return now() - recent.created_at > 60_000;
}

export async function markEmailVerified(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?")
    .bind(now(), userId)
    .run();
}

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .bind(passwordHash, now(), userId)
    .run();
}

export async function findUserByEmail(
  db: D1Database,
  email: string,
): Promise<{ id: string; email: string; name: string; password_hash: string | null; email_verified: number } | null> {
  const row = await db
    .prepare(
      "SELECT id, email, name, password_hash, email_verified FROM users WHERE email = ?",
    )
    .bind(email)
    .first<{
      id: string;
      email: string;
      name: string;
      password_hash: string | null;
      email_verified: number;
    }>();
  return row ?? null;
}
