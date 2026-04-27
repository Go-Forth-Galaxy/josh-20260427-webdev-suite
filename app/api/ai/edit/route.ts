import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage";
import { aiEditProject, type ChatTurn } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  projectId?: string;
  message?: string;
  history?: ChatTurn[];
  apply?: boolean; // when true, persist the patch to the project on disk
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history.filter(
    (t): t is ChatTurn =>
      !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
  ) : [];
  const apply = body.apply !== false; // default true

  if (!projectId || !message) {
    return NextResponse.json(
      { error: "projectId and message are required" },
      { status: 400 },
    );
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const result = await aiEditProject({
    message,
    history,
    files: project.files,
  });

  let updatedProject = project;
  const changed: string[] = [];
  if (apply && (result.patch.html || result.patch.css || result.patch.js)) {
    const nextFiles = { ...project.files };
    if (result.patch.html) {
      nextFiles.html = result.patch.html;
      changed.push("html");
    }
    if (result.patch.css) {
      nextFiles.css = result.patch.css;
      changed.push("css");
    }
    if (result.patch.js) {
      nextFiles.js = result.patch.js;
      changed.push("js");
    }
    const saved = await updateProject(projectId, { files: nextFiles });
    if (saved) updatedProject = saved;
  }

  return NextResponse.json({
    reply: result.reply,
    patch: result.patch,
    changed,
    project: updatedProject,
    error: result.error ?? null,
  });
}
