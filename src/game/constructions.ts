import { create } from 'zustand';
import type { World } from 'koota';
import { startBlueprint } from './blueprints';
import { translate } from './language';
import { useGameStore } from './store';

export type ConstructionKind = 'church' | 'farm' | 'paris' | 'skyscraper' | 'villa';

export const useConstructionStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

export const CONSTRUCTION_INFO = () => ({
  church: { name: translate('Cathédrale gothique', 'Gothic cathedral'), description: translate('Inspirée de Notre-Dame de Paris : rosace, deux tours, arcs-boutants et voûte nervurée.', 'Inspired by Notre-Dame de Paris: rose window, two towers, flying buttresses, and ribbed vault.'), cost: 500 },
  farm: { name: translate('Grande ferme', 'Large farm'), description: translate('Grange rouge, deux silos, dépendance et champ cultivé.', 'Red barn, two silos, shed, and cultivated field.'), cost: 250 },
  paris: { name: translate('Immeuble parisien', 'Parisian building'), description: translate('Cinq étages haussmanniens, balcons, boutiques et toit mansardé.', 'Five Haussmann floors, balconies, shops, and mansard roof.'), cost: 350 },
  skyscraper: { name: translate('Gratte-ciel', 'Skyscraper'), description: translate('Douze étages de verre, balcons, trois retraits et antenne.', 'Twelve glass floors, balconies, three setbacks, and antenna.'), cost: 650 },
  villa: { name: translate('Villa avec piscine', 'Villa with pool'), description: translate('Trois étages, terrasse, toit rouge, piscine et palmiers.', 'Three floors, terrace, red roof, pool, and palm trees.'), cost: 350 },
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
