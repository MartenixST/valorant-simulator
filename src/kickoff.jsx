import { teams } from './teams.js';
import { loadCareer, getKickoffState, saveKickoffState, getSafeTeamByName } from "./career_local_storage.jsx";
import { getTeamsWithPlayers } from './players.js';

const championTeams = ["LOUD", "Fnatic", "Edward Gaming", "Paper Rex"];

const mapPool = [
  'Abyss',
  'Bind',
  'Corrode',
  'Haven',
  'Pearl',
  'Split',
  'Sunset',
];

let dataU = {
  playerTeam: "TBD"
};

function getRandomTeam(excludeTeams = [], region = null) {
  const excludedTeamNames = excludeTeams.filter(t => typeof t === 'object' && t !== null && t.name).map(t => t.name);
  let availableTeams = teams.filter(team => !excludedTeamNames.includes(team.name));
  if (region) {
    availableTeams = availableTeams.filter(team => team.region === region);
  }
  return availableTeams[Math.floor(Math.random() * availableTeams.length)];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function simpleTeamEl(teamName, playerTeam) {
  const div = document.createElement('div');
  div.className = 'team-slot';

  const teamLogo = document.createElement('img');
  teamLogo.className = 'team-logo';
  const actualTeamName = typeof teamName === 'object' ? teamName.name : teamName;
  teamLogo.src = `assets/team_logos/${actualTeamName.toLowerCase().replace(/ /g, '_')}.png`;
  teamLogo.alt = `${actualTeamName} Logo`;
  teamLogo.onerror = function() {
    this.onerror=null;
    this.src='assets/team_logos/default.png'; // Fallback image
  };
  div.appendChild(teamLogo);

  const teamNameSpan = document.createElement('span');
  teamNameSpan.textContent = actualTeamName;
  div.appendChild(teamNameSpan);

  if (teamName === playerTeam) div.classList.add('my-team');
  return div;
}

function simpleControls(id, team1, team2, bestOf, series, isGrandFinal) {
  const container = document.createElement('div');
  container.className = 'match-controls';

  const simBtn = document.createElement('button');
  simBtn.textContent = 'Play/Sim';
  simBtn.onclick = function() { kickoffWatchSeries(id, team1, team2, bestOf, isGrandFinal); };
  container.appendChild(simBtn);

  return { container: container };
}

function createMatchBox(team1, team2, winner, playerTeam, id, bestOf, isGrandFinal, score) {
  const actualTeam1Name = typeof team1 === 'object' ? team1.name : team1;
  const actualTeam2Name = typeof team2 === 'object' ? team2.name : team2;

  const box = document.createElement('div');
  box.className = 'match';
  box.dataset.matchId = id; // Add data-match-id attribute
  
  let team1Score = null;
  let team2Score = null;

  if (score) {
    const scores = score.split('-');
    if (scores.length === 2) {
      team1Score = scores[0].trim();
      team2Score = scores[1].trim();
    }
  }

  // Create team elements with player info
  const team1El = createTeamElement(team1, playerTeam, team1Score);
  const team2El = createTeamElement(team2, playerTeam, team2Score);
  
  box.appendChild(team1El);
  box.appendChild(team2El);
  
  const winnerEl = document.createElement('div');
  winnerEl.className = 'match-winner';
  winnerEl.textContent = winner || 'TBD'; // Ensure winner is displayed, or TBD if not available
  box.appendChild(winnerEl);

  // Remove the old score display
  // if (score) {
  //   const scoreEl = document.createElement('div');
  //   scoreEl.className = 'match-score';
  //   scoreEl.textContent = score;
  //   box.appendChild(scoreEl);
  // }

  // Add Simulate and Play buttons
  const isLocked = actualTeam1Name === 'TBD' || actualTeam2Name === 'TBD';
  const hasFinished = score !== null;

  const simulateButton = document.createElement('button');
  simulateButton.textContent = 'Simulate';
  simulateButton.className = 'simulate-button';
  if (isLocked || hasFinished) simulateButton.disabled = true;
  simulateButton.onclick = function() { kickoffWatchSeries(id, actualTeam1Name, actualTeam2Name, bestOf, isGrandFinal); };
  box.appendChild(simulateButton);

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.className = 'play-button';
  if (isLocked || hasFinished) playButton.disabled = true;
  playButton.onclick = function() {
    const formattedTeam1Name = actualTeam1Name.toLowerCase().replace(/ /g, '_');
    const formattedTeam2Name = actualTeam2Name.toLowerCase().replace(/ /g, '_');

    window.location.href = `match_simulation.html?team1=${encodeURIComponent(formattedTeam1Name)}&team2=${encodeURIComponent(formattedTeam2Name)}&matchId=${encodeURIComponent(id)}&bestOf=${bestOf}&playerTeam=${encodeURIComponent(playerTeam)}`;
  };
  box.appendChild(playButton);

  // Add Stats button if result exists
  if (score !== null) {
      const statsButton = document.createElement('button');
      statsButton.textContent = 'Stats';
      statsButton.className = 'stats-button';
      statsButton.onclick = function() {
          showMatchStats(id);
      };
      box.appendChild(statsButton);
  }

  return box;
}

function showMatchStats(matchId) {
    const activeSaveId = localStorage.getItem('activeSaveId');
    const st = getKickoffState(activeSaveId);
    const matchData = st.series[matchId];
    
    if (!matchData || !matchData.playerStats) {
        alert("No stats available for this match.");
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'stats-modal';
    
    const content = document.createElement('div');
    content.className = 'stats-modal-content';
    
    const header = document.createElement('div');
    header.className = 'stats-modal-header';
    header.innerHTML = `
        <div class="stats-header-top">
            <h2>Match Statistics</h2>
            <button class="close-stats">&times;</button>
        </div>
        <div class="match-summary-banner">
            <div class="summary-team">
                <span class="team-name">${matchData.team1Name}</span>
                <span class="team-score">${matchData.team1Score}</span>
            </div>
            <div class="summary-vs">VS</div>
            <div class="summary-team">
                <span class="team-score">${matchData.team2Score}</span>
                <span class="team-name">${matchData.team2Name}</span>
            </div>
        </div>
        <div class="stats-tabs">
            <button class="tab-btn active" data-tab="all">All Maps</button>
            ${matchData.mapResults ? matchData.mapResults.map((m, idx) => `
                <button class="tab-btn" data-tab="map-${idx}">${m.mapName}</button>
            `).join('') : ''}
        </div>
    `;
    content.appendChild(header);

    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    
    const renderTeamStats = (teamName, teamId, players, rounds = 24) => {
        const teamHeader = document.createElement('div');
        teamHeader.className = 'team-stats-header';
        
        // Try to get team logo
        const normalizedName = teamName.toLowerCase().replace(/ /g, '_');
        const logoSrc = `assets/team_logos/${normalizedName}.png`;
        
        teamHeader.innerHTML = `
            <div class="team-header-content">
                <img src="${logoSrc}" class="team-logo-small" onerror="this.src='assets/team_logos/default.png'">
                <h3>${teamName}</h3>
            </div>
        `;
        statsContainer.appendChild(teamHeader);

        const statsTable = document.createElement('table');
        statsTable.className = 'stats-table';
        statsTable.innerHTML = `
            <thead>
                <tr>
                    <th>Player</th>
                    <th class="text-center">K</th>
                    <th class="text-center">D</th>
                    <th class="text-center">A</th>
                    <th class="text-center">HS%</th>
                    <th class="text-center">ADR</th>
                </tr>
            </thead>
            <tbody>
                ${players.sort((a, b) => b.kills - a.kills).map(p => {
                    const hsPercent = p.kills > 0 ? Math.round((p.hs / p.kills) * 100) : 0;
                    return `
                        <tr>
                            <td class="player-name-cell">${p.name}</td>
                            <td class="stat-k text-center">${p.kills}</td>
                            <td class="stat-d text-center">${p.deaths}</td>
                            <td class="stat-a text-center">${p.assists}</td>
                            <td class="stat-hs text-center">${hsPercent}%</td>
                            <td class="stat-adr text-center">${Math.round(p.damage / rounds)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        statsContainer.appendChild(statsTable);
    };

    const updateStatsDisplay = (tab) => {
        statsContainer.innerHTML = '';
        let statsToShow = matchData.playerStats;
        let rounds = 0;
        
        if (tab === 'all') {
            // For all maps, sum up rounds from all mapResults
            if (matchData.mapResults && matchData.mapResults.length > 0) {
                matchData.mapResults.forEach(m => {
                    const scores = m.score.split('-');
                    rounds += parseInt(scores[0]) + parseInt(scores[1]);
                });
            } else {
                // If mapResults is empty (shouldn't happen for finished matches), estimate
                rounds = 24; 
            }
        } else {
            const mapIndex = parseInt(tab.split('-')[1]);
            if (matchData.mapResults && matchData.mapResults[mapIndex]) {
                const mapData = matchData.mapResults[mapIndex];
                statsToShow = mapData.playerStats;
                const scores = mapData.score.split('-');
                rounds = parseInt(scores[0]) + parseInt(scores[1]);
            }
        }

        if (rounds === 0) rounds = 24;

        // Ensure we have arrays of players
        const allPlayers = Object.values(statsToShow);
        const team1Players = allPlayers.filter(p => p.teamName === matchData.team1Name || p.teamId === matchData.team1Id);
        const team2Players = allPlayers.filter(p => p.teamName === matchData.team2Name || p.teamId === matchData.team2Id);

        if (team1Players.length > 0) {
            renderTeamStats(matchData.team1Name, matchData.team1Id, team1Players, rounds);
        }
        
        if (team2Players.length > 0) {
            renderTeamStats(matchData.team2Name, matchData.team2Id, team2Players, rounds);
        }

        // Fallback if filtering failed
        if (team1Players.length === 0 && team2Players.length === 0 && allPlayers.length > 0) {
            renderTeamStats("Players", null, allPlayers, rounds);
        }
    };

    content.appendChild(statsContainer);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Initial display
    updateStatsDisplay('all');

    // Tab switching
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateStatsDisplay(btn.dataset.tab);
        };
    });

    modal.querySelector('.close-stats').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// New function to create a team element with player info
function createTeamElement(team, playerTeam, score = null) {
  const teamDiv = document.createElement('div');
  teamDiv.className = 'team-element';

  let teamName;
  let normalizedTeamName;

  if (typeof team === 'string') {
    // If team is a string, try to get the team object
    const teamObject = getSafeTeamByName(team);
    if (teamObject) {
      teamName = teamObject.name;
      normalizedTeamName = teamObject.name.toLowerCase().replace(/ /g, '_');
    } else {
      // If not a valid team name string or teamObject is null/undefined, treat as TBD
      teamName = 'TBD';
      normalizedTeamName = 'tbd'; // Use a placeholder for the logo
    }
  } else if (typeof team === 'object' && team !== null) {
    teamName = team.name;
    normalizedTeamName = team.name.toLowerCase().replace(/ /g, '_');
  } else {
    teamName = 'TBD';
    normalizedTeamName = 'tbd';
  }

  // Add team logo
  const teamLogo = document.createElement('img');
  teamLogo.className = 'team-logo';
  if (teamName === 'TBD') {
    teamLogo.src = 'assets/team_logos/default.png';
  } else {
    teamLogo.src = `assets/team_logos/${normalizedTeamName}.png`;
  }
  console.log('createTeamElement: teamLogo.src =', teamLogo.src);
  teamLogo.alt = `${teamName} Logo`;
  teamLogo.onerror = function() {
    this.onerror=null;
    this.src='assets/team_logos/default.png'; // Fallback image
  };
  teamDiv.appendChild(teamLogo);

  // Add team name
  const teamNameSpan = document.createElement('span');
  teamNameSpan.textContent = teamName;
  teamDiv.appendChild(teamNameSpan);

  // Add score if available
  if (score !== null) {
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'team-score';
    scoreSpan.textContent = ` (${score})`;
    teamDiv.appendChild(scoreSpan);
  }
  
  // Add player info if team is an object with players
  if (typeof team === 'object' && team.players && false) { // Temporarily disable player button for kickoff
    const playersButton = document.createElement('button');
    playersButton.className = 'players-button';
    playersButton.textContent = 'View Players';
    playersButton.onclick = function(e) {
      e.stopPropagation();
      showTeamPlayers(team);
    };
    teamDiv.appendChild(playersButton);
  }
  
  if (teamName === playerTeam) teamDiv.classList.add('my-team');
  return teamDiv;
}



// Function to show team players in a modal (removed for kickoff page)
// function showTeamPlayers(team) {
//   // Check if modal already exists, remove if it does
//   const existingModal = document.getElementById('players-modal');
//   if (existingModal) {
//     existingModal.remove();
//   }
  
//   // Create modal container
//   const modal = document.createElement('div');
//   modal.id = 'players-modal';
//   modal.className = 'players-modal';
  
//   // Create modal content
//   const modalContent = document.createElement('div');
//   modalContent.className = 'modal-content';
  
//   // Add team header
//   const teamHeader = document.createElement('div');
//   teamHeader.className = 'team-header';
  
//   const teamLogo = document.createElement('img');
//   teamLogo.src = `assets/team_logos/${team.name.toLowerCase().replace(/ /g, '_')}.png`;
//   teamLogo.alt = `${team.name} Logo`;
//   teamLogo.className = 'team-logo';
//   teamHeader.appendChild(teamLogo);
  
//   const teamName = document.createElement('h3');
//   teamName.textContent = team.name;
//   teamHeader.appendChild(teamName);
  
//   modalContent.appendChild(teamHeader);
  
//   // Add team stats
//   const teamStats = document.createElement('div');
//   teamStats.className = 'team-stats';
//   teamStats.innerHTML = `
//     <p><strong>Power:</strong> ${team.power}</p>
//     <p><strong>Potential:</strong> ${team.potential}</p>
//     <p><strong>Region:</strong> ${team.region}</p>
//   `;
//   modalContent.appendChild(teamStats);
  
//   // Add players list
//   const playersList = document.createElement('div');
//   playersList.className = 'players-list';
  
//   team.players.forEach(player => {
//     const playerDiv = document.createElement('div');
//     playerDiv.className = 'player-card';
    
//     const playerName = document.createElement('h4');
//     playerName.textContent = player.name;
//     playerDiv.appendChild(playerName);
    
//     const playerDetails = document.createElement('div');
//     playerDetails.className = 'player-details';
//     playerDetails.innerHTML = `
//       <p><strong>Role:</strong> ${player.role}</p>
//       <p><strong>Nationality:</strong> ${player.nationality}</p>
//       <p><strong>Skill:</strong> ${player.skill}</p>
//       <p><strong>Potential:</strong> ${player.potential}</p>
//       <p><strong>Age:</strong> ${player.age}</p>
//     `;
//     playerDiv.appendChild(playerDetails);
    
//     playersList.appendChild(playerDiv);
//   });
  
//   modalContent.appendChild(playersList);
  
//   // Add close button
//   const closeButton = document.createElement('button');
//   closeButton.className = 'close-button';
//   closeButton.textContent = 'Close';
//   closeButton.onclick = function() {
//     modal.remove();
//   };
//   modalContent.appendChild(closeButton);
  
//   modal.appendChild(modalContent);
//   document.body.appendChild(modal);
// }



function createMatchElement(match, series, playerTeam) {
  const matchContainer = document.createElement('div');
  matchContainer.className = 'match-container';

  const matchBox = createMatchBox(match[0], match[1], series[match[2]] ? series[match[2]].winner : 'TBD', playerTeam, match[2], match[3], match[4], series[match[2]] ? series[match[2]].score : null);
  matchContainer.appendChild(matchBox);

  const matchControls = simpleControls(match[2], match[0], match[1], match[3], series, match[4]);
  matchContainer.appendChild(matchControls.container);

  return matchContainer;
}

function createRound(roundName, matches, st, playerTeam, isHorizontal = false) {
  const roundDiv = document.createElement('div');
  roundDiv.className = `round ${isHorizontal ? 'round-horizontal' : ''}`;
  const roundTitle = document.createElement('h4');
  roundTitle.textContent = roundName;
  roundDiv.appendChild(roundTitle);

  const matchesContainer = document.createElement('div');
  matchesContainer.className = isHorizontal ? 'matches-horizontal' : 'matches-vertical';

  matches.forEach(match => {
    matchesContainer.appendChild(createMatchBox(match.team1, match.team2, st.series[match.id] ? st.series[match.id].winner : 'TBD', playerTeam, match.id, match.bestOf, match.isGrandFinal, st.series[match.id] ? st.series[match.id].score : null));
  });
  
  roundDiv.appendChild(matchesContainer);
  return roundDiv;
}

function renderKickoffUpper(st) {
  const upperBracketEl = document.getElementById('kickoffUpperBracket');
  if (!upperBracketEl) return;
  upperBracketEl.innerHTML = ''; // Clear previous content

  const activeSave = loadCareer();
  const playerTeam = activeSave ? activeSave.team : 'TBD';

  // Play-ins
  if (st.playIns) {
    upperBracketEl.appendChild(createRound('Play-ins', st.playIns, st, playerTeam));
  }

  // Upper Bracket Round 1
  if (st.ubRound1) {
    upperBracketEl.appendChild(createRound('UB Round 1', st.ubRound1, st, playerTeam));
  }

  // Upper Bracket Round 2
  if (st.ubRound2) {
    upperBracketEl.appendChild(createRound('UB Round 2', st.ubRound2, st, playerTeam));
  }

  // Upper Bracket Final
  if (st.ubFinal) {
    upperBracketEl.appendChild(createRound('UB Final', st.ubFinal, st, playerTeam));
  }
}

function renderKickoffLower(st) {
  const lowerBracketEl = document.getElementById('kickoffLowerBracket');
  if (!lowerBracketEl) return;
  lowerBracketEl.innerHTML = ''; // Clear previous content

  const activeSave = loadCareer();
  const playerTeam = activeSave ? activeSave.team : 'TBD';

  // Lower Bracket Round 1
  if (st.lbRound1) {
    lowerBracketEl.appendChild(createRound('LB Round 1', st.lbRound1, st, playerTeam));
  }

  // Lower Bracket Round 2
  if (st.lbRound2) {
    lowerBracketEl.appendChild(createRound('LB Round 2', st.lbRound2, st, playerTeam));
  }

  // Lower Bracket Round 3
  if (st.lbRound3) {
    lowerBracketEl.appendChild(createRound('LB Round 3', st.lbRound3, st, playerTeam));
  }

  // Lower Bracket Round 4
  if (st.lbRound4) {
    lowerBracketEl.appendChild(createRound('LB Semi-Final', st.lbRound4, st, playerTeam));
  }

  // Lower Bracket Final
  if (st.lbFinal) {
    lowerBracketEl.appendChild(createRound('LB Final', st.lbFinal, st, playerTeam));
  }
}

// Initial render when the page loads
export function renderKickoff(st) {
  try {
    const activeSave = loadCareer();
    const activeSaveId = localStorage.getItem('activeSaveId');
    const playerTeam = activeSave ? activeSave.team : 'TBD';

    // If no series data exists, or if a new bracket needs to be generated, initialize the bracket
    if (!st || st.dirty || !st.playInRound1 || st.playInRound1.length === 0 || !st.ubRound1 || st.ubRound1.length === 0 || !st.lbRound4 || st.lbRound4.length === 0) {
      console.log('Initializing new bracket with byes...');
      let initialUsedTeams = []; // Start with an empty array of used teams

      // Select 4 teams for byes (placeholder for champion teams)
      const byeTeams = [];
      for (let i = 0; i < 4; i++) {
          let team = getRandomTeam(initialUsedTeams, "Americas"); // Get a unique team
          byeTeams.push(team);
          initialUsedTeams.push(team);
      }

      // Initialize play-in matches (Round 1 for 8 teams)
      st.playInRound1 = [
        { id: 'K-P1-M1', team1: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), team2: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M2', team1: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), team2: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M3', team1: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), team2: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M4', team1: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), team2: (() => { let team = getRandomTeam(initialUsedTeams, "Americas"); initialUsedTeams.push(team); return team; })(), winner: null, bestOf: 3, isGrandFinal: false },
      ];

      // Initialize upper bracket Round 1 (where bye teams join)
      st.ubRound1 = [
          { id: 'K-UB1-M1', team1: byeTeams[0], team2: st.series['K-P1-M1']?.winner || '', winner: null, bestOf: 3, isGrandFinal: false }, // Bye team vs Winner of K-P1-M1
          { id: 'K-UB1-M2', team1: byeTeams[1], team2: st.series['K-P1-M2']?.winner || '', winner: null, bestOf: 3, isGrandFinal: false }, // Bye team vs Winner of K-P1-M2
          { id: 'K-UB1-M3', team1: byeTeams[2], team2: st.series['K-P1-M3']?.winner || '', winner: null, bestOf: 3, isGrandFinal: false }, // Bye team vs Winner of K-P1-M3
          { id: 'K-UB1-M4', team1: byeTeams[3], team2: st.series['K-P1-M4']?.winner || '', winner: null, bestOf: 3, isGrandFinal: false }, // Bye team vs Winner of K-P1-M4
      ];

      st.ubRound2 = [
        { id: 'K-UB2-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-UB2-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
      ];

      st.ubFinal = [
        { id: 'K-UBF-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
      ];

      // Initialize lower bracket rounds
      st.lbRound1 = [
        { id: 'K-LB1-M1', team1: st.series['K-P1-M1']?.loser || '', team2: st.series['K-UB1-M1']?.loser || '', winner: null, bestOf: 3, isGrandFinal: false }, // Loser of K-P1-M1 vs Loser of K-UB1-M1
        { id: 'K-LB1-M2', team1: st.series['K-P1-M2']?.loser || '', team2: st.series['K-UB1-M2']?.loser || '', winner: null, bestOf: 3, isGrandFinal: false }, // Loser of K-P1-M2 vs Loser of K-UB1-M2
        { id: 'K-LB1-M3', team1: st.series['K-P1-M3']?.loser || '', team2: st.series['K-UB1-M3']?.loser || '', winner: null, bestOf: 3, isGrandFinal: false }, // Loser of K-P1-M3 vs Loser of K-UB1-M3
        { id: 'K-LB1-M4', team1: st.series['K-P1-M4']?.loser || '', team2: st.series['K-UB1-M4']?.loser || '', winner: null, bestOf: 3, isGrandFinal: false }, // Loser of K-P1-M4 vs Loser of K-UB1-M4
      ];

      st.lbRound2 = [
        { id: 'K-LB2-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB2-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
      ];

      st.lbRound3 = [
        { id: 'K-LB3-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB3-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
      ];

      st.lbRound4 = [
        { id: 'K-LB4-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
      ];

      st.lbFinal = [
        { id: 'K-LBF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
      ];

      st.grandFinal = [
        { id: 'K-GF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
      ];
      st.dirty = false;
      saveKickoffState(st, activeSaveId);
    }


    // Check for completed matches in local storage and update state
    const resultKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('matchResult_')) {
            resultKeys.push(key);
        }
    }

    if (resultKeys.length > 0) {
        let stateUpdated = false;
        resultKeys.forEach(key => {
            try {
                const matchResult = JSON.parse(localStorage.getItem(key));
                if (matchResult && matchResult.id && st.series) {
                    // Always update the series with the result
                    st.series[matchResult.id] = {
                        winner: matchResult.winner,
                        loser: matchResult.loser,
                        score: matchResult.score,
                        playerStats: matchResult.playerStats,
                        team1Name: matchResult.team1Name,
                        team2Name: matchResult.team2Name,
                        team1Score: matchResult.team1Score,
                        team2Score: matchResult.team2Score,
                        date: matchResult.date
                    };
                    // Clear the local storage item after applying it to the state
                    localStorage.removeItem(key);
                    stateUpdated = true;
                    console.log(`Applied match result for ${matchResult.id} to kickoff state.`);
                }
            } catch (e) {
                console.error("Error processing match result:", key, e);
            }
        });
        if (stateUpdated) {
            saveKickoffState(st, activeSaveId);
        }
    }

    // Update subsequent matches based on winners/losers
    // Play-in winners feed into UB Round 1
    if (st.playInRound1) {
        st.ubRound1[0].team2 = st.series['K-P1-M1']?.winner || st.ubRound1[0].team2;
        st.ubRound1[1].team2 = st.series['K-P1-M2']?.winner || st.ubRound1[1].team2;
        st.ubRound1[2].team2 = st.series['K-P1-M3']?.winner || st.ubRound1[2].team2;
        st.ubRound1[3].team2 = st.series['K-P1-M4']?.winner || st.ubRound1[3].team2;

        st.lbRound1[0].team1 = st.series['K-P1-M1']?.loser || st.lbRound1[0].team1;
        st.lbRound1[1].team1 = st.series['K-P1-M2']?.loser || st.lbRound1[1].team1;
        st.lbRound1[2].team1 = st.series['K-P1-M3']?.loser || st.lbRound1[2].team1;
        st.lbRound1[3].team1 = st.series['K-P1-M4']?.loser || st.lbRound1[3].team1;
    }

    // UB Round 1 winners feed into UB Round 2, losers feed into LB Round 1
    if (st.ubRound1) {
        st.ubRound2[0].team1 = st.series['K-UB1-M1']?.winner || st.ubRound2[0].team1;
        st.ubRound2[0].team2 = st.series['K-UB1-M2']?.winner || st.ubRound2[0].team2;
        st.ubRound2[1].team1 = st.series['K-UB1-M3']?.winner || st.ubRound2[1].team1;
        st.ubRound2[1].team2 = st.series['K-UB1-M4']?.winner || st.ubRound2[1].team2;

        st.lbRound1[0].team2 = st.series['K-UB1-M1']?.loser || st.lbRound1[0].team2;
        st.lbRound1[1].team2 = st.series['K-UB1-M2']?.loser || st.lbRound1[1].team2;
        st.lbRound1[2].team2 = st.series['K-UB1-M3']?.loser || st.lbRound1[2].team2;
        st.lbRound1[3].team2 = st.series['K-UB1-M4']?.loser || st.lbRound1[3].team2;
    }

    // UB Round 2 winners feed into UB Final, losers feed into LB Round 3
    if (st.ubRound2) {
        st.ubFinal[0].team1 = st.series['K-UB2-M1']?.winner || st.ubFinal[0].team1;
        st.ubFinal[0].team2 = st.series['K-UB2-M2']?.winner || st.ubFinal[0].team2;

        st.lbRound3[0].team2 = st.series['K-UB2-M1']?.loser || st.lbRound3[0].team2;
        st.lbRound3[1].team2 = st.series['K-UB2-M2']?.loser || st.lbRound3[1].team2;
    }

    // LB Round 1 winners feed into LB Round 2
    if (st.lbRound1) {
        st.lbRound2[0].team1 = st.series['K-LB1-M1']?.winner || st.lbRound2[0].team1;
        st.lbRound2[0].team2 = st.series['K-LB1-M2']?.winner || st.lbRound2[0].team2;
        st.lbRound2[1].team1 = st.series['K-LB1-M3']?.winner || st.lbRound2[1].team1;
        st.lbRound2[1].team2 = st.series['K-LB1-M4']?.winner || st.lbRound2[1].team2;
    }

    // LB Round 2 winners feed into LB Round 3
    if (st.lbRound2) {
        st.lbRound3[0].team1 = st.series['K-LB2-M1']?.winner || st.lbRound3[0].team1;
        st.lbRound3[1].team1 = st.series['K-LB2-M2']?.winner || st.lbRound3[1].team1;
    }

    // LB Round 3 winners feed into LB Round 4
    if (st.lbRound3) {
        st.lbRound4[0].team1 = st.series['K-LB3-M1']?.winner || st.lbRound4[0].team1;
        st.lbRound4[0].team2 = st.series['K-LB3-M2']?.winner || st.lbRound4[0].team2;
    }

    // LB Round 4 winner and UB Final loser feed into LB Final
    if (st.lbRound4 && st.ubFinal) {
        st.lbFinal[0].team1 = st.series['K-LB4-M1']?.winner || st.lbFinal[0].team1;
        st.lbFinal[0].team2 = st.series['K-UBF-M1']?.loser || st.lbFinal[0].team2;
    }

    // UB Final winner and LB Final winner feed into Grand Final
    if (st.ubFinal && st.lbFinal) {
        st.grandFinal[0].team1 = st.series['K-UBF-M1']?.winner || st.grandFinal[0].team1;
        st.grandFinal[0].team2 = st.series['K-LBF']?.winner || st.grandFinal[0].team2;
    }

    // Render Play-in Round 1
    const playInBracketEl = document.getElementById('kickoffPlayInBracket');
    if (playInBracketEl) {
      playInBracketEl.innerHTML = ''; // Clear previous content
      playInBracketEl.appendChild(createRound('Play-in Round 1', st.playInRound1, st, playerTeam, true));
    }

    // Render Upper Bracket
    const kickoffUpperBracketEl = document.getElementById('kickoffUpperBracket');
    if (kickoffUpperBracketEl) {
      kickoffUpperBracketEl.innerHTML = ''; // Clear previous content
      renderKickoffUpper(st);
    }

    // Render Lower Bracket
    const kickoffLowerBracketEl = document.getElementById('kickoffLowerBracket');
    if (kickoffLowerBracketEl) {
      kickoffLowerBracketEl.innerHTML = ''; // Clear previous content
      renderKickoffLower(st);
    }

    // Render Grand Final
    const kickoffGrandFinalEl = document.getElementById('kickoffGrandFinalBracket');
    if (kickoffGrandFinalEl) {
      kickoffGrandFinalEl.innerHTML = ''; // Clear previous content
      kickoffGrandFinalEl.appendChild(createRound('Grand Final', st.grandFinal, st, playerTeam));
    }

    console.log('Kickoff bracket rendering complete.');

    saveKickoffState(st, activeSaveId);

  } catch (error) {
    console.error('Error rendering kickoff bracket:', error);
  }
}



function simulateMatch(team1, team2, bestOf) {
  const team1Obj = getSafeTeamByName(team1);
  const team2Obj = getSafeTeamByName(team2);

  // Calculate team power based on player overall ratings
  const getPower = (teamObj) => {
    if (!teamObj || !teamObj.players || teamObj.players.length === 0) {
      // Fallback to global team power if no players found
      const globalTeam = teams.find(t => t.name === (teamObj ? teamObj.name : ''));
      return globalTeam ? globalTeam.power : 50;
    }
    const sum = teamObj.players.reduce((acc, p) => {
      // Robust overall rating detection
      let ovr = 70;
      if (typeof p.overall === 'number') ovr = p.overall;
      else if (p.rating && typeof p.rating.overall === 'number') ovr = p.rating.overall;
      else if (p.ratings && typeof p.ratings.overall === 'number') ovr = p.ratings.overall;
      return acc + ovr;
    }, 0);
    return sum / teamObj.players.length;
  };

  const p1 = getPower(team1Obj);
  const p2 = getPower(team2Obj);
  
  // Calculate win probability using a simple Elo-like formula or just relative power
  // We'll use a slightly weighted probability to favor the stronger team
  const winChance1 = p1 / (p1 + p2);

  let team1Score = 0;
  let team2Score = 0;
  let gamesToWin = Math.ceil(bestOf / 2);

  while (team1Score < gamesToWin && team2Score < gamesToWin) {
    if (Math.random() < winChance1) {
      team1Score++;
    } else {
      team2Score++;
    }
  }

  let winner, loser;
  if (team1Score > team2Score) {
    winner = team1;
    loser = team2;
  } else {
    winner = team2;
    loser = team1;
  }
  return { winner, loser, score: `${team1Score}-${team2Score}` };
}

function kickoffWatchSeries(id, team1, team2, bestOf, isGrandFinal) {
  console.log(`Watching series: ${team1} vs ${team2}`);
  // Simulate match outcome
  const { winner, loser, score } = simulateMatch(team1, team2, bestOf);

  // Generate fake stats for simulated match so we can still see them
  const team1Obj = getSafeTeamByName(team1);
  const team2Obj = getSafeTeamByName(team2);
  const playerStats = {};

  const generateStats = (roster, tId, tName) => {
    roster.forEach(p => {
        let ovr = 75;
        if (typeof p.overall === 'number') ovr = p.overall;
        else if (p.rating && typeof p.rating.overall === 'number') ovr = p.rating.overall;
        else if (p.ratings && typeof p.ratings.overall === 'number') ovr = p.ratings.overall;

        playerStats[p.id || p.name] = {
            name: p.name,
            teamId: tId,
            teamName: tName,
            overall: ovr,
            kills: Math.floor(Math.random() * 25) + 10,
            deaths: Math.floor(Math.random() * 20) + 10,
            assists: Math.floor(Math.random() * 10) + 2,
            hs: Math.floor(Math.random() * 30) + 10,
            damage: Math.floor(Math.random() * 3000) + 1000
        };
    });
  };

  if (team1Obj && team1Obj.players) generateStats(team1Obj.players, team1Obj.id, team1Obj.name);
  if (team2Obj && team2Obj.players) generateStats(team2Obj.players, team2Obj.id, team2Obj.name);

  // Generate fake map results for simulation
  const mapResults = [];
  const scoreParts = score.split('-');
  const t1Wins = parseInt(scoreParts[0]);
  const t2Wins = parseInt(scoreParts[1]);
  const totalMaps = t1Wins + t2Wins;
  
  const maps = shuffleArray([...mapPool]).slice(0, totalMaps);
  
  for (let i = 0; i < totalMaps; i++) {
      const mapPlayerStats = {};
      const allPlayers = [...(team1Obj?.players || []), ...(team2Obj?.players || [])];
      
      allPlayers.forEach(p => {
          mapPlayerStats[p.id || p.name] = {
              name: p.name,
              teamId: p.teamId || (team1Obj?.players?.some(tp => tp.id === p.id) ? team1Obj.id : team2Obj?.id),
              teamName: p.teamName || (team1Obj?.players?.some(tp => tp.id === p.id) ? team1Obj.name : team2Obj?.name),
              kills: Math.floor(Math.random() * 20) + 5,
              deaths: Math.floor(Math.random() * 15) + 5,
              assists: Math.floor(Math.random() * 8) + 1,
              hs: Math.floor(Math.random() * 30) + 10,
              damage: Math.floor(Math.random() * 2500) + 500
          };
      });

      mapResults.push({
          mapName: maps[i],
          winner: i < t1Wins ? team1 : team2, // Simple logic: first X maps to T1, rest to T2
          score: "13-10",
          playerStats: mapPlayerStats
      });
  }

  const activeSaveId = localStorage.getItem('activeSaveId');
  const st = getKickoffState(activeSaveId);
    const activeSave = loadCareer();
    if (activeSave && activeSave.team) {
      dataU.playerTeam = activeSave.team;
    }
  
  st.series[id] = { 
    winner: winner, 
    loser: loser, 
    score: score,
    playerStats: playerStats,
    mapResults: mapResults,
    team1Name: team1,
    team2Name: team2,
    team1Id: team1Obj?.id,
    team2Id: team2Obj?.id,
    team1Score: t1Wins,
    team2Score: t2Wins,
    date: new Date().toISOString()
  };
  saveKickoffState(st, activeSaveId);
  
  // Update browser storage to trigger a sync (in case other components are listening)
  localStorage.setItem('rerenderKickoff', Date.now());
  
  // Re-run the bracket logic immediately to move winners to next round
  renderKickoff(st); 
}


// Initial render logic and message listeners are now handled in kickoff_entry.jsx


