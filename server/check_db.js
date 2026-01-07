const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./career.db');

const targetId = '1767701447659';

db.all("SELECT id, team FROM saves", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Saves in DB:", rows.length);
  const targetSave = rows.find(r => r.id === targetId);
  console.log(`Target save ${targetId}:`, targetSave);
  
  db.get("SELECT COUNT(*) as count FROM players WHERE save_id = ?", [targetId], (err, result) => {
    console.log(`Players for save ${targetId}:`, result ? result.count : 0);
    
    db.all("SELECT DISTINCT save_id FROM players", [], (err, ids) => {
      console.log("All save_ids present in players table:", ids.map(i => i.save_id));
      db.close();
    });
  });
});
