import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { GlassCard } from "../components/ui/GlassCard";
import { useAuthStore } from "../stores/authStore";
import { useCreateOrganization } from "../hooks/useAuth";

export function OnboardingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const organizations = useAuthStore((s) => s.organizations);
  const createOrg = useCreateOrganization();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (organizations.length > 0) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createOrg.mutateAsync({ name: name.trim() });
    navigate("/");
  };

  return (
    <div className="bg-mesh mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 safe-top safe-bottom">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-400/10">
          <Building2 className="h-8 w-8 text-primary-500" />
        </div>
        <PageHeader
          title="조직 만들기"
          subtitle="팀과 함께 사용할 회사·조직을 설정하세요"
          className="flex-col items-center text-center"
        />
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="조직 이름"
            placeholder="예: TeamCanvas Inc."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" fullWidth disabled={createOrg.isPending}>
            {createOrg.isPending ? "생성 중..." : "시작하기"}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
