import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const project = await createProject(name || "Untitled Project");
  return NextResponse.json({ project }, { status: 201 });
}
