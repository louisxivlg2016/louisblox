import { chooseEmote, resetEmote, useEmoteStore } from '../game/emotes';
import type { EmoteKind } from '../game/emotes';
import { clearInput, requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import emotesButtonUrl from '../../assets/ui/emotes-button.webp';
import { translate } from '../game/language';

const ACTIONS: Array<{ kind: EmoteKind; label: string }> = [
  { kind: 'sit', label: translate('S’asseoir', 'Sit') },
  { kind: 'lie', label: translate('S’aplatir', 'Lie down') },
  { kind: 'wave', label: translate('Dire bonjour', 'Wave') },
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
        <section className="emote-panel" aria-label={translate('Choisir un geste', 'Choose emote')}>
          <header><strong>{translate('Gestes', 'Emotes')}</strong><button onClick={closeMenu} aria-label={translate('Fermer les gestes', 'Close emotes')}>×</button></header>
          {ACTIONS.map((action) => <button key={action.kind} className={current === action.kind ? 'active' : ''} onClick={() => choose(action.kind)}>{action.label}</button>)}
          {(current === 'sit' || current === 'lie') && <button onClick={stand}>{translate('Se relever', 'Stand up')}</button>}
        </section>
      </div>
    );
  }
  if (mode !== 'play') return null;
  return <button className="emote-toggle" onClick={openMenu} aria-label="Animations · Z"><img src={emotesButtonUrl} alt="Animations · Z" /></button>;
}
