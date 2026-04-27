"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Eye,
  Rocket,
  Download,
  Save,
  Paintbrush,
  FileText,
  MousePointer2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { buildSrcDoc } from "@/lib/editor-script";
import ChatPanel from "./ChatPanel";

type Tab = "visual" | "html" | "css" | "js";

type Selection = {
  path: number[];
  tag: string;
  id: string;
  className: string;
  text: string | null;
  styles: Record<string, string>;
  inlineStyle: string;
};

// ---- Helpers to mutate HTML source from selection path ----
function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
function serializeHtml(doc: Document): string {
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
function navigate(doc: Document, path: number[]): Element | null {
  let el: Element | null = doc.documentElement;
  for (const i of path) {
    if (!el || !el.children[i]) return null;
    el = el.children[i];
  }
  return el;
}

function setInlineStyle(
  html: string,
  path: number[],
  prop: string,
  value: string,
): string {
  const doc = parseHtml(html);
  const el = navigate(doc, path);
  if (!el) return html;
  const h = el as HTMLElement;
  if (value === "" || value === null) {
    h.style.removeProperty(prop);
  } else {
    h.style.setProperty(prop, value);
  }
  if (!h.getAttribute("style")) h.removeAttribute("style");
  return serializeHtml(doc);
}
function setText(html: string, path: number[], text: string): string {
  const doc = parseHtml(html);
  const el = navigate(doc, path);
  if (!el) return html;
  if (el.children.length === 0) el.textContent = text;
  return serializeHtml(doc);
}

export default function EditorClient({ initialProject }: { initialProject: Project }) {
  const [project, setProject] = useState<Project>(initialProject);
  const [tab, setTab] = useState<Tab>("visual");
  const [sideTab, setSideTab] = useState<"styles" | "ai">("styles");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Build srcdoc on change
  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: project.files.html,
        css: project.files.css,
        js: project.files.js,
        withEditor: tab === "visual",
      }),
    [project.files.html, project.files.css, project.files.js, tab],
  );

  // Receive messages from iframe (selection, etc.)
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const d = ev.data;
      if (!d || !d.__webdev) return;
      if (d.type === "select") {
        setSelection({
          path: d.path,
          tag: d.tag,
          id: d.id,
          className: d.className,
          text: d.text,
          styles: d.styles,
          inlineStyle: d.inlineStyle || "",
        });
      } else if (d.type === "ready") {
        // iframe finished loading editor script; replay selection if any
        if (selection) {
          iframeRef.current?.contentWindow?.postMessage(
            { __webdev: true, type: "reselect-path", path: selection.path },
            "*",
          );
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selection]);

  // ---- actions ----
  const updateFile = (k: "html" | "css" | "js", v: string) => {
    setProject((p) => ({ ...p, files: { ...p.files, [k]: v } }));
    setDirty(true);
  };

  const applyStyle = (prop: string, value: string) => {
    if (!selection) return;
    const newHtml = setInlineStyle(project.files.html, selection.path, prop, value);
    setProject((p) => ({ ...p, files: { ...p.files, html: newHtml } }));
    setDirty(true);
    // update local selection so panel reflects live value
    setSelection((s) =>
      s ? { ...s, styles: { ...s.styles, [camel(prop)]: value } } : s,
    );
  };

  const applyText = (text: string) => {
    if (!selection) return;
    const newHtml = setText(project.files.html, selection.path, text);
    setProject((p) => ({ ...p, files: { ...p.files, html: newHtml } }));
    setSelection((s) => (s ? { ...s, text } : s));
    setDirty(true);
  };

  const save = useCallback(async () => {
    setSaving(true);
    setStatus("Saving…");
    try {
      const r = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: project.name, files: project.files }),
      });
      const j = await r.json();
      if (j.project) {
        setProject(j.project);
        setDirty(false);
        setStatus("Saved");
        setTimeout(() => setStatus(""), 1500);
      } else {
        setStatus("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }, [project.id, project.name, project.files]);

  const deploy = async () => {
    if (dirty) await save();
    setDeploying(true);
    setStatus("Deploying…");
    try {
      const r = await fetch(`/api/projects/${project.id}/deploy`, { method: "POST" });
      const j = await r.json();
      if (j.url) {
        setDeployedUrl(j.url);
        setStatus("Deployed");
        setTimeout(() => setStatus(""), 2500);
      } else {
        setStatus("Deploy failed");
      }
    } finally {
      setDeploying(false);
    }
  };

  // Cmd/Ctrl+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-100 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Projects
          </Link>
          <span className="text-slate-700">|</span>
          <input
            className="bg-transparent font-medium text-sm outline-none min-w-[160px]"
            value={project.name}
            onChange={(e) => {
              setProject((p) => ({ ...p, name: e.target.value }));
              setDirty(true);
            }}
          />
          {dirty && <span className="text-xs text-amber-400">● unsaved</span>}
          {!dirty && status && <span className="text-xs text-emerald-400">{status}</span>}
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 text-sm">
          <TabBtn active={tab === "visual"} onClick={() => setTab("visual")} icon={<MousePointer2 className="w-3.5 h-3.5" />}>
            Visual
          </TabBtn>
          <TabBtn active={tab === "html"} onClick={() => setTab("html")} icon={<FileText className="w-3.5 h-3.5" />}>
            HTML
          </TabBtn>
          <TabBtn active={tab === "css"} onClick={() => setTab("css")} icon={<Paintbrush className="w-3.5 h-3.5" />}>
            CSS
          </TabBtn>
          <TabBtn active={tab === "js"} onClick={() => setTab("js")} icon={<Code2 className="w-3.5 h-3.5" />}>
            JS
          </TabBtn>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
          </button>
          <a
            href={`/api/projects/${project.id}/export`}
            className="inline-flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </a>
          <button
            onClick={deploy}
            disabled={deploying}
            className="inline-flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            <Rocket className="w-3.5 h-3.5" /> {deploying ? "Deploying…" : "Deploy"}
          </button>
          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        {/* Main work area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {tab === "visual" ? (
            <div className="flex-1 min-h-0 bg-slate-900 relative">
              <div className="absolute top-2 left-2 z-10 bg-slate-800/90 text-xs px-2 py-1 rounded text-slate-300 inline-flex items-center gap-1.5">
                <MousePointer2 className="w-3 h-3" /> Click any element in the preview to edit it
              </div>
              <iframe
                ref={iframeRef}
                key={srcDoc.length + ":visual"}
                className="w-full h-full bg-white"
                srcDoc={srcDoc}
                title="Visual editor preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-cols-2">
              <div className="flex flex-col border-r border-slate-800 min-h-0">
                <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                  <span>{tab === "html" ? "index.html" : tab === "css" ? "styles.css" : "app.js"}</span>
                </div>
                <textarea
                  className="flex-1 bg-slate-950 text-slate-100 font-mono text-sm p-3 outline-none resize-none leading-relaxed"
                  spellCheck={false}
                  value={project.files[tab]}
                  onChange={(e) => updateFile(tab, e.target.value)}
                />
              </div>
              <div className="flex flex-col min-h-0">
                <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900 flex items-center gap-1.5">
                  <Eye className="w-3 h-3" /> Live preview
                </div>
                <iframe
                  key={srcDoc.length + ":" + tab}
                  className="flex-1 bg-white"
                  srcDoc={srcDoc}
                  title="Live preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar: Styles (visual only) + AI Assistant (always) */}
        <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col min-h-0">
          <div className="flex items-center gap-1 p-1 border-b border-slate-800 bg-slate-950/40">
            {tab === "visual" && (
              <SideTabBtn
                active={sideTab === "styles"}
                onClick={() => setSideTab("styles")}
                icon={<Paintbrush className="w-3 h-3" />}
              >
                Styles
              </SideTabBtn>
            )}
            <SideTabBtn
              active={sideTab === "ai" || tab !== "visual"}
              onClick={() => setSideTab("ai")}
              icon={<Sparkles className="w-3 h-3 text-indigo-400" />}
            >
              AI Assistant
            </SideTabBtn>
          </div>

          {tab === "visual" && sideTab === "styles" ? (
            <>
              <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center gap-1.5">
                <Paintbrush className="w-3 h-3" /> Style editor
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {!selection ? (
                  <div className="text-sm text-slate-500">
                    Click an element in the preview to edit its styles.
                  </div>
                ) : (
                  <StylePanel selection={selection} applyStyle={applyStyle} applyText={applyText} />
                )}
              </div>
            </>
          ) : (
            <ChatPanel
              projectId={project.id}
              onProjectUpdated={(next) => {
                setProject(next);
                setDirty(false);
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function SideTabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium " +
        (active
          ? "bg-slate-800 text-slate-100"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm " +
        (active ? "bg-slate-950 text-slate-100" : "text-slate-400 hover:text-slate-200")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function camel(prop: string) {
  return prop.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
}

function rgbToHex(rgb: string): string {
  // e.g. "rgb(79, 70, 229)" or "rgba(0,0,0,0)"
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function StylePanel({
  selection,
  applyStyle,
  applyText,
}: {
  selection: Selection;
  applyStyle: (prop: string, value: string) => void;
  applyText: (text: string) => void;
}) {
  const s = selection.styles;
  return (
    <>
      <div className="text-xs text-slate-400">Selected</div>
      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-sm">
        <span className="text-fuchsia-300">{selection.tag}</span>
        {selection.id && <span className="text-indigo-300">#{selection.id}</span>}
        {selection.className && (
          <span className="text-emerald-300">
            .{selection.className.split(/\s+/).filter(Boolean).join(".")}
          </span>
        )}
      </div>

      {selection.text !== null && (
        <Field label="Text content">
          <textarea
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
            value={selection.text}
            onChange={(e) => applyText(e.target.value)}
            rows={2}
          />
        </Field>
      )}

      <Group title="Typography">
        <Field label="Color">
          <ColorInput value={rgbToHex(s.color || "")} onChange={(v) => applyStyle("color", v)} />
        </Field>
        <Field label="Font size">
          <TextInput value={s.fontSize || ""} placeholder="16px" onChange={(v) => applyStyle("font-size", v)} />
        </Field>
        <Field label="Font weight">
          <SelectInput
            value={s.fontWeight || ""}
            onChange={(v) => applyStyle("font-weight", v)}
            options={["", "300", "400", "500", "600", "700", "800", "900"]}
          />
        </Field>
        <Field label="Text align">
          <SelectInput
            value={s.textAlign || ""}
            onChange={(v) => applyStyle("text-align", v)}
            options={["", "left", "center", "right", "justify"]}
          />
        </Field>
      </Group>

      <Group title="Background">
        <Field label="Background color">
          <ColorInput
            value={rgbToHex(s.backgroundColor || "")}
            onChange={(v) => applyStyle("background-color", v)}
          />
        </Field>
      </Group>

      <Group title="Box">
        <Field label="Padding">
          <TextInput value={s.padding || ""} placeholder="0px" onChange={(v) => applyStyle("padding", v)} />
        </Field>
        <Field label="Margin">
          <TextInput value={s.margin || ""} placeholder="0px" onChange={(v) => applyStyle("margin", v)} />
        </Field>
        <Field label="Border radius">
          <TextInput value={s.borderRadius || ""} placeholder="0px" onChange={(v) => applyStyle("border-radius", v)} />
        </Field>
        <Field label="Display">
          <SelectInput
            value={s.display || ""}
            onChange={(v) => applyStyle("display", v)}
            options={["", "block", "inline", "inline-block", "flex", "grid", "none"]}
          />
        </Field>
      </Group>

      <Group title="Size">
        <Field label="Width">
          <TextInput value={s.width || ""} placeholder="auto" onChange={(v) => applyStyle("width", v)} />
        </Field>
        <Field label="Height">
          <TextInput value={s.height || ""} placeholder="auto" onChange={(v) => applyStyle("height", v)} />
        </Field>
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
    />
  );
}
function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o || "(default)"}
        </option>
      ))}
    </select>
  );
}
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500 font-mono"
      />
    </div>
  );
}
