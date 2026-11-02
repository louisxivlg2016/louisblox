import { startMusic } from './audio';
import { useGameStore } from './store';
import { useSignStore } from './signs';
import { useChatStore } from './chat';
import { useEmoteStore } from './emotes';

const keys = new Set<string>();
const touchKeys = new Set<string>();
const mouseButtons = new Set<number>();
const touchMouseButtons = new Set<number>();
const look = { x: 0, y: 0 };
const edgeLook = { x: 0, y: 0 };
const touchMovement = { x: 0, y: 0 };
const actions = { place: 0, harvest: 0, tap: 0 };
const footballActions = { power: 0, tackle: 0, pass: 0, shot: 0 };
const TOUCH_MINE_DELAY = 400;
let lastSpacePress = 0;
let flightToggles = 0;
let initialized = false;
let pointerLockFallback = false;
let touchLookPointer: number | null = null;
let touchLookX = 0;
let touchLookY = 0;
let touchStartX = 0;
let touchStartY = 0;
let miningLatched = false;
let captureMouseDown = false;
let edgeResetTimer: ReturnType<typeof setTimeout> | null = null;
let touchMineTimer: ReturnType<typeof setTimeout> | null = null;
let touchDidMine = false;
const touchPointers = new Set<number>();
const touchPoints = new Map<number, { x: number; y: number }>();
let touchGestureMoved = false;
let twoFingerGesture = false;

const hasMouseControl = () => document.pointerLockElement !== null || pointerLockFallback;

function captureFootballKey(code: string, repeat: boolean) {
  const game = useGameStore.getState();
  if (game.gameplayMode !== 'football' || game.mode !== 'play' || !['KeyE', 'KeyT', 'KeyG'].includes(code)) return false;
  if (!repeat) footballActions[code === 'KeyE' ? 'power' : code === 'KeyT' ? 'tackle' : 'pass'] += 1;
  return true;
}

function resetEdgeLook() {
  edgeLook.x = 0;
  edgeLook.y = 0;
  edgeResetTimer = null;
}

function stopTouchMining() {
  if (touchMineTimer !== null) clearTimeout(touchMineTimer);
  touchMineTimer = null;
  touchMouseButtons.delete(0);
}

function beginTouchMining() {
  touchMineTimer = null;
  if (touchGestureMoved || twoFingerGesture || touchPointers.size !== 1 || useGameStore.getState().mode !== 'play') return;
  touchDidMine = true;
  actions.tap += 1;
  touchMouseButtons.add(0);
}

export function clearInput(preserveCaptureClick?: boolean | Event) {
  if (preserveCaptureClick !== true) captureMouseDown = false;
  keys.clear();
  touchKeys.clear();
  mouseButtons.clear();
  touchMouseButtons.clear();
  miningLatched = false;
  stopTouchMining();
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
  touchDidMine = false;
  actions.place = 0;
  actions.harvest = 0;
  actions.tap = 0;
  footballActions.power = 0;
  footballActions.shot = 0;
  footballActions.tackle = 0;
  footballActions.pass = 0;
  lastSpacePress = 0;
  flightToggles = 0;
}

