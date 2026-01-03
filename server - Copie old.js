// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

// Middleware pour parser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Base de données SQLite
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erreur ouverture DB :", err.message);
  } else {
    console.log("DB connectée :", dbPath);
  }
});

// ============================
// MENU PRINCIPAL
// ============================
app.get("/", (req, res) => {
  let html = `
    <h1>🎲 Mon application Jeux de Société</h1>
    <ul>
      <li><a href="/joueurs">1) Les joueurs</a></li>
      <li><a href="/jeux">2) Les jeux de société</a></li>
      <li><a href="/scores/ajouter">3) Donner un score</a></li>
      <li><a href="/meilleurs-jeux">4) Les meilleurs jeux</a></li>
      <li><a href="/pires-jeux">5) Les pires jeux</a></li>
    </ul>
  `;
  res.send(html);
});

// ============================
// SOUS-MENU JOUEURS
// ============================
app.get("/joueurs", (req, res) => {
  let html = `
    <h2>Gestion des joueurs</h2>
    <ul>
      <li><a href="/joueurs/liste">Liste des joueurs</a></li>
      <li><a href="/joueurs/ajouter">Ajouter un joueur</a></li>
      <li><a href="/joueurs/modifier">Modifier un joueur</a></li>
      <li><a href="/joueurs/supprimer">Supprimer un joueur</a></li>
    </ul>
    <a href="/">⬅ Retour au menu principal</a>
  `;
  res.send(html);
});

// Liste des joueurs
app.get("/joueurs/liste", (req, res) => {
  db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = "<h2>Liste des joueurs</h2><ul>";
    rows.forEach((row) => {
      html += `<li>${row.nom}</li>`;
    });
    html += "</ul><a href='/joueurs'>⬅ Retour au sous-menu joueurs</a>";
    res.send(html);
  });
});

// Ajouter un joueur
app.get("/joueurs/ajouter", (req, res) => {
  let html = `
    <h2>Ajouter un joueur</h2>
    <form method="POST" action="/joueurs/ajouter">
      <label>Nom du joueur : <input type="text" name="nom" required></label>
      <button type="submit">Ajouter</button>
    </form>
    <a href='/joueurs'>⬅ Retour au sous-menu joueurs</a>
  `;
  res.send(html);
});

app.post("/joueurs/ajouter", (req, res) => {
  const nom = req.body.nom.trim();
  if (!nom) return res.send("Nom vide ! <a href='/joueurs/ajouter'>Réessayer</a>");

  db.run("INSERT INTO joueurs (nom) VALUES (?)", [nom], function(err) {
    if (err) return res.send("Erreur DB : " + err.message);
    res.send(`Joueur "${nom}" ajouté avec succès ! <a href='/joueurs'>⬅ Retour</a>`);
  });
});

// Modifier un joueur
app.get("/joueurs/modifier", (req, res) => {
  db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = "<h2>Modifier un joueur</h2><form method='POST' action='/joueurs/modifier'>";
    html += "<label>Choisir le joueur : <select name='id'>";
    rows.forEach((row) => {
      html += `<option value='${row.id}'>${row.nom}</option>`;
    });
    html += "</select></label><br>";
    html += "<label>Nouveau nom : <input type='text' name='nouveau_nom' required></label><br>";
    html += "<button type='submit'>Modifier</button></form>";
    html += "<a href='/joueurs'>⬅ Retour au sous-menu joueurs</a>";
    res.send(html);
  });
});

app.post("/joueurs/modifier", (req, res) => {
  const id = req.body.id;
  const nouveau_nom = req.body.nouveau_nom.trim();
  if (!nouveau_nom) return res.send("Nom vide ! <a href='/joueurs/modifier'>Réessayer</a>");

  db.run("UPDATE joueurs SET nom = ? WHERE id = ?", [nouveau_nom, id], function(err) {
    if (err) return res.send("Erreur DB : " + err.message);
    res.send(`Joueur modifié avec succès ! <a href='/joueurs'>⬅ Retour</a>`);
  });
});

// Supprimer un joueur
app.get("/joueurs/supprimer", (req, res) => {
  db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = "<h2>Supprimer un joueur</h2><form method='POST' action='/joueurs/supprimer'>";
    html += "<label>Choisir le joueur : <select name='id'>";
    rows.forEach((row) => {
      html += `<option value='${row.id}'>${row.nom}</option>`;
    });
    html += "</select></label><br>";
    html += "<button type='submit'>Supprimer</button></form>";
    html += "<a href='/joueurs'>⬅ Retour au sous-menu joueurs</a>";
    res.send(html);
  });
});

