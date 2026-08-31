export interface TelemetryEvent {
  user_id: string;
  match_id: string;
  map_id: 'AmbroseValley' | 'GrandRift' | 'Lockdown';
  x: number;
  y: number;
  z: number;
  ts: number;
  event: 'Position' | 'BotPosition' | 'Kill' | 'Killed' | 'BotKill' | 'BotKilled' | 'KilledByStorm' | 'Loot';
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
  scale:number;
  Origin:{
    x: number;
    z:number;
  }
}