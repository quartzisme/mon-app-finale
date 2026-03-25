// server.js 
import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import multer from "multer";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";
import fs from "fs/promises";

import { supabase } from "./supabaseClient.js";



dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// ===================== BGG seulement =====================
function normalizeScoreValue(value) {
    if (value === undefined || value === null || value === "") return null;
    const normalized = String(value).replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

function isHalfStep(value) {
    return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

// ===================== Middleware =====================
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    })
);
// ===================== app standalone =====================
app.use(express.static(join(__dirname, "public"), { index: false }));

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

function formatPrixCAD(value) {
    if (value === undefined || value === null || value === "") return "—";
    return Number(value).toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " $";
}

function getGameImageUrl(filename) {
    if (!filename) return "";
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/jeux-images/${filename}`;
}

function formatPrixCAD(value) {
    if (value === undefined || value === null || value === "") return "—";
    return Number(value).toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " $";
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/images"),
    filename: (req, file, cb) => {
        const baseRaw = req.body.nom || req.body.nom_jeu || "image";
        const base = safeFileBaseName(baseRaw);
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        cb(null, `${base}_${file.fieldname}_${Date.now()}${ext}`);
    }
});

const upload = multer({ storage });

app.use("/images", express.static(join(__dirname, "public/images")));
app.use("/sounds", express.static(join(__dirname, "public/sounds")));
app.use("/sounds", express.static(join(__dirname, "public")));

function renderPage(title, content) {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <link rel="manifest" href="/manifest.webmanifest">
      <link rel="apple-touch-icon" href="/apple-touch-icon.png">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-title" content="Jeux">
      <meta name="theme-color" content="#c97a00">

        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <style>
          .menu-item a {
            display: block;
            padding: 10px 12px;
            border-radius: 8px;
            background: white;
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          }

          .menu-item a:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(0,0,0,0.18);
            background: #f7fbff;
          }

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

          .table-wrap {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .game-thumb {
            cursor: pointer;
            border-radius: 8px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }

          .game-thumb:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 16px rgba(0,0,0,0.18);
          }

          .zoomed-game-image {
            text-align: center;
          }

          .zoomed-game-image img {
            max-width: min(90vw, 700px);
            max-height: 80vh;
            width: auto;
            height: auto;
            border-radius: 12px;
            box-shadow: 0 10px 24px rgba(0,0,0,0.22);
          }

          @media (max-width: 600px) {
            body {
              font-size: 17px;
            }

            .jeux-table {
              font-size: 14px;
              min-width: 760px;
            }

            .jeux-table th,
            .jeux-table td {
              padding: 6px;
              white-space: nowrap;
            }

            .page-container {
              padding: 10px;
            }
          }
            .player-card {
              transition: transform 0.18s ease, box-shadow 0.18s ease;
              transform-origin: center center;
              position: relative;
            }

            .player-card:hover,
            .player-card.expanded {
              transform: scale(1.06);
              z-index: 5;
              box-shadow: 0 10px 22px rgba(0,0,0,0.28);
            }
            .zoom-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.7);
              display: none;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              padding: 20px;
            }

            .zoom-overlay.show {
              display: flex;
            }

            .zoom-box {
              background: white;
              border-radius: 16px;
              padding: 14px;
              max-width: min(92vw, 700px);
              max-height: 90vh;
              overflow: auto;
              transform: scale(0.88);
              transition: transform 0.18s ease;
            }

            .zoom-overlay.show .zoom-box {
              transform: scale(1);
            }

            .player-card {
              transition: transform 0.18s ease, box-shadow 0.18s ease;
              cursor: pointer;
            }

            .player-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 20px rgba(0,0,0,0.18);
            }   
            .zoom-box {
              background: white;
              border-radius: 16px;
              padding: 20px;
              max-width: min(96vw, 1000px);
              max-height: 90vh;
              overflow: auto;
              transform: scale(0.88);
              transition: transform 0.18s ease;
            }

            .zoom-overlay.show .zoom-box {
              transform: scale(1);
            }

            .zoomed-card-wrap {
              display: flex;
              justify-content: center;
              padding: 20px 10px;
            }

            .zoomed-card-wrap .player-card {
              width: min(800px, 100%);
              transform: scale(1.28);
              transform-origin: top center;
              margin: 40px auto;
              cursor: default;
            }

            .zoomed-card-wrap .player-card:hover {
              transform: scale(1.28);
              box-shadow: 0 12px 24px rgba(0,0,0,0.22);
            }
            .joueur-mini-carte {
              display: inline-block;
              text-align: center;
              padding: 10px;
              border-radius: 12px;
              background: #f8fbff;
              box-shadow: 0 3px 10px rgba(0,0,0,0.12);
              transition: transform 0.18s ease, box-shadow 0.18s ease;
              cursor: pointer;
              min-width: 100px;
            }

            .joueur-mini-carte:hover {
              transform: scale(1.06);
              box-shadow: 0 10px 20px rgba(0,0,0,0.18);
            }

            .col-center {
            text-align: center;
            }

            .col-right {
            text-align: right;
            }   

            .zoomed-player-card {
              text-align: center;
              padding: 18px;
              border-radius: 18px;
              background: #f8fbff;
              box-shadow: 0 10px 22px rgba(0,0,0,0.18);
              width: min(320px, 90vw);
              margin: 0 auto;
            }

            .zoomed-player-card img {
              max-width: 220px;
              width: 100%;
              height: auto;
              border-radius: 12px;
            }

            .zoomed-player-card .nom {
              font-size: 1.25em;
              font-weight: bold;
              margin-top: 10px;
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
        if (!music) return;

        const playPromise = music.play();

        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const demarrer = () => music.play().catch(() => {});
            document.body.addEventListener("click", demarrer, { once: true });
            document.body.addEventListener("touchstart", demarrer, { once: true });
          });
        }
      });

      function togglePassword() {
        const p = document.getElementById("password");
        const eye = document.getElementById("toggle-eye");

        if (p.type === "password") {
          p.type = "text";
          eye.textContent = "🙈";
        } else {
          p.type = "password";
          eye.textContent = "👀";
        }
      }

      function toggleMusic() {
        const music = document.getElementById("music");
        const btn = document.getElementById("music-toggle");
        if (!music || !btn) return;

        music.muted = !music.muted;
        btn.textContent = music.muted ? "🔇" : "🔊";
      }
    </script>

    <style>
      .login-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        text-align: center;
      }

      .login-image {
        display: block;
        margin: 10px auto 20px auto;
        max-width: 220px;
        width: 100%;
        height: auto;
      }

      .login-form {
        width: 100%;
        max-width: 420px;
      }

      .password-wrap {
        position: relative;
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
      }

      .password-wrap input {
        width: 100%;
        padding-right: 48px;
      }

      .password-toggle {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        box-shadow: none;
        cursor: pointer;
        font-size: 20px;
        padding: 0;
      }

      .password-toggle:hover {
        transform: translateY(-50%);
        box-shadow: none;
      }

      .login-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 10px;
      }

      .login-actions button {
        width: auto;
        min-width: 90px;
      }

      @media (max-width: 600px) {
        .login-image {
          max-width: 170px;
        }
      }
    </style>

    <div class="login-wrapper">
      <img src="/images/de.jpg" class="login-image" alt="Logo"><br>

      <form method="POST" action="/login" class="login-form">
        <input name="username" placeholder="Usager" required><br>

        <div class="password-wrap">
          <input type="password" id="password" name="password" placeholder="Mot de passe" required>
          <button type="button" id="toggle-eye" class="password-toggle" onclick="togglePassword()" aria-label="Afficher ou masquer le mot de passe">👀</button>
        </div>

        <div class="login-actions">
          <button type="submit">Entrer</button>
          <button type="button" id="music-toggle" onclick="toggleMusic()">🔊</button>
          <div style="color:#666; font-size: 10px;"> ver 1.D</div>
        </div>
      </form>
    </div>
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
            <li class="menu-item"><a href="/jeux/liste">⚔️ Jeux</a></li>
            <li class="menu-item"><a href="/joueurs/liste">👥 Joueurs</a></li>
            <li class="menu-item"><a href="/scores/ajouter">📊 Inscription des Scores</a></li>
            <li class="menu-item"><a href="/stats">🥇 Meilleurs / 💀 Pires jeux</a></li>
            <li class="menu-item"><a href="/filtrages">🔍 Filtrages</a></li>
            <li class="menu-item"><a href="/competitions/liste">🏆 Compétitions</a></li>
            <li class="menu-item"><a href="/jeux-en-cours">⏸️ Jeux en cours / Souvenir</a></li>
            <li class="menu-item"><a href="/jeux-desires">🛒 Jeux désirés</a></li>
            <li class="menu-item"><a href="/logout">⏻ Déconnexion</a></li>
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
app.get("/jeux/liste", requireAuth, async (req, res) => {
    try {
        const { data: jeux, error } = await supabase
            .from("jeux")
            .select(`
                id,
                nom,
                image,
                extensions,
                min_joueurs,
                max_joueurs,
                temps_min,
                temps_max,
                statut,
                bgg_average_rating,
                scores(score)
            `)
            .order("nom");

        if (error) throw error;

        let html = `
        <h2>⚔️ Liste des jeux</h2>

        <button onclick="window.location.href='/jeux/ajouter'">Ajouter un jeu</button><br>
        <button onclick="window.location.href='/jeux/gerer'">Modifier / Supprimer un jeu</button><br><br>

        <input id="rechercheJeu" placeholder="Rechercher un jeu..." style="max-width:300px;"><br><br>

        <a href="/menu">⬅ Retour</a><br><br>

        <div class="table-wrap">
          <table class="jeux-table">
            <tr>
              <th class="col-center">#</th>
              <th>Image</th>
              <th>Nom</th>
              <th>Extensions</th>
              <th class="col-center">Joueurs</th>
              <th>Temps</th>
              <th>Statut</th>
              <th class="col-right">⬢ BGG</th>
              <th class="col-right">⭐ Moyenne</th>
            </tr>
        `;

        (jeux || []).forEach((j, index) => {
            let moyenne = "—";

            if (j.scores && j.scores.length > 0) {
                const avg =
                    j.scores.reduce((a, b) => a + Number(b.score), 0) /
                    j.scores.length;
                moyenne = avg.toFixed(2);
            }

            const imageSrc = j.image ? getGameImageUrl(j.image) : "";

            html += `
            <tr data-jeu="${escapeHtml(
                (j.nom || "") + " " +
                (j.extensions || "") + " " +
                (j.statut || "")
            )}">
              <td class="col-center">${index + 1}</td>
              <td>${
                  j.image
                      ? `<img src="${imageSrc}" class="game-thumb" width="55" onclick="ouvrirZoomJeu('${imageSrc}', '${escapeHtml(j.nom || "")}')">`
                      : "—"
              }</td>
              <td><b>${escapeHtml(j.nom || "")}</b></td>
              <td>${escapeHtml(j.extensions || "") || "—"}</td>
              <td class="col-center">${j.min_joueurs ?? "—"}-${j.max_joueurs ?? "—"}</td>
              <td>${j.temps_min ?? "—"}-${j.temps_max ?? "—"} min</td>
              <td>${escapeHtml(j.statut || "") || "—"}</td>
              <td class="col-right">${
                  j.bgg_average_rating !== null && j.bgg_average_rating !== undefined
                      ? `<span style="color:#1e88e5; font-size:1.15em;">⬢</span> ${j.bgg_average_rating}`
                      : "—"
              }</td>
              <td class="col-right"><strong>${moyenne}</strong></td>
            </tr>
            `;
        });

        html += `
          </table>
        </div>

        <div id="zoomOverlayJeu" class="zoom-overlay" onclick="fermerZoomJeu()">
          <div class="zoom-box" id="zoomBoxJeu" onclick="event.stopPropagation()"></div>
        </div>

        <br>
        <a href="/menu">⬅ Retour</a>

        <script>
        document.addEventListener("DOMContentLoaded", () => {
          const champ = document.getElementById("rechercheJeu");
          if (!champ) return;

          champ.addEventListener("input", () => {
            const q = champ.value.toLowerCase().trim();
            document.querySelectorAll(".jeux-table tr[data-jeu]").forEach(row => {
              const txt = (row.getAttribute("data-jeu") || "").toLowerCase();
              row.style.display = txt.includes(q) ? "" : "none";
            });
          });
        });

        function ouvrirZoomJeu(src, nom) {
          const overlay = document.getElementById("zoomOverlayJeu");
          const box = document.getElementById("zoomBoxJeu");
          if (!overlay || !box) return;

          box.innerHTML =
            "<div class='zoomed-game-image'>" +
              "<img src='" + src + "' alt='" + nom + "'>" +
              "<div style='margin-top:10px; font-weight:bold;'>" + nom + "</div>" +
            "</div>";

          overlay.classList.add("show");
        }

        function fermerZoomJeu() {
          const overlay = document.getElementById("zoomOverlayJeu");
          if (overlay) overlay.classList.remove("show");
        }
        </script>
        `;

        res.send(renderPage("Liste des jeux", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== AJOUTER JEU =====================
app.post("/jeux/ajouter", requireAuth, upload.single("image"), async (req, res) => {
    try {
        const {
            nom,
            extensions,
            min_joueurs,
            max_joueurs,
            temps_min,
            temps_max,
            statut,
            bgg_average_rating,
            rotation
        } = req.body;

        let image = null;
        const rotationAngle = Number(rotation || 0);

        if (req.file) {
            const inputPath = req.file.path;
            const outputName = `jeu_${safeFileBaseName(nom || "image")}_${Date.now()}.jpg`;

            const buffer = await sharp(inputPath)
                .rotate(rotationAngle)
                .resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 82 })
                .toBuffer();

            const { error: uploadError } = await supabase.storage
                .from("jeux-images")
                .upload(outputName, buffer, {
                    contentType: "image/jpeg",
                    upsert: true
                });

            await fs.unlink(inputPath);

            if (uploadError) throw uploadError;
            image = outputName;
        }

        const { error } = await supabase.from("jeux").insert([{
            nom: nom?.trim(),
            extensions: extensions?.trim() || null,
            min_joueurs: toIntOrNull(min_joueurs),
            max_joueurs: toIntOrNull(max_joueurs),
            temps_min: toIntOrNull(temps_min),
            temps_max: toIntOrNull(temps_max),
            statut: statut?.trim() || null,
            bgg_average_rating: bgg_average_rating ? Number(bgg_average_rating) : null,
            image
        }]);

        if (error) throw error;

        res.redirect("/jeux/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.get("/jeux/ajouter", requireAuth, (req, res) => {
    const html = `
        <h2>Ajouter un jeu</h2>

        <div class="result-box">
        <form method="POST" action="/jeux/ajouter" enctype="multipart/form-data">
            Nom:<br>
            <input name="nom" required><br>

            Extensions:<br>
            <input name="extensions"><br>

            Joueurs min:<br>
            <input type="number" name="min_joueurs" min="0"><br>

            Joueurs max:<br>
            <input type="number" name="max_joueurs" min="0"><br>

            Temps min:<br>
            <input type="number" name="temps_min" min="0"><br>

            Temps max:<br>
            <input type="number" name="temps_max" min="0"><br>

            Statut:<br>
            <input name="statut" placeholder="À vendre / Vendu"><br>

            Rotation de l'image:<br>
            <select name="rotation" style="max-width:120px;">
                <option value="0">0°</option>
                <option value="90">90°</option>
                <option value="180">180°</option>
                <option value="270">270°</option>
            </select><br>

            Image:<br>
            <input type="file" name="image" accept="image/*"><br><br>

            <button>Ajouter</button>
        </form>
        </div>

        <a href="/jeux/liste">⬅ Retour</a>
    `;

    res.send(renderPage("Ajouter jeu", html));
});

app.get("/jeux/gerer", requireAuth, async (req, res) => {
    try {
        const { data: jeux, error } = await supabase
            .from("jeux")
            .select("id, nom")
            .order("nom");

        if (error) throw error;

        const html = `
        <h2>Modifier / Supprimer un jeu</h2>

        <div class="result-box">
            <form method="GET" action="/jeux/modifier">
                Modifier ce jeu:<br>
                <select name="id" required>
                    <option value="">-- Choisir --</option>
                    ${jeux.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
                </select><br><br>

                <button type="submit">✏ Modifier</button>
            </form>
        </div>

        <div class="result-box">
            <form method="POST" action="/jeux/supprimer" onsubmit="return confirm('Supprimer ce jeu ?');">
                Supprimer ce jeu:<br>
                <select name="id" required>
                    <option value="">-- Choisir --</option>
                    ${jeux.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
                </select><br><br>

                <button type="submit">🗑 Supprimer</button>
            </form>
        </div>

        <a href="/jeux/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Gérer les jeux", html));
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

        <div class="result-box">
        <form method="POST" action="/jeux/modifier" enctype="multipart/form-data">
          <input type="hidden" name="id" value="${jeu.id}">

          Nom<br>
          <input name="nom" value="${escapeHtml(jeu.nom || "")}" required><br>

          Extensions<br>
          <input name="extensions" value="${escapeHtml(jeu.extensions || "")}"><br>

          Joueurs min<br>
          <input type="number" name="min_joueurs" min="0" value="${jeu.min_joueurs ?? ""}"><br>

          Joueurs max<br>
          <input type="number" name="max_joueurs" min="0" value="${jeu.max_joueurs ?? ""}"><br>

          Temps min<br>
          <input type="number" name="temps_min" min="0" value="${jeu.temps_min ?? ""}"><br>

          Temps max<br>
          <input type="number" name="temps_max" min="0" value="${jeu.temps_max ?? ""}"><br>

          Statut<br>
          <input name="statut" value="${escapeHtml(jeu.statut || "")}"><br>

          BGG average rating<br>
          <input type="number" step="0.01" min="0" max="10" name="bgg_average_rating" value="${jeu.bgg_average_rating ?? ""}"><br>

          ${jeu.image ? `<div>Image actuelle :<br><img src="${getGameImageUrl(jeu.image)}" width="90"></div><br>` : ""}

          Rotation de l'image:<br>
          <select name="rotation" style="max-width:120px;">
              <option value="0">0°</option>
              <option value="90">90°</option>
              <option value="180">180°</option>
              <option value="270">270°</option>
          </select><br><br>          
          Nouvelle image<br>
          <input type="file" name="image" accept="image/*"><br><br>

          <button type="submit">Enregistrer</button>
        </form>
        </div>
        <a href="/jeux/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Modifier jeu", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux/modifier", requireAuth, upload.single("image"), async (req, res) => {
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
            bgg_average_rating,
            rotation
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
            bgg_average_rating: bgg_average_rating ? Number(bgg_average_rating) : null
        };

        const rotationAngle = Number(rotation || 0);

        if (req.file) {
            const inputPath = req.file.path;
            const outputName = `jeu_${safeFileBaseName(nom || "image")}_${Date.now()}.jpg`;

            const buffer = await sharp(inputPath)
                .rotate(rotationAngle)
                .resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 82 })
                .toBuffer();

            const { error: uploadError } = await supabase.storage
                .from("jeux-images")
                .upload(outputName, buffer, {
                    contentType: "image/jpeg",
                    upsert: true
                });

            await fs.unlink(inputPath);

            if (uploadError) throw uploadError;
            updateData.image = outputName;
        }

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
        const { data: joueursBrut, error } = await supabase
            .from("joueurs")
            .select(`
                *,
                scores(score)
            `)
            .order("nom");

        if (error) throw error;

        const ordrePrincipal = ["VINCENT", "MARC", "JULIE"];

        const joueurs = [...(joueursBrut || [])].sort((a, b) => {
            const na = String(a.nom || "").trim().toUpperCase();
            const nb = String(b.nom || "").trim().toUpperCase();

            const aBGG = na === "BGG";
            const bBGG = nb === "BGG";
            if (aBGG !== bBGG) return aBGG ? 1 : -1;

            const ia = ordrePrincipal.indexOf(na);
            const ib = ordrePrincipal.indexOf(nb);

            const aPrincipal = ia !== -1;
            const bPrincipal = ib !== -1;

            if (aPrincipal && bPrincipal) return ia - ib;
            if (aPrincipal !== bPrincipal) return aPrincipal ? -1 : 1;

            return na.localeCompare(nb, "fr", { sensitivity: "base" });
        });

        const { count: totalJeux, error: totalJeuxError } = await supabase
            .from("jeux")
            .select("*", { count: "exact", head: true });

        if (totalJeuxError) throw totalJeuxError;

        const rows = await Promise.all(
            joueurs.map(async (j) => {
                const isBGG = String(j.nom || "").trim().toUpperCase() === "BGG";
                const nbScores = j.scores ? j.scores.length : 0;
                const moyenneGlobale = nbScores
                    ? (j.scores.reduce((a, b) => a + Number(b.score), 0) / nbScores).toFixed(2)
                    : "—";               
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

                const imageSrc = j.image ? `/images/${encodeURIComponent(j.image)}` : "";
                const nomSafe = escapeHtml(j.nom || "");
                const etoilesTexte = isBGG ? "" : `⭐ ${j.etoiles || 0}`;

                return `
                <div class="result-box" style="margin-bottom:15px;">
                  <table style="width:100%;">
                    <tr>
                      <td style="width:150px; text-align:center; vertical-align:top;">
                        <div class="joueur-mini-carte"
                             onclick="ouvrirZoomCarteJoueur(this)"
                             data-image="${imageSrc}"
                             data-nom="${nomSafe}"
                             data-etoiles="${escapeHtml(etoilesTexte)}">
                          ${j.image ? `<img src="${imageSrc}" width="80"><br>` : ""}
                          <strong>${nomSafe}</strong><br>
                          ${isBGG ? "" : `⭐ ${j.etoiles || 0}`}
                        </div>
                      </td>

                      <td style="vertical-align:top;">
                        <b>🧩 Jeux évalués :</b> ${nbScores} (${pourcentage}%)
                        <div><b><span style="color:#FFD700; font-size:1.2em;">x̄</span> Moyenne des scores :</b> ${moyenneGlobale}</div>

                        <div><b>🔝 Meilleur(s) jeu-score :</b> ${escapeHtml(bestJeuHTML)}</div>
                        <br>

                        <form method="GET" action="/joueurs/modifier/${j.id}" class="inline-form">
                          <button type="submit" style="width:auto;">✏ Modifier</button>
                        </form>
                        &nbsp;

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

        <div id="zoomOverlay" class="zoom-overlay" onclick="fermerZoomJoueur()">
          <div class="zoom-box" id="zoomBox" onclick="event.stopPropagation()"></div>
        </div>

        <script>
        function ouvrirZoomCarteJoueur(el) {
          const overlay = document.getElementById("zoomOverlay");
          const box = document.getElementById("zoomBox");
          if (!overlay || !box || !el) return;

          const image = el.dataset.image || "";
          const nom = el.dataset.nom || "";
          const etoiles = el.dataset.etoiles || "";

          box.innerHTML =
            "<div class='zoomed-player-card'>" +
              (image ? "<img src='" + image + "' alt='Carte joueur'><br>" : "") +
              "<div class='nom'>" + nom + "</div>" +
              (etoiles ? "<div style='margin-top:8px; font-size:1.1em;'>" + etoiles + "</div>" : "") +
            "</div>";

          overlay.classList.add("show");
        }

        function fermerZoomJoueur() {
          const overlay = document.getElementById("zoomOverlay");
          if (overlay) overlay.classList.remove("show");
        }

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") fermerZoomJoueur();
        });
        </script>

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

            Carte du joueur:<br>
            <input type="file" name="image" accept="image/*"><br>

            Photo souvenir:<br>
            <input type="file" name="photo" accept="image/*"><br><br>

            <button>Ajouter</button>
        </form>
        <a href="/joueurs/liste">⬅ Retour</a>
    `;
    res.send(renderPage("Ajouter joueur", html));
});

app.post("/joueurs/ajouter", requireAuth, upload.fields([
    { name: "image", maxCount: 1 },
    { name: "photo", maxCount: 1 }
]), async (req, res) => {
    try {
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles, 10) : null;

        const image = req.files?.image?.[0]?.filename || null;
        const photo = req.files?.photo?.[0]?.filename || null;

        const { error } = await supabase
            .from("joueurs")
            .insert([{ nom, etoiles, image, photo }]);

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
            <div class="result-box">
            <form method="POST" action="/joueurs/modifier/${id}" enctype="multipart/form-data">
                Nom:<br>
                <input name="nom" value="${escapeHtml(joueur.nom || "")}" required><br>

                ⭐ Étoiles:<br>
                <input type="number" name="etoiles" value="${joueur.etoiles || 0}"><br>

                Carte du joueur:<br>
                <input type="file" name="image" accept="image/*"><br>

                Photo souvenir:<br>
                <input type="file" name="photo" accept="image/*"><br><br>

                <button>Modifier</button>
            </form>
            </div>
            <a href="/joueurs/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Modifier joueur", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

    app.post("/joueurs/modifier/:id", requireAuth, upload.fields([
        { name: "image", maxCount: 1 },
        { name: "photo", maxCount: 1 }
    ]), async (req, res) => {
    try {
        const { id } = req.params;
        const nom = req.body.nom;
        const etoiles = req.body.etoiles ? parseInt(req.body.etoiles, 10) : null;

        let updateData = { nom, etoiles };

        if (req.files?.image?.[0]) {
            updateData.image = req.files.image[0].filename;
        }

        if (req.files?.photo?.[0]) {
            updateData.photo = req.files.photo[0].filename;
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
            .select("id, nom, image")
            .order("nom");

        if (jeuxError) throw jeuxError;

        const { data: joueursBrut, error: joueursError } = await supabase
            .from("joueurs")
            .select("id, nom, image")
            .order("nom");

        if (joueursError) throw joueursError;

        const ordrePrincipal = ["VINCENT", "MARC", "JULIE"];

        const joueurs = [...(joueursBrut || [])].sort((a, b) => {
            const na = String(a.nom || "").trim().toUpperCase();
            const nb = String(b.nom || "").trim().toUpperCase();

            const aBGG = na === "BGG";
            const bBGG = nb === "BGG";
            if (aBGG !== bBGG) return aBGG ? 1 : -1;

            const ia = ordrePrincipal.indexOf(na);
            const ib = ordrePrincipal.indexOf(nb);

            const aPrincipal = ia !== -1;
            const bPrincipal = ib !== -1;

            if (aPrincipal && bPrincipal) return ia - ib;
            if (aPrincipal !== bPrincipal) return aPrincipal ? -1 : 1;

            return na.localeCompare(nb, "fr", { sensitivity: "base" });
        });

        const joueursJson = JSON.stringify(joueurs).replace(/</g, "\\u003c");
        const jeuxJson = JSON.stringify(jeux || []).replace(/</g, "\\u003c");

const html = `
<h2>📊 Ajouter / Modifier un score</h2>

<div class="result-box">
<form method="POST" action="/scores/ajouter" id="formScore">

<label>Jeu :</label>
<select name="jeu_id" required>
<option value="">-- Choisir un jeu --</option>
${jeux.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
</select><br>

<label>Joueur :</label>
<select name="joueur_id" required>
<option value="">-- Choisir un joueur --</option>
${joueurs.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
</select><br>

<label>Score :</label>
<input type="number" step="0.5" min="0" max="10" name="score" id="champScore" required><br>
<div id="aideScore" style="font-size:0.72em; color:#666; line-height:1.2; margin:2px 0 10px 2px; font-style:italic; opacity:0.95;"></div>

<button>Ajouter / Modifier</button>

<div id="scoresJeu" class="result-box" style="display:none;"></div>
<div id="scoreJoueur" class="result-box" style="display:none;"></div>

</form>
</div>

<a href='/menu'>⬅ Retour</a>

<script>
const joueursData = ${joueursJson};
const jeuxData = ${jeuxJson};

function joueurEstBGG(joueurId) {
  const j = joueursData.find(x => String(x.id) === String(joueurId));
  return !!j && String(j.nom || "").trim().toUpperCase() === "BGG";
}

function configurerChampScore() {
  const joueurId = document.querySelector("[name='joueur_id']").value;
  const inputScore = document.getElementById("champScore");
  const aide = document.getElementById("aideScore");

  if (joueurEstBGG(joueurId)) {
    inputScore.step = "any";
    inputScore.placeholder = "Ex. 7.6";
    aide.innerHTML = "BGG : décimales libres autorisées (ex. 7,6 ou 7.6).";
  } else {
    inputScore.step = "0.5";
    inputScore.placeholder = "Ex. 7.5 ou 8.0";
    aide.innerHTML = "Joueurs : seulement des valeurs en ,0 ou ,5.";
  }
}

async function majInfosScore() {
  const jeu = document.querySelector("[name='jeu_id']").value;
  const joueur = document.querySelector("[name='joueur_id']").value;

  const divJeu = document.getElementById("scoresJeu");
  const divJoueur = document.getElementById("scoreJoueur");
  const inputScore = document.getElementById("champScore");

  configurerChampScore();

  if (jeu) {
    try {
        const jeuInfo = jeuxData.find(x => String(x.id) === String(jeu));
        const jeuImage = jeuInfo?.image ? getGameImageUrl(jeuInfo.image) : "";

        if (!data1 || data1.length === 0) {
        divJeu.innerHTML =
            (jeuImage ? "<img src='" + jeuImage + "' width='70'><br>" : "") +
            "<b>" + (jeuInfo?.nom || "Jeu") + "</b><br>Aucun score pour ce jeu";
        divJeu.style.display = "block";
        } else {
        divJeu.innerHTML =
            (jeuImage ? "<img src='" + jeuImage + "' width='70'><br>" : "") +
            "<b>" + (jeuInfo?.nom || "Jeu") + "</b><br><br>" +
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

  if (joueur) {
    try {
        const joueurInfo = joueursData.find(x => String(x.id) === String(joueur));
        const joueurImage = joueurInfo?.image ? "/images/" + encodeURIComponent(joueurInfo.image) : "";

        if (!dataJ || dataJ.length === 0) {
        divJoueur.style.display = "block";
        divJoueur.innerHTML =
            (joueurImage ? "<img src='" + joueurImage + "' width='70'><br>" : "") +
            "<b>" + (joueurInfo?.nom || "Joueur") + "</b><br>" +
            "<b>Ce joueur n'a encore donné aucun score.</b>";
        } else {
        divJoueur.style.display = "block";
        divJoueur.innerHTML =
            (joueurImage ? "<img src='" + joueurImage + "' width='70'><br>" : "") +
            "<b>" + (joueurInfo?.nom || "Joueur") + "</b><br><br>" +
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
  configurerChampScore();

  document.getElementById("formScore").addEventListener("submit", function(e) {
    const joueurId = document.querySelector("[name='joueur_id']").value;
    const raw = document.getElementById("champScore").value.replace(",", ".");
    const n = Number(raw);

    if (!Number.isFinite(n)) {
      e.preventDefault();
      alert("Le score est invalide.");
      return;
    }

    if (!joueurEstBGG(joueurId)) {
      const demi = Math.round(n * 2) / 2;
      if (Math.abs(n - demi) > 1e-9) {
        e.preventDefault();
        alert("Pour les joueurs, le score doit être en ,0 ou ,5.");
      }
    }
  });
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
        const { jeu_id, joueur_id } = req.body;
        const score = normalizeScoreValue(req.body.score);

        if (!jeu_id || !joueur_id || score === null) {
            return res.send(renderPage("Erreur", "Données de score invalides."));
        }

        const { data: joueur, error: joueurError } = await supabase
            .from("joueurs")
            .select("id, nom")
            .eq("id", joueur_id)
            .single();

        if (joueurError) throw joueurError;

        const estBGG = String(joueur?.nom || "").trim().toUpperCase() === "BGG";

        if (!estBGG && !isHalfStep(score)) {
            return res.send(
                renderPage(
                    "Erreur",
                    "<h2>Erreur</h2><p>Pour les joueurs, le score doit être en ,0 ou ,5.</p><a href='/scores/ajouter'>⬅ Retour</a>"
                )
            );
        }

        const { error } = await supabase
            .from("scores")
            .upsert(
                [{ jeu_id, joueur_id, score }],
                { onConflict: "jeu_id,joueur_id" }
            );

        if (error) throw error;

res.send(
    renderPage(
        "Succès",
        `
        <audio id="coin-sound" autoplay>
          <source src="/sounds/coin.mp3" type="audio/mpeg">
        </audio>

        <script>
        window.addEventListener("load", () => {
          const a = document.getElementById("coin-sound");
          if (!a) return;
          const p = a.play();
          if (p !== undefined) {
            p.catch(() => {
              document.body.addEventListener("click", () => a.play(), { once: true });
              document.body.addEventListener("touchstart", () => a.play(), { once: true });
            });
          }
        });
        </script>

        <h2>✅ Le score a été enregistré</h2>
        <a href='/scores/ajouter'>⬅ Retour</a>
        `
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
        const bggmin = Math.max(0, Number(req.query.bggmin) || 0);
        const status = req.query.status || "";
        const extension = req.query.extension || "";

        const hasMinj = req.query.minj !== undefined && req.query.minj !== "";
        const hasMaxj = req.query.maxj !== undefined && req.query.maxj !== "";
        const hasTempsmax = req.query.tempsmax !== undefined && req.query.tempsmax !== "";
        const hasScoremin = req.query.scoremin !== undefined && req.query.scoremin !== "";
        const hasBggmin = req.query.bggmin !== undefined && req.query.bggmin !== "";

        const { data: jeux, error } = await supabase
            .from("jeux")
            .select(`
                id,
                nom,
                min_joueurs,
                max_joueurs,
                temps_min,
                temps_max,
                statut,
                extensions,
                bgg_average_rating,
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

                if (hasBggmin && (j.bgg_average_rating === null || Number(j.bgg_average_rating) < bggmin)) {
                    return false;
                }

                if (status === "Oui" && (!j.statut || j.statut.trim() === "")) {
                    return false;
                }

                if (extension === "Oui" && (!j.extensions || j.extensions.trim() === "")) {
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
        const { data: joueursBrut, error } = await supabase
            .from("joueurs")
            .select("id, nom, image")
            .order("nom");

        if (error) throw error;

        const tousLesJoueurs = joueursBrut || [];
        const normalise = (nom) => String(nom || "").trim().toUpperCase();

        const vincent = tousLesJoueurs.find(j => normalise(j.nom) === "VINCENT");
        const marc = tousLesJoueurs.find(j => normalise(j.nom) === "MARC");
        const julie = tousLesJoueurs.find(j => normalise(j.nom) === "JULIE");
        const bgg = tousLesJoueurs.find(j => normalise(j.nom) === "BGG");

        const autresJoueurs = tousLesJoueurs.filter(j => {
            const n = normalise(j.nom);
            return !["VINCENT", "MARC", "JULIE", "BGG"].includes(n);
        });

        const joueursPourSelect = [
            ...(vincent ? [vincent] : []),
            ...(marc ? [marc] : []),
            ...(julie ? [julie] : []),
            ...autresJoueurs
        ];

        const optionsJoueurs = joueursPourSelect
            .map(j => '<option value="' + j.id + '">' + escapeHtml(j.nom) + '</option>')
            .join("");

        const joueursData = JSON.stringify(tousLesJoueurs).replace(/</g, "\\u003c");

        const html = `
        <h2>🥇 Top jeux 💀</h2>

        <form id="formStats" class="result-box">
          Choisir joueur:<br>
          <select name="joueur" id="choixJoueur">
            <option value="">-- Choisir --</option>
            ${vincent ? `<option value="${vincent.id}">${escapeHtml(vincent.nom)}</option>` : ""}
            ${marc ? `<option value="${marc.id}">${escapeHtml(marc.nom)}</option>` : ""}
            ${julie ? `<option value="${julie.id}">${escapeHtml(julie.nom)}</option>` : ""}
            <option value="all">Tous les joueurs</option>
            <option value="all_with_bgg">Tous les joueurs + BGG</option>
            ${autresJoueurs.map(j => '<option value="' + j.id + '">' + escapeHtml(j.nom) + '</option>').join("")}
            ${bgg ? '<option value="bgg">BGG</option>' : ""}
          </select>
          <br>

          Nombre de jeux à afficher:<br>
          <input type="number" id="nbTop" value="5" min="1" max="50" style="width:90px;">
        </form>

        <div id="carte-joueur"></div>
        <div id="resultatsStats"></div>

        <a href="/menu">⬅ Retour</a>

        <script>
        const joueursData = ${joueursData};

        function afficherCartesJoueurs(selection) {
          const divCartes = document.getElementById("carte-joueur");

          if (!selection) {
            divCartes.innerHTML = "";
            return;
          }

          let joueursAAfficher = [];

          if (selection === "all") {
            joueursAAfficher = joueursData.filter(j => String(j.nom || "").trim().toUpperCase() !== "BGG");
          } else if (selection === "all_with_bgg") {
            joueursAAfficher = joueursData;
          } else if (selection === "bgg") {
            joueursAAfficher = joueursData.filter(j => String(j.nom || "").trim().toUpperCase() === "BGG");
          } else {
            const joueur = joueursData.find(j => String(j.id) === String(selection));
            if (joueur) joueursAAfficher = [joueur];
          }

          if (!joueursAAfficher.length) {
            divCartes.innerHTML = "";
            return;
          }

          divCartes.innerHTML =
            "<div style='display:flex; flex-wrap:wrap; gap:12px; margin-bottom:12px;'>" +
            joueursAAfficher.map(j =>
              "<div class='result-box' style='flex:1 1 180px; max-width:220px; min-width:150px; margin:0; text-align:center;'>" +
                (j.image ? "<img src='/images/" + encodeURIComponent(j.image) + "' width='80'><br>" : "") +
                "<strong>" + j.nom + "</strong>" +
              "</div>"
            ).join("") +
            "</div>";
        }

        function renderBloc(titre, items, modeLabel) {
          const estMeilleur = titre.includes("Meilleurs");
          const rankColor = estMeilleur ? "#1b8f3a" : "#c62828";

          let html = "<div class='result-box'><h3 style='color:" + rankColor + ";'>" + titre + "</h3>";

          if (!items || items.length === 0) {
            html += "Aucune donnée";
          } else {
            items.forEach((j, idx) => {
              html += "<div style='display:flex; align-items:center; gap:12px; margin:10px 0;'>";
              if (j.image) {
                html += "<img src='/images/" + encodeURIComponent(j.image) + "' width='55'>";
              }
              html += "<div>" +
                        "<span style='color:" + rankColor + "; font-weight:bold;'>#" + (idx + 1) + "</span> " +
                        "<b style='color:#000;'>" + j.jeu + "</b><br>" +
                        "<span style='color:#000;'>" + modeLabel + " : " + Number(j.moyenne).toFixed(2) + "</span>" +
                      "</div>";
              html += "</div>";
            });
          }

          html += "</div>";
          return html;
        }

        async function chargerStats() {
          const joueur = document.getElementById("choixJoueur").value;
          const nb = document.getElementById("nbTop")?.value || 5;
          const div = document.getElementById("resultatsStats");

          afficherCartesJoueurs(joueur);

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

            const modeLabel = joueur === "bgg"
              ? "<span style='color:#1e88e5; font-size:1.15em;'>⬢</span> BGG"
              : "⭐ Note";

            let html = "";
            html += renderBloc("🏆 Meilleurs jeux", data.meilleurs, modeLabel);
            html += renderBloc("💀 Pires jeux", data.pires, modeLabel);

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

        if (joueur === "bgg") {
            const { data: jeux, error } = await supabase
                .from("jeux")
                .select("id, nom, image, bgg_average_rating")
                .not("bgg_average_rating", "is", null);

            if (error) throw error;

            const resultats = (jeux || []).map(j => ({
                jeu: j.nom,
                image: j.image ? getGameImageUrl(j.image) : null,
                moyenne: Number(j.bgg_average_rating)
            }));

            resultats.sort((a, b) => b.moyenne - a.moyenne);

            return res.json({
                meilleurs: resultats.slice(0, nb),
                pires: resultats.slice(-nb).reverse()
            });
        }

        let query = supabase
            .from("scores")
            .select(`
                score,
                joueur_id,
                jeux (
                    id,
                    nom,
                    image
                ),
                joueurs (
                    nom
                )
            `);

        if (!["all", "all_with_bgg", "bgg"].includes(joueur)) {
            query = query.eq("joueur_id", joueur);
        }

        const { data: scores, error } = await query;
        if (error) throw error;

        let scoresFiltres = scores || [];

        if (joueur === "all") {
            scoresFiltres = scoresFiltres.filter(
                s => String(s.joueurs?.nom || "").trim().toUpperCase() !== "BGG"
            );
        } else if (joueur === "bgg") {
            scoresFiltres = scoresFiltres.filter(
                s => String(s.joueurs?.nom || "").trim().toUpperCase() === "BGG"
            );
        }

        if (!scoresFiltres.length) {
            return res.json({ meilleurs: [], pires: [] });
        }

        let resultats = [];

        if (joueur === "all" || joueur === "all_with_bgg") {
            const stats = {};

            scoresFiltres.forEach((s) => {
                const jeu = s.jeux;
                if (!jeu?.nom) return;

                if (!stats[jeu.id]) {
                    stats[jeu.id] = {
                        jeu: jeu.nom,
                        image: jeu.image ? getGameImageUrl(jeu.image) : null,
                        total: 0,
                        count: 0
                    };
                }

                stats[jeu.id].total += Number(s.score);
                stats[jeu.id].count += 1;
            });

            resultats = Object.values(stats).map(j => ({
                jeu: j.jeu,
                image: j.image ? j.image : null,
                moyenne: j.total / j.count
            }));
        } else {
            resultats = scoresFiltres
                .filter(s => s.jeux?.nom)
                .map(s => ({
                    jeu: s.jeux.nom,
                    image: s.jeux.image ? getGameImageUrl(s.jeux.image) : null,
                    moyenne: Number(s.score)
                }));
        }

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
app.get("/filtrages", requireAuth, async (req, res) => {
    try {
        const { data: jeuxSuggestion, error: suggestionError } = await supabase
            .from("jeux")
            .select("nom, image")
            .order("nom");

        if (suggestionError) throw suggestionError;

        const listeSuggestions = jeuxSuggestion || [];
        const suggestion = listeSuggestions.length
            ? listeSuggestions[Math.floor(Math.random() * listeSuggestions.length)]
            : null;

        const suggestionHtml = suggestion
            ? `
            <div class="result-box" style="margin-bottom:12px;">
              <h3 style="margin-top:0;">🎲 Suggestion du moment</h3>
              <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                ${suggestion.image ? `<img src="${getGameImageUrl(suggestion.image)}" width="90">` : ""}
              <div style="font-size:1.1em; color:#1b8f3a;"><b>${escapeHtml(suggestion.nom)}</b></div>
              </div>
            </div>
            `
            : "";

        const html = `
        <h2>🔍 Filtrer les jeux</h2>

        ${suggestionHtml}

        <div class="result-box" style="margin-top:0;">
          <form id="formFiltre">
            <label>👤 Joueurs minimum :</label>
            <input type="number" name="minj" min="0" style="width:90px;"><br>

            <label>👥 Joueurs maximum :</label>
            <input type="number" name="maxj" min="0" style="width:90px;"><br>

            <label>⌛ Temps maximum :</label>
            <input type="number" name="tempsmax" min="0" style="width:110px;">
            <label>(minutes)</label><br>

            <label>⭐ Score moyen minimum des joueurs :</label>
            <input type="number" step="0.1" name="scoremin" min="0" style="width:90px;"><br>

            <label><span style="color:#1e88e5; font-size:1.2em;">⬢</span> Score moyen minimum BGG :</label>
            <input type="number" step="0.1" name="bggmin" min="0" max="10" style="width:90px;"><br>

            <label>ℹ️ Status :</label><br>
            <select name="status" style="width:80px;">
              <option value=""></option>
              <option value="Oui">Oui</option>
            </select><br>

            <label>🔗 Extension :</label><br>
            <select name="extension" style="width:80px;">
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

        function txt(v) {
          return (v === null || v === undefined || v === "") ? "—" : v;
        }

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
              "<div class='table-wrap'>" +
                "<table class='jeux-table'>" +
                  "<tr>" +
                    "<th>⚔️ Jeux</th>" +
                    "<th>👥 Joueurs</th>" +
                    "<th>⌛ Temps</th>" +
                    "<th>⭐ Local</th>" +
                    "<th><span style='color:#1e88e5; font-size:1.25em;'>⬢</span> BGG</th>" +
                    "<th>ℹ️ Status</th>" +
                    "<th>🔗 Extension</th>" +
                    "<th>⭐ Scores</th>" +
                  "</tr>" +
                  data.map(j =>
                    "<tr>" +
                      "<td><b>" + txt(j.nom) + "</b></td>" +
                      "<td>" + txt(j.min_joueurs) + "-" + txt(j.max_joueurs) + "</td>" +
                      "<td>" + txt(j.temps_max) + " min</td>" +
                      "<td>" + txt(j.moyenne) + "</td>" +
                      "<td>" + txt(j.bgg_average_rating) + "</td>" +
                      "<td>" + ((j.statut && j.statut.trim() !== "") ? j.statut : "—") + "</td>" +
                      "<td>" + ((j.extensions && j.extensions.trim() !== "") ? j.extensions : "—") + "</td>" +
                      "<td>" + (j.joueurs?.length ? j.joueurs.join("<br>") : "—") + "</td>" +
                    "</tr>"
                  ).join("") +
                "</table>" +
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
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== ROUTES COMPÉTITIONS =====================

// LISTE
app.get("/competitions/liste", requireAuth, async (req, res) => {
    try {
        const playWin = req.query.win === "1";
        const playChampion = req.query.champion === "1";

        const { data: comps, error: compsError } = await supabase
            .from("competitions")
            .select(`
                id,
                nom,
                objectif,
                jeu_id,
                victoires_pour_gagner,
                terminee,
                gagnant_joueur_id,
                etoile_donnee,
                jeux ( id, nom )
            `)
            .order("id", { ascending: false });

        if (compsError) throw compsError;

        const { data: participants, error: partError } = await supabase
            .from("competition_joueurs")
            .select(`
                id,
                competition_id,
                joueur_id,
                victoires,
                joueurs (
                    id,
                    nom,
                    etoiles,
                    image
                )
            `)
            .order("competition_id", { ascending: false });

        if (partError) throw partError;

        const participantsParCompetition = {};
        for (const p of participants || []) {
            if (!participantsParCompetition[p.competition_id]) {
                participantsParCompetition[p.competition_id] = [];
            }
            participantsParCompetition[p.competition_id].push(p);
        }

        function gradateur(victoires) {
            const nb = Math.max(0, Number(victoires) || 0);
            const symboles = ["▂", "▃", "▅", "▆", "▇"];

            if (nb === 0) return "";

            return Array.from({ length: nb }, (_, i) => {
                return symboles[Math.min(i, symboles.length - 1)];
            }).join(" ");
        }

        let html = `
        <h2>🏆 Compétitions</h2>

        ${playWin || playChampion ? `
        <audio id="trompette" autoplay>
            <source src="/sounds/trompette.mp3" type="audio/mpeg">
        </audio>
        <script>
            window.addEventListener("load", () => {
                const a = document.getElementById("trompette");
                if (!a) return;
                const p = a.play();
                if (p !== undefined) {
                    p.catch(() => {
                        document.body.addEventListener("click", () => a.play(), { once: true });
                    });
                }
            });
        </script>
        ` : ""}

        <button onclick="window.location.href='/competitions/ajouter'">Ajouter une nouvelle compétition</button>
        <br><br>
        `;

        if (!comps || comps.length === 0) {
            html += `<div class="result-box">Aucune compétition pour le moment.</div>`;
        } else {
            for (const c of comps) {
                const liste = participantsParCompetition[c.id] || [];
                const gagnant = liste.find(p => Number(p.joueur_id) === Number(c.gagnant_joueur_id));

                html += `
                <div class="result-box">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                        <h3 style="margin:0;">${escapeHtml(c.nom || "Compétition")}</h3>
                        <div>
                            <button type="button" onclick="window.location.href='/competitions/modifier/${c.id}'" style="width:auto;">✏ Modifier</button>

                            <form method="POST" action="/competitions/supprimer/${c.id}" style="display:inline;" onsubmit="return confirm('Supprimer cette compétition ?');">
                                <button type="submit" style="width:auto;">🗑 Supprimer</button>
                            </form>
                        </div>
                    </div>

                    <div><b>Jeu joué :</b> ${escapeHtml(c.jeux?.nom || "Aucun jeu sélectionné")}</div>
                    <div><b>But :</b> ${c.victoires_pour_gagner || 0} victoire(s)</div>
                    ${c.objectif ? `<div><b>Description :</b> ${escapeHtml(c.objectif)}</div>` : ""}
                    <br>
                `;

                if (liste.length === 0) {
                    html += `<div>Aucun joueur inscrit.</div>`;
                } else {
                    for (const p of liste) {
                        const estGagnant = Number(c.gagnant_joueur_id) === Number(p.joueur_id);

                        html += `
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid #ccc; padding:10px; margin:8px 0; border-radius:6px;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                ${p.joueurs?.image ? `<img src="/images/${encodeURIComponent(p.joueurs.image)}" width="55">` : ""}
                                <div>
                                    <div><b>${escapeHtml(p.joueurs?.nom || "Joueur inconnu")}</b></div>
                                    <div>
                                        Victoires : ${p.victoires} / ${c.victoires_pour_gagner}
                                        <span style="font-size:22px; margin-left:8px; color:${estGagnant ? "#c97a00" : "#1e88e5"};">
                                            ${gradateur(p.victoires)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                        `;

                        if (!c.terminee) {
                            html += `
                            <form method="POST" action="/competitions/victoire" style="display:inline;" onsubmit="return confirm('Ajouter une victoire à ce joueur ?');">
                                <input type="hidden" name="competition_id" value="${c.id}">
                                <input type="hidden" name="joueur_id" value="${p.joueur_id}">
                                <button type="submit" style="width:auto;">Victoire</button>
                            </form>
                            `;
                        } else if (estGagnant) {
                            html += `<b>🏅 Gagnant</b>`;
                        }

                        html += `
                            </div>
                        </div>
                        `;
                    }
                }

                if (c.terminee) {
                    html += `
                    <div style="margin-top:10px;">
                        <b>🏆 Gagnant :</b> ${escapeHtml(gagnant?.joueurs?.nom || "Inconnu")}
                        ${c.jeux?.nom ? ` — <b>Jeu :</b> ${escapeHtml(c.jeux.nom)}` : ""}
                    </div>
                    `;

                    if (!c.etoile_donnee && c.gagnant_joueur_id) {
                        html += `
                        <div style="margin-top:10px;">
                            <form method="POST" action="/competitions/etoile" onsubmit="return confirm('Ajouter une étoile au gagnant ?');">
                                <input type="hidden" name="competition_id" value="${c.id}">
                                <button type="submit" style="width:auto;">⭐ Donner une étoile au gagnant</button>
                            </form>
                        </div>
                        `;
                    } else if (c.etoile_donnee) {
                        html += `<div style="margin-top:10px;"><b>⭐ Étoile déjà attribuée</b></div>`;
                    }
                }

                html += `</div>`;
            }
        }

        html += `<a href="/menu">⬅ Retour</a>`;

        res.send(renderPage("Compétitions", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// PAGE AJOUT
app.get("/competitions/ajouter", requireAuth, async (req, res) => {
    try {
        const { data: joueurs, error: joueursError } = await supabase
            .from("joueurs")
            .select("id, nom")
            .order("nom");

        if (joueursError) throw joueursError;

        const { data: jeux, error: jeuxError } = await supabase
            .from("jeux")
            .select("id, nom")
            .order("nom");

        if (jeuxError) throw jeuxError;

        const joueursJson = JSON.stringify(joueurs || []).replace(/</g, "\\u003c");

        const html = `
        <h2>Ajouter une compétition</h2>

        <div class="result-box">
            <form method="POST" action="/competitions/ajouter" id="formCompetition">
                <b>Nom de la compétition :</b><br>
                <input name="nom" required><br>

                Jeu joué :<br>
                <select name="jeu_id">
                    <option value="">-- Choisir un jeu --</option>
                    ${(jeux || []).map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
                </select><br>

                Nombre de joueurs :<br>
                <input type="number" id="nbJoueurs" name="nb_joueurs" min="2" value="2" required><br>

                Combien de victoires pour gagner :<br>
                <input type="number" name="victoires_pour_gagner" min="1" value="3" required><br>

                Description / objectif :<br>
                <textarea name="objectif" rows="4"></textarea><br><br>

                <div id="zoneJoueurs"></div>

                <br><button type="submit">Créer une compétition</button>
            </form>
        </div>

        <a href="/competitions/liste">⬅ Retour</a>

        <script>
        const joueurs = ${joueursJson};

        function renderSelects() {
            const nb = Math.max(2, Number(document.getElementById("nbJoueurs").value) || 2);
            const zone = document.getElementById("zoneJoueurs");

            let html = "<b>Joueurs impliqués :</b><br><br>";

            for (let i = 0; i < nb; i++) {
                html += \`
                    Joueur \${i + 1} :<br>
                    <select name="joueur_ids[]" required>
                        <option value="">-- Choisir --</option>
                        \${joueurs.map(j => \`<option value="\${j.id}">\${j.nom}</option>\`).join("")}
                    </select><br>
                \`;
            }

            zone.innerHTML = html;
        }

        document.addEventListener("DOMContentLoaded", () => {
            renderSelects();
            document.getElementById("nbJoueurs").addEventListener("input", renderSelects);
        });
        </script>
        `;

        res.send(renderPage("Ajouter une compétition", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// CRÉER
app.post("/competitions/ajouter", requireAuth, async (req, res) => {
    try {
        const nom = (req.body.nom || "").trim();
        const objectif = (req.body.objectif || "").trim() || null;
        const jeu_id = req.body.jeu_id ? Number(req.body.jeu_id) : null;
        const victoires_pour_gagner = Math.max(1, Number(req.body.victoires_pour_gagner) || 1);

        let joueur_ids = req.body["joueur_ids[]"] || req.body.joueur_ids || [];

        if (!Array.isArray(joueur_ids)) {
            joueur_ids = [joueur_ids];
        }

        joueur_ids = joueur_ids
            .map(id => Number(id))
            .filter(id => !Number.isNaN(id));

        const uniques = [...new Set(joueur_ids)];

        if (!nom) {
            return res.send(renderPage("Erreur", "Le nom de la compétition est requis."));
        }

        if (uniques.length < 2) {
            return res.send(renderPage("Erreur", "Il faut au moins 2 joueurs différents."));
        }

        const { data: competition, error: compError } = await supabase
            .from("competitions")
            .insert([{
                nom,
                objectif,
                jeu_id,
                victoires_pour_gagner,
                terminee: false,
                etoile_donnee: false
            }])
            .select()
            .single();

        if (compError) throw compError;

        const inserts = uniques.map(joueur_id => ({
            competition_id: competition.id,
            joueur_id,
            victoires: 0
        }));

        const { error: insertPlayersError } = await supabase
            .from("competition_joueurs")
            .insert(inserts);

        if (insertPlayersError) throw insertPlayersError;

        res.redirect("/competitions/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// PAGE MODIFIER
app.get("/competitions/modifier/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: competition, error: compError } = await supabase
            .from("competitions")
            .select("*")
            .eq("id", id)
            .single();

        if (compError) throw compError;

        const { data: jeux, error: jeuxError } = await supabase
            .from("jeux")
            .select("id, nom")
            .order("nom");

        if (jeuxError) throw jeuxError;

        const html = `
        <h2>Modifier une compétition</h2>

        <div class="result-box">
            <form method="POST" action="/competitions/modifier/${competition.id}">
                Nom :<br>
                <input name="nom" value="${escapeHtml(competition.nom || "")}" required><br>

                Jeu joué :<br>
                <select name="jeu_id">
                    <option value="">-- Choisir un jeu --</option>
                    ${(jeux || []).map(j => `
                        <option value="${j.id}" ${Number(competition.jeu_id) === Number(j.id) ? "selected" : ""}>
                            ${escapeHtml(j.nom)}
                        </option>
                    `).join("")}
                </select><br>

                Victoires pour gagner :<br>
                <input type="number" name="victoires_pour_gagner" min="1" value="${competition.victoires_pour_gagner || 1}" required><br>

                Description / objectif :<br>
                <textarea name="objectif" rows="4">${escapeHtml(competition.objectif || "")}</textarea><br><br>

                <button type="submit">Enregistrer</button>
            </form>
        </div>

        <a href="/competitions/liste">⬅ Retour</a>
        `;

        res.send(renderPage("Modifier compétition", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// MODIFIER
app.post("/competitions/modifier/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const nom = (req.body.nom || "").trim();
        const objectif = (req.body.objectif || "").trim() || null;
        const jeu_id = req.body.jeu_id ? Number(req.body.jeu_id) : null;
        const victoires_pour_gagner = Math.max(1, Number(req.body.victoires_pour_gagner) || 1);

        if (!nom) {
            return res.send(renderPage("Erreur", "Le nom est requis."));
        }

        const { error } = await supabase
            .from("competitions")
            .update({
                nom,
                objectif,
                jeu_id,
                victoires_pour_gagner
            })
            .eq("id", id);

        if (error) throw error;

        res.redirect("/competitions/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// SUPPRIMER
app.post("/competitions/supprimer/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("competitions")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.redirect("/competitions/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// AJOUTER UNE VICTOIRE
app.post("/competitions/victoire", requireAuth, async (req, res) => {
    try {
        const competition_id = Number(req.body.competition_id);
        const joueur_id = Number(req.body.joueur_id);

        if (!competition_id || !joueur_id) {
            return res.send(renderPage("Erreur", "Données manquantes."));
        }

        const { data: competition, error: compError } = await supabase
            .from("competitions")
            .select("id, victoires_pour_gagner, terminee, gagnant_joueur_id")
            .eq("id", competition_id)
            .single();

        if (compError) throw compError;

        if (competition.terminee) {
            return res.redirect("/competitions/liste");
        }

        const { data: ligne, error: ligneError } = await supabase
            .from("competition_joueurs")
            .select("id, victoires")
            .eq("competition_id", competition_id)
            .eq("joueur_id", joueur_id)
            .single();

        if (ligneError) throw ligneError;

        const nouvellesVictoires = Number(ligne.victoires || 0) + 1;

        const { error: updateLineError } = await supabase
            .from("competition_joueurs")
            .update({ victoires: nouvellesVictoires })
            .eq("id", ligne.id);

        if (updateLineError) throw updateLineError;

        if (nouvellesVictoires >= Number(competition.victoires_pour_gagner || 1)) {
            const { error: updateCompError } = await supabase
                .from("competitions")
                .update({
                    terminee: true,
                    gagnant_joueur_id: joueur_id
                })
                .eq("id", competition_id);

            if (updateCompError) throw updateCompError;

            return res.redirect("/competitions/liste?win=1&champion=1");
        }

        res.redirect("/competitions/liste?win=1");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// DONNER UNE ÉTOILE
app.post("/competitions/etoile", requireAuth, async (req, res) => {
    try {
        const competition_id = Number(req.body.competition_id);

        if (!competition_id) {
            return res.send(renderPage("Erreur", "Compétition invalide."));
        }

        const { data: competition, error: compError } = await supabase
            .from("competitions")
            .select("id, terminee, gagnant_joueur_id, etoile_donnee")
            .eq("id", competition_id)
            .single();

        if (compError) throw compError;

        if (!competition.terminee || !competition.gagnant_joueur_id) {
            return res.send(renderPage("Erreur", "Aucun gagnant pour cette compétition."));
        }

        if (competition.etoile_donnee) {
            return res.redirect("/competitions/liste");
        }

        const { data: joueur, error: joueurError } = await supabase
            .from("joueurs")
            .select("id, etoiles")
            .eq("id", competition.gagnant_joueur_id)
            .single();

        if (joueurError) throw joueurError;

        const nouvellesEtoiles = Number(joueur.etoiles || 0) + 1;

        const { error: updateJoueurError } = await supabase
            .from("joueurs")
            .update({ etoiles: nouvellesEtoiles })
            .eq("id", joueur.id);

        if (updateJoueurError) throw updateJoueurError;

        const { error: updateCompError } = await supabase
            .from("competitions")
            .update({ etoile_donnee: true })
            .eq("id", competition_id);

        if (updateCompError) throw updateCompError;

        res.redirect("/competitions/liste");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== JEUX EN COURS =====================
app.get("/jeux-en-cours", requireAuth, async (req, res) => {
    try {
        const { data: parties, error: partiesError } = await supabase
            .from("jeux_en_cours")
            .select("*")
            .order("date_creation", { ascending: false });

        if (partiesError) throw partiesError;

        const { data: jeux, error: jeuxError } = await supabase
            .from("jeux")
            .select("id, nom")
            .order("nom");

        if (jeuxError) throw jeuxError;

        const { data: joueursBrut, error: joueursError } = await supabase
            .from("joueurs")
            .select("id, nom")
            .order("nom");

        if (joueursError) throw joueursError;

        const joueurs = (joueursBrut || []).filter(
            j => String(j.nom || "").trim().toUpperCase() !== "BGG"
        );

        const { data: liens, error: liensError } = await supabase
            .from("jeux_en_cours_joueurs")
            .select(`
                jeu_en_cours_id,
                joueur_id,
                joueurs ( nom )
            `);

        if (liensError) throw liensError;

        const joueursParPartie = {};
        (liens || []).forEach(l => {
            if (!joueursParPartie[l.jeu_en_cours_id]) joueursParPartie[l.jeu_en_cours_id] = [];
            joueursParPartie[l.jeu_en_cours_id].push(l.joueurs?.nom || "Joueur");
        });

        const html = `
        <h2>⏸️ Jeux en cours</h2>

        <div class="result-box">
            <form method="POST" action="/jeux-en-cours/ajouter" enctype="multipart/form-data">
                Jeu:<br>
                <select name="nom_jeu" required>
                    <option value="">-- Choisir un jeu --</option>
                    ${(jeux || []).map(j => `<option value="${escapeHtml(j.nom)}">${escapeHtml(j.nom)}</option>`).join("")}
                </select><br>

                Joueurs impliqués:<br>
                <select name="joueur_ids[]" multiple size="6" style="max-width:400px;" required>
                    ${(joueurs || []).map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join("")}
                </select><br>

                Tour à quel joueur de jouer:<br>
                <input name="prochain_joueur" placeholder="Ex. Vincent"><br>               

                Photo:<br>
                <input type="file" name="photo" accept="image/*"><br>

                Notes:<br>
                <textarea name="notes" rows="4"></textarea><br><br>

                <button>Ajouter</button>
            </form>
        </div>

        <br>

        <div class="table-wrap">
            <table class="jeux-table">
                <tr>
                    <th>#</th>
                    <th>⚔️ Jeu</th>
                    <th>👥 Joueurs</th>
                    <th>⌛ Date</th>
                    <th>↻ Tour</th>
                    <th>📷 Photo</th>
                    <th>ℹ️ Notes</th>
                    <th>⚡ Action</th>
                </tr>
                ${(parties || []).map((p, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(p.nom_jeu)}</td>
                        <td>${(joueursParPartie[p.id] || []).join(", ") || "—"}</td>
                        <td>${new Date(p.date_creation).toLocaleDateString("fr-CA")}</td>
                        <td>${escapeHtml(p.prochain_joueur || "") || "—"}</td>
                        <td>${p.photo ? `<img src="/images/${encodeURIComponent(p.photo)}" width="70">` : "—"}</td>
                        <td>${escapeHtml(p.notes || "")}</td>
                        <td>
                            <form method="POST" action="/jeux-en-cours/supprimer/${p.id}" onsubmit="return confirm('Supprimer cette partie en cours ?');">
                                <button type="submit" style="width:auto;">🗑 Supprimer</button>
                            </form>
                        </td>
                    </tr>
                `).join("")}
            </table>
        </div>

        <br>
        <a href="/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Jeux en cours", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux-en-cours/ajouter", requireAuth, upload.single("photo"), async (req, res) => {
    try {
        const nom_jeu = (req.body.nom_jeu || "").trim();
        const notes = (req.body.notes || "").trim() || null;
        const prochain_joueur = (req.body.prochain_joueur || "").trim() || null;       

        let joueur_ids = req.body["joueur_ids[]"] || req.body.joueur_ids || [];
        if (!Array.isArray(joueur_ids)) joueur_ids = [joueur_ids];
        joueur_ids = joueur_ids.map(id => Number(id)).filter(id => !Number.isNaN(id));

        const photo = req.file ? req.file.filename : null;

        const { data: partie, error } = await supabase
            .from("jeux_en_cours")
            const notes = (req.body.notes || "").trim() || null;
            const prochain_joueur = (req.body.prochain_joueur || "").trim() || null;
            .select()
            .single();

        if (error) throw error;

        if (joueur_ids.length > 0) {
            const inserts = joueur_ids.map(joueur_id => ({
                jeu_en_cours_id: partie.id,
                joueur_id
            }));

            const { error: liensError } = await supabase
                .from("jeux_en_cours_joueurs")
                .insert(inserts);

            if (liensError) throw liensError;
        }

        res.redirect("/jeux-en-cours");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux-en-cours/supprimer/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("jeux_en_cours")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.redirect("/jeux-en-cours");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== ROUTES JEUX DÉSIRÉS =====================
app.get("/jeux-desires", requireAuth, async (req, res) => {
    try {
        const { data: jeux, error } = await supabase
            .from("jeux_desires")
            .select("*")
            .order("nom");

        if (error) throw error;

        const html = `
        <h2>🛒 Jeux désirés</h2>

        <div class="box-info">
            <h3>➕ Ajouter un jeu désiré</h3>

            <form method="POST" action="/jeux-desires/ajouter">
                Nom du jeu:<br>
                <input name="nom" required><br>

                Extension:<br>
                <input name="extension"><br>

                Quelle source (magasin):<br>
                <input name="source_magasin"><br>

                Prix d'achat:<br>
                <input type="number" name="prix_achat" min="0" step="0.01" style="max-width:140px;" placeholder="20.00"><br>
                <div style="font-size:0.78em; color:#666; margin-top:2px;">Format affiché : 20,00 $</div><br>

                Notes:<br>
                <textarea name="notes" rows="4"></textarea><br><br>

                <button>Ajouter</button>
            </form>
        </div>

        <br>

        <div class="table-wrap">
            <table class="jeux-table">
                <tr>
                    <th class="col-center">#</th>
                    <th>Nom</th>
                    <th>Extension</th>
                    <th>Source</th>
                    <th class="col-right">Prix d'achat</th>
                    <th>Notes</th>
                    <th>Action</th>
                </tr>
                ${(jeux || []).map((j, index) => `
                    <tr>
                        <td class="col-center">${index + 1}</td>
                        <td>${escapeHtml(j.nom)}</td>
                        <td>${escapeHtml(j.extension || "") || "—"}</td>
                        <td>${escapeHtml(j.source_magasin || "") || "—"}</td>
                        <td class="col-right">${formatPrixCAD(j.prix_achat)}</td>
                        <td>${escapeHtml(j.notes || "")}</td>
                        <td>
                            <form method="POST" action="/jeux-desires/supprimer/${j.id}" onsubmit="return confirm('Supprimer ce jeu désiré ?');">
                                <button type="submit" style="width:auto;">🗑 Supprimer</button>
                            </form>
                        </td>
                    </tr>
                `).join("")}
            </table>
        </div>

        <br>
        <a href="/menu">⬅ Retour</a>
        `;

        res.send(renderPage("Jeux désirés", html));
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux-desires/ajouter", requireAuth, async (req, res) => {
    try {
        const nom = (req.body.nom || "").trim();
        const extension = (req.body.extension || "").trim() || null;
        const source_magasin = (req.body.source_magasin || "").trim() || null;
        const notes = (req.body.notes || "").trim() || null;
        const prix_achat = req.body.prix_achat
            ? Number(String(req.body.prix_achat).replace(",", "."))
            : null;

        if (!nom) {
            return res.send(renderPage("Erreur", "Le nom du jeu est requis."));
        }

        const { error } = await supabase
            .from("jeux_desires")
            .insert([{
                nom,
                extension,
                source_magasin,
                prix_achat,
                notes
            }]);

        if (error) throw error;

        res.redirect("/jeux-desires");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

app.post("/jeux-desires/supprimer/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("jeux_desires")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.redirect("/jeux-desires");
    } catch (err) {
        res.send(renderPage("Erreur", err.message));
    }
});

// ===================== SERVEUR =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));