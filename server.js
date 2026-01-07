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
// FONCTION GÉNÉRIQUE POUR RENDRE UNE PAGE
// ============================
function renderPage(title, content) {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-size: 20px; line-height: 1.6; font-family: Arial, sans-serif; margin: 10px; }
            h1, h2 { font-size: 1.8em; }
            ul, li { font-size: 18px; }
            a, button { font-size: 18px; padding: 8px; text-decoration: none; display: inline-block; margin: 4px 0; }
            input, select { font-size: 18px; padding: 4px; margin: 4px 0; width: 100%; max-width: 300px; }
            table { font-size: 18px; border-collapse: collapse; width: 100%; }
            th, td { padding: 6px; border: 1px solid #333; text-align: left; }
        </style>
    </head>
    <body>
        ${content}
    </body>
    </html>
    `;
}

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
// MENU PRINCIPAL
// ============================
app.get("/", (req, res) => {
    const html = `
    <h1>🎲 Jeux de Société</h1>
    <ul>
        <li><a href="/joueurs">Les joueurs</a></li>
        <li><a href="/jeux/menu">Les jeux de société</a></li>
        <li><a href="/scores/ajouter">Donner un score</a></li>
        <li><a href="/meilleurs-jeux">Les meilleurs jeux</a></li>
        <li><a href="/pires-jeux">Les pires jeux</a></li>
        <li><a href="/filtrages">Filtrages</a></li>
    </ul>
    `;
    res.send(renderPage("Menu principal", html));
});

// ============================
// GESTION JOUEURS
// ============================
app.get("/joueurs", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        let html = `<h2>Gestion des joueurs</h2><ul>`;
        rows.forEach((row) => {
            const imgPath = path.join(__dirname, "public/images", `${row.nom}.jpg`);
            const imgSrc = fs.existsSync(imgPath) ? `/images/${row.nom}.jpg` : `/images/default.jpg`;
            html += `<li>${row.nom} <br><img src="${imgSrc}" width="150" alt="Image de ${row.nom}"></li>`;
        });
        html += `</ul>
                 <ul>
                    <li><a href="/joueurs/ajouter">Ajouter un joueur</a></li>
                    <li><a href="/joueurs/modifier">Modifier un joueur</a></li>
                    <li><a href="/joueurs/supprimer">Supprimer un joueur</a></li>
                 </ul>
                 <a href="/">⬅ Retour au menu</a>`;
        res.send(renderPage("Gestion des joueurs", html));
    });
});

app.get("/joueurs/ajouter", (req, res) => {
    const html = `
        <h2>Ajouter un joueur</h2>
        <form method="POST" action="/joueurs/ajouter">
            <label>Nom du joueur : <input type="text" name="nom" required></label>
            <button type="submit">Ajouter</button>
        </form>
        <a href='/joueurs'>⬅ Retour</a>
    `;
    res.send(renderPage("Ajouter un joueur", html));
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
        let html = `<h2>Modifier un joueur</h2>
                    <form method='POST' action='/joueurs/modifier'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => html += `<option value='${r.id}'>${r.nom}</option>`);
        html += `</select></label><br>
                 <label>Nouveau nom : <input type='text' name='nouveau_nom' required></label><br>
                 <button type='submit'>Modifier</button>
                 </form><a href='/joueurs'>⬅ Retour</a>`;
        res.send(renderPage("Modifier un joueur", html));
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
        let html = `<h2>Supprimer un joueur</h2>
                    <form method='POST' action='/joueurs/supprimer'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => html += `<option value='${r.id}'>${r.nom}</option>`);
        html += `</select></label><br>
                 <button type='submit'>Supprimer</button></form><a href='/joueurs'>⬅ Retour</a>`;
        res.send(renderPage("Supprimer un joueur", html));
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
    const html = `
        <h2>🎲 Jeux de société</h2>
        <ul>
            <li><a href="/jeux/liste">La liste des jeux</a></li>
            <li><a href="/jeux/gerer">Saisir / Modifier un jeu</a></li>
        </ul>
        <a href="/">⬅ Retour au menu</a>
    `;
    res.send(renderPage("Jeux de société", html));
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
        let html = `<h2>Liste des jeux</h2>
                    <table><tr>
                        <th>Nom</th><th>Extensions</th><th>Min joueurs</th><th>Max joueurs</th>
                        <th>Temps min</th><th>Temps max</th><th>Statut</th><th>Moyenne score</th>
                    </tr>`;
        rows.forEach(j => {
            html += `<tr>
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
        html += `</table><a href="/jeux/menu">⬅ Retour</a>`;
        res.send(renderPage("Liste des jeux", html));
    });
});

