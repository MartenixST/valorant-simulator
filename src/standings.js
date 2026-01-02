import { loadCareer } from './career_local_storage.jsx';
import { teamLogos } from './teams.js';

export const standings = {
  Americas: [
    { name: "100 Thieves", wins: 0, losses: 0 }, { name: "Cloud9", wins: 0, losses: 0 }, { name: "Evil Geniuses", wins: 0, losses: 0 }, { name: "FURIA", wins: 0, losses: 0 }, { name: "KRÜ Esports", wins: 0, losses: 0 }, 
    { name: "Leviatán", wins: 0, losses: 0 }, { name: "LOUD", wins: 0, losses: 0 }, { name: "MIBR", wins: 0, losses: 0 }, { name: "NRG", wins: 0, losses: 0 }, { name: "Sentinels", wins: 0, losses: 0 }, { name: "G2 Esports", wins: 0, losses: 0 }, { name: "2GAME Esports", wins: 0, losses: 0 }
  ],
  EMEA: [
    { name: "Team Liquid", wins: 0, losses: 0 }, { name: "GiantX", wins: 0, losses: 0 }, { name: "Natus Vincere", wins: 0, losses: 0 }, { name: "Fnatic", wins: 0, losses: 0 }, { name: "BBL Esports", wins: 0, losses: 0 },
    { name: "Karmine Corp", wins: 0, losses: 0 }, { name: "Team Heretics", wins: 0, losses: 0 }, { name: "Vitality", wins: 0, losses: 0 }, { name: "Apeks", wins: 0, losses: 0 }, { name: "KOI", wins: 0, losses: 0 }, { name: "FUT Esports", wins: 0, losses: 0 }, { name: "Gentle Mates", wins: 0, losses: 0 }
  ],
  Pacific: [
    { name: "Zeta Divison", wins: 0, losses: 0 }, { name: "Team Secret", wins: 0, losses: 0 }, { name: "Paper Rex", wins: 0, losses: 0 }, { name: "DetonationFocusMe", wins: 0, losses: 0 }, { name: "Gen.G", wins: 0, losses: 0 }, 
    { name: "DRX", wins: 0, losses: 0 }, { name: "T1", wins: 0, losses: 0 }, { name: "Boom Esports", wins: 0, losses: 0 }, { name: "Nongshim Redforce", wins: 0, losses: 0 }, { name: "Talon", wins: 0, losses: 0 }, { name: "Global Esports", wins: 0, losses: 0 }, { name: "Rex Regum Qeon", wins: 0, losses: 0 }
  ],
  China: [
    { name: "All Gamers", wins: 0, losses: 0 }, { name: "Edward Gaming", wins: 0, losses: 0 }, { name: "FunPlus Phoenix", wins: 0, losses: 0 }, { name: "Wolves Esports", wins: 0, losses: 0 }, { name: "Bilibili Gaming", wins: 0, losses: 0 }, 
    { name: "JD Gaming", wins: 0, losses: 0 }, { name: "Nova Esports", wins: 0, losses: 0 }, { name: "Titan Esports Club", wins: 0, losses: 0 }, { name: "Trace Esports", wins: 0, losses: 0 }, { name: "Tyloo", wins: 0, losses: 0 }, { name: "XLG Esports", wins: 0, losses: 0 }, { name: "Dragon Ranger Gaming", wins: 0, losses: 0 }
  ]
};

let currentRegion = 'Americas';

export function getActiveSave() {
  try {
    const id = localStorage.getItem('activeSaveId');
    if (!id) return null;
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    return saves.find(s => String(s.id) === String(id)) || null;
  } catch (e) {
    return null;
  }
}

