/** Build a stable selector for replay (prefer tour nav / href / role tab). */

/** Main content column in MainLayout — document scroll is often 0; wheel/keys scroll this element. */
export const UI_TEST_MAIN_SCROLL_SELECTOR = '[data-main-scroll-column]';

function cssEscape(value) {
  const raw = String(value ?? '');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isVisibleElement(el) {
  if (!(el instanceof Element)) return false;
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function isEditableElement(el) {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof Element && el.isContentEditable);
}

function isWritableElement(el) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof Element && el.isContentEditable) {
    return el.getAttribute('contenteditable') !== 'false';
  }
  return false;
}

function querySelectorForStep(selector, step) {
  try {
    const nodes = [...document.querySelectorAll(selector)];
    if (!nodes.length) return null;
    const action = String(step?.actionType ?? '').toLowerCase();
    const preferEditable = action === 'fill' || action === 'type' || action === 'input';
    const visible = nodes.filter(isVisibleElement);
    if (!visible.length) return null;
    if (preferEditable) {
      const editableVisible = visible.filter(isEditableElement);
      const writableEditable = editableVisible.filter(isWritableElement);
      if (writableEditable.length) return writableEditable[0];
      if (editableVisible.length) return editableVisible[0];
    }
    return visible[0];
  } catch {
    return null;
  }
}

function buildDataTransferSnapshot(dataTransfer) {
  if (!dataTransfer) return null;
  const types = Array.isArray(dataTransfer.types) ? [...dataTransfer.types] : [];
  const dataByType = {};
  for (const type of types) {
    if (typeof type !== 'string') continue;
    if (!type.startsWith('text/') && !type.startsWith('application/')) continue;
    try {
      const value = dataTransfer.getData(type);
      if (value != null && value !== '') dataByType[type] = String(value);
    } catch {
      /* ignore unavailable type */
    }
  }
  return { types, dataByType };
}

function createSyntheticDataTransfer(snapshot) {
  let store = null;
  try {
    if (typeof DataTransfer !== 'undefined') {
      store = new DataTransfer();
    }
  } catch {
    store = null;
  }

  if (store && snapshot?.dataByType && typeof store.setData === 'function') {
    for (const [type, value] of Object.entries(snapshot.dataByType)) {
      try {
        store.setData(type, String(value));
      } catch {
        /* keep best effort */
      }
    }
    return store;
  }

  const fallbackData = { ...(snapshot?.dataByType || {}) };
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    files: [],
    items: [],
    types: Object.keys(fallbackData),
    setData(type, value) {
      fallbackData[String(type)] = String(value ?? '');
      this.types = Object.keys(fallbackData);
    },
    getData(type) {
      return fallbackData[String(type)] ?? '';
    },
    clearData(type) {
      if (type == null) {
        Object.keys(fallbackData).forEach((key) => delete fallbackData[key]);
      } else {
        delete fallbackData[String(type)];
      }
      this.types = Object.keys(fallbackData);
    }
  };
}

function dispatchDragLikeEvent(target, type, dataTransfer, point = null) {
  if (!(target instanceof Element)) return false;
  const clientX = Number(point?.x);
  const clientY = Number(point?.y);
  const base = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: Number.isFinite(clientX) ? clientX : 0,
    clientY: Number.isFinite(clientY) ? clientY : 0
  };
  let event = null;
  if (typeof DragEvent !== 'undefined') {
    try {
      event = new DragEvent(type, { ...base, dataTransfer });
    } catch {
      event = null;
    }
  }
  if (!event) {
    event = new MouseEvent(type, base);
    try {
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    } catch {
      /* readonly in some browsers */
    }
  }
  return target.dispatchEvent(event);
}

function buildDomPathSelector(element) {
  if (!(element instanceof Element)) return null;
  const segments = [];
  let node = element;
  while (node && node instanceof Element && node !== document.body) {
    if (node.id) {
      segments.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) break;
    const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
    const index = siblings.indexOf(node);
    if (index < 0) return null;
    segments.unshift(`${tag}:nth-of-type(${index + 1})`);
    node = parent;
  }
  if (!segments.length) return null;
  return segments.join(' > ');
}

export function isRecordableInputElement(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-ui-test-ignore]')) return false;
  if (target instanceof HTMLInputElement) {
    const type = (target.type || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image', 'range', 'color'].includes(
      type
    );
  }
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function readInputValue(element) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value ?? '';
  }
  if (element instanceof Element && element.isContentEditable) {
    return element.innerText ?? element.textContent ?? '';
  }
  return '';
}

