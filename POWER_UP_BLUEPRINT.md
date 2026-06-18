# 🧩 Blueprint: Random Power-Up Drop System

> **Mona Mayhem — "The Blueprint Boss" challenge.** This is the architecture for
> a new feature, designed *before* implementation using a plan-first workflow.
> The companion scaffold lives in [`src/game/`](src/game/) and is fully typed
> and runnable.

## 1. Goal & scope

Add **random power-up drops** to a battle: every so often a token drops onto the
arena and boosts one player (a heal, an attack buff, a speed buff, a shield).
The hard part is not the buffs themselves — it is keeping **state consistent
across the battle and the two player components** as those buffs apply, tick
down, and expire. That state-propagation design is the focus.

Out of scope for v1: networked play, persistence, animations. The architecture
leaves clean seams for all three (see §10).

## 2. Why plan-first (and what the plan settled)

Designing the data flow on paper surfaced three decisions that would have been
expensive to discover mid-implementation:

1. **Where does battle state live?** → One owner (the battle controller), never
   duplicated into the player components. *(§6)*
2. **How do we keep it testable and fair?** → A **seeded RNG threaded through
   state**, so battles are deterministic and replayable. *(§5)*
3. **How do buffs combine?** → Effective stats are **derived** (`base + active
   modifiers`) every tick, never written back onto the base. *(§4)*

These are exactly the things "iterate on the plan until the architecture is
solid" is meant to catch.

## 3. The battle model

The workshop's base game renders two contribution grids side by side. Power-ups
need something to *affect*, so this feature layers a lightweight **auto-battle**
on top of that data.

**Stat derivation** (`deriveCombatStats`) maps a contribution graph to stats:

| Stat      | Derived from                         | Intuition                        |
| --------- | ------------------------------------ | -------------------------------- |
| `maxHp`   | total contributions                  | a prolific year = more health    |
| `attack`  | busiest single day                   | your best burst hits hardest     |
| `speed`   | contribution consistency             | steady committers act faster     |
| `defense` | contribution consistency             | steady committers shrug off hits |

The fight runs in discrete **ticks**. Each tick: maybe drop a power-up → resolve
simultaneous attacks (`damage = attacker.attack − defender.defense`, min 1) →
age timed buffs → check for a knockout. First to 0 HP loses.

## 4. Data model

Full interfaces in [`src/game/types.ts`](src/game/types.ts). The load-bearing ones:

```ts
interface PlayerState {
  username: string;
  base: CombatStats;        // immutable starting stats
  hp: number;
  modifiers: ActiveModifier[];   // timed buffs from power-ups
}

interface BattleState {
  tick: number;
  rng: number;              // seeded -> deterministic & replayable
  status: "idle" | "running" | "finished";
  players: [PlayerState, PlayerState];
  pendingDrops: DropToken[];
  log: BattleEvent[];
  winner?: string;
}
```

**Key rule:** `base` is never mutated by a power-up. A buff adds an
`ActiveModifier`, and `effectiveStats(player)` folds `base + modifiers` on
demand. Expiry is then just removing a modifier — no need to "undo" anything.

## 5. Power-up catalog & drop lifecycle

Catalog in [`src/game/powerups.ts`](src/game/powerups.ts):

| Power-up           | Rarity | Effect                          |
| ------------------ | ------ | ------------------------------- |
| 💚 Repo Restore    | common | instant +25 HP                  |
| 🔥 Commit Combo    | rare   | +50% attack for 3 ticks         |
| ⚡ CI Turbo        | rare   | +4 speed for 4 ticks            |
| 🛡️ Branch Protection | epic | +6 defense for 3 ticks          |

Lifecycle, all pure functions threading a seeded RNG:

```
tick ──> rollForDrop(rng) ──hit?──> pickPowerUp(rng)  (rarity-weighted)
                                        │
                                        ▼
                              applyPowerUp(player, def)
                              ├─ instant: change hp now (capped)
                              └─ timed:   push an ActiveModifier
                                        │
                          every tick ──> tickModifiers(player)  (age out expired)
```

Because randomness is a seed carried in `BattleState.rng`, the same seed always
produces the same battle — which makes replays, debugging, and unit tests
trivial, and keeps matches fair.

## 6. State propagation across battle & player components  ⭐

This is the architectural heart of the challenge.

