let team1LogoElement;
let team1NameElement;
let team2LogoElement;
let team2NameElement;
let score1Element;
let score2Element;
let team1WinGameButton;
let team2WinGameButton;
let matchWinnerElement;
let returnToBracketButton;
let nextRoundButton;

// New UI elements
let mapPoolElement;
let banMapTeam1Button;
let banMapTeam2Button;
let pickMapTeam1Button;
let pickMapTeam2Button;
let currentMapStatusElement;
let mapSelectionContainer;
let currentMapDisplay;
let currentMapNameSpan;
let team1RosterElement;
let team2RosterElement;
let team1ActivePlayersElement;
let team2ActivePlayersElement;
let team1GunPoolElement;
let team2GunPoolElement;

let matchLogsElement;
let simulationUI;

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
let mapImageElement;
let mapPool = [
    'Abyss',
    'Bind',
    'Corrode',
    'Haven',
    'Pearl',
    'Split',
    'Sunset',
];
let bannedMaps = [];
let pickedMaps = [];
let firstPickTeam = '';
let team1Bans = 0;
let team2Bans = 0;
let team1Picks = 0;
let team2Picks = 0;
let currentBanPickPhase = 'ban1'; // Start with Team 1 banning

import { teams } from './teams.js';
import { getTeamsWithPlayers } from './players.js';
import { Player, Team, RoundSimulator, PlayerRating } from './simulation.js';

function getTeamByName(name) {
    const teamsWithPlayers = getTeamsWithPlayers();
    return teamsWithPlayers.find(t => t.name === name) || teams.find(t => t.name === name) || {
        name: name,
        logo: `assets/team_logos/${name.toLowerCase().replace(/ /g, '_')}.png`,
        players: []
    };
}

export function displayMatchDetails() {
    const params = new URLSearchParams(window.location.search);
    matchId = params.get('id');
    const team1Name = params.get('team1');
    const team2Name = params.get('team2');
    bestOf = parseInt(params.get('bestOf')) || 3;

    clearMatchState(); // Clear any existing state for a new match

    const t1Data = getTeamByName(team1Name);
    const t2Data = getTeamByName(team2Name);

    // Convert to Team and Player instances
    team1 = new Team(t1Data.name);
    team1.logo = t1Data.logo;
    t1Data.players.forEach(p => {
        const player = new Player(p.name, p.role, p.rating || { aim: p.skill, movement: p.skill, gameSense: p.skill, clutch: p.skill, aggression: p.skill }, t1Data.name, p.nationality, p.age);
        team1.addPlayer(player);
    });

    team2 = new Team(t2Data.name);
    team2.logo = t2Data.logo;
    t2Data.players.forEach(p => {
        const player = new Player(p.name, p.role, p.rating || { aim: p.skill, movement: p.skill, gameSense: p.skill, clutch: p.skill, aggression: p.skill }, t2Data.name, p.nationality, p.age);
        team2.addPlayer(player);
    });

    team1LogoElement.src = team1.logo;
    team1NameElement.textContent = team1.name;
    team2LogoElement.src = team2.logo;
    team2NameElement.textContent = team2.name;

    // Initialize player rosters
    team1Roster = team1.players;
    team2Roster = team2.players;

    determineFirstPick(); // Determine which team gets first pick
    loadMatchState(); // Load saved state

    renderMapPool();
    updateMapStatus();
    disableGameControls(); // Disable game controls until map selection is done
    
    renderPlayerSelection();
}

function renderRosters() {
    if (!team1RosterElement || !team2RosterElement) return;
    
    team1RosterElement.innerHTML = '';
    team1Roster.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `<span>${player.name}</span><span class="role-tag">${player.role}</span>`;
        team1RosterElement.appendChild(div);
    });

    team2RosterElement.innerHTML = '';
    team2Roster.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `<span>${player.name}</span><span class="role-tag">${player.role}</span>`;
        team2RosterElement.appendChild(div);
    });
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
    console.log('mapPoolElement:', mapPoolElement);
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
                break;
            case 'pick1':
            case 'pick2':
               currentTeam = getTeamForPhase(currentBanPickPhase);
               statusText = `${currentTeam.name} to pick a map.`;
               break;
           case 'decider':
               statusText = `Pick the decider map.`;
               break;
           case 'done':
               statusText = `Map selection complete. Ready to start!`;
               mapSelectionContainer.style.display = 'none';
               currentMapDisplay.style.display = 'block';
               if (simulationUI) simulationUI.style.display = 'block';
               nextRoundButton.style.display = 'inline-block';
               nextRoundButton.textContent = 'Simulate Round';
               currentMapIndex = 0;
               break;
       }
       currentMapStatusElement.textContent = statusText;
 }

 function handleMapSelection(map) {
    console.log('handleMapSelection called with map:', map);
    console.log('Current bannedMaps:', bannedMaps, 'pickedMaps:', pickedMaps);
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
               console.log('Decider map picked:', currentMap, 'New phase:', currentBanPickPhase);
               break;
    }
    renderMapPool();
    updateMapStatus();
    saveMatchState(); // Save state after each map selection action
}

