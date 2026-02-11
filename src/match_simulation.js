let score1Element, score2Element, team1LogoElement, team1NameElement, team2LogoElement, team2NameElement, nextRoundButton, returnToBracketButton, matchWinnerElement;
let autoPlayButton, simSpeedSelect, resetMatchButton;
let currentMapNameSpan, currentMapStatusElement, mapImageElement;
let mapPoolElement, banMapTeam1Button, banMapTeam2Button, pickMapTeam1Button, pickMapTeam2Button, mapSelectionContainer;
let currentMapDisplay, team1ActivePlayersElement, team2ActivePlayersElement;
let team1OverlayElement, team2OverlayElement, team1InfoElement, team2InfoElement;
let team1GunPoolElement, team2GunPoolElement, matchLogsElement, simulationUI;

let isAutoPlaying = false;

let team1Roster = [];
let team2Roster = [];
let team1ActivePlayers = [];
let team2ActivePlayers = [];
let team1GunPool = [];
let team2GunPool = [];

let team1Score = 0;
let team2Score = 0;
let team1MapWins = 0;
let team2MapWins = 0;
let bestOf = 0;
let matchId = '';
let team1 = {};
let team2 = {};
let currentRound = 0;
let totalRounds = 0;
let currentMap = '';
let currentMapIndex = 0;
let mapPool = [
    'Abyss',
    'Ascent',
    'Bind',
    'Haven',
    'Pearl',
    'Split',
    'Sunset',
];
let bannedMaps = [];
let pickedMaps = [];
let mapResults = []; // Store stats per map
let firstPickTeam = '';
let team1Bans = 0;
let team2Bans = 0;
let team1Picks = 0;
let team2Picks = 0;
let currentBanPickPhase = 'ban1'; // Start with Team 1 banning
let playerTeamName = 'TBD';
let teamStrategies = {}; // Store strategy for each team
let isAiMoving = false; // Flag to prevent multiple AI moves
let isMapIntermission = false; // Flag for break between maps

const normalizeName = (n) => {
    if (!n) return '';
    return String(n).toLowerCase().trim().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
};

import { teams } from './teams.js';
import { getTeamsWithPlayers } from './players.js';
import { Player, Team, RoundSimulator, PlayerRating } from './simulation.js';
import { loadCareer, saveCareer, getSafeTeamByName, getKickoffState, saveKickoffState } from './career_local_storage.jsx';

export function displayMatchDetails() {
    const params = new URLSearchParams(window.location.search);
    matchId = params.get('matchId') || params.get('id');
    const team1Name = params.get('team1');
    const team2Name = params.get('team2');
    const urlPlayerTeam = params.get('playerTeam'); // Get player team from URL if provided
    bestOf = parseInt(params.get('bestOf')) || 3;
    
    const activeSave = loadCareer();
    // Prioritize URL parameter, then career save, then fallback to 'TBD'
    playerTeamName = urlPlayerTeam || (activeSave ? activeSave.team : 'TBD');
    
    // Load strategies if this is a player team
    if (activeSave?.strategies) {
        if (team1Name === activeSave.team) teamStrategies[t1Data.id] = activeSave.strategies;
        if (team2Name === activeSave.team) teamStrategies[t2Data.id] = activeSave.strategies;
    }

    console.log(`Match Simulation initialized: MatchID=${matchId}, PlayerTeam=${playerTeamName}, Team1=${team1Name}, Team2=${team2Name}`);

    const t1Data = getSafeTeamByName(team1Name);
    const t2Data = getSafeTeamByName(team2Name);

    console.log(`t1Data for ${team1Name}:`, t1Data);
    console.log(`t2Data for ${team2Name}:`, t2Data);

    if (!t1Data || !t1Data.players) {
        console.error(`CRITICAL: t1Data or players missing for ${team1Name}!`);
    } else {
        console.log(`t1Data has ${t1Data.players.length} players`);
    }

    if (!t2Data || !t2Data.players) {
        console.error(`CRITICAL: t2Data or players missing for ${team2Name}!`);
    } else {
        console.log(`t2Data has ${t2Data.players.length} players`);
    }

    // Convert to Team and Player instances
    team1 = new Team(t1Data.name, t1Data.id);
    team1.logo = t1Data.logo;
    if (t1Data.players && t1Data.players.length > 0) {
        console.log(`Adding ${t1Data.players.length} players to Team 1 object`);
        t1Data.players.forEach(p => {
            const player = (p instanceof Player) ? p : Player.fromJSON(p);
            team1.addPlayer(player);
        });
    } else {
        console.error(`No players found in t1Data for ${team1Name}. t1Data keys:`, Object.keys(t1Data));
    }

    team2 = new Team(t2Data.name, t2Data.id);
    team2.logo = t2Data.logo;
    if (t2Data.players && t2Data.players.length > 0) {
        console.log(`Adding ${t2Data.players.length} players to Team 2 object`);
        t2Data.players.forEach(p => {
            const player = (p instanceof Player) ? p : Player.fromJSON(p);
            team2.addPlayer(player);
        });
    } else {
        console.error(`No players found in t2Data for ${team2Name}. t2Data keys:`, Object.keys(t2Data));
    }

    team1LogoElement.src = team1.logo;
    team1NameElement.textContent = team1.name;
    team2LogoElement.src = team2.logo;
    team2NameElement.textContent = team2.name;

    // Update roster header displays
    const t1Header = document.getElementById('t1-name-display');
    const t2Header = document.getElementById('t2-name-display');
    if (t1Header) t1Header.textContent = team1.name;
    if (t2Header) t2Header.textContent = team2.name;

    const bestOfDisplay = document.getElementById('best-of-display');
    if (bestOfDisplay) bestOfDisplay.textContent = `BO${bestOf}`;

    // Initialize player rosters
    team1Roster = team1.players;
    team2Roster = team2.players;
    
    console.log(`Rosters initialized: Team 1 (${team1Roster.length} players), Team 2 (${team2Roster.length} players)`);
    if (team1Roster.length > 0) console.log(`Sample player from T1:`, team1Roster[0].name, "TeamID:", team1Roster[0].teamId);
    if (team2Roster.length > 0) console.log(`Sample player from T2:`, team2Roster[0].name, "TeamID:", team2Roster[0].teamId);

    loadMatchState(); // Load saved state
    
    // Determine first pick BEFORE first updateMapStatus if not already loaded
    if (!firstPickTeam) {
        determineFirstPick();
    }
    
    renderMapPool();

    // Automatically select the first 5 players if none are selected (and not loaded from state)
    console.log(`Checking active players before auto-selection: Team 1 (${team1ActivePlayers.length}), Team 2 (${team2ActivePlayers.length})`);
    
    if (team1ActivePlayers.length < 5 && team1Roster.length > 0) {
        const needed = 5 - team1ActivePlayers.length;
        const available = team1Roster.filter(p => !team1ActivePlayers.some(ap => ap.id === p.id));
        const toAdd = available.slice(0, needed);
        team1ActivePlayers = [...team1ActivePlayers, ...toAdd];
        console.log(`Auto-selected ${toAdd.length} more players for Team 1. Total: ${team1ActivePlayers.length}`);
    }
    
    if (team2ActivePlayers.length < 5 && team2Roster.length > 0) {
        const needed = 5 - team2ActivePlayers.length;
        const available = team2Roster.filter(p => !team2ActivePlayers.some(ap => ap.id === p.id));
        const toAdd = available.slice(0, needed);
        team2ActivePlayers = [...team2ActivePlayers, ...toAdd];
        console.log(`Auto-selected ${toAdd.length} more players for Team 2. Total: ${team2ActivePlayers.length}`);
    }

    if (team1ActivePlayers.length > 0 || team2ActivePlayers.length > 0) {
        saveMatchState();
    }
    
    // Explicitly render active players to update the UI elements (team1-active-players, etc)
    renderActivePlayers();
    
    // Explicitly render player selection to ensure checkboxes/tags are correct
    renderPlayerSelection();

    updateMapStatus();
    disableGameControls(); // Disable game controls until map selection is done
}

