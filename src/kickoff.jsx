import { teams, getTeamByName } from './teams.js';
import { loadCareer, getKickoffState, saveKickoffState } from "./career_local_storage.jsx";
import { getTeamsWithPlayers } from './players.js';

const championTeams = ["LOUD", "Fnatic", "Edward Gaming", "Paper Rex"];

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
  const simulateButton = document.createElement('button');
  simulateButton.textContent = 'Simulate';
  simulateButton.className = 'simulate-button';
  simulateButton.onclick = function() { kickoffWatchSeries(id, actualTeam1Name, actualTeam2Name, bestOf, isGrandFinal); };
  box.appendChild(simulateButton);

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.className = 'play-button';
  playButton.onclick = function() {
    const formattedTeam1Name = actualTeam1Name.toLowerCase().replace(/ /g, '_');
    const formattedTeam2Name = actualTeam2Name.toLowerCase().replace(/ /g, '_');

    window.location.href = `match_simulation.html?team1=${encodeURIComponent(formattedTeam1Name)}&team2=${encodeURIComponent(formattedTeam2Name)}&matchId=${encodeURIComponent(id)}&bestOf=${bestOf}`;
  };
  box.appendChild(playButton);

  return box;
}

// New function to create a team element with player info
function createTeamElement(team, playerTeam, score = null) {
  const teamDiv = document.createElement('div');
  teamDiv.className = 'team-element';

  let teamName;
  let normalizedTeamName;

  if (typeof team === 'string') {
    // If team is a string, try to get the team object
    const teamObject = getTeamByName(team);
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

  // Lower Bracket Final
  if (st.lbFinal) {
    lowerBracketEl.appendChild(createRound('LB Final', st.lbFinal, st, playerTeam));
  }
}

// Initial render when the page loads
export function renderKickoff(st) {
  try {
    const activeSave = loadCareer();
    const playerTeam = activeSave ? activeSave.team : 'TBD';

    // If no series data exists, or if a new bracket needs to be generated, initialize the bracket
    if (!st.series || Object.keys(st.series).length === 0 || st.dirty || !st.playInRound1 || st.playInRound1.length === 0 || !st.ubRound1 || st.ubRound1.length === 0) {
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

      st.lbFinal = [
        { id: 'K-LBF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
      ];

      st.grandFinal = [
        { id: 'K-GF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
      ];
      saveKickoffState(st);
    }

    // Check for completed matches in local storage and update state
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('matchResult_')) {
            const matchResult = JSON.parse(localStorage.getItem(key));
            if (st.series[matchResult.id]) {
                st.series[matchResult.id].winner = matchResult.winner;
                st.series[matchResult.id].score = matchResult.score;
                // Clear the local storage item after applying it to the state
                localStorage.removeItem(key);
            }
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

    // LB Round 3 winners feed into LB Final
    if (st.lbRound3) {
        st.lbFinal[0].team1 = st.series['K-LB3-M1']?.winner || st.lbFinal[0].team1;
        st.lbFinal[0].team2 = st.series['K-LB3-M2']?.winner || st.lbFinal[0].team2;
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

    saveKickoffState(st);

  } catch (error) {
    console.error('Error rendering kickoff bracket:', error);
  }
}



function simulateMatch(team1, team2, bestOf) {
  let team1Score = 0;
  let team2Score = 0;
  let gamesToWin = Math.ceil(bestOf / 2);

  while (team1Score < gamesToWin && team2Score < gamesToWin) {
    if (Math.random() < 0.5) {
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

  const st = getKickoffState();
    const activeSave = loadCareer();
    if (activeSave && activeSave.team) {
      dataU.playerTeam = activeSave.team;
    }
  st.series[id] = { winner: winner, loser: loser, score: score };
  localStorage.setItem("valorantKickoffState", JSON.stringify(st));
  renderKickoff(st); // Re-render the bracket after a match is simulated
}


// Listen for messages from the parent window (e.g., from the React app)
window.addEventListener('message', (event) => {
  // Ensure the message is from a trusted origin if deployed in production
  // if (event.origin !== "http://localhost:3002") return; // Example origin check

  if (event.data === 'rerenderKickoff') {
    console.log('Received rerenderKickoff message, re-rendering kickoff bracket.');
    const storedState = localStorage.getItem("valorantKickoffState");
    const st = storedState ? JSON.parse(storedState) : { series: {} };
    renderKickoff(st);
  }
});

// Initial render when the page loads
const storedState = localStorage.getItem("valorantKickoffState");
const st = storedState ? JSON.parse(storedState) : { series: {} };
renderKickoff(st);