function updateActiveSave(updatedSave) {
  try {
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    const idx = saves.findIndex(s => String(s.id) === String(updatedSave.id));
    if (idx !== -1) {
      saves[idx] = updatedSave;
      localStorage.setItem('careerSaves', JSON.stringify(saves));
    }
  } catch (e) {}
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function buildShuffledOrder() {
  const order = {};
  Object.entries(standings).forEach(([region, teams]) => {
    const copy = teams.slice();
    shuffleArray(copy);
    order[region] = copy;
  });
  return order;
}

function getPersistentOrder(active) {
  // When an active save exists, ensure a persistent order on the save
  if (active) {
    if (!active.standingsOrder) {
      active.standingsOrder = buildShuffledOrder();
      updateActiveSave(active);
    }
    return active.standingsOrder;
  }

  // No active save: persist for session so it doesn't change every render
  try {
    let temp = localStorage.getItem('tempStandingsOrder');
    if (!temp) {
      const order = buildShuffledOrder();
      localStorage.setItem('tempStandingsOrder', JSON.stringify(order));
      return order;
    }
    return JSON.parse(temp);
  } catch (e) {
    return buildShuffledOrder();
  }
}

export function renderStandings() {
  const active = loadCareer();
  const standingsBody = document.getElementById('standings-body');
  if (!standingsBody) return;

  standingsBody.innerHTML = '';

  const regionTeams = standings[currentRegion];
  if (!regionTeams) return;

  let teamsToRender = regionTeams.slice();
  
  // Use persistent order if available
  const order = getPersistentOrder(active);
  if (order && order[currentRegion]) {
    // Merge current stats into the persistent order
    teamsToRender = order[currentRegion].map(persistedTeam => {
      const liveTeam = regionTeams.find(t => t.name === persistedTeam.name);
      return { ...persistedTeam, ...liveTeam };
    });
  }

  // Sort teams: wins (desc), losses (asc), then by name
  teamsToRender.sort((a, b) => {
    const aWins = (active && a.name === active.team && active.stats) ? (active.stats.wins || 0) : a.wins;
    const bWins = (active && b.name === active.team && active.stats) ? (active.stats.wins || 0) : b.wins;
    const aLosses = (active && a.name === active.team && active.stats) ? (active.stats.losses || 0) : a.losses;
    const bLosses = (active && b.name === active.team && active.stats) ? (active.stats.losses || 0) : b.losses;

    if (aWins !== bWins) return bWins - aWins;
    if (aLosses !== bLosses) return aLosses - bLosses;
    return a.name.localeCompare(b.name);
  });

  teamsToRender.forEach((team, idx) => {
    const row = document.createElement('tr');
    row.style.setProperty('--row-index', idx);
    
    let wins = team.wins;
    let losses = team.losses;
    let isMyTeam = false;

    if (active && team.name === active.team && active.stats) {
      wins = active.stats.wins || 0;
      losses = active.stats.losses || 0;
      isMyTeam = true;
      row.classList.add('my-team-row');
      row.style.background = 'rgba(255, 70, 85, 0.1)';
    }

    const totalGames = wins + losses;
    const winPct = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) + '%' : '0.0%';
    const points = wins * 3; // Standard 3 points per win
    const logoPath = teamLogos[team.name] || 'assets/team_logos/default.png';

    row.innerHTML = `
      <td class="rank-col">${idx + 1}</td>
      <td class="team-col">
        <img src="${logoPath}" alt="${team.name}" class="team-logo">
        <span class="team-name">${team.name} ${isMyTeam ? '<small>(YOU)</small>' : ''}</span>
      </td>
      <td class="record-col">${wins}W - ${losses}L</td>
      <td>${winPct}</td>
      <td class="pts-col">${points} PTS</td>
      <td class="streak-col"><span class="streak-win">W1</span></td>
    `;

    standingsBody.appendChild(row);
  });
}

// Handle region switching
window.addEventListener('regionChanged', (e) => {
  currentRegion = e.detail.region;
  renderStandings();
});

// Initialize on load
document.addEventListener('DOMContentLoaded', renderStandings);

// Expose for manual refresh
window.renderStandings = renderStandings;