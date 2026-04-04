export default function registerBattleshipRoutes({ app, supabase, requireAuth, renderPage, escapeHtml }) {
  const GRID_SIZE = 10;
  const BASE_SHOTS = 3;
  const EXTRA_SHOTS_IF_HIT = 2;
  const UFO_BONUS_NEXT_TURN = 3;
  const OPTIONAL_VICTORY_CODES = new Set(['ufo', 'diver', 'island']);

  const FLEET = [
    { code: 'ship', label: 'Bateau', emoji: '🚢', size: 5 },
    { code: 'plane', label: 'Avion', emoji: '✈️', size: 4 },
    { code: 'sub', label: 'Sous-marin', emoji: '🛥️', size: 3 },
    { code: 'heli', label: 'Hélicoptère', emoji: '🚁', size: 3 },
    { code: 'sail', label: 'Voilier', emoji: '⛵', size: 2 },
    { code: 'ufo', label: 'UFO', emoji: '🛸', size: 2 },
    { code: 'diver', label: 'Plongeur', emoji: '🤿', size: 1 },
    { code: 'island', label: 'Île secrète', emoji: '🏝️', size: 1 }
  ];

  const fleetByCode = Object.fromEntries(FLEET.map(x => [x.code, x]));

  const nowIso = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  const keyOf = (x, y) => `${x},${y}`;
  const parseKey = key => {
    const [x, y] = String(key).split(',').map(Number);
    return { x, y };
  };
  const rand = max => Math.floor(Math.random() * max);
  const normalize = value => String(value || '').trim().toUpperCase();
  const isSolo = party => party.mode === 'solo';
  const currentSlot = party => party.current_turn === 'p2' ? 'p2' : 'p1';
  const otherSlot = slot => slot === 'p1' ? 'p2' : 'p1';
  const bankField = slot => slot === 'p1' ? 'bonus_bank_p1' : 'bonus_bank_p2';

  const battleTheme = () => `
    <style>
      body {
        background: #000 !important;
        color: #f4f4f4;
      }

      .page-container {
        background: #050505 !important;
        color: #f4f4f4;
        box-shadow: 0 0 18px rgba(255,255,255,0.08);
      }

      h1, h2, h3, h4, b, strong, a {
        color: #f4f4f4;
      }

      .result-box {
        background: #111 !important;
        border-left: 5px solid #2b7cff;
        color: #f4f4f4;
      }

      input, select, textarea, button {
        background: #161616;
        color: #f4f4f4;
        border: 1px solid #333;
      }

      button:hover {
        background: #1f1f1f;
      }

      .battle-layout {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 18px;
        align-items: start;
      }

      .battle-panel {
        background: #0d0d0d;
        border: 1px solid #222;
        border-radius: 16px;
        padding: 14px;
        min-height: 100%;
      }

      .battle-panel h3 {
        margin-top: 0;
        min-height: 34px;
      }

      .battle-grid {
        display: grid;
        grid-template-columns: repeat(${GRID_SIZE}, minmax(34px, 1fr));
        gap: 4px;
        max-width: 460px;
      }

      .battle-cell,
      .battle-cell-action {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        background: #101820;
        font-size: 22px;
        line-height: 1;
      }

      .battle-cell-action {
        width: 100%;
        max-width: none;
        padding: 8px 0;
        cursor: pointer;
      }

      .battle-cell.hit-cell,
      .battle-cell.sunk-cell,
      .battle-cell.ufo-cell,
      .battle-cell.miss-cell {
        background: #151515;
      }

      .battle-miss-hidden .miss-cell .miss-emoji {
        visibility: hidden;
      }

      .battle-miss-hidden .miss-cell {
        background: #0e1720;
      }

      .battle-fleet-layout {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 18px;
      }

      .battle-fleet-card {
        background: #0d0d0d;
        border: 1px solid #222;
        border-radius: 16px;
        padding: 14px;
      }

      .battle-top-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 12px 0;
      }

      .battle-turn-box {
        background: #101010;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 10px 12px;
        margin-top: 8px;
      }

      .battle-note {
        color: #cfcfcf;
        font-size: 0.95em;
      }

      .jeux-table th,
      .jeux-table td {
        background: #111;
        color: #f4f4f4;
        border-color: #333;
      }
    </style>
  `;

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = rand(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function randomBoard() {
    const occupied = {};
    const ships = [];

    for (const piece of FLEET) {
      let placed = false;
      let tries = 0;
      while (!placed && tries < 500) {
        tries += 1;
        const horizontal = piece.size === 1 ? true : Math.random() < 0.5;
        const startX = rand(horizontal ? GRID_SIZE - piece.size + 1 : GRID_SIZE);
        const startY = rand(horizontal ? GRID_SIZE : GRID_SIZE - piece.size + 1);
        const cells = [];
        let bad = false;
        for (let i = 0; i < piece.size; i += 1) {
          const x = horizontal ? startX + i : startX;
          const y = horizontal ? startY : startY + i;
          const key = keyOf(x, y);
          if (occupied[key]) {
            bad = true;
            break;
          }
          cells.push(key);
        }
        if (bad) continue;
        cells.forEach(key => { occupied[key] = piece.code; });
        ships.push({
          code: piece.code,
          label: piece.label,
          emoji: piece.emoji,
          size: piece.size,
          hits: [],
          sunk: false,
          dodge_used: false
        });
        placed = true;
      }
      if (!placed) throw new Error(`Placement impossible pour ${piece.label}.`);
    }

    return { gridSize: GRID_SIZE, occupied, ships };
  }

  function getBoard(party, slot) {
    return clone(slot === 'p1' ? party.player_1_board : party.player_2_board);
  }

  function setBoard(party, slot, board) {
    if (slot === 'p1') party.player_1_board = board;
    else party.player_2_board = board;
  }

  function getShots(party, slot) {
    return clone(slot === 'p1' ? party.p1_shots || [] : party.p2_shots || []);
  }

  function setShots(party, slot, shots) {
    if (slot === 'p1') party.p1_shots = shots;
    else party.p2_shots = shots;
  }

  function logEvent(party, type, message) {
    const log = Array.isArray(party.log) ? clone(party.log) : [];
    log.unshift({ type, message, at: nowIso() });
    party.log = log.slice(0, 80);
  }

  function shipOn(board, code) {
    return (board.ships || []).find(ship => ship.code === code) || null;
  }

  function startTurn(party) {
    const slot = currentSlot(party);
    party.extra_shots_this_turn = Number(party[bankField(slot)] || 0);
    party[bankField(slot)] = 0;
    party.shots_used_this_turn = 0;
    party.hit_registered_this_turn = false;
  }

  function endTurn(party) {
    party.current_turn = otherSlot(currentSlot(party));
    startTurn(party);
  }

  function maxShotsThisTurn(party) {
    return BASE_SHOTS + (party.hit_registered_this_turn ? EXTRA_SHOTS_IF_HIT : 0) + Number(party.extra_shots_this_turn || 0);
  }

  function allVictoryTargetsDestroyed(board) {
    return (board.ships || [])
      .filter(ship => !OPTIONAL_VICTORY_CODES.has(ship.code))
      .every(ship => ship.sunk);
  }

  function myName(party, slot, names) {
    if (slot === 'p1') return names[party.joueur_1_id] || 'Joueur 1';
    if (isSolo(party)) return party.nom_bot || 'Système';
    return names[party.joueur_2_id] || 'Joueur 2';
  }

  async function fetchParty(id) {
    const { data, error } = await supabase.from('battleship_parties').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function saveParty(party) {
    const payload = { ...party, updated_at: nowIso() };
    const { error } = await supabase.from('battleship_parties').update(payload).eq('id', party.id);
    if (error) throw error;
  }

  async function fetchNamesFromParty(party) {
    const ids = [party.joueur_1_id, party.joueur_2_id, party.gagnant_joueur_id].filter(Boolean);
    if (!ids.length) return {};
    const { data, error } = await supabase.from('joueurs').select('id, nom').in('id', Array.from(new Set(ids)));
    if (error) throw error;
    const map = {};
    (data || []).forEach(j => { map[j.id] = j.nom; });
    return map;
  }

  async function fetchPlayablePlayers() {
    const { data, error } = await supabase.from('joueurs').select('id, nom').order('nom');
    if (error) throw error;
    const ordrePrincipal = ['VINCENT', 'MARC', 'JULIE'];
    return (data || [])
      .filter(j => normalize(j.nom) !== 'BGG')
      .sort((a, b) => {
        const na = normalize(a.nom);
        const nb = normalize(b.nom);
        const ia = ordrePrincipal.indexOf(na);
        const ib = ordrePrincipal.indexOf(nb);
        const ma = ia !== -1;
        const mb = ib !== -1;
        if (ma && mb) return ia - ib;
        if (ma !== mb) return ma ? -1 : 1;
        return na.localeCompare(nb, 'fr', { sensitivity: 'base' });
      });
  }

  async function addStarIfNeeded(party) {
    if (!party.gagnant_joueur_id || party.etoile_donnee) return false;
    const { data: joueur, error: joueurError } = await supabase.from('joueurs').select('id, etoiles').eq('id', party.gagnant_joueur_id).single();
    if (joueurError) throw joueurError;
    const { error: updateJoueurError } = await supabase.from('joueurs').update({ etoiles: Number(joueur.etoiles || 0) + 1 }).eq('id', joueur.id);
    if (updateJoueurError) throw updateJoueurError;
    const { error: updatePartyError } = await supabase.from('battleship_parties').update({ etoile_donnee: true, updated_at: nowIso() }).eq('id', party.id);
    if (updatePartyError) throw updatePartyError;
    return true;
  }

  async function bumpStats(joueurId, delta) {
    if (!joueurId) return;
    const { data: current, error: currentError } = await supabase.from('battleship_stats').select('*').eq('joueur_id', joueurId).maybeSingle();
    if (currentError) throw currentError;
    const next = {
      joueur_id: joueurId,
      parties_jouees: Number(current?.parties_jouees || 0) + Number(delta.parties_jouees || 0),
      victoires: Number(current?.victoires || 0) + Number(delta.victoires || 0),
      defaites: Number(current?.defaites || 0) + Number(delta.defaites || 0),
      tirs_total: Number(current?.tirs_total || 0) + Number(delta.tirs_total || 0),
      tirs_reussis: Number(current?.tirs_reussis || 0) + Number(delta.tirs_reussis || 0),
      tirs_manques: Number(current?.tirs_manques || 0) + Number(delta.tirs_manques || 0),
      ufo_detruits: Number(current?.ufo_detruits || 0) + Number(delta.ufo_detruits || 0),
      etoiles_battleship: Number(current?.etoiles_battleship || 0) + Number(delta.etoiles_battleship || 0),
      updated_at: nowIso()
    };
    const { error } = await supabase.from('battleship_stats').upsert(next, { onConflict: 'joueur_id' });
    if (error) throw error;
  }

  async function finalizeParty(party, winnerSlot) {
    if (party.statut === 'terminee') return;
    const loserSlot = otherSlot(winnerSlot);
    const winnerId = winnerSlot === 'p1' ? party.joueur_1_id : party.joueur_2_id;
    const loserId = loserSlot === 'p1' ? party.joueur_1_id : party.joueur_2_id;
    const winnerShots = getShots(party, winnerSlot);
    const loserShots = getShots(party, loserSlot);

    party.statut = 'terminee';
    party.gagnant_joueur_id = winnerId || null;
    party.shots_used_this_turn = 0;
    party.hit_registered_this_turn = false;
    party.extra_shots_this_turn = 0;

    await saveParty(party);

    if (winnerId) {
      await bumpStats(winnerId, {
        parties_jouees: 1,
        victoires: 1,
        defaites: 0,
        tirs_total: winnerShots.length,
        tirs_reussis: winnerShots.filter(s => s.result === 'hit' || s.result === 'sunk').length,
        tirs_manques: winnerShots.filter(s => s.result === 'miss' || s.result === 'ufo_dodge').length,
        ufo_detruits: winnerShots.filter(s => s.result === 'sunk' && s.piece_code === 'ufo').length,
        etoiles_battleship: 0
      });
    }

    if (loserId) {
      await bumpStats(loserId, {
        parties_jouees: 1,
        victoires: 0,
        defaites: 1,
        tirs_total: loserShots.length,
        tirs_reussis: loserShots.filter(s => s.result === 'hit' || s.result === 'sunk').length,
        tirs_manques: loserShots.filter(s => s.result === 'miss' || s.result === 'ufo_dodge').length,
        ufo_detruits: loserShots.filter(s => s.result === 'sunk' && s.piece_code === 'ufo').length,
        etoiles_battleship: 0
      });
    }
  }

  function resolveShot(board, key) {
    const pieceCode = board.occupied?.[key];
    if (!pieceCode) {
      return { result: 'miss', pieceCode: null, message: '⚪ Manqué.' };
    }

    const ship = shipOn(board, pieceCode);
    if (!ship) {
      return { result: 'miss', pieceCode: null, message: '⚪ Manqué.' };
    }

    if (ship.code === 'ufo' && !ship.dodge_used && Math.random() < 0.5) {
      ship.dodge_used = true;
      return { result: 'ufo_dodge', pieceCode: ship.code, message: '🛸 Le UFO a disparu !' };
    }

    ship.dodge_used = true;
    if (!ship.hits.includes(key)) ship.hits.push(key);

    if (ship.hits.length >= ship.cells.length) {
      ship.sunk = true;
      return { result: 'sunk', pieceCode: ship.code, message: `💀 ${ship.label} coulé !` };
    }

    return { result: 'hit', pieceCode: ship.code, message: `💥 ${ship.label} touché !` };
  }

  function fireShot(party, slot, x, y, names) {
    if (party.statut === 'terminee') throw new Error('Cette partie est terminée.');
    if (currentSlot(party) !== slot) throw new Error("Ce n'est pas le bon tour.");

    const key = keyOf(x, y);
    const targetSlot = otherSlot(slot);
    const targetBoard = getBoard(party, targetSlot);
    const attackerShots = getShots(party, slot);
    if (attackerShots.some(s => s.key === key)) throw new Error('Cette case a déjà été ciblée.');

    const resolution = resolveShot(targetBoard, key);
    attackerShots.push({ key, x, y, result: resolution.result, piece_code: resolution.pieceCode, at: nowIso() });
    setShots(party, slot, attackerShots);
    setBoard(party, targetSlot, targetBoard);

    party.shots_used_this_turn = Number(party.shots_used_this_turn || 0) + 1;
    if (resolution.result === 'hit' || resolution.result === 'sunk') {
      party.hit_registered_this_turn = true;
    }

    const shooterName = myName(party, slot, names);
    logEvent(party, resolution.result, `${shooterName} vise ${String.fromCharCode(65 + x)}${y + 1} — ${resolution.message}`);

    if (resolution.result === 'sunk' && resolution.pieceCode === 'ufo') {
      party[bankField(slot)] = Number(party[bankField(slot)] || 0) + UFO_BONUS_NEXT_TURN;
      logEvent(party, 'ufo_bonus', `🛸 UFO abattu ! ${shooterName} gagnera ${UFO_BONUS_NEXT_TURN} tirs bonus à son prochain tour.`);
    }

    if (allVictoryTargetsDestroyed(targetBoard)) {
      logEvent(party, 'win', `🏆 ${shooterName} remporte la partie ! Les cibles principales sont toutes détruites.`);
      return { winnerSlot: slot, endTurn: false };
    }

    return { winnerSlot: null, endTurn: party.shots_used_this_turn >= maxShotsThisTurn(party) };
  }

  function pickBotTarget(party) {
    const tried = new Set((party.p2_shots || []).map(s => s.key));
    const playerBoard = getBoard(party, 'p1');
    const candidates = new Set();
    (playerBoard.ships || []).forEach(ship => {
      if (ship.sunk) return;
      (ship.hits || []).forEach(key => {
        const { x, y } = parseKey(key);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const nKey = keyOf(nx, ny);
            if (!tried.has(nKey)) candidates.add(nKey);
          }
        });
      });
    });

    const priority = shuffle(Array.from(candidates));
    if (priority.length) return parseKey(priority[0]);

    const available = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (!tried.has(keyOf(x, y))) available.push({ x, y });
      }
    }
    if (!available.length) throw new Error('Le système n’a plus de cible.');
    return available[rand(available.length)];
  }

  async function playBot(party, names) {
    if (!isSolo(party) || currentSlot(party) !== 'p2' || party.statut === 'terminee') return;
    let safety = 0;
    while (party.statut !== 'terminee' && currentSlot(party) === 'p2' && safety < 20) {
      safety += 1;
      const target = pickBotTarget(party);
      const outcome = fireShot(party, 'p2', target.x, target.y, names);
      if (outcome.winnerSlot) {
        await finalizeParty(party, outcome.winnerSlot);
        return;
      }
      if (outcome.endTurn) {
        endTurn(party);
        logEvent(party, 'turn', '🔁 Tour suivant : à toi de jouer.');
        return;
      }
    }
  }

  function ownerCell(board, enemyShots, x, y) {
    const key = keyOf(x, y);
    const shot = (enemyShots || []).find(s => s.key === key);
    const pieceCode = board.occupied?.[key];
    const ship = pieceCode ? shipOn(board, pieceCode) : null;
    if (shot) {
      if (shot.result === 'ufo_dodge') return { emoji: '🌀', className: 'ufo-cell' };
      if (shot.result === 'miss') return { emoji: '⚪', className: 'miss-cell' };
      return { emoji: ship?.sunk ? '💀' : '💥', className: ship?.sunk ? 'sunk-cell' : 'hit-cell' };
    }
    return { emoji: ship ? ship.emoji : '💦', className: '' };
  }

  function enemyCell(shots, targetBoard, x, y) {
    const key = keyOf(x, y);
    const shot = (shots || []).find(s => s.key === key);
    if (!shot) return { emoji: '💦', className: '' };
    if (shot.result === 'ufo_dodge') return { emoji: '🌀', className: 'ufo-cell' };
    if (shot.result === 'miss') return { emoji: '⚪', className: 'miss-cell' };
    const ship = shot.piece_code ? shipOn(targetBoard, shot.piece_code) : null;
    const sunk = ship?.sunk || shot.result === 'sunk';
    return { emoji: sunk ? '💀' : '💥', className: sunk ? 'sunk-cell' : 'hit-cell' };
  }

  function fleetSummary(board) {
    return (board.ships || []).map(ship => ({
      emoji: ship.emoji,
      label: ship.label,
      hits: (ship.hits || []).length,
      size: ship.size,
      sunk: ship.sunk,
      optional: OPTIONAL_VICTORY_CODES.has(ship.code)
    }));
  }

  function renderGrid({ own, ownBoard, targetBoard, ownShots, enemyShots, action }) {
    let html = `<div class="battle-grid">`;
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cell = own
          ? ownerCell(ownBoard, enemyShots, x, y)
          : enemyCell(ownShots, targetBoard, x, y);

        const emojiHtml = cell.className === 'miss-cell'
          ? `<span class="miss-emoji">${cell.emoji}</span>`
          : cell.emoji;

        if (!own && cell.emoji === '💦' && action) {
          html += `<form method="POST" action="${action}" style="margin:0;">
            <input type="hidden" name="x" value="${x}">
            <input type="hidden" name="y" value="${y}">
            <button type="submit" class="battle-cell-action">${emojiHtml}</button>
          </form>`;
        } else {
          html += `<div class="battle-cell ${cell.className}">${emojiHtml}</div>`;
        }
      }
    }
    html += `</div>`;
    return html;
  }

  function renderFleetBoxes(summary) {
    return `<div style="display:flex;flex-wrap:wrap;gap:10px;">${summary.map(item => `
      <div class="result-box" style="margin:0;padding:8px 10px;min-width:140px;">
        <div><b>${item.emoji} ${escapeHtml(item.label)}</b></div>
        <div>Touches : ${item.hits}/${item.size}</div>
        <div>${item.sunk ? '💀 Coulé' : '💦 En vie'}</div>
        <div class="battle-note">${item.optional ? 'Cible bonus' : 'Cible requise'}</div>
      </div>`).join('')}</div>`;
  }

  function renderFxScript(fx) {
    return `<script>
      (function(){
        const fx = ${JSON.stringify(fx || '')};
        if(!fx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if(!AudioCtx) return;
        const ctx = new AudioCtx();
        function beep(freq,duration){
          const osc=ctx.createOscillator();
          const gain=ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value=freq;
          gain.gain.setValueAtTime(0.0001,ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.08,ctx.currentTime+0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration);
          osc.start(); osc.stop(ctx.currentTime+duration+0.02);
        }
        const bank={hit:[[520,0.12],[720,0.16]],sunk:[[240,0.12],[180,0.14],[120,0.22]],miss:[[300,0.10]],ufo_dodge:[[860,0.08],[980,0.08],[1220,0.12]],ufo_bonus:[[700,0.08],[900,0.10],[1200,0.16]],win:[[660,0.10],[880,0.12],[1100,0.18]]}[fx]||[[440,0.10]];
        let offset=0; bank.forEach(([f,d])=>{ setTimeout(()=>beep(f,d),offset); offset+=110; });
      })();

      function toggleMisses(button) {
        document.body.classList.toggle('battle-miss-hidden');
        const hidden = document.body.classList.contains('battle-miss-hidden');
        if (button) button.textContent = hidden ? '🔓 Libéré' : '⚪ Voir les manqués';
      }
    </script>`;
  }

  app.get('/battleship', requireAuth, async (req, res) => {
    try {
      const { data: parties, error } = await supabase
        .from('battleship_parties')
        .select('id, mode, statut, joueur_1_id, joueur_2_id, nom_bot, current_turn, gagnant_joueur_id, etoile_donnee, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((parties || []).flatMap(p => [p.joueur_1_id, p.joueur_2_id, p.gagnant_joueur_id]).filter(Boolean)));
      let names = {};
      if (ids.length) {
        const { data: joueurs, error: joueursError } = await supabase.from('joueurs').select('id, nom').in('id', ids);
        if (joueursError) throw joueursError;
        (joueurs || []).forEach(j => { names[j.id] = j.nom; });
      }

      const html = `
        ${battleTheme()}
        <h2>⚓ Battleship</h2>
        <div class="result-box"><b>V1 :</b> placement automatique, 1v1 pass-and-play, mode solo avec IA simple, UFO avec esquive 50% une fois et bonus de ${UFO_BONUS_NEXT_TURN} tirs au prochain tour.</div>
        <div class="result-box"><b>Victoire :</b> la partie se termine quand toutes les cibles principales sont détruites. Le UFO, le plongeur et l’île secrète sont des cibles bonus.</div>
        <button onclick="window.location.href='/battleship/nouvelle'">➕ Nouvelle partie</button><br>
        <button onclick="window.location.href='/battleship/stats'">📈 Mini statistiques</button><br><br>
        <a href="/menu">⬅ Retour</a><br><br>
        ${(parties || []).length ? (parties || []).map(p => {
          const j1 = names[p.joueur_1_id] || 'Joueur 1';
          const j2 = isSolo(p) ? (p.nom_bot || 'Système') : (names[p.joueur_2_id] || 'Joueur 2');
          const current = p.statut === 'terminee'
            ? (p.gagnant_joueur_id ? (names[p.gagnant_joueur_id] || 'Gagnant') : 'Terminé')
            : (p.current_turn === 'p1' ? j1 : j2);
          return `<div class="result-box">
            <div><b>#${p.id}</b> — ${p.mode === 'solo' ? '🤖 Solo' : '🆚 1v1'}</div>
            <div><b>Joueurs :</b> ${escapeHtml(j1)} vs ${escapeHtml(j2)}</div>
            <div><b>État :</b> ${p.statut === 'terminee' ? '🏁 Terminée' : '🎯 En cours'}</div>
            <div><b>${p.statut === 'terminee' ? 'Gagnant' : 'Tour actuel'} :</b> ${escapeHtml(current)}</div>
            <div style="margin-top:10px;">
              <button onclick="window.location.href='/battleship/partie/${p.id}'">Ouvrir</button>
              <form method="POST" action="/battleship/supprimer/${p.id}" class="inline-form" onsubmit="return confirm('Supprimer cette partie ?');">
                <button type="submit" style="width:auto;">🗑 Supprimer</button>
              </form>
            </div>
          </div>`;
        }).join('') : `<div class="result-box">Aucune partie Battleship pour le moment.</div>`}
        <a href="/menu">⬅ Retour</a>
      `;
      res.send(renderPage('Battleship', html));
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.get('/battleship/nouvelle', requireAuth, async (req, res) => {
    try {
      const joueurs = await fetchPlayablePlayers();
      const html = `
        ${battleTheme()}
        <h2>➕ Nouvelle partie Battleship</h2>
        <div class="result-box">
          <form method="POST" action="/battleship/nouvelle">
            Mode :<br>
            <select name="mode" id="modeBattleship" required>
              <option value="pvp">🆚 1v1</option>
              <option value="solo">🤖 Solo</option>
            </select><br>
            Joueur 1 :<br>
            <select name="joueur_1_id" required>
              <option value="">-- Choisir --</option>
              ${joueurs.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join('')}
            </select><br>
            <div id="zoneJoueur2">
              Joueur 2 :<br>
              <select name="joueur_2_id" id="joueur_2_id">
                <option value="">-- Choisir --</option>
                ${joueurs.map(j => `<option value="${j.id}">${escapeHtml(j.nom)}</option>`).join('')}
              </select><br>
            </div>
            <div id="zoneBot" style="display:none;">
              Nom du système :<br>
              <input name="nom_bot" value="UFO-9000"><br>
            </div>
            <button>Créer la partie</button>
          </form>
        </div>
        <div class="result-box"><b>Note V1 :</b> pour livrer une version stable rapidement, les flottes sont placées automatiquement. Le 1v1 est pensé pour se passer l'appareil entre les tours.</div>
        <a href="/battleship">⬅ Retour</a>
        <script>
          document.addEventListener('DOMContentLoaded', function () {
            const mode = document.getElementById('modeBattleship');
            const zoneJoueur2 = document.getElementById('zoneJoueur2');
            const zoneBot = document.getElementById('zoneBot');
            function refresh() {
              const solo = mode.value === 'solo';
              zoneJoueur2.style.display = solo ? 'none' : 'block';
              zoneBot.style.display = solo ? 'block' : 'none';
            }
            mode.addEventListener('change', refresh);
            refresh();
          });
        </script>
      `;
      res.send(renderPage('Nouvelle partie Battleship', html));
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.post('/battleship/nouvelle', requireAuth, async (req, res) => {
    try {
      const mode = String(req.body.mode || 'pvp').trim().toLowerCase();
      const joueur1 = Number(req.body.joueur_1_id);
      const joueur2 = req.body.joueur_2_id ? Number(req.body.joueur_2_id) : null;
      const nomBot = String(req.body.nom_bot || 'UFO-9000').trim() || 'UFO-9000';
      if (!joueur1) return res.send(renderPage('Erreur', 'Le joueur 1 est requis.'));
      if (!['pvp', 'solo'].includes(mode)) return res.send(renderPage('Erreur', 'Mode invalide.'));
      if (mode === 'pvp' && (!joueur2 || joueur1 === joueur2)) return res.send(renderPage('Erreur', 'Le joueur 2 est requis et doit être différent.'));

      const party = {
        mode,
        statut: 'active',
        joueur_1_id: joueur1,
        joueur_2_id: mode === 'pvp' ? joueur2 : null,
        nom_bot: mode === 'solo' ? nomBot : null,
        current_turn: 'p1',
        player_1_board: randomBoard(),
        player_2_board: randomBoard(),
        p1_shots: [],
        p2_shots: [],
        shots_used_this_turn: 0,
        hit_registered_this_turn: false,
        extra_shots_this_turn: 0,
        bonus_bank_p1: 0,
        bonus_bank_p2: 0,
        log: [{ type: 'start', message: '⚓ Nouvelle bataille lancée !', at: nowIso() }],
        gagnant_joueur_id: null,
        etoile_donnee: false,
        created_at: nowIso(),
        updated_at: nowIso()
      };

      const { data, error } = await supabase.from('battleship_parties').insert([party]).select('id').single();
      if (error) throw error;
      res.redirect(`/battleship/partie/${data.id}`);
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.get('/battleship/partie/:id', requireAuth, async (req, res) => {
    try {
      const party = await fetchParty(req.params.id);
      const names = await fetchNamesFromParty(party);
      const slot = currentSlot(party);
      const opponent = otherSlot(slot);
      const me = myName(party, slot, names);
      const foe = myName(party, opponent, names);
      const myBoard = getBoard(party, slot);
      const enemyBoardData = getBoard(party, opponent);
      const myShots = getShots(party, slot);
      const enemyShots = getShots(party, opponent);
      const maxShots = party.statut === 'terminee' ? 0 : maxShotsThisTurn(party);
      const remainingShots = party.statut === 'terminee' ? 0 : Math.max(0, maxShots - Number(party.shots_used_this_turn || 0));
      const logs = Array.isArray(party.log) ? party.log.slice(0, 20) : [];
      const winnerName = party.gagnant_joueur_id ? (names[party.gagnant_joueur_id] || 'Gagnant') : '';
      const maskMode = String(req.query.mask || '') === '1';
      const fx = logs[0]?.type || '';

      const html = `
        ${battleTheme()}
        <h2>⚓ Battleship #${party.id}</h2>

        <div class="result-box">
          <div><b>Mode :</b> ${party.mode === 'solo' ? '🤖 Solo' : '🆚 1v1'}</div>
          <div><b>Joueurs :</b> ${escapeHtml(names[party.joueur_1_id] || 'Joueur 1')} vs ${escapeHtml(isSolo(party) ? (party.nom_bot || 'Système') : (names[party.joueur_2_id] || 'Joueur 2'))}</div>
          <div><b>État :</b> ${party.statut === 'terminee' ? '🏁 Terminée' : '🎯 En cours'}</div>
          ${party.statut === 'terminee'
            ? `<div><b>Gagnant :</b> ${escapeHtml(winnerName)}</div>`
            : `<div><b>Tour actuel :</b> ${escapeHtml(me)}</div>
               <div class="battle-turn-box"><b>Tirs joués :</b> ${party.shots_used_this_turn} / ${maxShots}<br><b>Tirs restants avant le tour adverse :</b> ${remainingShots}</div>
               <div class="battle-note" style="margin-top:8px;">3 tirs de base. Si tu touches une cible, ton tour peut monter jusqu’à 5 tirs. Le UFO détruit donne ${UFO_BONUS_NEXT_TURN} tirs au prochain tour. Le UFO, le plongeur et l’île secrète sont des cibles bonus.</div>`}
        </div>

        ${party.statut !== 'terminee' ? `
          <div class="battle-top-actions">
            <button onclick="window.location.href='/battleship/partie/${party.id}?mask=1'">🙈 Masquer l'écran avant de passer l'appareil</button>
            <button type="button" onclick="toggleMisses(this)">🔓 Libéré</button>
          </div>
        ` : ''}

        <div class="battle-layout">
          <section class="battle-panel">
            <h3>🛡️ Ma grille (${escapeHtml(me)})</h3>
            ${renderGrid({ own: true, ownBoard: myBoard, enemyShots })}
          </section>
          <section class="battle-panel">
            <h3>🎯 Grille adverse</h3>
            ${renderGrid({ own: false, targetBoard: enemyBoardData, ownShots: myShots, action: party.statut === 'terminee' ? '' : `/battleship/tirer/${party.id}` })}
          </section>
        </div>

        <div class="battle-fleet-layout" style="margin-top:18px;">
          <section class="battle-fleet-card">
            <h3>🧩 Mon état de la flotte</h3>
            ${renderFleetBoxes(fleetSummary(myBoard))}
          </section>
          <section class="battle-fleet-card">
            <h3>🎯 État de la flotte adverse</h3>
            ${renderFleetBoxes(fleetSummary(enemyBoardData))}
          </section>
        </div>

        <h3>📜 Journal de bord</h3>
        <div class="result-box">
          ${logs.length ? logs.map(entry => `<div style="margin-bottom:6px;">${escapeHtml(entry.message)}</div>`).join('') : 'Aucun événement.'}
        </div>

        ${party.statut === 'terminee' && party.gagnant_joueur_id && !party.etoile_donnee ? `
          <form method="POST" action="/battleship/etoile/${party.id}" onsubmit="return confirm('Ajouter une étoile au gagnant ?');">
            <button type="submit">⭐ Donner une étoile au gagnant</button>
          </form>
        ` : ''}

        ${party.statut === 'terminee' && party.etoile_donnee ? `<div class="result-box"><b>⭐ Étoile déjà attribuée</b></div>` : ''}

        <a href="/battleship">⬅ Retour</a>

        ${maskMode ? `<div id="maskScreen" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;padding:30px;"><div style="background:white;border-radius:18px;padding:24px;max-width:480px;text-align:center;color:black;"><div style="font-size:2.2em;">🙈</div><h3 style="color:black;">Passe l'appareil à l'autre joueur</h3><p>Quand tout le monde est prêt, clique ci-dessous.</p><button onclick="document.getElementById('maskScreen').remove()">Reprendre la partie</button></div></div>` : ''}
        ${renderFxScript(fx)}
      `;
      res.send(renderPage(`Battleship #${party.id}`, html));
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.post('/battleship/tirer/:id', requireAuth, async (req, res) => {
    try {
      const x = Number(req.body.x);
      const y = Number(req.body.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        return res.send(renderPage('Erreur', 'Case invalide.'));
      }

      const party = await fetchParty(req.params.id);
      const names = await fetchNamesFromParty(party);
      const slot = currentSlot(party);
      const outcome = fireShot(party, slot, x, y, names);

      if (outcome.winnerSlot) {
        await finalizeParty(party, outcome.winnerSlot);
        return res.redirect(`/battleship/partie/${party.id}`);
      }

      if (outcome.endTurn) {
        endTurn(party);
        logEvent(party, 'turn', `🔁 Tour suivant : ${myName(party, currentSlot(party), names)}.`);
      }

      if (isSolo(party) && currentSlot(party) === 'p2') {
        await playBot(party, names);
      }

      await saveParty(party);
      res.redirect(`/battleship/partie/${party.id}`);
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.post('/battleship/etoile/:id', requireAuth, async (req, res) => {
    try {
      const party = await fetchParty(req.params.id);
      const added = await addStarIfNeeded(party);
      if (added && party.gagnant_joueur_id) {
        await bumpStats(party.gagnant_joueur_id, { etoiles_battleship: 1 });
      }
      res.redirect(`/battleship/partie/${party.id}`);
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.post('/battleship/supprimer/:id', requireAuth, async (req, res) => {
    try {
      const { error } = await supabase.from('battleship_parties').delete().eq('id', req.params.id);
      if (error) throw error;
      res.redirect('/battleship');
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });

  app.get('/battleship/stats', requireAuth, async (req, res) => {
    try {
      const { data: stats, error } = await supabase
        .from('battleship_stats')
        .select('joueur_id, parties_jouees, victoires, defaites, tirs_total, tirs_reussis, tirs_manques, ufo_detruits, etoiles_battleship, joueurs(nom)')
        .order('victoires', { ascending: false });
      if (error) throw error;

      const html = `
        ${battleTheme()}
        <h2>📈 Mini statistiques Battleship</h2>
        ${!(stats || []).length ? `<div class="result-box">Aucune statistique Battleship pour le moment.</div>` : `
          <div class="table-wrap">
            <table class="jeux-table">
              <tr>
                <th>Joueur</th>
                <th>Parties</th>
                <th>V</th>
                <th>D</th>
                <th>Précision</th>
                <th>UFO détruits</th>
                <th>Étoiles</th>
              </tr>
              ${(stats || []).map(row => {
                const precision = Number(row.tirs_total || 0)
                  ? ((Number(row.tirs_reussis || 0) / Number(row.tirs_total || 0)) * 100).toFixed(1) + ' %'
                  : '—';
                return `<tr>
                  <td><b>${escapeHtml(row.joueurs?.nom || 'Joueur')}</b></td>
                  <td>${row.parties_jouees || 0}</td>
                  <td>${row.victoires || 0}</td>
                  <td>${row.defaites || 0}</td>
                  <td>${precision}</td>
                  <td>${row.ufo_detruits || 0}</td>
                  <td>${row.etoiles_battleship || 0}</td>
                </tr>`;
              }).join('')}
            </table>
          </div>`}
        <a href="/battleship">⬅ Retour</a>
      `;
      res.send(renderPage('Stats Battleship', html));
    } catch (err) {
      res.send(renderPage('Erreur', err.message));
    }
  });
}
