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
  timezone?: string;
  status?: string;
  deactivatedAt?: number | null;
  deleteScheduledAt?: number | null;
  hasLogo?: boolean;
  settings?: OrgWorkSettings;
  subscription?: OrgSubscriptionSummary;
};

export type OrgStats = {
  members: number;
  teams: number;
};

export type CalendarPolicy = "own_teams" | "all_teams";

export type OrgWorkSettings = {
  workHours: { start: string; end: string };
  workDays: number[];
  calendarPolicy: CalendarPolicy;
};

export type OrgHoliday = {
  id: string;
  name: string;
  date: string;
  yearly: boolean;
  createdAt?: number;
};

export type TeamCreationRequest = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  departmentId: string | null;
  status: string;
  requesterId: string;
  requesterName: string;
  rejectReason: string | null;
  createdAt: number;
  reviewedAt: number | null;
};

export type Department = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  teamCount: number;
};

export type TeamSummary = {
  eventsThisWeek: number;
  upcomingEvents: {
    id: string;
    title: string;
    startAt: number;
    endAt: number;
    allDay: boolean;
  }[];
  tasks: { todo: number; doing: number; done: number };
};

export type Team = {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  departmentId?: string | null;
  memberCount?: number;
  createdAt?: number;
};

export type TeamMember = {
  userId: string;
  role: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export type TeamDetail = {
  team: Team & { memberCount: number };
  members: TeamMember[];
  canManage: boolean;
};

export type DashboardInsights = {
  tasksByStatus: { todo: number; doing: number; done: number };
  dueSoonTasks: {
    id: string;
    title: string;
    dueAt: number;
    status: string;
    assigneeName: string;
  }[];
  weekEventCount: number;
  teamWorkload: {
    teamId: string;
    teamName: string;
    todo: number;
    doing: number;
    done: number;
  }[];
};

export type OrgWebhook = {
  id: string;
  name: string;
  url: string;
  provider: "slack" | "generic";
  events: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SharedEventView = {
  title: string;
  description: string | null;
  location: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
  time: string;
  organizationName: string;
  teamName: string | null;
};

export type OrgActivityItem = {
  id: string;
  kind: "audit" | "task";
  actorName: string;
  summary: string;
  link: string | null;
  createdAt: number;
};

export type OrgSettings = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
  visibility?: "private" | "team" | "org" | string;
  recurrenceRule?: string | null;
  excludedDates?: string[];
  teamId?: string | null;
  color: string;
  teamName: string;
  time: string;
  sourceType?: "event" | "task" | "google";
  /** Google 개인 일정 — API에서 본인 요청에만 포함 */
  isPersonal?: boolean;
  creatorId?: string;
  taskId?: string;
  /** 반복 일정 occurrence — 상세/수정은 parentEventId 기준 */
  parentEventId?: string;
  occurrenceDate?: string;
  occurrenceStartAt?: number;
  isRecurrenceOccurrence?: boolean;
};

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
  createdAt?: number;
};

export type TaskChecklistItem = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
  createdAt?: number;
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
  time: string;
};

export type EventComment = {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
  time: string;
};

export type BusyBlock = {
  startAt: number;
  endAt: number;
  allDay: boolean;
  title: string | null;
};

export type FreeBusyUser = {
  userId: string;
  blocks: BusyBlock[];
};

export type EventSuggestion = {
  startAt: number;
  endAt: number;
  score: number;
  reason: string;
  suggestedTitle?: string;
};

export type EventReminder = {
  id: string;
  eventId: string;
  title: string;
  startAt: number;
  endAt?: number;
  remindAt: number;
  reminderMinutes: number;
};

export type EventAttendee = {
  user_id: string;
  name: string;
  email: string | null;
  rsvp: "pending" | "accepted" | "declined" | string;
};

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskViewMode = "board" | "list";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority | string;
  assigneeId?: string | null;
  assignee: string;
  teamId?: string | null;
  teamName?: string | null;
  creatorId?: string;
  dueAt?: number | null;
  due: string;
  isOverdue?: boolean;
  sortOrder?: number;
  updatedAt?: number;
  labels?: TaskLabel[];
};

export type TaskActivity = {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  action: string;
  field: string | null;
  summary: string;
  createdAt: number;
  time: string;
};

export type TaskFilters = {
  assignee?: "me" | "all";
  teamId?: string;
  status?: TaskStatus;
  overdue?: boolean;
  dueToday?: boolean;
  labelId?: string;
};

export type UpdateTaskPayload = {
  id: string;
  status?: TaskStatus;
  title?: string;
  description?: string | null;
  dueAt?: number | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  sortOrder?: number;
  teamId?: string | null;
  labelIds?: string[];
};

export type Notification = {
  id: string;
  type?: string;
  title: string;
  body: string | null;
  link: string | null;
  unread: boolean;
  time: string;
};

export type SearchResult = {
  id: string;
  type: "event" | "task" | "member";
  title: string;
  subtitle: string;
  link: string;
};

export type TaskFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: number;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

export type OrgInvite = {
  id: string;
  email: string | null;
  email_domain: string | null;
  role: string;
  expires_at: number;
  created_at: number;
  invite_type: "single" | "multi" | string;
  max_uses: number | null;
  use_count: number;
  label: string | null;
  invited_by_name: string;
};

export type AuthMeResponse = {
  user: User;
  organizations: Organization[];
  isPlatformAdmin?: boolean;
  platformRole?: string | null;
  sessionExpiresAt?: number | null;
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
  | "teams:read"
  | "teams:manage"
  | "teams:members"
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

export type MemberTeamTag = {
  id: string;
  name: string;
  color: string;
};

export type OrgMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: number | null;
  name: string;
  email: string | null;
  teams?: MemberTeamTag[];
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
