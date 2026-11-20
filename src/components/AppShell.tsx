"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch } from "@/lib/apiFetch";

export interface Session {
  userId: number;
  email: string;
}

const SessionContext = createContext<Session | null>(null);
export const useSession = () => useContext(SessionContext);

const NAV = [
  { href: "/tasks", label: "Browse", full: "Browse Tasks", icon: "explore" },
  { href: "/dashboard", label: "My Tasks", full: "My Tasks", icon: "checklist" },
  { href: "/agents", label: "Agents", full: "Agents", icon: "smart_toy" },
];

function isActive(pathname: string, href: string) {
  if (href === "/tasks") return pathname === "/tasks" || (pathname.startsWith("/tasks/") && !pathname.startsWith("/tasks/create"));
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Page chrome: top bar, mobile bottom nav, footer. Resolves the session once.
 * With requireAuth, unauthenticated visitors are sent to /login.
 */
export default function AppShell({
  children,
  requireAuth = true,
  title,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  /** Shown in the mobile top bar */
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ id?: number; userId?: number; email: string }>("/auth/me")
      .then(me => {
        if (!cancelled) setSession({ userId: (me.id ?? me.userId) as number, email: me.email });
      })
      .catch(() => {
        if (!cancelled && requireAuth) router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requireAuth, router]);

  async function logout() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  const blocked = requireAuth && (!ready || !session);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-highest">
        <div className="h-14 max-w-[1100px] mx-auto px-margin md:px-margin-desktop flex items-center justify-between">
          <div className="flex items-center gap-space-xl min-w-0">
            <Link href="/tasks" className="flex items-center gap-space-sm group shrink-0">
              <span className="w-9 h-9 md:w-auto md:h-auto rounded-lg bg-surface-container-high md:bg-transparent flex items-center justify-center">
                <Icon name="hive" className="text-primary" />
              </span>
              {title && (
                <span className="md:hidden flex flex-col leading-tight">
                  <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">TaskHive</span>
                  <span className="text-headline-sm text-on-surface">{title}</span>
                </span>
              )}
              <span className={`text-headline-sm text-on-surface group-hover:text-primary transition-colors ${title ? "hidden md:inline" : ""}`}>
                TaskHive
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-space-lg">
              {NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`h-14 flex items-center px-space-xs text-label-md transition-colors border-b-2 ${
                    isActive(pathname, n.href)
                      ? "text-on-surface border-primary"
                      : "text-on-surface-variant border-transparent hover:text-on-surface"
                  }`}
                >
                  {n.full}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-space-md">
            {session ? (
              <>
                <Link href="/tasks/create" className="btn-primary hidden md:inline-flex min-h-[32px] px-space-md">
                  <Icon name="add" size={16} />
                  New Task
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Account menu"
                    onClick={() => setMenuOpen(o => !o)}
                    className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center"
                  >
                    <Icon name="person" size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close menu"
                        className="fixed inset-0 cursor-default"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-container-high p-space-sm shadow-xl">
                        <p className="px-space-md py-space-sm text-body-sm text-on-surface-variant truncate">{session.email}</p>
                        <button type="button" onClick={logout} className="btn-ghost w-full justify-start">
                          <Icon name="logout" size={18} />
                          Log out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Sign in</Link>
                <Link href="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-xl pb-28 md:pb-space-3xl">
        {blocked ? (
          <div className="py-space-3xl">
            <LoadingSpinner size={28} inline={false} />
          </div>
        ) : (
          <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        )}
      </main>

      <footer className="hidden md:block border-t border-surface-container-highest py-space-lg">
        <div className="max-w-[1100px] mx-auto px-margin-desktop flex items-center justify-between text-body-sm text-outline">
          <span className="flex items-center gap-space-xs">
            <Icon name="hive" size={14} className="text-primary" />
            TaskHive
          </span>
          <a
            href="https://github.com/danishirfan21/TaskHive-Freelancer-Marketplace#readme"
            target="_blank"
            rel="noreferrer"
            className="hover:text-on-surface transition-colors"
          >
            API Docs
          </a>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-highest">
        <div className="grid grid-cols-4 h-16 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-body-sm ${
                isActive(pathname, n.href) ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <Icon name={n.icon} size={22} />
              {n.label}
            </Link>
          ))}
          <Link
            href="/tasks/create"
            className={`flex flex-col items-center justify-center gap-0.5 text-body-sm ${
              pathname === "/tasks/create" ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            <span className="w-10 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <Icon name="add" size={22} />
            </span>
            New Task
          </Link>
        </div>
      </nav>
    </div>
  );
}
