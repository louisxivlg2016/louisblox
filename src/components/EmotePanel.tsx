import { chooseEmote, resetEmote, useEmoteStore } from '../game/emotes';
import type { EmoteKind } from '../game/emotes';
import { clearInput, requestPlay } from '../game/input';
import { useGameStore } from '../game/store';

const ACTIONS: Array<{ kind: EmoteKind; label: string }> = [
  { kind: 'sit', label: 'S’asseoir' },
  { kind: 'lie', label: 'S’aplatir' },
  { kind: 'wave', label: 'Dire bonjour' },
];

export function EmotePanel() {
  const mode = useGameStore((state) => state.mode);
  const open = useEmoteStore((state) => state.open);
  const current = useEmoteStore((state) => state.current);
  const setOpen = useEmoteStore((state) => state.setOpen);
  const openMenu = () => {
    clearInput();
    setOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const closeMenu = () => {
    setOpen(false);
    void requestPlay();
  };
  const choose = (kind: EmoteKind) => {
    chooseEmote(kind);
    closeMenu();
  };
  const stand = () => {
    resetEmote();
    closeMenu();
  };
  if (open) {
    return (
      <div className="emote-backdrop">
        <section className="emote-panel" aria-label="Choisir un geste">
          <header><strong>Gestes</strong><button onClick={closeMenu} aria-label="Fermer les gestes">×</button></header>
          {ACTIONS.map((action) => <button key={action.kind} className={current === action.kind ? 'active' : ''} onClick={() => choose(action.kind)}>{action.label}</button>)}
          {(current === 'sit' || current === 'lie') && <button onClick={stand}>Se relever</button>}
        </section>
      </div>
    );
  }
  if (mode !== 'play') return null;
  return <button className="emote-toggle" onClick={openMenu}>Gestes · Z</button>;
}
