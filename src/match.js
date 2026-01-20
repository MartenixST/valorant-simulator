import { Player, Team, RoundSimulator, MatchSimulator } from './simulation.js';

let team1 = null;
let team2 = null;
let matchId = null;
let logEl = null;

function log(msg) {
  if (logEl) {
    logEl.innerHTML += `<p>${msg}</p>`;
    logEl.scrollTop = logEl.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  logEl = document.getElementById("match-log");
  const urlParams = new URLSearchParams(window.location.search);
  const team1Data = urlParams.get('team1');
  const team2Data = urlParams.get('team2');
  matchId = urlParams.get('matchId');

  if (team1Data && team2Data) {
    team1 = new Team(team1.name, team1.players.map(p => new Player(p.name, p.role, p.rating, p.weapon, p.shield, p.money, p.stats)));
    team2 = new Team(team2.name, team2.players.map(p => new Player(p.name, p.role, p.rating, p.weapon, p.shield, p.money, p.stats)));

    document.getElementById('team1-name').textContent = team1.name;
    document.getElementById('team2-name').textContent = team2.name;
  } else {
    log("Error: Team data not found.");
  }
});

// --- Match Simulation ---
export function simulateMatch() {
  if (!team1 || !team2) {
    log("Cannot simulate match: Team data missing.");
    return;
  }

  logEl.innerHTML = "";
  log(`Starting match: ${team1.name} vs ${team2.name}`);

  const matchSimulator = new MatchSimulator(team1, team2);
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

  // Update kickoff state
  if (matchId) {
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
      }
    }
  }
}

window.simulateMatch = simulateMatch;