function addLog(message, type = 'info') {
    if (!matchLogsElement) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}] ${message}`;
    matchLogsElement.appendChild(logEntry);
    matchLogsElement.scrollTop = matchLogsElement.scrollHeight;
}

 function determineFirstPick() {
     firstPickTeam = Math.random() < 0.5 ? 'team1' : 'team2';
     console.log(`Coinflip: ${firstPickTeam} gets first pick.`);
 }

 function getTeamForPhase(phase) {
     const team1IsFirst = (firstPickTeam === 'team1');
     switch (phase) {
         case 'ban1':
         case 'ban3':
             return team1IsFirst ? team1 : team2;
         case 'ban2':
         case 'ban4':
             return team1IsFirst ? team2 : team1;
         case 'pick1':
             return team1IsFirst ? team1 : team2;
         case 'pick2':
             return team1IsFirst ? team2 : team1;
         case 'decider':
             // Decider pick is always by the team that did NOT get the last pick
             // If team1 had pick1 and team2 had pick2, then team1 gets decider
             // This logic might need adjustment based on specific rules
             return team1IsFirst ? team1 : team2; 
         default:
             return null;
     }
 }

 function renderMapPool() {
    console.log('renderMapPool called');
    if (!mapPoolElement) {
        console.error('mapPoolElement not found!');
        return;
    }
    mapPoolElement.innerHTML = '';
    mapPool.forEach(map => {
        const mapItem = document.createElement('div');
        mapItem.classList.add('map-item');
        mapItem.textContent = map;
        if (bannedMaps.includes(map)) {
            mapItem.classList.add('banned');
        }
        if (pickedMaps.includes(map)) {
            mapItem.classList.add('picked');
        }
        mapItem.addEventListener('click', () => handleMapSelection(map));
        mapPoolElement.appendChild(mapItem);
    });
}

 function updateMapStatus() {
     console.log('updateMapStatus called. currentBanPickPhase:', currentBanPickPhase);
     let statusText = '';
     let currentTeam = null;
 
     switch (currentBanPickPhase) {
            case 'ban1':
            case 'ban2':
            case 'ban3':
            case 'ban4':
                currentTeam = getTeamForPhase(currentBanPickPhase);
                statusText = `${currentTeam.name} to ban a map.`;
                
                if (currentTeam.name && normalizeName(currentTeam.name) !== normalizeName(playerTeamName)) {
                    simulateAIMove();
                } else {
                    console.log(`Waiting for manual input from ${currentTeam.name} (Player team: ${playerTeamName})`);
                }
                break;
            case 'pick1':
            case 'pick2':
               currentTeam = getTeamForPhase(currentBanPickPhase);
               statusText = `${currentTeam.name} to pick a map.`;
               
               if (currentTeam.name && normalizeName(currentTeam.name) !== normalizeName(playerTeamName)) {
                   simulateAIMove();
               } else {
                   console.log(`Waiting for manual input from ${currentTeam.name} (Player team: ${playerTeamName})`);
               }
               break;
           case 'decider':
               statusText = `Pick the decider map.`;
               const available = mapPool.filter(map => !bannedMaps.includes(map) && !pickedMaps.includes(map));

               if (available.length === 1) {
                   // Only one map left, automatically make it the decider
                   simulateAIMove();
               } else {
                   currentTeam = getTeamForPhase(currentBanPickPhase);
                   if (currentTeam && currentTeam.name && normalizeName(currentTeam.name) !== normalizeName(playerTeamName)) {
                       simulateAIMove();
                   } else {
                       console.log(`Waiting for manual input for decider (Player team: ${playerTeamName})`);
                   }
               }
               break;
           case 'done':
               statusText = `Map selection complete. Ready to start!`;
               mapSelectionContainer.style.display = 'none';
               const mainArea = document.getElementById('simulation-main-area');
               const sidebarLogs = document.getElementById('sidebar-logs');
               if (mainArea) mainArea.style.display = 'block';
               if (simulationUI) simulationUI.style.display = 'block';
               if (sidebarLogs) sidebarLogs.style.display = 'flex';
               nextRoundButton.style.display = 'inline-block';
               autoPlayButton.style.display = 'inline-block';
               simSpeedSelect.style.display = 'inline-block';
               resetMatchButton.style.display = 'inline-block';
               nextRoundButton.textContent = 'Simulate Round';
               
               // Only initialize map if not already set from saved state
               if (!currentMap && pickedMaps.length > 0) {
                   currentMapIndex = 0;
                   currentMap = pickedMaps[0];
                   isMapIntermission = false; // Ensure not in intermission for first map
                   startNextMap();
               } else if (currentMap) {
                   // Refresh display for current map
                   if (isMapIntermission) {
                       nextRoundButton.textContent = 'Start Next Map';
                       autoPlayButton.style.display = 'none';
                   }
                   startNextMap();
               }
               break;
       }
       currentMapStatusElement.textContent = statusText;
 }

 function handleMapSelection(map) {
    console.log('handleMapSelection called with map:', map);
    
    // Block user input if it's AI's turn or AI is already moving
    if (isAiMoving) {
        console.log("Blocking user input: AI is moving.");
        return;
    }

    const currentTeam = getTeamForPhase(currentBanPickPhase);
    const isPlayerInMatch = (normalizeName(team1.name) === normalizeName(playerTeamName) || normalizeName(team2.name) === normalizeName(playerTeamName));
    
    if (isPlayerInMatch && currentTeam && currentTeam.name && normalizeName(currentTeam.name) !== normalizeName(playerTeamName) && currentBanPickPhase !== 'done') {
        console.log("Blocking user input: It's AI's turn.");
        return;
    }

    if (bannedMaps.includes(map) || pickedMaps.includes(map)) {
        return; // Cannot select an already banned or picked map
    }
 
    switch (currentBanPickPhase) {
           case 'ban1':
               bannedMaps.push(map);
               team1Bans++;
               currentBanPickPhase = 'ban2';
               break;
           case 'ban2':
               bannedMaps.push(map);
               team2Bans++;
               currentBanPickPhase = 'pick1';
               break;
           case 'ban3':
               bannedMaps.push(map);
               team1Bans++;
               currentBanPickPhase = 'ban4';
               break;
           case 'ban4':
               bannedMaps.push(map);
               team2Bans++;
               currentBanPickPhase = 'decider';
               break;
           case 'pick1':
               pickedMaps.push(map);
               team1Picks++;
               currentBanPickPhase = 'pick2';
               break;
           case 'pick2':
               pickedMaps.push(map);
               team2Picks++;
               currentBanPickPhase = 'ban3';
               break;
           case 'decider':
               pickedMaps.push(map);
               currentBanPickPhase = 'done';
               console.log('Decider map picked:', map, 'New phase:', currentBanPickPhase);
               break;
    }
    renderMapPool();
    updateMapStatus();
    saveMatchState(); // Save state after each map selection action
}

function simulateAIMove() {
    if (isAiMoving || currentBanPickPhase === 'done') return;
    
    // Check if it's actually AI's turn (extra safety)
    const currentTeam = getTeamForPhase(currentBanPickPhase);
    const isPlayerInMatch = (normalizeName(team1.name) === normalizeName(playerTeamName) || normalizeName(team2.name) === normalizeName(playerTeamName));
    
    // Special case: decider map with only 1 left always triggers simulateAIMove even if it's player's turn (auto-pick)
    const availableMaps = mapPool.filter(map => !bannedMaps.includes(map) && !pickedMaps.includes(map));
    const isAutoDecider = currentBanPickPhase === 'decider' && availableMaps.length === 1;

    if (!isAutoDecider && isPlayerInMatch && currentTeam && normalizeName(currentTeam.name) === normalizeName(playerTeamName)) {
        console.log("Aborting AI move: It's the player's turn.");
        return;
    }

    isAiMoving = true;
    console.log('AI is thinking...');
    
    // Show AI thinking status
    const currentStatus = currentMapStatusElement.textContent;
    currentMapStatusElement.textContent = `${currentStatus} (AI is thinking...)`;
    
    if (availableMaps.length === 0) {
        isAiMoving = false;
        return;
    }

    // Add a slight delay for realism
    setTimeout(() => {
        // Re-check phase in case it changed during timeout
        if (currentBanPickPhase === 'done') {
            isAiMoving = false;
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableMaps.length);
        const selectedMap = availableMaps[randomIndex];
        
        console.log(`AI selected map: ${selectedMap} for phase ${currentBanPickPhase}`);
        
        switch (currentBanPickPhase) {
            case 'ban1':
            case 'ban2':
            case 'ban3':
            case 'ban4':
                bannedMaps.push(selectedMap);
                if (currentBanPickPhase === 'ban1' || currentBanPickPhase === 'ban3') team1Bans++;
                else team2Bans++;
                
                if (currentBanPickPhase === 'ban1') currentBanPickPhase = 'ban2';
                else if (currentBanPickPhase === 'ban2') currentBanPickPhase = 'pick1';
                else if (currentBanPickPhase === 'ban3') currentBanPickPhase = 'ban4';
                else if (currentBanPickPhase === 'ban4') currentBanPickPhase = 'decider';
                break;
            case 'pick1':
            case 'pick2':
                pickedMaps.push(selectedMap);
                if (currentBanPickPhase === 'pick1') team1Picks++;
                else team2Picks++;
                
                if (currentBanPickPhase === 'pick1') currentBanPickPhase = 'pick2';
                else if (currentBanPickPhase === 'pick2') currentBanPickPhase = 'ban3';
                break;
            case 'decider':
                pickedMaps.push(selectedMap);
                currentBanPickPhase = 'done';
                break;
        }
        
        isAiMoving = false;
        renderMapPool();
        updateMapStatus();
        saveMatchState();
    }, 1500); // 1.5 second delay
}

function renderPlayerSelection() {
    renderActivePlayers();
}

function renderActivePlayers() {
    if (!team1ActivePlayersElement || !team2ActivePlayersElement) return;
    
    const renderTeam = (activePlayers, roster, element, teamName) => {
        element.innerHTML = '';
        activePlayers.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.classList.add('player-item', 'selected');
            
            const kills = player.kills || (player.stats ? player.stats.kills : 0);
            const deaths = player.deaths || (player.stats ? player.stats.deaths : 0);
            const assists = player.assists || (player.stats ? player.stats.assists : 0);
            
            playerItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700;">${player.name}</span>
                    <span class="role-tag" style="font-size: 9px; opacity: 0.7;">${player.role}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="stats-tag">${kills}/${deaths}/${assists}</span>
                    <button class="sub-btn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 10px; padding: 0;" title="Substitute Player" ${!isMapIntermission ? 'disabled style="display: none;"' : ''}>🔄</button>
                </div>
            `;

            const subBtn = playerItem.querySelector('.sub-btn');
            if (isMapIntermission) {
                subBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSubstitution(player, activePlayers, roster, teamName);
                });
            }
            element.appendChild(playerItem);
        });
    };

    renderTeam(team1ActivePlayers, team1Roster, team1ActivePlayersElement, team1.name);
    renderTeam(team2ActivePlayers, team2Roster, team2ActivePlayersElement, team2.name);
    
    // Call scoreboard overlay update to sync player stats in overlays
    updateScoreboardOverlays();
}

