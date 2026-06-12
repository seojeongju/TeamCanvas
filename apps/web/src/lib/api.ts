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

  updateProfile: (data: { name: string }) =>
    request<{ ok: boolean; user: import("./types").User }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

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

  getDashboardInsights: (orgId: string) =>
    request<import("./types").DashboardInsights>(
      `/api/organizations/${orgId}/dashboard/insights`,
    ),

  downloadWeeklyReport: (orgId: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    const qs = params.toString();
    return fetch(`/api/organizations/${orgId}/reports/weekly.csv${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
  },

  getOrgWebhooks: (orgId: string) =>
    request<{ webhooks: import("./types").OrgWebhook[]; availableEvents: string[] }>(
      `/api/organizations/${orgId}/webhooks`,
    ),

  createOrgWebhook: (
    orgId: string,
    data: {
      name: string;
      url: string;
      provider?: "slack" | "generic" | "kakaowork";
      events?: string[];
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/webhooks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrgWebhook: (
    orgId: string,
    webhookId: string,
    data: Partial<{
      name: string;
      url: string;
      provider: "slack" | "generic" | "kakaowork";
      events: string[];
      enabled: boolean;
    }>,
  ) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/webhooks/${webhookId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrgWebhook: (orgId: string, webhookId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/webhooks/${webhookId}`, {
      method: "DELETE",
    }),

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

  deactivateOrganization: (orgId: string) =>
    request<{ ok: boolean; deleteScheduledAt: number }>(`/api/organizations/${orgId}/deactivate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  reactivateOrganization: (orgId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/reactivate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getTeamRequests: (orgId: string) =>
    request<{ requests: import("./types").TeamCreationRequest[] }>(
      `/api/organizations/${orgId}/team-requests`,
    ),

  createTeamRequest: (
    orgId: string,
    data: { name: string; description?: string; color?: string; departmentId?: string | null },
  ) =>
    request<{ ok: boolean; id: string }>(`/api/organizations/${orgId}/team-requests`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveTeamRequest: (orgId: string, requestId: string) =>
    request<{ ok: boolean; teamId: string }>(
      `/api/organizations/${orgId}/team-requests/${requestId}/approve`,
      { method: "POST", body: JSON.stringify({}) },
    ),

  rejectTeamRequest: (orgId: string, requestId: string, reason?: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/team-requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  getHolidays: (orgId: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    const qs = params.toString();
    return request<{ holidays: import("./types").OrgHoliday[] }>(
      `/api/organizations/${orgId}/holidays${qs ? `?${qs}` : ""}`,
    );
  },

  createHoliday: (orgId: string, data: { name: string; date: string; yearly?: boolean }) =>
    request<{ ok: boolean; id: string }>(`/api/organizations/${orgId}/holidays`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteHoliday: (orgId: string, holidayId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/holidays/${holidayId}`, {
      method: "DELETE",
    }),

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

  getOrgActivity: (orgId: string, query: import("./types").OrgActivityQuery = {}) => {
    const params = new URLSearchParams();
    if (query.limit != null) params.set("limit", String(query.limit));
    if (query.offset != null) params.set("offset", String(query.offset));
    if (query.actorId) params.set("actorId", query.actorId);
    if (query.from != null) params.set("from", String(query.from));
    if (query.to != null) params.set("to", String(query.to));
    const qs = params.toString();
    return request<import("./types").OrgActivityResponse>(
      `/api/organizations/${orgId}/activity${qs ? `?${qs}` : ""}`,
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
      excludedDates?: string[];
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTasks: (orgId: string, filters?: import("./types").TaskFilters) => {
    const params = new URLSearchParams();
    if (filters?.assignee === "me") params.set("assignee", "me");
    if (filters?.teamId) params.set("teamId", filters.teamId);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.overdue) params.set("overdue", "true");
    const qs = params.toString();
    return request<{ tasks: import("./types").Task[] }>(
      `/api/organizations/${orgId}/tasks${qs ? `?${qs}` : ""}`,
    );
  },

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
      excludedDates?: string[];
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
    data: {
      title: string;
      status?: string;
      dueAt?: number;
      description?: string;
      assigneeId?: string;
      priority?: string;
      teamId?: string | null;
      projectId?: string | null;
      eventId?: string | null;
      labelIds?: string[];
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (taskId: string, data: Omit<import("./types").UpdateTaskPayload, "id">) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTask: (taskId: string) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}`, { method: "DELETE" }),

  convertTaskToProject: (
    taskId: string,
    data?: { name?: string; includeChecklistAsMilestones?: boolean },
  ) =>
    request<{ projectId: string; projectName: string }>(`/api/tasks/${taskId}/convert-to-project`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  getProjects: (orgId: string, filters?: import("./types").ProjectFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.teamId) params.set("teamId", filters.teamId);
    const qs = params.toString();
    return request<{ projects: import("./types").Project[] }>(
      `/api/organizations/${orgId}/projects${qs ? `?${qs}` : ""}`,
    );
  },

  getProject: (projectId: string) =>
    request<{ project: import("./types").Project }>(`/api/projects/${projectId}`),

  createProject: (orgId: string, data: import("./types").CreateProjectPayload) =>
    request<{ id: string }>(`/api/organizations/${orgId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createProjectFromTemplate: (
    orgId: string,
    data: import("./types").CreateProjectPayload & { templateId: string },
  ) =>
    request<import("./types").CreateProjectFromTemplateResult>(
      `/api/organizations/${orgId}/projects/from-template`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  duplicateProject: (
    projectId: string,
    data?: { name?: string; includeTasks?: boolean },
  ) =>
    request<{ id: string; milestoneCount: number; taskCount: number }>(
      `/api/projects/${projectId}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      },
    ),

  linkTasksToProject: (projectId: string, taskIds: string[]) =>
    request<{ ok: boolean; linked: number }>(`/api/projects/${projectId}/link-tasks`, {
      method: "POST",
      body: JSON.stringify({ taskIds }),
    }),

  updateProject: (projectId: string, data: Omit<import("./types").UpdateProjectPayload, "id">) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, { method: "DELETE" }),

  transferProjectOwnership: (projectId: string, data: { newOwnerId: string }) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/transfer-ownership`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getProjectMilestones: (projectId: string) =>
    request<{ milestones: import("./types").ProjectMilestone[] }>(`/api/projects/${projectId}/milestones`),

  createProjectMilestone: (
    projectId: string,
    data: { title: string; description?: string; dueAt?: number | null; sortOrder?: number },
  ) =>
    request<{ id: string }>(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProjectMilestone: (
    milestoneId: string,
    data: {
      title?: string;
      description?: string | null;
      dueAt?: number | null;
      status?: import("./types").MilestoneStatus;
      sortOrder?: number;
    },
  ) =>
    request<{ ok: boolean }>(`/api/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProjectMilestone: (milestoneId: string) =>
    request<{ ok: boolean }>(`/api/milestones/${milestoneId}`, { method: "DELETE" }),

  getProjectMembers: (projectId: string) =>
    request<{ members: import("./types").ProjectMember[] }>(`/api/projects/${projectId}/members`),

  addProjectMember: (projectId: string, data: { userId: string; role?: string }) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeProjectMember: (projectId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" }),

  getProjectActivities: (projectId: string) =>
    request<{ activities: import("./types").ProjectActivity[] }>(`/api/projects/${projectId}/activities`),

  getOrgProjectTemplates: (orgId: string) =>
    request<{ templates: import("./types").OrgProjectTemplate[] }>(
      `/api/organizations/${orgId}/project-templates`,
    ),

  createOrgProjectTemplate: (
    orgId: string,
    data: {
      name: string;
      description?: string;
      milestones?: { title: string; offsetDays?: number }[];
      tasks?: import("./types").ProjectTemplateTask[];
      memberSlots?: import("./types").ProjectTemplateMemberSlot[];
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/project-templates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrgProjectTemplate: (
    templateId: string,
    data: {
      name?: string;
      description?: string | null;
      milestones?: { title: string; offsetDays?: number }[];
      tasks?: import("./types").ProjectTemplateTask[];
      memberSlots?: import("./types").ProjectTemplateMemberSlot[];
    },
  ) =>
    request<{ ok: boolean }>(`/api/project-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrgProjectTemplate: (templateId: string) =>
    request<{ ok: boolean }>(`/api/project-templates/${templateId}`, { method: "DELETE" }),

  getTaskActivities: (taskId: string) =>
    request<{ activities: import("./types").TaskActivity[] }>(`/api/tasks/${taskId}/activities`),

  getTaskComments: (taskId: string) =>
    request<{ comments: import("./types").TaskComment[] }>(`/api/tasks/${taskId}/comments`),

  createTaskComment: (taskId: string, body: string) =>
    request<{ id: string }>(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  getNotifications: () =>
    request<{ notifications: import("./types").Notification[] }>("/api/notifications"),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/api/notifications/read-all", { method: "PATCH" }),

  searchOrg: (
    orgId: string,
    q: string,
    opts?: { limit?: number; type?: import("./types").SearchResultType },
  ) => {
    const params = new URLSearchParams({ q, limit: String(opts?.limit ?? 20) });
    if (opts?.type) params.set("type", opts.type);
    return request<{ results: import("./types").SearchResult[] }>(
      `/api/organizations/${orgId}/search?${params}`,
    );
  },

  getEntityFiles: (entityType: "task" | "event" | "project", entityId: string) =>
    request<{ files: import("./types").TaskFile[] }>(
      entityType === "task"
        ? `/api/tasks/${entityId}/files`
        : entityType === "event"
          ? `/api/events/${entityId}/files`
          : `/api/projects/${entityId}/files`,
    ),

  uploadEntityFile: (orgId: string, entityType: "task" | "event" | "project", entityId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("entityType", entityType);
    form.append("entityId", entityId);
    return request<{ id: string; filename: string; mimeType: string; sizeBytes: number }>(
      `/api/organizations/${orgId}/files`,
      { method: "POST", body: form },
    );
  },

  downloadIcal: async (orgId: string, from: number, to: number) => {
    const res = await fetch(
      `/api/organizations/${orgId}/events/ical?from=${from}&to=${to}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? "Export failed");
    }
    return res.blob();
  },

  getIcalFeedStatus: (orgId: string) =>
    request<{ active: boolean; createdAt: number | null; lastUsedAt: number | null }>(
      `/api/organizations/${orgId}/ical-feed`,
    ),

  createIcalFeed: (orgId: string) =>
    request<{ url: string; webcalUrl: string; createdAt: number }>(
      `/api/organizations/${orgId}/ical-feed`,
      { method: "POST" },
    ),

  revokeIcalFeed: (orgId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/ical-feed`, { method: "DELETE" }),

  getEventShareStatus: (eventId: string) =>
    request<{
      active: boolean;
      createdAt: number | null;
      lastUsedAt: number | null;
      expiresAt: number | null;
    }>(`/api/events/${eventId}/share`),

  createEventShare: (eventId: string, expiresInDays?: number) =>
    request<{ url: string; expiresAt: number | null; createdAt: number }>(
      `/api/events/${eventId}/share`,
      { method: "POST", body: JSON.stringify({ expiresInDays }) },
    ),

  revokeEventShare: (eventId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}/share`, { method: "DELETE" }),

  getSharedEvent: (token: string) =>
    request<{ event: import("./types").SharedEventView }>(`/api/share/event/${token}`),

  getEvent: (eventId: string) =>
    request<{ event: import("./types").CalendarEvent }>(`/api/events/${eventId}`),

  getEventLinkedTasks: (eventId: string) =>
    request<{ tasks: import("./types").LinkedTaskSummary[] }>(`/api/events/${eventId}/linked-tasks`),

  getEventComments: (eventId: string) =>
    request<{ comments: import("./types").EventComment[] }>(`/api/events/${eventId}/comments`),

  createEventComment: (eventId: string, body: string) =>
    request<{ id: string }>(`/api/events/${eventId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  getTaskLabels: (orgId: string) =>
    request<{ labels: import("./types").TaskLabel[] }>(`/api/organizations/${orgId}/labels`),

  createTaskLabel: (orgId: string, data: { name: string; color?: string }) =>
    request<{ id: string; name: string; color: string }>(`/api/organizations/${orgId}/labels`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteTaskLabel: (labelId: string) =>
    request<{ ok: boolean }>(`/api/labels/${labelId}`, { method: "DELETE" }),

  getTaskChecklist: (taskId: string) =>
    request<{ items: import("./types").TaskChecklistItem[] }>(`/api/tasks/${taskId}/checklist`),

  createChecklistItem: (taskId: string, title: string) =>
    request<{ id: string; sortOrder: number }>(`/api/tasks/${taskId}/checklist`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  updateChecklistItem: (
    taskId: string,
    itemId: string,
    data: { title?: string; done?: boolean; sortOrder?: number },
  ) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}/checklist/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteChecklistItem: (taskId: string, itemId: string) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" }),

  getGoogleCalendarStatus: (orgId: string) =>
    request<{ connected: boolean; updatedAt: number | null }>(
      `/api/integrations/google-calendar/status?orgId=${orgId}`,
    ),

  connectGoogleCalendar: (orgId: string) => {
    window.location.href = `/api/integrations/google-calendar/connect?orgId=${orgId}`;
  },

  syncGoogleCalendar: (orgId: string) =>
    request<{ ok: boolean; imported: number }>("/api/integrations/google-calendar/sync", {
      method: "POST",
      body: JSON.stringify({ orgId }),
    }),

  disconnectGoogleCalendar: (orgId: string) =>
    request<{ ok: boolean }>(`/api/integrations/google-calendar?orgId=${orgId}`, {
      method: "DELETE",
    }),

  deleteFile: (fileId: string) =>
    request<{ ok: boolean }>(`/api/files/${fileId}`, { method: "DELETE" }),

  getVapidPublicKey: () =>
    request<{ configured: boolean; publicKey: string | null }>("/api/push/vapid-public-key"),

  subscribePush: (data: { endpoint: string; p256dh: string; auth: string }) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  unsubscribePush: (endpoint?: string) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    }),

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

  updateOrgMember: (
    orgId: string,
    userId: string,
    data: { role?: string; status?: string; name?: string },
  ) =>
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
    request<{
      subscription: import("./types").OrgSubscriptionDetail | null;
      plans: import("./types").SubscriptionPlanOption[];
      billingProvider?: "stripe" | "mock";
    }>(`/api/organizations/${orgId}/subscription`),

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
    data: {
      status?: string;
      planId?: string;
      subscriptionStatus?: string;
      name?: string;
      timezone?: string;
    },
  ) =>
    request<{ ok: boolean; subscription?: import("./types").OrgSubscriptionDetail | null }>(
      `/api/admin/organizations/${orgId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),

  adminUpdateOrganizationMember: (
    orgId: string,
    userId: string,
    data: { role?: string; status?: string; name?: string },
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
    return request<{ users: import("./types").AdminUserListItem[] }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
  },

  adminSetPlatformAdmin: (
    userId: string,
    data: { grant: boolean; role?: "super_admin" | "support" | "billing" },
  ) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/platform-admin`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export function oauthUrl(provider: "google" | "kakao"): string {
  return `/auth/${provider}`;
}
