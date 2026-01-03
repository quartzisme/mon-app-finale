const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

const fichierCSV = path.join(__dirname, "jeux.csv");

const lignes = fs.readFileSync(fichierCSV, { encoding: "utf-8" })
  .replace(/^\uFEFF/, "")
  .split("\n")
  .map(l => l.trim())
  .filter(l => l);

lignes.shift(); // retire l'en-tête

db.serialize(() => {
  const stmt = db.prepare("INSERT INTO jeux (nom) VALUES (?)");

  lignes.forEach(nom => {
    stmt.run(nom);
  });

  stmt.finalize(() => {
    db.close();
    console.log("✅ Importation terminée !");
  });
});
