const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

db.run("DELETE FROM jeux", function(err) {
  if (err) {
    console.error(err.message);
  } else {
    console.log(`✅ ${this.changes} jeux supprimés`);
  }
  db.close();
});