function renderPlayerSelection() {
    if (!team1RosterElement || !team2RosterElement) return;
    
    team1RosterElement.innerHTML = '';
    const t1Roster = team1Roster || [];
    t1Roster.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item');
        const isSelected = team1ActivePlayers.some(p => p.id === player.id);
        if (isSelected) playerItem.classList.add('selected');
        
        playerItem.innerHTML = `
            <span>${player.name}</span>
            <span class="role-tag">${player.role}</span>
        `;
        playerItem.addEventListener('click', () => togglePlayerSelection(player, team1ActivePlayers, team1ActivePlayersElement));
        team1RosterElement.appendChild(playerItem);
    });

    team2RosterElement.innerHTML = '';
    const t2Roster = team2Roster || [];
    t2Roster.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item');
        const isSelected = team2ActivePlayers.some(p => p.id === player.id);
        if (isSelected) playerItem.classList.add('selected');

        playerItem.innerHTML = `
            <span>${player.name}</span>
            <span class="role-tag">${player.role}</span>
        `;
        playerItem.addEventListener('click', () => togglePlayerSelection(player, team2ActivePlayers, team2ActivePlayersElement));
        team2RosterElement.appendChild(playerItem);
    });
    renderActivePlayers();
}

function togglePlayerSelection(player, activePlayersArray, activePlayersElement) {
    const index = activePlayersArray.findIndex(p => p.id === player.id);
    if (index > -1) {
        activePlayersArray.splice(index, 1);
    } else if (activePlayersArray.length < 5) {
        activePlayersArray.push(player);
    }
    renderPlayerSelection(); // Re-render to update selected state
}

function renderActivePlayers() {
    if (!team1ActivePlayersElement || !team2ActivePlayersElement) return;
    
    team1ActivePlayersElement.innerHTML = '';
    team1ActivePlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item', 'selected');
        playerItem.textContent = player.name;
        team1ActivePlayersElement.appendChild(playerItem);
    });

    team2ActivePlayersElement.innerHTML = '';
    team2ActivePlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-item', 'selected');
        playerItem.textContent = player.name;
        team2ActivePlayersElement.appendChild(playerItem);
    });
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

function handleNextRound() {
    console.log('Next Round button clicked!');
    
    if (team1ActivePlayers.length < 5 || team2ActivePlayers.length < 5) {
        alert('Please select 5 active players for each team before starting the round.');
        return;
    }

    currentRound++;
    
    // Create temporary Team objects with only active players for the simulator
    const activeTeam1 = new Team(team1.name);
    activeTeam1.players = team1ActivePlayers;
    activeTeam1.side = currentRound <= 12 ? 'attack' : 'defense'; // Simple side logic
    
    const activeTeam2 = new Team(team2.name);
    activeTeam2.players = team2ActivePlayers;
    activeTeam2.side = activeTeam1.side === 'attack' ? 'defense' : 'attack';

    // Use RoundSimulator from simulation.js
    const roundSim = new RoundSimulator(
        activeTeam1.side === 'attack' ? activeTeam1 : activeTeam2,
        activeTeam1.side === 'defense' ? activeTeam1 : activeTeam2,
        currentRound, 
        []
    );
    const result = roundSim.simulateRound();
    
    const winner = result.winner;
    const winnerTeamIndex = winner.name === team1.name ? 1 : 2;
    
    addLog(`${winner.name} won round ${currentRound}!`, winnerTeamIndex === 1 ? 'team1-win' : 'team2-win');
    
    updateScore(winnerTeamIndex);
    saveMatchState();
}

function updateScore(winningTeam) {
    if (winningTeam === 1) {
        team1Score++;
    } else {
        team2Score++;
    }
    
    score1Element.textContent = team1Score;
    score2Element.textContent = team2Score;

    checkMapEnd();
}

function checkMapEnd() {
    const roundsToWin = 13;
    let mapWinner = null;

    if (team1Score >= roundsToWin && team1Score - team2Score >= 1) {
        mapWinner = 1;
    } else if (team2Score >= roundsToWin && team2Score - team1Score >= 1) {
        mapWinner = 2;
    }

    if (mapWinner) {
        handleMapWin(mapWinner);
    }
}

function handleMapWin(winner) {
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
    checkMatchEnd();
}

function saveMatchState() {
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
        totalRounds: totalRounds
    };
    localStorage.setItem(`match_${matchId}`, JSON.stringify(matchState));
}

