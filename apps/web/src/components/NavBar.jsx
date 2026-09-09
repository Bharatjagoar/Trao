"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

export function NavBar() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Interview Prep Kit
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-black/60 dark:text-white/60">{user.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex gap-3 text-sm">
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
            <Link href="/register" className="hover:underline">
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
