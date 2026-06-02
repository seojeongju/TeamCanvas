export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  APP_URL?: string;
  FRONTEND_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PAYMENT_PROVIDER?: "stripe" | "mock";
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export type UserRow = {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  locale: string;
  timezone: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  owner_id: string;
};

export type EventRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  creator_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: number;
  end_at: number;
  all_day: number;
  visibility: string;
  color: string | null;
};

export type TaskRow = {
  id: string;
  organization_id: string;
  team_id: string | null;
  creator_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: number | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: number | null;
  created_at: number;
};

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type AuthOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
  subscription?: {
    planCode: string;
    planName: string;
    status: string;
    features: string[];
  };
};

export type AuthMeExtras = {
  isPlatformAdmin: boolean;
  platformRole: string | null;
};
