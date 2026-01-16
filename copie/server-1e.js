const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcrypt"); // pour hash des mots de passe

const app = express();

// ============================
// MIDDLEWARES
// ============================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "public/images")));

// Sessions pour login
app.use(session({
    secret: process.env.SESSION_SECRET || "changeme", // à mettre dans .env sur Render
    resave: false,
    saveUninitialized: false
}));

// ============================
// DATABASE
// ============================
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, err => {
    if (err) console.error("Erreur ouverture DB :", err.message);
    else console.log("DB connectée :", dbPath);
});

// ============================
// CREATE TABLES USERS SI NON EXISTE
// ============================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Ajouter Marc et Vincent si n'existent pas
    const users = [
        { username: "Marc", password: "tonmdpMarc" },
        { username: "Vincent", password: "tonmdpVincent" }
    ];

    users.forEach(u => {
        db.get("SELECT * FROM users WHERE username=?", [u.username], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(u.password, 10);
                db.run("INSERT INTO users (username, password) VALUES (?,?)", [u.username, hash]);
                console.log(`Utilisateur ${u.username} créé`);
            }
        });
    });
});

// ============================
// PAGE DE LOGIN
// ============================
app.get("/login", (req, res) => {
    const html = `
    <h2>Connexion</h2>
    <form method="POST" action="/login">
        <label>Nom d'utilisateur : <input type="text" name="username" required></label><br><br>
        <label>Mot de passe : <input type="password" name="password" required></label><br><br>
        <button type="submit">Se connecter</button>
    </form>
    `;
    res.send(html);
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username=?", [username], (err, user) => {
        if (err) return res.send("Erreur DB");
        if (!user) return res.send("Identifiant ou mot de passe incorrect");

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, username: user.username };
            res.redirect("/menu");
        } else {
            res.send("Identifiant ou mot de passe incorrect");
        }
    });
});

// ============================
// MIDDLEWARE PROTECTION ROUTES
// ============================
function auth(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}

// ============================
// ROUTE DE DÉCONNEXION
// ============================
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// ============================
// ROUTES PRINCIPALES (PROTÉGÉES)
// ============================
app.get("/", auth, (req, res) => {
    res.redirect("/menu");
});

