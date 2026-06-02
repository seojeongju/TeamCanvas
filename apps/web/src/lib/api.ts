const API_BASE = "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

  createOrganization: (name: string, slug?: string) =>
    request<{ organization: import("./types").Organization }>("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    }),

  getOrganization: (orgId: string) =>
    request<{ organization: import("./types").Organization; stats: import("./types").OrgStats }>(
      `/api/organizations/${orgId}`,
    ),

  getEvents: (orgId: string, from?: number, to?: number) => {
    const params = new URLSearchParams();
    if (from) params.set("from", String(from));
    if (to) params.set("to", String(to));
    const qs = params.toString();
    return request<{ events: import("./types").CalendarEvent[] }>(
      `/api/organizations/${orgId}/events${qs ? `?${qs}` : ""}`,
    );
  },

  createEvent: (
    orgId: string,
    data: {
      title: string;
      startAt: number;
      endAt: number;
      allDay?: boolean;
      description?: string;
      color?: string;
    },
  ) =>
    request<{ id: string }>(`/api/organizations/${orgId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTasks: (orgId: string) =>
    request<{ tasks: import("./types").Task[] }>(`/api/organizations/${orgId}/tasks`),

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

  getOrgSubscription: (orgId: string) =>
    request<{ subscription: unknown; plans: unknown[] }>(`/api/organizations/${orgId}/subscription`),

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

  adminUpdateOrganization: (
    orgId: string,
    data: { status?: string; planId?: string; subscriptionStatus?: string },
  ) =>
    request<{ ok: boolean }>(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
