import { useEffect, useState } from 'react';
import { EFFECT_NAMES, useEffectStore } from '../game/effects';
import type { PotionEffect } from '../game/effects';

export function EffectsHud() {
  const active = useEffectStore((state) => state.active);
  const shield = useEffectStore((state) => state.shield);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="active-effects" aria-label="Effets actifs">
      {Object.entries(active).map(([kind, effect]) => (
        <span key={kind}>{EFFECT_NAMES[kind as PotionEffect]} · {Math.max(0, Math.ceil((effect.until - now) / 1000))} s</span>
      ))}
      {shield && <span>Bouclier · {Math.ceil(shield.value)} · {Math.max(0, Math.ceil((shield.until - now) / 1000))} s</span>}
    </div>
  );
}