function setNativeInputValue(element, value) {
  const proto =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

export function buildSelectorForElement(target) {
  if (!target || !(target instanceof Element)) return { selector: null, selectorFallback: null };

  const ignored = target.closest('[data-ui-test-ignore]');
  if (ignored) return { selector: null, selectorFallback: null };

  const tourNav = target.closest('[data-vsingles-tour-nav]');
  if (tourNav) {
    const id = tourNav.getAttribute('data-vsingles-tour-nav');
    return {
      selector: `[data-vsingles-tour-nav="${cssEscape(id)}"]`,
      selectorFallback: null,
      valueText: tourNav.textContent?.trim() || null
    };
  }

  const uiTarget = target.closest('[data-ui-test-target]');
  if (uiTarget) {
    const key = uiTarget.getAttribute('data-ui-test-target');
    return {
      selector: `[data-ui-test-target="${cssEscape(key)}"]`,
      selectorFallback: null,
      valueText: uiTarget.textContent?.trim() || null
    };
  }

  const link = target.closest('a[href]');
  if (link) {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/')) {
      return {
        selector: `a[href="${cssEscape(href)}"]`,
        selectorFallback: null,
        valueText: link.textContent?.trim() || null
      };
    }
  }

  const tab = target.closest('[role="tab"]');
  if (tab) {
    const tablist = tab.closest('[role="tablist"]');
    if (tablist) {
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(tab);
      if (index >= 0) {
        return {
          selector: `[role="tablist"] [role="tab"]:nth-of-type(${index + 1})`,
          selectorFallback: null,
          valueText: tab.textContent?.trim() || null
        };
      }
    }
  }

  const button = target.closest('button');
  if (button) {
    const label = button.getAttribute('aria-label') || button.textContent?.trim();
    if (button.id) {
      return { selector: `#${cssEscape(button.id)}`, selectorFallback: null, valueText: label || null };
    }
    const domPath = buildDomPathSelector(button);
    if (domPath) {
      return { selector: domPath, selectorFallback: null, valueText: label || null };
    }
  }

  const field = target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]');
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const tag = field.tagName.toLowerCase();
    if (field.id) {
      return { selector: `#${cssEscape(field.id)}`, selectorFallback: null, valueText: readInputValue(field) };
    }
    if (field.name) {
      return {
        selector: `${tag}[name="${cssEscape(field.name)}"]`,
        selectorFallback: null,
        valueText: readInputValue(field)
      };
    }
    const aria = field.getAttribute('aria-label');
    if (aria) {
      return {
        selector: `${tag}[aria-label="${cssEscape(aria)}"]`,
        selectorFallback: null,
        valueText: readInputValue(field)
      };
    }
    const placeholder = field.getAttribute('placeholder');
    if (placeholder) {
      return {
        selector: `${tag}[placeholder="${cssEscape(placeholder)}"]`,
        selectorFallback: null,
        valueText: readInputValue(field)
      };
    }
  }
  if (field instanceof Element && field.isContentEditable) {
    if (field.id) {
      return { selector: `#${cssEscape(field.id)}`, selectorFallback: null, valueText: readInputValue(field) };
    }
  }

  if (target.id) {
    return { selector: `#${cssEscape(target.id)}`, selectorFallback: null, valueText: target.textContent?.trim() || null };
  }

  const domPath = buildDomPathSelector(target);
  if (domPath) {
    return { selector: domPath, selectorFallback: null, valueText: target.textContent?.trim() || null };
  }

  return { selector: null, selectorFallback: null, valueText: null };
}

let replayRecordViewport = null;

/** Set from recording row when Run starts (fallback if step lacks per-click viewport). */
export function setReplayRecordViewport(width, height) {
  const w = Number(width);
  const h = Number(height);
  replayRecordViewport =
    Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { width: w, height: h } : null;
}

export function clearReplayRecordViewport() {
  replayRecordViewport = null;
}

function scalePointToCurrentViewport(x, y, recordViewport) {
  const base = recordViewport ?? replayRecordViewport;
  if (!base) {
    return { x: Math.round(x), y: Math.round(y) };
  }
  const scaleX = window.innerWidth / base.width;
  const scaleY = window.innerHeight / base.height;
  return {
    x: Math.round(x * scaleX),
    y: Math.round(y * scaleY)
  };
}

