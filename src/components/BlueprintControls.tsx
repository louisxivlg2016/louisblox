import { useEffect } from 'react';
import { autoBuildBlueprint, cancelBlueprint, moveBlueprint, placeNextBlueprintBlock, resumeBlueprint, useBlueprintStore } from '../game/blueprints';
import { CONSTRUCTION_INFO } from '../game/constructions';
import { selectionInfo } from '../game/items';
import { translate } from '../game/language';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { allowsConstruction } from '../game/worldMode';

export function BlueprintControls() {
  const worldId = useGameStore((state) => state.worldId);
  const mode = useGameStore((state) => state.mode);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const active = useBlueprintStore((state) => state.active);
  const autoBuilding = useBlueprintStore((state) => state.autoBuilding);
  useEffect(() => resumeBlueprint(world), [worldId]);
  if (!active || mode !== 'play' || !allowsConstruction(gameplayMode)) return null;
  const block = active.blocks[active.index];
  return (
    <div className="blueprint-controls" data-blueprint-controls>
      <strong>{CONSTRUCTION_INFO()[active.kind].name} · {active.index + 1}/{active.blocks.length}</strong>
      <span>{translate('Bloc à placer', 'Block to place')} · {selectionInfo(block.kind).name}</span>
      <div>
        <button type="button" data-auto-build-blueprint disabled={autoBuilding} onClick={() => autoBuildBlueprint()}>{autoBuilding ? translate('Construction en cours…', 'Building…') : translate('Construire en 3 secondes', 'Build in 3 seconds')}</button>
        <button type="button" data-place-blueprint-block disabled={autoBuilding} onClick={() => placeNextBlueprintBlock()}>{translate('Poser le bloc · E', 'Place block · E')}</button>
        <button type="button" disabled={autoBuilding || active.index > 0} onClick={() => moveBlueprint(world)}>{translate('Déplacer le plan', 'Move blueprint')}</button>
        <button type="button" onClick={cancelBlueprint}>{translate('Annuler', 'Cancel')}</button>
      </div>
    </div>
  );
}