function updateScoreboardOverlays() {
    if (!team1OverlayElement || !team2OverlayElement) return;

    const renderOverlay = (activePlayers, roster, overlayElement, teamName) => {
        overlayElement.innerHTML = `
            <div class="team-stats-header">
                <span>ACTIVE ROSTER</span>
                <span>K/D/A</span>
            </div>
        `;
        
        activePlayers.forEach(player => {
            const playerRow = document.createElement('div');
            playerRow.className = 'overlay-player';
            
            const kills = player.kills || (player.stats ? player.stats.kills : 0);
            const deaths = player.deaths || (player.stats ? player.stats.deaths : 0);
            const assists = player.assists || (player.stats ? player.stats.assists : 0);
            
            playerRow.innerHTML = `
                <div class="overlay-player-info">
                    <span class="overlay-player-name">${player.name}</span>
                    <span class="overlay-player-role">${player.role}</span>
                </div>
                <div class="overlay-player-right">
                    <div class="overlay-player-stats">${kills}/${deaths}/${assists}</div>
                    <button class="overlay-sub-btn" title="Substitute Player" ${!isMapIntermission ? 'disabled' : ''}>
                        🔄
                    </button>
                </div>
            `;

            const subBtn = playerRow.querySelector('.overlay-sub-btn');
            if (isMapIntermission) {
                subBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSubstitution(player, activePlayers, roster, teamName);
                });
            } else {
                subBtn.title = "Subs only allowed between maps";
            }

            overlayElement.appendChild(playerRow);
        });
    };

    renderOverlay(team1ActivePlayers, team1Roster, team1OverlayElement, team1.name);
    renderOverlay(team2ActivePlayers, team2Roster, team2OverlayElement, team2.name);
}

