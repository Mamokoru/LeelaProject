import { MapConfig } from '../types';

export const MAP_CONFIGS: Record<string, MapConfig> = {
  AmbroseValley: {
    id: 'AmbroseValley',
    name: 'Ambrose Valley',
    imageUrl: '/maps/AmbroseValley_Minimap.png',
    Scale: 900,
    Origin:{
      x: -370,
      z: -473 
    }
  },
  GrandRift: {
    id: 'GrandRift',
    name: 'Grand Rift',
    imageUrl: '/maps/GrandRift_Minimap.png',
    Scale: 581,
    Origin:{
      x: -290,
      z: -290 
    }
    
  },
  Lockdown: {
    id: 'Lockdown',
    name: 'Lockdown',
    imageUrl: '/maps/Lockdown_Minimap.jpg',
   
    Scale: 1000,
    Origin:{
      x: -500,
      z: -500 
    }
  }
};