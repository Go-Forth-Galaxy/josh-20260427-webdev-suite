import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProject } from "@/lib/storage";

export const dynamic = "force-dynamic";

// "Deploy" simulates pushing the project to a public static-hosting slot.
// We write the inlined HTML into /public/sites/<id>/index.html which is
// then served at /sites/<id>/ by Next.js — giving the user a working URL.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { html, css, js } = project.files;
  let inlined = html
    .replace(/<link rel="stylesheet" href="styles.css"[^>]*>/, `<style>\n${css}\n</style>`)
    .replace(/<script src="app\.js"><\/script>/, `<script>\n${js}\n</script>`);

  if (!/<style>/i.test(inlined)) {
    inlined = inlined.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`);
  }
  if (!/<script>[\s\S]*<\/script>/i.test(inlined)) {
    inlined = inlined.replace(/<\/body>/i, `<script>\n${js}\n</script>\n</body>`);
  }

  const dir = path.join(process.cwd(), "public", "sites", id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), inlined, "utf8");

  return NextResponse.json({
    ok: true,
    url: `/sites/${id}/index.html`,
    deployedAt: Date.now(),
  });
}
