import { useEffect } from 'react';
import { isPaintballGun, PAINT_COLORS, usePaintballStore } from '../game/paintball';
import { useGameStore } from '../game/store';
import { translate } from '../game/language';

export function PaintballPalette() {
  const selected = useGameStore((state) => state.selected);
  const mode = useGameStore((state) => state.mode);
  const color = usePaintballStore((state) => state.color);
  const setColor = usePaintballStore((state) => state.setColor);

  useEffect(() => {
    if (!isPaintballGun(selected) || mode !== 'play') return;
    const changeColor = (event: KeyboardEvent) => {
      if (event.type !== 'keydown' || event.code !== 'KeyC' || event.repeat || useGameStore.getState().riding !== null) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = usePaintballStore.getState().color;
      const index = PAINT_COLORS().findIndex((paint) => paint.value === current);
      usePaintballStore.getState().setColor(PAINT_COLORS()[(index + 1) % PAINT_COLORS().length].value);
    };
    window.addEventListener('keydown', changeColor, true);
    return () => window.removeEventListener('keydown', changeColor, true);
  }, [selected, mode]);

  if (!isPaintballGun(selected) || mode === 'menu') return null;
  return (
    <div className="paintball-palette" role="group" aria-label={translate('Couleur de la peinture', 'Paint color')}>
      <span className="paintball-palette-title">{translate('Peinture · C', 'Paint · C')}</span>
      {PAINT_COLORS().map((paint) => (
        <button
          key={paint.value}
          type="button"
          className={`paintball-color ${color === paint.value ? 'active' : ''}`}
          style={{ backgroundColor: paint.value }}
          aria-label={`${translate('Peinture', 'Paint')} ${paint.name}`}
          aria-pressed={color === paint.value}
          title={`${paint.name} · ${translate('C pour changer', 'C to change')}`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setColor(paint.value);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
    </div>
  );
}
