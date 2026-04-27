import { getProject } from "@/lib/storage";
import { notFound } from "next/navigation";
import EditorClient from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return <EditorClient initialProject={project} />;
}
