// server.js - version complète Supabase (corrigée)
import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import multer from "multer";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

import { supabase } from "./supabaseClient.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// ===================== Middleware =====================
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function requireAuth(req, res, next) {
    if (req.session?.auth) return next();

    if (req.originalUrl.startsWith("/api/")) {
        return res.status(401).json({ error: "Non autorisé" });
    }

    return res.redirect("/");
}

function toIntOrNull(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeFileBaseName(value = "image") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "image";
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/images"),
    filename: (req, file, cb) => {
        const base = safeFileBaseName(req.body.nom || "image");
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        cb(null, `${base}${ext}`);
    }
});

const upload = multer({ storage });

app.use("/images", express.static(join(__dirname, "public/images")));
app.use("/sounds", express.static(join(__dirname, "public")));

function renderPage(title, content) {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
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

          input, select, button, textarea {
            font-size: 18px;
            padding: 5px;
            margin: 5px 0;
          }

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

          input, select, button, textarea {
            width: 100%;
            max-width: 400px;
            box-sizing: border-box;
          }

          textarea {
            max-width: 600px;
          }

          .result-box {
            background: #dddee0;
            border-left: 5px solid #2b7cff;
            padding: 10px 12px;
            margin: 12px 0;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          }

          button {
            box-shadow: 0 3px 6px rgba(0,0,0,0.25);
            cursor: pointer;
            transition: 0.15s;
          }

          button:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 10px rgba(0,0,0,0.35);
          }

          a {
            text-decoration: none;
          }

          .inline-form {
            display: inline;
          }
        </style>
    </head>

    <body>
      <div class="page-container">
        ${content}
      </div>
    </body>
    </html>
    `;
}

// ===================== LOGIN =====================
app.get("/", (req, res) => {
    const html = `
    <audio id="music" autoplay loop>
      <source src="/sounds/sound.mp3" type="audio/mpeg">
    </audio>

    <script>
      window.addEventListener("load", () => {
        const music = document.getElementById("music");
        const playPromise = music.play();

        if (playPromise !== undefined) {
          playPromise.catch(() => {
            document.body.addEventListener("click", () => music.play(), { once: true });
          });
        }
      });

      function togglePassword() {
        const p = document.getElementById("password");
        p.type = p.type === "password" ? "text" : "password";
      }
    </script>

    <button type="button" onclick="document.getElementById('music').play()">🔊 Musique</button>

    <br><br>
    <img src="/images/de.jpg" style="max-width:200px; margin-bottom:20px;">

    <form method="POST" action="/login">
      <input name="username" placeholder="Usager" required><br>

      <input type="password" id="password" name="password" placeholder="Mot de passe" required><br>
      <button type="button" onclick="togglePassword()">👁 Afficher / masquer</button><br><br>

      <button>Entrer</button>
    </form>
    `;

    res.send(renderPage("Bienvenue", html));
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (
        username === process.env.ADMIN_USER &&
        password === process.env.ADMIN_PASS
    ) {
        req.session.auth = true;
        return res.redirect("/menu");
    }

    res.send(renderPage("Erreur", "Identifiant ou mot de passe incorrect."));
});

app.get("/menu", requireAuth, (req, res) => {
    const html = `
    <div class="bienvenue-container">
      <h1>🎲 Jeux de Société</h1>
      <div class="result-box">
        <ul style="list-style:none; padding-left:0;">
          <div style="display:flex; flex-direction:column; gap:12px; max-width:320px;">
            <li><a href="/jeux/liste">⚔️ Jeux</a></li>
            <li><a href="/joueurs/liste">👥 Joueurs</a></li>
            <li><a href="/scores/ajouter">📊 Inscription des Scores</a></li>
            <li><a href="/stats">🥇 Meilleurs / 💀 Pires jeux</a></li>
            <li><a href="/filtrages">🔍 Filtrages</a></li>
            <li><a href="/competitions/liste">🏆 Compétitions</a></li>
            <li><a href="/logout">⏻ Déconnexion</a></li>
          </div>
        </ul>
      </div>
    </div>
    `;

    res.send(renderPage("Menu", html));
});

app.get("/logout", requireAuth, (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ===================== ROUTES JEUX =====================
app.get("/api/jeux", requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase.from("jeux").select("*").order("nom");
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/jeux/liste", requireAuth, async (req, res) => {
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

        <div class="box-info">
          <h3>➕ Ajouter un jeu</h3>

          <form method="POST" action="/jeux/ajouter">
            Nom:<br>
            <input name="nom" required><br>

            Joueurs min:<br>
            <input type="number" name="min_joueurs" style="width:90px;"><br>

            Joueurs max:<br>
            <input type="number" name="max_joueurs" style="width:90px;"><br>

            Temps min:<br>
            <input type="number" name="temps_min" style="width:110px;"><br>

            Temps max:<br>
            <input type="number" name="temps_max" style="width:110px;"><br>

            <button>Ajouter le jeu</button>
          </form>
        </div>

        <br>

        <div class="box-info">
          <h3>✏️ Modifier / 🗑 Supprimer un jeu</h3>

          <form method="GET" action="/jeux/modifier">
            Modifier ce jeu:<br>
            <select name="id" required>
              <option value="">-- Choisir --</option>
              ${jeux.map((j) => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
            </select><br>

            <button>✏ Modifier</button>
          </form>

          <br>

          <form method="POST" action="/jeux/supprimer" onsubmit="return confirm('Supprimer ce jeu ?');">
            Supprimer ce jeu:<br>

            <select name="id" required>
              <option value="">-- Choisir --</option>
              ${jeux.map((j) => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
            </select><br>

            <button>🗑 Supprimer</button>
          </form>
        </div>

        <br>

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

        jeux.forEach((j) => {
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
              <td>${escapeHtml(j.nom)}</td>
              <td>${j.min_joueurs ?? "—"}-${j.max_joueurs ?? "—"}</td>
              <td>${j.temps_min ?? "—"}-${j.temps_max ?? "—"} min</td>
              <td>${escapeHtml(j.statut || "")}</td>
              <td><strong>${moyenne}</strong></td>
            </tr>
            `;
        });

        html += `</table><br><a href="/menu">⬅ Retour</a>`;

        res.send(renderPage("Liste des jeux", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== AJOUTER JEU =====================
app.post("/jeux/ajouter", requireAuth, async (req, res) => {
    try {
        const {
            nom,
            min_joueurs,
            max_joueurs,
            temps_min,
            temps_max
        } = req.body;

        const { error } = await supabase.from("jeux").insert([
            {
                nom: nom?.trim(),
                min_joueurs: toIntOrNull(min_joueurs),
                max_joueurs: toIntOrNull(max_joueurs),
                temps_min: toIntOrNull(temps_min),
                temps_max: toIntOrNull(temps_max)
            }
        ]);

        if (error) throw error;

        res.redirect("/jeux/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ================= MODIFIER JEU =================
app.get("/jeux/modifier", requireAuth, async (req, res) => {
    try {
        const id = req.query.id;

        if (!id) {
            return res.send(renderPage("Erreur", "Aucun jeu sélectionné."));
        }

        const { data: jeu, error } = await supabase
            .from("jeux")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        if (!jeu) {
            return res.send(renderPage("Erreur", "Jeu introuvable."));
        }

        const html = `
        <h1>Modifier un jeu</h1>

        <form method="POST" action="/jeux/modifier">
          <input type="hidden" name="id" value="${jeu.id}">

          Nom<br>
          <input name="nom" value="${escapeHtml(jeu.nom || "")}" required><br><br>

          Extensions<br>
          <input name="extensions" value="${escapeHtml(jeu.extensions || "")}"><br><br>

          Joueurs min<br>
          <input type="number" name="min_joueurs" value="${jeu.min_joueurs ?? ""}"><br><br>

          Joueurs max<br>
          <input type="number" name="max_joueurs" value="${jeu.max_joueurs ?? ""}"><br><br>

          Temps min<br>
          <input type="number" name="temps_min" value="${jeu.temps_min ?? ""}"><br><br>

          Temps max<br>
          <input type="number" name="temps_max" value="${jeu.temps_max ?? ""}"><br><br>

          Statut<br>
          <input name="statut" value="${escapeHtml(jeu.statut || "")}"><br><br>

          Informations<br>
          <textarea name="infos" rows="6">${escapeHtml(jeu.infos || "")}</textarea><br><br>

          <button type="submit">Enregistrer</button>
        </form>

        <a href="/jeux/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Modifier jeu", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux/modifier", requireAuth, async (req, res) => {
    try {
        const {
            id,
            nom,
            extensions,
            min_joueurs,
            max_joueurs,
            temps_min,
            temps_max,
            statut,
            infos
        } = req.body;

        if (!id) {
            return res.send(renderPage("Erreur", "ID du jeu manquant."));
        }

        const updateData = {
            nom: nom?.trim(),
            extensions: extensions?.trim() || null,
            min_joueurs: toIntOrNull(min_joueurs),
            max_joueurs: toIntOrNull(max_joueurs),
            temps_min: toIntOrNull(temps_min),
            temps_max: toIntOrNull(temps_max),
            statut: statut?.trim() || null,
            infos: infos?.trim() || null
        };

        const { error } = await supabase
            .from("jeux")
            .update(updateData)
            .eq("id", id);

        if (error) throw error;

        res.redirect("/jeux/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== SUPPRIMER JEU =====================
app.post("/jeux/supprimer", requireAuth, async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.send(renderPage("Erreur", "ID du jeu manquant."));
        }

        const { error: errorScores } = await supabase
            .from("scores")
            .delete()
            .eq("jeu_id", id);

        if (errorScores) throw errorScores;

        const { error } = await supabase
            .from("jeux")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.redirect("/jeux/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== ROUTES JOUEURS =====================
app.get("/joueurs/liste", requireAuth, async (req, res) => {
    try {
        const { data: joueurs, error } = await supabase
            .from("joueurs")
            .select(`
                *,
                scores(score)
            `)
            .order("nom");

        if (error) throw error;

        const { count: totalJeux, error: totalJeuxError } = await supabase
            .from("jeux")
            .select("*", { count: "exact", head: true });

        if (totalJeuxError) throw totalJeuxError;

        const rows = await Promise.all(
            joueurs.map(async (j) => {
                const nbScores = j.scores ? j.scores.length : 0;
                const pourcentage = totalJeux
                    ? Math.round((nbScores / totalJeux) * 100)
                    : 0;

                const { data: bestScores, error: bestScoresError } = await supabase
                    .from("scores")
                    .select(`
                        score,
                        jeux ( nom )
                    `)
                    .eq("joueur_id", j.id)
                    .order("score", { ascending: false });

                if (bestScoresError) throw bestScoresError;

                let bestJeuHTML = "Aucun score";

                if (bestScores && bestScores.length > 0) {
                    const maxScore = Number(bestScores[0].score);

                    const meilleurs = bestScores
                        .filter((s) => Number(s.score) === maxScore)
                        .map((s) => s.jeux?.nom || "Jeu inconnu");

                    bestJeuHTML = meilleurs.join(", ");
                }

                return `
                <div class="result-box" style="margin-bottom:15px;">
                  <table style="width:100%;">
                    <tr>
                      <td style="width:120px; text-align:center;">
                        ${j.image ? `<img src="/images/${encodeURIComponent(j.image)}" width="80"><br>` : ""}
                        <strong>${escapeHtml(j.nom)}</strong>
                      </td>

                      <td style="text-align:center; width:120px;">
                        ⭐ ${j.etoiles || 0}<br>
                      </td>

                      <td>
                        <b>🧩 Jeux évalués :</b> ${nbScores} (${pourcentage}%)
                        <div><b>🔝 Meilleur(s) jeu-score :</b> ${escapeHtml(bestJeuHTML)}</div>
                        <br>

                        <a href="/joueurs/modifier/${j.id}">✏ Modifier</a>
                        &nbsp;|&nbsp;

                        <form method="POST" action="/joueurs/supprimer/${j.id}" class="inline-form" onsubmit="return confirm('Supprimer ce joueur ?');">
                          <button type="submit" style="width:auto;">🗑 Supprimer</button>
                        </form>
                      </td>
                    </tr>
                  </table>
                </div>
                `;
            })
        );

        const html = `
        <h2>👥 Gestion des joueurs</h2>
        <button onclick="window.location.href='/joueurs/ajouter'">Ajouter un joueur</button><br>
        <br><br>
        ${rows.join("")}
        <a href="/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Joueurs", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/joueurs/ajouter", requireAuth, (req, res) => {
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

app.post("/joueurs/ajouter", requireAuth, upload.single("image"), async (req, res) => {
    try {
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles, 10) : null;
        const image = req.file ? req.file.filename : null;

        const { error } = await supabase
            .from("joueurs")
            .insert([{ nom, etoiles, image }]);

        if (error) throw error;

        res.redirect("/joueurs/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/joueurs/modifier/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: joueur, error } = await supabase
            .from("joueurs")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        if (!joueur) {
            return res.send(renderPage("Erreur", "Joueur introuvable."));
        }

        const html = `
            <h2>Modifier joueur</h2>
            <form method="POST" action="/joueurs/modifier/${id}" enctype="multipart/form-data">
                Nom:<br>
                <input name="nom" value="${escapeHtml(joueur.nom || "")}" required><br>

                Étoiles:<br>
                <input type="number" name="etoiles" value="${joueur.etoiles || 0}"><br>

                Image:<br>
                <input type="file" name="image"><br><br>

                <button>Modifier</button>
            </form>
            <a href="/joueurs/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Modifier joueur", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/joueurs/modifier/:id", requireAuth, upload.single("image"), async (req, res) => {
    try {
        const { id } = req.params;
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles, 10) : null;

        const updateData = { nom, etoiles };

        if (req.file) {
            updateData.image = req.file.filename;
        }

        const { error } = await supabase
            .from("joueurs")
            .update(updateData)
            .eq("id", id);

        if (error) throw error;

        res.redirect("/joueurs/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/joueurs/supprimer/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error: errorScores } = await supabase
            .from("scores")
            .delete()
            .eq("joueur_id", id);

        if (errorScores) throw errorScores;

        const { error } = await supabase
            .from("joueurs")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.redirect("/joueurs/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== ROUTES SCORES =====================
app.get("/scores/ajouter", requireAuth, async (req, res) => {
    try {
        const { data: jeux, error: jeuxError } = await supabase
            .from("jeux")
            .select("id, nom")
            .order("nom");

        if (jeuxError) throw jeuxError;

        const { data: joueurs, error: joueursError } = await supabase
            .from("joueurs")
            .select("id, nom")
            .order("nom");

        if (joueursError) throw joueursError;

        const html = `
        <h2>📊 Ajouter / Modifier un score</h2>

        <form method="POST" action="/scores/ajouter">
          <label>Jeu :</label>
          <select name="jeu_id" required>
            <option value="">-- Choisir un jeu --</option>
            ${jeux.map((j) => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
          </select><br>

          <label>Joueur :</label>
          <select name="joueur_id" required>
            <option value="">-- Choisir un joueur --</option>
            ${joueurs.map((j) => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
          </select><br>

          <label>Score :</label>
          <input type="number" step="0.5" name="score" required><br>

          <button>Ajouter / Modifier</button>

          <div id="scoresJeu" class="result-box" style="display:none;"></div>
          <div id="scoreJoueur" class="result-box" style="display:none;"></div>
        </form>

        <a href="/menu">⬅ Retour</a>

        <script>
        async function majInfosScore() {
          const jeu = document.querySelector("[name='jeu_id']").value;
          const joueur = document.querySelector("[name='joueur_id']").value;

          const divJeu = document.getElementById("scoresJeu");
          const divJoueur = document.getElementById("scoreJoueur");
          const inputScore = document.querySelector("[name='score']");

          // ================= SCORES DU JEU =================
          if (jeu) {
            try {
              const res1 = await fetch('/api/scores-par-jeu?jeu_id=' + encodeURIComponent(jeu));
              const data1 = await res1.json();

              if (!data1 || data1.length === 0) {
                divJeu.innerHTML = "Aucun score pour ce jeu";
                divJeu.style.display = "block";
              } else {
                divJeu.innerHTML =
                  "<b>Scores existants :</b><br>" +
                  data1.map(s => (s.joueurs?.nom || "Joueur inconnu") + " : " + s.score).join("<br>");
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
              const resJ = await fetch('/api/scores-par-joueur?joueur_id=' + encodeURIComponent(joueur));
              const dataJ = await resJ.json();

              if (!dataJ || dataJ.length === 0) {
                divJoueur.style.display = "block";
                divJoueur.innerHTML = "<b>Ce joueur n'a encore donné aucun score.</b>";
              } else {
                divJoueur.style.display = "block";
                divJoueur.innerHTML =
                  "<b>Scores de ce joueur :</b><br>" +
                  dataJ.map(s => (s.jeux?.nom || "Jeu inconnu") + " : " + s.score).join("<br>");
              }
            } catch (e) {
              console.log("Erreur scores joueur", e);
            }
          } else {
            divJoueur.style.display = "none";
            divJoueur.innerHTML = "";
          }

          // ================= SCORE EXISTANT POUR CE COUPLE =================
          if (jeu && joueur) {
            try {
              const resS = await fetch('/api/score-existant?jeu_id=' + encodeURIComponent(jeu) + '&joueur_id=' + encodeURIComponent(joueur));
              const dataS = await resS.json();

              if (dataS && dataS.score !== undefined && dataS.score !== null) {
                inputScore.value = dataS.score;
              } else {
                inputScore.value = "";
              }
            } catch (e) {
              console.log("Erreur score existant", e);
            }
          } else {
            inputScore.value = "";
          }
        }

        document.addEventListener("DOMContentLoaded", () => {
          document.querySelector("[name='jeu_id']").addEventListener("change", majInfosScore);
          document.querySelector("[name='joueur_id']").addEventListener("change", majInfosScore);
        });
        </script>
        `;

        res.send(renderPage("Ajouter Score", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ================= SCORE EXISTANT =================
app.get("/api/score-existant", requireAuth, async (req, res) => {
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

app.post("/scores/ajouter", requireAuth, async (req, res) => {
    try {
        const { jeu_id, joueur_id, score } = req.body;

        const { error } = await supabase.from("scores").upsert(
            [{ jeu_id, joueur_id, score: Number(score) }],
            { onConflict: "jeu_id,joueur_id" }
        );

        if (error) throw error;

        res.send(
            renderPage(
                "Succès",
                "<h2>✅ Le score a été enregistré</h2><a href='/scores/ajouter'>⬅ Retour</a>"
            )
        );
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ================= SCORE(S) SI EXISTANT =================
app.get("/api/scores-par-jeu", requireAuth, async (req, res) => {
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
app.get("/api/scores-par-joueur", requireAuth, async (req, res) => {
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

// ===================== API FILTRER JEUX =====================
app.get("/api/filtrer-jeux", requireAuth, async (req, res) => {
    try {
        const minj = Math.max(0, Number(req.query.minj) || 0);
        const maxj = Math.max(0, Number(req.query.maxj) || 0);
        const tempsmax = Math.max(0, Number(req.query.tempsmax) || 0);
        const scoremin = Math.max(0, Number(req.query.scoremin) || 0);
        const status = req.query.status || "";

        const hasMinj = req.query.minj !== undefined && req.query.minj !== "";
        const hasMaxj = req.query.maxj !== undefined && req.query.maxj !== "";
        const hasTempsmax = req.query.tempsmax !== undefined && req.query.tempsmax !== "";
        const hasScoremin = req.query.scoremin !== undefined && req.query.scoremin !== "";

        const { data: jeux, error } = await supabase
            .from("jeux")
            .select(`
                id,
                nom,
                min_joueurs,
                max_joueurs,
                temps_max,
                statut,
                scores(
                    score,
                    joueurs(nom)
                )
            `);

        if (error) throw error;

        const resultat = jeux
            .map((j) => {
                let moyenne = null;
                let joueurs = [];

                if (j.scores && j.scores.length > 0) {
                    moyenne =
                        j.scores.reduce((a, b) => a + Number(b.score), 0) /
                        j.scores.length;

                    joueurs = j.scores.map(
                        (s) => `${s.joueurs?.nom || "?"} ${s.score}`
                    );
                }

                return {
                    ...j,
                    moyenne: moyenne !== null ? Number(moyenne.toFixed(2)) : null,
                    joueurs
                };
            })
            .filter((j) => {
                if (hasMinj && Number(j.min_joueurs) < minj) return false;
                if (hasMaxj && Number(j.max_joueurs) > maxj) return false;
                if (hasTempsmax && Number(j.temps_max) > tempsmax) return false;

                if (hasScoremin && (j.moyenne === null || j.moyenne < scoremin)) {
                    return false;
                }

                if (status === "Oui" && (!j.statut || j.statut.trim() === "")) {
                    return false;
                }

                return true;
            });

        res.json(resultat);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== MEILLEURS / PIRES JEUX =====================
app.get("/stats", requireAuth, async (req, res) => {
    try {
        const { data: joueurs, error } = await supabase
            .from("joueurs")
            .select("*")
            .order("nom");

        if (error) throw error;

        const options = joueurs
            .map((j) => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`)
            .join("");

        const html = `
        <h2>🥇 Top jeux 💀</h2>

        <form id="formStats">
          Choisir joueur:<br>
          <select name="joueur" id="choixJoueur">
            <option value="">-- Choisir --</option>
            <option value="all">Tous les joueurs</option>
            ${options}
          </select>
          <br>

          Nombre de jeux à afficher:<br>
          <input type="number" id="nbTop" value="5" min="1" max="50" style="width:90px;">
          <br>

          <button type="button" onclick="chargerStats()" style="width:150px;">🔄 Rafraîchir</button>
        </form>

        <div id="carte-joueur"></div>
        <div id="resultatsStats"></div>

        <a href="/menu">⬅ Retour</a>

        <script>
        async function chargerStats() {
          const joueur = document.getElementById("choixJoueur").value;
          const nb = document.getElementById("nbTop")?.value || 5;
          const div = document.getElementById("resultatsStats");

          if (!joueur) {
            div.innerHTML = "";
            return;
          }

          try {
            const res = await fetch("/api/stats?joueur=" + encodeURIComponent(joueur) + "&nb=" + encodeURIComponent(nb));
            const data = await res.json();

            if (!data || !data.meilleurs) {
              div.innerHTML = "<div class='result-box'>Aucune donnée</div>";
              return;
            }

            let html = "";

            html += "<div class='result-box'><h3>🏆 Meilleurs jeux</h3>";
            if (data.meilleurs.length === 0) {
              html += "Aucune donnée";
            } else {
              data.meilleurs.forEach(j => {
                html += j.jeu + " (" + j.moyenne.toFixed(2) + ")<br>";
              });
            }
            html += "</div>";

            html += "<div class='result-box'><h3>💀 Pires jeux</h3>";
            if (data.pires.length === 0) {
              html += "Aucune donnée";
            } else {
              data.pires.forEach(j => {
                html += j.jeu + " (" + j.moyenne.toFixed(2) + ")<br>";
              });
            }
            html += "</div>";

            div.innerHTML = html;
          } catch (e) {
            div.innerHTML = "<div class='result-box'>Erreur</div>";
          }
        }

        document.addEventListener("DOMContentLoaded", () => {
          const select = document.getElementById("choixJoueur");
          const nbTop = document.getElementById("nbTop");

          select.addEventListener("change", chargerStats);
          nbTop.addEventListener("change", chargerStats);
        });
        </script>
        `;

        res.send(renderPage("Statistiques", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// =========== ROUTE API STATS ===============
app.get("/api/stats", requireAuth, async (req, res) => {
    try {
        const joueur = req.query.joueur;
        const nb = Number(req.query.nb) || 5;

        let query = supabase
            .from("scores")
            .select(`
                score,
                joueur_id,
                jeux ( nom )
            `);

        if (joueur !== "all") {
            query = query.eq("joueur_id", joueur);
        }

        const { data: scores, error } = await query;
        if (error) throw error;

        if (!scores || !scores.length) {
            return res.json({ meilleurs: [], pires: [] });
        }

        const stats = {};

        scores.forEach((s) => {
            const nomJeu = s.jeux?.nom;
            if (!nomJeu) return;

            if (!stats[nomJeu]) stats[nomJeu] = { total: 0, count: 0 };
            stats[nomJeu].total += Number(s.score);
            stats[nomJeu].count += 1;
        });

        const resultats = Object.keys(stats).map((jeu) => ({
            jeu,
            moyenne: stats[jeu].total / stats[jeu].count
        }));

        resultats.sort((a, b) => b.moyenne - a.moyenne);

        res.json({
            meilleurs: resultats.slice(0, nb),
            pires: resultats.slice(-nb).reverse()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== FILTRAGES =====================
app.get("/filtrages", requireAuth, (req, res) => {
    const html = `
    <h2>🔍 Filtrer les jeux</h2>

    <div class="result-box">
      <form id="formFiltre">
        <label>👤 Joueurs minimum :</label>
        <input type="number" name="minj" min="0" style="width:90px;"><br>

        <label>👥 Joueurs maximum :</label>
        <input type="number" name="maxj" min="0" style="width:90px;"><br>

        <label>⌛ Temps maximum :</label>
        <input type="number" name="tempsmax" min="0" style="width:110px;">
        <label>(minutes)</label><br>

        <label>⭐ Score moyen minimum :</label>
        <input type="number" step="0.1" name="scoremin" min="0" style="width:90px;"><br>

        <label>Status :</label><br>
        <select name="status" style="width:80px;">
          <option value=""></option>
          <option value="Oui">Oui</option>
        </select>
        <br><br>

        <button type="submit" style="width:auto;">Rechercher</button>
        <button type="button" id="btnVider" style="width:auto; margin-left:8px;">Vider</button>
      </form>
    </div>

    <div id="resultatsFiltre"></div>

    <a href="/menu">⬅ Retour</a>

    <script>
    const formFiltre = document.getElementById("formFiltre");
    const divResultats = document.getElementById("resultatsFiltre");
    const btnVider = document.getElementById("btnVider");

    formFiltre.addEventListener("submit", async function(e) {
      e.preventDefault();

      const params = new URLSearchParams(new FormData(this));

      try {
        const res = await fetch("/api/filtrer-jeux?" + params.toString());
        const data = await res.json();

        if (!res.ok) {
          divResultats.innerHTML = "<div class='result-box'>Erreur : " + (data.error || "Impossible de filtrer") + "</div>";
          return;
        }

        if (!Array.isArray(data) || data.length === 0) {
          divResultats.innerHTML = "<div class='result-box'>Aucun jeu trouvé</div>";
          return;
        }

        data.sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));

        divResultats.innerHTML =
          "<div class='result-box'><b>Résultats (Moyenne-Score) :</b><br>" +
          data.map(j =>
            j.nom +
            " — " + (j.moyenne ?? "—") +
            (j.joueurs?.length ? " (" + j.joueurs.join(", ") + ")" : "") +
            (j.statut && j.statut.trim() !== "" ? " — Status: " + j.statut : "")
          ).join("<br>") +
          "</div>";

      } catch (err) {
        divResultats.innerHTML = "<div class='result-box'>Erreur JavaScript : " + err.message + "</div>";
      }
    });

    btnVider.addEventListener("click", () => {
      formFiltre.reset();
      divResultats.innerHTML = "";
    });
    </script>
    `;

    res.send(renderPage("Filtrages", html));
});

// ===================== ROUTES COMPÉTITIONS =====================
app.get("/competitions/liste", requireAuth, async (req, res) => {
    try {
        const { data: comps, error } = await supabase
            .from("competitions")
            .select("*")
            .order("nom");

        if (error) throw error;

        let html = "<h2>Compétitions</h2><ul>";

        comps.forEach((c) => {
            html += `<li>${escapeHtml(c.nom)} - Objectif: ${escapeHtml(c.objectif || "")}</li>`;
        });

        html += "</ul><a href='/menu'>⬅ Retour</a>";

        res.send(renderPage("Compétitions", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== SERVEUR =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));