function handleSubstitution(currentPlayer, activeArray, fullRoster, teamName) {
    // Find players who are on the bench (in roster but not in active squad)
    const bench = fullRoster.filter(p => !activeArray.some(ap => String(ap.id) === String(p.id)));
    
    if (bench.length === 0) {
        alert("No substitutes available in the roster!");
        return;
    }

    // For simplicity, we'll cycle through the bench or show a prompt
    // Let's use a simple prompt for now to pick which bench player to bring in
    const benchNames = bench.map((p, i) => `${i + 1}: ${p.name} (${p.role})`).join('\n');
    const choice = prompt(`Substitute ${currentPlayer.name} OUT. Choose player to bring IN:\n${benchNames}`);
    
    if (choice === null) return;
    
    const selectedIndex = parseInt(choice) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= bench.length) {
        alert("Invalid selection!");
        return;
    }

    const newPlayer = bench[selectedIndex];
    
    // Perform swap
    const activeIndex = activeArray.findIndex(p => String(p.id) === String(currentPlayer.id));
    activeArray[activeIndex] = newPlayer;

    // Log the substitution with symbols as requested
    // OUT 🔴 n4rrate -> IN 🟢 Martenix
    const subLog = `SUB: OUT 🔴 ${currentPlayer.name} ➡️ IN 🟢 ${newPlayer.name}`;
    addLog(subLog, 'strategy-log');

    renderActivePlayers();
    saveMatchState();
}

function renderGunSelection() {
    team1GunPoolElement.innerHTML = '';
    gunPool.forEach(gun => {
        const gunItem = document.createElement('div');
        gunItem.classList.add('gun-item');
        gunItem.textContent = gun;
        // Add event listener for gun selection if needed
        team1GunPoolElement.appendChild(gunItem);
    });

    team2GunPoolElement.innerHTML = '';
    gunPool.forEach(gun => {
        const gunItem = document.createElement('div');
        gunItem.classList.add('gun-item');
        gunItem.textContent = gun;
        // Add event listener for gun selection if needed
        team2GunPoolElement.appendChild(gunItem);
    });
}

function enableGameControls() {
    // team1WinGameButton.disabled = false;
    // team2WinGameButton.disabled = false;
    // Instead of enabling manual buttons, we'll simulate a round with AI
    simulateAIRound();
}

function disableGameControls() {
    // team1WinGameButton.disabled = true;
    // team2WinGameButton.disabled = true;
}

async function handleNextRound() {
    console.log('Next Round button clicked!');
    
    // If we are in intermission, the button starts the next map
    if (isMapIntermission) {
        startNextMap();
        return;
    }

    console.log('Active players - Team 1:', team1ActivePlayers.length, 'Team 2:', team2ActivePlayers.length);
    
    if (team1ActivePlayers.length < 5 || team2ActivePlayers.length < 5) {
        alert('Please select 5 active players for each team before starting the round.');
        return;
    }

    currentRound++;
    
    // Create temporary Team objects with only active players for the simulator
    const activeTeam1 = new Team(team1.name);
    activeTeam1.players = team1ActivePlayers;
    
    // Determine sides based on round number
    if (currentRound <= 12) {
        activeTeam1.side = 'attack';
    } else if (currentRound <= 24) {
        activeTeam1.side = 'defense';
    } else {
        // Overtime: switch every 2 rounds (25, 26 -> A, D; 27, 28 -> D, A; etc.)
        const otRound = currentRound - 24;
        const otSet = Math.ceil(otRound / 2);
        if (otSet % 2 === 1) {
            // Odd sets (1st, 3rd, etc.): 25 is Attack, 26 is Defense
            activeTeam1.side = otRound % 2 === 1 ? 'attack' : 'defense';
        } else {
            // Even sets (2nd, 4th, etc.): 27 is Defense, 28 is Attack
            activeTeam1.side = otRound % 2 === 1 ? 'defense' : 'attack';
        }
    }
    
    const activeTeam2 = new Team(team2.name, team2.id);
    activeTeam2.players = team2ActivePlayers;
    activeTeam2.side = activeTeam1.side === 'attack' ? 'defense' : 'attack';

    // Update active players to have the correct teamId for simulation logic
    team1ActivePlayers.forEach(p => p.teamId = team1.id);
    team2ActivePlayers.forEach(p => p.teamId = team2.id);

    // Log side switch or OT
    if (currentRound === 13) addLog("Sides switched!", "info");
    if (currentRound === 25) addLog("MATCH GOING TO OVERTIME!", "info");
    if (currentRound > 25 && (currentRound - 25) % 2 === 0) addLog("Overtime sides switched!", "info");

    const roundLogs = [];
    // Use RoundSimulator from simulation.js
    const roundSim = new RoundSimulator(
        activeTeam1.side === 'attack' ? activeTeam1 : activeTeam2,
        activeTeam1.side === 'defense' ? activeTeam1 : activeTeam2,
        currentRound, 
        roundLogs,
        teamStrategies,
        currentMap // Pass the current map name to the simulator
    );
    const result = roundSim.simulateRound();
    
    // Animate kill events before updating scores and UI
    if (result.events && result.events.length > 0) {
        // Disable controls while animating
        nextRoundButton.disabled = true;
        autoPlayButton.disabled = true;
        
        await animateKillEvents(result.events);
        
        // Re-enable controls if not in auto-play
        if (!isAutoPlaying) {
            nextRoundButton.disabled = false;
            autoPlayButton.disabled = false;
        }
    }

    // Add round-specific strategy logs to the UI
    roundLogs.forEach(log => {
        addLog(log, 'strategy-log');
    });

    // Sync stats from the active player objects back to our rosters
    // This ensures that p.stats (which RoundSimulator modifies) is preserved
    [...team1ActivePlayers, ...team2ActivePlayers].forEach(activePlayer => {
        const rosterPlayer = [...team1Roster, ...team2Roster].find(p => p.id === activePlayer.id || p.name === activePlayer.name);
        if (rosterPlayer) {
            rosterPlayer.stats = { ...activePlayer.stats };
            rosterPlayer.kills = activePlayer.kills;
            rosterPlayer.deaths = activePlayer.deaths;
            rosterPlayer.assists = activePlayer.assists;
            // Ensure consistency between stats object and top-level properties
            if (rosterPlayer.stats) {
                rosterPlayer.stats.kills = activePlayer.kills;
                rosterPlayer.stats.deaths = activePlayer.deaths;
                rosterPlayer.stats.assists = activePlayer.assists;
            }
        }
    });

    const winner = result.winner;
    const winnerTeamIndex = winner.name === team1.name ? 1 : 2;
    
    updateScore(winnerTeamIndex);
    addLog(`Round ${currentRound}: ${winner.name} wins! (${team1Score}-${team2Score})`, winnerTeamIndex === 1 ? 'team1-win' : 'team2-win');
    
    // Update UI to show new stats
    renderActivePlayers();
    renderPlayerSelection();
    
    saveMatchState();
}

