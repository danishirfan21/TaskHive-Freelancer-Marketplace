"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";

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
  const [authError, setAuthError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ id?: number; userId?: number; email: string }>("/auth/me")
      .then(me => {
        if (!cancelled) setSession({ userId: (me.id ?? me.userId) as number, email: me.email });
      })
      .catch(err => {
        if (cancelled) return;
        // Only a real 401 means "signed out"; a server hiccup must not bounce the user to login.
        const signedOut = err instanceof ApiError && err.status === 401;
        if (signedOut) {
          if (requireAuth) router.replace("/login");
        } else if (requireAuth) {
          setAuthError(true);
        }
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

  const accountMenu = (popover: string, trigger = "w-9 h-9 md:w-8 md:h-8") =>
    session && (
      <div className="relative">
        <button
          type="button"
          aria-label="Account menu"
          onClick={() => setMenuOpen(o => !o)}
          className={`${trigger} rounded-full bg-primary-container text-on-primary-container flex items-center justify-center`}
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
            <div className={`absolute ${popover} w-56 rounded-xl bg-surface-container-high p-space-sm shadow-xl`}>
              <p className="px-space-md py-space-sm text-body-sm text-on-surface-variant truncate">{session.email}</p>
              <button type="button" onClick={logout} className="btn-ghost w-full justify-start">
                <Icon name="logout" size={18} />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    );

  const blocked = requireAuth && (!ready || !session);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tablet icon rail */}
      <aside className="hidden md:max-lg:flex fixed inset-y-0 left-0 z-50 w-[88px] flex-col items-center py-space-lg gap-space-sm bg-surface-container-lowest border-r border-surface-container-highest">
        <Link href="/tasks" aria-label="TaskHive" className="w-11 h-11 mb-space-md rounded-lg bg-surface-container-high flex items-center justify-center">
          <Icon name="hive" className="text-primary" />
        </Link>
        {NAV.map(n => (
          <Link
            key={n.href}
            href={n.href}
            aria-label={n.full}
            title={n.full}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              isActive(pathname, n.href)
                ? "bg-surface-container-high text-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Icon name={n.icon} size={24} />
          </Link>
        ))}
        <span className="w-8 border-t border-outline-variant/50 my-space-sm" />
        <Link
          href="/tasks/create"
          aria-label="New Task"
          title="New Task"
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            pathname === "/tasks/create" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          <Icon name="add" size={24} />
        </Link>
        <div className="mt-auto">
          {session ? (
            accountMenu("left-full bottom-0 ml-2", "w-10 h-10")
          ) : (
            <Link href="/login" aria-label="Sign in" className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <Icon name="person" size={18} />
            </Link>
          )}
        </div>
      </aside>

      <header className="md:max-lg:hidden sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-highest">
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
                {accountMenu("right-0 mt-2")}
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

      <main className="flex-1 w-full md:max-lg:pl-[calc(88px+2rem)] max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-xl pb-28 md:pb-space-3xl">
        {blocked && authError ? (
          <div className="py-space-3xl text-center">
            <p className="text-body-lg">Couldn&apos;t reach the server.</p>
            <button type="button" className="btn-secondary mt-space-lg" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : blocked ? (
          <div className="py-space-3xl">
            <LoadingSpinner size={28} inline={false} />
          </div>
        ) : (
          <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        )}
      </main>

      <footer className="hidden md:block md:max-lg:pl-[88px] border-t border-surface-container-highest py-space-lg">
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
