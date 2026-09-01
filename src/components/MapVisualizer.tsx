// src/components/MapVisualizer.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CoordinateMapper } from '../utils/coordinateMapper';
import { MAP_CONFIGS } from '../config/maps';
import { ViewportState,  MapVisualizerProps, FilterState,  MatchData } from '../types';

export const MapVisualizer: React.FC<MapVisualizerProps> = ({
  matchData,
  selectedMap,
  filters,
  currentTime,
  showHeatmap,
  heatmapType
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredWorldPos, setHoveredWorldPos] = useState<{ x: number; z: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Zoom limits
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 10;
  const ZOOM_STEP = 1.2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Now this works!
      e.stopPropagation();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setViewport(prev => {
        const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(prev.scale * zoomFactor, MAX_ZOOM));
        
        // Zoom towards mouse position
        const scaleChange = newScale / prev.scale;
        const newOffsetX = mouseX - (mouseX - prev.offsetX) * scaleChange;
        const newOffsetY = mouseY - (mouseY - prev.offsetY) * scaleChange;
        
        return {
          scale: newScale,
          offsetX: newOffsetX,
          offsetY: newOffsetY
        };
      });
    };

    // Attach with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    // Cleanup
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty dependency array - attach once

  // Load map image
  useEffect(() => {
    const img = new Image();
    img.src = MAP_CONFIGS[selectedMap].imageUrl;
    img.onload = () => {
      setMapImage(img);
      // Reset viewport when map changes
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
    };
  }, [selectedMap]);

  // Main render effect
  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const mapConfig = MAP_CONFIGS[selectedMap];
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply viewport transform
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);
    
    // Draw map image
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    
    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }
    
    // Create coordinate mapper for current viewport
    const mapper = new CoordinateMapper(
      mapConfig,
      canvas.width,
      canvas.height
    );
    
    // Draw heatmap if enabled
    if (showHeatmap) {
      drawHeatmap(ctx, matchData, mapper, heatmapType);
    }
    
    // Draw player trajectories
    drawTrajectories(ctx, matchData, mapper, filters, currentTime, selectedPlayer);
    
    // Draw events
    drawEvents(ctx, matchData, mapper, filters, currentTime);
    
    ctx.restore();
    
    // Draw viewport overlay (zoom controls, coordinates, etc.)
    drawViewportOverlay(ctx, canvas.width, canvas.height);
    
  }, [mapImage, matchData, filters, currentTime, showHeatmap, heatmapType, viewport, showGrid, selectedPlayer]);

  // Draw grid lines
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 100; // World units
    const mapConfig = MAP_CONFIGS[selectedMap];
    
    const pixelsPerUnit = width / width;
    
    for (let x = 0; x <= width; x += gridSize) {
      const canvasX = x * pixelsPerUnit;
      ctx.beginPath();
      ctx.moveTo(canvasX, 0);
      ctx.lineTo(canvasX, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      const canvasY = y * pixelsPerUnit;
      ctx.beginPath();
      ctx.moveTo(0, canvasY);
      ctx.lineTo(width, canvasY);
      ctx.stroke();
    }
  };

  // Draw viewport overlay
  const drawViewportOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw zoom level indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 120, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Zoom: ${Math.round(viewport.scale * 100)}%`, 20, 30);
    
    // Draw hovered coordinates
    if (hoveredWorldPos) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, height - 40, 200, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`X: ${hoveredWorldPos.x.toFixed(1)}, Z: ${hoveredWorldPos.z.toFixed(1)}`, 20, height - 20);
    }
  };

  // Draw player trajectories
  const drawTrajectories = (
    ctx: CanvasRenderingContext2D,
    matchData: MatchData,
    mapper: CoordinateMapper,
    filters: FilterState,
    currentTime: number,
    selectedPlayerId: string | null
  ) => {
    matchData.players.forEach((journey) => {
      if (!filters.showHumans && !journey.isBot) return;
      if (!filters.showBots && journey.isBot) return;
      
      // Highlight selected player
      const isSelected = selectedPlayerId === journey.userId;
      const isDimmed = selectedPlayerId && !isSelected;
      
      const color = journey.isBot ? '#FF6B6B' : '#4ECDC4';
      ctx.strokeStyle = isSelected ? '#FFFFFF' : color;
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.globalAlpha = isDimmed ? 0.2 : 0.8;
      
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
      
      // Draw player ID label
      if (journey.path.length > 0) {
        const lastPoint = journey.path[journey.path.length - 1];
        const canvasPos = mapper.worldToCanvas(lastPoint.x, lastPoint.z);
        
        ctx.fillStyle = isSelected ? '#FFFFFF' : color;
        ctx.font = isSelected ? 'bold 12px Arial' : '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          journey.isBot ? `Bot ${journey.userId}` : `Player ${journey.userId.slice(0, 8)}`,
          canvasPos.x,
          canvasPos.y - 10
        );
      }
    });
  };

  // Draw events
  const drawEvents = (
    ctx: CanvasRenderingContext2D,
    matchData: MatchData,
    mapper: CoordinateMapper,
    filters: FilterState,
    currentTime: number
  ) => {
    const eventTypes: Record<string, { color: string; radius: number; icon: string }> = {
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
            // Draw event circle
            ctx.fillStyle = eventConfig.color;
            ctx.beginPath();
            ctx.arc(canvasPos.x, canvasPos.y, eventConfig.radius / viewport.scale, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw event icon (only when zoomed in enough)
            if (viewport.scale > 1) {
              ctx.fillStyle = '#FFFFFF';
              ctx.font = `${10 / viewport.scale}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(eventConfig.icon, canvasPos.x, canvasPos.y);
            }
          }
        });
    });
  };

  // Draw heatmap
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
      
      // Color gradient from blue to red
      const hue = 240 - (intensity * 240); // 240 (blue) to 0 (red)
      ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${intensity * 0.7})`;
      ctx.fillRect(
        gridX * gridSize,
        gridY * gridSize,
        gridSize,
        gridSize
      );
    });
  };

  // Zoom functions
  const zoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.min(prev.scale * ZOOM_STEP, MAX_ZOOM)
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      scale: Math.max(prev.scale / ZOOM_STEP, MIN_ZOOM)
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    
    // e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setViewport(prev => {
      const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newScale = Math.max(MIN_ZOOM, Math.min(prev.scale * zoomFactor, MAX_ZOOM));
      
      // Zoom towards mouse position
      const scaleChange = newScale / prev.scale;
      const newOffsetX = mouseX - (mouseX - prev.offsetX) * scaleChange;
      const newOffsetY = mouseY - (mouseY - prev.offsetY) * scaleChange;
      
      return {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY
      };
    });
  }, []);

  // Pan functions
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewport.offsetX, y: e.clientY - viewport.offsetY });
    }
  }, [viewport.offsetX, viewport.offsetY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        offsetX: e.clientX - dragStart.x,
        offsetY: e.clientY - dragStart.y
      }));
    }
    
    // Update hovered world coordinates
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - viewport.offsetX) / viewport.scale;
      const canvasY = (e.clientY - rect.top - viewport.offsetY) / viewport.scale;
      
      const mapConfig = MAP_CONFIGS[selectedMap];
      const worldX = + (canvasX / canvas.width) ;
      const worldZ = + (canvasY / canvas.height);
      
      setHoveredWorldPos({ x: worldX, z: worldZ });
    }
  }, [isDragging, dragStart, viewport.offsetX, viewport.offsetY, viewport.scale, selectedMap]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredWorldPos(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        className={`w-full h-full border border-gray-700 rounded-lg cursor-crosshair ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* Zoom Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold shadow-lg transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold shadow-lg transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={resetZoom}
          className="w-10 h-10 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center text-sm shadow-lg transition-colors"
          title="Reset Zoom"
        >
          ⟲
        </button>
      </div>
      
      {/* Grid Toggle */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => setShowGrid(prev => !prev)}
          className={`px-3 py-1 rounded-lg text-sm font-medium shadow-lg transition-colors ${
            showGrid ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
          title="Toggle Grid"
        >
          Grid
        </button>
      </div>
      
      {/* Mini-map Overview */}
      <div className="absolute bottom-4 right-4 w-32 h-32 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
        <div className="w-full h-full relative">
          {mapImage && (
            <img
              src={mapImage.src}
              className="w-full h-full object-cover opacity-50"
              alt="Mini-map"
            />
          )}
          {/* Viewport indicator */}
          <div
            className="absolute border-2 border-yellow-400 bg-yellow-400/20"
            style={{
              left: `${(-viewport.offsetX / viewport.scale / 800) * 100}%`,
              top: `${(-viewport.offsetY / viewport.scale / 800) * 100}%`,
              width: `${(100 / viewport.scale)}%`,
              height: `${(100 / viewport.scale)}%`
            }}
          />
        </div>
      </div>
      
      {/* Help Text */}
      <div className="absolute bottom-4 left-4 bg-gray-800/80 text-gray-300 text-xs px-3 py-2 rounded-lg">
        <p>🖱 Scroll to zoom • Drag to pan</p>
        <p>Click player path to select</p>
      </div>
    </div>
  );
};