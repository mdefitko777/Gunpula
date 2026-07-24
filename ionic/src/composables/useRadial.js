import { reactive } from "vue";

// The app's signature gesture, ported from the vanilla build: press and hold,
// a radial menu blooms under your finger, slide toward an option and release to
// jump. A horizontal flick (without the hold) pages between the same options.
//
// Raw touch handlers rather than Ionic's createGesture: this needs a hold timer
// plus directional selection, and the vanilla semantics are already proven.
const HOLD_MS = 850;
const SCROLL_CANCEL = 10; // vertical movement that means "user is scrolling"
const CANCEL_DISTANCE = 18; // movement before the hold fires cancels it
const SELECT_DISTANCE = 28; // how far to slide before an option is picked
const SWIPE_DISTANCE = 60; // horizontal flick threshold for paging
const RADIUS = 92;

export const radialState = reactive({
  active: false,
  x: 0,
  y: 0,
  items: [],
  selected: -1,
});

const touch = {
  id: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  timer: null,
  moved: false,
};

// Set by the app: () => ({ items:[{id,label}], current, onPick(id), onPage(dir) })
let provider = () => null;
export function setRadialProvider(fn) {
  provider = fn;
}

export function radialItemPosition(index, total) {
  // Start at the top and go clockwise.
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(angle) * RADIUS, dy: Math.sin(angle) * RADIUS };
}

function clearTimer() {
  if (touch.timer) clearTimeout(touch.timer);
  touch.timer = null;
}

function reset() {
  clearTimer();
  touch.id = null;
  touch.moved = false;
  radialState.active = false;
  radialState.selected = -1;
  radialState.items = [];
  document.body.classList.remove("radial-open");
}

// Ignore gestures that start on interactive or horizontally scrollable chrome
// (segments, searchbars, buttons) so normal controls keep working.
function gestureAllowed(target) {
  return !target?.closest?.(
    "ion-segment, ion-searchbar, ion-select, ion-button, ion-tab-bar, ion-toolbar, ion-modal, .no-radial",
  );
}

function open(x, y) {
  const ctx = provider();
  if (!ctx?.items?.length) return;
  radialState.items = ctx.items;
  radialState.x = Math.min(Math.max(x, 120), window.innerWidth - 120);
  radialState.y = Math.min(Math.max(y, 150), window.innerHeight - 150);
  radialState.selected = -1;
  radialState.active = true;
  document.body.classList.add("radial-open");
  if (navigator.vibrate) navigator.vibrate(12);
}

function updateSelection(x, y) {
  const dx = x - radialState.x;
  const dy = y - radialState.y;
  if (Math.hypot(dx, dy) < SELECT_DISTANCE) {
    radialState.selected = -1;
    return;
  }
  // Pick the option whose slice the finger points into.
  const total = radialState.items.length;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  radialState.selected = Math.round(angle / ((Math.PI * 2) / total)) % total;
}

function onStart(event) {
  if (event.touches.length !== 1 || !gestureAllowed(event.target)) return;
  const t = event.changedTouches[0];
  reset();
  touch.id = t.identifier;
  touch.startX = touch.lastX = t.clientX;
  touch.startY = touch.lastY = t.clientY;
  touch.timer = setTimeout(() => open(touch.lastX, touch.lastY), HOLD_MS);
}

function onMove(event) {
  const t = [...event.touches].find((x) => x.identifier === touch.id);
  if (!t) return;
  touch.lastX = t.clientX;
  touch.lastY = t.clientY;
  const dx = t.clientX - touch.startX;
  const dy = t.clientY - touch.startY;

  if (radialState.active) {
    updateSelection(t.clientX, t.clientY);
    if (event.cancelable) event.preventDefault();
    return;
  }
  if (Math.abs(dy) > SCROLL_CANCEL && Math.abs(dy) > Math.abs(dx)) {
    clearTimer(); // vertical scroll wins
    touch.moved = true;
    return;
  }
  if (Math.hypot(dx, dy) > CANCEL_DISTANCE) {
    clearTimer();
    touch.moved = true;
  }
}

function onEnd(event) {
  const wasActive = radialState.active;
  const selected = radialState.selected;
  // Capture before reset() clears the state.
  const items = radialState.items.slice();
  const dx = touch.lastX - touch.startX;
  const dy = touch.lastY - touch.startY;
  const ctx = provider();
  reset();

  if (wasActive) {
    if (event.cancelable) event.preventDefault();
    const item = items[selected];
    if (selected >= 0 && item) ctx?.onPick?.(item.id);
    return;
  }
  // Horizontal flick pages through the same option set.
  if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
    ctx?.onPage?.(dx < 0 ? 1 : -1);
  }
}

let installed = false;
export function installRadialGestures() {
  if (installed) return;
  installed = true;
  document.addEventListener("touchstart", onStart, { capture: true, passive: false });
  document.addEventListener("touchmove", onMove, { capture: true, passive: false });
  document.addEventListener("touchend", onEnd, { capture: true, passive: false });
  document.addEventListener("touchcancel", reset, { capture: true, passive: true });
}