function readStepRecordViewport(step) {
  const viewport = step?.valueJson?.recordViewport ?? step?.value_json?.recordViewport;
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/** Window + main-column scroll positions at record time (for replay on nested scroll layouts). */
export function readAppScrollState() {
  const containers = [];
  for (const el of document.querySelectorAll(UI_TEST_MAIN_SCROLL_SELECTOR)) {
    if (!(el instanceof Element)) continue;
    containers.push({
      selector: UI_TEST_MAIN_SCROLL_SELECTOR,
      top: Math.max(0, Math.round(el.scrollTop)),
      left: Math.max(0, Math.round(el.scrollLeft))
    });
  }
  return {
    x: Math.max(0, Math.round(window.scrollX)),
    y: Math.max(0, Math.round(window.scrollY)),
    containers
  };
}

export function scrollStateSignature(state) {
  if (!state) return '';
  return JSON.stringify(state);
}

function readStepScrollOffset(step) {
  const valueJson = step?.valueJson ?? step?.value_json ?? {};
  const scrollX = Number(valueJson?.recordScroll?.x ?? valueJson?.scrollX);
  const scrollY = Number(valueJson?.recordScroll?.y ?? valueJson?.scrollY);
  if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) return null;
  return { x: Math.max(0, Math.round(scrollX)), y: Math.max(0, Math.round(scrollY)) };
}

function readStepScrollContainers(step) {
  const valueJson = step?.valueJson ?? step?.value_json ?? {};
  const containers = valueJson?.recordScroll?.containers;
  return Array.isArray(containers) ? containers : [];
}

function applyContainerScrolls(containers) {
  if (!containers.length) return;
  const nodes = [...document.querySelectorAll(UI_TEST_MAIN_SCROLL_SELECTOR)];
  containers.forEach((entry, index) => {
    const el = nodes[index];
    if (!(el instanceof Element)) return;
    const top = Number(entry?.top);
    const left = Number(entry?.left);
    if (Number.isFinite(top) && Math.abs(el.scrollTop - top) >= 2) {
      el.scrollTop = top;
    }
    if (Number.isFinite(left) && Math.abs(el.scrollLeft - left) >= 2) {
      el.scrollLeft = left;
    }
  });
}

export function applyRecordedScroll(step) {
  const scroll = readStepScrollOffset(step);
  if (scroll) {
    if (Math.abs(window.scrollX - scroll.x) >= 2 || Math.abs(window.scrollY - scroll.y) >= 2) {
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
    }
  }
  applyContainerScrolls(readStepScrollContainers(step));
}

function recordScrollPayload() {
  return readAppScrollState();
}

function resolveStepCoordinatePoint(step) {
  const rawX = Number(step?.x);
  const rawY = Number(step?.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;
  const recordViewport = readStepRecordViewport(step);
  return scalePointToCurrentViewport(rawX, rawY, recordViewport);
}

function centerPointForElement(el) {
  if (!(el instanceof Element)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2)
  };
}

/** Replay click point: selector-resolved center, else recorded coordinates fallback. */
export function resolveStepClickPoint(step) {
  const el = resolveStepElement(step);
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    }
  }
  return resolveStepCoordinatePoint(step);
}

function buildDragEndpointPayload(meta, point) {
  return {
    selector: meta?.selector ?? null,
    selectorFallback: meta?.selectorFallback ?? null,
    x: Number.isFinite(Number(point?.x)) ? Math.round(Number(point?.x)) : null,
    y: Number.isFinite(Number(point?.y)) ? Math.round(Number(point?.y)) : null
  };
}

export function captureDragDropStep(dropEvent, stepOrder, dragStartMeta = null, delayMs = 1200) {
  const target = dropEvent?.target instanceof Element ? dropEvent.target : null;
  const targetMeta = buildSelectorForElement(target);
  const targetPoint = {
    x: Math.round(Number(dropEvent?.clientX ?? 0)),
    y: Math.round(Number(dropEvent?.clientY ?? 0))
  };
  const sourceMeta = dragStartMeta?.meta ?? null;
  const sourcePoint = dragStartMeta?.point ?? null;
  const recordViewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  return {
    stepOrder,
    actionType: 'dragdrop',
    selector: sourceMeta?.selector ?? null,
    selectorFallback: sourceMeta?.selectorFallback ?? null,
    x: Number.isFinite(Number(sourcePoint?.x)) ? Math.round(Number(sourcePoint.x)) : null,
    y: Number.isFinite(Number(sourcePoint?.y)) ? Math.round(Number(sourcePoint.y)) : null,
    valueText: targetMeta?.valueText ?? null,
    valueJson: {
      recordViewport,
      recordScroll: recordScrollPayload(),
      dragDrop: {
        source: buildDragEndpointPayload(sourceMeta, sourcePoint),
        target: buildDragEndpointPayload(targetMeta, targetPoint),
        dataTransfer: buildDataTransferSnapshot(dropEvent?.dataTransfer)
      }
    },
    delayMs
  };
}

