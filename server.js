// server.js - version complète Supabase
import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import multer from "multer";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { supabase } from './supabaseClient.js'; // Supabase client

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// ===================== Middleware =====================
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/images"),
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, req.body.nom + '.' + ext);
    }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/images", express.static(join(__dirname, "public/images")));

function renderPage(title, content){
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-size: 20px; line-height: 1.6; font-family: Arial, sans-serif; margin: 10px; }
            input, select, button { font-size: 18px; padding: 5px; margin: 5px 0; }
            .jeux-table {
            width: 100%;
            border-collapse: collapse;
            }

            .jeux-table th,
            .jeux-table td {
            border: 1px solid #ccc;
            padding: 8px;
            }

            .jeux-table tr:nth-child(even) {
            background-color: #f5f5f5;
            }

            .jeux-table tr:hover {
            background-color: #e8f4ff;
            }

        </style>
    </head>
    <body>
        ${content}
    </body>
    </html>`;
}

// ===================== LOGIN =====================
app.get("/", (req,res)=>{
    const html = `
    <h1>Bienvenue</h1>
    <form method="POST" action="/login">
        <input name="username" placeholder="Usager" required><br>
        <input name="password" type="password" placeholder="Mot de passe" required><br>
        <button>Entrer</button>
    </form>`;
    res.send(renderPage("Bienvenue", html));
});

app.post("/login", (req,res)=>{
    const { username, password } = req.body;
    if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS){
        req.session.auth = true;
        return res.redirect("/menu");
    }
    res.send("Identifiant ou mot de passe incorrect.");
});

app.get("/menu", (req,res)=>{
    if(!req.session.auth) return res.redirect("/");
    const html = `
    <h1>Menu principal</h1>
    <ul>
        <li><a href="/jeux/liste">⚔️ Jeux</a></li>
        <li><a href="/joueurs/liste">👥 Joueurs</a></li>
        <li><a href="/scores/ajouter">📊 Ajouter Score</a></li>
        <li><a href="/stats">🥇 Meilleurs / 💀 Pires jeux</a></li>
        <li><a href="/competitions/liste">🏆 Compétitions</a></li>
        <li><a href="/logout">Déconnexion</a></li>
    </ul>`;
    res.send(renderPage("Menu", html));
});

app.get("/logout", (req,res)=>{
    req.session.destroy(()=>res.redirect("/"));
});

// ===================== ROUTES JEUX =====================
app.get("/api/jeux", async (req,res)=>{
    try {
        const { data, error } = await supabase.from("jeux").select("*").order("nom");
        if(error) throw error;
        res.json(data);
    } catch(err){
        res.status(500).json({ error: err.message });
    }
});

app.get("/jeux/liste", async (req, res) => {
  try {
    const { data: jeux, error } = await supabase
      .from("jeux")
      .select(`
        id,
        nom,
        extensions,
        min_joueurs,
        max_joueurs,
        temps_min,
        temps_max,
        statut,
        scores(score)
      `)
      .order("nom");

    if (error) throw error;

    let html = `
    <h2>Liste des jeux</h2>
    <table class="jeux-table">
      <tr>
        <th>Nom</th>
        <th>Joueurs</th>
        <th>Temps</th>
        <th>Statut</th>
        <th>Moyenne</th>
      </tr>
    `;

    jeux.forEach(j => {
      let moyenne = "—";

      if (j.scores && j.scores.length > 0) {
        const avg =
          j.scores.reduce((a, b) => a + Number(b.score), 0) /
          j.scores.length;
        moyenne = avg.toFixed(2);
      }

      html += `
        <tr>
          <td>${j.nom}</td>
          <td>${j.min_joueurs}-${j.max_joueurs}</td>
          <td>${j.temps_min}-${j.temps_max} min</td>
          <td>${j.statut || ""}</td>
          <td><strong>${moyenne}</strong></td>
        </tr>
      `;
    });

    html += `</table><a href="/menu">⬅ Retour</a>`;

    res.send(renderPage("Liste des jeux", html));

  } catch (err) {
    res.send(renderPage("Erreur", err.message));
  }
});


// ===================== ROUTES JOUEURS =====================
app.get("/joueurs/liste", async (req,res)=>{
    try {
        const { data: joueurs, error } = await supabase
            .from("joueurs")
            .select("*")
            .order("nom");

        if(error) throw error;

        let rows = joueurs.map(j => `
            <tr>
                <td>
                    ${j.image ? `<img src="/images/${j.image}" width="80"><br>` : ""}
                    ${j.nom}
                </td>
                <td>${j.etoiles || 0}</td>
                <td>
                    <a href="/joueurs/modifier/${j.id}">✏ Modifier</a>
                    <a href="/joueurs/supprimer/${j.id}">🗑 Supprimer</a>
                </td>
            </tr>
        `).join("");

        const html = `
            <h2>Gestion des joueurs</h2>
            <a href="/joueurs/ajouter">➕ Ajouter joueur</a>
            <table>
                <tr>
                    <th>Nom</th>
                    <th>Étoiles</th>
                    <th>Actions</th>
                </tr>
                ${rows}
            </table>
            <a href="/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Joueurs", html));

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/joueurs/ajouter", (req,res)=>{
    const html = `
        <h2>Ajouter joueur</h2>
        <form method="POST" action="/joueurs/ajouter" enctype="multipart/form-data">
            Nom:<br>
            <input name="nom" required><br>
            Étoiles:<br>
            <input type="number" name="etoiles"><br>
            Image:<br>
            <input type="file" name="image"><br><br>
            <button>Ajouter</button>
        </form>
        <a href="/joueurs/liste">⬅ Retour</a>
    `;
    res.send(renderPage("Ajouter joueur", html));
});
app.post("/joueurs/ajouter", upload.single("image"), async (req,res)=>{
    try {
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles) : null;

        const image = req.file ? req.file.filename : null;

        const { error } = await supabase
            .from("joueurs")
            .insert([{ nom, etoiles, image }]);

        if(error) throw error;

        res.redirect("/joueurs/liste");

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/joueurs/modifier/:id", async (req,res)=>{
    const { id } = req.params;

    const { data: joueur } = await supabase
        .from("joueurs")
        .select("*")
        .eq("id", id)
        .single();

    const html = `
        <h2>Modifier joueur</h2>
        <form method="POST" action="/joueurs/modifier/${id}" enctype="multipart/form-data">
            Nom:<br>
            <input name="nom" value="${joueur.nom}" required><br>
            Étoiles:<br>
            <input type="number" name="etoiles" value="${joueur.etoiles || 0}"><br>
            Image:<br>
            <input type="file" name="image"><br><br>
            <button>Modifier</button>
        </form>
        <a href="/joueurs/liste">⬅ Retour</a>
    `;
    res.send(renderPage("Modifier joueur", html));
});
app.post("/joueurs/modifier/:id", upload.single("image"), async (req,res)=>{
    try {
        const { id } = req.params;
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles) : null;


        let updateData = { nom, etoiles };

        if(req.file){
            updateData.image = req.file.filename;
        }

        const { error } = await supabase
            .from("joueurs")
            .update(updateData)
            .eq("id", id);

        if(error) throw error;

        res.redirect("/joueurs/liste");

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/joueurs/supprimer/:id", async (req,res)=>{
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("joueurs")
            .delete()
            .eq("id", id);

        if(error) throw error;

        res.redirect("/joueurs/liste");

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});



