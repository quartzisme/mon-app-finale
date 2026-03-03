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
          body {
            font-size: 20px;
            line-height: 1.6;
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f2f2f2;
            }

            .page-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 15px;
            background: white;
            min-height: 100vh;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }

            input, select, button { font-size: 18px; padding: 5px; margin: 5px 0; }
            .jeux-table {
            width: 100%;
            border-collapse: collapse;
            }

            ul {
            list-style: none;
            padding-left: 0;
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

            .box-info {
                background: #f4f6f8;
                border-left: 6px solid #4a90e2;
                padding: 10px;
                margin: 10px 0;
                border-radius: 6px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }

            input, select, button {
                width: 100%;
                max-width: 400px;
                box-sizing: border-box;
            }

            .result-box {
                background: #dddee0;
                border-left: 5px solid #2b7cff;
                padding: 10px 12px;
                margin: 12px 0;
                border-radius: 6px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            }
        </style>
    </head>

    <body>
    <div class="page-container">
        ${content}
    </div>
    </body>
    </html>`;
}

// ===================== LOGIN =====================
app.get("/", (req,res)=>{
    const html = `
    <img src="/images/de.jpg" style="max-width:200px; margin-bottom:20px;">
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
    <h1>🎲 Jeux de Société</h1>
    <div class="result-box">
    <ul style="list-style:none; padding-left:0;">
    
    <div style="display:flex; flex-direction:column; gap:12px; max-width:320px;">
        <li><a href="/jeux/liste">⚔️ Jeux</a></li>
        <li><a href="/joueurs/liste">👥 Joueurs</a></li>
        <li><a href="/scores/ajouter">📊 Scores</a></li>
        <li><a href="/stats">🥇 Meilleurs / 💀 Pires jeux</a></li>
        <li><a href="/filtrages">🔍 Filtrages</a></li>
        <li><a href="/competitions/liste">🏆 Compétitions</a></li>
        <li><a href="/logout">⏻ Déconnexion</a></li>
    </div>
    </ul></div>`;
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

    <h2>⚔️ Liste des jeux</h2>
    <a href="/menu">⬅ Retour</a><br><br>

    <table class="jeux-table">
      <tr>
        <th>id</th>
        <th>Nom</th>
        <th>Joueurs</th>
        <th>Temps</th>
        <th>Statut</th>
        <th>Moyenne</th>
      </tr>
    `;

    // ✅ LIGNES DU TABLEAU
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
          <td>${j.id}</td>
          <td>${j.nom}</td>
          <td>${j.min_joueurs}-${j.max_joueurs}</td>
          <td>${j.temps_min}-${j.temps_max} min</td>
          <td>${j.statut || ""}</td>
          <td><strong>${moyenne}</strong></td>
        </tr>
      `;
    });

    // ✅ fermer le tableau À LA FIN
    html += `</table><a href="/menu">⬅ Retour</a>`;

    res.send(renderPage("Liste des jeux", html));

  } catch (err) {
    res.send(renderPage("Erreur", err.message));
  }
});


// ===================== ROUTES JOUEURS =====================
// ===================== ROUTES JOUEURS =====================
app.get("/joueurs/liste", async (req,res)=>{
    try {
        const { data: joueurs, error } = await supabase
            .from("joueurs")
            .select("*")
            .order("nom");

        if(error) throw error;

        // ===== calcul total des jeux UNE SEULE FOIS =====
        const { count: totalJeux } = await supabase
            .from("jeux")
            .select("*", { count: "exact", head: true });

        // ===== construction des cartes joueurs =====
        let rows = await Promise.all(joueurs.map(async (j) => {

            // ===== nombre de scores du joueur =====
            const { count: totalScores } = await supabase
                .from("scores")
                .select("*", { count: "exact", head: true })
                .eq("joueur_id", j.id);

            const pourcentage = totalJeux
                ? Math.round((totalScores / totalJeux) * 100)
                : 0;

            // ===== meilleur(s) jeu(x) du joueur =====
            const { data: bestScores } = await supabase
                .from("scores")
                .select(`
                    score,
                    jeux ( nom )
                `)
                .eq("joueur_id", j.id)
                .order("score", { ascending: false });

            let bestJeuHTML = "Aucun score";

            if (bestScores && bestScores.length > 0) {
                const maxScore = bestScores[0].score;

                const meilleurs = bestScores
                    .filter(s => s.score === maxScore)
                    .map(s => s.jeux?.nom || "Jeu inconnu");

                bestJeuHTML = meilleurs.join(", ");
            }

            // ===== HTML DU JOUEUR =====
            return `
            <div class="result-box" style="margin-bottom:15px;">
              <table style="width:100%;">
                <tr>
                  <td style="width:120px; text-align:center;">
                    ${j.image ? `<img src="/images/${j.image}" width="80"><br>` : ""}
                    <strong>${j.nom}</strong>
                  </td>

                  <td style="text-align:center; width:120px;">
                    ⭐ ${j.etoiles || 0}
                  </td>

                  <td>
                    <div><b>Meilleur jeu :</b> ${bestJeuHTML}</div>
                    <div><b>Jeux évalués :</b> ${pourcentage}%</div>

                    <br>

                    <a href="/joueurs/modifier/${j.id}">✏ Modifier</a>
                    &nbsp;|&nbsp;
                    <a href="/joueurs/supprimer/${j.id}"
                       onclick="return confirm('Supprimer ce joueur ?');">
                       🗑 Supprimer
                    </a>
                  </td>
                </tr>
              </table>
            </div>
            `;
        }));

        const html = `
        <h2>👥 Gestion des joueurs</h2>
        <button><a href="/joueurs/ajouter">Ajouter un joueur</a></button>
        <br><br>
        ${rows.join("")}
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

    const { data: jeux } = await supabase
      .from("jeux")
      .select("id, nom")
      .order("nom");

    const { data: joueurs } = await supabase
      .from("joueurs")
      .select("id, nom")
      .order("nom");

    const html = `
<h2>📊 Ajouter / Modifier un score</h2>

<form method="POST" action="/scores/ajouter">

<label>Jeu :</label>
<select name="jeu_id" required>
<option value="">-- Choisir un jeu --</option>
${jeux.map(j=>`<option value="${j.id}">${j.nom}</option>`).join("")}
</select><br>

<label>Joueur :</label>
<select name="joueur_id" required>
<option value="">-- Choisir un joueur --</option>
${joueurs.map(j=>`<option value="${j.id}">${j.nom}</option>`).join("")}
</select><br>

<label>Score :</label>
<input type="number" step="0.5" name="score" required><br>

<button>Ajouter / Modifier</button>

<div id="scoresJeu" class="result-box"></div>
<div id="scoreJoueur" class="result-box" style="display:none;"></div>

</form>

<a href='/menu'>⬅ Retour</a>

<script>
async function majInfosScore() {
  const jeu = document.querySelector("[name='jeu_id']").value;
  const joueur = document.querySelector("[name='joueur_id']").value;

  const divJeu = document.getElementById("scoresJeu");
  const divJoueur = document.getElementById("scoreJoueur");

  // ================= SCORES DU JEU =================
  if (jeu) {
    try {
      const res1 = await fetch('/api/scores-par-jeu?jeu_id=' + jeu);
      const data1 = await res1.json();

    if (!data1 || data1.length === 0) {
    divJeu.innerHTML = "Aucun score pour ce jeu";
    divJeu.className = "result-box";
    divJeu.style.display = "block";
    } else {
    divJeu.innerHTML =
        "<b>Scores existants :</b><br>" +
        data1.map(s => s.joueurs.nom + " : " + s.score).join("<br>");
    divJeu.className = "result-box";
    divJeu.style.display = "block";
    }
    } catch (e) {
      console.log("Erreur scores jeu", e);
    }
  } else {
    divJeu.innerHTML = "";
    divJeu.style.display = "none";
  }

// ================= SCORES DU JOUEUR ================= 
if (joueur) {
  try {
    const resJ = await fetch('/api/scores-par-joueur?joueur_id=' + joueur);
    const dataJ = await resJ.json();

    if (!dataJ || dataJ.length === 0) {
      divJoueur.style.display = "block";
      divJoueur.innerHTML =
        "<b>Ce joueur n'a encore donné aucun score.</b>";
    } else {
      divJoueur.style.display = "block";
      divJoueur.innerHTML =
        "<b>Scores de ce joueur :</b><br>" +
        dataJ.map(s =>
          (s.jeux?.nom || "Jeu inconnu") + " : " + s.score
        ).join("<br>");
    }
  } catch (e) {
    console.log("Erreur scores joueur", e);
  }
} else {
  divJoueur.style.display = "none";
  divJoueur.innerHTML = "";
}
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("[name='jeu_id']").addEventListener("change", majInfosScore);
  document.querySelector("[name='joueur_id']").addEventListener("change", majInfosScore);
});
</script>
`;

    res.send(renderPage("Ajouter Score", html));

  } catch(err){
    res.send(renderPage("Erreur", err.message));
  }
});

