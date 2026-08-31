// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapVisualizer } from './components/MapVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { DataLoader } from './services/dataLoader';
import { TelemetryEvent, MatchData, PlayerJourney } from './types';

interface FilterState {
  mapId: string;
  matchId: string;
  showHumans: boolean;
  showBots: boolean;
  showEventTypes: Record<string, boolean>;
  heatmapType: string;
}

const App: React.FC = () => {
  const dataLoaderRef = useRef<DataLoader | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allEvents, setAllEvents] = useState<TelemetryEvent[]>([]);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    mapId: 'all',
    matchId: 'all',
    showHumans: true,
    showBots: true,
    showEventTypes: {
      Kill: true,
      Killed: true,
      BotKill: true,
      BotKilled: true,
      KilledByStorm: true,
      Loot: true
    },
    heatmapType: 'none'
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<string[]>([]);
  const [availableMatches, setAvailableMatches] = useState<string[]>([]);

  // Initialize DataLoader only once
  useEffect(() => {
    if (!dataLoaderRef.current) {
      dataLoaderRef.current = new DataLoader();
      dataLoaderRef.current.initialize().then(() => {
        setIsInitialized(true);
      });
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!dataLoaderRef.current || !isInitialized) return;
    
    const events = await dataLoaderRef.current.loadParquetFiles(files);
    setAllEvents(prevEvents => {
      const newEvents = [...prevEvents, ...events];
      
      // Update available maps and matches
      const maps = Array.from(new Set(newEvents.map(e => e.map_id)));
      const matches = Array.from(new Set(newEvents.map(e => e.match_id)));
      console.log(maps , matches)
      setAvailableMaps(maps);
      setAvailableMatches(matches);
      
      return newEvents;
    });
  }, [isInitialized]);

  // Process events when filters change
  useEffect(() => {
    if (allEvents.length === 0) return;
    
    // Filter events based on map and match
    const filteredEvents = allEvents.filter(event => {
      if (filters.mapId !== 'all' && event.map_id !== filters.mapId) return false;
      if (filters.matchId !== 'all' && event.match_id !== filters.matchId) return false;
      return true;
    });
    
    // Group events by match
    const matchesMap = new Map<string, MatchData>();
    
    filteredEvents.forEach(event => {
      if (!matchesMap.has(event.match_id)) {
        matchesMap.set(event.match_id, {
          matchId: event.match_id,
          mapId: event.map_id,
          players: new Map<string, PlayerJourney>(),
          startTime: event.ts,
          endTime: event.ts
        });
      }
      
      const match = matchesMap.get(event.match_id)!;
      match.startTime = Math.min(match.startTime, event.ts);
      match.endTime = Math.max(match.endTime, event.ts);
      
      if (!match.players.has(event.user_id)) {
        const isBot = /^\d+$/.test(event.user_id);
        match.players.set(event.user_id, {
          userId: event.user_id,
          matchId: event.match_id,
          isBot,
          events: [],
          path: []
        });
      }
      
      const journey = match.players.get(event.user_id)!;
      journey.events.push(event);
      
      if (event.event === 'Position' || event.event === 'BotPosition') {
        journey.path.push({
          x: event.x,
          z: event.z,
          ts: event.ts
        });
      }
    });
    
    // Sort events by timestamp
    matchesMap.forEach(match => {
      match.players.forEach(journey => {
        journey.events.sort((a, b) => a.ts - b.ts);
        journey.path.sort((a, b) => a.ts - b.ts);
      });
    });
    
    // Set the first match as selected
    const firstMatch = Array.from(matchesMap.values())[0];
    if (firstMatch) {
      setMatchData(firstMatch);
      setMaxTime(firstMatch.endTime || 0);
      setCurrentTime(prev => Math.min(prev, firstMatch.endTime || 0));
    }
    
  }, [allEvents, filters.mapId, filters.matchId]);

  // Playback effect
  useEffect(() => {
    if (!isPlaying || !matchData) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= matchData.endTime) {
          setIsPlaying(false);
          return matchData.startTime;
        }
        return prev + 1000; // Advance 1 second
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, matchData]);

  // Memoize the map visualizer to prevent unnecessary re-renders
  const memoizedMapVisualizer = useMemo(() => {
    if (!matchData) return null;
    
    return (
      <MapVisualizer
        matchData={matchData}
        selectedMap={matchData.mapId}
        filters={filters}
        currentTime={currentTime}
        showHeatmap={filters.heatmapType !== 'none'}
        heatmapType={filters.heatmapType as 'kills' | 'deaths' | 'traffic'}
      />
    );
  }, [matchData, filters, currentTime]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold">LILA BLACK - Level Designer Tool</h1>
        <p className="text-gray-400">Player Behavior Visualization</p>
      </header>
      
      <div className="container mx-auto p-4">
        {/* File Upload */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <label className="block text-sm font-medium mb-2">
            Upload Telemetry Data (Parquet files)
          </label>
          <input
            type="file"
            multiple
            accept=".nakama-0,.nakama-1,.nakama-2,.parquet"
            onChange={(e) => {
              e.preventDefault();
              const files = Array.from(e.target.files || []);
              
              // Filter for valid files
              const validFiles = files.filter(file => 
                file.name.includes('.nakama-') || file.name.endsWith('.parquet')
              );
              
              if (validFiles.length > 0) {
                handleFileUpload(validFiles);
              }
              
              e.target.value = ''; // Reset input
            }}
            className="block w-full text-sm text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700 cursor-pointer"
          />
          {isInitialized ? (
            <p className="text-green-400 text-sm mt-2">✓ Data processor ready</p>
          ) : (
            <p className="text-yellow-400 text-sm mt-2">⏳ Initializing data processor...</p>
          )}
        </div>
        
        {matchData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              {memoizedMapVisualizer}
            </div>
            
            <div>
              <ControlPanel
                filters={filters}
                setFilters={setFilters}
                availableMaps={availableMaps}
                availableMatches={availableMatches}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                maxTime={maxTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
              />
            </div>
          </div>
        )}
        
        {/* Legend */}
        {matchData && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-bold mb-2">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#4ECDC4] rounded-full mr-2"></div>
                <span>Human Player</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#FF6B6B] rounded-full mr-2"></div>
                <span>Bot</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#FF4136] rounded-full mr-2"></div>
                <span>⚔ Kill Event</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#FFDC00] rounded-full mr-2"></div>
                <span>💰 Loot Event</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#7FDBFF] rounded-full mr-2"></div>
                <span>🌊 Storm Death</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;