const API_BASE = "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; db: string }>("/api/health"),

  me: () => request<import("./types").AuthMeResponse>("/auth/me"),

  authProviders: () =>
    request<{ google: boolean; kakao: boolean }>("/auth/providers"),

  register: (data: { email: string; password: string; name?: string }) =>
    request<import("./types").RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<import("./types").AuthMeResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyEmail: (token: string) =>
    request<{ ok: boolean; message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    request<import("./types").EmailActionResponse>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  forgotPassword: (email: string) =>
    request<import("./types").EmailActionResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetTokenStatus: (token: string) =>
    request<{ valid: boolean }>(`/auth/reset-token-status?token=${encodeURIComponent(token)}`),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  devLogin: (provider: "google" | "kakao") =>
    request<import("./types").AuthMeResponse>("/auth/dev", {
      method: "POST",
      body: JSON.stringify({ provider }),
    }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  refreshSession: () => request<{ ok: boolean; sessionExpiresAt: number }>("/auth/refresh", { method: "POST" }),

  createOrganization: (name: string, slug?: string) =>
    request<{ organization: import("./types").Organization }>("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    }),

  getOrganization: (orgId: string) =>
    request<{ organization: import("./types").Organization & { timezone?: string }; stats: import("./types").OrgStats }>(
      `/api/organizations/${orgId}`,
    ),

  updateOrganization: (orgId: string, data: { name?: string; timezone?: string }) =>
    request<{ ok: boolean; organization: import("./types").OrgSettings }>(
      `/api/organizations/${orgId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  getOrgSettings: (orgId: string) =>
    request<{
      organization: import("./types").OrgSettings & {
        hasLogo: boolean;
        settings: import("./types").OrgWorkSettings;
      };
    }>(`/api/organizations/${orgId}/settings`),

  updateOrgWorkSettings: (orgId: string, data: Partial<import("./types").OrgWorkSettings>) =>
    request<{ ok: boolean; settings: import("./types").OrgWorkSettings }>(
      `/api/organizations/${orgId}/settings`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  uploadOrgLogo: (orgId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ ok: boolean; hasLogo: boolean }>(`/api/organizations/${orgId}/logo`, {
      method: "POST",
      body: form,
    });
  },

  deleteOrgLogo: (orgId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/logo`, { method: "DELETE" }),

  orgLogoUrl: (orgId: string) => `/api/organizations/${orgId}/logo`,

  getDepartments: (orgId: string) =>
    request<{ departments: import("./types").Department[] }>(`/api/organizations/${orgId}/departments`),

  createDepartment: (orgId: string, data: { name: string; parentId?: string | null }) =>
    request<{ ok: boolean; department: { id: string; name: string } }>(
      `/api/organizations/${orgId}/departments`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  updateDepartment: (orgId: string, deptId: string, data: { name: string }) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/departments/${deptId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteDepartment: (orgId: string, deptId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/departments/${deptId}`, {
      method: "DELETE",
    }),

  getTeamSummary: (orgId: string, teamId: string) =>
    request<import("./types").TeamSummary>(`/api/organizations/${orgId}/teams/${teamId}/summary`),

  getTeamsManage: (orgId: string) =>
    request<{
      teams: import("./types").Team[];
      limits: { ok: boolean; limit: number; current: number };
    }>(`/api/organizations/${orgId}/teams/manage`),

  getTeamDetail: (orgId: string, teamId: string) =>
    request<import("./types").TeamDetail>(`/api/organizations/${orgId}/teams/${teamId}`),

  createTeam: (
    orgId: string,
    data: { name: string; color?: string; description?: string; departmentId?: string | null },
  ) =>
    request<{ ok: boolean; team: import("./types").Team }>(`/api/organizations/${orgId}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTeam: (
    orgId: string,
    teamId: string,
    data: {
      name?: string;
      color?: string;
      description?: string | null;
      departmentId?: string | null;
    },
  ) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTeam: (orgId: string, teamId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/teams/${teamId}`, { method: "DELETE" }),

  addTeamMember: (orgId: string, teamId: string, data: { userId: string; role?: string }) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTeamMember: (orgId: string, teamId: string, userId: string, data: { role: string }) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/teams/${teamId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeTeamMember: (orgId: string, teamId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    }),

  getEvents: (orgId: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    const qs = params.toString();
    return request<{ events: import("./types").CalendarEvent[] }>(
      `/api/organizations/${orgId}/events${qs ? `?${qs}` : ""}`,
    );
  },

  getTeams: (orgId: string) =>
    request<{ teams: import("./types").Team[] }>(`/api/organizations/${orgId}/teams`),

  getEventParticipants: (orgId: string) =>
    request<{ participants: { id: string; name: string; email: string | null }[] }>(
      `/api/organizations/${orgId}/event-participants`,
    ),

  getFreeBusy: (orgId: string, userIds: string[], from?: number, to?: number) => {
    const params = new URLSearchParams();
    params.set("userIds", userIds.join(","));
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    return request<{
      from: number;
      to: number;
      users: Record<string, import("./types").FreeBusyUser>;
    }>(`/api/organizations/${orgId}/free-busy?${params}`);
  },

  suggestEventTimes: (
    orgId: string,
    data: {
      prompt?: string;
      durationMinutes?: number;
      attendeeUserIds?: string[];
      from?: number;
      to?: number;
    },
  ) =>
    request<{ suggestions: import("./types").EventSuggestion[]; aiUsed: boolean }>(
      `/api/organizations/${orgId}/events/suggest`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  createEvent: (
    orgId: string,
    data: {
      title: string;
      startAt: number;
      endAt: number;
      allDay?: boolean;
      description?: string;
      location?: string;
      teamId?: string | null;
      color?: string;
      visibility?: "private" | "team" | "org";
      attendeeUserIds?: string[];
      reminderMinutes?: number[];
      recurrenceRule?: string | null;
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTasks: (orgId: string) =>
    request<{ tasks: import("./types").Task[] }>(`/api/organizations/${orgId}/tasks`),

  getEventReminders: (orgId: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    const qs = params.toString();
    return request<{ reminders: import("./types").EventReminder[] }>(
      `/api/organizations/${orgId}/reminders${qs ? `?${qs}` : ""}`,
    );
  },

  markEventReminderDelivered: (orgId: string, reminderId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/reminders/${reminderId}/delivered`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),

  getEventAttendees: (eventId: string) =>
    request<{ attendees: import("./types").EventAttendee[] }>(`/api/events/${eventId}/attendees`),

  updateEventRsvp: (eventId: string, data: { rsvp: "pending" | "accepted" | "declined" }) =>
    request<{ ok: boolean; rsvp: string }>(`/api/events/${eventId}/rsvp`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateEvent: (
    eventId: string,
    data: {
      title: string;
      startAt: number;
      endAt: number;
      allDay?: boolean;
      description?: string;
      location?: string;
      teamId?: string | null;
      color?: string;
      visibility?: "private" | "team" | "org";
      attendeeUserIds?: string[];
      reminderMinutes?: number[];
      recurrenceRule?: string | null;
    },
  ) =>
    request<{ ok: boolean }>(`/api/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteEvent: (eventId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}`, { method: "DELETE" }),

  createTask: (
    orgId: string,
    data: { title: string; status?: string; dueAt?: number; description?: string },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (taskId: string, data: { status?: string; title?: string }) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getNotifications: () =>
    request<{ notifications: import("./types").Notification[] }>("/api/notifications"),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  getNotificationPreferences: () =>
    request<{ preferences: import("./types").NotificationPreferences }>("/api/notification-preferences"),

  updateNotificationPreferences: (data: import("./types").NotificationPreferences) =>
    request<{ ok: boolean; preferences: import("./types").NotificationPreferences }>(
      "/api/notification-preferences",
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),

  getOrgPermissions: (orgId: string) =>
    request<import("./types").OrgPermissionsResponse>(`/api/organizations/${orgId}/permissions`),

  getOrgMembers: (orgId: string) =>
    request<{ members: import("./types").OrgMember[]; limits: { ok: boolean; limit: number; current: number } }>(
      `/api/organizations/${orgId}/members`,
    ),

  updateOrgMember: (orgId: string, userId: string, data: { role?: string; status?: string }) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeOrgMember: (orgId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),

  inviteOrgMember: (orgId: string, data: { email: string; role?: string }) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/members/invite`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createOrgInviteLink: (
    orgId: string,
    data?: {
      email?: string;
      emailDomain?: string;
      role?: string;
      inviteType?: "single" | "multi";
      maxUses?: number | null;
      expiryDays?: number;
      label?: string;
    },
  ) =>
    request<{
      inviteUrl: string;
      expiresAt: number;
      inviteId?: string;
      email?: { sent: boolean; devLink?: string };
    }>(`/api/organizations/${orgId}/invites`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  getOrgInvites: (orgId: string) =>
    request<{ invites: import("./types").OrgInvite[] }>(`/api/organizations/${orgId}/invites`),

  revokeOrgInvite: (orgId: string, inviteId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/invites/${inviteId}`, { method: "DELETE" }),

  getInvite: (token: string) =>
    request<{
      valid: boolean;
      organizationName?: string;
      role?: string;
      email?: string | null;
      emailDomain?: string | null;
      inviteType?: string;
      expiresAt?: number;
    }>(`/api/invites/${token}`),

  acceptInvite: (token: string) =>
    request<{ ok: boolean; organizationId: string }>(`/api/invites/${token}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getAuditLogs: (orgId: string) =>
    request<{
      logs: {
        id: string;
        action: string;
        entityType: string | null;
        entityId: string | null;
        metadata: unknown;
        createdAt: number;
        actorName: string;
      }[];
    }>(`/api/organizations/${orgId}/audit-logs`),

  startCheckout: (orgId: string, data: { planId: string; billingCycle?: "monthly" | "yearly" }) =>
    request<{ url: string; sessionId: string; provider?: "stripe" | "mock" }>(`/api/organizations/${orgId}/billing/checkout`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeMockCheckout: (orgId: string, data: { planId: string }) =>
    request<{ ok: boolean; provider: "mock"; status: string; planId: string }>(
      `/api/organizations/${orgId}/billing/mock/complete`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getOrgSubscription: (orgId: string) =>
    request<{ subscription: unknown; plans: Record<string, unknown>[]; billingProvider?: "stripe" | "mock" }>(
      `/api/organizations/${orgId}/subscription`,
    ),

  getBillingHistory: (orgId: string) =>
    request<{
      events: { id: string; action: string; metadata: unknown; createdAt: number }[];
    }>(`/api/organizations/${orgId}/billing/history`),

  adminMe: () => request<{ isPlatformAdmin: boolean; role: string | null }>("/api/admin/me"),

  adminBootstrap: () => request<{ ok: boolean; role: string }>("/api/admin/bootstrap", { method: "POST" }),

  adminDashboard: () =>
    request<{ stats: import("./types").AdminDashboardStats }>("/api/admin/dashboard"),

  adminOrganizations: (params?: { q?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<{ organizations: import("./types").AdminOrgListItem[] }>(
      `/api/admin/organizations${qs ? `?${qs}` : ""}`,
    );
  },

  adminOrganization: (orgId: string) =>
    request<{ organization: Record<string, unknown>; subscription: unknown; members: unknown[] }>(
      `/api/admin/organizations/${orgId}`,
    ),

  adminCreateOrganization: (data: {
    name: string;
    slug?: string;
    ownerEmail?: string;
    ownerUserId?: string;
  }) =>
    request<{ organization: { id: string; name: string; slug: string } }>(`/api/admin/organizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adminUpdateOrganization: (
    orgId: string,
    data: { status?: string; planId?: string; subscriptionStatus?: string },
  ) =>
    request<{ ok: boolean }>(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  adminUpdateOrganizationMember: (
    orgId: string,
    userId: string,
    data: { role?: string; status?: string },
  ) =>
    request<{ ok: boolean }>(`/api/admin/organizations/${orgId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  adminRemoveOrganizationMember: (orgId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/organizations/${orgId}/members/${userId}`, {
      method: "DELETE",
    }),

  adminTransferOrganizationOwner: (orgId: string, newOwnerUserId: string) =>
    request<{ ok: boolean }>(`/api/admin/organizations/${orgId}/owner`, {
      method: "PATCH",
      body: JSON.stringify({ newOwnerUserId }),
    }),

  adminPlans: () => request<{ plans: import("./types").SubscriptionPlan[] }>("/api/admin/plans"),

  adminUsers: (params?: { q?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<{ users: Record<string, unknown>[] }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
  },
};

export function oauthUrl(provider: "google" | "kakao"): string {
  return `/auth/${provider}`;
}
