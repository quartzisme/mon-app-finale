// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();

// Middleware pour parser les données POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir les images statiques
app.use("/images", express.static(path.join(__dirname, "public/images")));

// Base de données SQLite
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erreur ouverture DB :", err.message);
    else console.log("DB connectée :", dbPath);
});

// ============================
// CRÉATION DES TABLES SI INEXISTANTES
// ============================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS joueurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS jeux (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        extensions TEXT,
        min_joueurs INTEGER,
        max_joueurs INTEGER,
        temps_min INTEGER,
        temps_max INTEGER,
        statut TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jeu_id INTEGER NOT NULL,
        joueur_id INTEGER NOT NULL,
        score REAL NOT NULL,
        FOREIGN KEY (jeu_id) REFERENCES jeux(id),
        FOREIGN KEY (joueur_id) REFERENCES joueurs(id)
    )`);
});

// ============================
// FONCTION MAÎTRE POUR AFFICHER LES PAGES
// ============================
function renderPage(title, content) {
    return `
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-size: 20px; 
            line-height: 1.6; 
            font-family: Arial, sans-serif; 
            margin: 10px; 
        }
        h1, h2 { font-size: 1.8em; margin-bottom: 20px; }
        ul { padding-left: 0; list-style-type: none; }
        li { font-size: 18px; margin-bottom: 15px; }
        a, button { font-size: 18px; padding: 8px; }
        input, select { font-size: 18px; padding: 8px; width: 100%; box-sizing: border-box; margin-bottom: 15px; }
        img { max-width: 100%; height: auto; border: 1px solid #333; margin-top: 5px; }
        form { margin-bottom: 20px; }
    </style>
    <h2>${title}</h2>
    ${content}
    `;
}

// ============================
// MENU PRINCIPAL
// ============================
app.get("/", (req, res) => {
    const content = `
    <ul>
        <li><a href="/joueurs">Les joueurs</a></li>
        <li><a href="/jeux/menu">Les jeux de société</a></li>
        <li><a href="/scores/ajouter">Donner un score</a></li>
        <li><a href="/meilleurs-jeux">Les meilleurs jeux</a></li>
        <li><a href="/pires-jeux">Les pires jeux</a></li>
        <li><a href="/filtrages">Filtrages</a></li>
    </ul>`;
    res.send(renderPage("🎲 Jeux de Société", content));
});

// ============================
// GESTION JOUEURS
// ============================
app.get("/joueurs", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        let content = `<ul>`;
        rows.forEach((row) => {
            const imgPath = path.join(__dirname, "public/images", `${row.nom}.jpg`);
            const imgSrc = fs.existsSync(imgPath) ? `/images/${row.nom}.jpg` : `/images/default.jpg`;
            content += `<li>${row.nom}<br><img src="${imgSrc}" alt="Image de ${row.nom}"></li>`;
        });
        content += `</ul>
        <ul>
            <li><a href="/joueurs/ajouter">Ajouter un joueur</a></li>
            <li><a href="/joueurs/modifier">Modifier un joueur</a></li>
            <li><a href="/joueurs/supprimer">Supprimer un joueur</a></li>
        </ul>
        <a href="/">⬅ Retour au menu</a>`;
        res.send(renderPage("Gestion des joueurs", content));
    });
});

app.get("/joueurs/ajouter", (req, res) => {
    const content = `
    <form method="POST" action="/joueurs/ajouter">
        <label>Nom du joueur :
            <input type="text" name="nom" required>
        </label>
        <button type="submit">Ajouter</button>
    </form>
    <a href='/joueurs'>⬅ Retour</a>`;
    res.send(renderPage("Ajouter un joueur", content));
});

app.post("/joueurs/ajouter", (req, res) => {
    const nom = req.body.nom.trim();
    if (!nom) return res.send(renderPage("Erreur", "Nom vide ! <a href='/joueurs/ajouter'>Réessayer</a>"));
    db.run("INSERT INTO joueurs (nom) VALUES (?)", [nom], function(err) {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        res.redirect("/joueurs");
    });
});

app.get("/joueurs/modifier", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        let content = `<form method='POST' action='/joueurs/modifier'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => content += `<option value='${r.id}'>${r.nom}</option>`);
        content += `</select></label>
                    <label>Nouveau nom : <input type='text' name='nouveau_nom' required></label>
                    <button type='submit'>Modifier</button>
                    </form>
                    <a href='/joueurs'>⬅ Retour</a>`;
        res.send(renderPage("Modifier un joueur", content));
    });
});

