import { teams, teamLogos } from './teams.js';
import { loadCareer, saveCareer, getKickoffState } from './career_local_storage.jsx';
import { renderKickoff } from './kickoff.jsx';
import { initializeGameData } from './game_data.js';
import { getTeamsWithPlayers } from './players.js';

const teamColors = {
  "100 Thieves": "#E4002B",
  "Cloud9": "#009FE3",
  "Evil Geniuses": "#0F1F3A",
  "FURIA": "#FF0000",
  "KRÜ Esports": "#00C2FF",
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
    "Leviatán", "LOUD", "MIBR", "NRG", "Sentinels", "G2 Esports", "2GAME Esports"
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
    teamRosterContainer.innerHTML = '<div class="roster-placeholder">Please start a career to manage your team.</div>';
    return;
  }

  const myTeam = activeSave.team;
  const myTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
  
  console.log("renderTeamRoster: myTeamId:", myTeamId, "myTeam:", myTeam);
  console.log("renderTeamRoster: total players in save:", activeSave.players?.length || 0);
  
  if (activeSave.players && activeSave.players.length > 0) {
    const firstPlayer = activeSave.players[0];
    console.log("DEBUG: First player in save:", {
      name: firstPlayer.name,
      teamId: firstPlayer.teamId,
      team: firstPlayer.team,
      teamIdType: typeof firstPlayer.teamId
    });
    
    // Check if ANY player has the user's teamId
    const anyTeamMatch = activeSave.players.some(p => String(p.teamId) === String(myTeamId));
    const anyNameMatch = activeSave.players.some(p => String(p.team) === String(myTeam));
    console.log("DEBUG: anyTeamMatch:", anyTeamMatch, "anyNameMatch:", anyNameMatch);
  }

  if (!activeSave.players || !Array.isArray(activeSave.players)) {
    teamRosterContainer.innerHTML = '<div class="roster-placeholder">No players found in your save file.</div>';
    return;
  }

  // Use players from the active save
  const myTeamPlayers = activeSave.players.filter(p => {
    const normalize = (n) => String(n || '').toLowerCase().trim();
    
    // Normalize comparison: check teamId (if present) OR team name
    const playerTeamId = p.teamId ? String(p.teamId) : null;
    const playerTeamNameNorm = normalize(p.team);

    const matchesId = myTeamId && playerTeamId && playerTeamId === myTeamId;
    const matchesName = myTeam && playerTeamNameNorm && playerTeamNameNorm === normalize(myTeam);
    const match = matchesId || matchesName;
    
    if (match) console.log("Found player for team:", p.name, "teamId:", p.teamId, "teamName:", p.team);
    return match;
  });
  
  console.log("renderTeamRoster: myTeamPlayers found:", myTeamPlayers.length);
  
  // Helper to get overall rating reliably from plain objects
  const getOverall = (p) => {
    if (p.overall) return Math.round(p.overall * 10) / 10;
    if (p.rating) {
      const r = p.rating;
      const stats = [r.aim, r.movement, r.gameSense, r.clutch, r.aggression, r.utility, r.mental, r.teamwork, r.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      return Math.round((sum / 9) * 10) / 10;
    }
    return p.skill || 0;
  };

  // Sort players by overall rating descending
  myTeamPlayers.sort((a, b) => {
    return getOverall(b) - getOverall(a);
  });
  
  if (myTeamPlayers.length === 0) {
    teamRosterContainer.innerHTML = '<div class="roster-placeholder">No players found for your team. Hire some in the Players Hub!</div>';
    return;
  }

  // Split into main roster and substitutes
  // Main roster: top 5 by overall
  // Substitutes: everyone else
  const mainRoster = myTeamPlayers.slice(0, 5);
  const substitutes = myTeamPlayers.slice(5);

  function renderPlayerCard(player, isSub = false) {
    const overall = getOverall(player);
    const potential = Math.round((player.potential || player.rating?.potential || 0) * 10) / 10;
    
    // Helper for rating colors
    const getRatingClass = (val) => {
        if (val >= 85) return 'rating-elite';
        if (val >= 75) return 'rating-good';
        if (val >= 65) return 'rating-average';
        return 'rating-poor';
    };

    const playerCard = document.createElement('div');
    playerCard.className = `player-card ${isSub ? 'substitute-card' : ''} ${getRatingClass(overall)}`;
    
    // Market value formatting
    const marketValue = player.marketValue ? `$${player.marketValue.toLocaleString()}` : 'N/A';
    
    playerCard.innerHTML = `
      <div class="player-card-inner">
        <div class="player-card-header">
          <div class="player-main-info">
            <div class="player-name-row">
              <h4>${player.name}</h4>
              ${isSub ? '<span class="sub-tag">SUB</span>' : ''}
            </div>
            <div class="role-selector-container">
              <select class="player-role-select" onchange="changePlayerRole('${player.id}', this.value)">
                ${['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'].map(role => 
                  `<option value="${role}" ${player.role === role ? 'selected' : ''}>${role}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="player-overall-container ${getRatingClass(overall)}">
            <span class="overall-label">OVR</span>
            <span class="overall-value">${overall}</span>
          </div>
        </div>

        <div class="player-meta-info">
          <span class="meta-item"><i class="flag-icon"></i> ${player.nationality || "Unknown"}</span>
          <span class="meta-item">Age: ${player.age || "N/A"}</span>
          <span class="meta-item value">Salary: ${marketValue}</span>
        </div>

        <div class="player-stats-detailed">
          <div class="stats-column">
            <div class="stat-row">
              <span class="stat-name">Aim</span>
              <span class="stat-val ${getRatingClass(player.rating?.aim || 0)}">${player.rating?.aim || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Movement</span>
              <span class="stat-val ${getRatingClass(player.rating?.movement || 0)}">${player.rating?.movement || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Game Sense</span>
              <span class="stat-val ${getRatingClass(player.rating?.gameSense || 0)}">${player.rating?.gameSense || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Clutch</span>
              <span class="stat-val ${getRatingClass(player.rating?.clutch || 0)}">${player.rating?.clutch || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Aggression</span>
              <span class="stat-val ${getRatingClass(player.rating?.aggression || 0)}">${player.rating?.aggression || 0}</span>
            </div>
          </div>
          <div class="stats-column">
            <div class="stat-row">
              <span class="stat-name">Utility</span>
              <span class="stat-val ${getRatingClass(player.rating?.utility || 0)}">${player.rating?.utility || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Mental</span>
              <span class="stat-val ${getRatingClass(player.rating?.mental || 0)}">${player.rating?.mental || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Teamwork</span>
              <span class="stat-val ${getRatingClass(player.rating?.teamwork || 0)}">${player.rating?.teamwork || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">Consistency</span>
              <span class="stat-val ${getRatingClass(player.rating?.consistency || 0)}">${player.rating?.consistency || 0}</span>
            </div>
            <div class="stat-row potential-row">
              <span class="stat-name">Potential</span>
              <span class="stat-val ${getRatingClass(potential)}">${potential}</span>
            </div>
          </div>
        </div>

        <div class="player-actions">
          <button class="btn-release" onclick="releasePlayer('${player.id}')">Release Player</button>
          <button class="btn-edit" onclick="editPlayerAttributes('${player.id}')">Edit</button>
        </div>
      </div>
    `;
    return playerCard;
  };

  // Create Main Roster section
  const mainRosterTitle = document.createElement('h3');
  mainRosterTitle.className = 'roster-section-title';
  mainRosterTitle.textContent = 'Main Roster';
  teamRosterContainer.appendChild(mainRosterTitle);

  const mainRosterContainer = document.createElement('div');
  mainRosterContainer.className = 'player-cards-container';
  mainRoster.forEach(player => mainRosterContainer.appendChild(renderPlayerCard(player, false)));
  teamRosterContainer.appendChild(mainRosterContainer);

  // Create Substitutes section if any exist
  if (substitutes.length > 0) {
    const subTitle = document.createElement('h3');
    subTitle.className = 'roster-section-title';
    subTitle.style.marginTop = '30px';
    subTitle.textContent = 'Substitutes';
    teamRosterContainer.appendChild(subTitle);

    const subContainer = document.createElement('div');
    subContainer.className = 'player-cards-container substitutes-container';
    substitutes.forEach(player => subContainer.appendChild(renderPlayerCard(player, true)));
    teamRosterContainer.appendChild(subContainer);
  }

  // Function to handle changing player role
  window.changePlayerRole = function(playerId, newRole) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    const player = activeSave.players.find(p => p.id === playerId);
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
        
        // Recalculate overall
        const stats = [player.rating.aim, player.rating.movement, player.rating.gameSense, player.rating.clutch, player.rating.aggression, player.rating.utility, player.rating.mental, player.rating.teamwork, player.rating.consistency];
        const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
        player.overall = Math.round((sum / 9) * 10) / 10;
      } else {
        player.skill = Math.max(0, (player.skill || 0) - penalty);
        player.overall = player.skill;
      }
      
      saveCareer(activeSave);
      
      console.log(`Player ${player.name} role changed to ${newRole} with penalty.`);
      renderTeamRoster(); // Re-render to show updated ratings
    } else {
      // Re-render to reset the select value if cancelled
      renderTeamRoster();
    }
  };

  // Function to handle releasing a player
  window.releasePlayer = function(playerId) {
    if (confirm('Are you sure you want to release this player? They will become a free agent.')) {
      const activeSave = loadCareer();
      if (activeSave) {
        const player = activeSave.players.find(p => p.id === playerId);
        if (player) {
          player.teamId = null;
          player.team = null;
          saveCareer(activeSave); // Save the updated career data
          console.log(`Player ${player.name} released to free agency.`);
          renderTeamRoster(); // Re-render to update the view
        }
      }
    }
  };

  // Function to handle editing player attributes
  window.editPlayerAttributes = function(playerId) {
    const activeSave = loadCareer();
    if (!activeSave) return;

    const playerToEdit = activeSave.players.find(player => player.id === playerId);
    if (!playerToEdit) return;

    // Populate the modal with player data
    const elements = {
      'edit-player-id': playerToEdit.id,
      'edit-player-name': playerToEdit.name,
      'edit-player-gamertag': playerToEdit.gamertag,
      'edit-player-role': playerToEdit.role,
      'edit-player-nationality': playerToEdit.nationality,
      'edit-player-age': playerToEdit.age
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
    
    // Populate individual ratings
    const ratings = playerToEdit.rating || {
      aim: playerToEdit.skill || 50,
      movement: playerToEdit.skill || 50,
      gameSense: playerToEdit.skill || 50,
      clutch: playerToEdit.skill || 50,
      aggression: playerToEdit.skill || 50,
      utility: playerToEdit.skill || 50,
      mental: playerToEdit.skill || 50,
      teamwork: playerToEdit.skill || 50,
      consistency: playerToEdit.skill || 50,
      potential: playerToEdit.potential || 70
    };

    const ratingFields = [
      'aim', 'movement', 'gamesense', 'clutch', 'aggression', 
      'utility', 'mental', 'teamwork', 'consistency', 'potential'
    ];

    ratingFields.forEach(field => {
      const ratingKey = field === 'gamesense' ? 'gameSense' : field;
      const val = ratings[ratingKey] || 50;
      const inputEl = document.getElementById(`edit-player-${field}`);
      const valEl = document.getElementById(`edit-player-${field}-value`);
      
      if (inputEl) inputEl.value = val;
      if (valEl) valEl.textContent = Math.round(val);
    });

    // Display the modal
    const modal = document.getElementById('player-edit-modal');
    if (modal) modal.style.display = 'block';
  };

  // Event listener for rating range inputs to update their values
  document.addEventListener('input', function (event) {
    if (event.target.id && event.target.id.startsWith('edit-player-')) {
      const valEl = document.getElementById(`${event.target.id}-value`);
      if (valEl) valEl.textContent = event.target.value;
    }
  });

  // Event listener for closing the modal
  const closeButton = document.querySelector('#player-edit-modal .close-button');
  if (closeButton) {
    closeButton.onclick = function() {
      const modal = document.getElementById('player-edit-modal');
      if (modal) modal.style.display = 'none';
    };
  }

  // Event listener for saving player attribute changes
  const playerEditForm = document.getElementById('player-edit-form');
  if (playerEditForm) {
    playerEditForm.onsubmit = function (event) {
      event.preventDefault();

      const idEl = document.getElementById('edit-player-id');
      if (!idEl) return;
      const playerId = idEl.value;
      
      const activeSave = loadCareer();
      if (!activeSave) return;

      const playerIndex = activeSave.players.findIndex(player => player.id === playerId);
      if (playerIndex === -1) return;

      // Update player attributes from the form
      const player = activeSave.players[playerIndex];
      
      const gamertagEl = document.getElementById('edit-player-gamertag');
      if (gamertagEl) {
        player.gamertag = gamertagEl.value;
        player.name = gamertagEl.value; // Keep name in sync
      }
      
      const roleEl = document.getElementById('edit-player-role');
      if (roleEl) player.role = roleEl.value;
      
      const natEl = document.getElementById('edit-player-nationality');
      if (natEl && natEl.value.trim() !== "") {
          player.nationality = natEl.value.trim();
      }
      
      const ageEl = document.getElementById('edit-player-age');
      if (ageEl) player.age = parseInt(ageEl.value);
      
      // Update individual ratings
      if (!player.rating) {
        player.rating = {};
      }

      const ratingFields = [
        'aim', 'movement', 'gamesense', 'clutch', 'aggression', 
        'utility', 'mental', 'teamwork', 'consistency', 'potential'
      ];

      ratingFields.forEach(field => {
        const inputEl = document.getElementById(`edit-player-${field}`);
        if (inputEl) {
          const ratingKey = field === 'gamesense' ? 'gameSense' : field;
          player.rating[ratingKey] = parseInt(inputEl.value);
        }
      });

      // Update skill/potential for legacy compatibility
      player.skill = player.rating.aim; // Use aim as representative skill
      player.potential = player.rating.potential;
      
      // Re-calculate overall
      const stats = [player.rating.aim, player.rating.movement, player.rating.gameSense, player.rating.clutch, player.rating.aggression, player.rating.utility, player.rating.mental, player.rating.teamwork, player.rating.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      player.overall = Math.round((sum / 9) * 10) / 10;

      saveCareer(activeSave);

      // Close the modal and refresh the UI
      const modal = document.getElementById('player-edit-modal');
      if (modal) modal.style.display = 'none';
      
      if (typeof renderTeamRoster === 'function') {
        renderTeamRoster(); // Re-render the roster to reflect the change
      }
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
      const activeSaveId = localStorage.getItem('activeSaveId');
      const st = getKickoffState(activeSaveId);
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







