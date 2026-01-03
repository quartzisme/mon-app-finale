function chargerJeux() {
  fetch('/api/jeux')
    .then(res => res.json())
    .then(data => {
      const liste = document.getElementById('listeJeux');
      liste.innerHTML = '';
      data.forEach(j => {
        const li = document.createElement('li');
        li.textContent = `${j.nom} (${j.min_joueurs}-${j.max_joueurs} joueurs, ${j.temps_min}-${j.temps_max} min, ${j.statut})`;
        liste.appendChild(li);
      });
    });
}

function ajouterJeu() {
  const nom = document.getElementById('nom').value;
  const min = parseInt(document.getElementById('min').value);
  const max = parseInt(document.getElementById('max').value);
  const temps_min = parseInt(document.getElementById('temps_min').value);
  const temps_max = parseInt(document.getElementById('temps_max').value);
  const ext = document.getElementById('ext').value;
  const statut = document.getElementById('statut').value;

  fetch('/api/jeux', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, min_joueurs: min, max_joueurs: max, temps_min, temps_max, extensions: ext, statut })
  })
  .then(res => res.json())
  .then(data => {
    console.log('Jeu ajouté ID:', data.id);
    chargerJeux();
    document.getElementById('nom').value = '';
    document.getElementById('min').value = '';
    document.getElementById('max').value = '';
    document.getElementById('temps_min').value = '';
    document.getElementById('temps_max').value = '';
    document.getElementById('ext').value = '';
    document.getElementById('statut').value = '';
  });
}

window.onload = chargerJeux;
