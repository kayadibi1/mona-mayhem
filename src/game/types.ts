/**
 * Mona Mayhem — Power-Up System types.
 *
 * These interfaces are the contract the whole feature is designed around. They
 * are intentionally framework-free (no Astro / DOM imports) so the battle logic
 * stays a pure, testable core that the UI layer renders from.
 */

/** One day of a user's GitHub contribution graph. */
export interface ContributionDay {
  date: string;
  count: number;
  /** GitHub's 0-4 intensity bucket, used for the colored grid. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Shape returned by the existing /api/contributions/[username] route. */
export interface ContributionData {
  username: string;
  totalContributions: number;
  range: { from: string; to: string };
  days: ContributionDay[];
}

export type StatKey = "maxHp" | "attack" | "speed" | "defense";

export interface CombatStats {
  maxHp: number;
  attack: number;
  speed: number;
  defense: number;
}

export type Rarity = "common" | "rare" | "epic";
export type PowerUpKind = "heal" | "attackBuff" | "speedBuff" | "shield";

/**
 * What a power-up does. `instant` effects fire once (e.g. a heal); `timed`
 * effects add a modifier that lives for `durationTicks` and then expires.
 */
export interface PowerUpEffect {
  type: "instant" | "timed";
  stat?: StatKey;
  amount: number;
  mode: "flat" | "multiplier";
  durationTicks?: number;
}

export interface PowerUpDefinition {
  id: PowerUpKind;
  name: string;
  /** Emoji icon for the retro arcade UI. */
  icon: string;
  rarity: Rarity;
  description: string;
  effect: PowerUpEffect;
}

/** A timed buff currently attached to a player. */
export interface ActiveModifier {
  source: PowerUpKind;
  stat: StatKey;
  amount: number;
  mode: "flat" | "multiplier";
  remainingTicks: number;
}

export interface PlayerState {
  username: string;
  base: CombatStats;
  hp: number;
  modifiers: ActiveModifier[];
}

/** A power-up that has dropped onto the arena but not yet been collected. */
export interface DropToken {
  id: string;
  kind: PowerUpKind;
  spawnedTick: number;
}

export interface BattleEvent {
  tick: number;
  kind: "start" | "drop" | "attack" | "expire" | "end";
  message: string;
}

export type BattleStatus = "idle" | "running" | "finished";

/**
 * The single source of truth for a battle. It is plain, serializable data
 * driven by a pure reducer (`step`), so the battle view and both player views
 * always render from the same state and can never disagree. The seeded `rng`
 * makes every battle deterministic and replayable.
 */
export interface BattleState {
  tick: number;
  rng: number;
  status: BattleStatus;
  players: [PlayerState, PlayerState];
  pendingDrops: DropToken[];
  log: BattleEvent[];
  winner?: string;
}
