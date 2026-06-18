/**
 * Power-up catalog and the pure logic that drives drops and modifiers.
 *
 * Everything here is deterministic: random choices are threaded through a
 * seeded RNG so a given seed always produces the same battle. That makes the
 * system replayable, debuggable, and trivial to unit test.
 */
import type {
  ActiveModifier,
  CombatStats,
  PlayerState,
  PowerUpDefinition,
  Rarity,
} from "./types";

/** The drop table. GitHub-flavored names for the arcade theme. */
export const POWER_UPS: PowerUpDefinition[] = [
  {
    id: "heal",
    name: "Repo Restore",
    icon: "\u{1F49A}",
    rarity: "common",
    description: "Instantly restore 25 HP.",
    effect: { type: "instant", amount: 25, mode: "flat" },
  },
  {
    id: "attackBuff",
    name: "Commit Combo",
    icon: "\u{1F525}",
    rarity: "rare",
    description: "+50% attack for 3 ticks.",
    effect: { type: "timed", stat: "attack", amount: 1.5, mode: "multiplier", durationTicks: 3 },
  },
  {
    id: "speedBuff",
    name: "CI Turbo",
    icon: "⚡",
    rarity: "rare",
    description: "+4 speed for 4 ticks.",
    effect: { type: "timed", stat: "speed", amount: 4, mode: "flat", durationTicks: 4 },
  },
  {
    id: "shield",
    name: "Branch Protection",
    icon: "\u{1F6E1}",
    rarity: "epic",
    description: "+6 defense for 3 ticks.",
    effect: { type: "timed", stat: "defense", amount: 6, mode: "flat", durationTicks: 3 },
  },
];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 10 };

/**
 * mulberry32 — a small, fast, deterministic PRNG. Pure: takes a seed, returns a
 * value in [0, 1) plus the next seed to thread forward.
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  let a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: a >>> 0 };
}

/** Roll once to decide whether a power-up drops this tick. */
export function rollForDrop(seed: number, chance: number): { hit: boolean; seed: number } {
  const r = nextRandom(seed);
  return { hit: r.value < chance, seed: r.seed };
}

/** Pick a power-up from the catalog, weighted by rarity. */
export function pickPowerUp(
  seed: number,
  catalog: PowerUpDefinition[] = POWER_UPS,
): { def: PowerUpDefinition; seed: number } {
  const total = catalog.reduce((sum, d) => sum + RARITY_WEIGHT[d.rarity], 0);
  const r = nextRandom(seed);
  let roll = r.value * total;
  for (const def of catalog) {
    roll -= RARITY_WEIGHT[def.rarity];
    if (roll <= 0) return { def, seed: r.seed };
  }
  return { def: catalog[catalog.length - 1], seed: r.seed };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Fold a player's base stats with every active modifier into effective stats. */
export function effectiveStats(player: PlayerState): CombatStats {
  const stats: CombatStats = { ...player.base };
  for (const m of player.modifiers) {
    if (m.mode === "flat") stats[m.stat] += m.amount;
    else stats[m.stat] = Math.round(stats[m.stat] * m.amount);
  }
  return {
    maxHp: Math.max(1, stats.maxHp),
    attack: Math.max(0, stats.attack),
    speed: Math.max(0, stats.speed),
    defense: Math.max(0, stats.defense),
  };
}

/**
 * Apply a collected power-up and return a NEW player state (never mutates).
 * Instant effects act immediately (a heal, capped at max HP); timed effects
 * attach a modifier that `tickModifiers` will age out.
 */
export function applyPowerUp(player: PlayerState, def: PowerUpDefinition): PlayerState {
  const fx = def.effect;
  if (fx.type === "instant") {
    const cap = effectiveStats(player).maxHp;
    return { ...player, hp: clamp(player.hp + fx.amount, 0, cap) };
  }
  const mod: ActiveModifier = {
    source: def.id,
    stat: fx.stat ?? "attack",
    amount: fx.amount,
    mode: fx.mode,
    remainingTicks: fx.durationTicks ?? 1,
  };
  return { ...player, modifiers: [...player.modifiers, mod] };
}

/** Age all timed modifiers by one tick, dropping any that have expired. */
export function tickModifiers(player: PlayerState): PlayerState {
  const modifiers = player.modifiers
    .map((m) => ({ ...m, remainingTicks: m.remainingTicks - 1 }))
    .filter((m) => m.remainingTicks > 0);
  return { ...player, modifiers };
}
