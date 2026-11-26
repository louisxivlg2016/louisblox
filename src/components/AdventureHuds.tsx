import { useState } from 'react';
import { useGameStore } from '../game/store';
import { usePlanetStore, buyPlanetTool, buildPlanetRocket, travelPlanetUniverse } from '../game/planetClient';
import { startCityBuild, usePlanetPeopleStore } from '../game/planetPeople';
import { useDeepStore, deepMaxOxygen, buyDeepGear, buyDeepOxygen, sellDeepFindings } from '../game/deepClient';
import { useRoleplayStore, chooseRoleplayJob, performRoleplayWork, roleplayHome, sellRoleplaySelected } from '../game/roleplayClient';
import { closeRoleplayCustomer, roleplayCustomerRequest, serveRoleplayCustomer, useRoleplayLifeStore } from '../game/roleplayLife';
import { ROLEPLAY_MARKET } from '../game/roleplayCity';
import type { RoleplayJob } from '../game/roleplayClient';
import { world } from '../game/world';
import { Player, PlayerPosition } from '../game/traits';
import { translate } from '../game/language';
import { requestPlay } from '../game/input';

export function PlanetHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const mined = usePlanetStore((state) => state.mined);
  const coins = usePlanetStore((state) => state.coins);
  const tool = usePlanetStore((state) => state.tool);
  const rocket = usePlanetStore((state) => state.rocket);
  const biome = usePlanetStore((state) => state.biome);
  const universe = usePlanetStore((state) => state.universe);
  const girlRescued = usePlanetPeopleStore((state) => state.girlRescued);
  const cityBuilt = usePlanetPeopleStore((state) => state.cityBuilt);
  const [command, setCommand] = useState('maison');
  if (gameplayMode !== 'planet') return null;
  const nextCost = tool === 0 ? 50 : tool === 1 ? 150 : 400;
  return <>
    <div className="heist-hud" data-planet-hud style={{ pointerEvents: 'auto' }}><strong>{biome}</strong><span>{translate(`${mined} blocs minés · ${coins} pièces`, `${mined} blocks mined · ${coins} coins`)}</span><small>{translate(`Pioche niveau ${tool} · ${rocket ? 'Fusée construite' : 'Fusée à construire'}`, `Pickaxe level ${tool} · ${rocket ? 'Rocket built' : 'Rocket to build'}`)}</small>{!rocket && <button type="button" data-build-rocket onClick={() => buildPlanetRocket(world)}>{translate('Construire la fusée', 'Build rocket')}</button>}{rocket && <button type="button" data-planet-travel onClick={() => travelPlanetUniverse(world, universe === 'zombie' ? 'home' : 'zombie')}>{universe === 'zombie' ? translate('Retour à la planète mère', 'Return to home planet') : translate('Voler vers l’univers zombie', 'Fly to the zombie universe')}</button>}</div>
    {shopOpen && <section className="heist-shop" data-planet-shop><h3>{translate('Atelier spatial', 'Space workshop')}</h3><button type="button" data-close-planet-shop onClick={() => { useGameStore.getState().setShopOpen(false); void requestPlay(); }}>{translate('Quitter l’atelier', 'Leave workshop')}</button>{tool < 3 && <button disabled={coins < nextCost} onClick={() => buyPlanetTool(tool + 1)}>{translate(`Améliorer la pioche · ${nextCost}`, `Upgrade pickaxe · ${nextCost}`)}</button>}<button disabled={rocket} onClick={() => buildPlanetRocket(world)}>{rocket ? translate('Fusée construite', 'Rocket built') : translate('Construire la fusée', 'Build rocket')}</button><small>{translate('Fusée : 40 blocs minés, 30 pierres, 15 fers et 8 ors.', 'Rocket: 40 blocks, 30 stone, 15 iron and 8 gold.')}</small></section>}
    {shopOpen && <section className="heist-shop" data-city-panel style={{ left: 18, right: 'auto' }}><h3>{translate('Construire avec la fille', 'Build with the girl')}</h3><small>{girlRescued ? translate(`${cityBuilt} blocs posés par la fille`, `${cityBuilt} blocks placed by the girl`) : translate('Sauve d’abord la fille avec ton arme.', 'Rescue the girl with your weapon first.')}</small><form onSubmit={(event) => { event.preventDefault(); startCityBuild(world, command); }}><input data-city-command aria-label={translate('Que veux-tu construire ?', 'What do you want to build?')} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={translate('maison, route, tour, mur, ville', 'house, road, tower, wall, city')} /><button type="submit" className="primary-button" data-build-city>{translate('Construire', 'Build')}</button></form></section>}
  </>;
}