// ===================== ROUTES SCORES =====================
app.get("/scores/ajouter", async (req,res)=>{
    try {
        const { data: jeux } = await supabase.from("jeux").select("id, nom").order("nom");
        const { data: joueurs } = await supabase.from("joueurs").select("id, nom").order("nom");
        let html = `<h2>Ajouter un score</h2>
        <form method="POST" action="/scores/ajouter">
            <label>Jeu :</label>
            <select name="jeu_id" required>
                ${jeux.map(j=>`<option value="${j.id}">${j.nom}</option>`).join("")}
            </select><br>
            <label>Joueur :</label>
            <select name="joueur_id" required>
                ${joueurs.map(j=>`<option value="${j.id}">${j.nom}</option>`).join("")}
            </select><br>
            <label>Score :</label>
            <input type="number" step="0.5" name="score" required><br>
            <button>Ajouter</button>
        </form>
        <a href='/menu'>⬅ Retour</a>`;
        res.send(renderPage("Ajouter Score", html));
    } catch(err){ res.send(renderPage("Erreur", err.message)); }
});

app.post("/scores/ajouter", async (req,res)=>{
    try {
        const { jeu_id, joueur_id, score } = req.body;
        const { data, error } = await supabase.from("scores").insert([{ jeu_id, joueur_id, score }]);
        if(error) throw error;
        res.send(renderPage(
        "Succès",
        "<h2>✅ Le score a été enregistré</h2><a href='/menu'>⬅ Retour</a>"
));
    } catch(err){ res.send(renderPage("Erreur", err.message)); }
});

