// server.js - Application Jeux de société

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Base de données
const db = new sqlite3.Database("./database.db");

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
// REDIRECTION /jeux
// --------------------
app.get("/jeux", (req, res) => res.redirect("/jeux/menu"));

// --------------------
// SOUS-MENU JEUX
// --------------------
app.get("/jeux/menu", (req, res) => {
  let html = `<h2>🎲 Jeux de société</h2>
              <ul>
                <li><a href="/jeux/liste">1) Liste des jeux</a></li>
                <li><a href="/jeux/gerer">2) Gestion d'un jeu</a></li>
              </ul>
              <br><a href="/">⬅ Retour menu principal</a>`;
  res.send(html);
});

// Liste des jeux avec infos complètes et moyenne du score
app.get("/jeux/liste", (req, res) => {
  const sql = `
    SELECT j.*, ROUND(AVG(s.score), 2) AS moyenne_score
    FROM jeux j
    LEFT JOIN scores s ON j.id = s.jeu_id
    GROUP BY j.id
    ORDER BY j.nom COLLATE NOCASE
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>Liste des jeux</h2>`;
    html += `<table border="1" cellpadding="5">
             <tr><th>Nom</th><th>Min joueurs</th><th>Max joueurs</th><th>Temps min</th><th>Temps max</th><th>Extensions</th><th>Statut</th><th>Moyenne</th></tr>`;
    rows.forEach(r => {
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
  });
});

// Gestion d'un jeu (ajout / modification / suppression)
app.get("/jeux/gerer", (req, res) => {
  db.all(`SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE`, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>Gestion d'un jeu</h2>`;
    html += `<form method="POST" action="/jeux/gerer/ajouter">
              <input name="nom" placeholder="Nom du jeu" required>
              <button type="submit">Ajouter</button>
             </form><br>`;

    html += `<ul>`;
    rows.forEach(r => {
      html += `<li>${r.nom} 
               <a href="/jeux/gerer/modifier/${r.id}">Modifier</a> | 
               <a href="/jeux/gerer/supprimer/${r.id}">Supprimer</a>
               </li>`;
    });
    html += `</ul><br><a href="/jeux/menu">⬅ Retour menu Jeux</a>`;
    res.send(html);
  });
});

// --------------------
// MEILLEURS JEUX
// --------------------
app.get("/jeux/meilleurs", (req, res) => {
  let html = `<h2>🏆 Meilleurs jeux</h2>
              <ul>
                <li><a href="/jeux/meilleurs/tous">1) Tous les joueurs</a></li>
                <li><a href="/jeux/meilleurs/joueur">2) Par joueur</a></li>
              </ul><br>
              <a href="/jeux/menu">⬅ Retour menu Jeux</a>`;
  res.send(html);
});

app.get("/jeux/meilleurs/tous", (req, res) => {
  const sql = `
    SELECT j.nom, ROUND(AVG(s.score),2) AS moyenne_score
    FROM jeux j
    JOIN scores s ON j.id = s.jeu_id
    GROUP BY j.id
    ORDER BY moyenne_score DESC, j.nom COLLATE NOCASE
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Top 10 Meilleurs jeux - Tous joueurs</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.moyenne_score}</td></tr>`);
    html += `</table><br><a href="/jeux/meilleurs">⬅ Retour Meilleurs jeux</a>`;
    res.send(html);
  });
});

app.get("/jeux/meilleurs/joueur", (req, res) => {
  db.all(`SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE`, [], (err, joueurs) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Meilleurs jeux par joueur</h2>
                <form method="GET" action="/jeux/meilleurs/joueur/liste">
                <select name="joueur_id" required>
                <option value="">-- Choisir joueur --</option>`;
    joueurs.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select> <button type="submit">Voir</button></form>
             <br><a href="/jeux/meilleurs">⬅ Retour Meilleurs jeux</a>`;
    res.send(html);
  });
});