export function initInput() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
    if (editable && event.code !== 'Escape') {
      keys.delete(event.code);
      return;
    }
    if (captureFootballKey(event.code, event.repeat)) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Tab') {
      event.preventDefault();
      const state = useGameStore.getState();
      if (state.container) {
        state.closeContainer();
        void requestPlay();
      } else if (state.backpackOpen) {
        state.setBackpack(false);
        void requestPlay();
      } else if (state.mode === 'play') {
        state.setBackpack(true);
        state.setMode('pause');
        if (document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }
    if (event.code === 'KeyZ' && !event.repeat) {
      event.preventDefault();
      const emotes = useEmoteStore.getState();
      if (emotes.open) {
        emotes.setOpen(false);
        void requestPlay();
      } else if (useGameStore.getState().mode === 'play') {
        clearInput();
        emotes.setOpen(true);
        useGameStore.getState().setMode('pause');
        if (document.pointerLockElement) document.exitPointerLock();
      }
      return;
    }
    if (event.code === 'KeyB' && !event.repeat) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      event.preventDefault();
      const state = useGameStore.getState();
      if (state.shopOpen) {
        state.setShopOpen(false);
        void requestPlay();
      } else {
        state.setShopOpen(true);
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
      if (useEmoteStore.getState().open) {
        event.preventDefault();
        useEmoteStore.getState().setOpen(false);
        window.setTimeout(() => { void requestPlay(); }, 50);
        return;
      }
      if (useChatStore.getState().open) {
        event.preventDefault();
        useChatStore.getState().setOpen(false);
        window.setTimeout(() => { void requestPlay(); }, 50);
        return;
      }
      if (useSignStore.getState().editing) {
        useSignStore.getState().closeSign();
        void requestPlay();
        return;
      }
      if (useGameStore.getState().bookOpen) {
        useGameStore.getState().setBookOpen(false);
        void requestPlay();
        return;
      }
      if (useGameStore.getState().seatChoice) {
        useGameStore.getState().setSeatChoice(null);
        void requestPlay();
        return;
      }
      if (useGameStore.getState().container) {
        useGameStore.getState().closeContainer();
        void requestPlay();
        return;
      }
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
    if (event.code === 'KeyQ' && !event.repeat && useGameStore.getState().mode === 'play') {
      event.preventDefault();
      void import('./droppedItems').then(({ dropSelectedItem }) => dropSelectedItem());
    }
    if (event.code === 'KeyE' && !event.repeat && useGameStore.getState().mode === 'play') {
      actions.harvest += 1;
    }
    if (event.code === 'Space' && !event.repeat && useGameStore.getState().mode === 'play') {
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
      const selected = useGameStore.getState().hotbarSlots[index];
      if (selected !== null) useGameStore.getState().selectBlock(selected);
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
      captureMouseDown = true;
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
      touchStartX = event.clientX;
      touchStartY = event.clientY;
      touchGestureMoved = false;
      twoFingerGesture = false;
      touchDidMine = false;
      stopTouchMining();
      touchMineTimer = setTimeout(beginTouchMining, TOUCH_MINE_DELAY);
    } else if (touchPointers.size === 2) {
      twoFingerGesture = true;
      touchGestureMoved = false;
      stopTouchMining();
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
    const moved = previous && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 10;
    const cameraDragged = event.pointerId === touchLookPointer && Math.hypot(event.clientX - touchStartX, event.clientY - touchStartY) > 10;
    if (moved || cameraDragged) {
      touchGestureMoved = true;
      stopTouchMining();
    }
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerId !== touchLookPointer) return;
    look.x += (event.clientX - touchLookX) * 2;
    look.y += (event.clientY - touchLookY) * 2;
    touchLookX = event.clientX;
    touchLookY = event.clientY;
  });
  const endTouchLook = (event: PointerEvent) => {
    if (!touchPointers.has(event.pointerId)) return;
    stopTouchMining();
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas');
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    touchPointers.delete(event.pointerId);
    touchPoints.delete(event.pointerId);
    if (touchPointers.size === 0) {
      if (event.type === 'pointerup' && !touchGestureMoved && (twoFingerGesture || !touchDidMine)) queuePlacement();
      touchLookPointer = null;
      touchGestureMoved = false;
      twoFingerGesture = false;
      touchDidMine = false;
    }
  };
  window.addEventListener('pointerup', endTouchLook);
  window.addEventListener('pointercancel', endTouchLook);

  window.addEventListener('mousedown', (event) => {
    if (captureMouseDown) {
      captureMouseDown = false;
      return;
    }
    const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
    if (capabilities?.firesTouchEvents) return;
    if (!hasMouseControl() || useGameStore.getState().mode !== 'play') return;
    if (document.pointerLockElement === null && event.target instanceof Element && event.target.closest('button')) return;
    if (event.button === 0 && useGameStore.getState().gameplayMode === 'football') {
      footballActions.shot += 1;
      return;
    }
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
    const direction = event.deltaY > 0 ? 1 : -1;
    for (let offset = 1; offset <= state.hotbarSlots.length; offset += 1) {
      const selected = state.hotbarSlots[(current + direction * offset + state.hotbarSlots.length * 2) % state.hotbarSlots.length];
      if (selected !== null) {
        state.selectBlock(selected);
        break;
      }
    }
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
  let canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas, canvas#game-canvas');
  if (!canvas) {
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas, canvas#game-canvas');
  }
  if (!canvas) return;

  startMusic();
  canvas.focus();
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (touchDevice || typeof canvas.requestPointerLock !== 'function') {
    pointerLockFallback = true;
    clearInput(true);
    useGameStore.getState().setMode('play');
    return;
  }

  pointerLockFallback = false;
  try {
    await Promise.race([
      Promise.resolve(canvas.requestPointerLock()),
      new Promise<never>((_, reject) => { window.setTimeout(() => reject(new Error('Verrouillage de la souris indisponible')), 600); }),
    ]);
  } catch {
    pointerLockFallback = true;
  }
  if (!document.pointerLockElement) {
    pointerLockFallback = true;
    clearInput(true);
    useGameStore.getState().setMode('play');
  }
}

export const isDown = (code: string) => keys.has(code) || touchKeys.has(code);
export const isMouseButtonDown = (button: number) => mouseButtons.has(button) || touchMouseButtons.has(button);
export const isMouseDown = (button: number) => isMouseButtonDown(button) || (button === 0 && miningLatched);
export const getTouchMovement = () => touchMovement;
export const getEdgeLook = () => edgeLook;

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
  if (down && captureFootballKey(code, false)) return;
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
  if (useGameStore.getState().gameplayMode === 'football') {
    footballActions.shot += 1;
    return;
  }
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
  actions.tap = 0;
  return result;
}

export function consumeFootballAction() {
  const action = (['power', 'tackle', 'pass', 'shot'] as const).find((name) => footballActions[name] > 0);
  if (action) footballActions[action] -= 1;
  return action ?? null;
}
