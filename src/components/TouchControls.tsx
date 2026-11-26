import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { queueHarvest, queuePet, requestFlightToggle, setTouchKey, setTouchMouseButton, setTouchMovement } from '../game/input';
import { useGameStore } from '../game/store';
import { landPlane } from '../game/vehicles';
import { world } from '../game/world';
import { translate } from '../game/language';
import { honk, toggleHeadlights, useVehicleControls } from '../game/vehicleControls';
import { isAnimalMount } from '../game/vehicleTypes';
import { allowsBackpack } from '../game/worldMode';

function HoldButton({ code, label, onDoubleTap, ariaLabel }: { code: string; label: string; onDoubleTap?: () => void; ariaLabel?: string }) {
  const lastTap = useRef(0);
  const release = () => setTouchKey(code, false);
  return (
    <button
      className="touch-button"
      aria-label={ariaLabel ?? label}
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
      aria-label={translate('Tirer avec le canon', 'Fire cannon')}
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
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const flightAllowed = !['pirates', 'football', 'maze', 'survival', 'heist', 'delivery', 'skyfall', 'planet', 'deep-dive', 'roleplay'].includes(gameplayMode);
  const riding = useGameStore((state) => state.riding);
  const plane = riding === 'plane';
  const pilot = useGameStore((state) => state.ridingRole === 'driver');
  const cannon = riding === 'cannon' && pilot;
  const animal = isAnimalMount(riding);
  const flying = useGameStore((state) => state.flying);
  const headlights = useVehicleControls((state) => state.headlights);

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
      <div className="touch-gesture-hint">{plane ? pilot ? translate('Joystick : piloter · Glisser : caméra', 'Joystick: pilot · Drag: camera') : translate('Passager de l’avion · Glisser : caméra', 'Airplane passenger · Drag: camera') : football ? translate('Appui court : tir · Glisser : caméra', 'Short tap: shoot · Drag: camera') : translate('Appui court : poser, monter ou utiliser · Maintenir : casser · Glisser : caméra', 'Short tap: place, mount, or use · Hold: break · Drag: camera')}</div>
      <div
        ref={joystick}
        className="touch-joystick"
        aria-label={translate('Joystick de déplacement', 'Movement joystick')}
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
      {riding && pilot && !plane && !cannon && <div className="vehicle-touch-actions" aria-label={translate('Boutons de conduite', 'Driving controls')}>
        <HoldButton code="KeyW" label="↑" ariaLabel={translate('Avancer', 'Forward')} />
        <HoldButton code="KeyS" label="↓" ariaLabel={translate('Reculer', 'Reverse')} />
        <HoldButton code="KeyA" label="←" ariaLabel={translate('Tourner à gauche', 'Turn left')} />
        <HoldButton code="KeyD" label="→" ariaLabel={translate('Tourner à droite', 'Turn right')} />
        {!animal && <><button className={`touch-button${headlights ? ' touch-flight' : ''}`} aria-label={translate('Activer ou couper les phares', 'Toggle headlights')} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); toggleHeadlights(); }}>Phares</button>
        <button className="touch-button" aria-label={translate('Klaxonner', 'Honk horn')} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); honk(); }}>Klaxon</button></>}
      </div>}
      {football && <div className="football-touch-actions" aria-label="Actions de football">
        <HoldButton code="KeyE" label={translate('Tir puissant', 'Power shot')} />
        <HoldButton code="KeyT" label={translate('Tacler', 'Tackle')} />
        <HoldButton code="KeyG" label={translate('Passe', 'Pass')} />
      </div>}
      <div className={plane ? 'touch-actions plane-touch-actions' : 'touch-actions'}>
        {cannon && <CannonFireButton />}
        {!riding && allowsBackpack(gameplayMode) && <button type="button" className="touch-button" aria-label={translate('Caresser l’animal visé', 'Pet the animal you are looking at')} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); queuePet(); }}>{translate('Caresser', 'Pet')}</button>}
        {!plane && <>
          <HoldButton code="Space" label={translate('Sauter', 'Jump')} onDoubleTap={flightAllowed ? requestFlightToggle : undefined} />
          {flightAllowed && <button
            className="touch-button touch-flight"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              requestFlightToggle();
            }}
          >
            Flight: {flying ? 'ON' : 'OFF'}
          </button>}
          {flightAllowed && <HoldButton code="KeyN" label={translate('Bas', 'Down')} />}
        </>}
        {plane && pilot && <>
          <HoldButton code="Space" label={translate('Décoller / Monter', 'Take off / Ascend')} />
          <HoldButton code="KeyN" label={translate('Descendre', 'Descend')} />
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
        {plane && <HoldButton code="KeyE" label={pilot ? translate('Sortir', 'Exit') : translate('Quitter l’avion', 'Leave airplane')} />}
        {!plane && riding && <HoldButton code="KeyE" label={riding === 'horse' || riding === 'camel' ? translate('Descendre de l’animal', 'Dismount animal') : translate('Sortir du véhicule', 'Exit vehicle')} />}
        <button
          className="touch-button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            useGameStore.getState().toggleCamera();
          }}
        >
          {translate('Caméra', 'Camera', 'Cámara')}
        </button>
      </div>
    </div>
  );
}