// ============================
// Gestion de /jeux/gerer POST et GET
// ============================
app.get("/jeux/gerer", (req,res) => {
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));
        let html = `<h2>Saisir ou modifier un jeu</h2>
                    <form method="POST" action="/jeux/gerer">
                    <label>Jeu :</label><select name="jeu_id"><option value="">-- Nouveau jeu --</option>`;
        jeux.forEach(j => html += `<option value="${j.id}">${j.nom}</option>`);
        html += `</select><br><br>
                 <label>Nom :</label><input type="text" name="nom" required><br>
                 <label>Extensions :</label><input type="text" name="extensions"><br>
                 <label>Min joueurs :</label><input type="number" name="min_joueurs"><br>
                 <label>Max joueurs :</label><input type="number" name="max_joueurs"><br>
                 <label>Temps min :</label><input type="number" name="temps_min"><br>
                 <label>Temps max :</label><input type="number" name="temps_max"><br>
                 <label>Statut :</label><input type="text" name="statut"><br><br>
                 <button type="submit" name="action" value="enregistrer">Enregistrer</button>
                 <button type="submit" name="action" value="supprimer">Supprimer</button>
                 </form><a href="/jeux/menu">⬅ Retour</a>`;
        res.send(renderPage("Saisir/Modifier un jeu", html));
    });
});

app.post("/jeux/gerer", (req,res) => {
    const { jeu_id, nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, action } = req.body;
    if(action==="enregistrer"){
        if(jeu_id){
            db.run("UPDATE jeux SET nom=?, extensions=?, min_joueurs=?, max_joueurs=?, temps_min=?, temps_max=?, statut=? WHERE id=?",
                   [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, jeu_id], err=>{
                       if(err) return res.send(renderPage("Erreur DB", err.message));
                       res.redirect("/jeux/gerer");
                   });
        }else{
            db.run("INSERT INTO jeux (nom, extensions,min_joueurs,max_joueurs,temps_min,temps_max,statut) VALUES (?,?,?,?,?,?,?,?)",
                   [nom, extensions,min_joueurs,max_joueurs,temps_min,temps_max,statut], err=>{
                       if(err) return res.send(renderPage("Erreur DB", err.message));
                       res.redirect("/jeux/gerer");
                   });
        }
    } else if(action==="supprimer"){
        if(!jeu_id) return res.send(renderPage("Erreur", "Veuillez sélectionner un jeu."));
        db.run("DELETE FROM jeux WHERE id=?", [jeu_id], err=>{
            if(err) return res.send(renderPage("Erreur DB", err.message));
            res.redirect("/jeux/gerer");
        });
    }
});

// ============================
// SCORES
// ============================
app.get("/scores/ajouter", (req,res)=>{
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux)=>{
        if(err) return res.send(renderPage("Erreur DB", err.message));
        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err2, joueurs)=>{
            if(err2) return res.send(renderPage("Erreur DB", err2.message));
            let html = `<h2>Donner un score</h2>
                        <form method="POST" action="/scores/ajouter">
                        <label>Jeu :</label><br><select name="jeu_id" required>`;
            jeux.forEach(j=>html+=`<option value="${j.id}">${j.nom}</option>`);
            html+=`</select><br><br>
                    <label>Joueur :</label><br>
                    <select name="joueur_id" id="joueurSelect" required>
                      <option value="">-- Choisir un joueur --</option>`;
            html+=`</select>
                   <div id="carteJoueur" style="margin-top:20px;"></div>
                   <br><label>Score :</label><br>
                   <input type="number" step="0.5" name="score" required><br><br>
                   <button type="submit">Enregistrer le score</button>
                   </form>
                   <a href="/">⬅ Retour</a>
                   <script>
                     const select = document.getElementById("joueurSelect");
                     const carteDiv = document.getElementById("carteJoueur");
                     select.addEventListener("change", ()=>{
                        const opt = select.options[select.selectedIndex];
                        const nom = opt.getAttribute("data-nom");
                        carteDiv.innerHTML = nom ? '<img src="/images/'+nom+'.jpg" alt="Carte '+nom+'" style="max-width:300px;border:1px solid #333;">' : '';
                     });
                   </script>`;
            res.send(renderPage("Donner un score", html));
        });
    });
});

app.post("/scores/ajouter", (req,res)=>{
    const { jeu_id, joueur_id, score } = req.body;
    if(!jeu_id||!joueur_id||!score) return res.send(renderPage("Erreur", "Veuillez remplir tous les champs."));
    db.run("INSERT INTO scores (jeu_id,joueur_id,score) VALUES (?,?,?)", [jeu_id,joueur_id,score], err=>{
        if(err) return res.send(renderPage("Erreur DB", err.message));
        res.send(renderPage("Score enregistré", `<p>✅ Score enregistré !</p><a href="/scores/ajouter">Ajouter un autre score</a><br><a href="/">⬅ Retour</a>`));
    });
});