function updateScore(winner) {
    if (winner === 1) {
        team1Score++;
    } else {
        team2Score++;
    }
    if (score1Element) score1Element.textContent = team1Score;
    if (score2Element) score2Element.textContent = team2Score;
    checkMapEnd();
}

function checkMapEnd() {
    const roundsToWin = 13;
    let mapWinner = null;

    // First to 13, but must win by 2 (overtime logic)
    if (team1Score >= roundsToWin || team2Score >= roundsToWin) {
        if (Math.abs(team1Score - team2Score) >= 2) {
            mapWinner = team1Score > team2Score ? 1 : 2;
        }
    }

    if (mapWinner) {
        handleMapWin(mapWinner);
    }
}

function handleMapWin(winner) {
    // Capture map stats before resetting
    const mapPlayerStats = {};
    const allPlayers = [...team1Roster, ...team2Roster];
    
    // Calculate stats for this map only by subtracting previous map totals
    allPlayers.forEach(p => {
        let prevKills = 0, prevDeaths = 0, prevAssists = 0, prevDamage = 0, prevHS = 0;
        
        // Sum up stats from all previous maps in mapResults
        mapResults.forEach(prevMap => {
            const prevStats = prevMap.playerStats[p.id];
            if (prevStats) {
                prevKills += prevStats.kills;
                prevDeaths += prevStats.deaths;
                prevAssists += prevStats.assists;
                prevDamage += prevStats.damage;
                prevHS += prevStats.hs || 0;
            }
        });

        mapPlayerStats[p.id] = {
            name: p.name,
            teamId: p.teamId,
            teamName: p.teamId === team1.id ? team1.name : team2.name,
            kills: p.stats.kills - prevKills,
            deaths: p.stats.deaths - prevDeaths,
            assists: p.stats.assists - prevAssists,
            hs: (p.stats.hs || 0) - prevHS,
            damage: p.stats.damageDealt - prevDamage
        };
    });

    mapResults.push({
        mapName: currentMap,
        winner: winner === 1 ? team1.name : team2.name,
        score: `${team1Score}-${team2Score}`,
        playerStats: mapPlayerStats
    });

    if (winner === 1) {
        team1MapWins++;
        addLog(`${team1.name} won the map ${currentMap}!`, 'team1-win');
    } else {
        team2MapWins++;
        addLog(`${team2.name} won the map ${currentMap}!`, 'team2-win');
    }

    // Reset round scores for next map
    team1Score = 0;
    team2Score = 0;
    currentRound = 0; // Reset round count
    score1Element.textContent = '0';
    score2Element.textContent = '0';
    
    currentMapIndex++;
    isMapIntermission = true;
    saveMatchState(); // Ensure mapResults and isMapIntermission is saved
    checkMatchEnd();
}

function saveMatchState() {
    const activeSaveId = localStorage.getItem('activeSaveId') || 'no_save';
    const matchState = {
        team1Score: team1Score,
        team2Score: team2Score,
        team1MapWins: team1MapWins,
        team2MapWins: team2MapWins,
        bannedMaps: bannedMaps,
        pickedMaps: pickedMaps,
        currentMap: currentMap,
        currentMapIndex: currentMapIndex,
        currentBanPickPhase: currentBanPickPhase,
        firstPickTeam: firstPickTeam,
        currentRound: currentRound,
        totalRounds: totalRounds,
        team1ActivePlayers: team1ActivePlayers,
        team2ActivePlayers: team2ActivePlayers,
        mapResults: mapResults,
        isMapIntermission: isMapIntermission
    };
    try {
        localStorage.setItem(`match_${activeSaveId}_${matchId}`, JSON.stringify(matchState));
    } catch (e) {
        console.warn("persistMatchState: localStorage quota exceeded", e);
    }
}

function checkMatchEnd() {
    const mapsToWin = Math.ceil(bestOf / 2);

    if (team1MapWins >= mapsToWin) {
        matchWinnerElement.textContent = `${team1.name} wins the match ${team1MapWins}-${team2MapWins}!`;
        matchWinnerElement.style.color = 'var(--v-red)';
        matchWinnerElement.style.display = 'block';
        nextRoundButton.style.display = 'none';
        autoPlayButton.style.display = 'none';
        simSpeedSelect.style.display = 'none';
        resetMatchButton.style.display = 'inline-block'; // Keep reset available
        returnToBracketButton.style.display = 'block';
        saveMatchResult(1);
    } else if (team2MapWins >= mapsToWin) {
        matchWinnerElement.textContent = `${team2.name} wins the match ${team2MapWins}-${team1MapWins}!`;
        matchWinnerElement.style.color = 'var(--v-red)';
        matchWinnerElement.style.display = 'block';
        nextRoundButton.style.display = 'none';
        returnToBracketButton.style.display = 'block';
        saveMatchResult(2);
    } else {
        // Prepare next map - but wait for user to click "Start Next Map"
        nextRoundButton.textContent = 'Start Next Map';
        nextRoundButton.style.display = 'block';
        autoPlayButton.style.display = 'none'; // Hide auto-play during break
        
        addLog(`Map break: ${team1.name} ${team1MapWins} - ${team2MapWins} ${team2.name}. You can make substitutions now.`, 'info');
        renderActivePlayers(); // Refresh to enable sub buttons
    }
}

