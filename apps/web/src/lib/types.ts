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

export type OrgSubscriptionDetail = {
  id: string;
  organizationId: string;
  planId: string;
  planCode: string;
  planName: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialEndsAt: number | null;
  maxMembers: number;
  maxTeams: number;
  maxStorageMb: number;
  features: PlanFeature[];
  priceMonthly: number;
  priceYearly: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type SubscriptionPlanOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_members: number;
  max_teams: number;
  max_storage_mb: number;
  features_json: string;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
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
  dueSoonMilestones: {
    id: string;
    title: string;
    dueAt: number;
    projectId: string;
    projectName: string;
  }[];
  overdueProjects: {
    id: string;
    name: string;
    endAt: number;
    status: string;
    ownerName: string;
  }[];
  projectsByStatus: {
    planning: number;
    active: number;
    on_hold: number;
    done: number;
    archived?: number;
  };
  activeProjectWorkload: {
    id: string;
    name: string;
    status: string;
    taskCount: number;
    openTaskCount: number;
    progressPercent: number | null;
  }[];
  weekStats: {
    tasksCompleted: number;
    milestonesCompleted: number;
    projectsUpdated: number;
  };
};

export type OrgWebhook = {
  id: string;
  name: string;
  url: string;
  provider: "slack" | "generic" | "kakaowork";
  events: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AutomationPresetKey =
  | "notify_task_assigned"
  | "notify_task_comment"
  | "notify_task_mention"
  | "notify_task_overdue_daily"
  | "notify_task_status_change"
  | "webhook_task_assigned"
  | "webhook_task_completed"
  | "webhook_event_created"
  | "webhook_high_priority_task"
  | "webhook_project_comment";

export type AutomationPreset = {
  key: AutomationPresetKey;
  name: string;
  description: string;
  category: "notification" | "webhook";
  defaultEnabled: boolean;
  enabled: boolean;
};

export type LinkedEventSummary = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
};

export type LinkedTaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueAt: number | null;
  assigneeId?: string | null;
  assignee: string;
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
  kind: "audit" | "task" | "project";
  actorName: string;
  action: string;
  summary: string;
  link: string | null;
  createdAt: number;
};

export type OrgActivityQuery = {
  limit?: number;
  offset?: number;
  actorId?: string;
  from?: number;
  to?: number;
};

export type OrgActivityResponse = {
  items: OrgActivityItem[];
  total: number;
  limit: number;
  offset: number;
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
  creatorName?: string | null;
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

export type EntityAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type CommentReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
  time: string;
  parentId?: string | null;
  editedAt?: number | null;
  deletedAt?: number | null;
  isDeleted?: boolean;
  attachments?: EntityAttachment[];
  reactions?: CommentReaction[];
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

export type TaskStatus = "todo" | "doing" | "on_hold" | "done";
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
  projectId?: string | null;
  projectName?: string | null;
  creatorId?: string;
  eventId?: string | null;
  linkedEvent?: LinkedEventSummary | null;
  dueAt?: number | null;
  due: string;
  isOverdue?: boolean;
  sortOrder?: number;
  updatedAt?: number;
  labels?: TaskLabel[];
  attachmentCount?: number;
  parentTaskId?: string | null;
  subtaskCount?: number;
  blockedByCount?: number;
};

export type TaskSubtask = {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string | null;
  assignee: string;
  dueAt?: number | null;
  due: string;
  isOverdue?: boolean;
  sortOrder?: number;
  parentTaskId: string;
};

export type TaskDependency = {
  id: string;
  dependsOnTaskId: string;
  title: string;
  status: TaskStatus | string;
};

export type TaskSavedFilter = {
  id: string;
  name: string;
  filters: TaskFilters;
  createdAt: number;
  updatedAt: number;
};

export type ProjectStatus = "planning" | "active" | "on_hold" | "done" | "archived";

export type Project = {
  id: string;
  organizationId: string;
  teamId: string | null;
  teamName: string | null;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  startAt: number | null;
  endAt: number | null;
  taskCount?: number;
  openTaskCount?: number;
  milestoneCount?: number;
  doneMilestoneCount?: number;
  progressPercent?: number | null;
  currentUserRole?: string | null;
  isOwner?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ProjectFilters = {
  status?: ProjectStatus;
  teamId?: string;
};

export type CreateProjectPayload = {
  name: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  teamId?: string | null;
  startAt?: number | null;
  endAt?: number | null;
};

export type UpdateProjectPayload = {
  id: string;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  color?: string;
  teamId?: string | null;
  startAt?: number | null;
  endAt?: number | null;
};

export type MilestoneStatus = "pending" | "done";

export type ProjectMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueAt: number | null;
  calendarEventId?: string | null;
  status: MilestoneStatus;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type ProjectComment = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
  time: string;
  parentId?: string | null;
  editedAt?: number | null;
  deletedAt?: number | null;
  isDeleted?: boolean;
  attachments?: EntityAttachment[];
  reactions?: CommentReaction[];
};

export type ProjectMember = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: number;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  actorId: string;
  actorName: string;
  action: string;
  field: string | null;
  summary: string;
  createdAt: number;
  time: string;
};

export type ProjectTemplateTask = {
  title: string;
  description?: string;
  status?: "todo" | "doing" | "done";
  offsetDays?: number;
};

export type ProjectTemplateMemberSlot = {
  label: string;
  role: "manager" | "member" | "viewer";
};

export type OrgProjectTemplate = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  milestones: { title: string; offsetDays?: number }[];
  tasks: ProjectTemplateTask[];
  memberSlots: ProjectTemplateMemberSlot[];
  createdAt: number;
  updatedAt: number;
};

export type CreateProjectFromTemplateResult = {
  id: string;
  milestoneCount: number;
  taskCount: number;
  memberSlots: ProjectTemplateMemberSlot[];
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
  projectId?: string;
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
  projectId?: string | null;
  eventId?: string | null;
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
  createdAt?: number;
};

export type SearchResultType = "event" | "task" | "project" | "milestone" | "member" | "comment";

export type SearchFilters = {
  teamId?: string;
  projectId?: string;
  status?: string;
  assigneeId?: string;
  dateFrom?: number;
  dateTo?: number;
};

export type SearchResult = {
  id: string;
  type: SearchResultType;
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
  typePrefs?: {
    tasks: boolean;
    events: boolean;
    projects: boolean;
    mentions: boolean;
  };
};

export type NotificationTypeCategory = "tasks" | "events" | "projects" | "mentions";

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
  invite_url: string | null;
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
  | "projects:read"
  | "projects:write"
  | "projects:delete"
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

export type PermissionMatrixResponse = {
  roles: OrgRole[];
  permissions: Permission[];
  matrix: Record<OrgRole, Permission[]>;
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

export type AdminUserListItem = {
  id: string;
  email: string | null;
  name: string;
  email_verified: number;
  created_at: number;
  is_platform_admin: number;
  platform_role: string | null;
  org_count: number;
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