```
            ┌──────────────────────────────────────────┐
            │         BattleController (owner)          │
            │   single source of truth: BattleState     │
            │   advances via pure reducer step(state)   │
            └───────────────┬───────────────┬───────────┘
              renders from  │               │  renders from
                            ▼               ▼
                    ┌───────────────┐ ┌───────────────┐
                    │ PlayerCard P1 │ │ PlayerCard P2 │   (presentational)
                    │ HP bar, buffs │ │ HP bar, buffs │
                    └───────┬───────┘ └───────┬───────┘
                            │  dispatch intent │
                            └────────►─────────┘
                              (e.g. COLLECT_DROP)
```

Principles:

- **One owner, one state.** `BattleState` lives only in the controller. The two
  player cards are **derived views** of `state.players[i]` — they hold no mutable
  game state of their own. This kills the classic bug where a power-up updates a
  player object but the battle's copy goes stale (or vice-versa); there is only
  one copy.
- **Pure reducer.** `step(state) => nextState` (and intent actions like
  `COLLECT_DROP`) are pure and immutable. Re-rendering is just "draw the latest
  state," so the battle view and both cards can never disagree.
- **Intents flow up, state flows down.** A player card never mutates anything; if
  the UI lets you click a token to grab it, the card *dispatches*
  `COLLECT_DROP{player, tokenId}` and the reducer resolves it. (The reference
  `step` auto-assigns drops for simplicity; the `pendingDrops` field is already
  in the model for the interactive variant.)
- **Determinism by construction.** RNG state is *in* `BattleState`, so even the
  "random" parts are reproducible from the state alone.

Action set the reducer is built around: `START`, `TICK`, `SPAWN_DROP`,
`COLLECT_DROP`, `EXPIRE_MODS`, `END`.

## 7. Module & file layout (the scaffold)

```
src/game/
  types.ts      # all interfaces — the contract (framework-free)
  powerups.ts   # catalog + pure logic: RNG, drop roll, apply/expire, effectiveStats
  battle.ts     # deriveCombatStats, createBattle, step() reducer, runBattle()
  index.ts      # barrel export
POWER_UP_BLUEPRINT.md   # this document
```

The engine is deliberately **free of Astro/DOM imports** so it stays a pure,
testable core. The UI layer renders from it; it never reaches into the UI.

## 8. Integration with the existing repo

- **Input:** consumes the JSON from the existing
  `src/pages/api/contributions/[username].ts` route (built in workshop Part 2)
  via `deriveCombatStats(contributionData)`.
- **Wiring:** after the contribution graphs render in `src/pages/index.astro`, a
  "Start Battle" button calls `createBattle(p1, p2, seed)` and runs a loop
  (`setInterval`/`requestAnimationFrame`) dispatching `step`, re-rendering the HP
  bars, buff icons, and battle log from the returned state.
- **Isolation:** everything new lives under `src/game/`, so it does not collide
  with the workshop's incremental build of `index.astro`.

## 9. Testing & determinism

Every rule is a pure function, so tests need no DOM and no network:

- `rollForDrop` / `pickPowerUp` — seeded, so assertions are exact.
- `applyPowerUp` / `tickModifiers` / `effectiveStats` — buff stacking and expiry.
- `runBattle(p1, p2, seed)` — **same seed ⇒ identical winner, tick count, and
  log** (verified: a battle and its replay match exactly).

## 10. Extensions (designed-for, not built)

- **Special Moves** (the alternate challenge path): a sibling system. A "meter"
  charges as a player lands hits; at full charge they unleash a signature move
  derived from their top language or longest streak. Slots into the same reducer
  as a `SPECIAL` action — no architectural change.
- **Interactive drops:** use `pendingDrops` + `COLLECT_DROP` for click-to-grab.
- **Authoritative multiplayer:** because the battle is a pure reducer over
  serializable state with a seeded RNG, the exact same `step` can run
  server-side as the source of truth, with clients replaying from the seed.

---

### Appendix — the Plan-Mode prompt progression

How this blueprint was iterated (plan-first, refine, then scaffold):

1. *"Plan a system for random power-up drops during a Mona Mayhem battle (health
   boosts, speed buffs). The base game only renders two GitHub contribution
   graphs, so include how a 'battle' is actually resolved."*
2. *"Refine it: how does state change propagate across the battle controller and
   the two player components without them going out of sync?"*
3. *"Make the randomness deterministic and replayable, and make the buff system
   handle stacking and expiry cleanly."*
4. *"Lay out the files and the public API, then scaffold `src/game/` with typed
   interfaces and the pure logic."*
