Architecture overview
This project is a telemetry analysis tool for game-level review. It ingests daily Parquet event files from the data/ folder, reconstructs player movement and match timelines, and visualizes them on top of map imagery.

Data pipeline
The Express server in server/index.ts exposes endpoints for dates, files, and file downloads.
The browser client in src/services/dataLoader.ts uses DuckDB WASM to open each .nakama-* file and decode the Parquet rows.
Each match is aggregated by match_id and user_id into a structured MatchData object, where every player gets a PlayerJourney with a timestamped path and a list of events.
Visualization layer
The main app in src/App.tsx loads a date, groups matches by map, and picks a match or merged map view.
ControlPanel.tsx lets the designer toggle humans/bots, event types, heatmap mode, and timeline playback.
MapVisualizer.tsx draws the minimap, player trajectories, event markers, and heatmap overlays over a map canvas.
src/config/maps.ts and src/utils/coordinateMapper.ts translate world coordinates into the correct map space for each arena.
Why this matters
This tool gives a level designer a way to answer questions such as:

Where are players spending their time?
Which routes are getting contested?
Where are the best loot loops and dead-end rotations?
How much of the loop is created by bots versus humans?
The result is a practical match-analysis view for balancing flow, loot density, and player pressure across each map.
