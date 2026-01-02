const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('career.db');
db.all("PRAGMA table_info(saves)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    db.close();
});
