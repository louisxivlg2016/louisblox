import { startMusic } from './audio';
import { useGameStore } from './store';
import { HOTBAR_BLOCKS } from './voxel';

const keys = new Set<string>();
const touchKeys = new Set<string>();
const mouseButtons = new Set<number>();
const touchMouseButtons = new Set<number>();
const look = { x: 0, y: 0 };
const touchMovement = { x: 0, y: 0 };
const actions = { place: 0, harvest: 0 };
let lastSpacePress = 0;
let flightToggles = 0;
let initialized = false;
let pointerLockFallback = false;
let touchLookPointer: number | null = null;
let touchLookX = 0;
let touchLookY = 0;

const hasMouseControl = () => document.pointerLockElement !== null || pointerLockFallback;

export function clearInput() {
  keys.clear();
  touchKeys.clear();
  mouseButtons.clear();
  touchMouseButtons.clear();
  look.x = 0;
  look.y = 0;
  touchMovement.x = 0;
  touchMovement.y = 0;
  touchLookPointer = null;
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

    if (/^Digit[1-8]$/.test(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      useGameStore.getState().selectBlock(HOTBAR_BLOCKS[index]);
    }
  });

  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', clearInput);

  window.addEventListener('mousemove', (event) => {
    if (!hasMouseControl()) return;
    look.x += event.movementX;
    look.y += event.movementY;
  });

  window.addEventListener('pointerdown', (event) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    if (event.pointerType !== 'touch' || event.target !== canvas || useGameStore.getState().mode !== 'play') return;
    touchLookPointer = event.pointerId;
    touchLookX = event.clientX;
    touchLookY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== touchLookPointer) return;
    look.x += (event.clientX - touchLookX) * 1.5;
    look.y += (event.clientY - touchLookY) * 1.5;
    touchLookX = event.clientX;
    touchLookY = event.clientY;
  });
  const endTouchLook = (event: PointerEvent) => {
    if (event.pointerId === touchLookPointer) touchLookPointer = null;
  };
  window.addEventListener('pointerup', endTouchLook);
  window.addEventListener('pointercancel', endTouchLook);

  window.addEventListener('mousedown', (event) => {
    const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
    if (capabilities?.firesTouchEvents) return;
    if (!hasMouseControl() || useGameStore.getState().mode !== 'play') return;
    if (document.pointerLockElement === null && event.target instanceof Element && event.target.closest('button')) return;
    mouseButtons.add(event.button);
    if (event.button === 2) actions.place += 1;
  });
  window.addEventListener('mouseup', (event) => mouseButtons.delete(event.button));

  window.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('wheel', (event) => {
    if (useGameStore.getState().mode !== 'play') return;
    const state = useGameStore.getState();
    const current = HOTBAR_BLOCKS.indexOf(state.selected as (typeof HOTBAR_BLOCKS)[number]);
    const next = (current + (event.deltaY > 0 ? 1 : -1) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
    state.selectBlock(HOTBAR_BLOCKS[next]);
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
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
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
export const isMouseDown = (button: number) => mouseButtons.has(button) || touchMouseButtons.has(button);
export const getTouchMovement = () => touchMovement;

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
