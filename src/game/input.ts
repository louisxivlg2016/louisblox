import { startMusic } from './audio';
import { useGameStore } from './store';

const keys = new Set<string>();
const touchKeys = new Set<string>();
const mouseButtons = new Set<number>();
const touchMouseButtons = new Set<number>();
const look = { x: 0, y: 0 };
const edgeLook = { x: 0, y: 0 };
const touchMovement = { x: 0, y: 0 };
const actions = { place: 0, harvest: 0 };
let lastSpacePress = 0;
let flightToggles = 0;
let initialized = false;
let pointerLockFallback = false;
let touchLookPointer: number | null = null;
let touchLookX = 0;
let touchLookY = 0;
let miningLatched = false;
let edgeResetTimer: ReturnType<typeof setTimeout> | null = null;
const touchPointers = new Set<number>();
const touchPoints = new Map<number, { x: number; y: number }>();
let touchGestureMoved = false;
let twoFingerGesture = false;
let touchStartedAt = 0;

const hasMouseControl = () => document.pointerLockElement !== null || pointerLockFallback;

function resetEdgeLook() {
  edgeLook.x = 0;
  edgeLook.y = 0;
  edgeResetTimer = null;
}

export function clearInput() {
  keys.clear();
  touchKeys.clear();
  mouseButtons.clear();
  touchMouseButtons.clear();
  miningLatched = false;
  if (edgeResetTimer) clearTimeout(edgeResetTimer);
  resetEdgeLook();
  look.x = 0;
  look.y = 0;
  edgeLook.x = 0;
  edgeLook.y = 0;
  touchMovement.x = 0;
  touchMovement.y = 0;
  touchLookPointer = null;
  touchPointers.clear();
  touchPoints.clear();
  touchGestureMoved = false;
  twoFingerGesture = false;
  touchStartedAt = 0;
  actions.place = 0;
  actions.harvest = 0;
  lastSpacePress = 0;
  flightToggles = 0;
}

