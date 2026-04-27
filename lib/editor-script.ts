// Script injected into the preview iframe to enable visual editing.
// The outer IIFE is serialized into the srcDoc so it runs in the iframe context.
export const EDITOR_SCRIPT = `
(function() {
  if (window.__webdevEditor) return;
  window.__webdevEditor = true;

  function getPath(el) {
    var path = [];
    while (el && el.parentElement) {
      var parent = el.parentElement;
      var idx = Array.prototype.indexOf.call(parent.children, el);
      path.unshift(idx);
      el = parent;
      if (el === document.documentElement) break;
    }
    return path;
  }
  function navigate(path) {
    var el = document.documentElement;
    for (var i = 0; i < path.length; i++) {
      if (!el.children[path[i]]) return null;
      el = el.children[path[i]];
    }
    return el;
  }

  var hoverOverlay = document.createElement('div');
  hoverOverlay.setAttribute('data-editor-artifact', '1');
  hoverOverlay.style.cssText =
    'position:fixed;pointer-events:none;border:2px dashed #6366f1;' +
    'background:rgba(99,102,241,0.08);z-index:2147483646;' +
    'transition:all 60ms ease-out;display:none;';
  var selectOverlay = document.createElement('div');
  selectOverlay.setAttribute('data-editor-artifact', '1');
  selectOverlay.style.cssText =
    'position:fixed;pointer-events:none;border:2px solid #e11d48;' +
    'box-shadow:0 0 0 1px rgba(225,29,72,0.25);z-index:2147483647;' +
    'transition:all 60ms ease-out;display:none;';
  var label = document.createElement('div');
  label.setAttribute('data-editor-artifact', '1');
  label.style.cssText =
    'position:fixed;z-index:2147483647;background:#e11d48;color:#fff;' +
    'font:11px/1.2 -apple-system,sans-serif;padding:2px 6px;border-radius:3px;' +
    'pointer-events:none;display:none;';

  function isArtifact(el) {
    while (el) {
      if (el.getAttribute && el.getAttribute('data-editor-artifact')) return true;
      el = el.parentElement;
    }
    return false;
  }

  function posOverlay(ov, el) {
    var r = el.getBoundingClientRect();
    ov.style.left = r.left + 'px';
    ov.style.top = r.top + 'px';
    ov.style.width = r.width + 'px';
    ov.style.height = r.height + 'px';
    ov.style.display = 'block';
  }

  var selectedEl = null;
  var selectedPath = null;

  function reSelect() {
    if (!selectedPath) return;
    var el = navigate(selectedPath);
    if (!el) { selectedEl = null; selectOverlay.style.display='none'; label.style.display='none'; return; }
    selectedEl = el;
    posOverlay(selectOverlay, el);
    var r = el.getBoundingClientRect();
    label.textContent = el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className ? '.'+String(el.className).split(/\\s+/).filter(Boolean).join('.') : '');
    label.style.left = r.left + 'px';
    label.style.top = Math.max(0, r.top - 18) + 'px';
    label.style.display = 'block';
  }

  document.addEventListener('mouseover', function(e) {
    if (isArtifact(e.target)) return;
    if (e.target === document.documentElement || e.target === document.body) return;
    posOverlay(hoverOverlay, e.target);
  }, true);
  document.addEventListener('mouseout', function(e) {
    hoverOverlay.style.display = 'none';
  }, true);

  function sendSelection(el) {
    var cs = getComputedStyle(el);
    var onlyText = el.children.length === 0 ? (el.textContent || '') : null;
    parent.postMessage({
      __webdev: true,
      type: 'select',
      path: selectedPath,
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      className: (typeof el.className === 'string' ? el.className : '') || '',
      text: onlyText,
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        padding: cs.padding,
        margin: cs.margin,
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderWidth,
        borderColor: cs.borderColor,
        borderStyle: cs.borderStyle,
        textAlign: cs.textAlign,
        display: cs.display,
        width: el.style.width || '',
        height: el.style.height || '',
      },
      inlineStyle: el.getAttribute('style') || '',
    }, '*');
  }

  document.addEventListener('click', function(e) {
    if (isArtifact(e.target)) return;
    if (e.target === document.documentElement) return;
    e.preventDefault();
    e.stopPropagation();
    selectedEl = e.target;
    selectedPath = getPath(selectedEl);
    posOverlay(selectOverlay, selectedEl);
    var r = selectedEl.getBoundingClientRect();
    label.textContent = selectedEl.tagName.toLowerCase() + (selectedEl.id ? '#'+selectedEl.id : '') + (selectedEl.className ? '.'+String(selectedEl.className).split(/\\s+/).filter(Boolean).join('.') : '');
    label.style.left = r.left + 'px';
    label.style.top = Math.max(0, r.top - 18) + 'px';
    label.style.display = 'block';
    sendSelection(selectedEl);
  }, true);

  window.addEventListener('message', function(ev) {
    var d = ev.data || {};
    if (!d || !d.__webdev) return;
    if (d.type === 'get-html') {
      // Strip editor artifacts before serializing
      var clone = document.documentElement.cloneNode(true);
      var arts = clone.querySelectorAll('[data-editor-artifact]');
      for (var i = 0; i < arts.length; i++) arts[i].remove();
      var scripts = clone.querySelectorAll('script[data-editor-script]');
      for (var j = 0; j < scripts.length; j++) scripts[j].remove();
      parent.postMessage({
        __webdev: true,
        type: 'html',
        requestId: d.requestId,
        html: '<!DOCTYPE html>\\n' + clone.outerHTML,
      }, '*');
    } else if (d.type === 'reselect-path') {
      selectedPath = d.path;
      reSelect();
    }
  });

  window.addEventListener('scroll', reSelect, true);
  window.addEventListener('resize', reSelect, true);

  parent.postMessage({ __webdev: true, type: 'ready' }, '*');
  document.documentElement.appendChild(hoverOverlay);
  document.documentElement.appendChild(selectOverlay);
  document.documentElement.appendChild(label);
})();
`;

export function buildSrcDoc(opts: {
  html: string;
  css: string;
  js: string;
  withEditor: boolean;
}): string {
  let out = opts.html;
  // Inline CSS (external stylesheet won't load from srcDoc)
  if (/<link rel="stylesheet" href="styles.css"[^>]*>/.test(out)) {
    out = out.replace(
      /<link rel="stylesheet" href="styles.css"[^>]*>/,
      `<style data-project-css>${opts.css}</style>`,
    );
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `<style data-project-css>${opts.css}</style></head>`);
  } else {
    out = `<style data-project-css>${opts.css}</style>` + out;
  }

  // Inline JS
  if (/<script src="app\.js"><\/script>/.test(out)) {
    out = out.replace(
      /<script src="app\.js"><\/script>/,
      `<script data-project-js>${opts.js}</script>`,
    );
  } else if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `<script data-project-js>${opts.js}</script></body>`);
  } else {
    out = out + `<script data-project-js>${opts.js}</script>`;
  }

  if (opts.withEditor) {
    const ed = `<script data-editor-script>${EDITOR_SCRIPT}</script>`;
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${ed}</body>`);
    } else {
      out = out + ed;
    }
  }
  return out;
}