export function DeepHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const coins = useDeepStore((state) => state.coins);
  const findings = useDeepStore((state) => state.findings);
  const gear = useDeepStore((state) => state.gear);
  const oxygen = useDeepStore((state) => state.oxygen);
  const depth = useDeepStore((state) => state.depth);
  if (gameplayMode !== 'deep-dive') return null;
  const maximum = deepMaxOxygen(gear);
  const cost = gear === 0 ? 150 : gear === 1 ? 400 : 900;
  return <>
    <div className="heist-hud" data-deep-hud style={{ pointerEvents: 'auto' }}><strong>{translate(`Oxygène ${Math.ceil(oxygen)} s`, `Oxygen ${Math.ceil(oxygen)} s`)}</strong><div role="meter" aria-label={translate('Oxygène restant', 'Remaining oxygen')} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.round(oxygen)} style={{ width: 180, height: 10, background: '#243348', border: '1px solid #9bb7c9' }}><div data-oxygen-bar style={{ width: `${Math.max(0, Math.min(100, oxygen / maximum * 100))}%`, height: '100%', background: oxygen < maximum * 0.2 ? '#e65045' : '#54c9e8' }} /></div><span>{translate(`Profondeur ${depth.toFixed(1)} m · Équipement ${gear}`, `Depth ${depth.toFixed(1)} m · Gear ${gear}`)}</span><small>{translate(`${findings} à vendre · ${coins} pièces`, `${findings} to sell · ${coins} coins`)}</small><button type="button" onClick={sellDeepFindings}>{translate('Vendre à la surface', 'Sell at surface')}</button></div>
    {shopOpen && <section className="heist-shop" data-deep-shop><h3>{translate('VENTE & OXYGÈNE', 'SALES & OXYGEN')}</h3><button data-sell-deep disabled={findings <= 0} onClick={sellDeepFindings}>{translate(`Vendre les trouvailles · ${findings}`, `Sell findings · ${findings}`)}</button><button data-buy-deep-oxygen disabled={coins < 25} onClick={buyDeepOxygen}>{translate('+30 s d’oxygène · 25 pièces', '+30 s oxygen · 25 coins')}</button>{gear < 3 ? <button disabled={coins < cost} onClick={buyDeepGear}>{translate(`Niveau ${gear + 1} · ${cost} pièces · ${deepMaxOxygen(gear + 1)} s`, `Level ${gear + 1} · ${cost} coins · ${deepMaxOxygen(gear + 1)} s`)}</button> : <strong>{translate('Équipement maximal', 'Maximum equipment')}</strong>}<small>{translate('Vends tes trouvailles au stand avant de plonger plus profond.', 'Sell your findings at the stand before diving deeper.')}</small></section>}
  </>;
}

const JOBS: Array<{ id: RoleplayJob; fr: string; en: string; hintFr: string; hintEn: string }> = [
  { id: 'miner', fr: 'Mineur', en: 'Miner', hintFr: 'Mine dans la carrière pour gagner des pièces.', hintEn: 'Mine in the quarry to earn coins.' },
  { id: 'merchant', fr: 'Marchand', en: 'Merchant', hintFr: 'Travaille au marché couvert.', hintEn: 'Work at the covered market.' },
  { id: 'police', fr: 'Policier', en: 'Police officer', hintFr: 'Travaille au poste de police, sans combat.', hintEn: 'Work at the police station, without combat.' },
  { id: 'builder', fr: 'Constructeur', en: 'Builder', hintFr: 'Pose des blocs pour gagner des pièces.', hintEn: 'Place blocks to earn coins.' },
  { id: 'firefighter', fr: 'Pompier', en: 'Firefighter', hintFr: 'Travaille à la caserne de pompiers.', hintEn: 'Work at the fire station.' },
];