app.post("/joueurs/supprimer", (req, res) => {
  const id = req.body.id;
  db.run("DELETE FROM joueurs WHERE id = ?", [id], function(err) {
    if (err) return res.send("Erreur DB : " + err.message);
    res.send(`Joueur supprimé avec succès ! <a href='/joueurs'>⬅ Retour</a>`);
  });
});

// ============================
// SOUS-MENU : Jeux de société
// ============================
app.get("/jeux", (req, res) => {
  res.redirect("/jeux/menu");
});
app.get("/jeux/menu", (req, res) => {
  let html = `<h2>🎲 Jeux de société</h2>`;
  html += `<ul>
             <li><a href="/jeux/liste">1) La liste des jeux</a></li>
	     <li><a href="/jeux/gerer">2) Saisir / Modifier un jeu</a></li>
           </ul>
           <br><a href="/">⬅ Retour au menu principal</a>`;
  res.send(html);
});

// ============================
// AFFICHAGE DE LA LISTE DES JEUX
// ============================
app.get("/jeux/liste", (req, res) => {
  const sql = `
    SELECT 
      j.id,
      j.nom,
      j.extensions,
      j.min_joueurs,
      j.max_joueurs,
      j.temps_min,
      j.temps_max,
      j.statut,
      ROUND(AVG(s.score), 2) AS moyenne_score
    FROM jeux j
    LEFT JOIN scores s ON j.id = s.jeu_id
    GROUP BY j.id
    ORDER BY 
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        j.nom,
        'É','E'),
        'È','E'),
        'Ê','E'),
        'À','A'),
        'Â','A'),
        'Ô','O'),
        'Ç','C') COLLATE NOCASE
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>📋 Liste des jeux</h2>`;
    html += `<table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <th>Nom</th>
        <th>Extensions</th>
        <th>Min joueurs</th>
        <th>Max joueurs</th>
        <th>Temps min</th>
        <th>Temps max</th>
        <th>Statut</th>
        <th>Moyenne score</th>
      </tr>`;

    rows.forEach(j => {
      html += `<tr>
        <td>${j.nom}</td>
        <td>${j.extensions || ''}</td>
        <td>${j.min_joueurs}</td>
        <td>${j.max_joueurs}</td>
        <td>${j.temps_min}</td>
        <td>${j.temps_max}</td>
        <td>${j.statut || ''}</td>
        <td>${j.moyenne_score || '–'}</td>
      </tr>`;
    });

    html += `</table><br><a href="/jeux/menu">⬅ Retour au menu Jeux</a>`;
    res.send(html);
  });
});

// ============================
// SAISIR / MODIFIER / SUPPRIMER UN JEU
// ============================
app.get("/jeux/gerer", (req, res) => {
  const sql = `
    SELECT id, nom 
    FROM jeux
    ORDER BY 
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        nom,
        'É','E'),
        'È','E'),
        'Ê','E'),
        'À','A'),
        'Â','A'),
        'Ô','O'),
        'Ç','C') COLLATE NOCASE
  `;

  db.all(sql, [], (err, jeux) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>✏️ Saisir ou modifier un jeu</h2>`;
    html += `<form method="POST" action="/jeux/gerer">`;

    // Sélection du jeu existant pour modification ou suppression
    html += `<label>Jeu :</label>
             <select name="jeu_id">
               <option value="">-- Nouveau jeu --</option>`;
    jeux.forEach(j => {
      html += `<option value="${j.id}">${j.nom}</option>`;
    });
    html += `</select><br><br>`;

    html += `<label>Nom :</label> <input type="text" name="nom" required><br>`;
    html += `<label>Extensions :</label> <input type="text" name="extensions"><br>`;
    html += `<label>Min joueurs :</label> <input type="number" name="min_joueurs"><br>`;
    html += `<label>Max joueurs :</label> <input type="number" name="max_joueurs"><br>`;
    html += `<label>Temps min :</label> <input type="number" name="temps_min"><br>`;
    html += `<label>Temps max :</label> <input type="number" name="temps_max"><br>`;
    html += `<label>Statut :</label> <input type="text" name="statut"><br><br>`;

    html += `<button type="submit" name="action" value="enregistrer">Enregistrer</button> `;
    html += `<button type="submit" name="action" value="supprimer">Supprimer</button>`;
    html += `</form><br><a href="/jeux/menu">⬅ Retour au menu Jeux</a>`;

    res.send(html);
  });
});

app.post("/jeux/gerer", (req, res) => {
  const { jeu_id, nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, action } = req.body;

  if (action === "enregistrer") {
    if (!nom) return res.send("Le nom du jeu est obligatoire.");

    if (jeu_id) {
      // Modification
      const sql = `
        UPDATE jeux
        SET nom=?, extensions=?, min_joueurs=?, max_joueurs=?, temps_min=?, temps_max=?, statut=?
        WHERE id=?
      `;
      db.run(sql, [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, jeu_id], err => {
        if (err) return res.send("Erreur DB : " + err.message);
        res.redirect("/jeux/gerer");
      });
    } else {
      // Nouveau jeu
      const sql = `
        INSERT INTO jeux (nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut], err => {
        if (err) return res.send("Erreur DB : " + err.message);
        res.redirect("/jeux/gerer");
      });
    }
  } else if (action === "supprimer") {
    if (!jeu_id) return res.send("Veuillez sélectionner un jeu à supprimer.");
    const sql = `DELETE FROM jeux WHERE id=?`;
    db.run(sql, [jeu_id], err => {
      if (err) return res.send("Erreur DB : " + err.message);
      res.redirect("/jeux/gerer");
    });
  }
});

