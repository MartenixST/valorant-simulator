import { teams, teamLogos } from './teams.js';
import { loadCareer, saveCareer, getKickoffState } from './career_local_storage.jsx';
import { renderKickoff } from './tournaments/kickoff/kickoff.jsx';
import { initializeGameData } from './game_data.js';
import { getTeamsWithPlayers } from './players.js';
import { getFlagUrl } from './utils/countryCodes.js';

const teamColors = {
  "100 Thieves": "#E4002B",
  "Cloud9": "#009FE3",
  "Evil Geniuses": "#0F1F3A",
  "FURIA": "#FF0000",
  "KRÜ Esports": "#00C2FF",
  "Leviatan": "#00428A",
  "Leviatán": "#00428A",
  "LOUD": "#00FF00",
  "MIBR": "#000000",
  "NRG": "#FF4A00",
  "Sentinels": "#CC0000",
  "G2 Esports": "#FF0000",
  "2GAME Esports": "#000000",
  "Team Liquid": "#00FFFF",
  "GiantX": "#000000",
  "Natus Vincere": "#FFFF00",
  "Fnatic": "#FF6600",
  "BBL Esports": "#FF0000",
  "Karmine Corp": "#0000FF",
  "Team Heretics": "#00FF00",
  "Vitality": "#FFFF00",
  "Apeks": "#FF0000",
  "KOI": "#0000FF",
  "FUT Esports": "#00FF00",
  "Gentle Mates": "#000000",
  "Zeta Divison": "#FF0000",
  "Team Secret": "#000000",
  "Paper Rex": "#FF0000",
  "DetonationFocusMe": "#FF0000",
  "Gen.G": "#FFFF00",
  "DRX": "#0000FF",
  "T1": "#FF0000",
  "Boom Esports": "#000000",
  "Nongshim Redforce": "#FF0000",
  "Talon": "assets/team_logos/talon_esports.png",
  "Global Esports": "#000000",
  "Rex Regum Qeon": "#FF0000",
  "All Gamers": "#FF0000",
  "Edward Gaming": "#000000",
  "FunPlus Phoenix": "#FF0000",
  "Wolves Esports": "#000000",
  "Bilibili Gaming": "#0000FF",
  "JD Gaming": "#000000",
  "Nova Esports": "#FF0000",
  "Titan Esports Club": "#000000",
  "Trace Esports": "#000000",
  "Tyloo": "#FF0000",
  "XLG Esports": "#000000",
  "Dragon Ranger Gaming": "#000000"
};

const regions = {
  Americas: [
    "100 Thieves", "Cloud9", "Evil Geniuses", "FURIA", "KRÜ Esports", 
    "Leviatan", "LOUD", "MIBR", "NRG", "Sentinels", "G2 Esports", "2GAME Esports"
  ],
  EMEA: [
    "Team Liquid", "GiantX", "Natus Vincere", "Fnatic", "BBL Esports",
    "Karmine Corp", "Team Heretics", "Vitality", "Apeks", "KOI", "FUT Esports", "Gentle Mates"
  ],
  Pacific: [
    "Zeta Divison", "Team Secret", "Paper Rex", "DetonationFocusMe", "Gen.G", 
    "DRX", "T1", "Boom Esports", "Nongshim Redforce", "Talon", "Global Esports", "Rex Regum Qeon"
  ],
  China: [
    "All Gamers", "Edward Gaming", "FunPlus Phoenix", "Wolves Esports", "Bilibili Gaming", 
    "JD Gaming", "Nova Esports", "Titan Esports Club", "Trace Esports", "Tyloo", "XLG Esports", "Dragon Ranger Gaming"
  ]
};


// This will be set when a team is selected
let welcomeMsg = '';

