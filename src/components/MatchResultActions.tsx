import { useEffect } from 'react';
import { clearBattle } from '../game/battle';
import { clearMinigames } from '../game/minigameSync';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { canCreateWorld } from '../game/save';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { translate } from '../game/language';

export function MatchResultActions() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const full = !canCreateWorld();
  useEffect(() => { releasePointerForOverlay(); }, []);
  const replay = () => {
    if (full) {
      useGameStore.getState().setNotice(translate('Tu as déjà 20 mondes. Supprimes-en un pour pouvoir rejouer dans un nouveau monde.', 'You already have 20 worlds. Delete one to replay in a new world.'));
      return;
    }
    const worldId = `${gameplayMode}-${crypto.randomUUID().slice(0, 8)}`;
    const multiplayer = useMultiplayerStore.getState();
    clearBattle();
    clearMinigames();
    useGameStore.getState().regenerate(gameplayMode, worldId);
    if (multiplayer.enabled) multiplayer.configure({ playerName: multiplayer.playerName, room: worldId, server: multiplayer.server });
    else useMultiplayerStore.setState({ room: worldId });
    const url = new URL(window.location.href);
    url.searchParams.set('room', worldId);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    useGameStore.getState().setMode('play');
    void requestPlay();
  };
  const quit = () => {
    clearBattle();
    clearMinigames();
    useMultiplayerStore.getState().setEnabled(false);
    useGameStore.getState().setMode('menu');
  };
  return <div className="match-result-actions"><button type="button" className="primary-button" onClick={replay} disabled={full}>{translate('Rejouer', 'Replay')}</button><button type="button" className="secondary-button" onClick={quit}>{translate('Quitter', 'Quit')}</button></div>;
}
