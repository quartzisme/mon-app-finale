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
            .select("*")
            .order("nom");

        if (error) throw error;

        let rows = jeux.map(j => `
            <tr>
                <td>${j.nom || ""}</td>
                <td>${j.extensions || ""}</td>
                <td>${j.min_joueurs || ""}</td>
                <td>${j.max_joueurs || ""}</td>
                <td>${j.temps_min || ""}</td>
                <td>${j.temps_max || ""}</td>
                <td>${j.statut || ""}</td>
                <td>-</td>
            </tr>
        `).join("");

        const html = `
            <h2>Liste des jeux</h2>

            <table>
                <tr>
                    <th>Nom</th>
                    <th>Extensions</th>
                    <th>Min joueurs</th>
                    <th>Max joueurs</th>
                    <th>Temps min</th>
                    <th>Temps max</th>
                    <th>Statut</th>
                    <th>Moyenne score</th>
                </tr>

                ${rows}
            </table>

            <a href="/jeux/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Liste des jeux", html));

    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});


// ===================== ROUTES JOUEURS =====================
app.get("/joueurs/liste", async (req,res)=>{
    try {
        const { data: joueurs, error } = await supabase.from("joueurs").select("*").order("nom");
        if(error) throw error;
        let html = "<h2>Liste des joueurs</h2><ul>";
        joueurs.forEach(j => html += `<li>${j.nom} - Étoiles: ${j.etoiles||0}</li>`);
        html += "</ul><a href='/menu'>⬅ Retour</a>";
        res.send(renderPage("Joueurs", html));
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
        res.redirect("/scores/ajouter");
    } catch(err){ res.send(renderPage("Erreur", err.message)); }
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
