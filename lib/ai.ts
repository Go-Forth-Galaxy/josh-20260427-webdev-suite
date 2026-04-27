// Gemini REST client for the AI editing assistant.
// Uses GOOGLE_AI_API_KEY from the environment.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type FilePatch = {
  html?: string;
  css?: string;
  js?: string;
};

export type AiEditResult = {
  reply: string;
  patch: FilePatch;
  raw?: string;
  error?: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const SYSTEM_PROMPT = `You are an expert web-design coding assistant embedded in a live visual editor.

The user is working on a single-page web project made of exactly three files:
- index.html
- styles.css  (linked as <link rel="stylesheet" href="styles.css">)
- app.js      (loaded as <script src="app.js">)

Your job: read the user's request and the current files, then return updated file contents that fulfill the request.

RULES
1. Respond with ONLY a valid JSON object, no markdown fences, no prose outside JSON.
2. Shape:
   {
     "reply": "<one or two short sentences summarizing what you changed>",
     "patch": {
       "html": "<full new HTML, only if you changed it>",
       "css":  "<full new CSS, only if you changed it>",
       "js":   "<full new JS, only if you changed it>"
     }
   }
3. Include only the files you actually modified. If you didn't change a file, OMIT its key — do not return an empty string.
4. When you DO include a file, return its COMPLETE new contents (not a diff, not a fragment).
5. Preserve existing structure, classes, IDs, copy, and images unless the user asks to change them.
6. Keep the change minimal and focused on the user's request. Don't rewrite unrelated sections.
7. No external CDN links, no new dependencies, no imports. Plain HTML/CSS/JS only.
8. If the user's request is ambiguous or unsafe, ask for clarification in "reply" and return an empty "patch": {}.
9. Do not invent files besides html/css/js.
10. Valid JSON: escape newlines inside strings as \\n, escape quotes as \\".`;

function buildUserTurn(message: string, files: { html: string; css: string; js: string }) {
  return `USER REQUEST:
${message}

CURRENT FILES:

=== index.html ===
${files.html}

=== styles.css ===
${files.css}

=== app.js ===
${files.js}

Respond with the JSON object described in the rules.`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  // Strip ```json ... ``` fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // Otherwise find the first { and last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

export async function aiEditProject({
  message,
  history,
  files,
}: {
  message: string;
  history: ChatTurn[];
  files: { html: string; css: string; js: string };
}): Promise<AiEditResult> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return {
      reply: "AI is not configured — missing GOOGLE_AI_API_KEY on the server.",
      patch: {},
      error: "missing_api_key",
    };
  }

  // Build Gemini "contents" — alternating user/model turns, ending with this user turn.
  const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
  for (const turn of history.slice(-8)) {
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: buildUserTurn(message, files) }],
  });

  const body = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  let resp: Response;
  try {
    resp = await fetch(`${GEMINI_URL(GEMINI_MODEL)}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      reply: "Network error talking to Gemini.",
      patch: {},
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return {
      reply: `Gemini API error (${resp.status}). ${errText.slice(0, 200)}`,
      patch: {},
      error: `http_${resp.status}`,
    };
  }

  const data = await resp.json().catch(() => null);
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
    "";

  if (!text) {
    return {
      reply: "Gemini returned no content. Try rephrasing.",
      patch: {},
      error: "empty_response",
      raw: JSON.stringify(data).slice(0, 400),
    };
  }

  let parsed: { reply?: string; patch?: FilePatch } | null = null;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    // Fall back: return the raw text as the reply, no patch
    return {
      reply: text.slice(0, 500),
      patch: {},
      error: "invalid_json",
      raw: text.slice(0, 600),
    };
  }

  const patch: FilePatch = {};
  if (parsed?.patch && typeof parsed.patch === "object") {
    if (typeof parsed.patch.html === "string" && parsed.patch.html.trim()) patch.html = parsed.patch.html;
    if (typeof parsed.patch.css === "string" && parsed.patch.css.trim()) patch.css = parsed.patch.css;
    if (typeof parsed.patch.js === "string" && parsed.patch.js.trim()) patch.js = parsed.patch.js;
  }

  return {
    reply: typeof parsed?.reply === "string" ? parsed.reply : "Updated your project.",
    patch,
  };
}
