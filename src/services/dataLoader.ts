// src/services/dataLoader.ts
import * as duckdb from '@duckdb/duckdb-wasm';

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

  async loadParquetFiles(files: File[]): Promise<TelemetryEvent[]> {
    if (!this.conn) throw new Error('DuckDB not initialized');
    
    const allEvents: TelemetryEvent[] = [];
    
    for (const file of files) {
      // Extract metadata from filename
      const fileName = file.name.replace('.parquet', '');
      const [userId, matchIdWithExt] = fileName.split('_');
      const matchId = matchIdWithExt.replace('.nakama-0', '');
      const isBot = /^\d+$/.test(userId);
      
      // Register the file
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await this.db!.registerFileBuffer(file.name, uint8Array);
      
      // Query the parquet file
      const result = await this.conn!.query(`
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
      
      const events = result.toArray().map((row: any) => ({
        user_id: row.user_id,
        match_id: row.match_id,
        map_id: row.map_id,
        x: row.x,
        y: row.y,
        z: row.z,
        ts: row.ts,
        event: row.event
      }));
      
      allEvents.push(...events);
    }
    
    return allEvents;
  }
}