function checkMatchEnd() {
    const mapsToWin = Math.ceil(bestOf / 2);

    if (team1MapWins >= mapsToWin) {
        matchWinnerElement.textContent = `${team1.name} wins the match ${team1MapWins}-${team2MapWins}!`;
        matchWinnerElement.style.color = 'var(--v-red)';
        nextRoundButton.style.display = 'none';
        returnToBracketButton.style.display = 'block';
        saveMatchResult(1);
    } else if (team2MapWins >= mapsToWin) {
        matchWinnerElement.textContent = `${team2.name} wins the match ${team2MapWins}-${team1MapWins}!`;
        matchWinnerElement.style.color = 'var(--v-red)';
        nextRoundButton.style.display = 'none';
        returnToBracketButton.style.display = 'block';
        saveMatchResult(2);
    } else {
        // Prepare next map
        if (currentMapIndex < pickedMaps.length) {
            currentMap = pickedMaps[currentMapIndex];
            startNextMap();
        } else {
            // This shouldn't happen if veto logic is correct
            console.error("No more maps to play but match not finished.");
        }
    }
}

function startNextMap() {
    currentMapNameSpan.textContent = currentMap;
    const mapNameLower = currentMap.toLowerCase();
    mapImageElement.src = `assets/maps/${mapNameLower}.svg`;
    addLog(`Starting next map: ${currentMap}`);
    
    // Switch to simulation UI if it was hidden
    mapSelectionContainer.style.display = 'none';
    currentMapDisplay.style.display = 'block';
    simulationUI.style.display = 'block';
    nextRoundButton.style.display = 'block';
}

function saveMatchResult(winnerTeam) {
    // Update kickoff state in local storage if needed
    const kickoffState = JSON.parse(localStorage.getItem('kickoffState'));
    if (kickoffState && matchId) {
        // Logic to update the bracket would go here
        // For now we just mark it as finished
        console.log(`Match ${matchId} finished. Winner: ${winnerTeam === 1 ? team1.name : team2.name}`);
    }
}

function loadMatchState() {
    const savedState = localStorage.getItem(`match_${matchId}`);
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
 
        if (score1Element) score1Element.textContent = team1Score;
        if (score2Element) score2Element.textContent = team2Score;
        
        if (currentMap && currentMapNameSpan) {
            currentMapNameSpan.textContent = currentMap;
        }
    }
}

function simulateAIRound() {
    // Simple AI: randomly determine round winner
    return Math.random() < 0.5 ? 1 : 2;
}

function clearMatchState() {
    if (matchId) {
        localStorage.removeItem(`match_${matchId}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
     // Initialize all UI elements after DOM is ready
     team1LogoElement = document.getElementById('team1-logo');
     team1NameElement = document.getElementById('team1-name');
     team2LogoElement = document.getElementById('team2-logo');
     team2NameElement = document.getElementById('team2-name');
     score1Element = document.getElementById('score1');
     score2Element = document.getElementById('score2');
     matchWinnerElement = document.getElementById('match-winner');
     currentMapNameSpan = document.getElementById('current-map-name');
     currentMapStatusElement = document.getElementById('current-map-status');
     mapImageElement = document.getElementById('current-map-image');
     team1WinGameButton = document.getElementById('team1-win-game');
     team2WinGameButton = document.getElementById('team2-win-game');
     nextRoundButton = document.getElementById('next-round');
     returnToBracketButton = document.getElementById('return-to-bracket');

     // New UI elements initialization
     mapPoolElement = document.getElementById('map-pool');
     banMapTeam1Button = document.getElementById('ban-map-team1');
     banMapTeam2Button = document.getElementById('ban-map-team2');
     pickMapTeam1Button = document.getElementById('pick-map-team1');
     pickMapTeam2Button = document.getElementById('pick-map-team2');
     mapSelectionContainer = document.getElementById('map-selection-container');
     currentMapDisplay = document.getElementById('current-map-display');
     team1RosterElement = document.getElementById('team1-roster');
     team2RosterElement = document.getElementById('team2-roster');
     team1ActivePlayersElement = document.getElementById('team1-active-players');
     team2ActivePlayersElement = document.getElementById('team2-active-players');
     team1GunPoolElement = document.getElementById('team1-gun-pool');
     team2GunPoolElement = document.getElementById('team2-gun-pool');
     matchLogsElement = document.getElementById('match-logs');
     simulationUI = document.getElementById('simulation-ui');

     // Add event listeners after elements are initialized
     if (nextRoundButton) {
        nextRoundButton.addEventListener('click', handleNextRound);
     }
     
     if (returnToBracketButton) {
        returnToBracketButton.addEventListener('click', () => {
            clearMatchState(); // Clear state when returning to bracket
            window.location.href = 'kickoff.html';
        });
     }

     // Start initialization
     displayMatchDetails();
});