app.post("/joueurs/modifier", (req, res) => {
    const id = req.body.id;
    const nouveau_nom = req.body.nouveau_nom.trim();
    if (!nouveau_nom) return res.send(renderPage("Erreur", "Nom vide ! <a href='/joueurs/modifier'>Réessayer</a>"));
    db.run("UPDATE joueurs SET nom=? WHERE id=?", [nouveau_nom, id], err => {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        res.redirect("/joueurs");
    });
});

app.get("/joueurs/supprimer", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        let content = `<form method='POST' action='/joueurs/supprimer'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => content += `<option value='${r.id}'>${r.nom}</option>`);
        content += `</select></label>
                    <button type='submit'>Supprimer</button>
                    </form>
                    <a href='/joueurs'>⬅ Retour</a>`;
        res.send(renderPage("Supprimer un joueur", content));
    });
});

app.post("/joueurs/supprimer", (req, res) => {
    db.run("DELETE FROM joueurs WHERE id=?", [req.body.id], err => {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        res.redirect("/joueurs");
    });
});

// ============================
// GESTION JEUX
// ============================
app.get("/jeux/menu", (req, res) => {
    const content = `
    <ul>
        <li><a href="/jeux/liste">La liste des jeux</a></li>
        <li><a href="/jeux/gerer">Saisir / Modifier un jeu</a></li>
    </ul>
    <a href="/">⬅ Retour au menu</a>`;
    res.send(renderPage("🎲 Jeux de société", content));
});

app.get("/jeux/liste", (req, res) => {
    const sql = `
    SELECT j.id, j.nom, j.extensions, j.min_joueurs, j.max_joueurs, j.temps_min, j.temps_max, j.statut,
           ROUND(AVG(s.score),2) AS moyenne_score
    FROM jeux j
    LEFT JOIN scores s ON j.id=s.jeu_id
    GROUP BY j.id
    ORDER BY j.nom COLLATE NOCASE
    `;
    db.all(sql, [], (err, rows) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));
        let content = `<table border="1" cellpadding="5"><tr>
                        <th>Nom</th><th>Extensions</th><th>Min joueurs</th><th>Max joueurs</th>
                        <th>Temps min</th><th>Temps max</th><th>Statut</th><th>Moyenne score</th>
                    </tr>`;
        rows.forEach(j => {
            content += `<tr>
                            <td>${j.nom}</td>
                            <td>${j.extensions||""}</td>
                            <td>${j.min_joueurs}</td>
                            <td>${j.max_joueurs}</td>
                            <td>${j.temps_min}</td>
                            <td>${j.temps_max}</td>
                            <td>${j.statut||""}</td>
                            <td>${j.moyenne_score||"–"}</td>
                        </tr>`;
        });
        content += `</table><a href="/jeux/menu">⬅ Retour</a>`;
        res.send(renderPage("Liste des jeux", content));
    });
});

// ============================
// GESTION JEUX - GERER
// ============================
app.get("/jeux/gerer", (req,res) => {
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));
        let content = `<form method="POST" action="/jeux/gerer">
                        <label>Jeu :</label>
                        <select name="jeu_id"><option value="">-- Nouveau jeu --</option>`;
        jeux.forEach(j => content += `<option value="${j.id}">${j.nom}</option>`);
        content += `</select>
                    <label>Nom :</label><input type="text" name="nom" required>
                    <label>Extensions :</label><input type="text" name="extensions">
                    <label>Min joueurs :</label><input type="number" name="min_joueurs">
                    <label>Max joueurs :</label><input type="number" name="max_joueurs">
                    <label>Temps min :</label><input type="number" name="temps_min">
                    <label>Temps max :</label><input type="number" name="temps_max">
                    <label>Statut :</label><input type="text" name="statut"><br>
                    <button type="submit" name="action" value="enregistrer">Enregistrer</button>
                    <button type="submit" name="action" value="supprimer">Supprimer</button>
                    </form>
                    <a href="/jeux/menu">⬅ Retour</a>`;
        res.send(renderPage("Saisir ou modifier un jeu", content));
});

app.post("/jeux/gerer", (req,res) => {
    const { jeu_id, nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, action } = req.body;
    if(action==="enregistrer"){
        if(jeu_id){
            db.run("UPDATE jeux SET nom=?, extensions=?, min_joueurs=?, max_joueurs=?, temps_min=?, temps_max=?, statut=? WHERE id=?",
                   [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, jeu_id],
                   err=> { if(err) return res.send(renderPage("Erreur DB", err.message)); res.redirect("/jeux/gerer"); });
        } else {
            db.run("INSERT INTO jeux (nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut) VALUES (?,?,?,?,?,?,?)",
                   [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut],
                   err=> { if(err) return res.send(renderPage("Erreur DB", err.message)); res.redirect("/jeux/gerer"); });
        }
    } else if(action==="supprimer"){
        if(!jeu_id) return res.send(renderPage("Erreur", "Veuillez sélectionner un jeu."));
        db.run("DELETE FROM jeux WHERE id=?", [jeu_id], err => { if(err) return res.send(renderPage("Erreur DB", err.message)); res.redirect("/jeux/gerer"); });
    }
});

// ============================
// SCORES
// ============================
app.get("/scores/ajouter", (req, res) => {
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err2, joueurs) => {
            if (err2) return res.send(renderPage("Erreur DB", err2.message));

            let content = `
                <form method="POST" action="/scores/ajouter">
                    <label>Jeu :</label>
                    <select name="jeu_id" required>
                        ${jeux.map(j => `<option value="${j.id}">${j.nom}</option>`).join("")}
                    </select>

                    <label>Joueur :</label>
                    <select name="joueur_id" id="joueurSelect" required>
                        <option value="">-- Choisir un joueur --</option>
                        ${joueurs.map(j => `<option value="${j.id}" data-nom="${j.nom}">${j.nom}</option>`).join("")}
                    </select>

                    <div id="carteJoueur" style="margin-top:20px;"></div>

                    <label>Score :</label>
                    <input type="number" step="0.5" name="score" required>

                    <button type="submit">Enregistrer le score</button>
                </form>

                <a href="/">⬅ Retour</a>

                <script>
                    const select = document.getElementById("joueurSelect");
                    const carteDiv = document.getElementById("carteJoueur");
                    select.addEventListener("change", () => {
                        const opt = select.options[select.selectedIndex];
                        const nom = opt.getAttribute("data-nom");
                        carteDiv.innerHTML = nom ? '<img src="/images/' + nom + '.jpg" alt="Carte ' + nom + '" style="max-width:300px;border:1px solid #333;">' : '';
                    });
                </script>
            `;

            res.send(renderPage("Donner un score", content));
        });
    });
});

app.post("/scores/ajouter", (req, res) => {
    const { jeu_id, joueur_id, score } = req.body;
    if (!jeu_id || !joueur_id || !score) {
        return res.send(renderPage("Erreur", "Veuillez remplir tous les champs."));
    }

    db.run(
        "INSERT INTO scores (jeu_id, joueur_id, score) VALUES (?, ?, ?)",
        [jeu_id, joueur_id, score],
        err => {
            if (err) return res.send(renderPage("Erreur DB", err.message));
            res.send(
                renderPage(
                    "✅ Score enregistré",
                    `<a href="/scores/ajouter">Ajouter un autre score</a><br><a href="/">⬅ Retour</a>`
                )
            );
        }
    );
});


// ============================
// MEILLEURS ET PIRES JEUX
// ============================
function topJeux(route, order){
    app.get(route, (req,res)=>{
        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err,joueurs)=>{
            if(err) return res.send(renderPage("Erreur DB", err.message));
            let content = `<form method="GET" action="${route}/liste">
                           <label>Choisir un joueur : </label>
                           <select name="joueur_id">
                           <option value="">-- Tous les joueurs --</option>`;
            joueurs.forEach(j=>content+=`<option value="${j.id}">${j.nom}</option>`);
            content += `</select><button type="submit">Voir Top 10</button></form>
                        <a href="/">⬅ Retour</a>`;
            res.send(renderPage(route.includes("meilleurs")?"🏆 Meilleurs jeux":"💀 Pires jeux", content));
        });
    });
    app.get(route+"/liste",(req,res)=>{
        const joueur_id = req.query.joueur_id;
        let sql = `SELECT j.nom AS nom_jeu, AVG(s.score) AS score_moyen
                   FROM jeux j LEFT JOIN scores s ON j.id=s.jeu_id`;
        const params=[];
        if(joueur_id) { sql += " WHERE s.joueur_id=?"; params.push(joueur_id);}
        sql += " GROUP BY j.id ORDER BY score_moyen "+order+" LIMIT 10";
        db.all(sql,params,(err,rows)=>{
            if(err) return res.send(renderPage("Erreur DB", err.message));
            let content = `<ol>`;
            rows.forEach(r=>content+=`<li>${r.nom_jeu} - Score moyen : ${r.score_moyen!=null?r.score_moyen.toFixed(1):0}</li>`);
            content += `</ol><a href="${route}">⬅ Retour</a>`;
            res.send(renderPage(route.includes("meilleurs")?"🏆 Top 10":"💀 Bottom 10", content));
        });
    });
}
topJeux("/meilleurs-jeux","DESC");
topJeux("/pires-jeux","ASC");

// ============================
// FILTRAGES
// ============================
app.get("/filtrages",(req,res)=>{
    const content = `<form method="GET" action="/filtrages/liste">
                     <label>Nombre de joueurs : <input type="number" name="joueurs"></label>
                     <label>Temps maximum (minutes) : <input type="number" name="temps"></label>
                     <label>Score minimum : <input type="number" step="0.5" name="score_min"></label>
                     <button type="submit">Filtrer</button>
                     </form>
                     <a href="/">⬅ Retour</a>`;
    res.send(renderPage("Filtrages des jeux", content));
});

app.get("/filtrages/liste",(req,res)=>{
    const joueurs = parseInt(req.query.joueurs)||0;
    const temps = parseInt(req.query.temps)||0;
    const score_min = parseFloat(req.query.score_min)||0;
    let sql = `SELECT j.nom, j.min_joueurs,j.max_joueurs,j.temps_min,j.temps_max,ROUND(AVG(s.score),2) AS score_moyen
               FROM jeux j LEFT JOIN scores s ON j.id=s.jeu_id`;
    const params=[];
    const conditions=[];
    if(joueurs>0) { conditions.push("j.min_joueurs<=? AND j.max_joueurs>=?"); params.push(joueurs,joueurs);}
    if(temps>0) { conditions.push("j.temps_max<=?"); params.push(temps);}
    if(conditions.length>0) sql+=" WHERE "+conditions.join(" AND ");
    sql+=" GROUP BY j.id";
    if(score_min>0) { sql+=" HAVING score_moyen>=?"; params.push(score_min);}
    sql+=" ORDER BY j.nom COLLATE NOCASE";
    db.all(sql,params,(err,rows)=>{
        if(err) return res.send(renderPage("Erreur DB", err.message));
        if(rows.length===0) return res.send(renderPage("Aucun jeu trouvé", "<a href='/filtrages'>⬅ Retour</a>"));
        let content = "<ul>";
        rows.forEach(j=>content+=`<li>${j.nom} - Joueurs : ${j.min_joueurs}-${j.max_joueurs}, Temps : ${j.temps_min}-${j.temps_max} min, Score moyen : ${j.score_moyen||0}</li>`);
        content += "</ul><a href='/filtrages'>⬅ Retour</a>";
        res.send(renderPage("Jeux filtrés", content));
    });
});


// ============================
// SERVER
// ============================
const PORT = process.env.PORT || 10000; // 10000 est le port par défaut de Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
