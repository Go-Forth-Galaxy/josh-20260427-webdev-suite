"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Code2, Eye, Rocket, Paintbrush, Trash2, ExternalLink } from "lucide-react";
import type { ProjectSummary } from "@/lib/types";

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    const r = await fetch("/api/projects", { cache: "no-store" });
    const j = await r.json();
    setProjects(j.projects || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject() {
    setCreating(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName || "Untitled Project" }),
      });
      const j = await r.json();
      setNewName("");
      if (j.project?.id) {
        window.location.href = `/editor/${j.project.id}`;
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">WebDev Suite</span>
          </div>
          <span className="text-xs text-slate-400">
            Build · Edit · Preview · Deploy
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Your all-in-one{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            web development suite
          </span>
        </h1>
        <p className="mt-4 text-slate-300 max-w-2xl">
          Scaffold a site, edit code and visuals side-by-side, preview live in an isolated
          iframe, and deploy with one click. Every project comes with a live visual HTML &
          style editor.
        </p>

        <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-300">
          <Capability icon={<Paintbrush className="w-4 h-4" />} label="Visual style editor" />
          <Capability icon={<Code2 className="w-4 h-4" />} label="Code editor" />
          <Capability icon={<Eye className="w-4 h-4" />} label="Live preview" />
          <Capability icon={<Rocket className="w-4 h-4" />} label="One-click deploy" />
        </div>
      </section>

      {/* New project */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name (e.g. Landing Page)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") createProject();
            }}
          />
          <button
            onClick={createProject}
            disabled={creating}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating…" : "New Project"}
          </button>
        </div>
      </section>

      {/* Project list */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-4">Projects</h2>
        {projects === null ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
            No projects yet. Create one above to get started.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <li
                key={p.id}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Updated {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteProject(p.id)}
                    className="text-slate-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs">
                  <Link
                    href={`/editor/${p.id}`}
                    className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md"
                  >
                    Open editor
                  </Link>
                  <a
                    href={`/sites/${p.id}/index.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
                  >
                    Deployed <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        WebDev Suite · Built for rapid site creation
      </footer>
    </main>
  );
}

function Capability({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid place-items-center w-6 h-6 rounded-md bg-slate-800">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