function startNextMap() {
    isMapIntermission = false;
    currentMap = pickedMaps[currentMapIndex];
    
    currentMapNameSpan.textContent = currentMap;
    const mapNameLower = currentMap.toLowerCase();
    mapImageElement.src = `assets/maps/${mapNameLower}.svg`;
    
    // Ensure the map image has a consistent aspect ratio and loading state
    mapImageElement.style.opacity = '0';
    mapImageElement.onload = () => {
        mapImageElement.style.transition = 'opacity 0.5s ease-in-out';
        mapImageElement.style.opacity = '1';
    };

    addLog(`Starting next map: ${currentMap}`);
    
    // Switch to simulation UI if it was hidden
    mapSelectionContainer.style.display = 'none';
    currentMapDisplay.style.display = 'block';
    simulationUI.style.display = 'block';
    nextRoundButton.style.display = 'block';
    nextRoundButton.textContent = 'Simulate Round';
    autoPlayButton.style.display = 'inline-block';
    
    renderActivePlayers(); // Refresh to disable sub buttons
    saveMatchState();
}

function saveMatchResult(winnerTeam) {
    const winnerName = winnerTeam === 1 ? team1.name : team2.name;
    const loserName = winnerTeam === 1 ? team2.name : team1.name;
    const score = `${team1MapWins}-${team2MapWins}`;
    
    // Collect stats for all players
    const playerStats = {};
    
    // Team 1 Stats
    team1Roster.forEach(p => {
        playerStats[p.id] = {
            name: p.name,
            teamId: team1.id,
            teamName: team1.name,
            overall: p.overall,
            kills: p.stats.kills,
            deaths: p.stats.deaths,
            assists: p.stats.assists,
            hs: p.stats.hs,
            damage: p.stats.damageDealt
        };
    });
    
    // Team 2 Stats
    team2Roster.forEach(p => {
        playerStats[p.id] = {
            name: p.name,
            teamId: team2.id,
            teamName: team2.name,
            overall: p.overall,
            kills: p.stats.kills,
            deaths: p.stats.deaths,
            assists: p.stats.assists,
            hs: p.stats.hs,
            damage: p.stats.damageDealt
        };
    });

    const result = {
        id: matchId,
        winner: winnerName,
        loser: loserName,
        score: score,
        playerStats: playerStats,
        mapResults: mapResults,
        team1Name: team1.name,
        team2Name: team2.name,
        team1Id: team1.id,
        team2Id: team2.id,
        team1Score: team1MapWins,
        team2Score: team2MapWins,
        date: new Date().toISOString()
    };
    
    try {
        localStorage.setItem(`matchResult_${matchId}`, JSON.stringify(result));
    } catch (e) {
        console.warn("saveMatchResult: localStorage quota exceeded", e);
    }
    console.log(`Saved match result for ${matchId}:`, result);

    // Update kickoff/masters state in local storage if it exists
    const activeSave = loadCareer();
    const activeSaveId = localStorage.getItem('activeSaveId');
    if (activeSaveId && activeSave) {
        const playerTeamData = teams.find(t => String(t.id) === String(activeSave.teamId));
        const playerRegion = playerTeamData ? playerTeamData.region : "Americas";
        
        // Handle Kickoff
        if (matchId && !matchId.startsWith('M-')) {
            const kickoffState = getKickoffState(playerRegion, activeSaveId);
            if (kickoffState) {
                if (!kickoffState.series) kickoffState.series = {};
                kickoffState.series[matchId] = result;
                saveKickoffState(kickoffState, playerRegion, activeSaveId);
                console.log(`Updated kickoff state series ${matchId} for region ${playerRegion}`);
            }
        }
        
        // Handle Masters Bangkok
        if (matchId && matchId.startsWith('M-') && activeSave.mastersState) {
            const st = activeSave.mastersState;
            console.log("Updating Masters State for match:", matchId);
            
            if (matchId.startsWith('M-SWISS')) {
                if (!st.swiss.matches) st.swiss.matches = {};
                st.swiss.matches[matchId] = result;
                
                // Update Swiss stats
                if (st.swiss.teamStats) {
                    if (st.swiss.teamStats[winnerName]) st.swiss.teamStats[winnerName].wins++;
                    if (st.swiss.teamStats[loserName]) st.swiss.teamStats[loserName].losses++;
                    
                    if (st.swiss.teamStats[winnerName] && st.swiss.teamStats[winnerName].wins === 2) {
                        st.swiss.teamStats[winnerName].qualified = true;
                    }
                    if (st.swiss.teamStats[loserName] && st.swiss.teamStats[loserName].losses === 2) {
                        st.swiss.teamStats[loserName].eliminated = true;
                    }
                }
            } else if (matchId.startsWith('M-PLAYOFF')) {
                if (!st.playoffs.matches) st.playoffs.matches = {};
                st.playoffs.matches[matchId] = result;
                
                // Progress from SF to GF if both SFs are done
                if (matchId.startsWith('M-PLAYOFF-SF')) {
                    const sf1 = st.playoffs.matches['M-PLAYOFF-SF1'];
                    const sf2 = st.playoffs.matches['M-PLAYOFF-SF2'];
                    if (sf1 && sf1.winner && sf2 && sf2.winner) {
                        st.playoffs.grandFinal = 'M-PLAYOFF-GF';
                        st.playoffs.matches['M-PLAYOFF-GF'] = {
                            team1: sf1.winner,
                            team2: sf2.winner,
                            winner: null,
                            score: null,
                            playerStats: null,
                            isGrandFinal: true,
                            bestOf: 5
                        };
                    }
                }
                
                // Handle Grand Final winner
                if (matchId === 'M-PLAYOFF-GF') {
                    st.complete = true;
                    console.log("Masters Bangkok Grand Final finished! Winner:", winnerName);
                    // Bonus points for winner
                    if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
                    activeSave.championshipPoints[winnerName] = (activeSave.championshipPoints[winnerName] || 0) + 3;
                }
            }
            
            // Add championship points for any match win
            if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
            activeSave.championshipPoints[winnerName] = (activeSave.championshipPoints[winnerName] || 0) + 1;
            
            saveCareer(activeSave);
            
            // Notify parent if in iframe
            try {
                window.parent.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
                window.parent.postMessage({ type: 'careerUpdate', data: activeSave }, window.location.origin);
            } catch (e) {
                console.warn("Failed to notify parent of Masters update:", e);
            }
        }
    }
}

