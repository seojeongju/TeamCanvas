export type User = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: string;
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
};

export type EmailActionResponse = {
  message: string;
  sent?: boolean;
  devLink?: string;
};

export type RegisterResponse = AuthMeResponse & {
  emailVerification?: { sent: boolean; devLink?: string };
};
