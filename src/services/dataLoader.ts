// src/services/dataLoader.ts
import * as duckdb from '@duckdb/duckdb-wasm';

export interface FileMetadata {
  userId: string;
  matchId: string;
  isBot: boolean;
  fileName: string;
}

export interface MatchInfo {
  matchId: string;
  fileCount: number;
  files: string[];
  playerCount: number;
  botCount: number;
}

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

export class DataLoader {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  async initialize() {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    
    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.conn = await this.db.connect();
    
    URL.revokeObjectURL(worker_url);
  }

  /**
   * Get available dates from server
   */
  async getAvailableDates(): Promise<string[]> {
    const response = await fetch(`${this.serverUrl}/api/dates`);
    const data = await response.json();
    return data.dates;
  }

  /**
   * Get matches for a specific date
   */
  async getMatchesForDate(date: string): Promise<MatchInfo[]> {
    const response = await fetch(`${this.serverUrl}/api/files/${date}`);
    const data = await response.json();
    return data.matches;
  }

  /**
   * Load all files for a specific date
   */
  async loadDateData(date: string): Promise<TelemetryEvent[]> {
    const matches = await this.getMatchesForDate(date);
    const allEvents: TelemetryEvent[] = [];
    
    for (const match of matches) {
      for (const file of match.files) {
        const events = await this.loadFile(date, file.fileName);
        allEvents.push(...events);
      }
    }
    
    return allEvents;
  }

  /**
   * Load a specific match
   */
  async loadMatchData(date: string, matchId: string): Promise<TelemetryEvent[]> {
    const response = await fetch(`${this.serverUrl}/api/match/${date}/${matchId}`);
    const matchData = await response.json();
    
    const allEvents: TelemetryEvent[] = [];
    
    for (const fileName of matchData.files) {
      const events = await this.loadFile(date, fileName);
      allEvents.push(...events);
    }
    
    return allEvents;
  }

  /**
   * Load and parse a single parquet file from server
   */
  async loadFile(date: string, fileName: string): Promise<TelemetryEvent[]> {
    if (!this.conn || !this.db) {
      throw new Error('DuckDB not initialized');
    }
    
    try {
      // Fetch file from server
      const response = await fetch(`${this.serverUrl}/api/file/${date}/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Register file with DuckDB
      await this.db.registerFileBuffer(fileName, uint8Array);
      
      // Query the parquet file
      const result = await this.conn.query(`
        SELECT 
          user_id,
          match_id,
          map_id,
          x,
          y,
          z,
          ts,
          CAST(event AS VARCHAR) as event
        FROM read_parquet('${fileName}')
      `);
      
      const rows = result.toArray();
      
      return rows.map(row => ({
        user_id: String(row.user_id),
        match_id: String(row.match_id),
        map_id: String(row.map_id),
        x: Number(row.x),
        y: Number(row.y),
        z: Number(row.z),
        ts: Number(row.ts),
        event: String(row.event)
      }));
      
    } catch (error) {
      console.error(`Error loading file ${fileName}:`, error);
      return [];
    }
  }

  /**
   * Load multiple files in parallel with concurrency limit
   */
  async loadFilesParallel(
    date: string, 
    files: string[], 
    maxConcurrent: number = 4
  ): Promise<TelemetryEvent[]> {
    const allEvents: TelemetryEvent[] = [];
    
    // Process files in chunks
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const chunk = files.slice(i, i + maxConcurrent);
      const chunkPromises = chunk.map(fileName => this.loadFile(date, fileName));
      const chunkResults = await Promise.all(chunkPromises);
      
      chunkResults.forEach(events => {
        allEvents.push(...events);
      });
      
      // Update progress
      const progress = Math.min(((i + chunk.length) / files.length) * 100, 100);
      // console.log(`Loading progress: ${progress.toFixed(1)}%`);
    }
    
    return allEvents;
  }

  /**
   * Parse filename to extract metadata
   */
  parseFilename(fileName: string): FileMetadata {
    const baseName = fileName.replace(/\.nakama-\d+$/, '');
    const parts = baseName.split('_');
    
    const userId = parts[0];
    const matchId = parts.slice(1).join('_');
    const isBot = /^\d+$/.test(userId);
    
    return { userId, matchId, isBot, fileName };
  }

  async cleanup() {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
  }
}