export function renderTeamRoster(providedSave = null) {
  const teamRosterContainer = document.getElementById('team-roster');
  if (!teamRosterContainer) return;
  teamRosterContainer.innerHTML = ''; // Clear existing content

  const activeSave = providedSave || loadCareer();
  if (!activeSave) {
    teamRosterContainer.innerHTML = '<div class="text-center text-gray-500 italic p-8 bg-white/5 rounded border border-white/10">Please start a career to manage your team.</div>';
    return;
  }

  // Attach global functions and event listeners
  setupEditFunctionality();

  const myTeam = activeSave.team;
  const myTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
  
  if (!activeSave.players || !Array.isArray(activeSave.players)) {
    teamRosterContainer.innerHTML = '<div class="text-center text-gray-500 italic p-8 bg-white/5 rounded border border-white/10">No players found in your save file.</div>';
    return;
  }

  // Use players from the active save
  const myTeamPlayers = activeSave.players.filter(p => {
    if (!p) return false;
    const normalize = (n) => String(n || '').toLowerCase().trim();
    const isInvalid = (v) => !v || v === 'null' || v === 'undefined';
    
    // Normalize comparison: check teamId (if present) OR team name
    const playerTeamId = p.teamId ? String(p.teamId) : null;
    const playerTeamNameNorm = normalize(p.team);

    const matchesId = !isInvalid(myTeamId) && !isInvalid(playerTeamId) && playerTeamId === myTeamId;
    const matchesName = !isInvalid(myTeam) && !isInvalid(playerTeamNameNorm) && playerTeamNameNorm === normalize(myTeam);
    const match = matchesId || matchesName;
    
    if (match) console.log("Found player for team:", p.name, "teamId:", p.teamId, "teamName:", p.team);
    return match;
  });
  
  console.log("renderTeamRoster: myTeamPlayers found:", myTeamPlayers.length);
  
  // Helper to get overall rating reliably from plain objects
  const getOverall = (p) => {
    if (p.overall) return Math.round(p.overall);
    if (p.rating) {
      const r = p.rating;
      const stats = [r.aim, r.movement, r.gameSense, r.clutch, r.aggression, r.utility, r.mental, r.teamwork, r.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      return Math.round(sum / 9);
    }
    return Math.round(p.skill || 0);
  };

  // Sort players by overall rating descending
  myTeamPlayers.sort((a, b) => {
    return getOverall(b) - getOverall(a);
  });
  
  if (myTeamPlayers.length === 0) {
    teamRosterContainer.innerHTML = '<div class="text-center text-gray-500 italic p-8 bg-white/5 rounded border border-white/10">No players found for your team. Hire some in the Players Hub!</div>';
    return;
  }

  // Split into main roster and substitutes
  // First, identify players who are explicitly marked as starters
  let mainRoster = myTeamPlayers.filter(p => p.isStarter === true);
  let otherPlayers = myTeamPlayers.filter(p => p.isStarter !== true);
  
  // Only auto-fill if NO starters are set at all (e.g. first time initialization)
  if (mainRoster.length === 0 && myTeamPlayers.length > 0) {
    console.log("No starters defined, auto-filling first 5 players...");
    // Take the top rated players up to 5
    const needed = Math.min(5, myTeamPlayers.length);
    for (let i = 0; i < needed; i++) {
      myTeamPlayers[i].isStarter = true;
    }
    
    // Refresh the lists
    mainRoster = myTeamPlayers.filter(p => p.isStarter === true);
    otherPlayers = myTeamPlayers.filter(p => p.isStarter !== true);
    
    // Save this default state
    saveCareer(activeSave);
  }
  
  const substitutes = otherPlayers;

  function renderPlayerCard(player, isSub = false) {
    const overall = getOverall(player);
    const potential = Math.round(player.potential || player.rating?.potential || 0);
    
    // Helper for rating colors
    const getRatingColorClass = (val) => {
        if (val >= 90) return 'text-val-red';
        if (val >= 80) return 'text-purple-400';
        if (val >= 70) return 'text-blue-400';
        if (val >= 60) return 'text-green-400';
        return 'text-gray-400';
    };

    const getBorderColorClass = (val) => {
        if (val >= 90) return 'border-val-red/50';
        if (val >= 80) return 'border-purple-500/30';
        if (val >= 70) return 'border-blue-500/30';
        if (val >= 60) return 'border-green-500/30';
        return 'border-white/10';
    };

    const playerCard = document.createElement('div');
    playerCard.className = `bg-val-dark-grey border ${getBorderColorClass(overall)} rounded-xl p-4 hover:border-val-red transition-all duration-300 relative group shadow-lg flex flex-col gap-4`;
    if (isSub) playerCard.classList.add('opacity-90');
    
    // Market value formatting
    const marketValue = player.marketValue ? `$${player.marketValue.toLocaleString()}` : 'N/A';
    
    playerCard.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-white text-lg font-valorant tracking-wide">${player.name}</h4>
            ${player.isIGL ? '<span class="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30" title="Team Leader (IGL)">★ IGL</span>' : ''}
            ${isSub ? '<span class="px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 text-xs font-bold border border-gray-500/30">SUB</span>' : ''}
          </div>
          <div class="w-full">
            <select class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:border-val-red focus:outline-none transition-colors cursor-pointer" onchange="changePlayerRole('${player.id}', this.value)">
              ${['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'].map(role => 
                `<option value="${role}" ${player.role === role ? 'selected' : ''}>${role}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center w-12 h-12 rounded bg-val-black border border-white/10 shadow-inner">
          <span class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">OVR</span>
          <span class="text-xl font-bold ${getRatingColorClass(overall)}">${overall}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs text-gray-400 bg-black/20 p-2 rounded border border-white/5">
        <div class="flex items-center gap-2">
          ${getFlagUrl(player.nationality) ? `<img src="${getFlagUrl(player.nationality)}" class="w-4 h-3 object-cover rounded-[1px]" alt="" onerror="this.style.display='none'">` : ''}
          <span class="truncate">${player.nationality || "Unknown"}</span>
        </div>
        <div class="text-right">
          <span>Age: <strong class="text-gray-300">${player.age || "N/A"}</strong></span>
        </div>
        <div class="col-span-2 border-t border-white/5 pt-1 mt-1 flex justify-between">
          <span>Salary:</span>
          <strong class="text-green-400">${marketValue}</strong>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Aim</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.aim || 0))}">${Math.round(player.rating?.aim || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Utility</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.utility || 0))}">${Math.round(player.rating?.utility || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Movement</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.movement || 0))}">${Math.round(player.rating?.movement || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Mental</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.mental || 0))}">${Math.round(player.rating?.mental || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Game Sense</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.gameSense || 0))}">${Math.round(player.rating?.gameSense || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Teamwork</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.teamwork || 0))}">${Math.round(player.rating?.teamwork || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Clutch</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.clutch || 0))}">${Math.round(player.rating?.clutch || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Consistency</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.consistency || 0))}">${Math.round(player.rating?.consistency || 0)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Aggression</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(player.rating?.aggression || 0))}">${Math.round(player.rating?.aggression || 0)}</span>
        </div>
        <div class="flex justify-between items-center pt-1 border-t border-white/5 mt-1 col-span-2">
          <span class="text-gray-400">Potential</span>
          <span class="font-mono font-bold ${getRatingColorClass(Math.round(potential))}">${Math.round(potential)}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-white/10">
        <button class="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded text-xs transition-colors border border-white/10 flex items-center justify-center gap-1" onclick="togglePlayerRosterStatus('${player.id}')">
          ${isSub ? 'Promote' : 'Bench'}
        </button>
        <button class="bg-white/5 hover:bg-white/10 ${player.isIGL ? 'text-yellow-400 border-yellow-500/30' : 'text-white border-white/10'} px-3 py-2 rounded text-xs transition-colors border flex items-center justify-center gap-1" onclick="changePlayerIGL('${player.id}')">
          ${player.isIGL ? 'IGL' : 'Set IGL'}
        </button>
        <button class="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded text-xs transition-colors border border-white/10 flex items-center justify-center gap-1" onclick="editPlayerAttributes('${player.id}')">
          Edit
        </button>
        <button class="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-3 py-2 rounded text-xs transition-colors border border-red-500/20 flex items-center justify-center gap-1" onclick="releasePlayer('${player.id}')">
          Release
        </button>
      </div>
    `;
    return playerCard;
  };

  // Create Main Roster section
  const mainRosterTitle = document.createElement('h3');
  mainRosterTitle.className = 'text-xl font-bold text-white mb-4 font-valorant tracking-wider border-b border-white/10 pb-2 mt-6 first:mt-0';
  mainRosterTitle.textContent = 'Main Roster';
  teamRosterContainer.appendChild(mainRosterTitle);

  const mainRosterContainer = document.createElement('div');
  mainRosterContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  mainRoster.forEach(player => mainRosterContainer.appendChild(renderPlayerCard(player, false)));
  teamRosterContainer.appendChild(mainRosterContainer);

  // Create Substitutes section if any exist
  if (substitutes.length > 0) {
    const subTitle = document.createElement('h3');
    subTitle.className = 'text-xl font-bold text-white mb-4 font-valorant tracking-wider border-b border-white/10 pb-2 mt-8';
    subTitle.textContent = 'Substitutes';
    teamRosterContainer.appendChild(subTitle);

    const subContainer = document.createElement('div');
    subContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75';
    substitutes.forEach(player => subContainer.appendChild(renderPlayerCard(player, true)));
    teamRosterContainer.appendChild(subContainer);
  }

  // Function to handle changing player role
  window.changePlayerRole = function(playerId, newRole) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    const player = activeSave.players.find(p => String(p.id) === String(playerId));
    if (!player || player.role === newRole) return;

    if (confirm(`Changing ${player.name}'s role from ${player.role} to ${newRole} will reduce their rating by 5 points. Continue?`)) {
      player.role = newRole;
      
      // Apply rating penalty
      const penalty = 5;
      if (player.rating) {
        player.rating.aim = Math.max(0, player.rating.aim - penalty);
        player.rating.gameSense = Math.max(0, player.rating.gameSense - penalty);
        player.rating.utility = Math.max(0, player.rating.utility - penalty);
        
        // Update skill for compatibility
        player.skill = Math.max(0, (player.skill || 0) - penalty);
      } else {
        player.skill = Math.max(0, (player.skill || 0) - penalty);
      }
      
      // CRITICAL: Update the player in the main save object
      const playerIndex = activeSave.players.findIndex(p => String(p.id) === String(playerId));
      if (playerIndex !== -1) {
          activeSave.players[playerIndex] = player;
      }
      
      saveCareer(activeSave);
      
      console.log(`Player ${player.name} role changed to ${newRole} with penalty.`);
      
      // Use the setActiveSave if it's available in the parent context
      // Since this is a global function, we might need to trigger a custom event
      // or rely on the next renderTeamRoster call to use loadCareer()
      renderTeamRoster(activeSave); 
      
      // Trigger a re-render of React components if needed
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
    } else {
      renderTeamRoster();
    }
  };

  // Function to toggle between starter and bench
  window.togglePlayerRosterStatus = function(playerId) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    // Use loose equality or convert both to string to ensure match
    const playerIndex = activeSave.players.findIndex(p => String(p.id) === String(playerId));
    if (playerIndex === -1) {
      console.error("Player not found in save:", playerId);
      return;
    }

    const player = activeSave.players[playerIndex];
    
    // Check team IDs carefully
    const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
    const playerTeamId = player.teamId ? String(player.teamId) : null;

    const currentStarters = activeSave.players.filter(p => {
      const pTeamId = p.teamId ? String(p.teamId) : null;
      return pTeamId === activeTeamId && p.isStarter === true;
    });

    if (!player.isStarter && currentStarters.length >= 5) {
      alert("You already have 5 players in the active roster. Move someone to the bench first!");
      return;
    }

    // Toggle status
    player.isStarter = !player.isStarter;
    // Sync status with isStarter to ensure compatibility with other systems
    player.status = player.isStarter ? 'active' : 'bench';
    
    // Update the array
    activeSave.players[playerIndex] = player;
    
    saveCareer(activeSave);
    console.log(`${player.name} is now a ${player.isStarter ? 'Starter' : 'Substitute'}.`);
    
    renderTeamRoster(activeSave);
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
  };

  // Function to handle swapping players
  window.showSwapMenu = function(playerId) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    const playerToSwap = activeSave.players.find(p => String(p.id) === String(playerId));
    if (!playerToSwap) return;

    // Filter potential swap targets: Free Agents or players from Other Teams
    const otherPlayers = activeSave.players.filter(p => {
        if (String(p.id) === String(playerId)) return false;
        
        const normalize = (n) => String(n || '').toLowerCase().trim();
        const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
        const activeTeamNameNorm = normalize(activeSave.team);
        
        const playerTeamId = p.teamId ? String(p.teamId) : null;
        const playerTeamNameNorm = normalize(p.team);

        const isMyTeam = (activeTeamId && playerTeamId && playerTeamId === activeTeamId) || 
                         (activeTeamNameNorm && playerTeamNameNorm && playerTeamNameNorm === activeTeamNameNorm);
        
        return !isMyTeam;
    });

    if (otherPlayers.length === 0) {
        alert("No other players available to swap with.");
        return;
    }

    // Create a simple swap modal or use a prompt (using prompt for simplicity in this implementation)
    let menuText = `Swap ${playerToSwap.name} with:\n\n`;
    otherPlayers.slice(0, 15).forEach((p, idx) => {
        const teamInfo = p.team ? `(${p.team})` : "(Free Agent)";
        menuText += `${idx + 1}. ${p.name} - OVR ${getOverall(p)} ${teamInfo}\n`;
    });
    menuText += "\nEnter the number of the player to swap with:";

    const choice = prompt(menuText);
    if (choice === null) return;

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= otherPlayers.slice(0, 15).length) {
        alert("Invalid choice.");
        return;
    }

    const targetPlayer = otherPlayers[idx];
    
    // Perform the swap
    const playerToSwapIdx = activeSave.players.findIndex(p => String(p.id) === String(playerToSwap.id));
    const targetPlayerIdx = activeSave.players.findIndex(p => String(p.id) === String(targetPlayer.id));

    if (playerToSwapIdx !== -1 && targetPlayerIdx !== -1) {
        // Swap team info
        const tempTeamId = activeSave.players[playerToSwapIdx].teamId;
        const tempTeamName = activeSave.players[playerToSwapIdx].team;
        const tempStatus = activeSave.players[playerToSwapIdx].status;

        activeSave.players[playerToSwapIdx].teamId = activeSave.players[targetPlayerIdx].teamId;
        activeSave.players[playerToSwapIdx].team = activeSave.players[targetPlayerIdx].team;
        activeSave.players[playerToSwapIdx].status = "free_agent";

        activeSave.players[targetPlayerIdx].teamId = tempTeamId;
        activeSave.players[targetPlayerIdx].team = tempTeamName;
        activeSave.players[targetPlayerIdx].status = tempStatus;

        saveCareer(activeSave);
        console.log(`Swapped ${playerToSwap.name} with ${targetPlayer.name}`);
        
        renderTeamRoster(activeSave);
        window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
        alert(`Successfully swapped ${playerToSwap.name} with ${targetPlayer.name}!`);
    }
  };

  // Function to handle releasing a player
  window.releasePlayer = function(playerId) {
    if (confirm('Are you sure you want to release this player? They will become a free agent.')) {
      const activeSave = loadCareer();
      if (activeSave) {
        const playerIndex = activeSave.players.findIndex(p => String(p.id) === String(playerId));
        if (playerIndex !== -1) {
          activeSave.players[playerIndex].teamId = null;
          activeSave.players[playerIndex].team = null;
          activeSave.players[playerIndex].isIGL = false;
          activeSave.players[playerIndex].status = "free_agent";
          
          saveCareer(activeSave); // Save the updated career data
          console.log(`Player released to free agency.`);
          
          renderTeamRoster(activeSave);
          window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
        }
      }
    }
  };

  // Function to handle changing IGL
  window.changePlayerIGL = function(playerId) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    const player = activeSave.players.find(p => String(p.id) === String(playerId));
    if (!player) return;

    // Set this player as IGL and remove IGL from others on the same team
    activeSave.players.forEach(p => {
      if (String(p.teamId) === String(activeSave.teamId)) {
        p.isIGL = (String(p.id) === String(playerId));
      }
    });

    saveCareer(activeSave);
    console.log(`${player.name} set as Team Leader (IGL).`);
    
    renderTeamRoster(activeSave);
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
  };