// ============================
// MEILLEURS ET PIRES JEUX
// ============================
function topJeux(route, order){
    // Page pour choisir le joueur
    app.get(route, (req,res)=>{
        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err,joueurs)=>{
            if(err) return res.send(renderPage("Erreur DB", err.message));
            let html = `<h2>${route.includes("meilleurs")?"🏆 Meilleurs jeux":"💀 Pires jeux"}</h2>
                        <form method="GET" action="${route}/liste">
                        <label>Choisir un joueur : </label>
                        <select name="joueur_id">
                            <option value="">-- Tous les joueurs --</option>`;
            joueurs.forEach(j=>html+=`<option value="${j.id}">${j.nom}</option>`);
            html+=`</select>
                   <button type="submit">Voir Top 10</button>
                   </form>
                   <a href="/">⬅ Retour</a>`;
            res.send(renderPage(route.includes("meilleurs")?"Meilleurs jeux":"Pires jeux", html));
        });
    });

    // Page du Top 10
    app.get(route+"/liste",(req,res)=>{
        const joueur_id = req.query.joueur_id;
        let sql = `SELECT j.nom, AVG(s.score) AS moyenne FROM jeux j 
                   LEFT JOIN scores s ON j.id=s.jeu_id WHERE 1=1`;
        let params = [];
        if(joueur_id) { sql += " AND s.joueur_id=?"; params.push(joueur_id); }
        sql += " GROUP BY j.id ORDER BY moyenne "+order+" LIMIT 10";

        db.all(sql, params, (err, rows)=>{
            if(err) return res.send(renderPage("Erreur DB", err.message));

            if(joueur_id){
                // Si un joueur est choisi, récupérer son nom pour afficher sa carte
                db.get("SELECT nom FROM joueurs WHERE id=?", [joueur_id], (err2, row)=>{
                    if(err2 || !row) return res.send(renderPage("Top 10", "Erreur lors de la récupération du joueur"));
                    let nomJoueur = row.nom;
                    let html = `<h2>${route.includes("meilleurs")?"🏆 Top 10":"💀 Pire 10"} - ${nomJoueur}</h2>
                                <img src="/images/${nomJoueur}.jpg" alt="Carte ${nomJoueur}" style="max-width:300px;border:1px solid #333;margin-bottom:20px;">
                                <table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
                    rows.forEach(r=>html+=`<tr><td>${r.nom}</td><td>${r.moyenne!=null?r.moyenne.toFixed(1):"–"}</td></tr>`);
                    html += `</table><a href="${route}">⬅ Retour</a>`;
                    res.send(renderPage("Top 10", html));
                });
            } else {
                // Si aucun joueur sélectionné
                let html = `<h2>${route.includes("meilleurs")?"🏆 Top 10":"💀 Pire 10"} - Tous les joueurs</h2>
                            <table border="1" cellpadding="5"><tr><th>Jeu</th><th>Moyenne</th></tr>`;
                rows.forEach(r=>html+=`<tr><td>${r.nom}</td><td>${r.moyenne!=null?r.moyenne.toFixed(1):"–"}</td></tr>`);
                html += `</table><a href="${route}">⬅ Retour</a>`;
                res.send(renderPage("Top 10", html));
            }
        });
    });
}

topJeux("/meilleurs-jeux", "DESC");
topJeux("/pires-jeux", "ASC");


// ============================
// FILTRAGES
// ============================
app.get("/filtrages", (req,res)=>{
    const html = `
    <h2>Filtrages des jeux</h2>
    <form method="GET" action="/filtrages/liste">
        <label>Nombre de joueurs : <input type="number" name="joueurs"></label><br>
        <label>Temps maximum (minutes) : <input type="number" name="temps"></label><br>
        <label>Score minimum : <input type="number" step="0.5" name="score_min"></label><br><br>
        <button type="submit">Filtrer</button>
    </form>
    <a href="/">⬅ Retour</a>
    `;
    res.send(renderPage("Filtrages des jeux", html));
});

app.get("/filtrages/liste", (req,res)=>{
    const joueurs = parseInt(req.query.joueurs)||0;
    const temps = parseInt(req.query.temps)||0;
    const score_min = parseFloat(req.query.score_min)||0;

    let sql = `SELECT j.nom, j.min_joueurs,j.max_joueurs,j.temps_min,j.temps_max,ROUND(AVG(s.score),2) AS score_moyen
               FROM jeux j LEFT JOIN scores s ON j.id=s.jeu_id`;
    const params=[];
    const conditions=[];
    if(joueurs>0) { conditions.push("j.min_joueurs<=? AND j.max_joueurs>=?"); params.push(joueurs,joueurs); }
    if(temps>0) { conditions.push("j.temps_max<=?"); params.push(temps); }
    if(conditions.length>0) sql+=" WHERE "+conditions.join(" AND ");
    sql+=" GROUP BY j.id";
    if(score_min>0) { sql+=" HAVING score_moyen>=?"; params.push(score_min); }
    sql+=" ORDER BY j.nom COLLATE NOCASE";

    db.all(sql,params,(err,rows)=>{
        if(err) return res.send(renderPage("Erreur DB", err.message));
        if(rows.length===0) return res.send(renderPage("Filtrages", "Aucun jeu trouvé avec ces critères.<br><a href='/filtrages'>⬅ Retour</a>"));

        let html = "<h2>Jeux filtrés</h2><ul>";
        rows.forEach(j=>{
            html+=`<li>${j.nom} - Joueurs : ${j.min_joueurs}-${j.max_joueurs}, Temps : ${j.temps_min}-${j.temps_max} min, Score moyen : ${j.score_moyen||0}</li>`;
        });
        html+="</ul><a href='/filtrages'>⬅ Retour</a>";
        res.send(renderPage("Jeux filtrés", html));
    });
});


// ============================
// SERVEUR
// ============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
