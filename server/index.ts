// server/index.ts
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Configure your data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// API endpoint to list available dates
app.get('/api/dates', (req, res) => {
  try {
    console.log(`Reading data directory: ${DATA_DIR}`);
    const dates = fs.readdirSync(DATA_DIR)
      .filter(item => {
        const fullPath = path.join(DATA_DIR, item);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort();
    
    res.json({ dates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read data directory' });
  }
});

// API endpoint to list files for a specific date
app.get('/api/files/:date', (req, res) => {
  const { date } = req.params;
  const dateDir = path.join(DATA_DIR, date);
  
  try {
    if (!fs.existsSync(dateDir)) {
      return res.status(404).json({ error: 'Date folder not found' });
    }
    
    const files = fs.readdirSync(dateDir)
      .filter(file => file.includes('.nakama-'))
      .map(file => {
        // Parse filename to extract metadata
        const baseName = file.replace(/\.nakama-\d+$/, '');
        const [userId, ...matchParts] = baseName.split('_');
        const matchId = matchParts.join('_');
        
        return {
          fileName: file,
          userId,
          matchId,
          isBot: /^\d+$/.test(userId),
          size: fs.statSync(path.join(dateDir, file)).size
        };
      });
    
    // Group by match
    const matches = new Map();
    files.forEach(file => {
      if (!matches.has(file.matchId)) {
        matches.set(file.matchId, {
          matchId: file.matchId,
          files: [],
          playerCount: 0,
          botCount: 0
        });
      }
      
      const match = matches.get(file.matchId);
      match.files.push(file);
      if (file.isBot) {
        match.botCount++;
      } else {
        match.playerCount++;
      }
    });
    
    res.json({
      date,
      totalFiles: files.length,
      matches: Array.from(matches.values())
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// API endpoint to get a specific file's data
app.get('/api/file/:date/:fileName', async (req, res) => {
  const { date, fileName } = req.params;
  const filePath = path.join(DATA_DIR, date, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Validate the filename to prevent directory traversal
    if (!fileName.includes('.nakama-')) {
      return res.status(400).json({ error: 'Invalid file' });
    }
    
    // Read and send the parquet file
    const fileBuffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// API endpoint to get match data (all files for a match)
app.get('/api/match/:date/:matchId', async (req, res) => {
  const { date, matchId } = req.params;
  const dateDir = path.join(DATA_DIR, date);
  
  try {
    if (!fs.existsSync(dateDir)) {
      return res.status(404).json({ error: 'Date folder not found' });
    }
    
    const files = fs.readdirSync(dateDir)
      .filter(file => {
        const baseName = file.replace(/\.nakama-\d+$/, '');
        const [, ...matchParts] = baseName.split('_');
        return matchParts.join('_') === matchId;
      });
    
    res.json({ matchId, fileCount: files.length, files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read match data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});