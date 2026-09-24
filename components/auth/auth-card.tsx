import Image from "next/image";
import { AuthBackground } from "@/components/auth/auth-background";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10">
      <AuthBackground />
      <div className="relative w-full max-w-[400px]">
        {/* Logo — already white artwork on transparent ground */}
        <div className="mb-10 mt-2 flex justify-center">
          <Image
            src="/logo-main.svg"
            alt="Traqen"
            width={320}
            height={140}
            className="h-20 w-auto md:h-[120px]"
            unoptimized
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-card border border-white/10 bg-[#0B0B0B] px-7 py-8">
          <div className="mb-7">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-white/50">{subtitle}</p>
            <div className="mt-3 h-px w-10 bg-white/25" />
          </div>

          {children}
        </div>

        <p className="mt-6 text-center text-2xs text-white/30">
          Every application, hackathon and task — tracked in one place.
        </p>
      </div>
    </div>
  );
}