// ===================== MEILLEURS / PIRES JEUX =====================
app.get("/stats", async (req,res)=>{
    try {
        const { data: joueurs, error } = await supabase
            .from("joueurs")
            .select("*")
            .order("nom");

        if(error) throw error;

        let options = joueurs.map(j =>
            `<option value="${j.id}">${j.nom}</option>`
        ).join("");

        const html = `
            <h2>Meilleurs / Pires jeux</h2>

            <form method="GET" action="/stats/resultat">
                Choisir joueur:<br>
                <select name="joueur">
                    <option value="all">Tous les joueurs</option>
                    ${options}
                </select><br><br>

                <button>Voir statistiques</button>
            </form>

            <a href="/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Statistiques", html));

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/stats/resultat", async (req,res)=>{
    try {

        const joueur = req.query.joueur;

        let query = supabase
            .from("scores")
            .select(`
                score,
                jeux ( id, nom ),
                joueurs ( id, nom )
            `);

        if(joueur !== "all"){
            query = query.eq("joueur_id", joueur);
        }

        const { data: scores, error } = await query;

        if(error) throw error;

        if(!scores.length){
            return res.send(renderPage("Stats", "<h3>Aucune donnée disponible</h3><a href='/stats'>⬅ Retour</a>"));
        }

        // Calcul moyenne par jeu
        let stats = {};

        scores.forEach(s=>{
            const nomJeu = s.jeux.nom;
            if(!stats[nomJeu]){
                stats[nomJeu] = { total: 0, count: 0 };
            }
            stats[nomJeu].total += s.score;
            stats[nomJeu].count += 1;
        });

        let resultats = Object.keys(stats).map(jeu=>{
            return {
                jeu,
                moyenne: stats[jeu].total / stats[jeu].count
            };
        });

        resultats.sort((a,b)=> b.moyenne - a.moyenne);

        const meilleurs = resultats.slice(0,5);
        const pires = resultats.slice(-5).reverse();

        let html = "<h2>Résultats</h2>";

        html += "<h3>🏆 Meilleurs jeux</h3><ul>";
        meilleurs.forEach(j=>{
            html += `<li>${j.jeu} (${j.moyenne.toFixed(2)})</li>`;
        });
        html += "</ul>";

        html += "<h3>💀 Pires jeux</h3><ul>";
        pires.forEach(j=>{
            html += `<li>${j.jeu} (${j.moyenne.toFixed(2)})</li>`;
        });
        html += "</ul>";

        html += "<a href='/stats'>⬅ Retour</a>";

        res.send(renderPage("Résultats", html));

    } catch(err){
        res.send(renderPage("Erreur", err.message));
    }
});


// ===================== ROUTES COMPÉTITIONS =====================
app.get("/competitions/liste", async (req,res)=>{
    try {
        const { data: comps } = await supabase.from("competitions").select("*").order("nom");
        let html = "<h2>Compétitions</h2><ul>";
        comps.forEach(c => html += `<li>${c.nom} - Objectif: ${c.objectif}</li>`);
        html += "</ul><a href='/menu'>⬅ Retour</a>";
        res.send(renderPage("Compétitions", html));
    } catch(err){ res.send(renderPage("Erreur", err.message)); }
});

// ===================== SERVEUR =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Serveur démarré sur http://localhost:${PORT}`));
