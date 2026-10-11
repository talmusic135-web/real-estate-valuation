import { LoginForm } from "@/components/LoginForm";
import { safeNext } from "@/lib/auth/session";

export const metadata = { title: "כניסה | ערך+" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">ערך+</h1>
        <p className="mb-6 text-sm text-slate-600">הערכת שווי דירות למתווכים. הזינו את סיסמת המשרד כדי להיכנס.</p>
        <LoginForm next={safeNext(next)} />
      </div>
    </div>
  );
}
