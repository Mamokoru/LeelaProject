// src/components/ControlPanel.tsx
import React, { useCallback } from 'react';

interface FilterState {

  showHumans: boolean;
  showBots: boolean;
  showEventTypes: Record<string, boolean>;
  heatmapType: string;
}

interface ControlPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  maxTime: number;
  minTime:number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  filters,
  setFilters,
  currentTime,
  setCurrentTime,
  maxTime,
  minTime,
  isPlaying,
  setIsPlaying
}) => {
  // Use useCallback to prevent unnecessary re-renders
  // const handleMapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   setFilters(prev => ({ ...prev, mapId: e.target.value }));
  // }, [setFilters]);

  // const handleMatchChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   setFilters(prev => ({ ...prev, matchId: e.target.value }));
  // }, [setFilters]);

  const handleHumanToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setFilters(prev => ({ ...prev, showHumans: e.target.checked }));
  }, [setFilters]);

  const handleBotToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setFilters(prev => ({ ...prev, showBots: e.target.checked }));
  }, [setFilters]);

  const handleEventTypeToggle = useCallback((eventType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setFilters(prev => ({
      ...prev,
      showEventTypes: {
        ...prev.showEventTypes,
        [eventType]: e.target.checked
      }
    }));
  }, [setFilters]);

  const handleHeatmapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFilters(prev => ({ ...prev, heatmapType: e.target.value }));
  }, [setFilters]);

  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setCurrentTime(Number(e.target.value));
  }, [setCurrentTime]);

  const handlePlayPause = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlaying(prev => !prev);
  }, [setIsPlaying]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-xl font-bold text-white mb-4">Controls</h2>
      
      {/* Map Filter */}
      {/* <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Map
        </label>
        <select
          className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer hover:bg-gray-600 transition-colors"
          value={filters.mapId}
          onChange={handleMapChange}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="all">All Maps</option>
          {availableMaps.map(map => (
            <option key={map} value={map}>{map}</option>
          ))}
        </select>
      </div> */}
      
      {/* Match Filter */}
      {/* <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Match
        </label>
        <select
          className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer hover:bg-gray-600 transition-colors"
          value={filters.matchId}
          onChange={handleMatchChange}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="all">All Matches</option>
          {availableMatches.map(match => (
            <option key={match} value={match}>{match}</option>
          ))}
        </select>
      </div> */}
      
      {/* Player Type Filters */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Players
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showHumans}
              onChange={handleHumanToggle}
              onClick={(e) => e.stopPropagation()}
              className="mr-2 cursor-pointer"
            />
            <span className="text-gray-300 select-none">Humans</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showBots}
              onChange={handleBotToggle}
              onClick={(e) => e.stopPropagation()}
              className="mr-2 cursor-pointer"
            />
            <span className="text-gray-300 select-none">Bots</span>
          </label>
        </div>
      </div>
      
      {/* Event Type Filters */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Events
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'].map(eventType => (
            <label key={eventType} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showEventTypes[eventType] ?? true}
                onChange={handleEventTypeToggle(eventType)}
                onClick={(e) => e.stopPropagation()}
                className="mr-2 cursor-pointer"
              />
              <span className="text-gray-300 text-sm select-none">{eventType}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Heatmap Controls */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Heatmap
        </label>
        <select
          className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer hover:bg-gray-600 transition-colors"
          value={filters.heatmapType}
          onChange={handleHeatmapChange}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="none">Off</option>
          <option value="kills">Kill Zones</option>
          <option value="deaths">Death Zones</option>
          <option value="traffic">High Traffic</option>
        </select>
      </div>
      
      {/* Timeline Controls */}
      <div className="pt-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Timeline
        </label>
        <input
          type="range"
          min={minTime || 0}
          max={maxTime || 1}
          value={currentTime}
          onChange={handleTimeChange}
          onClick={(e) => e.stopPropagation()}
          className="w-full cursor-pointer"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-400 text-sm">
            {(  currentTime- minTime) }
          </span>
          <button
            onClick={handlePlayPause}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
            type="button"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function for time formatting
const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};