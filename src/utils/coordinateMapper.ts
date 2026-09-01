import { MapConfig } from '../types';

export class CoordinateMapper {
  private mapConfig: MapConfig;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(mapConfig: MapConfig, canvasWidth: number, canvasHeight: number) {
    this.mapConfig = mapConfig;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  worldToCanvas(worldX: number, worldZ: number): { x: number; y: number } {

    const u = (worldX - this.mapConfig.Origin.x) / this.mapConfig.Scale
    const v = (worldZ - this.mapConfig.Origin.z) / this.mapConfig.Scale
    
    const pixel_x = u * this.canvasWidth;
    const pixel_y = (1 - v) * this.canvasHeight;

    return {
      x: pixel_x,
      y: pixel_y
    };
  }

  canvasToWorld(canvasX: number, canvasY: number): { x: number; z: number } {
    return {
      x: (canvasX / this.canvasWidth ) *this.mapConfig.Scale +this.mapConfig.Origin.x,
      z: (canvasY / this.canvasHeight) *this.mapConfig.Scale +this.mapConfig.Origin.z
    };
  }
}