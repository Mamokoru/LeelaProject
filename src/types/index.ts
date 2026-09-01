export interface TelemetryEvent {
  user_id: string;
  match_id: string;
  map_id: string;
  x: number;
  y: number;
  z: number;
  ts: number;
  event: string;
}

export interface PlayerJourney {
  userId: string;
  matchId: string;
  isBot: boolean;
  events: TelemetryEvent[];
  path: { x: number; z: number; ts: number }[];
}

export interface MatchData {
  matchId: string;
  mapId: string;
  players: Map<string, PlayerJourney>;
  startTime: number;
  endTime: number;
}

export interface MapConfig {
  id: string;
  name: string;
  imageUrl: string;
  Scale:number;
  Origin:{
    x: number;
    z:number;
  }
}

export interface FilterState {
  showHumans: boolean;
  showBots: boolean;
  showEventTypes: Record<string, boolean>;
  heatmapType: string;
}

export interface MapVisualizerProps {
  matchData: MatchData;
  selectedMap: string;
  filters: FilterState;
  currentTime: number;
  showHeatmap: boolean;
  heatmapType: 'kills' | 'deaths' | 'traffic';
}

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}
export interface VisualState{
  SelectedDate: string;
  SelectedSecondary:{
    SelectedType: "Map" | "Match";
    SelectedId: string;
  }
}