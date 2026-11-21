import { useEffect } from 'react';
import { cancelBlueprint, moveBlueprint, placeNextBlueprintBlock, resumeBlueprint, useBlueprintStore } from '../game/blueprints';
import { CONSTRUCTION_INFO } from '../game/constructions';
import { selectionInfo } from '../game/items';
import { translate } from '../game/language';
import { useGameStore } from '../game/store';
import { world } from '../game/world';

export function BlueprintControls() {
  const worldId = useGameStore((state) => state.worldId);
  const mode = useGameStore((state) => state.mode);
  const active = useBlueprintStore((state) => state.active);
  useEffect(() => resumeBlueprint(world), [worldId]);
  if (!active || mode !== 'play') return null;
  const block = active.blocks[active.index];
  return (
    <div className="blueprint-controls" data-blueprint-controls>
      <strong>{CONSTRUCTION_INFO()[active.kind].name} · {active.index + 1}/{active.blocks.length}</strong>
      <span>{translate('Bloc à placer', 'Block to place')} · {selectionInfo(block.kind).name}</span>
      <small>{translate('Le bloc lumineux indique son emplacement. E ou le bouton pour construire.', 'The glowing block shows where to build. E or the button to build.')}</small>
      <div>
        <button type="button" data-place-blueprint-block onClick={() => placeNextBlueprintBlock()}>{translate('Poser le bloc · E', 'Place block · E')}</button>
        <button type="button" disabled={active.index > 0} onClick={() => moveBlueprint(world)}>{translate('Déplacer le plan', 'Move blueprint')}</button>
        <button type="button" onClick={cancelBlueprint}>{translate('Annuler', 'Cancel')}</button>
      </div>
    </div>
  );
}
