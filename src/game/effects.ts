import { create } from 'zustand';
import type { World } from 'koota';
import { useGameStore } from './store';
import { useMultiplayerStore } from './multiplayerStore';
import { Player, PlayerHealth } from './traits';

export const POTION_EFFECTS = ['speed', 'slowness', 'jump', 'doubleJump', 'haste', 'strength', 'weakness', 'defence', 'regeneration', 'poison', 'invisibility', 'heatResistance', 'knockback'] as const;
export type PotionEffect = typeof POTION_EFFECTS[number];
type ActiveEffect = { until: number; nextTick?: number };
type Shield = { until: number; value: number };

export const EFFECT_NAMES: Record<PotionEffect, string> = {
  speed: 'Speed', slowness: 'Slowness', jump: 'Super Jump', doubleJump: 'Double Jump', haste: 'Haste',
  strength: 'Strength', weakness: 'Weakness', defence: 'Defense', regeneration: 'Regeneration', poison: 'Poison',
  invisibility: 'Invisibility', heatResistance: 'Fire Resistance', knockback: 'Knockback',
};

const negativeEffects = new Set<PotionEffect>(['slowness', 'weakness', 'poison']);
const effectSet = new Set<string>(POTION_EFFECTS);

export const useEffectStore = create<{
  active: Partial<Record<PotionEffect, ActiveEffect>>;
  shield: Shield | null;
  activate: (kind: PotionEffect, duration: number) => void;
  schedule: (kind: PotionEffect, nextTick: number) => void;
  clearNegative: () => void;
  reset: () => void;
  prune: () => void;
}>((set) => ({
  active: {},
  shield: null,
  activate: (kind, duration) => {
    const now = Date.now();
    set((state) => ({ active: { ...state.active, [kind]: { until: now + duration * 1000, nextTick: now + 2000 } } }));
  },
  schedule: (kind, nextTick) => set((state) => {
    const effect = state.active[kind];
    return effect ? { active: { ...state.active, [kind]: { ...effect, nextTick } } } : state;
  }),
  clearNegative: () => set((state) => ({ active: Object.fromEntries(Object.entries(state.active).filter(([kind]) => !negativeEffects.has(kind as PotionEffect))) })),
  reset: () => set({ active: {}, shield: null }),
  prune: () => {
    const now = Date.now();
    set((state) => {
      const active = Object.fromEntries(Object.entries(state.active).filter(([, effect]) => effect.until > now)) as Partial<Record<PotionEffect, ActiveEffect>>;
      const shield = state.shield && state.shield.until > now && state.shield.value > 0 ? state.shield : null;
      if (Object.keys(active).length === Object.keys(state.active).length && shield === state.shield) return state;
      return { active, shield };
    });
  },
}));

export function hasEffect(kind: PotionEffect) {
  return (useEffectStore.getState().active[kind]?.until ?? 0) > Date.now();
}

export function activeEffectKeys() {
  return POTION_EFFECTS.filter(hasEffect);
}

export function movementMultiplier() {
  return hasEffect('slowness') ? 0.55 : hasEffect('speed') ? 1.6 : 1;
}

export function jumpMultiplier() {
  return hasEffect('jump') ? 1.45 : 1;
}

export function miningMultiplier() {
  return hasEffect('haste') ? 2 : 1;
}

export function attackMultiplier() {
  return (hasEffect('strength') ? 2 : 1) * (hasEffect('weakness') ? 0.5 : 1);
}

export function defenceMultiplier() {
  return hasEffect('defence') ? 0.5 : 1;
}

export function activateShield(value = 4, duration = 60) {
  useEffectStore.setState({ shield: { value, until: Date.now() + duration * 1000 } });
}

export function absorbWithShield(amount: number) {
  const shield = useEffectStore.getState().shield;
  if (!shield || shield.until <= Date.now()) return amount;
  const absorbed = Math.min(shield.value, amount);
  useEffectStore.setState({ shield: absorbed >= shield.value ? null : { ...shield, value: shield.value - absorbed } });
  return amount - absorbed;
}

function isBattleOnline() {
  const multiplayer = useMultiplayerStore.getState();
  return useGameStore.getState().gameplayMode === 'battle' && multiplayer.enabled && multiplayer.status === 'online';
}

function setHealth(world: World, value: number) {
  const player = world.queryFirst(Player);
  const health = player?.get(PlayerHealth);
  if (!player || !health) return false;
  const next = Math.max(1, Math.min(health.max, value));
  player.set(PlayerHealth, { value: next });
  useGameStore.getState().setLives(next);
  return true;
}

export function healPlayer(world: World, amount: number) {
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (!health || health.value >= health.max) return false;
  if (isBattleOnline()) {
    void import('./battle').then(({ requestBattleHeal }) => requestBattleHeal(amount));
    return true;
  }
  return setHealth(world, health.value + amount);
}

