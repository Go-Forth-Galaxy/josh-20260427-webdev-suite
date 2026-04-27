import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Project, ProjectSummary } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "projects");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function defaultHtml(name: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="hero">
    <h1 class="hero-title">Welcome to ${name}</h1>
    <p class="hero-sub">Click any element to start editing. Drag to rearrange. Save anytime.</p>
    <a href="#features" class="btn">Get started</a>
  </header>

  <section id="features" class="grid">
    <div class="card">
      <h3>Fast</h3>
      <p>Instant live preview as you edit.</p>
    </div>
    <div class="card">
      <h3>Visual</h3>
      <p>Click-to-edit styles, no code required.</p>
    </div>
    <div class="card">
      <h3>Deploy</h3>
      <p>One click export to a ready-to-host bundle.</p>
    </div>
  </section>

  <footer class="foot">
    <p>Built with WebDev Suite.</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>`;
}

function defaultCss() {
  return `:root {
  --ink: #0b1220;
  --muted: #5b6b86;
  --brand: #4f46e5;
  --bg: #f8fafc;
  --card: #ffffff;
  --border: #e5e7eb;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--ink);
  background: var(--bg);
  line-height: 1.55;
}
.hero {
  padding: 96px 24px;
  text-align: center;
  background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%);
}
.hero-title {
  font-size: 56px;
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}
.hero-sub {
  font-size: 18px;
  color: var(--muted);
  max-width: 620px;
  margin: 0 auto 28px;
}
.btn {
  display: inline-block;
  background: var(--brand);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}
.grid {
  max-width: 1040px;
  margin: 0 auto;
  padding: 72px 24px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}
.card h3 {
  margin: 0 0 8px;
  font-size: 20px;
}
.card p {
  margin: 0;
  color: var(--muted);
}
.foot {
  padding: 32px 24px;
  text-align: center;
  color: var(--muted);
  border-top: 1px solid var(--border);
}
@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
  .hero-title { font-size: 40px; }
}
`;
}

function defaultJs() {
  return `// Project JavaScript
console.log("Hello from your app!");
`;
}

async function readAll(): Promise<Project[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const projects: Project[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
      projects.push(JSON.parse(raw));
    } catch {}
  }
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await readAll();
  return all.map(({ files: _f, ...rest }) => rest);
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createProject(name: string): Promise<Project> {
  await ensureDir();
  const id = nanoid(10);
  const now = Date.now();
  const project: Project = {
    id,
    name: name || "Untitled",
    createdAt: now,
    updatedAt: now,
    files: {
      html: defaultHtml(name || "Untitled"),
      css: defaultCss(),
      js: defaultJs(),
    },
  };
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(project, null, 2));
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "files">>,
): Promise<Project | null> {
  const existing = await getProject(id);
  if (!existing) return null;
  const updated: Project = {
    ...existing,
    name: patch.name ?? existing.name,
    files: patch.files ? { ...existing.files, ...patch.files } : existing.files,
    updatedAt: Date.now(),
  };
  await fs.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(updated, null, 2));
  return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
  await ensureDir();
  try {
    await fs.unlink(path.join(DATA_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
