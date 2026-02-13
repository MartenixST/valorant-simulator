import { loadCareer, getSafeTeamByName } from './career_local_storage.jsx';
import { teamLogos } from './teams.js';

export const standings = {
  Americas: [
    { name: "100 Thieves", wins: 0, losses: 0 }, { name: "Cloud9", wins: 0, losses: 0 }, { name: "Evil Geniuses", wins: 0, losses: 0 }, { name: "FURIA", wins: 0, losses: 0 }, { name: "KRÜ Esports", wins: 0, losses: 0 }, 
    { name: "Leviatan", wins: 0, losses: 0 }, { name: "LOUD", wins: 0, losses: 0 }, { name: "MIBR", wins: 0, losses: 0 }, { name: "NRG", wins: 0, losses: 0 }, { name: "Sentinels", wins: 0, losses: 0 }, { name: "G2 Esports", wins: 0, losses: 0 }, { name: "2GAME Esports", wins: 0, losses: 0 }
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
    const localSave = localStorage.getItem(`save_${id}`);
    return localSave ? JSON.parse(localSave) : null;
  } catch (e) {
    return null;
  }
}

function updateActiveSave(updatedSave) {
  try {
    if (updatedSave && updatedSave.id) {
      const saveToStore = { ...updatedSave };
      if (saveToStore.players && saveToStore.players.length > 500) {
        const userTeamId = String(updatedSave.teamId);
        const userTeamPlayers = saveToStore.players.filter(p => String(p.teamId) === userTeamId);
        const otherPlayers = saveToStore.players.filter(p => String(p.teamId) !== userTeamId);
        saveToStore.players = [...userTeamPlayers, ...otherPlayers.slice(0, 500)];
      }
      localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(saveToStore));
    }
  } catch (e) {
    console.warn("updateActiveSave: localStorage quota exceeded", e);
  }
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

    row.addEventListener('click', () => showTeamRoster(team.name));
    standingsBody.appendChild(row);
  });
}

function showTeamRoster(teamName) {
  const teamData = getSafeTeamByName(teamName);
  const modal = document.getElementById('roster-modal');
  const modalTeamName = document.getElementById('modal-team-name');
  const modalTeamLogo = document.getElementById('modal-team-logo');
  const rosterBody = document.getElementById('roster-body');

  if (!teamData || !modal || !rosterBody) return;

  modalTeamName.textContent = teamData.name;
  modalTeamLogo.src = teamLogos[teamData.name] || 'assets/team_logos/default.png';
  rosterBody.innerHTML = '';

  const players = teamData.players || [];
  players.forEach(player => {
    // Recalculate OVR from ratings if it's missing or defaulted to 50
    let ovr = player.overall;
    if (!ovr || ovr === 50) {
      if (player.rating) {
        // If player.rating is an object, sum its properties
        if (typeof player.rating === 'object') {
          const stats = [
            player.rating.aim, player.rating.movement, player.rating.gameSense,
            player.rating.clutch, player.rating.aggression, player.rating.utility,
            player.rating.mental, player.rating.teamwork, player.rating.consistency
          ];
          const sum = stats.reduce((acc, curr) => acc + (Number(curr) || 50), 0);
          ovr = Math.round(sum / 9);
        } else if (typeof player.rating === 'number') {
          ovr = player.rating;
        }
      }
      
      if (!ovr || ovr < 50) ovr = 50; // Final safety fallback
    }

    const getRatingClass = (val) => {
      if (val >= 85) return 'rating-elite';
      if (val >= 75) return 'rating-good';
      if (val >= 65) return 'rating-average';
      return 'rating-poor';
    };

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${player.name}</td>
      <td><span class="role-tag">${player.role}</span></td>
      <td><span class="rating-value ${getRatingClass(ovr)}">${ovr}</span></td>
      <td>${player.nationality || 'Unknown'}</td>
    `;
    rosterBody.appendChild(row);
  });

  modal.style.display = 'block';

  // Close modal when clicking X
  const closeBtn = modal.querySelector('.close-modal');
  closeBtn.onclick = () => modal.style.display = 'none';

  // Close modal when clicking outside
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
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