export function initInput() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'Tab') {
      event.preventDefault();
      const state = useGameStore.getState();
      if (state.backpackOpen) {
        state.setBackpack(false);
        void requestPlay();
      } else if (state.mode === 'play') {
        state.setBackpack(true);
        state.setMode('pause');
        if (document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }
    if (event.code === 'KeyT') {
      event.preventDefault();
      const state = useGameStore.getState();
      if (state.teleportOpen) {
        state.setTeleportOpen(false);
        void requestPlay();
      } else if (state.mode === 'play') {
        state.setTeleportOpen(true);
        state.setMode('pause');
        if (document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }
    if (event.code === 'F5' || event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) useGameStore.getState().toggleCamera();
      return;
    }
    if (event.code === 'Escape') {
      if (document.pointerLockElement !== null) document.exitPointerLock();
      else if (pointerLockFallback && useGameStore.getState().mode === 'play') {
        pointerLockFallback = false;
        clearInput();
        useGameStore.getState().setMode('pause');
      }
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code) && useGameStore.getState().mode === 'play') {
      event.preventDefault();
    }
    if (event.code === 'KeyE' && !event.repeat && hasMouseControl() && useGameStore.getState().mode === 'play') {
      actions.harvest += 1;
    }
    if (event.code === 'Space' && !event.repeat && hasMouseControl() && useGameStore.getState().mode === 'play') {
      const now = performance.now();
      if (now - lastSpacePress <= 300) {
        flightToggles += 1;
        lastSpacePress = 0;
      } else {
        lastSpacePress = now;
      }
    }

    if (/^Digit[0-9]$/.test(event.code)) {
      const digit = Number(event.code.slice(-1));
      const index = digit === 0 ? 9 : digit - 1;
      useGameStore.getState().selectBlock(useGameStore.getState().hotbarSlots[index]);
    }
  });

  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', clearInput);

  window.addEventListener('mousemove', (event) => {
    if (pointerLockFallback && useGameStore.getState().mode === 'play') {
      const margin = 36;
      edgeLook.x = event.clientX <= margin ? -1 : event.clientX >= window.innerWidth - margin ? 1 : 0;
      edgeLook.y = event.clientY <= margin ? -1 : event.clientY >= window.innerHeight - margin ? 1 : 0;
      if (edgeResetTimer) clearTimeout(edgeResetTimer);
      edgeResetTimer = setTimeout(resetEdgeLook, 120);
    }
    if (!hasMouseControl()) return;
    look.x += event.movementX;
    look.y += event.movementY;
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' && event.target instanceof HTMLCanvasElement && useGameStore.getState().mode === 'play' && document.pointerLockElement === null) {
      void requestPlay();
      return;
    }
    if (event.pointerType !== 'touch' || !(event.target instanceof HTMLCanvasElement) || useGameStore.getState().mode !== 'play') return;
    event.preventDefault();
    const canvas = event.target;
    touchPointers.add(event.pointerId);
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointers.size === 1) {
      touchLookPointer = event.pointerId;
      touchLookX = event.clientX;
      touchLookY = event.clientY;
      touchGestureMoved = false;
      twoFingerGesture = false;
      touchStartedAt = performance.now();
    } else if (touchPointers.size === 2) {
      twoFingerGesture = true;
      touchGestureMoved = false;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      touchLookPointer = event.pointerId;
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (!touchPointers.has(event.pointerId)) return;
    event.preventDefault();
    const previous = touchPoints.get(event.pointerId);
    if (previous && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 10) touchGestureMoved = true;
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerId !== touchLookPointer) return;
    look.x += (event.clientX - touchLookX) * 2;
    look.y += (event.clientY - touchLookY) * 2;
    touchLookX = event.clientX;
    touchLookY = event.clientY;
  });
  const endTouchLook = (event: PointerEvent) => {
    if (!touchPointers.has(event.pointerId)) return;
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas');
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    touchPointers.delete(event.pointerId);
    touchPoints.delete(event.pointerId);
    if (touchPointers.size === 0) {
      const duration = performance.now() - touchStartedAt;
      if (!touchGestureMoved && (twoFingerGesture || duration < 800)) {
        if (twoFingerGesture) queuePlacement();
        else toggleMining();
      }
      touchLookPointer = null;
      touchGestureMoved = false;
      twoFingerGesture = false;
      touchStartedAt = 0;
    }
  };
  window.addEventListener('pointerup', endTouchLook);
  window.addEventListener('pointercancel', endTouchLook);

  window.addEventListener('mousedown', (event) => {
    const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
    if (capabilities?.firesTouchEvents) return;
    if (!hasMouseControl() || useGameStore.getState().mode !== 'play') return;
    if (document.pointerLockElement === null && event.target instanceof Element && event.target.closest('button')) return;
    mouseButtons.add(event.button);
    if (event.button === 0) miningLatched = !miningLatched;
    if (event.button === 2) actions.place += 1;
  });
  window.addEventListener('mouseup', (event) => {
    mouseButtons.delete(event.button);
    if (edgeResetTimer) clearTimeout(edgeResetTimer);
    resetEdgeLook();
  });

  window.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('wheel', (event) => {
    if (useGameStore.getState().mode !== 'play') return;
    const state = useGameStore.getState();
    const current = state.hotbarSlots.indexOf(state.selected as (typeof state.hotbarSlots)[number]);
    const next = (current + (event.deltaY > 0 ? 1 : -1) + state.hotbarSlots.length) % state.hotbarSlots.length;
    state.selectBlock(state.hotbarSlots[next]);
  });

  document.addEventListener('pointerlockchange', () => {
    const state = useGameStore.getState();
    if (document.pointerLockElement !== null) {
      pointerLockFallback = false;
      state.setMode('play');
    } else if (!pointerLockFallback) {
      clearInput();
      if (state.mode === 'play') state.setMode('pause');
    }
  });
}

export async function requestPlay() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas');
  if (!canvas) return;

  startMusic();
  canvas.focus();
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (touchDevice || typeof canvas.requestPointerLock !== 'function') {
    pointerLockFallback = true;
    clearInput();
    useGameStore.getState().setMode('play');
    return;
  }

  pointerLockFallback = false;
  try {
    await canvas.requestPointerLock();
  } catch {
    pointerLockFallback = true;
    clearInput();
    useGameStore.getState().setMode('play');
  }
}

export const isDown = (code: string) => keys.has(code) || touchKeys.has(code);
export const isMouseDown = (button: number) => mouseButtons.has(button) || touchMouseButtons.has(button) || (button === 0 && miningLatched);
export const getTouchMovement = () => touchMovement;
export const getEdgeLook = () => edgeLook;

export function toggleMining() {
  miningLatched = !miningLatched;
}

export function stopMining() {
  miningLatched = false;
  mouseButtons.delete(0);
  touchMouseButtons.delete(0);
}

export function setTouchMovement(x: number, y: number) {
  touchMovement.x = x;
  touchMovement.y = y;
}

export function setTouchKey(code: string, down: boolean) {
  if (down) touchKeys.add(code);
  else touchKeys.delete(code);
}

export function setTouchMouseButton(button: number, down: boolean) {
  if (down) touchMouseButtons.add(button);
  else touchMouseButtons.delete(button);
}

export function requestFlightToggle() {
  flightToggles += 1;
}

export function queuePlacement() {
  actions.place += 1;
}

export function consumeFlightToggle() {
  const toggles = flightToggles;
  flightToggles = 0;
  return toggles;
}

export function consumeLook() {
  const result = { ...look };
  look.x = 0;
  look.y = 0;
  return result;
}

export function consumeActions() {
  const result = { ...actions };
  actions.place = 0;
  actions.harvest = 0;
  return result;
}