app.get("/menu", auth, (req, res) => {
    const html = `
    <h1>Menu principal</h1>
    <p>Bienvenue, ${req.session.user.username} !</p>
    <ul>
        <li><a href="/joueurs">Les joueurs</a></li>
        <li><a href="/jeux/menu">Les jeux</a></li>
        <li><a href="/scores/ajouter">Donner un score</a></li>
    </ul>
    <a href="/logout">Se déconnecter</a>
    `;
    res.send(html);
});



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

    db.run(`CREATE TABLE IF NOT EXISTS competitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        objectif INTEGER NOT NULL,
        terminee INTEGER DEFAULT 0
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS competition_joueurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER,
        joueur_id INTEGER
    );`);

   db.run(`CREATE TABLE IF NOT EXISTS competition_resultats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER,
        jeu_id INTEGER,
        joueur_id INTEGER,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);

});

app.get("/", (req, res) => {
    const html = `
    <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        height:90vh;
        text-align:center;
    ">
        <img src="/images/de.jpg" style="max-width:200px; margin-bottom:20px;">
        <h1>Jeux de société</h1>

        <a href="/menu">
            <button style="
                font-size:20px;
                padding:12px 30px;
                border-radius:10px;
                background:#2c7be5;
                color:white;
                border:none;
            ">
                GO !
            </button>
        </a>
    </div>
    `;
    res.send(renderPage("Bienvenue", html));
});


// ============================
// MENU PRINCIPAL
// ============================
app.get("/menu", (req, res) => {
    const html = `
    <h1>🎲 Jeux de Société</h1>
    <ul>
        <li><a href="/joueurs">👥 Les joueurs</a></li>
        <li><a href="/jeux/menu">⚔️ Les jeux de société</a></li>
        <li><a href="/scores/ajouter">📊 Donner un score</a></li>
        <li><a href="/meilleurs-jeux">🥇 Les meilleurs jeux</a></li>
        <li><a href="/pires-jeux">💀 Les pires jeux</a></li>
        <li><a href="/filtrages">🔍 Filtrages</a></li>
        <li><a href="/competitions">🏆 Compétitions</a></li>
    </ul>
    `;
    res.send(renderPage("Menu", html));
});

// ============================
// GESTION JOUEURS
// ============================
app.get("/joueurs", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        // 1️⃣ Les liens Ajouter / Modifier / Supprimer
        let html = `<h2>👥 Gestion des joueurs</h2>
                    <ul>
                        <li><a href="/joueurs/ajouter">Ajouter un joueur</a></li>
                        <li><a href="/joueurs/modifier">Modifier un joueur</a></li>
                        <li><a href="/joueurs/supprimer">Supprimer un joueur</a></li>
                    </ul>`;

        // 2️⃣ Affichage des cartes de tous les joueurs
        if (rows.length > 0) {
            html += `<h3>Voici les joueurs inscrits :</h3>
                     <div style="display:flex; flex-wrap:wrap; gap:20px;">`;

        rows.forEach((row) => {
            const imgPath = path.join(__dirname, "public/images", `${row.nom}.jpg`);
            const imgSrc = fs.existsSync(imgPath) ? `/images/${row.nom}.jpg` : `/images/default.jpg`;

            const etoiles = row.etoiles || 0;
            let etoilesHtml = "";
            for (let i = 0; i < etoiles; i++) {
                etoilesHtml += "⭐";
            }

    html += `<div style="text-align:center; width:170px;">
                <img src="${imgSrc}" width="150"
                     alt="Image de ${row.nom}"
                     style="border:1px solid #333; border-radius:8px;">
                <div style="font-weight:bold;">${row.nom}</div>
                <div style="color:gold; font-size:18px; min-height:22px;">
                    ${etoilesHtml}
                </div>
             </div>`;
});


            html += `</div>`;
        } else {
            html += `<p>Aucun joueur inscrit pour le moment.</p>`;
        }

        // 3️⃣ Bouton retour
        html += `<br><a href="/menu">⬅ Retour au menu</a>`;

        res.send(renderPage("Gestion des joueurs", html));
    });
});


app.get("/joueurs/ajouter", (req, res) => {
    const html = `
        <h2>Ajouter un joueur</h2>
        <form method="POST" action="/joueurs/ajouter" enctype="multipart/form-data">
            <label>Nom du joueur : <input type="text" name="nom" required></label><br>
            <label>Photo (optionnelle) : <input type="file" name="image" accept="image/*"></label><br><br>
            <button type="submit">Ajouter</button>
        </form>
        <a href='/joueurs'>⬅ Retour</a>
    `;
    res.send(renderPage("Ajouter un joueur", html));
});

app.post("/joueurs/ajouter", upload.single("image"), (req, res) => {
    const nom = req.body.nom.trim();
    if (!nom) return res.send(renderPage("Erreur", "Nom vide ! <a href='/joueurs/ajouter'>Réessayer</a>"));

    db.run("INSERT INTO joueurs (nom) VALUES (?)", [nom], function(err) {
        if (err) return res.send(renderPage("Erreur DB", err.message));
        // L'image a déjà été enregistrée dans public/images grâce à multer
        res.send(renderPage("Joueur ajouté", `<p>✅ Joueur ${nom} ajouté avec succès !</p><a href="/joueurs">⬅ Retour</a>`));
    });
});


app.get("/joueurs/modifier", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY id", [], (err, rows) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        let html = `<h2>Modifier un joueur</h2>
                    <form method='POST' action='/joueurs/modifier'>
                    <label>Choisir le joueur :
                    <select name='id'>
                    <option value="">-- Choisir --</option>`;

        rows.forEach(r => {
            html += `<option value='${r.id}'>${r.nom}</option>`;
        });

        html += `</select></label><br>
                 <label>Nouveau nom : <input type='text' name='nouveau_nom' required></label><br>
                 <button type='submit'>Modifier</button>
                 </form>
                 <a href='/joueurs'>⬅ Retour</a>`;

        res.send(renderPage("Modifier un joueur", html));
    });
});

app.post("/joueurs/modifier", upload.single("image"), (req, res) => {
    const id = req.body.id;
    const nouveau_nom = req.body.nouveau_nom.trim();
    if (!nouveau_nom) return res.send(renderPage("Erreur", "Nom vide ! <a href='/joueurs/modifier'>Réessayer</a>"));

    db.run("UPDATE joueurs SET nom=? WHERE id=?", [nouveau_nom, id], err => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        // Si une image a été uploadée, elle est déjà dans public/images
        res.send(renderPage("Joueur modifié", `<p>✅ Joueur modifié avec succès !</p><a href="/joueurs">⬅ Retour</a>`));
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
            <li><a href="/jeux/liste">📋 Liste des jeux</a></li>
            <li><a href="/jeux/creer">➕ Créer un nouveau jeu</a></li>
            <li><a href="/jeux/gerer">✏️ Modifier / Supprimer un jeu</a></li>
        </ul>
        <a href="/menu">⬅ Retour au menu</a>
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
// Gestion de /jeux/creer
// ============================
app.get("/jeux/creer", (req, res) => {
    const html = `
        <h2>➕ Créer un nouveau jeu</h2>
        <form method="POST" action="/jeux/creer">
            <label>Nom :</label><input type="text" name="nom" required><br>
            <label>Extensions :</label><input type="text" name="extensions"><br>
            <label>Min joueurs :</label><input type="number" name="min_joueurs"><br>
            <label>Max joueurs :</label><input type="number" name="max_joueurs"><br>
            <label>Temps min :</label><input type="number" name="temps_min"><br>
            <label>Temps max :</label><input type="number" name="temps_max"><br>
            <label>Statut :</label><input type="text" name="statut"><br><br>
            <button type="submit">Créer le jeu</button>
        </form>
        <a href="/jeux/menu">⬅ Retour</a>
    `;
    res.send(renderPage("Créer un jeu", html));
});

app.post("/jeux/creer", (req, res) => {
    const { nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut } = req.body;

    db.run(
        "INSERT INTO jeux (nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut) VALUES (?,?,?,?,?,?,?)",
        [nom, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut],
        err => {
            if (err) return res.send(renderPage("Erreur DB", err.message));

            res.send(renderPage(
                "Jeu créé",
                `<p>✅ Le jeu <strong>${nom}</strong> a été créé.</p>
                 <a href="/jeux/menu">⬅ Retour</a>`
            ));
        }
    );
});


// ============================
// Gestion de /jeux/gerer POST et GET
// ============================
app.get("/jeux/gerer", (req, res) => {
    db.all("SELECT * FROM jeux ORDER BY nom COLLATE NOCASE", [], (err, jeux) => {
        if (err) return res.send(renderPage("Erreur DB", err.message));

        let message = "";
        if (req.query.ok) {
            message = `<p style="color:green; font-weight:bold;">✅ La modification a été effectuée</p>`;
        }
//  JEU SÉLECTIONNÉ
        const jeu = jeux.find(j => j.id == req.query.jeu_id);
                
        let html = `
            <h2>✏️ Modifier / Supprimer un jeu</h2>
            ${message}

            <form method="GET" action="/jeux/gerer">
            <label>Choisir un jeu :</label>
            <select name="jeu_id" onchange="this.form.submit()">
                <option value="">-- Sélectionner --</option>`;

        jeux.forEach(j => {
            html += `<option value="${j.id}" ${req.query.jeu_id == j.id ? "selected" : ""}>${j.nom}</option>`;
        });

        html += `</select></form><br>`;


        if (jeu) {
            html += `
            <form method="POST" action="/jeux/gerer">
                <input type="hidden" name="jeu_id" value="${jeu.id}">
                <p><strong>${jeu.nom}</strong></p>
                <label>Extensions :</label><input type="text" name="extensions" value="${jeu.extensions||""}"><br>
                <label>Min joueurs :</label><input type="number" name="min_joueurs" value="${jeu.min_joueurs||""}"><br>
                <label>Max joueurs :</label><input type="number" name="max_joueurs" value="${jeu.max_joueurs||""}"><br>
                <label>Temps min :</label><input type="number" name="temps_min" value="${jeu.temps_min||""}"><br>
                <label>Temps max :</label><input type="number" name="temps_max" value="${jeu.temps_max||""}"><br>
                <label>Statut :</label><input type="text" name="statut" value="${jeu.statut||""}"><br><br>
                <button name="action" value="modifier">💾 Enregistrer</button>
                <button name="action" value="supprimer" onclick="return confirm('Supprimer ce jeu ?')">🗑️ Supprimer</button>
            </form>`;
        }

        html += `<br><a href="/jeux/menu">⬅ Retour</a>`;
        res.send(renderPage("Modifier un jeu", html));
    });
});
app.post("/jeux/gerer", (req, res) => {
    const { jeu_id, extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, action } = req.body;

    if (action === "modifier") {
        db.run(
            "UPDATE jeux SET extensions=?, min_joueurs=?, max_joueurs=?, temps_min=?, temps_max=?, statut=? WHERE id=?",
            [extensions, min_joueurs, max_joueurs, temps_min, temps_max, statut, jeu_id],
            err => {
                if (err) return res.send(renderPage("Erreur DB", err.message));
                res.redirect("/jeux/gerer?jeu_id=" + jeu_id + "&ok=1");
            }
        );
    }

    if (action === "supprimer") {
        db.run("DELETE FROM jeux WHERE id=?", [jeu_id], err => {
            if (err) return res.send(renderPage("Erreur DB", err.message));
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

            let html = `<h2>📊 Donner un score</h2>
                        <form method="POST" action="/scores/ajouter">
                        <label>Jeu :</label><br>
                        <select name="jeu_id" required>
                            <option value="">-- Tous les jeux --</option>`;  // <-- Option par défaut

            jeux.forEach(j=>html+=`<option value="${j.id}">${j.nom}</option>`);
            html+=`</select><br><br>
                   <label>Joueur :</label><br>
                   <select name="joueur_id" id="joueurSelect" required>
                      <option value="">-- Choisir un joueur --</option>`;  // <-- Option par défaut
            joueurs.forEach(j=>html+=`<option value="${j.id}" data-nom="${j.nom}">${j.nom}</option>`); // <-- Ajout des joueurs
            html+=`</select>
                   <div id="carteJoueur" style="margin-top:20px;"></div>
                   <br><label>Score :</label><br>
                   <input type="number" step="0.5" name="score" required><br><br>
                   <button type="submit">Enregistrer le score</button>
                   </form>
                   <a href="/menu">⬅ Retour</a>
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
    if(!jeu_id || !joueur_id || !score) 
        return res.send(renderPage("Erreur", "Veuillez remplir tous les champs."));

    db.run("INSERT INTO scores (jeu_id,joueur_id,score) VALUES (?,?,?)", [jeu_id,joueur_id,score], err=>{
        if(err) return res.send(renderPage("Erreur DB", err.message));
        res.send(renderPage("Score enregistré", `<p>✅ Score enregistré !</p><a href="/scores/ajouter">Ajouter un autre score</a><br><a href="/menu">⬅ Retour</a>`));
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
                   <a href="/menu">⬅ Retour</a>`;
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
    <h2>🔍 Filtrages des jeux</h2>
    <form method="GET" action="/filtrages/liste">
        <label>👤 Nombre de joueurs : <input type="number" name="joueurs"></label><br>
        <label>⏳ Temps maximum (minutes) : <input type="number" name="temps"></label><br>
        <label>🔢 Score minimum : <input type="number" step="0.5" name="score_min"></label><br><br>
        <button type="submit">Filtrer</button>
    </form>
    <a href="/menu">⬅ Retour</a>
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
// COMPETITIONS
// ============================
app.get("/competitions", (req,res)=>{
    const html = `
    <h2>🏆 Compétitions</h2>
    <ul>
      <li><a href="/competitions/creer">Créer une compétition</a></li>
      <li><a href="/competitions/modifier">Modifier / suivre une compétition</a></li>
      <li><a href="/competitions/supprimer">Supprimer une compétition</a></li>
    </ul>
    <a href="/menu">⬅ Retour</a>
    `;
    res.send(renderPage("Compétitions", html));
});

app.get("/competitions/creer", (req, res) => {
    db.all("SELECT * FROM joueurs ORDER BY nom", [], (err, joueurs) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));

        let html = `<h2>Créer une compétition</h2>
        <form method="POST" action="/competitions/creer">
        Nom de la compétition : <input name="nom" required><br>
        Objectif (victoires) : <input type="number" name="objectif" value="5"><br><br>
        <h3>Joueurs</h3>`;

        joueurs.forEach(j => {
            html += `<label><input type="checkbox" name="joueurs" value="${j.id}"> ${j.nom}</label><br>`;
        });

        html += `<br><button type="submit">Créer</button></form>
        <a href="/competitions">⬅ Retour</a>`;

        res.send(renderPage("Créer compétition", html));
    });
});

app.post("/competitions/creer", (req, res) => {
    const { nom, objectif } = req.body;
    let joueurs = req.body.joueurs || [];
    if(!Array.isArray(joueurs)) joueurs = [joueurs];

    db.run("INSERT INTO competitions (nom, objectif) VALUES (?,?)", [nom, objectif], function(err){
        if(err) return res.send(renderPage("Erreur DB", err.message));

        const competition_id = this.lastID;

        joueurs.forEach(j => {
            db.run(
              "INSERT INTO competition_joueurs (competition_id,joueur_id) VALUES (?,?)",
              [competition_id, j],
              err => { if(err) console.log("Erreur compétition_joueurs:", err.message); }
            );
        });

        res.redirect("/competitions");
    });
});

// ============================
// MODIFIER / SUIVRE UNE COMPÉTITION
// ============================

// Affichage de la liste des compétitions et choix de suivre/modifier
app.get("/competitions/modifier", (req, res) => {
    db.all("SELECT * FROM competitions ORDER BY nom", [], (err, competitions) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));

        if(competitions.length === 0){
            return res.send(renderPage("Compétitions",
                "<p>Aucune compétition active.</p><a href='/competitions'>⬅ Retour</a>"
            ));
        }

        let html = `<h2>Compétitions actives</h2>`;

        let pending = competitions.length;

        competitions.forEach(c => {
            db.all(`
                SELECT j.nom, cj.victoires
                FROM competition_joueurs cj
                JOIN joueurs j ON j.id = cj.joueur_id
                WHERE cj.competition_id = ?
                ORDER BY j.nom
            `,[c.id],(err,joueurs)=>{

                html += `<div style="border:1px solid #ccc; padding:10px; margin-bottom:15px;">
                            <h3>${c.nom}</h3>
                            <p>Objectif : ${c.objectif} victoire(s)</p>`;

                joueurs.forEach(j=>{
                    html += `<strong>${j.nom}</strong>
                             <div style="display:flex; gap:4px; margin-bottom:6px;">`;

                    for(let i=1;i<=c.objectif;i++){
                        if(i <= j.victoires){
                            html += `<div style="width:18px; height:18px; background:green;"></div>`;
                        } else {
                            html += `<div style="width:18px; height:18px; border:1px solid #aaa;"></div>`;
                        }
                    }

                    html += `</div>`;
                });

                html += `<a href="/competitions/suivre?competition_id=${c.id}">
                            ➜ Suivre / Modifier
                         </a>
                         </div>`;

                pending--;
                if(pending === 0){
                    html += `<a href="/competitions">⬅ Retour</a>`;
                    res.send(renderPage("Compétitions", html));
                }
            });
        });
    });
});


// Affichage d'une compétition spécifique avec barres de progression pour les victoires
app.get("/competitions/suivre", (req,res) => {
    const competition_id = req.query.competition_id;
    if(!competition_id) return res.redirect("/competitions/modifier");

    // Récupérer compétition et joueurs
    db.get("SELECT * FROM competitions WHERE id=?", [competition_id], (err, competition) => {
        if(err) return res.send(renderPage("Erreur DB", err.message));
        if(!competition) return res.send(renderPage("Erreur", "Compétition introuvable"));

        db.all(`
            SELECT j.id, j.nom, cj.victoires
            FROM competition_joueurs cj
            JOIN joueurs j ON j.id = cj.joueur_id
            WHERE cj.competition_id=?
            ORDER BY j.nom
        `, [competition_id], (err, joueurs) => {
            if(err) return res.send(renderPage("Erreur DB", err.message));

            let html = `<h2>Suivi de la compétition : ${competition.nom}</h2>
                        <p>Objectif : ${competition.objectif} victoire(s)</p>
                        <form method="POST" action="/competitions/enregistrer_victoires">
                        <input type="hidden" name="competition_id" value="${competition.id}">`;

            joueurs.forEach(j => {
                html += `<h4>${j.nom}</h4>
                         <div style="display:flex; gap:3px; margin-bottom:10px;">`;

                for(let i=1;i<=competition.objectif;i++){
                    if(i <= j.victoires){
                        html += `<div style="width:20px; height:20px; background-color:green;"></div>`;
                    } else {
                        html += `<div style="width:20px; height:20px; border:1px solid #ccc;"></div>`;
                    }
                }

                html += `</div>
                         <label>Victoires : 
                            <input type="number" name="victoires_${j.id}" value="${j.victoires}" min="0" max="${competition.objectif}">
                         </label><br><br>`;
            });

            html += `<button type="submit">Enregistrer les victoires</button>
                     </form>
                     <a href="/competitions/modifier">⬅ Retour</a>`;

            res.send(renderPage(`Suivi ${competition.nom}`, html));
        });
    });
});

// Enregistrer les victoires pour une compétition
app.post("/competitions/enregistrer_victoires", (req,res) => {
    const competition_id = req.body.competition_id;

    Object.keys(req.body).forEach(key => {
        if(key.startsWith("victoires_")){
            const joueur_id = key.split("_")[1];
            const victoires = parseInt(req.body[key]) || 0;

            db.run("UPDATE competition_joueurs SET victoires=? WHERE competition_id=? AND joueur_id=?",
                   [victoires, competition_id, joueur_id]);
        }
    });

    res.redirect(`/competitions/suivre?competition_id=${competition_id}`);
});

app.get("/competitions/supprimer", (req, res) => {
    db.all("SELECT * FROM competitions ORDER BY nom", [], (err, comps) => {
        if (err) return res.send(err.message);

        let html = `<h2>Terminer une compétition</h2>
        <form method="GET" action="/competitions/supprimer/voir">
        <label>Choisir la compétition :</label>
        <select name="id" required>
        <option value="">-- Choisir --</option>`;

        comps.forEach(c => {
            html += `<option value="${c.id}">${c.nom}</option>`;
        });

        html += `</select>
        <button type="submit">Voir</button>
        </form>
        <a href="/competitions">⬅ Retour</a>`;

        res.send(renderPage("Terminer une compétition", html));
    });
});


app.post("/competitions/supprimer", (req, res) => {
    const id = req.body.id;
    if (!id) return res.redirect("/competitions/supprimer");

    // 1️⃣ Récupérer les joueurs de la compétition
    db.all("SELECT joueur_id, victoires FROM competition_joueurs WHERE competition_id=?", [id], (err, joueurs) => {
        if (err) return res.send(err.message);

        // 2️⃣ Mettre à jour les étoiles des joueurs
        joueurs.forEach(j => {
            // Exemple : 1 étoile par victoire dans cette compétition
            db.run("UPDATE joueurs SET etoiles = COALESCE(etoiles,0) + ? WHERE id=?", [j.victoires, j.joueur_id]);
        });

        // 3️⃣ Supprimer les liens compétition-joueurs
        db.run("DELETE FROM competition_joueurs WHERE competition_id=?", [id], (err) => {
            if (err) return res.send(err.message);

            // 4️⃣ Supprimer la compétition
            db.run("DELETE FROM competitions WHERE id=?", [id], (err) => {
                if (err) return res.send(err.message);

                res.send(renderPage(
                    "Compétition terminée",
                    `<p>✅ La compétition a été terminée et les étoiles mises à jour.</p>
                     <a href="/competitions/supprimer">⬅ Retour</a>`
                ));
            });
        });
    });
});


app.get("/competitions/supprimer", (req, res) => {
    db.all("SELECT * FROM competitions ORDER BY nom", [], (err, comps) => {
        if (err) return res.send(err.message);

        let html = `<h2>Terminer une compétition</h2>
        <form method="GET" action="/competitions/supprimer/voir">
        <label>Choisir la compétition :</label>
        <select name="id" required>
        <option value="">-- Choisir --</option>`;

        comps.forEach(c => {
            html += `<option value="${c.id}">${c.nom}</option>`;
        });

        html += `</select>
        <button type="submit">Voir</button>
        </form>
        <a href="/competitions">⬅ Retour</a>`;

        res.send(renderPage("Terminer une compétition", html));
    });
});

app.get("/competitions/supprimer/voir", (req, res) => {
    const id = req.query.id;

    db.get("SELECT * FROM competitions WHERE id=?", [id], (err, comp) => {
        if (err || !comp) return res.redirect("/competitions/supprimer");

        db.all(`
            SELECT j.nom, cj.victoires
            FROM competition_joueurs cj
            JOIN joueurs j ON j.id = cj.joueur_id
            WHERE cj.competition_id=?
            ORDER BY cj.victoires DESC
        `, [id], (err, joueurs) => {

            if (err) return res.send(err.message);

            let html = `<h2>Terminer : ${comp.nom}</h2>
            <p><strong>Objectif :</strong> ${comp.objectif} victoires</p>
            <table border="1" cellpadding="6">
            <tr><th>Joueur</th><th>Victoires</th></tr>`;

            joueurs.forEach(j => {
                html += `<tr><td>${j.nom}</td><td>${j.victoires}</td></tr>`;
            });

            html += `</table><br>

            <form method="POST" action="/competitions/supprimer">
                <input type="hidden" name="id" value="${id}">
                <button style="background:red;color:white">🏁 Terminer et attribuer les étoiles</button>
            </form>

            <a href="/competitions/supprimer">⬅ Retour</a>`;

            res.send(renderPage("Terminer compétition", html));
        });
    });
});


// ============================
// SERVER
// ============================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur lancé sur http://localhost:${port}`);
});