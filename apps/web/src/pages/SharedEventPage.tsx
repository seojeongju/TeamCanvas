import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Building2 } from "lucide-react";
import { api } from "../lib/api";
import { DeveloperCredit } from "../components/layout/DeveloperCredit";

export function SharedEventPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["shared-event", token],
    queryFn: () => api.getSharedEvent(token!),
    enabled: !!token,
    retry: false,
  });

  const event = data?.event;

  return (
    <div className="bg-mesh flex min-h-dvh flex-col">
      <header className="safe-top mx-auto w-full max-w-lg px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-400 text-xs font-bold text-white">
            TC
          </div>
          <span className="text-sm font-semibold text-navy-800">TeamCanvas</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-12">
        {isLoading && (
          <div className="glass-strong rounded-2xl p-8 text-center text-sm text-navy-500">
            일정을 불러오는 중…
          </div>
        )}

        {isError && (
          <div className="glass-strong rounded-2xl p-8 text-center">
            <p className="text-sm font-medium text-navy-800">공유 링크를 열 수 없습니다</p>
            <p className="mt-2 text-xs text-navy-500">만료되었거나 유효하지 않은 링크입니다.</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-primary-500 hover:underline">
              TeamCanvas 로그인
            </Link>
          </div>
        )}

        {event && (
          <article className="glass-strong rounded-2xl p-6">
            <p className="text-xs font-medium text-primary-500">공유된 일정</p>
            <h1 className="mt-1 text-xl font-bold text-navy-900">{event.title}</h1>

            <div className="mt-4 space-y-3 text-sm text-navy-700">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <span>{event.time}</span>
              </div>
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                  <span>{event.location}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <span>
                  {event.organizationName}
                  {event.teamName ? ` · ${event.teamName}` : ""}
                </span>
              </div>
            </div>

            {event.description && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-white/60 p-3 text-sm text-navy-700">
                {event.description}
              </p>
            )}

            <p className="mt-6 text-center text-[10px] text-navy-400">읽기 전용 · TeamCanvas</p>
          </article>
        )}
      </main>

      <DeveloperCredit />
    </div>
  );
}