// ================= SCORE EXISTANT =================
app.get("/api/score-existant", async (req, res) => {
  try {
    const { jeu_id, joueur_id } = req.query;

    if (!jeu_id || !joueur_id) return res.json(null);

    const { data, error } = await supabase
      .from("scores")
      .select("score")
      .eq("jeu_id", jeu_id)
      .eq("joueur_id", joueur_id)
      .maybeSingle();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.json(null);
  }
});


app.post("/scores/ajouter", async (req, res) => {
  try {
    const { jeu_id, joueur_id, score } = req.body;

    const { data, error } = await supabase
      .from("scores")
      .upsert(
        [{ jeu_id, joueur_id, score }],
        { onConflict: "jeu_id,joueur_id" }
      );

    if (error) throw error;

    res.send(renderPage(
      "Succès",
      "<h2>✅ Le score a été enregistré</h2><a href='/scores/ajouter'>⬅ Retour</a>"
    ));

  } catch (err) {
    res.send(renderPage("Erreur", err.message));
  }
});

// ================= SCORE(S) SI EXISTANT =================
app.get("/api/scores-par-jeu", async (req, res) => {
  try {
    const { jeu_id } = req.query;

    const { data, error } = await supabase
      .from("scores")
      .select(`
        score,
        joueurs (nom)
      `)
      .eq("jeu_id", jeu_id);

    if (error) throw error;

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ================= SCORES PAR JOUEUR =================
app.get("/api/scores-par-joueur", async (req, res) => {
  try {
    const { joueur_id } = req.query;

    const { data, error } = await supabase
      .from("scores")
      .select(`
        score,
        jeux (nom)
      `)
      .eq("joueur_id", joueur_id);

    if (error) throw error;

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== MEILLEURS / PIRES JEUX =====================
// ===================== PAGE STATS =====================
app.get("/stats", async (req,res)=>{
  try {
    const { data: joueurs, error } = await supabase
      .from("joueurs")
      .select("*")
      .order("nom");

    if (error) throw error;

    let options = joueurs.map(j =>
      `<option value="${j.id}">${j.nom}</option>`
    ).join("");

    const html = `
<h2>🥇 Top jeux 💀</h2>

<form id="formStats">
  Choisir joueur:<br>
  <select name="joueur" id="choixJoueur">
    <option value="">-- Choisir --</option>
    <option value="all">Tous les joueurs</option>
    ${options}
  </select>
</form>

<div id="resultatsStats"></div>

<a href="/menu">⬅ Retour</a>

<script>
// ===== SCRIPT STATS PROPRE =====
document.addEventListener("DOMContentLoaded", () => {

  const select = document.getElementById("choixJoueur");
  const div = document.getElementById("resultatsStats");

  select.addEventListener("change", async function () {

    const joueur = this.value;

    if (!joueur) {
      div.innerHTML = "";
      return;
    }

    try {
      const res = await fetch("/api/stats?joueur=" + joueur);
      const data = await res.json();

      if (!data || !data.meilleurs) {
        div.innerHTML = "<div class='result-box'>Aucune donnée</div>";
        return;
      }

      let html = "";

      // ===== MEILLEURS =====
      html += "<div class='result-box'><h3>🏆 Meilleurs jeux</h3>";
      data.meilleurs.forEach(j => {
        html += j.jeu + " (" + j.moyenne.toFixed(2) + ")<br>";
      });
      html += "</div>";

      // ===== PIRES =====
      html += "<div class='result-box'><h3>💀 Pires jeux</h3>";
      data.pires.forEach(j => {
        html += j.jeu + " (" + j.moyenne.toFixed(2) + ")<br>";
      });
      html += "</div>";

      div.innerHTML = html;

    } catch (e) {
      div.innerHTML = "<div class='result-box'>Erreur</div>";
    }

  });

});
</script>
`;

    res.send(renderPage("Statistiques", html));

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

// ===================== API FILTRAGE JEUX =====================
app.get("/api/filtrer-jeux", async (req, res) => {
  try {
    let query = supabase
      .from("jeux")
      .select("*");

    const { min_joueurs, max_joueurs, temps_max, score_min } = req.query;

    if (min_joueurs)
      query = query.gte("min_joueurs", Number(min_joueurs));

    if (max_joueurs)
      query = query.lte("max_joueurs", Number(max_joueurs));

    if (temps_max)
      query = query.lte("temps", Number(temps_max));

    const { data, error } = await query;
    if (error) throw error;

    let jeux = data;

    // filtre sur score moyen
    if (score_min) {
      const { data: scores } = await supabase
        .from("scores")
        .select("jeu_id, score");

      let moyennes = {};
      scores.forEach(s => {
        if (!moyennes[s.jeu_id]) moyennes[s.jeu_id] = { total:0, count:0 };
        moyennes[s.jeu_id].total += s.score;
        moyennes[s.jeu_id].count++;
      });

      jeux = jeux.filter(j => {
        const m = moyennes[j.id];
        if (!m) return false;
        return (m.total / m.count) >= Number(score_min);
      });
    }

    res.json(jeux);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========== ROUTE STATS ===============
app.get("/api/stats", async (req,res)=>{
  try {
    const joueur = req.query.joueur;

    let query = supabase
    .from("scores")
    .select(`
        score,
        joueur_id,
        jeux ( nom ),
        joueurs ( id, nom )
    `)
    .not("joueurs.id", "is", null);

    if (joueur !== "all") {
      query = query.eq("joueur_id", joueur);
    }

    const { data: scores, error } = await query;
    if (error) throw error;

    if (!scores.length) return res.json({ meilleurs: [], pires: [] });

    let stats = {};

    scores.forEach(s=>{
      const nomJeu = s.jeux.nom;
      if(!stats[nomJeu]) stats[nomJeu] = { total:0, count:0 };
      stats[nomJeu].total += s.score;
      stats[nomJeu].count += 1;
    });

    let resultats = Object.keys(stats).map(jeu=>({
      jeu,
      moyenne: stats[jeu].total / stats[jeu].count
    }));

    resultats.sort((a,b)=> b.moyenne - a.moyenne);

    res.json({
      meilleurs: resultats.slice(0,5),
      pires: resultats.slice(-5).reverse()
    });

  } catch(err){
    res.status(500).json({ error: err.message });
  }
});

// ===================== PAGE FILTRAGE =====================
app.get("/filtrage", (req, res) => {

const html = `
<h2>🔎 Filtrer les jeux</h2>

<div class="result-box">

Minimum joueurs:<br>
<input type="number" id="minj"><br><br>

Maximum joueurs:<br>
<input type="number" id="maxj"><br><br>

Temps maximum (minutes):<br>
<input type="number" id="temps"><br><br>

Score moyen minimum:<br>
<input type="number" step="0.1" id="score"><br><br>

<button onclick="filtrer()">🔍 Rechercher</button>

</div>

<div id="resultatsFiltre"></div>

<a href="/menu">⬅ Retour</a>

<script>
async function filtrer() {

  const url =
    "/api/filtrer-jeux?" +
    "min_joueurs=" + document.getElementById("minj").value +
    "&max_joueurs=" + document.getElementById("maxj").value +
    "&temps_max=" + document.getElementById("temps").value +
    "&score_min=" + document.getElementById("score").value;

  const res = await fetch(url);
  const data = await res.json();

  const div = document.getElementById("resultatsFiltre");

  if (!data.length) {
    div.innerHTML = "<div class='result-box'>Aucun jeu trouvé</div>";
    return;
  }

  let html = "";
  data.forEach(j => {
    html += "<div class='result-box'><b>" + j.nom + "</b></div>";
  });

  div.innerHTML = html;
}
</script>
`;

res.send(renderPage("Filtrage", html));
});

// ===================== SERVEUR =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Serveur démarré sur http://localhost:${PORT}`));
