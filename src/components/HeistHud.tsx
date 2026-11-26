import { chooseHeistRole, buyHeistItem, useHeistRadar, useHeistStore } from '../game/heistClient';
import { useBattleStore } from '../game/battle';
import { useGameStore } from '../game/store';
import { translate } from '../game/language';
import { BlockKind } from '../game/voxel';

export function HeistHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const role = useHeistStore((state) => state.role);
  const roles = useHeistStore((state) => state.roles);
  const botEnabled = useHeistStore((state) => state.bot.enabled);
  const botDetecting = useHeistStore((state) => state.bot.detecting);
  const phase = useHeistStore((state) => state.phase);
  const endsAt = useHeistStore((state) => state.endsAt);
  const score = useHeistStore((state) => state.score);
  const carried = useHeistStore((state) => state.carried);
  const prison = useHeistStore((state) => state.prison);
  const winner = useHeistStore((state) => state.winner);
  const coins = useHeistStore((state) => state.coins);
  const alarmUntil = useHeistStore((state) => state.alarmUntil);
  const alarmPosition = useHeistStore((state) => state.alarmPosition);
  const grappleReadyAt = useHeistStore((state) => state.grappleReadyAt);
  const taserReadyAt = useHeistStore((state) => state.taserReadyAt);
  const localId = useBattleStore((state) => state.localPlayerId);
  const shopOpen = useGameStore((state) => state.shopOpen);
  if (gameplayMode !== 'heist') return null;
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const imprisoned = prison.includes(localId ?? '');
  const thieves = Object.values(roles).filter((entry) => entry === 'thief').length || (role === 'thief' ? 1 : 0);
  const guards = (Object.values(roles).filter((entry) => entry === 'guard').length || (role === 'guard' ? 1 : 0)) + (botEnabled ? 1 : 0);
  return (
    <>
      {!role && <div className="backpack-backdrop"><section className="book-panel heist-role-panel"><h2>{translate('Choisis ton équipe', 'Choose your team')}</h2><button className="primary-button" onClick={() => chooseHeistRole('thief')}>{translate('Voleur · braquer et s’évader', 'Thief · rob and escape')}</button><button className="primary-button" onClick={() => chooseHeistRole('guard')}>{translate('Gardien · arrêter les voleurs', 'Guard · arrest thieves')}</button></section></div>}
      <div className="heist-hud" data-heist-hud>
        <strong>{phase === 'prep' ? `${translate('Préparation', 'Preparation')} · ${time}` : time}</strong>
        <span>{translate(`Butin ${score}/10 000`, `Loot ${score}/10,000`)}</span>
        {carried > 0 && <span>{translate(`Dans ton dos : ${carried}`, `On your back: ${carried}`)}</span>}
        <small>{role === 'guard' ? translate('Gardien', 'Guard') : translate('Voleur', 'Thief')} · {coins} {translate('pièces', 'coins')}</small>
        <small>{translate(`Voleurs ${Math.min(5, thieves)}/5 · Gardiens ${Math.min(5, guards)}/5`, `Thieves ${Math.min(5, thieves)}/5 · Guards ${Math.min(5, guards)}/5`)}</small>
        {botDetecting && <small>{translate('GARDIEN · DÉTECTÉ !', 'GUARD · SPOTTED!')}</small>}
        {role === 'thief' && grappleReadyAt > Date.now() && <small>{translate(`Grappin ${Math.ceil((grappleReadyAt - Date.now()) / 1000)} s`, `Grapple ${Math.ceil((grappleReadyAt - Date.now()) / 1000)} s`)}</small>}
        {role === 'guard' && taserReadyAt > Date.now() && <small>{translate(`Taser ${Math.ceil((taserReadyAt - Date.now()) / 1000)} s`, `Taser ${Math.ceil((taserReadyAt - Date.now()) / 1000)} s`)}</small>}
        {role === 'guard' && alarmPosition && alarmUntil > Date.now() && <small>{translate(`ALARME · X ${Math.round(alarmPosition.x)} · Z ${Math.round(alarmPosition.z)}`, `ALARM · X ${Math.round(alarmPosition.x)} · Z ${Math.round(alarmPosition.z)}`)}</small>}
      </div>
      {imprisoned && <div className="heist-prison-hint">{translate('En prison · creuse sous le lit avec la pioche en bois, traverse le tunnel et prends l’échelle de sortie.', 'In prison · dig under the bed with the wooden pickaxe, cross the tunnel and take the exit ladder.')}</div>}
      {winner && <div className="battle-death"><strong>{winner === 'thieves' ? translate('Les voleurs ont gagné !', 'The thieves won!') : translate('Les gardiens ont gagné !', 'The guards won!')}</strong></div>}
      {shopOpen && <section className="heist-shop"><h3>{translate('Gadgets de Braquage', 'Heist Gadgets')}</h3>
        {role === 'thief' ? <>
          <button onClick={() => buyHeistItem(BlockKind.Ladder, 300)}>{translate('Échelles ×4 · 300', 'Ladders ×4 · 300')}</button>
          <button onClick={() => buyHeistItem('grappling_hook', 1200)}>{translate('Grappin · 1 200', 'Grapple · 1,200')}</button>
          <button onClick={() => buyHeistItem('gallery_projectiles_smoke_grenade', 400)}>{translate('Fumigène · 400', 'Smoke grenade · 400')}</button>
          <button onClick={() => buyHeistItem(BlockKind.Tnt, 800)}>{translate('Dynamite · 800', 'Dynamite · 800')}</button>
        </> : <>
          <button onClick={() => buyHeistItem('taser', 500)}>{translate('Taser · 500', 'Taser · 500')}</button>
          <button onClick={() => buyHeistItem('heist_trap', 300)}>{translate('Bloc piège · 300', 'Trap block · 300')}</button>
          <button onClick={useHeistRadar}>{translate('Radar d’alarme · 700', 'Alarm radar · 700')}</button>
        </>}
      </section>}
    </>
  );
}