app.get("/jeux/meilleurs/joueur/liste", (req, res) => {
  const joueur_id = req.query.joueur_id;
  if (!joueur_id) return res.redirect("/jeux/meilleurs/joueur");

  const sql = `
    SELECT j.nom, s.score
    FROM scores s
    JOIN jeux j ON s.jeu_id = j.id
    WHERE s.joueur_id = ?
    ORDER BY s.score DESC, j.nom COLLATE NOCASE
    LIMIT 10
  `;
  db.all(sql, [joueur_id], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Top 10 Meilleurs jeux - Joueur</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Score</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.score}</td></tr>`);
    html += `</table><br><a href="/jeux/meilleurs/joueur">⬅ Retour Choix joueur</a>`;
    res.send(html);
  });
});

// --------------------
// PIRES JEUX
// --------------------
app.get("/jeux/pire", (req, res) => {
  let html = `<h2>💀 Pires jeux</h2>
              <ul>
                <li><a href="/jeux/pire/tous">1) Tous les joueurs</a></li>
                <li><a href="/jeux/pire/joueur">2) Par joueur</a></li>
              </ul><br>
              <a href="/jeux/menu">⬅ Retour menu Jeux</a>`;
  res.send(html);
});

app.get("/jeux/pire/tous", (req, res) => {
  const sql = `
    SELECT j.nom, ROUND(AVG(s.score),2) AS moyenne_score
    FROM jeux j
    JOIN scores s ON j.id = s.jeu_id
    GROUP BY j.id
    ORDER BY moyenne_score ASC, j.nom COLLATE NOCASE
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Top 10 Pires jeux - Tous joueurs</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.moyenne_score}</td></tr>`);
    html += `</table><br><a href="/jeux/pire">⬅ Retour Pires jeux</a>`;
    res.send(html);
  });
});

app.get("/jeux/pire/joueur", (req, res) => {
  db.all(`SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE`, [], (err, joueurs) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Pires jeux par joueur</h2>
                <form method="GET" action="/jeux/pire/joueur/liste">
                <select name="joueur_id" required>
                <option value="">-- Choisir joueur --</option>`;
    joueurs.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select> <button type="submit">Voir</button></form>
             <br><a href="/jeux/pire">⬅ Retour Pires jeux</a>`;
    res.send(html);
  });
});

app.get("/jeux/pire/joueur/liste", (req, res) => {
  const joueur_id = req.query.joueur_id;
  if (!joueur_id) return res.redirect("/jeux/pire/joueur");

  const sql = `
    SELECT j.nom, s.score
    FROM scores s
    JOIN jeux j ON s.jeu_id = j.id
    WHERE s.joueur_id = ?
    ORDER BY s.score ASC, j.nom COLLATE NOCASE
    LIMIT 10
  `;
  db.all(sql, [joueur_id], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);
    let html = `<h2>Top 10 Pires jeux - Joueur</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Score</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.score}</td></tr>`);
    html += `</table><br><a href="/jeux/pire/joueur">⬅ Retour Choix joueur</a>`;
    res.send(html);
  });
});

// --------------------
// DONNER UN SCORE
// --------------------
app.get("/scores/ajouter", (req, res) => {
  db.all(`SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE`, [], (err, jeux) => {
    if (err) return res.send("Erreur DB : " + err.message);
    db.all(`SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE`, [], (err2, joueurs) => {
      if (err2) return res.send("Erreur DB : " + err2.message);

      let html = `<h2>Donner un score</h2>
                  <form method="POST" action="/scores/ajouter">
                  <label>Jeu:</label>
                  <select name="jeu_id" required>
                  <option value="">--Choisir--</option>`;
      jeux.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
      html += `</select><br><label>Joueur:</label>
               <select name="joueur_id" required>
               <option value="">--Choisir--</option>`;
      joueurs.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
      html += `</select><br>
               <label>Score:</label><input type="number" step="0.5" min="0" max="10" name="score" required>
               <button type="submit">Enregistrer le score</button></form>
               <br><a href="/">⬅ Retour menu principal</a>`;
      res.send(html);
    });
  });
});

app.post("/scores/ajouter", (req, res) => {
  const { jeu_id, joueur_id, score } = req.body;
  const sql = `INSERT INTO scores (jeu_id, joueur_id, score) VALUES (?, ?, ?)`;
  db.run(sql, [jeu_id, joueur_id, score], (err) => {
    if (err) return res.send("Erreur DB : " + err.message);
    res.send(`<p>Score enregistré !</p><a href="/scores/ajouter">⬅ Retour</a>`);
  });
});

// --------------------
// LANCEMENT SERVEUR
// --------------------
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});