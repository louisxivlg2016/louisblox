import { create } from 'zustand';
import type { World } from 'koota';
import { startBlueprint } from './blueprints';
import { translate } from './language';
import { useGameStore } from './store';

export type ConstructionKind = 'church' | 'farm';

export const useConstructionStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

export const CONSTRUCTION_INFO = () => ({
  church: { name: translate('Église à deux tours', 'Two-tower church'), description: translate('Cathédrale détaillée en brique rouge, deux flèches, vitraux, bancs et autel.', 'Detailed red-brick cathedral, two spires, stained glass, pews, and altar.'), cost: 500 },
  farm: { name: translate('Grande ferme', 'Large farm'), description: translate('Grange rouge, deux silos, dépendance et champ cultivé.', 'Red barn, two silos, shed, and cultivated field.'), cost: 250 },
});

export function purchaseConstruction(world: World, kind: ConstructionKind) {
  const store = useGameStore.getState();
  if (!['creative', 'survival', 'city-ancient', 'city-modern'].includes(store.gameplayMode)) return false;
  const info = CONSTRUCTION_INFO()[kind];
  if (!store.spendCoins(info.cost)) {
    store.setNotice(translate(`Il te faut ${info.cost} pièces pour cette construction.`, `You need ${info.cost} coins for this construction.`));
    return false;
  }
  if (!startBlueprint(world, kind)) {
    store.addCoins(info.cost);
    return false;
  }
  store.setNotice(translate(`Plan de ${info.name} acheté pour ${info.cost} pièces. Déplace-le si nécessaire puis construis chaque bloc.`, `${info.name} blueprint bought for ${info.cost} coins. Move it if needed, then build every block.`));
  useConstructionStore.getState().setOpen(false);
  return true;
}
