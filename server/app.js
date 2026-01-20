const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize SQLite database
const db = new sqlite3.Database('./career.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Set busy timeout to prevent immediate "database is locked" errors
    db.run("PRAGMA busy_timeout = 3000");
    // Enable WAL mode for better concurrency
    db.run("PRAGMA journal_mode = WAL");

    // Create tables if they don't exist
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS saves (
        id TEXT PRIMARY KEY,
        manager TEXT,
        team TEXT,
        region TEXT,
        season INTEGER,
        phase TEXT,
        week INTEGER,
        teamId TEXT,
        budget INTEGER,
        data TEXT
      )`);

      // Add columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE saves ADD COLUMN teamId TEXT`, (err) => { /* ignore if already exists */ });
      db.run(`ALTER TABLE saves ADD COLUMN budget INTEGER`, (err) => { /* ignore if already exists */ });
      db.run(`ALTER TABLE saves ADD COLUMN data TEXT`, (err) => { /* ignore if already exists */ });

      db.run(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        save_id TEXT,
        name TEXT,
        role TEXT,
        team TEXT,
        teamId TEXT,
        ratings TEXT,
        weapon TEXT,
        shield TEXT,
        FOREIGN KEY (save_id) REFERENCES saves(id)
      )`);
      
      // Add missing columns to players table if they don't exist
      db.run(`ALTER TABLE players ADD COLUMN id TEXT`, (err) => {});
      db.run(`ALTER TABLE players ADD COLUMN team TEXT`, (err) => {});
      db.run(`ALTER TABLE players ADD COLUMN teamId TEXT`, (err) => {});
      // ratings, weapon, shield should be TEXT to store JSON
      db.run(`ALTER TABLE players RENAME COLUMN ratings TO ratings_old`, (err) => {
        if (!err) db.run(`ALTER TABLE players ADD COLUMN ratings TEXT`);
      });
      db.run(`CREATE TABLE IF NOT EXISTS inbox_messages (
        save_id TEXT,
        sender TEXT,
        subject TEXT,
        body TEXT,
        FOREIGN KEY (save_id) REFERENCES saves(id)
      )`);
    });
  }
});

// Basic route
app.get('/', (req, res) => {
  res.send('Career Sim Backend is running!');
});

// API to save a career
app.post('/api/saves', (req, res) => {
  const { id, manager, team, region, season, phase, week, players, inbox, teamId, budget } = req.body;
  const fullData = JSON.stringify(req.body);

  // We use a helper to handle the transaction to avoid overlapping issues
  const runTransaction = async () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Use BEGIN IMMEDIATE to lock the database for writing early
        db.run("BEGIN IMMEDIATE TRANSACTION", (err) => {
          if (err) {
            console.error("Failed to begin transaction:", err);
            return reject(err);
          }
        });

        db.run(`INSERT OR REPLACE INTO saves (id, manager, team, region, season, phase, week, teamId, budget, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
          [id, manager, team, region, season, phase, week, teamId, budget, fullData], (err) => {
            if (err) {
              return db.run("ROLLBACK", () => reject(err));
            }

            db.run(`DELETE FROM players WHERE save_id = ?`, [id], (err) => {
              if (err) {
                return db.run("ROLLBACK", () => reject(err));
              }

              db.run(`DELETE FROM inbox_messages WHERE save_id = ?`, [id], (err) => {
                if (err) {
                  return db.run("ROLLBACK", () => reject(err));
                }

                // Insert players
                if (players && players.length > 0) {
                  const playerStmt = db.prepare(`INSERT OR REPLACE INTO players (id, save_id, name, role, team, teamId, ratings, weapon, shield) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                  let playerError = null;
                  players.forEach((player, i) => {
                    if (playerError) return;
                    const ratingsStr = typeof player.ratings === 'object' ? JSON.stringify(player.ratings) : (player.ratings || "{}");
                    const weaponStr = typeof player.weapon === 'object' ? JSON.stringify(player.weapon) : (player.weapon || "{}");
                    const shieldStr = typeof player.shield === 'object' ? JSON.stringify(player.shield) : (player.shield || "{}");
                    const playerId = player.id || `${id}_${player.name.replace(/\s+/g, '_')}_${i}`;
                    playerStmt.run(playerId, id, player.name, player.role, player.team || null, player.teamId || null, ratingsStr, weaponStr, shieldStr, (err) => {
                      if (err) playerError = err;
                    });
                  });
                  playerStmt.finalize();
                  if (playerError) return db.run("ROLLBACK", () => reject(playerError));
                }

                // Insert inbox
                if (inbox && inbox.length > 0) {
                  const inboxStmt = db.prepare(`INSERT INTO inbox_messages (save_id, sender, subject, body) VALUES (?, ?, ?, ?)`);
                  let inboxError = null;
                  inbox.forEach(message => {
                    if (inboxError) return;
                    inboxStmt.run(id, message.sender, message.subject, message.body, (err) => {
                      if (err) inboxError = err;
                    });
                  });
                  inboxStmt.finalize();
                  if (inboxError) return db.run("ROLLBACK", () => reject(inboxError));
                }

                db.run("COMMIT", (err) => {
                  if (err) {
                    // If commit fails, try rollback but catch the error if no transaction is active
                    db.run("ROLLBACK", (rollbackErr) => {
                      reject(err);
                    });
                  } else {
                    resolve();
                  }
                });
              });
            });
          }
        );
      });
    });
  };

  runTransaction()
    .then(() => {
      res.status(200).json({ message: 'Career saved successfully', id: id });
    })
    .catch((err) => {
      console.error("Save transaction failed:", err);
      // Only send error if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
});

// API to get all career saves
app.get('/api/saves', (req, res) => {
  db.all(`SELECT id, manager, team, region, season, phase, week FROM saves`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows);
  });
});

// API to get a single career save by ID
app.get('/api/saves/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM saves WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Save not found' });
    }

    // If we have the full JSON data, use it as the base
    let save;
    if (row.data) {
      try {
        save = JSON.parse(row.data);
      } catch (e) {
        console.error("Error parsing save data JSON:", e);
        save = row;
      }
    } else {
      save = row;
    }

    // Still fetch players and inbox from relational tables for compatibility or if data column is missing
    db.all(`SELECT * FROM players WHERE save_id = ?`, [id], (err, players) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Parse JSON strings back into objects for players
      const parsedPlayers = players.map(p => {
        try {
          return {
            ...p,
            ratings: p.ratings ? JSON.parse(p.ratings) : {},
            weapon: p.weapon ? JSON.parse(p.weapon) : {},
            shield: p.shield ? JSON.parse(p.shield) : {}
          };
        } catch (e) {
          console.error(`Error parsing player data for ${p.name}:`, e);
          return p;
        }
      });

      if (!save.players || save.players.length === 0) {
        save.players = parsedPlayers;
      }

      db.all(`SELECT * FROM inbox_messages WHERE save_id = ?`, [id], (err, inbox) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!save.inbox || save.inbox.length === 0) {
          save.inbox = inbox;
        }
        res.status(200).json(save);
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});