function setupEditFunctionality() {
  // Function to handle editing player attributes
  window.editPlayerAttributes = function(playerId) {
    // Dispatch event for React component to handle data loading and form display
    window.dispatchEvent(new CustomEvent('open-player-edit-modal', { 
      detail: { playerId } 
    }));
  };
}

  // teamRosterContainer.appendChild(playerCardsContainer); // This seems to be old/commented out or redundant
};






function updateTeamLogo(team) {
  const logoContainer = document.getElementById('teamLogoContainer');
  logoContainer.innerHTML = ''; // Clear existing content

  const teamLogoPath = teamLogos[team];
  if (teamLogoPath) {
    const img = document.createElement('img');
    img.src = teamLogoPath;
    img.alt = `${team} Logo`;
    img.classList.add('team-logo');
    logoContainer.appendChild(img);
  } else {
    // Fallback to initials if no logo is found
    const initials = team.split(' ').map(n => n[0]).join('');
    const placeholder = document.createElement('div');
    placeholder.classList.add('team-logo-placeholder');
    placeholder.textContent = initials;
    logoContainer.appendChild(placeholder);
  }

  const teamNameDisplay = document.createElement('div');
  teamNameDisplay.classList.add('team-name-display');
  teamNameDisplay.textContent = team;
  logoContainer.appendChild(teamNameDisplay);

  // Set background color based on teamColors
  const color = teamColors[team];
  if (color) {
    logoContainer.style.backgroundColor = color;
  } else {
    logoContainer.style.backgroundColor = '#333'; // Default fallback color
  }
}

