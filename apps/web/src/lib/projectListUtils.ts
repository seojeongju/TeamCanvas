import type { Project } from "./types";

export type ProjectSortKey = "updated" | "name" | "progress";

export function sortProjects(projects: Project[], sort: ProjectSortKey): Project[] {
  const list = [...projects];
  switch (sort) {
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    case "progress":
      return list.sort((a, b) => {
        const pa = a.progressPercent ?? -1;
        const pb = b.progressPercent ?? -1;
        if (pb !== pa) return pb - pa;
        return b.updatedAt - a.updatedAt;
      });
    default:
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export function filterProjectsList(
  projects: Project[],
  opts: {
    status?: string;
    teamId?: string;
    mineOnly?: boolean;
    userId?: string;
    query?: string;
  },
): Project[] {
  let list = projects;
  if (opts.status && opts.status !== "all") {
    list = list.filter((p) => p.status === opts.status);
  }
  if (opts.teamId) {
    list = list.filter((p) => p.teamId === opts.teamId);
  }
  if (opts.mineOnly && opts.userId) {
    list = list.filter((p) => p.ownerId === opts.userId || p.isOwner);
  }
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.ownerName.toLowerCase().includes(q),
    );
  }
  return list;
}
