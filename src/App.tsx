// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapVisualizer } from './components/MapVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { DataLoader, TelemetryEvent, MatchInfo } from './services/dataLoader';
import { MatchData, PlayerJourney } from './types';

interface FilterState {
  showHumans: boolean;
  showBots: boolean;
  showEventTypes: Record<string, boolean>;
  heatmapType: string;
}

interface VisualState{
  SelectedDate: string;
  SelectedSecondary:{
    SelectedType: "Map" | "Match";
    SelectedId: string;
  }
}

const App: React.FC = () => {
  const [dataLoader] = useState(() => new DataLoader('http://localhost:3001'));
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<VisualState>();
  const [maps,SetMaps] =  useState<string[]>([]);
  const [matchOnMap, SetMatchOnMap] =  useState<Map<string,string[]>>(new Map());
  const [matches, SetMatches] = useState<Map<string,MatchData>>(new Map());
  const [selectedMap, setSelectedMap] = useState<string>('all');
  const [filteredMatches, setFilteredMatches] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  

  const [allEvents, setAllEvents] = useState<TelemetryEvent[]>([]);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
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
  const [minTime, setMinTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const init = async () => {

      if(isInitialized) return;

      await dataLoader.initialize();
      setIsInitialized(true);
      
      const dates = await dataLoader.getAvailableDates();
      setAvailableDates(dates);
      
      if (dates.length > 0) {
        setSelectedDate(dates[0]); // Select most recent date by default
      }
      
      handleDateChange(dates[0]);
    };
    init();
  },[isInitialized]);

  const handleDateChange = useCallback( async (date: string) => {

    const AllDayEvents = await dataLoader.loadDateData(date);
      console.log("Matches for date:", AllDayEvents);

      let uniqueMaps = new Set<string>();
      let MatchesOnMap = new Map<string, string[]>();
      let Matches = new Map<string, TelemetryEvent[]>();
      let MatchesToMatchData = new Map<string, MatchData>();

      AllDayEvents.forEach(event => {
        // Collect unique map IDs
        if (!uniqueMaps.has(event.map_id)) {
          uniqueMaps.add(event.map_id);
        }

        // Group matches by map
        if (MatchesOnMap.has(event.map_id)) {
          if (!MatchesOnMap.get(event.map_id)!.includes(event.match_id.split('.')[0])) {
            MatchesOnMap.set(event.map_id, [...MatchesOnMap.get(event.map_id)!, event.match_id.split('.')[0]]);
          }
        }
        else {
          MatchesOnMap.set(event.map_id, [event.match_id.split('.')[0]]);
        }
        // Group Events by match
        Matches.set(event.match_id.split('.')[0], [...(Matches.get(event.match_id.split('.')[0]) || []), event]);
      });
      Matches.forEach((events, matchId) => {
        events = events.sort((a, b) => a.ts - b.ts);
        
        MatchesToMatchData.set(matchId, {
          matchId: matchId,
          mapId: events[0].map_id,
          players: new Map<string, PlayerJourney>(),
          startTime: events[0].ts,
          endTime: events[events.length - 1].ts
        });
        
        events.forEach(event => {
          if (!(MatchesToMatchData.get(matchId)!.players.has(event.user_id))) {
            MatchesToMatchData.get(matchId)!.players.set(event.user_id, {
              userId : event.user_id,
              matchId : matchId,
              isBot : /^\d+$/.test(event.user_id),
              events : [event],
              path : [{ x: event.x, z: event.z, ts: event.ts }]
            });
          }
          else{
            MatchesToMatchData.get(matchId)!.players.get(event.user_id )?.events.push(event);
            MatchesToMatchData.get(matchId)!.players.get(event.user_id )?.path.push({ x: event.x, z: event.z, ts: event.ts });
          }
        })
      });
      
      // console.log("Unique Maps:", Array.from(uniqueMaps));
      // console.log("Matches on Map:", MatchesOnMap);
      console.log("Matches to MatchData:", MatchesToMatchData);

      SetMaps(Array.from(uniqueMaps));
      SetMatchOnMap(MatchesOnMap);
      SetMatches(MatchesToMatchData);
      setFilteredMatches(Array.from(MatchesToMatchData.keys()));
      
      let initialSelectedState: VisualState = {
        SelectedDate: date,
        SelectedSecondary:{
          SelectedType: "Match",
          SelectedId: uniqueMaps.size > 0 ? Array.from(MatchesToMatchData.keys())[0] : 'none'
        }};
        console.log("Initial selected state:", initialSelectedState);

      // setSelectedMatch(uniqueMaps.size > 0 ? Array.from(MatchesToMatchData.keys())[0] : 'none');  
      setSelectedState(initialSelectedState);
  }, []);

  // Load data Map changes
  useEffect(() => {
    if(!matchOnMap || !matches) return;
    if(selectedMap == 'all'){
      // console.log("Selected map is 'all', showing all matches." , Array.from(matches.keys()));
      setFilteredMatches(matches ? Array.from(matches.keys()) : []);
      if(selectedState && selectedState.SelectedSecondary.SelectedType == "Map" ){
        setSelectedState({
          ...selectedState,
          SelectedSecondary:{
            SelectedType: "Match",
            SelectedId: matches ? Array.from(matches.keys())[0] : 'none'
          }
        });
      }
    }
    else{
      // console.log("Selected map is not 'all', showing matches for this map." , matchOnMap.get(selectedMap) || []);
      setFilteredMatches(matchOnMap.get(selectedMap) || []);
    }
  },[selectedMap])

  useEffect(() => {
    if(!selectedState || !matches) return;

    if(selectedState.SelectedSecondary.SelectedType == "Map"){
      var MergedMatchesData: MatchData ={
        mapId: selectedState.SelectedSecondary.SelectedId,
        matchId: "merged",
        players: new Map<string, PlayerJourney>(),
        startTime: Infinity,
        endTime: -Infinity
      }
      matchOnMap.get(selectedState.SelectedSecondary.SelectedId)?.forEach(matchId => {
        var matchData = matches.get(matchId);
        MergedMatchesData.startTime = Math.min(MergedMatchesData.startTime, matchData?.startTime || Infinity);
        MergedMatchesData.endTime = Math.max(MergedMatchesData.endTime, matchData?.endTime || -Infinity);
        matchData?.players.forEach((playerJourney, userId) => {
          if(!MergedMatchesData.players.has(userId+matchId)){
            MergedMatchesData.players.set(userId+matchId, {
              userId: userId + matchId,
              matchId: "merged",
              isBot: playerJourney.isBot,
              events: playerJourney.events,
              path: playerJourney.path
            });
        }}); 
      });
      console.log("Merged Matches Data for map:", selectedState.SelectedSecondary.SelectedId, MergedMatchesData);
      if(MergedMatchesData){
        setMaxTime(MergedMatchesData.endTime);
        setMinTime(MergedMatchesData.startTime)
        setCurrentTime(MergedMatchesData.startTime);
        setMatchData(MergedMatchesData);
      }
    }
    else if(selectedState.SelectedSecondary.SelectedType == "Match"){
      var matchData = matches.get(selectedState.SelectedSecondary.SelectedId);
      if(matchData){
        setMaxTime(matchData.endTime);
        setMinTime(matchData.startTime)
        setCurrentTime(matchData.startTime);
        setMatchData(matchData);
      }
    }
  },
  [selectedState]);

  useEffect(() => {
    handleDateChange(selectedDate);
  }, [selectedDate]);

  const HandleMatchChange = (matchId: string) => {
     if(!selectedState || !matches) return;
      if(matchId == 'all'){
        if(selectedMap != 'all'){
          setSelectedState({
          ...selectedState,
          SelectedSecondary:{
            SelectedType: "Map",
            SelectedId: selectedMap
          }
        });
        }
      }
      else{
        setSelectedState({
          ...selectedState,
          SelectedSecondary:{
            SelectedType: "Match",
            SelectedId: matchId
          }
        });
      }
  }

  // Playback effect
  useEffect(() => {
    if (!isPlaying || !matchData) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= matchData.endTime) {
          setIsPlaying(false);
          return matchData.startTime;
        }
        return prev + 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying, matchData]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold">LILA BLACK - Level Designer Tool</h1>
        <p className="text-gray-400">Player Behavior Visualization</p>
      </header>
      
      <div className="container mx-auto p-4">
        {/* Date and Match Selection */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Date
              </label>
              <select
                className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="">Select a date...</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Map
              </label>
              <select
                className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer"
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                disabled={!selectedDate}
              >
                <option value="all">All Maps ({maps.length})</option>
                {maps.map(match => (
                  <option key={match} value={match}>
                    {match}
                  </option>
                ))}
              </select>
            </div>

            {/* Match Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Match
              </label>
              <select
                className="w-full bg-gray-700 text-white rounded p-2 cursor-pointer"
                value={selectedState?.SelectedSecondary.SelectedId || 'all'}
                onChange={(e) => HandleMatchChange(e.target.value)}
                disabled={!selectedDate}
              >
                {selectedMap != 'all' && <option value="all">All Matches ({filteredMatches.length})</option>}
                {filteredMatches.map(match => (
                  <option key={match} value={match}>
                    {match}
                    {/* ({match.playerCount} players, {match.botCount} bots) */}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Load Button */}
            {/* <div className="flex items-end">
              <button
                // onClick={handleLoadData}
                disabled={!selectedDate || isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Loading...' : 'Load Data'}
              </button>
            </div> */}
          </div>
          
          {/* Loading Progress */}
          {isLoading && (
            <div className="mt-4">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Loading telemetry data... {loadingProgress}%
              </p>
            </div>
          )}
        </div>
        
        {/* Data Summary */}
        {allEvents.length > 0 && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Total Events</p>
                <p className="text-xl font-bold">{allEvents.length.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Players</p>
                <p className="text-xl font-bold">
                  {matchData?.players.size || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Match Duration</p>
                <p className="text-xl font-bold">
                  {matchData ? Math.round((matchData.endTime - matchData.startTime) ) : 0}s
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Map</p>
                <p className="text-xl font-bold">{matchData?.mapId || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Visualization */}
        {matchData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <MapVisualizer
                matchData={matchData}
                selectedMap={matchData.mapId}
                filters={filters}
                currentTime={currentTime}
                showHeatmap={filters.heatmapType !== 'none'}
                heatmapType={filters.heatmapType as 'kills' | 'deaths' | 'traffic'}
              />
            </div>
            
            <div>
              <ControlPanel
                filters={filters}
                setFilters={setFilters}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                maxTime={maxTime}
                minTime={minTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;