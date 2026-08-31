// src/utils/coordinateMapper.ts
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
    const { minX, maxX, minZ, maxZ } = this.mapConfig.worldBounds;
    
    const normalizedX = (worldX - minX) / (maxX - minX);
    const normalizedZ = (worldZ - minZ) / (maxZ - minZ);
    
    return {
      x: normalizedX * this.canvasWidth,
      y: normalizedZ * this.canvasHeight
    };
  }

  canvasToWorld(canvasX: number, canvasY: number): { x: number; z: number } {
    const { minX, maxX, minZ, maxZ } = this.mapConfig.worldBounds;
    
    const normalizedX = canvasX / this.canvasWidth;
    const normalizedZ = canvasY / this.canvasHeight;
    
    return {
      x: minX + normalizedX * (maxX - minX),
      z: minZ + normalizedZ * (maxZ - minZ)
    };
  }
}