function loadMatchState() {
    const activeSaveId = localStorage.getItem('activeSaveId') || 'no_save';
    const savedState = localStorage.getItem(`match_${activeSaveId}_${matchId}`);
    if (savedState) {
        const matchState = JSON.parse(savedState);
        team1Score = matchState.team1Score || 0;
        team2Score = matchState.team2Score || 0;
        team1MapWins = matchState.team1MapWins || 0;
        team2MapWins = matchState.team2MapWins || 0;
        bannedMaps = matchState.bannedMaps || [];
        pickedMaps = matchState.pickedMaps || [];
        currentMap = matchState.currentMap || '';
        currentMapIndex = matchState.currentMapIndex || 0;
        currentBanPickPhase = matchState.currentBanPickPhase || 'ban1';
        firstPickTeam = matchState.firstPickTeam || '';
        currentRound = matchState.currentRound || 0;
        totalRounds = matchState.totalRounds || 0;
        mapResults = matchState.mapResults || [];
        isMapIntermission = matchState.isMapIntermission || false;

    // Rehydrate active players and link them to the roster instances
        if (matchState.team1ActivePlayers) {
            console.log(`Loading saved Team 1 active players: ${matchState.team1ActivePlayers.length}`);
            const rehydrated = matchState.team1ActivePlayers.map(p => Player.fromJSON(p));
            team1ActivePlayers = rehydrated.map(rp => {
                const rosterPlayer = team1Roster.find(p => p.id === rp.id);
                if (rosterPlayer) {
                    // Sync all stats from rehydrated player back to roster player
                    rosterPlayer.stats = rp.stats;
                    rosterPlayer.kills = rp.kills;
                    rosterPlayer.deaths = rp.deaths;
                    rosterPlayer.assists = rp.assists;
                    return rosterPlayer;
                }
                return rp;
            });
        }
        if (matchState.team2ActivePlayers) {
            console.log(`Loading saved Team 2 active players: ${matchState.team2ActivePlayers.length}`);
            const rehydrated = matchState.team2ActivePlayers.map(p => Player.fromJSON(p));
            team2ActivePlayers = rehydrated.map(rp => {
                const rosterPlayer = team2Roster.find(p => p.id === rp.id);
                if (rosterPlayer) {
                    // Sync all stats from rehydrated player back to roster player
                    rosterPlayer.stats = rp.stats;
                    rosterPlayer.kills = rp.kills;
                    rosterPlayer.deaths = rp.deaths;
                    rosterPlayer.assists = rp.assists;
                    return rosterPlayer;
                }
                return rp;
            });
        }
 
        if (score1Element) score1Element.textContent = team1Score;
        if (score2Element) score2Element.textContent = team2Score;
        
        if (currentMap && currentMapNameSpan) {
            currentMapNameSpan.textContent = currentMap;
        }

        // If the match was already finished, update the UI
        checkMatchEnd();
    }
}

function simulateAIRound() {
    // Simple AI: randomly determine round winner
    return Math.random() < 0.5 ? 1 : 2;
}

function clearMatchState() {
    if (matchId) {
        const activeSaveId = localStorage.getItem('activeSaveId') || 'no_save';
        localStorage.removeItem(`match_${activeSaveId}_${matchId}`);
    }
}

async function toggleAutoPlay() {
    if (isAutoPlaying) {
        isAutoPlaying = false;
        autoPlayButton.textContent = 'Auto Play';
        autoPlayButton.classList.remove('active');
        nextRoundButton.disabled = false;
    } else {
        isAutoPlaying = true;
        autoPlayButton.textContent = 'Pause';
        autoPlayButton.classList.add('active');
        nextRoundButton.disabled = true;
        await runAutoSimulation();
    }
}

/**
 * Animates the kill events in the kill feed and player markers on the map
 * @param {Array} events - The events to animate
 */
async function animateKillEvents(events) {
    const killFeed = document.getElementById('kill-feed-main');
    const playerMarkersContainer = document.getElementById('player-markers');
    if (!killFeed || !playerMarkersContainer) return;

    // Clear previous markers
    playerMarkersContainer.innerHTML = '';

    const baseDelay = parseInt(simSpeedSelect.value) || 1000;
    const eventSpacing = Math.max(100, baseDelay / 5);

    // Track marker elements by player ID
    const markers = {};

        // Initialize initial markers for all active players
        const initialEvent = events.find(e => e.type === 'initial_positions');
        if (initialEvent) {
            playerMarkersContainer.innerHTML = '';
            for (const playerId in initialEvent.positions) {
                const pos = initialEvent.positions[playerId];
                const player = [...team1ActivePlayers, ...team2ActivePlayers].find(p => String(p.id) === String(playerId));
                if (!player) continue;

                const marker = document.createElement('div');
                marker.className = `player-marker ${player.teamId === team1.id ? 'team1' : 'team2'}`;
                marker.id = `marker-${playerId}`;
                marker.style.left = `${pos.x}%`;
                marker.style.top = `${pos.y}%`;
                
                // Add name label
                const label = document.createElement('span');
                label.className = 'player-label';
                label.textContent = player.name;
                marker.appendChild(label);
                
                playerMarkersContainer.appendChild(marker);
                markers[playerId] = marker;
            }
        }

    for (const event of events) {
        if (event.type === 'initial_positions') {
            continue; // Already handled
        } else if (event.type === 'move') {
            // Update positions for all players in this snapshot
            for (const playerId in event.positions) {
                const pos = event.positions[playerId];
                const marker = markers[playerId] || document.getElementById(`marker-${playerId}`);
                if (marker) {
                    marker.style.left = `${pos.x}%`;
                    marker.style.top = `${pos.y}%`;
                }
            }
        } else if (event.type === 'kill') {
            const killItem = document.createElement('div');
            killItem.className = `kill-item ${event.killer.teamId === team1.id ? 'team1-killer' : 'team2-killer'}`;
            
            const assistText = event.assister ? ` <span class="assist-plus">+</span> <span class="assister">${event.assister.name}</span>` : '';
            const hsIcon = event.hs ? ' <span class="hs-icon">◈</span>' : '';
            
            killItem.innerHTML = `
                <span class="killer">${event.killer.name}</span>
                ${assistText}
                <span class="kill-icon">⚔️</span>
                <span class="weapon-icon">[${event.weapon}]</span>
                ${hsIcon}
                <span class="victim">${event.victim.name}</span>
            `;
            
            killFeed.appendChild(killItem);
            
            // Scroll to bottom
            killFeed.scrollTop = killFeed.scrollHeight;
            
            // Update marker positions and state
            const killerMarker = markers[event.killer.id] || document.getElementById(`marker-${event.killer.id}`);
            const victimMarker = markers[event.victim.id] || document.getElementById(`marker-${event.victim.id}`);

            if (killerMarker && event.position) {
                killerMarker.style.left = `${event.position.x}%`;
                killerMarker.style.top = `${event.position.y}%`;
            }

            if (victimMarker) {
                if (event.position) {
                    victimMarker.style.left = `${event.position.x}%`;
                    victimMarker.style.top = `${event.position.y}%`;
                }
                victimMarker.classList.add('dead');
            }

            // Auto-remove kill item after 5 seconds
            setTimeout(() => {
                if (killItem.parentNode) {
                    killItem.style.animation = 'killFadeOut 0.5s forwards';
                    setTimeout(() => killItem.remove(), 500);
                }
            }, 5000);
        }

        // Dynamic wait based on event type
        const simSpeedValue = parseInt(simSpeedSelect.value) || 1000;
        const currentEventSpacing = event.type === 'move' ? 300 : (event.type === 'kill' ? 1000 : 500);
        await new Promise(resolve => setTimeout(resolve, currentEventSpacing / (1000 / simSpeedValue)));
    }
    
    // Extra wait at the end of the round events
    await new Promise(resolve => setTimeout(resolve, 500));
}

