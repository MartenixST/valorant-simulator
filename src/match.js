import { Player, Team, RoundSimulator, MatchSimulator } from './simulation.js';
import { teams as allTeams } from './teams.js';
import { loadCareer, saveCareer } from './career_local_storage.jsx';

let team1 = null;
let team2 = null;
let matchId = null;
let context = null; // 'champions', 'kickoff', etc.
let logEl = null;
let activeSave = null;

function log(msg) {
  if (logEl) {
    logEl.innerHTML += `<p>${msg}</p>`;
    logEl.scrollTop = logEl.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  logEl = document.getElementById("match-log");
  const urlParams = new URLSearchParams(window.location.search);
  const team1Name = urlParams.get('team1');
  const team2Name = urlParams.get('team2');
  matchId = urlParams.get('matchId');
  context = urlParams.get('context');

  activeSave = loadCareer();
  
  if (team1Name && team2Name && activeSave) {
    // Load teams from career save
    team1 = loadTeamFromCareer(team1Name, activeSave);
    team2 = loadTeamFromCareer(team2Name, activeSave);

    document.getElementById('team1-name').textContent = team1.name;
    document.getElementById('team2-name').textContent = team2.name;
    
    log(`Match ready: ${team1.name} vs ${team2.name}`);
    if (context) {
      log(`Context: ${context} tournament`);
    }
  } else {
    log("Error: Team data or save not found.");
  }
});

function loadTeamFromCareer(teamName, save) {
  // Find team data
  const teamData = allTeams.find(t => t.name === teamName) || { name: teamName, power: 70, id: 1 };
  
  // Get players from save
  const teamPlayers = save.players?.filter(p => p.team === teamName).slice(0, 5) || [];
  
  // Create players with proper stats
  const players = teamPlayers.map((p, idx) => {
    return new Player(
      p.name || `Player ${idx + 1}`,
      p.role || 'Duelist',
      p.rating || 70,
      p.weapon || 'Vandal',
      p.shield || 'Heavy',
      p.money || 4000,
      p.stats || { kills: 0, deaths: 0, assists: 0 }
    );
  });
  
  // If no players, create generic ones
  if (players.length === 0) {
    for (let i = 0; i < 5; i++) {
      players.push(new Player(
        `${teamName} P${i+1}`,
        'Duelist',
        70,
        'Vandal',
        'Heavy',
        4000,
        { kills: 0, deaths: 0, assists: 0 }
      ));
    }
  }
  
  return new Team(teamData.id || 1, teamName, players, null);
}

// --- Match Simulation ---
export function simulateMatch() {
  if (!team1 || !team2) {
    log("Cannot simulate match: Team data missing.");
    return;
  }

  logEl.innerHTML = "";
  log(`Starting match: ${team1.name} vs ${team2.name}`);

  const maps = ['Ascent', 'Bind', 'Haven', 'Split', 'Sunset', 'Abyss', 'Pearl'];
  const randomMap = maps[Math.floor(Math.random() * maps.length)];
  const matchSimulator = new MatchSimulator(team1, team2, [], {}, randomMap);
  const result = matchSimulator.simulateMatch();

  log(`Match Result: ${result.winner.name} wins ${result.score.team1} - ${result.score.team2}`);

  // Display round-by-round log
  result.roundLogs.forEach(roundLog => {
    log(`<strong>Round ${roundLog.roundNumber}:</strong> ${roundLog.winner.name} wins. (${roundLog.team1Score} - ${roundLog.team2Score})`);
    roundLog.playerLogs.forEach(playerLog => {
      log(`  - ${playerLog}`);
    });
  });

  log(`<hr><strong>Final Score: ${result.winner.name} wins! (${result.score.team1} - ${result.score.team2})</strong>`);

  // Save result based on context
  if (context === 'champions' && matchId && activeSave) {
    saveChampionsResult(result, matchId);
  } else if (matchId) {
    // Legacy kickoff support
    saveKickoffResult(result);
  }
}

function saveChampionsResult(result, matchId) {
  const championsState = activeSave.championsState;
  if (!championsState || !championsState.groupMatches) {
    log("Error: Champions state not found.");
    return;
  }
  
  const match = championsState.groupMatches[matchId];
  if (!match) {
    log(`Error: Match ${matchId} not found in champions state.`);
    return;
  }
  
  // Update match result
  match.winner = result.winner.name;
  match.loser = result.winner.name === match.team1 ? match.team2 : match.team1;
  match.score = `${Math.max(result.score.team1, result.score.team2)}-${Math.min(result.score.team1, result.score.team2)}`;
  
  // Update team stats
  if (championsState.teamStats[match.winner]) {
    championsState.teamStats[match.winner].wins++;
    championsState.teamStats[match.winner].points += 3;
  }
  if (championsState.teamStats[match.loser]) {
    championsState.teamStats[match.loser].losses++;
  }
  
  // Save career
  saveCareer(activeSave);
  log(`✅ Saved to Champions: ${match.winner} won match ${matchId}`);
  
  // Show return button
  showReturnButton();
}

function saveKickoffResult(result) {
  let kickoffState = JSON.parse(localStorage.getItem('kickoffState'));
  if (kickoffState && kickoffState.matches) {
    const matchIndex = kickoffState.matches.findIndex(m => m.id === matchId);
    if (matchIndex !== -1) {
      kickoffState.matches[matchIndex].winner = result.winner.name;
      try {
        localStorage.setItem('kickoffState', JSON.stringify(kickoffState));
      } catch (e) {
        console.warn("simulateMatch: localStorage quota exceeded", e);
      }
      log(`Updated kickoff state: ${result.winner.name} won match ${matchId}`);
      showReturnButton();
    }
  }
}

function showReturnButton() {
  const backButton = document.querySelector('button[onclick="window.location=\'index.html\'"]');
  if (backButton && context === 'champions') {
    backButton.textContent = 'Back to Champions';
    backButton.onclick = () => window.location.href = 'champions.html';
  }
}

window.simulateMatch = simulateMatch;