// ----------------------------
// Menu Meilleurs jeux
// ----------------------------
app.get("/jeux/meilleurs", (req, res) => {
  let html = `<h2>🏆 Meilleurs jeux</h2>`;
  html += `<ul>
             <li><a href="/jeux/meilleurs/tous">1) Meilleurs scores - Tous les joueurs</a></li>
             <li><a href="/jeux/meilleurs/joueur">2) Meilleurs scores - Par joueur</a></li>
           </ul>
           <br><a href="/jeux/menu">⬅ Retour au menu Jeux</a>`;
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

    let html = `<h2>🏆 Top 10 des meilleurs jeux - Tous les joueurs</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
    rows.forEach(r => {
      html += `<tr><td>${r.nom}</td><td>${r.moyenne_score}</td></tr>`;
    });
    html += `</table><br><a href="/jeux/meilleurs">⬅ Retour Meilleurs jeux</a>`;
    res.send(html);
  });
});

app.get("/jeux/meilleurs/joueur", (req, res) => {
  // Choix du joueur
  db.all(`SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE`, [], (err, joueurs) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>🏆 Meilleurs jeux par joueur</h2>`;
    html += `<form method="GET" action="/jeux/meilleurs/joueur/liste">`;
    html += `<select name="joueur_id" required>`;
    html += `<option value="">-- Choisir un joueur --</option>`;
    joueurs.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select> <button type="submit">Voir</button></form>`;
    html += `<br><a href="/jeux/meilleurs">⬅ Retour Meilleurs jeux</a>`;
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

    let html = `<h2>🏆 Top 10 des meilleurs jeux - Joueur</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Score</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.score}</td></tr>`);
    html += `</table><br><a href="/jeux/meilleurs/joueur">⬅ Retour Choix joueur</a>`;
    res.send(html);
  });
});

// ============================
// MEILLEURS JEUX (Top 10)
// ============================
app.get("/meilleurs-jeux", (req, res) => {
  const sql = `
    SELECT 
      jeux.nom AS nom_jeu,
      AVG(scores.score) AS score_moyen
    FROM jeux
    LEFT JOIN scores ON scores.jeu_id = jeux.id
    GROUP BY jeux.id
    ORDER BY score_moyen DESC
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = "<h2>Top 10 - Meilleurs jeux</h2><ol>";
    rows.forEach((row) => {
      html += `<li>${row.nom_jeu} - Score moyen : ${row.score_moyen != null ? row.score_moyen.toFixed(1) : "0"}</li>`;
    });
    html += "</ol><a href='/'>⬅ Retour au menu</a>";
    res.send(html);
  });
});


// Menu Pires jeux
app.get("/jeux/pire", (req, res) => {
  let html = `<h2>💀 Pires jeux</h2>`;
  html += `<ul>
             <li><a href="/jeux/pire/tous">1) Pires scores - Tous les joueurs</a></li>
             <li><a href="/jeux/pire/joueur">2) Pires scores - Par joueur</a></li>
           </ul>
           <br><a href="/jeux/menu">⬅ Retour au menu Jeux</a>`;
  res.send(html);
});

// Pires scores - Tous les joueurs
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
    let html = `<h2>💀 Top 10 des pires jeux - Tous les joueurs</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.moyenne_score}</td></tr>`);
    html += `</table><br><a href="/jeux/pire">⬅ Retour Pires jeux</a>`;
    res.send(html);
  });
});

