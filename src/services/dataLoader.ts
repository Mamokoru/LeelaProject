// src/services/dataLoader.ts
import * as duckdb from '@duckdb/duckdb-wasm';

export interface FileMetadata {
  userId: string;
  matchId: string;
  isBot: boolean;
  fileName: string;
}

export class DataLoader {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;

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
   * Parse filename to extract user_id and match_id
   * Format: {user_id}_{match_id}.nakama-0
   * Example: f4e072fa-b7af-4761-b567-1d95b7ad0108_b71aaad8-aa62-4b3a-8534-927d4de18f22.nakama-0
   */
  parseFilename(fileName: string): FileMetadata {
    // Remove the .nakama-0 extension
    const baseName = fileName.replace(/\.nakama-\d+$/, '');
    
    // Split by underscore - but UUIDs contain hyphens, not underscores
    // So we can safely split on the first underscore
    const parts = baseName.split('_');
    
    if (parts.length < 2) {
      throw new Error(`Invalid filename format: ${fileName}`);
    }
    
    const userId = parts[0];
    const matchId = parts.slice(1).join('_'); // In case match_id contains underscores
    
    // Determine if bot based on user_id pattern
    // Bots have short numeric IDs, humans have UUIDs
    const isBot = /^\d+$/.test(userId);
    
    return {
      userId,
      matchId,
      isBot,
      fileName
    };
  }

  /**
   * Load and parse Parquet files with .nakama-0 extension
   */
  async loadParquetFiles(files: File[]): Promise<TelemetryEvent[]> {
    if (!this.conn || !this.db) {
      throw new Error('DuckDB not initialized. Call initialize() first.');
    }
    
    const allEvents: TelemetryEvent[] = [];
    
    for (const file of files) {
      try {
        // Parse filename metadata
        const metadata = this.parseFilename(file.name);
        
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Register file with DuckDB using original name
        // DuckDB will detect Parquet format regardless of extension
        await this.db.registerFileBuffer(file.name, uint8Array);
        
        // Query the Parquet file
        // Use read_parquet explicitly to force Parquet parsing
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
          FROM read_parquet('${file.name}')
        `);
        
        // Convert to array of events
        const rows = result.toArray();
        
        for (const row of rows) {
          allEvents.push({
            user_id: row.user_id as string,
            match_id: row.match_id as string,
            map_id: row.map_id as string,
            x: row.x as number,
            y: row.y as number,
            z: row.z as number,
            ts: row.ts as number,
            event: this.decodeEvent(row.event)
          });
        }
        
        console.log(`Loaded ${rows.length} events from ${file.name}`);
        
      } catch (error) {
        console.error(`Error loading file ${file.name}:`, error);
        // Continue with other files even if one fails
      }
    }
    
    return allEvents;
  }

  /**
   * Decode event from bytes to string if needed
   */
  private decodeEvent(event: any): string {
    if (typeof event === 'string') {
      return event;
    }
    
    if (event instanceof Uint8Array || event instanceof ArrayBuffer) {
      try {
        return new TextDecoder().decode(event);
      } catch {
        // Fallback to string conversion
        return String(event);
      }
    }
    
    // Handle DuckDB's binary type
    if (event && typeof event === 'object' && 'buffer' in event) {
      try {
        return new TextDecoder().decode(event.buffer);
      } catch {
        return String(event);
      }
    }
    
    return String(event);
  }

  /**
   * Alternative method: Load files using DuckDB's native file handling
   */
  async loadParquetFilesAlternative(files: File[]): Promise<TelemetryEvent[]> {
    if (!this.conn || !this.db) {
      throw new Error('DuckDB not initialized');
    }
    
    const allEvents: TelemetryEvent[] = [];
    
    for (const file of files) {
      const metadata = this.parseFilename(file.name);
      
      // Read as ArrayBuffer and register
      const arrayBuffer = await file.arrayBuffer();
      await this.db.registerFileBuffer(file.name, new Uint8Array(arrayBuffer));
      
      // Use DuckDB's auto-detection with explicit format
      const result = await this.conn.query(`
        SELECT 
          user_id,
          match_id,
          map_id,
          x,
          y,
          z,
          ts,
          event
        FROM '${file.name}'
        (FORMAT PARQUET)
      `);
      
      const rows = result.toArray();
      
      for (const row of rows) {
        let eventStr = '';
        
        // Handle different event formats
        if (row.event instanceof Uint8Array) {
          eventStr = new TextDecoder().decode(row.event);
        } else if (row.event && typeof row.event === 'object' && row.event.buffer) {
          eventStr = new TextDecoder().decode(row.event.buffer);
        } else if (typeof row.event === 'string') {
          eventStr = row.event;
        } else {
          eventStr = String(row.event);
        }
        
        allEvents.push({
          user_id: String(row.user_id),
          match_id: String(row.match_id),
          map_id: String(row.map_id),
          x: Number(row.x),
          y: Number(row.y),
          z: Number(row.z),
          ts: Number(row.ts),
          event: eventStr
        });
      }
    }
    
    return allEvents;
  }

  /**
   * Clean up resources
   */
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

// Add type for TelemetryEvent if not imported
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