/**
 * PickFix Selection Bridge
 *
 * Injected into the preview iframe by the proxy. Enables element picking:
 * hover highlights, click selects, postMessage back to host with element
 * metadata. Pure JS, zero dependencies, runs in sandboxed iframe.
 *
 * Host → Bridge messages:
 *   { type: 'od:pf-mode', enabled: boolean }
 *
 * Bridge → Host messages:
 *   { type: 'od:pf-hover', elementId, tag, classes, text, rect, selector }
 *   { type: 'od:pf-leave' }
 *   { type: 'od:pf-pick',  elementId, tag, classes, text, rect, selector, htmlHint }
 */

export const BRIDGE_SCRIPT = `
(function() {
  'use strict';

  var enabled = false;
  var hoveredId = null;
  var HIGHLIGHT_COLOR = 'rgba(59, 130, 246, 0.18)';
  var HIGHLIGHT_BORDER = 'rgba(59, 130, 246, 0.6)';

  // === DOM Utilities ===

  function esc(s) {
    return String(s).replace(/"/g, '\\\\"');
  }

  function visibleTarget(el) {
    if (!el || !el.getBoundingClientRect || !el.tagName) return false;
    if (el === document.documentElement || el === document.body) return false;
    var tag = el.tagName.toLowerCase();
    if (/^(script|style|template|meta|link|title|noscript|head|html)$/.test(tag)) return false;
    try {
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    } catch (_) {
      return false;
    }
    return true;
  }

  function isMeaningful(el) {
    if (!visibleTarget(el)) return false;
    var tag = el.tagName.toLowerCase();
    // Semantic or interactive elements are always meaningful
    if (/^(a|button|input|textarea|select|label|img|video|canvas|h1|h2|h3|h4|h5|h6|p|li|td|th|section|article|main|aside|nav|header|footer|form)$/.test(tag)) {
      return true;
    }
    if (el.getAttribute && (el.getAttribute('role') || el.getAttribute('aria-label') || el.getAttribute('title'))) {
      return true;
    }
    // For divs/spans, only pick if they have class/id and meaningful text content
    if (el.hasAttribute && (el.hasAttribute('id') || el.hasAttribute('class'))) {
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length > 0 && text.length < 500) return true;
    }
    return false;
  }

  function domSelectorFor(el) {
    if (!el || !el.tagName || el === document.documentElement || el === document.body) return null;
    var parts = [];
    var node = el;
    while (node && node !== document.documentElement && node !== document.body) {
      var tag = node.tagName.toLowerCase();
      if (!tag || /^(script|style|template|meta|link|title|noscript)$/.test(tag)) return null;
      var parent = node.parentElement;
      if (!parent) return null;
      var index = 1;
      var sibling = node.previousElementSibling;
      while (sibling) {
        if (sibling.tagName && sibling.tagName.toLowerCase() === tag) index++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      node = parent;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : null;
  }

  function closestTarget(ev) {
    var el = ev.target;
    var fallback = null;
    while (el && el !== document.documentElement) {
      if (visibleTarget(el) && isMeaningful(el)) {
        if (el.hasAttribute && (el.getAttribute('id') || el.getAttribute('class'))) return el;
        if (!fallback) fallback = el;
      }
      el = el.parentElement;
    }
    return fallback;
  }

  function buildMeta(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : 'element';
    var cls = '';
    if (typeof el.className === 'string') {
      var names = el.className.trim().split(/\\s+/);
      cls = names.length ? names.join(' ') : '';
    }
    var id = el.getAttribute ? (el.getAttribute('id') || '') : '';
    var elementId = id || cls.replace(/\\s+/g, '-') || tag;
    if (!elementId || elementId.length > 60) {
      elementId = tag + '-' + Math.random().toString(36).slice(2, 8);
    }
    var rect = el.getBoundingClientRect();
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
    var htmlHint = '';
    try { htmlHint = (el.outerHTML || '').slice(0, 200).replace(/\\s+/g, ' '); } catch (_) {}
    var selector = domSelectorFor(el) || '';

    var style = null;
    try {
      var cs = window.getComputedStyle(el);
      style = {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight
      };
    } catch (_) {}

    return {
      elementId: elementId,
      tag: tag,
      id: id,
      classes: cls,
      text: text,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      selector: selector,
      htmlHint: htmlHint,
      style: style
    };
  }

  function parentOrigin() {
    try {
      return document.referrer ? new URL(document.referrer).origin : '*';
    } catch (_) {
      return '*';
    }
  }

  function post(type, payload) {
    try {
      var msg = Object.assign({ type: type }, payload);
      window.parent.postMessage(msg, parentOrigin());
    } catch (_) {}
  }

  // === Highlight Overlay ===

  var overlay = null;
  function ensureOverlay() {
    if (overlay && overlay.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.id = '__pf-highlight-overlay';
    overlay.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483646;' +
      'transition:all 80ms ease-out;display:none;';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function showHighlight(rect) {
    var el = ensureOverlay();
    el.style.display = 'block';
    el.style.left = rect.x + 'px';
    el.style.top = rect.y + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.backgroundColor = HIGHLIGHT_COLOR;
    el.style.border = '1.5px solid ' + HIGHLIGHT_BORDER;
    el.style.borderRadius = '4px';
    el.style.boxShadow = '0 0 0 1px ' + HIGHLIGHT_BORDER;
  }

  function hideHighlight() {
    if (overlay) overlay.style.display = 'none';
  }

  // === Event Handlers ===

  document.addEventListener('mouseover', function(ev) {
    if (!enabled) return;
    var el = closestTarget(ev);
    if (!el) { hideHighlight(); return; }
    var meta = buildMeta(el);
    if (!meta.elementId || meta.elementId === hoveredId) return;
    hoveredId = meta.elementId;
    showHighlight(meta.rect);
    post('od:pf-hover', meta);
  }, true);

  document.addEventListener('mouseout', function(ev) {
    if (!enabled) return;
    var el = closestTarget(ev);
    if (!el) {
      hoveredId = null;
      hideHighlight();
      post('od:pf-leave', {});
      return;
    }
  }, true);

  document.addEventListener('click', function(ev) {
    if (!enabled) return;
    var el = closestTarget(ev);
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    var meta = buildMeta(el);
    hoveredId = meta.elementId;
    showHighlight(meta.rect);
    post('od:pf-pick', meta);
  }, true);

  // === Host Messages ===

  window.addEventListener('message', function(ev) {
    var data = ev && ev.data;
    if (!data || !data.type) return;
    if (data.type === 'od:pf-mode') {
      if (ev.source && ev.source !== window.parent) return;
      var expectedOrigin = parentOrigin();
      if (expectedOrigin !== '*' && ev.origin !== expectedOrigin) return;
      enabled = !!data.enabled;
      document.documentElement.toggleAttribute('data-pf-mode', enabled);
      if (!enabled) {
        hideHighlight();
        hoveredId = null;
      }
    }
  });

  // === CSS ===

  var style = document.createElement('style');
  style.textContent = 'html[data-pf-mode] body * { cursor: crosshair !important; }' +
    'html[data-pf-mode] a[href], html[data-pf-mode] button, html[data-pf-mode] input,' +
    'html[data-pf-mode] textarea, html[data-pf-mode] select { pointer-events: auto !important; }';
  (document.head || document.documentElement).appendChild(style);
})();
`;