export function captureClickStep(event, stepOrder, delayMs = 5000) {
  const target = event.target instanceof Element ? event.target : null;
  const meta = buildSelectorForElement(target);
  const clientX = Math.round(event.clientX);
  const clientY = Math.round(event.clientY);
  const recordViewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  if (!meta.selector) {
    return {
      stepOrder,
      actionType: 'click',
      selector: null,
      selectorFallback: null,
      x: clientX,
      y: clientY,
      valueText: null,
      valueJson: {
        recordViewport,
        recordScroll: recordScrollPayload()
      },
      delayMs
    };
  }
  return {
    stepOrder,
    actionType: 'click',
    selector: meta.selector,
    selectorFallback: meta.selectorFallback,
    x: clientX,
    y: clientY,
    valueText: meta.valueText,
    valueJson: {
      recordViewport,
      recordScroll: recordScrollPayload()
    },
    delayMs
  };
}

export function captureFillStep(element, stepOrder, delayMs = 5000) {
  const value = readInputValue(element);
  const meta = buildSelectorForElement(element);
  const recordViewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  let clientX = null;
  let clientY = null;
  if (element instanceof Element) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      clientX = Math.round(rect.left + rect.width / 2);
      clientY = Math.round(rect.top + rect.height / 2);
    }
  }

  return {
    stepOrder,
    actionType: 'fill',
    selector: meta.selector,
    selectorFallback: meta.selectorFallback,
    x: clientX,
    y: clientY,
    valueText: value,
    valueJson: {
      recordViewport,
      recordScroll: recordScrollPayload()
    },
    delayMs
  };
}

export function captureScrollStep(stepOrder, delayMs = 500) {
  const recordViewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  return {
    stepOrder,
    actionType: 'scroll',
    selector: null,
    selectorFallback: null,
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
    valueText: null,
    valueJson: {
      recordViewport,
      recordScroll: recordScrollPayload()
    },
    delayMs
  };
}

export function resolveStepElement(step) {
  if (step?.selector) {
    const el = querySelectorForStep(step.selector, step);
    if (el) return el;
  }
  if (step?.selectorFallback) {
    const el = querySelectorForStep(step.selectorFallback, step);
    if (el) return el;
  }

  const action = String(step?.actionType ?? '').toLowerCase();
  const text = normalizeText(step?.valueText);
  if (action === 'click' && text) {
    const candidates = [
      ...document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [type="button"], [type="submit"]')
    ].filter((el) => normalizeText(el.textContent) === text && el.getClientRects().length > 0);
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

function performFillStep(step) {
  let el = resolveStepElement(step);
  if (!el && isRecordableInputElement(document.activeElement)) {
    el = document.activeElement;
  }
  if (!el) {
    const point = resolveStepCoordinatePoint(step);
    if (point) {
      const fromPoint = document.elementFromPoint(point.x, point.y);
      if (fromPoint instanceof Element) {
        const nearest = fromPoint.closest('input, textarea, [contenteditable=""], [contenteditable="true"]');
        if (nearest) el = nearest;
      }
    }
  }
  if (!el) return false;
  if (!isEditableElement(el) && el instanceof Element) {
    const nested = el.querySelector('input, textarea, [contenteditable=""], [contenteditable="true"]');
    if (nested) el = nested;
  }
  if (!isEditableElement(el)) return false;
  const value = step?.valueText ?? step?.valueJson?.valueText ?? '';

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    setNativeInputValue(el, value);
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) })
    );
    // Some controlled components listen to plain Event('input') instead of InputEvent.
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  if (el.isContentEditable) {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value })
    );
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  return false;
}

