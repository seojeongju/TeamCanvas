const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return "이메일을 입력해주세요.";
  if (!EMAIL_RE.test(normalized)) return "올바른 이메일 형식이 아닙니다.";
  return null;
}

export function validatePassword(password: string, isRegister = false): string | null {
  if (!password) return "비밀번호를 입력해주세요.";
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (isRegister && password.length > 128) return "비밀번호는 128자 이하여야 합니다.";
  return null;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "이름을 입력해주세요.";
  if (trimmed.length > 50) return "이름은 50자 이하여야 합니다.";
  return null;
}

export function defaultNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "사용자";
  return local.replace(/[._-]/g, " ").slice(0, 50) || "사용자";
}
