import { requestPlay } from '../game/input';
import { MEAT_NAMES } from '../game/meats';
import type { AnimalKind } from '../game/animals';
import { useGameStore } from '../game/store';
import { BLOCK_INFO, HOTBAR_BLOCKS } from '../game/voxel';

export function Backpack() {
  const open = useGameStore((state) => state.backpackOpen);
  const selected = useGameStore((state) => state.selected);
  const apples = useGameStore((state) => state.apples);
  const meat = useGameStore((state) => state.meat);
  const selectBlock = useGameStore((state) => state.selectBlock);
  const setBackpack = useGameStore((state) => state.setBackpack);
  const discardApple = useGameStore((state) => state.discardApple);
  const discardMeat = useGameStore((state) => state.discardMeat);
  if (!open) return null;

  const close = () => {
    setBackpack(false);
    void requestPlay();
  };
  const resources = (Object.entries(meat) as Array<[AnimalKind, number]>).filter(([, count]) => count > 0);

  return (
    <div className="backpack-backdrop">
      <section className="backpack-panel" aria-label="Sac à dos">
        <div className="backpack-header">
          <h2>Sac à dos</h2>
          <button className="secondary-button" onClick={close}>Fermer et reprendre</button>
        </div>
        <p className="backpack-label">Blocs</p>
        <div className="backpack-blocks">
          {HOTBAR_BLOCKS.map((kind, index) => (
            <button
              key={kind}
              className={`backpack-block ${selected === kind ? 'selected' : ''}`}
              onClick={() => {
                selectBlock(kind);
                close();
              }}
            >
              <span className="block-swatch" style={{ backgroundColor: BLOCK_INFO[kind].color }} />
              <span>{index === 9 ? '0' : index + 1} · {BLOCK_INFO[kind].name}</span>
            </button>
          ))}
        </div>
        <p className="backpack-label">Ressources et poubelle</p>
        <div className="backpack-resources">
          <div className="backpack-resource">
            <span>Pommes ×{apples}</span>
            <button onClick={discardApple} disabled={apples === 0}>Jeter 1</button>
          </div>
          {resources.map(([kind, count]) => (
            <div className="backpack-resource" key={kind}>
              <span>{MEAT_NAMES[kind]} ×{count}</span>
              <button onClick={() => discardMeat(kind)}>Jeter 1</button>
            </div>
          ))}
          {apples === 0 && resources.length === 0 && <p>Aucune ressource à jeter.</p>}
        </div>
      </section>
    </div>
  );
}