export function RoleplayHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const job = useRoleplayStore((state) => state.job);
  const coins = useRoleplayStore((state) => state.coins);
  const panelOpen = useRoleplayStore((state) => state.panelOpen);
  const stock = useRoleplayLifeStore((state) => state.stock);
  const sales = useRoleplayLifeStore((state) => state.sales);
  const arrests = useRoleplayLifeStore((state) => state.arrests);
  const activeCustomerId = useRoleplayLifeStore((state) => state.activeCustomerId);
  const customer = useRoleplayLifeStore((state) => state.npcs.find((npc) => npc.id === activeCustomerId));
  const request = activeCustomerId ? roleplayCustomerRequest() : null;
  if (gameplayMode !== 'roleplay') return null;
  const current = JOBS.find((entry) => entry.id === job);
  const home = roleplayHome();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const nearMarket = player ? Math.hypot(player.x - ROLEPLAY_MARKET.x, player.z - ROLEPLAY_MARKET.z) <= 5 : false;
  return <>
    {customer && request && <div className="backpack-backdrop"><section className="book-panel heist-role-panel" data-roleplay-customer><h2>{translate('Un client au stand', 'A customer at the stand')}</h2><p>{translate(`Bonjour ! Je voudrais ${request.name}, s’il vous plaît.`, `Hello! I would like ${request.name}, please.`)}</p><button type="button" className="primary-button" onClick={() => { if (serveRoleplayCustomer()) void requestPlay(); }}>{translate(`Donner ${request.name} · ${request.price} pièces`, `Give ${request.name} · ${request.price} coins`)}</button><button type="button" className="secondary-button" onClick={() => { closeRoleplayCustomer(); void requestPlay(); }}>{translate('Plus tard', 'Later')}</button></section></div>}
    {panelOpen && <div className="backpack-backdrop"><section className="book-panel heist-role-panel" data-roleplay-jobs><h2>{translate('Choisis ton métier', 'Choose your job')}</h2>{JOBS.map((entry) => <button type="button" className="primary-button" data-job={entry.id} key={entry.id} onClick={() => chooseRoleplayJob(entry.id)}>{translate(entry.fr, entry.en)}</button>)}</section></div>}
    <div className="heist-hud" data-roleplay-hud style={{ pointerEvents: 'auto' }}><strong>{current ? translate(current.fr, current.en) : translate('Sans métier', 'No job')} · {coins} {translate('pièces', 'coins')}</strong><span>{current ? translate(current.hintFr, current.hintEn) : translate('Choisis un métier pour commencer.', 'Choose a job to get started.')}</span><small>{translate(`Ta maison · X ${home.x} · Z ${home.z}`, `Your home · X ${home.x} · Z ${home.z}`)}</small>{job === 'merchant' && <small data-roleplay-sales>{translate(`Stock · pommes ${stock.apple} · pains ${stock.bread} · fer ${stock.ironOre} · diamants ${stock.diamondOre} · ventes ${sales}`, `Stock · apples ${stock.apple} · bread ${stock.bread} · iron ${stock.ironOre} · diamonds ${stock.diamondOre} · sales ${sales}`)}</small>}{job === 'police' && <small>{translate(`Voleurs arrêtés · ${arrests}`, `Thieves arrested · ${arrests}`)}</small>}{job === 'miner' && nearMarket && <button type="button" data-sell-roleplay-ore onClick={sellRoleplaySelected}>{translate('Vendre au marchand ambulant', 'Sell to wandering merchant')}</button>}{(job === 'merchant' || job === 'police' || job === 'firefighter') && <button type="button" onClick={performRoleplayWork}>{translate('Travailler · +20 pièces', 'Work · +20 coins')}</button>}</div>
  </>;
}
