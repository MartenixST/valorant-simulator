const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./career.db');

db.all("SELECT id FROM saves", [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Saves in DB:", rows);
  db.close();
});