function harmPlayer(world: World, amount: number) {
  if (isBattleOnline()) {
    void import('./battle').then(({ requestBattleHeal }) => requestBattleHeal(-amount));
    return;
  }
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (health) setHealth(world, health.value - absorbWithShield(amount));
}

export function hasActiveEffects() {
  const { active, shield } = useEffectStore.getState();
  const now = Date.now();
  return Object.values(active).some((effect) => effect.until > now) || Boolean(shield && shield.until > now && shield.value > 0);
}

export function effectSystem(world: World, _dt: number) {
  const now = Date.now();
  if (now - (effectClocks.get(world) ?? 0) >= 200) {
    effectClocks.set(world, now);
    useEffectStore.getState().prune();
  }
  if (isBattleOnline()) return hasActiveEffects();
  for (const kind of ['regeneration', 'poison'] as const) {
    const effect = useEffectStore.getState().active[kind];
    if (!effect || now < (effect.nextTick ?? now + 1)) continue;
    useEffectStore.getState().schedule(kind, now + 2000);
    const health = world.queryFirst(Player)?.get(PlayerHealth);
    if (!health) continue;
    if (kind === 'regeneration') healPlayer(world, 1);
    else if (health.value > 1) setHealth(world, health.value - 1);
  }
  return hasActiveEffects();
}
const effectClocks = new WeakMap<World, number>();

export function usePotion(world: World, name: string) {
  const normalized = name.toLowerCase().replace(/^splash /, '');
  const arrow = normalized.startsWith('arrow of ') ? normalized.slice('arrow of '.length) : null;
  const value = arrow === null ? normalized : `${arrow === 'jumping' ? 'jump' : arrow === 'shield' ? 'sheild' : arrow} potion`;
  const store = useGameStore.getState();
  if (value === 'empty bottle') return { used: false, message: 'Bouteille vide : utilise-la sur de l’eau pour la remplir.' };
  if (value === 'water bottle' || value === 'milk potion') {
    if (value === 'water bottle') useEffectStore.getState().clearNegative();
    else useEffectStore.getState().reset();
    return { used: true, message: value === 'water bottle' ? 'Negative effects removed.' : 'Milk removes all effects.' };
  }
  if (value === 'instant healing potion') {
    const healed = healPlayer(world, 6);
    return { used: true, message: healed ? 'Instant healing: +6 lives.' : 'Instant healing: your lives are already full.' };
  }
  if (value === 'instant damage potion') {
    harmPlayer(world, 3);
    return { used: true, message: 'Damage potion: -3 lives.' };
  }
  const timed = (kind: PotionEffect, duration: number, message = `${EFFECT_NAMES[kind]} for ${duration} seconds.`) => {
    useEffectStore.getState().activate(kind, duration);
    store.setNotice(message);
    return { used: true, message };
  };
  if (value === 'regeneration potion') return timed('regeneration', 20, 'Regeneration: +1 life every 2 seconds for 20 seconds.');
  if (value === 'strength potion') return timed('strength', 60);
  if (value === 'weakness potion') return timed('weakness', 30);
  if (value === 'defence potion') return timed('defence', 60);
  if (value === 'sheild potion') {
    activateShield();
    return { used: true, message: 'Shield: absorbs 4 damage points for 60 seconds.' };
  }
  if (value === 'speed potion') return timed('speed', 60);
  if (value === 'slowness potion') return timed('slowness', 30);
  if (value === 'jump potion') return timed('jump', 60);
  if (value === 'double jump potion') return timed('doubleJump', 45);
  if (value === 'haste potion') return timed('haste', 60);
  if (value === 'invisibility potion') return timed('invisibility', 45);
  if (value === 'poison potion') return timed('poison', 15, 'Poison: -1 life every 2 seconds, without dropping below 1 life.');
  if (value === 'heat resistance potion') return timed('heatResistance', 60);
  if (value === 'knockback potion') return timed('knockback', 45);
  if (value === 'brain rot potion') {
    useEffectStore.getState().activate('weakness', 20);
    useEffectStore.getState().activate('slowness', 20);
    return { used: true, message: 'Brain fog: weakness and slowness for 20 seconds.' };
  }
  if (value === 'aura xp potion') {
    useEffectStore.getState().activate('strength', 30);
    useEffectStore.getState().activate('regeneration', 20);
    return { used: true, message: 'Aura: strength for 30 seconds and regeneration for 20 seconds.' };
  }
  if (value === 'chaos potion') {
    const choices: PotionEffect[] = ['speed', 'jump', 'strength', 'regeneration', 'invisibility'];
    const kind = choices[Math.floor(Math.random() * choices.length)];
    return timed(kind, 30, `Chaos: ${EFFECT_NAMES[kind]} for 30 seconds.`);
  }
  return { used: false, message: `${name} has no drinking effect.` };
}

export function isPotionEffect(value: unknown): value is PotionEffect {
  return typeof value === 'string' && effectSet.has(value);
}
