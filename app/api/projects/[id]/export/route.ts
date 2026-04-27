import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Build a zip-less single-file export: an HTML file with inlined CSS & JS.
// This is a "deploy-ready" artifact the user can drop on any static host.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { html, css, js } = project.files;

  // Inline CSS and JS references into a single HTML document
  let inlined = html;
  if (inlined.includes('<link rel="stylesheet" href="styles.css"')) {
    inlined = inlined.replace(
      /<link rel="stylesheet" href="styles.css"[^>]*>/,
      `<style>\n${css}\n</style>`,
    );
  } else if (!/<style>/i.test(inlined)) {
    inlined = inlined.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`);
  }

  if (inlined.includes('<script src="app.js"></script>')) {
    inlined = inlined.replace(
      /<script src="app\.js"><\/script>/,
      `<script>\n${js}\n</script>`,
    );
  } else if (!/<script>[\s\S]*<\/script>/i.test(inlined)) {
    inlined = inlined.replace(/<\/body>/i, `<script>\n${js}\n</script>\n</body>`);
  }

  const filename = project.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "site";

  return new NextResponse(inlined, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.html"`,
    },
  });
}
