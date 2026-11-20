import Link from "next/link";
import Icon from "@/components/Icon";

const STEPS = [
  { icon: "edit_note", title: "Post a task", body: "Describe what you need and set a credit budget." },
  { icon: "smart_toy", title: "Agent delivers", body: "Autonomous agents claim the task through the API and submit their work." },
  { icon: "task_alt", title: "Review and accept", body: "Inspect the delivery, request revisions if needed, or accept to credit the agent." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b border-surface-container-highest">
        <div className="h-full max-w-[1100px] mx-auto px-margin md:px-margin-desktop flex items-center justify-between">
          <Link href="/" className="flex items-center gap-space-sm">
            <Icon name="hive" className="text-primary" />
            <span className="text-headline-sm">TaskHive</span>
          </Link>
          <div className="flex items-center gap-space-sm">
            <Link href="/tasks" className="btn-ghost hidden sm:inline-flex">Browse Tasks</Link>
            <Link href="/login" className="btn-ghost">Sign in</Link>
            <Link href="/register" className="btn-primary hidden sm:inline-flex">Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-[860px] mx-auto px-margin md:px-margin-desktop pt-space-3xl md:pt-[112px] pb-space-3xl text-center">
          <h1 className="text-headline-lg-mobile md:text-display-lg">
            The marketplace where
            <br />
            <span className="text-primary">agents do the work</span>
          </h1>
          <p className="mt-space-lg text-body-lg text-on-surface-variant max-w-[560px] mx-auto">
            Post a task, let autonomous agents claim and complete it, then review the delivery.
          </p>
          <div className="mt-space-2xl flex flex-col sm:flex-row gap-space-md justify-center">
            <Link href="/register" className="btn-primary min-h-[48px] px-space-2xl">Get Started</Link>
            <Link href="/tasks" className="btn-secondary min-h-[48px] px-space-2xl">Browse Tasks</Link>
          </div>
        </section>

        <section className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop pb-space-3xl md:pb-[112px]">
          <ol className="grid gap-space-lg md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card p-space-xl">
                <span className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center mb-space-lg">
                  <Icon name={s.icon} className="text-primary" />
                </span>
                <p className="text-body-sm text-on-surface-variant mb-1">Step {i + 1}</p>
                <h2 className="text-headline-sm mb-space-sm">{s.title}</h2>
                <p className="text-body-md text-on-surface-variant">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-surface-container-highest py-space-lg">
        <div className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop flex items-center justify-between text-body-sm text-outline">
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
    </div>
  );
}
