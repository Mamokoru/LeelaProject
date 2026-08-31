import React, { useEffect, useRef, useState } from 'react';
import { CoordinateMapper } from '../utils/coordinateMapper';
import { MAP_CONFIGS } from '../config/maps';
import { TelemetryEvent, PlayerJourney, MatchData } from '../types';

interface MapVisualizerProps {
  matchData: MatchData;
  selectedMap: string;
  filters: FilterState;
  currentTime: number;
  showHeatmap: boolean;
  heatmapType: 'kills' | 'deaths' | 'traffic';
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({
  matchData,
  selectedMap,
  filters,
  currentTime,
  showHeatmap,
  heatmapType
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  
  useEffect(() => {
    const img = new Image();
    img.src = MAP_CONFIGS[selectedMap].imageUrl;
    img.onload = () => setMapImage(img);
  }, [selectedMap]);

  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const mapper = new CoordinateMapper(
      MAP_CONFIGS[selectedMap],
      canvas.width,
      canvas.height
    );
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw map image
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    
    // Draw heatmap if enabled
    if (showHeatmap) {
      drawHeatmap(ctx, matchData, mapper, heatmapType);
    }
    
    // Draw player trajectories
    drawTrajectories(ctx, matchData, mapper, filters, currentTime);
    
    // Draw events
    drawEvents(ctx, matchData, mapper, filters, currentTime);
    
  }, [mapImage, matchData, filters, currentTime, showHeatmap, heatmapType]);

  const drawTrajectories = (
    ctx: CanvasRenderingContext2D,
    matchData: MatchData,
    mapper: CoordinateMapper,
    filters: FilterState,
    currentTime: number
  ) => {
    matchData.players.forEach((journey) => {
      if (!filters.showHumans && !journey.isBot) return;
      if (!filters.showBots && journey.isBot) return;
      
      const color = journey.isBot ? '#FF6B6B' : '#4ECDC4';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      
      ctx.beginPath();
      let pathStarted = false;
      
      journey.path
        .filter(point => point.ts <= currentTime)
        .forEach(point => {
          const canvasPos = mapper.worldToCanvas(point.x, point.z);
          if (!pathStarted) {
            ctx.moveTo(canvasPos.x, canvasPos.y);
            pathStarted = true;
          } else {
            ctx.lineTo(canvasPos.x, canvasPos.y);
          }
        });
      
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  };

  const drawEvents = (
    ctx: CanvasRenderingContext2D,
    matchData: MatchData,
    mapper: CoordinateMapper,
    filters: FilterState,
    currentTime: number
  ) => {
    const eventTypes = {
      Kill: { color: '#FF4136', radius: 6, icon: '⚔' },
      Killed: { color: '#FF4136', radius: 6, icon: '💀' },
      BotKill: { color: '#FF851B', radius: 5, icon: '🤖' },
      BotKilled: { color: '#FF851B', radius: 5, icon: '⚠' },
      KilledByStorm: { color: '#7FDBFF', radius: 6, icon: '🌊' },
      Loot: { color: '#FFDC00', radius: 4, icon: '💰' }
    };
    
    matchData.players.forEach((journey) => {
      if (!filters.showHumans && !journey.isBot) return;
      if (!filters.showBots && journey.isBot) return;
      
      journey.events
        .filter(event => event.ts <= currentTime)
        .filter(event => event.event !== 'Position' && event.event !== 'BotPosition')
        .filter(event => filters.showEventTypes[event.event])
        .forEach(event => {
          const canvasPos = mapper.worldToCanvas(event.x, event.z);
          const eventConfig = eventTypes[event.event];
          
          if (eventConfig) {
            ctx.fillStyle = eventConfig.color;
            ctx.beginPath();
            ctx.arc(canvasPos.x, canvasPos.y, eventConfig.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw event icon
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(eventConfig.icon, canvasPos.x, canvasPos.y);
          }
        });
    });
  };

  const drawHeatmap = (
    ctx: CanvasRenderingContext2D,
    matchData: MatchData,
    mapper: CoordinateMapper,
    type: 'kills' | 'deaths' | 'traffic'
  ) => {
    const heatmapData = new Map<string, number>();
    const gridSize = 20;
    
    matchData.players.forEach((journey) => {
      if (type === 'traffic') {
        journey.path.forEach(point => {
          const canvasPos = mapper.worldToCanvas(point.x, point.z);
          const gridKey = `${Math.floor(canvasPos.x / gridSize)},${Math.floor(canvasPos.y / gridSize)}`;
          heatmapData.set(gridKey, (heatmapData.get(gridKey) || 0) + 1);
        });
      } else {
        journey.events
          .filter(event => {
            if (type === 'kills') {
              return event.event === 'Kill' || event.event === 'BotKill';
            } else {
              return event.event === 'Killed' || event.event === 'BotKilled' || event.event === 'KilledByStorm';
            }
          })
          .forEach(event => {
            const canvasPos = mapper.worldToCanvas(event.x, event.z);
            const gridKey = `${Math.floor(canvasPos.x / gridSize)},${Math.floor(canvasPos.y / gridSize)}`;
            heatmapData.set(gridKey, (heatmapData.get(gridKey) || 0) + 1);
          });
      }
    });
    
    // Find max value for normalization
    const maxValue = Math.max(...Array.from(heatmapData.values()), 1);
    
    heatmapData.forEach((value, key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const intensity = value / maxValue;
      
      ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.7})`;
      ctx.fillRect(
        gridX * gridSize,
        gridY * gridSize,
        gridSize,
        gridSize
      );
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      className="w-full h-full border border-gray-700 rounded-lg"
    />
  );
};