function updateSeasonInfo(save) {
  const seasonInfo = document.getElementById('seasonInfo');
  if (seasonInfo) {
    seasonInfo.querySelector('div').textContent = `Week ${save.week || 1} / Kickoff / Season ${save.season || 1}`;
  }
}

async function fetchSaveData(method, data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (method === 'POST' && data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch('save.php', options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function startCareer(saveName) {
    const save = createNewSave(saveName);
    try {
        const result = await fetchSaveData('POST', { action: 'save', saveName: saveName, gameData: save });
        if (result.success) {
            console.log('Save created successfully:', result.message);
            localStorage.setItem('activeSaveId', result.id);
            window.location.href = 'career.html';
        } else {
            console.error('Error creating save:', result.message);
            alert('Error creating save: ' + result.message);
        }
    } catch (error) {
        console.error('Network error or server issue:', error);
        alert('Failed to create save. Please check your connection and server setup.');
    }
}



async function renderSaves() {
    const saveList = document.getElementById('save-list');
    if (!saveList) return;

    saveList.innerHTML = '';
    try {
        const result = await fetchSaveData('GET', { action: 'list' });
        if (result.success && result.saves) {
            result.saves.forEach(save => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${save.save_name}</span>
                    <button onclick="loadSave(${save.id})">Load</button>
                    <button onclick="deleteSave(${save.id})">Delete</button>
                `;
                saveList.appendChild(li);
            });
        } else {
            saveList.innerHTML = '<li>No saves found.</li>';
        }
    } catch (error) {
        console.error('Error rendering saves:', error);
        saveList.innerHTML = '<li>Error loading saves.</li>';
    }
}

async function loadSave(id) {
    try {
        const result = await fetchSaveData('GET', { action: 'load', id: id });
        if (result.success && result.save) {
            localStorage.setItem('activeSaveId', id);
            window.location.href = 'career.html';
        } else {
            alert('Error loading save: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading save:', error);
        alert('Failed to load save. Please check your connection and server setup.');
    }
}

async function deleteSave(id) {
    if (!confirm('Are you sure you want to delete this save?')) {
        return;
    }
    try {
        const result = await fetchSaveData('DELETE', { action: 'delete', id: id });
        if (result.success) {
            console.log('Save deleted successfully:', result.message);
            renderSaves(); // Re-render the list after deletion
        } else {
            alert('Error deleting save: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting save:', error);
        alert('Failed to delete save. Please check your connection and server setup.');
    }
}

function loadDashboard(save) {
  console.log('Loading dashboard with save:', save);
  // Mark this save as active for other modules (e.g., standings)
  try {
    localStorage.setItem('activeSaveId', String(save.id));
  } catch (e) {}
  
  // Update team logo and season info
  // updateTeamLogo(save.team);
  updateSeasonInfo(save);
  
  initializeGameData(); // Initialize game data when loading a game
  toggleCareerNavigation(true);

  // Hide Career menu item and show only game-related menu items
  const careerMenuItem = document.getElementById('career-menu-item');
  if (careerMenuItem) {
    careerMenuItem.style.display = 'none';
  }
  document.querySelectorAll('.game-menu-item').forEach(item => {
    item.style.display = 'block';
  });

  // Update career info
  // const careerInfo = document.getElementById('careerInfo');
  // careerInfo.innerHTML = `
  //   <div class="manager-info">
  //     <span class="manager-name">${save.manager}</span>
  //     <span class="team-record">${save.stats.wins}W - ${save.stats.losses}L</span>
  //   </div>
  // `;
  
  // Update inbox
  // const inboxList = document.querySelector('.inbox-list');
  // if (inboxList) {
  //   inboxList.innerHTML = '';
  //   
  //   if (save.inbox && save.inbox.length) {
  //     save.inbox.forEach((message, index) => {
  //       const item = document.createElement('div');
  //       item.className = 'inbox-item' + (index === 0 ? ' active' : '');
  //       
  //       // Extract title and preview from message
  //       let title = 'New Message';
  //       let preview = message.substring(0, 50);
  //       
  //       // Try to parse the first line as title
  //       const lines = message.split('\n');
  //       if (lines.length > 1) {
  //         title = lines[0];
  //         preview = lines[1].substring(0, 50) + (lines[1].length > 50 ? '...' : '');
  //       }
  //       
  //       item.innerHTML = `
  //         <div class="inbox-title">${title}</div>
  //         <div class="inbox-preview">${preview}</div>
  //       `;
  //       
  //       // Add click handler to show message content
  //       item.addEventListener('click', () => {
  //         // Update active class
  //         document.querySelectorAll('.inbox-item').forEach(el => el.classList.remove('active'));
  //         item.classList.add('active');
  //         
  //         // Update email content
  //         const emailContent = document.getElementById('email-content');
  //         if (emailContent) {
  //           emailContent.innerHTML = `
  //             <h3>${title}</h3>
  //             <div class="email-body">
  //               ${message.split('\n').slice(1).join('<br>')}
  //             </div>
  //           `;
  //         }
  //       });
  //       
  //       inboxList.appendChild(item);
  //     });
  //     
  //     // Set the first email as active and show its content
  //     const firstEmail = save.inbox[0];
  //     if (firstEmail) {
  //       const lines = firstEmail.split('\n');
  //       const title = lines[0] || 'New Message';
  //       const content = lines.slice(1).join('<br>');
  //       
  //       const emailContent = document.getElementById('email-content');
  //       if (emailContent) {
  //         emailContent.innerHTML = `
  //           <h3>${title}</h3>
  //           <div class="email-body">
  //             ${content}
  //           </div>
  //         `;
  //       }
  //     }
  //   } else {
  //     inboxList.innerHTML = '<div class="inbox-item"><div class="inbox-title">No messages</div></div>';
  //   }
  // }
  
  // Standings (fake data for now)
  const standingsList = document.getElementById("standingsList");
  if (standingsList) {
    standingsList.innerHTML = "";
    vctTeams.slice(0, 8).forEach((team, i) => {
      const li = document.createElement("li");
      li.textContent = `${i+1}. ${team}`;
      standingsList.appendChild(li);
    });
  }

  // Matches (fake)
  const matchesList = document.getElementById("matchesList");
  if (matchesList) {
    matchesList.innerHTML = "<li>Week 1: vs Cloud9</li><li>Week 2: vs Fnatic</li>";
  }

  // Career History
  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.innerHTML = "";
    if (save.history.length === 0) {
      historyList.innerHTML = "<li>No history yet</li>";
    } else {
      save.history.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        historyList.appendChild(li);
      });
    }
  }
  
  // showSection('career-dashboard');
  // document.querySelector('[data-section="career-dashboard"]').classList.add('active');
}

function handleSimWeekClick() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }

  // Simulate a delay for the loading screen (e.g., 1 second)
    setTimeout(() => {
      simulateNextWeek();
      renderOffseason();
      renderStandings();
      renderBracket();
      const activeSave = loadCareer();
      const activeSaveId = localStorage.getItem('activeSaveId');
      const playerTeamData = teams.find(t => String(t.id) === String(activeSave.teamId));
      const playerRegion = playerTeamData ? playerTeamData.region : "Americas";
      const st = getKickoffState(playerRegion, activeSaveId);
      renderKickoff(st);

      // Hide loading screen
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
      }
    }, 1000); // 1 second delay
}

