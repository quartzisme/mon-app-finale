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
// MENU PRINCIPAL
// ============================
app.get("/", (req, res) => {
    let html = `
    <h1>🎲 Jeux de Société</h1>
    <ul>
        <li><a href="/joueurs">1) Les joueurs</a></li>
        <li><a href="/jeux/menu">2) Les jeux de société</a></li>
        <li><a href="/scores/ajouter">3) Donner un score</a></li>
        <li><a href="/meilleurs-jeux">4) Les meilleurs jeux</a></li>
        <li><a href="/pires-jeux">5) Les pires jeux</a></li>
        <li><a href="/filtrages">6) Filtrages</a></li>
    </ul>
    `;
    res.send(html);
});

// ============================
// GESTION JOUEURS
// ============================
app.get("/joueurs", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send("Erreur DB : " + err.message);

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
        res.send(html);
    });
});

app.get("/joueurs/ajouter", (req, res) => {
    res.send(`
        <h2>Ajouter un joueur</h2>
        <form method="POST" action="/joueurs/ajouter">
            <label>Nom du joueur : <input type="text" name="nom" required></label>
            <button type="submit">Ajouter</button>
        </form>
        <a href='/joueurs'>⬅ Retour</a>
    `);
});

app.post("/joueurs/ajouter", (req, res) => {
    const nom = req.body.nom.trim();
    if (!nom) return res.send("Nom vide ! <a href='/joueurs/ajouter'>Réessayer</a>");
    db.run("INSERT INTO joueurs (nom) VALUES (?)", [nom], function(err) {
        if (err) return res.send("Erreur DB : " + err.message);
        res.redirect("/joueurs");
    });
});

app.get("/joueurs/modifier", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send("Erreur DB : " + err.message);
        let html = `<h2>Modifier un joueur</h2>
                    <form method='POST' action='/joueurs/modifier'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => html += `<option value='${r.id}'>${r.nom}</option>`);
        html += `</select></label><br>
                 <label>Nouveau nom : <input type='text' name='nouveau_nom' required></label><br>
                 <button type='submit'>Modifier</button>
                 </form><a href='/joueurs'>⬅ Retour</a>`;
        res.send(html);
    });
});

app.post("/joueurs/modifier", (req, res) => {
    const id = req.body.id;
    const nouveau_nom = req.body.nouveau_nom.trim();
    if (!nouveau_nom) return res.send("Nom vide ! <a href='/joueurs/modifier'>Réessayer</a>");
    db.run("UPDATE joueurs SET nom=? WHERE id=?", [nouveau_nom, id], err => {
        if (err) return res.send("Erreur DB : " + err.message);
        res.redirect("/joueurs");
    });
});

app.get("/joueurs/supprimer", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send("Erreur DB : " + err.message);
        let html = `<h2>Supprimer un joueur</h2>
                    <form method='POST' action='/joueurs/supprimer'>
                        <label>Choisir le joueur :
                            <select name='id'>`;
        rows.forEach(r => html += `<option value='${r.id}'>${r.nom}</option>`);
        html += `</select></label><br>
                 <button type='submit'>Supprimer</button></form><a href='/joueurs'>⬅ Retour</a>`;
        res.send(html);
    });
});

app.post("/joueurs/supprimer", (req, res) => {
    db.run("DELETE FROM joueurs WHERE id=?", [req.body.id], err => {
        if (err) return res.send("Erreur DB : " + err.message);
        res.redirect("/joueurs");
    });
});

// ============================
// GESTION JEUX
// ============================
app.get("/jeux/menu", (req, res) => {
    res.send(`
        <h2>🎲 Jeux de société</h2>
        <ul>
            <li><a href="/jeux/liste">La liste des jeux</a></li>
            <li><a href="/jeux/gerer">Saisir / Modifier un jeu</a></li>
        </ul>
        <a href="/">⬅ Retour au menu</a>
    `);
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
        if(err) return res.send("Erreur DB : " + err.message);
        let html = `<h2>Liste des jeux</h2>
                    <table border="1" cellpadding="5"><tr>
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
        res.send(html);
    });
});

app.get("/jeux/gerer", (req,res) => {
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux) => {
        if(err) return res.send("Erreur DB : " + err.message);
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
        res.send(html);
    });
});

app.post("/jeux/gerer", (req,res) => {
    const { jeu_id, nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, action } = req.body;
    if(action==="enregistrer"){
        if(jeu_id){
            db.run("UPDATE jeux SET nom=?, extensions=?, min_joueurs=?, max_joueurs=?, temps_min=?, temps_max=?, statut=? WHERE id=?",
                   [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, jeu_id], err=>{
                       if(err) return res.send("Erreur DB : "+err.message);
                       res.redirect("/jeux/gerer");
                   });
        }else{
            db.run("INSERT INTO jeux (nom, extensions,min_joueurs,max_joueurs,temps_min,temps_max,statut) VALUES (?,?,?,?,?,?,?)",
                   [nom, extensions,min_joueurs,max_joueurs,temps_min,temps_max,statut], err=>{
                       if(err) return res.send("Erreur DB : "+err.message);
                       res.redirect("/jeux/gerer");
                   });
        }
    } else if(action==="supprimer"){
        if(!jeu_id) return res.send("Veuillez sélectionner un jeu.");
        db.run("DELETE FROM jeux WHERE id=?", [jeu_id], err=>{
            if(err) return res.send("Erreur DB : "+err.message);
            res.redirect("/jeux/gerer");
        });
    }
});