async function runAutoSimulation() {
    while (isAutoPlaying) {
        // If map intermission starts during auto-play, pause auto-play
        if (isMapIntermission) {
            isAutoPlaying = false;
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.classList.remove('active');
            nextRoundButton.disabled = false;
            nextRoundButton.textContent = 'Start Next Map';
            break;
        }

        // Check if map or match ended
        const mapsToWin = Math.ceil(bestOf / 2);
        if (team1MapWins >= mapsToWin || team2MapWins >= mapsToWin) {
            isAutoPlaying = false;
            break;
        }

        // If a map just ended (team1Score and team2Score are 0 but mapResult was just added)
        // handleNextRound handles the logic, but we need to be careful about the loop
        
        handleNextRound();

        // After handleNextRound, check if we should stop
        if (team1MapWins >= mapsToWin || team2MapWins >= mapsToWin) {
            isAutoPlaying = false;
            break;
        }

        const delay = 500; // Small delay between rounds for UX
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Reset button state when done
    autoPlayButton.textContent = 'Auto Play';
    autoPlayButton.classList.remove('active');
    nextRoundButton.disabled = false;
}

function resetMatch() {
    if (!confirm('Are you sure you want to reset the match? All progress will be lost.')) return;
    
    isAutoPlaying = false;
    clearMatchState();
    window.location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
     // Initialize all UI elements after DOM is ready
     team1LogoElement = document.getElementById('team1-logo');
     team1NameElement = document.getElementById('team1-name');
     team2LogoElement = document.getElementById('team2-logo');
     team2NameElement = document.getElementById('team2-name');
     team1OverlayElement = document.getElementById('team1-overlay');
     team2OverlayElement = document.getElementById('team2-overlay');
     team1InfoElement = document.getElementById('team1-info');
     team2InfoElement = document.getElementById('team2-info');
     score1Element = document.getElementById('score1');
     score2Element = document.getElementById('score2');
     matchWinnerElement = document.getElementById('match-winner');
     currentMapNameSpan = document.getElementById('current-map-name');
     currentMapStatusElement = document.getElementById('current-map-status');
     mapImageElement = document.getElementById('current-map-image');
     nextRoundButton = document.getElementById('next-round');
     autoPlayButton = document.getElementById('auto-play');
     simSpeedSelect = document.getElementById('sim-speed');
     resetMatchButton = document.getElementById('reset-match');
     returnToBracketButton = document.getElementById('return-to-bracket');

     // New UI elements initialization
     mapPoolElement = document.getElementById('map-pool');
     banMapTeam1Button = document.getElementById('ban-map-team1');
     banMapTeam2Button = document.getElementById('ban-map-team2');
     pickMapTeam1Button = document.getElementById('pick-map-team1');
     pickMapTeam2Button = document.getElementById('pick-map-team2');
     mapSelectionContainer = document.getElementById('map-selection-container');
     currentMapDisplay = document.getElementById('current-map-display');
    team1ActivePlayersElement = document.getElementById('team1-active-players');
    team2ActivePlayersElement = document.getElementById('team2-active-players');
     team1GunPoolElement = document.getElementById('team1-gun-pool');
     team2GunPoolElement = document.getElementById('team2-gun-pool');
     matchLogsElement = document.getElementById('match-logs');
     simulationUI = document.getElementById('simulation-main-area');

     // Add event listeners after elements are initialized
     if (nextRoundButton) {
        nextRoundButton.addEventListener('click', handleNextRound);
     }

     if (autoPlayButton) {
        autoPlayButton.addEventListener('click', toggleAutoPlay);
     }

     if (resetMatchButton) {
        resetMatchButton.addEventListener('click', resetMatch);
     }
     
     if (returnToBracketButton) {
        returnToBracketButton.addEventListener('click', () => {
            clearMatchState(); // Clear state when returning to bracket
            const params = new URLSearchParams(window.location.search);
            const tournament = params.get('tournament');
            if (tournament === 'masters') {
                window.location.href = 'masters_bangkok.html';
            } else {
                window.location.href = 'kickoff.html';
            }
        });
     }

     // Add click-to-lock functionality for team overlays
     [team1InfoElement, team2InfoElement].forEach((el, index) => {
         if (!el) return;
         el.addEventListener('click', (e) => {
             const overlay = index === 0 ? team1OverlayElement : team2OverlayElement;
             const otherOverlay = index === 0 ? team2OverlayElement : team1OverlayElement;
             
             // Close other overlay
             if (otherOverlay) otherOverlay.classList.remove('locked');
             
             // Toggle current overlay
             if (overlay) {
                 overlay.classList.toggle('locked');
                 e.stopPropagation();
             }
         });
     });

     // Close locked overlays when clicking elsewhere
     document.addEventListener('click', () => {
         if (team1OverlayElement) team1OverlayElement.classList.remove('locked');
         if (team2OverlayElement) team2OverlayElement.classList.remove('locked');
     });

     // Prevent closing when clicking inside the overlay
     [team1OverlayElement, team2OverlayElement].forEach(el => {
         if (el) {
             el.addEventListener('click', (e) => e.stopPropagation());
         }
     });

     // Start initialization
     displayMatchDetails();
});




