// server.js - Application Jeux de société avec PostgreSQL

const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// --------------------
// BASE DE DONNÉES POSTGRESQL
// --------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Railway fournit DATABASE_URL
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// --------------------
// MENU PRINCIPAL
// --------------------
app.get("/", (req, res) => {
  let html = `<h1>🏠 Menu Principal</h1>
              <ul>
                <li><a href="/joueurs">1) Les joueurs</a></li>
                <li><a href="/jeux/menu">2) Les jeux de société</a></li>
                <li><a href="/scores/ajouter">3) Donner un score</a></li>
                <li><a href="/jeux/meilleurs">4) Meilleurs jeux</a></li>
                <li><a href="/jeux/pire">5) Pires jeux</a></li>
              </ul>`;
  res.send(html);
});

// --------------------
// SOUS-MENU JEUX
// --------------------
app.get("/jeux/menu", async (req, res) => {
  let html = `<h2>🎲 Jeux de société</h2>
              <ul>
                <li><a href="/jeux/liste">1) Liste des jeux</a></li>
                <li><a href="/jeux/gerer">2) Gestion d'un jeu</a></li>
              </ul>
              <br><a href="/">⬅ Retour menu principal</a>`;
  res.send(html);
});

// Liste des jeux avec infos et moyenne score
app.get("/jeux/liste", async (req, res) => {
  try {
    const sql = `
      SELECT j.*, ROUND(AVG(s.score), 2) AS moyenne_score
      FROM jeux j
      LEFT JOIN scores s ON j.id = s.jeu_id
      GROUP BY j.id
      ORDER BY j.nom
    `;
    const result = await query(sql, []);
    let html = `<h2>Liste des jeux</h2>`;
    html += `<table border="1" cellpadding="5">
             <tr><th>Nom</th><th>Min joueurs</th><th>Max joueurs</th><th>Temps min</th><th>Temps max</th><th>Extensions</th><th>Statut</th><th>Moyenne</th></tr>`;
    result.rows.forEach(r => {
      html += `<tr>
                <td>${r.nom}</td>
                <td>${r.min_joueurs}</td>
                <td>${r.max_joueurs}</td>
                <td>${r.temps_min}</td>
                <td>${r.temps_max}</td>
                <td>${r.extensions || ''}</td>
                <td>${r.statut || ''}</td>
                <td>${r.moyenne_score || '-'}</td>
               </tr>`;
    });
    html += `</table><br><a href="/jeux/menu">⬅ Retour menu Jeux</a>`;
    res.send(html);
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

// Gestion d'un jeu (ajout / modification / suppression)
app.get("/jeux/gerer", async (req, res) => {
  try {
    const jeux = await query(`SELECT id, nom FROM jeux ORDER BY nom`, []);
    let html = `<h2>Gestion d'un jeu</h2>`;
    html += `<form method="POST" action="/jeux/gerer/ajouter">
              <input name="nom" placeholder="Nom du jeu" required>
              <button type="submit">Ajouter</button>
             </form><br>`;
    html += `<ul>`;
    jeux.rows.forEach(j => {
      html += `<li>${j.nom} 
               <a href="/jeux/gerer/modifier/${j.id}">Modifier</a> | 
               <a href="/jeux/gerer/supprimer/${j.id}">Supprimer</a>
               </li>`;
    });
    html += `</ul><br><a href="/jeux/menu">⬅ Retour menu Jeux</a>`;
    res.send(html);
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

app.post("/jeux/gerer/ajouter", async (req, res) => {
  const { nom } = req.body;
  try {
    await query(`INSERT INTO jeux (nom) VALUES ($1)`, [nom]);
    res.redirect("/jeux/gerer");
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

app.get("/jeux/gerer/supprimer/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await query(`DELETE FROM jeux WHERE id=$1`, [id]);
    res.redirect("/jeux/gerer");
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

// --------------------
// DONNER UN SCORE
// --------------------
app.get("/scores/ajouter", async (req, res) => {
  try {
    const jeux = await query(`SELECT id, nom FROM jeux ORDER BY nom`, []);
    const joueurs = await query(`SELECT id, nom FROM joueurs ORDER BY nom`, []);
    let html = `<h2>Donner un score</h2>
                <form method="POST" action="/scores/ajouter">
                <label>Jeu:</label>
                <select name="jeu_id" required>
                <option value="">--Choisir--</option>`;
    jeux.rows.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select><br><label>Joueur:</label>
             <select name="joueur_id" required>
             <option value="">--Choisir--</option>`;
    joueurs.rows.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select><br>
             <label>Score:</label><input type="number" step="0.5" min="0" max="10" name="score" required>
             <button type="submit">Enregistrer le score</button></form>
             <br><a href="/">⬅ Retour menu principal</a>`;
    res.send(html);
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

app.post("/scores/ajouter", async (req, res) => {
  const { jeu_id, joueur_id, score } = req.body;
  try {
    await query(`INSERT INTO scores (jeu_id, joueur_id, score) VALUES ($1, $2, $3)`, [jeu_id, joueur_id, score]);
    res.send(`<p>Score enregistré !</p><a href="/scores/ajouter">⬅ Retour</a>`);
  } catch (err) {
    res.send("Erreur DB : " + err.message);
  }
});

// --------------------
// LANCEMENT SERVEUR
// --------------------
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
