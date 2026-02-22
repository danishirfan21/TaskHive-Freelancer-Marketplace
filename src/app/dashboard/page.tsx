"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TaskCard from "@/components/TaskCard";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import Link from "next/link";

interface Task {
  id: number;
  title: string;
  description: string;
  budget: number;
  status: string;
  claimedBy?: number | null;
  posterId: number;
  createdAt: string;
  deliverables?: Array<{
    content: string;
    status: string;
    revisionNumber: number;
  }>;
}

interface Session {
  userId: number;
  email: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch<Task[]>("/tasks/my");
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load tasks"));
    }
  }, []);

  useEffect(() => {
    async function init() {
      // Verify session is valid
      try {
        const me = await apiFetch<Session>("/auth/me");
        setSession(me);
      } catch {
        router.push("/login");
        return;
      }
      await fetchTasks();
      setLoading(false);
    }
    init();
  }, [router, fetchTasks]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <LoadingSpinner size={32} inline={false} />
      </div>
    );
  }

  const openTasks = tasks.filter(t => t.status === "OPEN");
  const activeTasks = tasks.filter(t => ["CLAIMED", "DELIVERED"].includes(t.status));
  const doneTasks = tasks.filter(t => ["ACCEPTED", "CANCELED"].includes(t.status));

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>My Tasks</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
              Operator: {session?.email}
            </p>
          </div>
          <Link href="/tasks/create">
            <button className="btn-primary">+ New Task</button>
          </Link>
        </div>

        <ErrorAlert error={error} />

        {tasks.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#4b5563" }}>
            <p style={{ fontSize: "1rem" }}>No tasks yet.</p>
            <Link href="/tasks/create">
              <button className="btn-primary" style={{ marginTop: "1rem" }}>Create your first task</button>
            </Link>
          </div>
        )}

        {openTasks.length > 0 && (
          <Section title="Open">
            {openTasks.map(t => (
              <TaskCard key={t.id} task={t} currentUserId={session?.userId ?? 0} onRefresh={fetchTasks} />
            ))}
          </Section>
        )}

        {activeTasks.length > 0 && (
          <Section title="In Progress">
            {activeTasks.map(t => (
              <TaskCard key={t.id} task={t} currentUserId={session?.userId ?? 0} onRefresh={fetchTasks} />
            ))}
          </Section>
        )}

        {doneTasks.length > 0 && (
          <Section title="Completed / Canceled">
            {doneTasks.map(t => (
              <TaskCard key={t.id} task={t} currentUserId={session?.userId ?? 0} onRefresh={fetchTasks} />
            ))}
          </Section>
        )}
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#4b5563",
        margin: "0 0 0.75rem",
        borderBottom: "1px solid #1f1f1f",
        paddingBottom: "0.5rem",
      }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {children}
      </div>
    </section>
  );
}
