"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Profile, AuthUser } from "@/lib/types";

interface HeaderProps {
  user: AuthUser | null;
  profile: Profile | null;
  onLogout: () => void;
}

export default function Header({ user, profile, onLogout }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    onLogout();
    router.refresh();
  }

  async function handleAdminLogout() {
    await fetch("/api/admin-logout", { method: "POST" });
    router.push("/admin-login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-lg">🎓</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 leading-tight">Farewell Voting</p>
              <p className="text-xs text-gray-500 leading-tight">Nickname Edition</p>
            </div>
          </Link>

          {/* Auth area */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {(profile?.displayName ?? "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-violet-800">
                    {profile?.displayName ?? profile?.username ?? "You"}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-ghost text-sm px-3 py-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary px-4 py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in to vote
              </Link>
            )}
            <button
              onClick={handleAdminLogout}
              className="btn-ghost text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700"
              title="Exit admin access"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
