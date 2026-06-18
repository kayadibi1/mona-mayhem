/**
 * Match history + leaderboard for Mona Mayhem.
 *
 * The record-shaping and aggregation are pure functions (easy to test); the
 * localStorage-backed store is a thin, browser-only layer guarded so it is safe
 * to import during Astro's server render.
 */
import type { BattleState } from "./types";

export interface MatchRecord {
  id: string;
  playerA: string;
  playerB: string;
  winner: string; // a username, or "Draw"
  ticks: number;
  playedAt: string; // ISO timestamp
}

export interface LeaderboardRow {
  username: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number; // 0..1
}

const STORAGE_KEY = "mona-mayhem:match-history";
const MAX_RECORDS = 100;

/** Turn a finished battle into a storable record. Pure. */
export function recordFromBattle(state: BattleState, id: string, playedAt: string): MatchRecord {
  const [a, b] = state.players;
  return {
    id,
    playerA: a.username,
    playerB: b.username,
    winner: state.winner ?? "Draw",
    ticks: state.tick,
    playedAt,
  };
}

/** Aggregate records into a leaderboard, ranked by wins then win rate. Pure. */
export function buildLeaderboard(records: MatchRecord[]): LeaderboardRow[] {
  const table = new Map<string, LeaderboardRow>();
  const ensure = (name: string): LeaderboardRow => {
    let row = table.get(name);
    if (!row) {
      row = { username: name, wins: 0, losses: 0, draws: 0, played: 0, winRate: 0 };
      table.set(name, row);
    }
    return row;
  };

  for (const m of records) {
    const a = ensure(m.playerA);
    const b = ensure(m.playerB);
    a.played += 1;
    b.played += 1;
    if (m.winner === "Draw") {
      a.draws += 1;
      b.draws += 1;
    } else if (m.winner === m.playerA) {
      a.wins += 1;
      b.losses += 1;
    } else if (m.winner === m.playerB) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  for (const row of table.values()) {
    row.winRate = row.played ? row.wins / row.played : 0;
  }
  return [...table.values()].sort((x, y) => y.wins - x.wins || y.winRate - x.winRate);
}

// ---------- localStorage-backed store (no-ops during SSR) ----------

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadHistory(): MatchRecord[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MatchRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveMatch(record: MatchRecord): MatchRecord[] {
  const next = [record, ...loadHistory()].slice(0, MAX_RECORDS);
  if (hasStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  if (hasStorage()) localStorage.removeItem(STORAGE_KEY);
}