// ============================
// SCORES
// ============================
app.get("/scores/ajouter", (req,res)=>{
    db.all("SELECT id, nom FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux)=>{
        if(err) return res.send("Erreur DB : "+err.message);
        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err2, joueurs)=>{
            if(err2) return res.send("Erreur DB : "+err2.message);
            let html = `<h2>Donner un score</h2>
                        <form method="POST" action="/scores/ajouter">
                        <label>Jeu :</label><br><select name="jeu_id" required>`;
            jeux.forEach(j=>html+=`<option value="${j.id}">${j.nom}</option>`);
            html+=`</select><br><br>
                    <label>Joueur :</label><br>
                    <select name="joueur_id" id="joueurSelect" required>
                      <option value="">-- Choisir un joueur --</option>`;
            joueurs.forEach(j=>html+=`<option value="${j.id}" data-nom="${j.nom}">${j.nom}</option>`);
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
            res.send(html);
        });
    });
});

app.post("/scores/ajouter", (req,res)=>{
    const { jeu_id, joueur_id, score } = req.body;
    if(!jeu_id||!joueur_id||!score) return res.send("Veuillez remplir tous les champs.");
    db.run("INSERT INTO scores (jeu_id,joueur_id,score) VALUES (?,?,?)", [jeu_id,joueur_id,score], err=>{
        if(err) return res.send("Erreur DB : "+err.message);
        res.send(`<p>✅ Score enregistré !</p><a href="/scores/ajouter">Ajouter un autre score</a><br><a href="/">⬅ Retour</a>`);
    });
});

// ============================
// MEILLEURS ET PIRES JEUX
// ============================
function topJeux(route, order){
    app.get(route, (req,res)=>{
        db.all("SELECT id, nom FROM joueurs ORDER BY nom COLLATE NOCASE", [], (err,joueurs)=>{
            if(err) return res.send("Erreur DB : "+err.message);
            let html = `<h2>${route.includes("meilleurs")?"🏆 Meilleurs jeux":"💀 Pires jeux"}</h2>
                        <form method="GET" action="${route}/liste">
                        <label>Choisir un joueur : </label>
                        <select name="joueur_id">
                            <option value="">-- Tous les joueurs --</option>`;
            joueurs.forEach(j=>html+=`<option value="${j.id}">${j.nom}</option>`);
            html+=`</select><button type="submit">Voir Top 10</button></form>
                   <a href="/">⬅ Retour</a>`;
            res.send(html);
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
            if(err) return res.send("Erreur DB : "+err.message);
            let html = `<h2>${route.includes("meilleurs")?"🏆 Top 10":"💀 Bottom 10"} - ${joueur_id?"Joueur sélectionné":"Tous les joueurs"}</h2><ol>`;
            rows.forEach(r=>html+=`<li>${r.nom_jeu} - Score moyen : ${r.score_moyen!=null?r.score_moyen.toFixed(1):0}</li>`);
            html+=`</ol><a href="${route}">⬅ Retour</a>`;
            res.send(html);
        });
    });
}
topJeux("/meilleurs-jeux","DESC");
topJeux("/pires-jeux","ASC");

// ============================
// FILTRAGES
// ============================
app.get("/filtrages",(req,res)=>{
    res.send(`
    <h2>Filtrages des jeux</h2>
    <form method="GET" action="/filtrages/liste">
        <label>Nombre de joueurs : <input type="number" name="joueurs"></label><br>
        <label>Temps maximum (minutes) : <input type="number" name="temps"></label><br>
        <label>Score minimum : <input type="number" step="0.5" name="score_min"></label><br><br>
        <button type="submit">Filtrer</button>
    </form>
    <a href="/">⬅ Retour</a>
    `);
});

app.get("/filtrages/liste",(req,res)=>{
    const joueurs = parseInt(req.query.joueurs)||0;
    const temps = parseInt(req.query.temps)||0;
    const score_min = parseFloat(req.query.score_min)||0;

    let sql = `SELECT j.nom, j.min_joueurs,j.max_joueurs,j.temps_min,j.temps_max,ROUND(AVG(s.score),2) AS score_moyen
               FROM jeux j LEFT JOIN scores s ON j.id=s.jeu_id`;
    const params=[];
    const conditions=[];
    if(joueurs>0) conditions.push("j.min_joueurs<=? AND j.max_joueurs>=?"), params.push(joueurs,joueurs);
    if(temps>0) conditions.push("j.temps_max<=?"), params.push(temps);
    if(conditions.length>0) sql+=" WHERE "+conditions.join(" AND ");
    sql+=" GROUP BY j.id";
    if(score_min>0) sql+=" HAVING score_moyen>=?";
    if(score_min>0) params.push(score_min);
    sql+=" ORDER BY j.nom COLLATE NOCASE";

    db.all(sql,params,(err,rows)=>{
        if(err) return res.send("Erreur DB : "+err.message);
        if(rows.length===0) return res.send("Aucun jeu trouvé avec ces critères.<br><a href='/filtrages'>⬅ Retour</a>");
        let html = "<h2>Jeux filtrés</h2><ul>";
        rows.forEach(j=>html+=`<li>${j.nom} - Joueurs : ${j.min_joueurs}-${j.max_joueurs}, Temps : ${j.temps_min}-${j.temps_max} min, Score moyen : ${j.score_moyen||0}</li>`);
        html+="</ul><a href='/filtrages'>⬅ Retour</a>";
        res.send(html);
    });
});

// ============================
// SERVER
// ============================
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://0.0.0.0:${PORT}`);
});