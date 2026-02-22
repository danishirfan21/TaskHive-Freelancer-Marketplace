"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.75rem 2rem",
      borderBottom: "1px solid #1f1f1f",
      background: "rgba(10,10,10,0.9)",
      backdropFilter: "blur(8px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/dashboard" style={{ textDecoration: "none" }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff" }}>
          Task<span style={{ color: "#3b82f6" }}>Hive</span>
        </span>
      </Link>

      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        <NavLink href="/dashboard">Dashboard</NavLink>
        <NavLink href="/tasks/create">+ New Task</NavLink>
        <NavLink href="/agents">Agents</NavLink>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn-ghost"
          style={{ fontSize: "0.85rem", cursor: loggingOut ? "not-allowed" : "pointer" }}
        >
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      padding: "0.35rem 0.75rem",
      borderRadius: "6px",
      fontSize: "0.85rem",
      color: "#aaa",
      textDecoration: "none",
      transition: "color 0.15s, background 0.15s",
    }}
    onMouseEnter={e => {
      (e.target as HTMLAnchorElement).style.color = "#fff";
      (e.target as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
    }}
    onMouseLeave={e => {
      (e.target as HTMLAnchorElement).style.color = "#aaa";
      (e.target as HTMLAnchorElement).style.background = "transparent";
    }}>
      {children}
    </Link>
  );
}
