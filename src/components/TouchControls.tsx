import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { queueHarvest, requestFlightToggle, setTouchKey, setTouchMouseButton, setTouchMovement } from '../game/input';
import { useGameStore } from '../game/store';
import { landPlane } from '../game/vehicles';
import { world } from '../game/world';

function HoldButton({ code, label, onDoubleTap }: { code: string; label: string; onDoubleTap?: () => void }) {
  const lastTap = useRef(0);
  const release = () => setTouchKey(code, false);
  return (
    <button
      className="touch-button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setTouchKey(code, true);
        if (code === 'KeyE' && useGameStore.getState().gameplayMode !== 'football') queueHarvest();
        if (onDoubleTap) {
          const now = performance.now();
          if (now - lastTap.current < 300) onDoubleTap();
          lastTap.current = now;
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  );
}

function CannonFireButton() {
  useEffect(() => () => setTouchMouseButton(0, false), []);
  const release = () => setTouchMouseButton(0, false);
  return (
    <button
      type="button"
      className="touch-button touch-attack touch-cannon-fire"
      aria-label="Fire cannon"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setTouchMouseButton(0, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      Fire
    </button>
  );
}

export function TouchControls() {
  const joystick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const football = useGameStore((state) => state.gameplayMode === 'football');
  const riding = useGameStore((state) => state.riding);
  const plane = riding === 'plane';
  const pilot = useGameStore((state) => state.ridingRole === 'driver');
  const cannon = riding === 'cannon' && pilot;
  const flying = useGameStore((state) => state.flying);

  const moveJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = joystick.current!.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (event.clientX - rect.left - radius) / radius;
    let y = (event.clientY - rect.top - radius) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setTouchMovement(x, y);
    if (knob.current) knob.current.style.transform = `translate(${x * 36}px, ${y * 36}px)`;
  };

  const releaseJoystick = () => {
    setTouchMovement(0, 0);
    if (knob.current) knob.current.style.transform = 'translate(0, 0)';
  };

  return (
    <div className="mobile-controls">
      <div className="touch-gesture-hint">{plane ? pilot ? 'Joystick: pilot · Drag: camera' : 'Airplane passenger · Drag: camera' : football ? 'Short tap: shoot · Drag: camera' : 'Short tap: place, mount, or use · Hold: break · Drag: camera'}</div>
      <div
        ref={joystick}
        className="touch-joystick"
        aria-label="Movement joystick"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          moveJoystick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) moveJoystick(event);
        }}
        onPointerUp={releaseJoystick}
        onPointerCancel={releaseJoystick}
        onLostPointerCapture={releaseJoystick}
      >
        <div ref={knob} className="touch-knob" />
      </div>
      {football && <div className="football-touch-actions" aria-label="Actions de football">
        <HoldButton code="KeyE" label="Power shot" />
        <HoldButton code="KeyT" label="Tackle" />
        <HoldButton code="KeyG" label="Pass" />
      </div>}
      <div className={plane ? 'touch-actions plane-touch-actions' : 'touch-actions'}>
        {cannon && <CannonFireButton />}
        {!plane && <>
          <HoldButton code="Space" label="Jump" onDoubleTap={requestFlightToggle} />
          <button
            className="touch-button touch-flight"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              requestFlightToggle();
            }}
          >
            Flight: {flying ? 'ON' : 'OFF'}
          </button>
          <HoldButton code="KeyC" label="Down" />
        </>}
        {plane && pilot && <>
          <HoldButton code="Space" label="Take off / Ascend" />
          <HoldButton code="KeyC" label="Descend" />
          <button
            className="touch-button touch-flight"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              landPlane(world);
            }}
          >
            Land
          </button>
        </>}
        {plane && <HoldButton code="KeyE" label={pilot ? 'Exit' : 'Leave airplane'} />}
        {!plane && riding && <HoldButton code="KeyE" label={riding === 'horse' || riding === 'camel' ? 'Dismount animal' : 'Exit vehicle'} />}
        <button
          className="touch-button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            useGameStore.getState().toggleCamera();
          }}
        >
          Camera
        </button>
      </div>
    </div>
  );
}