function showLoadGame() {
  const elements = ['career-start', 'load-game', 'new-game'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'load-game') el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}

function showNewGame() {
  const elements = ['career-start', 'load-game', 'new-game'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'new-game') el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
  populateTeamPicker();
}

function backToMenu() {
  const elements = ['career-start', 'load-game', 'new-game'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'career-start') el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}

function toggleCareerNavigation(enable) {
  const navItems = document.querySelectorAll('#main-nav .nav-item');
  navItems.forEach(item => {
    if (item.id === 'kickoffNav') {
      item.style.display = 'none'; // Hide kickoff initially
    } else {
      if (enable) {
        item.classList.remove('disabled');
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
      } else {
        item.classList.add('disabled');
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.5';
      }
    }
  });
}

// Initial render when the page loads

// window.showSection = function(sectionId) {
//   document.querySelectorAll('.content-section').forEach(section => {
//     section.classList.remove('active');
//     section.classList.add('hidden'); // Add hidden class to all sections
//   });
//   const activeSection = document.getElementById(sectionId);
//   activeSection.classList.add('active');
//   activeSection.classList.remove('hidden'); // Remove hidden class from the active section

//   document.querySelectorAll('#main-nav .nav-item').forEach(item => {
//     item.classList.remove('active');
//   });
//   document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
// };

window.exportSaveToJsonCareer = function() {
  const activeSave = getActiveSave();
  if (activeSave) {
    const filename = `valorant_sim_save_${activeSave.manager}.json`;
    const dataStr = JSON.stringify(activeSave, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Save exported successfully!');
  } else {
    alert('No active save to export.');
  }
};

window.renderStandings = function() {
  console.log('renderStandings called');
  // Placeholder for actual standings rendering logic
  // This function will be properly implemented once the structure of standings data is clear.
};

/*
document.addEventListener('DOMContentLoaded', async () => {
    const activeSave = await loadCareer();
    const currentPage = window.location.pathname.split('/').pop();

    if (activeSave) {
        loadDashboard(activeSave);
    } else {
        // Only redirect to career_entry.html if not already on it
        if (currentPage !== 'career_entry.html') {
            window.location.href = 'career_entry.html';
        }
    }
});
*/