// Pires scores - Par joueur
app.get("/jeux/pire/joueur", (req, res) => {
  db.all(`SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE`, [], (err, joueurs) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = `<h2>💀 Pires jeux par joueur</h2>`;
    html += `<form method="GET" action="/jeux/pire/joueur/liste">`;
    html += `<select name="joueur_id" required>`;
    html += `<option value="">-- Choisir un joueur --</option>`;
    joueurs.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
    html += `</select> <button type="submit">Voir</button></form>`;
    html += `<br><a href="/jeux/pire">⬅ Retour Pires jeux</a>`;
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

    let html = `<h2>💀 Top 10 des pires jeux - Joueur</h2>`;
    html += `<table border="1" cellpadding="5"><tr><th>Jeu</th><th>Score</th></tr>`;
    rows.forEach(r => html += `<tr><td>${r.nom}</td><td>${r.score}</td></tr>`);
    html += `</table><br><a href="/jeux/pire/joueur">⬅ Retour Choix joueur</a>`;
    res.send(html);
  });
});

// ============================
// PIRES JEUX (Bottom 10)
// ============================
app.get("/pires-jeux", (req, res) => {
  const sql = `
    SELECT 
      jeux.nom AS nom_jeu,
      AVG(scores.score) AS score_moyen
    FROM jeux
    LEFT JOIN scores ON scores.jeu_id = jeux.id
    GROUP BY jeux.id
    ORDER BY score_moyen ASC
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.send("Erreur DB : " + err.message);

    let html = "<h2>Bottom 10 - Pires jeux</h2><ol>";
    rows.forEach((row) => {
      html += `<li>${row.nom_jeu} - Score moyen : ${row.score_moyen != null ? row.score_moyen.toFixed(1) : "0"}</li>`;
    });
    html += "</ol><a href='/'>⬅ Retour au menu</a>";
    res.send(html);
  });
});


// ============================
// SAISIE DES SCORES
// ============================

app.get("/scores/ajouter", (req, res) => {
  // Récupérer les jeux triés avec accents ignorés
  const sqlJeux = `
    SELECT id, nom 
    FROM jeux
    ORDER BY 
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        nom,
        'É','E'),
        'È','E'),
        'Ê','E'),
        'À','A'),
        'Â','A'),
        'Ô','O'),
        'Ç','C') COLLATE NOCASE
  `;

  // Récupérer les joueurs triés avec accents ignorés
  const sqlJoueurs = `
    SELECT id, nom 
    FROM joueurs
    ORDER BY 
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        nom,
        'É','E'),
        'È','E'),
        'Ê','E'),
        'À','A'),
        'Â','A'),
        'Ô','O'),
        'Ç','C') COLLATE NOCASE
  `;

  db.all(sqlJeux, [], (err, jeux) => {
    if (err) return res.send("Erreur DB (jeux) : " + err.message);

    db.all(sqlJoueurs, [], (err2, joueurs) => {
      if (err2) return res.send("Erreur DB (joueurs) : " + err2.message);

      // Génération du formulaire HTML
      let html = `<h2>🎯 Donner un score</h2>`;
      html += `<form method="POST" action="/scores/ajouter">`;

      // Sélection du jeu
      html += `<label>Jeu :</label>
               <select name="jeu_id">`;
      jeux.forEach(j => {
        html += `<option value="${j.id}">${j.nom}</option>`;
      });
      html += `</select><br><br>`;

      // Sélection du joueur
      html += `<label>Joueur :</label>
               <select name="joueur_id">`;
      joueurs.forEach(j => {
        html += `<option value="${j.id}">${j.nom}</option>`;
      });
      html += `</select><br><br>`;

      // Champ score
      html += `<label>Score :</label>
               <input type="number" step="0.5" name="score" required><br><br>`;

      // Bouton submit
      html += `<button type="submit">Enregistrer le score</button>`;
      html += `</form><br><a href="/">⬅ Retour au menu</a>`;

      res.send(html);
    });
  });
});

// ============================
// TRAITEMENT DU FORMULAIRE
// ============================
app.post("/scores/ajouter", (req, res) => {
  const { jeu_id, joueur_id, score } = req.body;

  if (!jeu_id || !joueur_id || !score) {
    return res.send("Veuillez remplir tous les champs.");
  }

  const sql = `INSERT INTO scores (jeu_id, joueur_id, score) VALUES (?, ?, ?)`;
  db.run(sql, [jeu_id, joueur_id, score], function(err) {
    if (err) return res.send("Erreur DB : " + err.message);
    res.send(`<p>✅ Score enregistré !</p><a href="/scores/ajouter">Ajouter un autre score</a><br><a href="/">⬅ Retour au menu</a>`);
  });
});


// ============================
// LANCEMENT DU SERVEUR
// ============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});