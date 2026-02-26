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
    row.className = "hover:bg-white/5 transition-colors cursor-pointer group";
    
    let wins = team.wins;
    let losses = team.losses;
    let isMyTeam = false;

    if (active && team.name === active.team && active.stats) {
      wins = active.stats.wins || 0;
      losses = active.stats.losses || 0;
      isMyTeam = true;
      row.classList.add('bg-val-red/10');
    }

    const totalGames = wins + losses;
    const winPct = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) + '%' : '0.0%';
    const points = wins * 3; // Standard 3 points per win
    const logoPath = teamLogos[team.name] || 'assets/team_logos/default.png';

    row.innerHTML = `
      <td class="p-4 text-center font-mono text-gray-400">${idx + 1}</td>
      <td class="p-4 flex items-center gap-3">
        <img src="${logoPath}" alt="${team.name}" class="w-8 h-8 object-contain">
        <span class="font-bold text-white group-hover:text-val-red transition-colors">${team.name} ${isMyTeam ? '<span class="text-xs text-val-red ml-1">(YOU)</span>' : ''}</span>
      </td>
      <td class="p-4 text-gray-300 font-mono">${wins}W - ${losses}L</td>
      <td class="p-4 text-gray-300 font-mono">${winPct}</td>
      <td class="p-4 text-white font-bold">${points} PTS</td>
      <td class="p-4 text-center">
        <span class="inline-block px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-bold">W1</span>
      </td>
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

    const row = document.createElement('tr');
    row.className = "hover:bg-white/5 transition-colors";
    
    // Determine OVR color
    let ovrClass = "text-gray-400";
    if (ovr >= 90) ovrClass = "text-val-red font-bold";
    else if (ovr >= 80) ovrClass = "text-purple-400 font-bold";
    else if (ovr >= 70) ovrClass = "text-blue-400";
    else if (ovr >= 60) ovrClass = "text-green-400";

    const flagUrl = player.nationality ? `https://flagcdn.com/24x18/${getCountryCode(player.nationality)}.png` : '';
    const flagImg = flagUrl ? `<img src="${flagUrl}" class="w-5 h-3 inline-block mr-2" alt="${player.nationality}">` : '';

    row.innerHTML = `
      <td class="p-3">
        <div class="flex items-center">
          ${flagImg}
          <span class="text-white font-medium">${player.name}</span>
        </div>
      </td>
      <td class="p-3 text-gray-400">${player.role || 'Flex'}</td>
      <td class="p-3 ${ovrClass}">${ovr}</td>
      <td class="p-3 text-gray-400">${player.nationality || 'Unknown'}</td>
    `;
    rosterBody.appendChild(row);
  });
  
  window.openRosterModal();
}

function getCountryCode(countryName) {
    // Basic mapping for flags
    const map = {
        "USA": "us", "Canada": "ca", "Brazil": "br", "Argentina": "ar", "Chile": "cl", 
        "UK": "gb", "France": "fr", "Germany": "de", "Spain": "es", "Turkey": "tr", "Russia": "ru",
        "South Korea": "kr", "Japan": "jp", "China": "cn", "India": "in", "Thailand": "th", 
        "Indonesia": "id", "Philippines": "ph", "Singapore": "sg", "Australia": "au",
        "Sweden": "se", "Denmark": "dk", "Poland": "pl", "Ukraine": "ua", "Finland": "fi"
    };
    return map[countryName] || "xx";
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