/**
 * Battle engine: turns two contribution graphs into combatants and advances the
 * fight one tick at a time. `step` is a pure reducer — (state) => next state —
 * which is what lets the battle view and both player views stay perfectly in
 * sync (they all render from the single BattleState returned here).
 */
import type {
  BattleEvent,
  BattleState,
  BattleStatus,
  CombatStats,
  ContributionData,
  PlayerState,
  PowerUpDefinition,
} from "./types";
import {
  POWER_UPS,
  applyPowerUp,
  effectiveStats,
  nextRandom,
  pickPowerUp,
  rollForDrop,
  tickModifiers,
} from "./powerups";

/** Chance that a power-up drops on any given tick. */
export const DROP_CHANCE_PER_TICK = 0.25;

/** Map a user's contribution history to starting combat stats. */
export function deriveCombatStats(data: ContributionData): CombatStats {
  const counts = data.days.map((d) => d.count);
  const busiestDay = counts.length ? Math.max(...counts) : 0;
  const activeDays = counts.filter((c) => c > 0).length;
  const consistency = data.days.length ? activeDays / data.days.length : 0;
  return {
    maxHp: 100 + Math.round(data.totalContributions / 5),
    attack: 8 + busiestDay,
    speed: Math.round(5 + consistency * 10),
    defense: Math.round(consistency * 8),
  };
}

function newPlayer(data: ContributionData): PlayerState {
  const base = deriveCombatStats(data);
  return { username: data.username, base, hp: base.maxHp, modifiers: [] };
}

/** Build the initial, deterministic battle state from both players' data. */
export function createBattle(
  p1: ContributionData,
  p2: ContributionData,
  seed = 1,
): BattleState {
  return {
    tick: 0,
    rng: seed >>> 0,
    status: "running",
    players: [newPlayer(p1), newPlayer(p2)],
    pendingDrops: [],
    log: [{ tick: 0, kind: "start", message: `${p1.username} vs ${p2.username}` }],
  };
}

/**
 * Advance the battle by one tick:
 *   1. maybe drop a power-up and auto-assign it to a random player
 *   2. resolve simultaneous attacks (damage = attack - defender's defense)
 *   3. age out timed modifiers
 *   4. check the win condition
 *
 * The reference implementation auto-collects drops for simplicity; an
 * interactive "click the token to grab it" variant would instead push onto
 * `pendingDrops` here and resolve a COLLECT_DROP action from the UI.
 */
export function step(
  state: BattleState,
  catalog: PowerUpDefinition[] = POWER_UPS,
): BattleState {
  if (state.status !== "running") return state;

  const tick = state.tick + 1;
  const log: BattleEvent[] = [];
  let rng = state.rng;
  const players: [PlayerState, PlayerState] = [state.players[0], state.players[1]];

  // 1) Power-up drop.
  const drop = rollForDrop(rng, DROP_CHANCE_PER_TICK);
  rng = drop.seed;
  if (drop.hit) {
    const picked = pickPowerUp(rng, catalog);
    rng = picked.seed;
    const target = nextRandom(rng);
    rng = target.seed;
    const idx: 0 | 1 = target.value < 0.5 ? 0 : 1;
    players[idx] = applyPowerUp(players[idx], picked.def);
    log.push({
      tick,
      kind: "drop",
      message: `${players[idx].username} grabbed ${picked.def.name} ${picked.def.icon}`,
    });
  }

  // 2) Simultaneous attacks.
  const s0 = effectiveStats(players[0]);
  const s1 = effectiveStats(players[1]);
  const dmgTo1 = Math.max(1, s0.attack - s1.defense);
  const dmgTo0 = Math.max(1, s1.attack - s0.defense);
  players[0] = { ...players[0], hp: Math.max(0, players[0].hp - dmgTo0) };
  players[1] = { ...players[1], hp: Math.max(0, players[1].hp - dmgTo1) };
  log.push({
    tick,
    kind: "attack",
    message: `${players[0].username} -${dmgTo0} HP, ${players[1].username} -${dmgTo1} HP`,
  });

  // 3) Expire timed modifiers.
  players[0] = tickModifiers(players[0]);
  players[1] = tickModifiers(players[1]);

  // 4) Win check.
  const dead0 = players[0].hp <= 0;
  const dead1 = players[1].hp <= 0;
  let status: BattleStatus = state.status;
  let winner = state.winner;
  if (dead0 || dead1) {
    status = "finished";
    winner = dead0 && dead1 ? "Draw" : dead1 ? players[0].username : players[1].username;
    log.push({ tick, kind: "end", message: winner === "Draw" ? "Double KO!" : `${winner} wins!` });
  }

  return {
    ...state,
    tick,
    rng,
    players,
    status,
    winner,
    log: [...state.log, ...log],
  };
}

/** Convenience: run a whole battle to completion (used by tests / replays). */
export function runBattle(
  p1: ContributionData,
  p2: ContributionData,
  seed = 1,
  maxTicks = 200,
): BattleState {
  let state = createBattle(p1, p2, seed);
  while (state.status === "running" && state.tick < maxTicks) {
    state = step(state);
  }
  return state;
}