function dispatchClickAt(el, x, y) {
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  };
  if (el instanceof HTMLAnchorElement && el.href && el.getAttribute('href')?.startsWith('/')) {
    el.dispatchEvent(new MouseEvent('click', opts));
    return true;
  }
  el.dispatchEvent(new MouseEvent('click', opts));
  return true;
}

function resolveDragEndpointElement(endpoint) {
  if (!endpoint) return null;
  if (endpoint.selector) {
    const el = querySelectorForStep(endpoint.selector, { actionType: 'dragdrop' });
    if (el) return el;
  }
  if (endpoint.selectorFallback) {
    const el = querySelectorForStep(endpoint.selectorFallback, { actionType: 'dragdrop' });
    if (el) return el;
  }
  const x = Number(endpoint.x);
  const y = Number(endpoint.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const fromPoint = document.elementFromPoint(Math.round(x), Math.round(y));
    if (fromPoint instanceof Element) return fromPoint;
  }
  return null;
}

function performDragDropStep(step) {
  const valueJson = step?.valueJson ?? step?.value_json ?? {};
  const dragDrop = valueJson?.dragDrop ?? {};
  const source = resolveDragEndpointElement(dragDrop?.source) ?? resolveStepElement(step);
  const target = resolveDragEndpointElement(dragDrop?.target);
  if (!(source instanceof Element) || !(target instanceof Element)) return false;

  const sourcePoint = centerPointForElement(source) ?? resolveStepCoordinatePoint(step);
  const targetPoint = centerPointForElement(target) ?? {
    x: Number(dragDrop?.target?.x ?? step?.x),
    y: Number(dragDrop?.target?.y ?? step?.y)
  };
  const dataTransfer = createSyntheticDataTransfer(dragDrop?.dataTransfer);

  dispatchDragLikeEvent(source, 'dragstart', dataTransfer, sourcePoint);
  dispatchDragLikeEvent(target, 'dragenter', dataTransfer, targetPoint);
  dispatchDragLikeEvent(target, 'dragover', dataTransfer, targetPoint);
  const dropped = dispatchDragLikeEvent(target, 'drop', dataTransfer, targetPoint);
  dispatchDragLikeEvent(source, 'dragend', dataTransfer, targetPoint);
  return dropped;
}

export function performUiTestStep(step) {
  const action = String(step?.actionType ?? 'click').toLowerCase();
  if (action === 'scroll') {
    applyRecordedScroll(step);
    return true;
  }
  applyRecordedScroll(step);
  if (action === 'wait') {
    return true;
  }
  if (action === 'navigate') {
    const path = step?.valueText || step?.value_json?.path;
    if (path && path.startsWith('/')) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return true;
    }
    return false;
  }
  if (action === 'fill' || action === 'type' || action === 'input') {
    return performFillStep(step);
  }
  if (action === 'dragdrop' || action === 'drag_drop') {
    return performDragDropStep(step);
  }

  const el = resolveStepElement(step);
  if (el) {
    const rect = el.getBoundingClientRect();
    const centerX = Math.round(rect.left + rect.width / 2);
    const centerY = Math.round(rect.top + rect.height / 2);
    if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
      return dispatchClickAt(el, centerX, centerY);
    }
    if (el instanceof HTMLAnchorElement && el.href && el.getAttribute('href')?.startsWith('/')) {
      el.click();
      return true;
    }
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }
  const point = resolveStepCoordinatePoint(step);
  if (point) {
    const fromPoint = document.elementFromPoint(point.x, point.y);
    if (fromPoint instanceof Element) {
      const clickable =
        fromPoint.closest('button, a[href], [role="button"], [role="tab"], [type="button"], [type="submit"]') ||
        fromPoint;
      return dispatchClickAt(clickable, point.x, point.y);
    }
  }
  return false;
}

export function formatDurationSeconds(totalSeconds) {
  const n = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (n < 60) return `${n} sec`;
  const mins = Math.floor(n / 60);
  const secs = n % 60;
  if (secs === 0) return `${mins}min`;
  return `${mins}min ${secs}sec`;
}

/** Display number for Run/Record/Stop labels (e.g. "Test 3: chat" → 3). */
export function parseUiTestDisplayNumber(recording, rowIndex = 0) {
  const match = String(recording?.name ?? '').match(/^Test\s+(\d+)/i);
  if (match) return Number(match[1]);
  const fallback = rowIndex + 1;
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
}

export function formatStepsLabel(count) {
  const n = Math.max(0, Number(count) || 0);
  return String(n);
}

export function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
