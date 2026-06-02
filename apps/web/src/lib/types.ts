export type User = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type OrgRole = "owner" | "admin" | "member" | "guest";

export type PlanFeature =
  | "calendar"
  | "tasks"
  | "teams"
  | "file_storage"
  | "web_push"
  | "audit_logs"
  | "api_access"
  | "custom_branding";

export type OrgSubscriptionSummary = {
  planCode: string;
  planName: string;
  status: string;
  features: PlanFeature[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole | string;
  subscription?: OrgSubscriptionSummary;
};

export type OrgStats = {
  members: number;
  teams: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
  color: string;
  teamName: string;
  time: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "doing" | "done";
  priority: string;
  assignee: string;
  dueAt?: number | null;
  due: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  unread: boolean;
  time: string;
};

export type AuthMeResponse = {
  user: User;
  organizations: Organization[];
  isPlatformAdmin?: boolean;
  platformRole?: string | null;
};

export type EmailActionResponse = {
  message: string;
  sent?: boolean;
  devLink?: string;
};

export type RegisterResponse = AuthMeResponse & {
  emailVerification?: { sent: boolean; devLink?: string };
};

export type Permission =
  | "org:read"
  | "org:settings"
  | "members:read"
  | "members:manage"
  | "events:read"
  | "events:write"
  | "events:delete"
  | "tasks:read"
  | "tasks:write"
  | "tasks:delete"
  | "billing:read"
  | "billing:manage";

export type OrgPermissionsResponse = {
  role: OrgRole;
  permissions: Permission[];
  subscription: {
    planCode: string;
    planName: string;
    status: string;
    features: PlanFeature[];
    maxMembers: number;
    maxTeams: number;
    trialEndsAt: number | null;
    currentPeriodEnd: number;
  } | null;
};

export type OrgMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: number | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
};

export type AdminDashboardStats = {
  activeOrganizations: number;
  totalUsers: number;
  subscriptionsByStatus: { status: string; c: number }[];
  subscriptionsByPlan: { code: string; name: string; c: number }[];
};

export type AdminOrgListItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_code: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  member_count: number;
  created_at: number;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxMembers: number;
  maxTeams: number;
  maxStorageMb: number;
  features: PlanFeature[];
  isActive: boolean;
  sortOrder: number;
};
