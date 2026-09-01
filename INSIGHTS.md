# LILA BLACK – One-Page Architecture + Design Insights

## 1) Architecture overview

This project is a telemetry analysis tool for game-level review. It ingests daily Parquet event files from the `data/` folder, reconstructs player movement and match timelines, and visualizes them on top of map imagery.

### Data pipeline
- The Express server in `server/index.ts` exposes endpoints for dates, files, and file downloads.
- The browser client in `src/services/dataLoader.ts` uses DuckDB WASM to open each `.nakama-*` file and decode the Parquet rows.
- Each match is aggregated by `match_id` and `user_id` into a structured `MatchData` object, where every player gets a `PlayerJourney` with a timestamped path and a list of events.

### Visualization layer
- The main app in `src/App.tsx` loads a date, groups matches by map, and picks a match or merged map view.
- `ControlPanel.tsx` lets the designer toggle humans/bots, event types, heatmap mode, and timeline playback.
- `MapVisualizer.tsx` draws the minimap, player trajectories, event markers, and heatmap overlays over a map canvas.
- `src/config/maps.ts` and `src/utils/coordinateMapper.ts` translate world coordinates into the correct map space for each arena.

### Why this matters
This tool gives a level designer a way to answer questions such as:
- Where are players spending their time?
- Which routes are getting contested?
- Where are the best loot loops and dead-end rotations?
- How much of the loop is created by bots versus humans?

The result is a practical match-analysis view for balancing flow, loot density, and player pressure across each map.

---

## 2) Three insights from the telemetry

### Insight 1: Movement and loot dominate the loop; combat is almost absent from the logged data

- What caught my eye: the event mix is overwhelmingly positional and loot-related.
- Evidence: across the dataset there were 89,104 rows total, with:
  - `Position`: 51,347
  - `BotPosition`: 21,712
  - `Loot`: 12,885
  - `BotKill`: 2,415
  - `Kill`: 3
  - `Killed`: 3
- This means the game’s raw telemetry is mostly describing traversal and resource collection, not firefights. Combat events are effectively a tiny fraction of the dataset.

Actionable read:
- Metrics to watch: loot density per zone, time-to-loot, route occupancy, kill rate per 1,000 player minutes.
- Action items:
  - Increase the value of contested loot loops without creating dead zones.
  - Use path density data to rebalance routes around high-value loot.
  - Add more visible combat pressure in paths that are currently only being used for transit.

Why a level designer should care:
- If the designer only watches combat logs, they will miss the real experience loop. In this dataset, most gameplay behavior is created by movement + loot circulation. Level design must optimize for route flow, not only gunfights.

---

### Insight 2: Ambrose Valley is the main gameplay engine for the game

- What caught my eye: one map is carrying almost the entire event load.
- Evidence:
  - `AmbroseValley`: 61,013 events across 566 matches
  - `Lockdown`: 21,238 events across 171 matches
  - `GrandRift`: 6,853 events across 59 matches
- That means `AmbroseValley` contains roughly 68.5% of all event volume and about 71% of matches in the sample.

Actionable read:
- Metrics to watch: match density, route congestion, loot-per-minute, time spent in high-risk clusters, and win/loss shifts by route choice.
- Action items:
  - Tune the main loot and rotation layout in `AmbroseValley` before tuning the smaller maps.
  - Add alternative routes to relieve pressure on the most used lanes.
  - Rebalance loot placement and safe-house timing to prevent single-route meta dominance.

Why a level designer should care:
- The map with the most traffic is also the one most likely to show balancing issues, route exploitation, and pacing problems. If designers improve the flow in the heavy map first, they get the biggest quality-of-life gain for players.

---

### Insight 3: Bot traffic is a major driver of the intensity loop, even though human combat events are sparse

- What caught my eye: bots are generating a much larger share of the live combat signal than the humans do.
- Evidence:
  - Unique human users: 245
  - Unique bots: 94
  - `BotPosition`: 21,712
  - `BotKill`: 2,415
  - `BotKilled`: 700
  - Human `Kill`: 3
  - Human `Killed`: 3
- This strongly suggests that bot movement and bot combat are shaping the flow of contested spaces, while the human-facing combat data remains very thin in this dataset.

Actionable read:
- Metrics to watch: bot-to-human kill ratio, bot density by zone, bot patrol overlap with loot nodes, and bot aggression curves by map.
- Action items:
  - Rework bot patrol routes so they don’t stack pressure on a small handful of lanes.
  - Move high-value loot away from bot-dominant choke points.
  - Increase route variety to avoid a single bot funnel becoming the default fight path.

Why a level designer should care:
- A level can feel “high action” even when the human event log is sparse, because bots are creating the traffic and pressure. Designers need to understand the bot-driven loop if they want to control pacing and fairness.

---

## Final takeaway

The strongest pattern in this dataset is that the game is primarily experienced as a loop of movement, rotation, and loot collection, with bot traffic creating the majority of visible combat pressure. The level design opportunity is not to chase kill-count spikes alone, but to improve route quality, loot distribution, and map-wide tension in the highest-traffic spaces—especially `AmbroseValley`.

If I were prioritizing changes from this data, I would work in this order:
1. Rebalance the high-density route network in `AmbroseValley`
2. Revisit loot placement around the hottest lanes
3. Tune bot patrol density and aggression to prevent single-point pressure
4. Add richer combat logging if we need cleaner human combat signal for future balancing
