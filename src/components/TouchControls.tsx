import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  queuePlacement,
  requestFlightToggle,
  setTouchKey,
  setTouchMouseButton,
  setTouchMovement,
  toggleMining,
} from '../game/input';

function HoldButton({ code, label, className = '' }: { code: string; label: string; className?: string }) {
  const release = () => setTouchKey(code, false);
  return (
    <button
      className={`touch-button ${className}`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setTouchKey(code, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  );
}

export function TouchControls() {
  const joystick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);

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
      <div
        ref={joystick}
        className="touch-joystick"
        aria-label="Joystick de déplacement"
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
      <div className="touch-actions">
        <HoldButton code="Space" label="Sauter" />
        <button
          className="touch-button touch-flight"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            requestFlightToggle();
          }}
        >
          Vol
        </button>
        <HoldButton code="KeyC" label="Descendre" />
        <button
          className="touch-button touch-attack"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setTouchMouseButton(0, true);
            toggleMining();
          }}
          onPointerUp={() => setTouchMouseButton(0, false)}
          onPointerCancel={() => setTouchMouseButton(0, false)}
          onLostPointerCapture={() => setTouchMouseButton(0, false)}
        >
          Frapper
        </button>
        <button
          className="touch-button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            queuePlacement();
          }}
        >
          Poser
        </button>
      </div>
    </div>
  );
}
