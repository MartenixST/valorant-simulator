const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./career.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      manager TEXT,
      team TEXT,
      region TEXT,
      season INTEGER,
      phase TEXT,
      week INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS players (
      save_id TEXT,
      name TEXT,
      role TEXT,
      ratings INTEGER,
      weapon TEXT,
      shield TEXT,
      FOREIGN KEY (save_id) REFERENCES saves(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS inbox_messages (
      save_id TEXT,
      sender TEXT,
      subject TEXT,
      body TEXT,
      FOREIGN KEY (save_id) REFERENCES saves(id)
    )`);
  }
});

// Basic route
app.get('/', (req, res) => {
  res.send('Career Sim Backend is running!');
});

// API to save a career
app.post('/api/saves', (req, res) => {
  const { id, manager, team, region, season, phase, week, players, inbox } = req.body;

  db.run(`INSERT OR REPLACE INTO saves (id, manager, team, region, season, phase, week) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [id, manager, team, region, season, phase, week], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Clear existing players and inbox messages for this save_id
    db.run(`DELETE FROM players WHERE save_id = ?`, id, (err) => {
      if (err) return res.status(500).json({ error: err.message });
    });
    db.run(`DELETE FROM inbox_messages WHERE save_id = ?`, id, (err) => {
      if (err) return res.status(500).json({ error: err.message });
    });

    // Insert players
    const playerStmt = db.prepare(`INSERT INTO players (save_id, name, role, ratings, weapon, shield) VALUES (?, ?, ?, ?, ?, ?)`);
    players.forEach(player => {
      playerStmt.run(id, player.name, player.role, player.ratings, player.weapon, player.shield);
    });
    playerStmt.finalize();

    // Insert inbox messages
    const inboxStmt = db.prepare(`INSERT INTO inbox_messages (save_id, sender, subject, body) VALUES (?, ?, ?, ?)`);
    inbox.forEach(message => {
      inboxStmt.run(id, message.sender, message.subject, message.body);
    });
    inboxStmt.finalize();

    res.status(200).json({ message: 'Career saved successfully', id: id, changes: this.changes });
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
  db.get(`SELECT * FROM saves WHERE id = ?`, [id], (err, save) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!save) {
      return res.status(404).json({ message: 'Save not found' });
    }

    db.all(`SELECT name, role, ratings, weapon, shield FROM players WHERE save_id = ?`, [id], (err, players) => {
      if (err) return res.status(500).json({ error: err.message });
      save.players = players;

      db.all(`SELECT sender, subject, body FROM inbox_messages WHERE save_id = ?`, [id], (err, inbox) => {
        if (err) return res.status(500).json({ error: err.message });
        save.inbox = inbox;
        res.status(200).json(save);
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});