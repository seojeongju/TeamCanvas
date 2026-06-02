export const mockEvents = [
  {
    id: "1",
    title: "주간 스프린트 회의",
    time: "10:00 - 11:00",
    team: "개발팀",
    color: "bg-primary-400",
  },
  {
    id: "2",
    title: "디자인 리뷰",
    time: "14:00 - 15:00",
    team: "디자인팀",
    color: "bg-violet-400",
  },
  {
    id: "3",
    title: "고객사 미팅",
    time: "16:30 - 17:30",
    team: "영업팀",
    color: "bg-emerald-400",
  },
];

export const mockTasks = [
  { id: "1", title: "API 스펙 검토", status: "todo" as const, assignee: "준호", due: "오늘" },
  { id: "2", title: "PWA 아이콘 제작", status: "doing" as const, assignee: "수진", due: "내일" },
  { id: "3", title: "D1 마이그레이션", status: "doing" as const, assignee: "민지", due: "6/5" },
  { id: "4", title: "OAuth 연동 테스트", status: "done" as const, assignee: "준호", due: "완료" },
];

export const mockNotifications = [
  { id: "1", title: "회의 리마인더", body: "10분 후 주간 스프린트 회의", time: "5분 전", unread: true },
  { id: "2", title: "새 업무 배정", body: "PWA 아이콘 제작 업무가 배정되었습니다", time: "1시간 전", unread: true },
  { id: "3", title: "RSVP 변경", body: "준호님이 디자인 리뷰에 참석합니다", time: "3시간 전", unread: false },
];

export const mockOrg = {
  name: "TeamCanvas Inc.",
  members: 24,
  teams: 5,
  eventsToday: 3,
};
