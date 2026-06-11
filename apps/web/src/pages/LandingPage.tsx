import { Link } from "react-router-dom";
import { Calendar, CheckSquare, Users, Bell, Smartphone } from "lucide-react";
import { Button } from "../components/ui/Button";
import { DeveloperCredit } from "../components/layout/DeveloperCredit";

const FEATURES = [
  {
    icon: Calendar,
    title: "통합 캘린더",
    desc: "월·주·일 뷰, 반복 일정, Google 캘린더 연동",
  },
  {
    icon: CheckSquare,
    title: "업무 보드",
    desc: "Kanban·라벨·체크리스트로 업무 관리",
  },
  {
    icon: Users,
    title: "조직·팀 협업",
    desc: "RBAC, 초대, 팀별 일정 가시성",
  },
  {
    icon: Bell,
    title: "알림",
    desc: "일정 리마인더, Web Push, 인앱 알림",
  },
  {
    icon: Smartphone,
    title: "PWA",
    desc: "모바일 설치, 어디서나 빠른 접근",
  },
] as const;

export function LandingPage() {
  return (
    <div className="bg-mesh min-h-dvh">
      <header className="safe-top mx-auto flex max-w-lg items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-400 text-sm font-bold text-white shadow-glow">
            TC
          </div>
          <span className="text-lg font-semibold text-navy-900">TeamCanvas</span>
        </div>
        <Link to="/login">
          <Button variant="secondary" className="min-h-9 px-4 text-sm">
            로그인
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-16 pt-6">
        <section className="glass-strong rounded-3xl p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-500">
            팀 협업 SaaS
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-navy-900">
            일정과 업무를
            <br />
            하나의 캔버스에서
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-navy-600">
            10~200명 팀을 위한 가벼운 일정·업무 통합 PWA.
            Google·카카오 로그인으로 바로 시작하세요.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/login" className="flex-1 sm:flex-initial">
              <Button className="w-full min-h-11">무료로 시작하기</Button>
            </Link>
            <Link to="/login" className="flex-1 sm:flex-initial">
              <Button variant="secondary" className="w-full min-h-11">
                데모 체험
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-center text-sm font-semibold text-navy-800">주요 기능</h2>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass flex items-start gap-3 rounded-2xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-navy-900">{title}</p>
                  <p className="mt-0.5 text-xs text-navy-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 glass rounded-2xl p-5 text-center">
          <p className="text-sm font-medium text-navy-800">지금 팀에 도입해 보세요</p>
          <p className="mt-1 text-xs text-navy-500">설치 없이 브라우저에서 · PWA 홈 화면 추가 지원</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button className="min-h-10 px-6">시작하기</Button>
          </Link>
        </section>
      </main>

      <DeveloperCredit />
    </div>
  );
}
