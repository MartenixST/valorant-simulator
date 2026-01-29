import { teams } from './teams.js';
import { loadCareer, saveCareer, getSafeTeamByName } from "./career_local_storage.jsx";
import { Player, Team, MatchSimulator } from './simulation.js';

const mapPool = ['Abyss', 'Bind', 'Corrode', 'Haven', 'Pearl', 'Split', 'Sunset'];

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createTeamElement(team, playerTeam, score = null) {
  const teamDiv = document.createElement('div');
  teamDiv.className = 'team-element';

  let teamName = 'TBD';
  if (typeof team === 'string') teamName = team;
  else if (team && team.name) teamName = team.name;

  const teamLogo = document.createElement('img');
  teamLogo.className = 'team-logo';
  const normalizedPath = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
  
  teamLogo.src = teamName === 'TBD' ? 'assets/qmark.png' : `assets/team_logos/${normalizedPath}.png`;
  teamLogo.onerror = function() { this.src = 'assets/qmark.png'; };
  teamDiv.appendChild(teamLogo);

  const teamNameSpan = document.createElement('span');
  teamNameSpan.textContent = teamName;
  teamDiv.appendChild(teamNameSpan);

  if (score !== null) {
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'team-score';
    scoreSpan.textContent = ` (${score})`;
    teamDiv.appendChild(scoreSpan);
  }

  if (teamName === playerTeam) teamDiv.classList.add('my-team');
  return teamDiv;
}

function createMatchBox(team1, team2, winner, playerTeam, id, bestOf, isGrandFinal, score) {
  const box = document.createElement('div');
  box.className = 'match';
  
  let t1Score = null, t2Score = null;
  if (score) {
    const scores = score.split('-');
    if (scores.length === 2) { t1Score = scores[0]; t2Score = scores[1]; }
  }

  box.appendChild(createTeamElement(team1, playerTeam, t1Score));
  box.appendChild(createTeamElement(team2, playerTeam, t2Score));
  
  const winnerEl = document.createElement('div');
  winnerEl.className = 'match-winner';
  winnerEl.textContent = winner || 'TBD';
  box.appendChild(winnerEl);

  const isLocked = !team1 || team1 === 'TBD' || !team2 || team2 === 'TBD';
  const hasFinished = !!score;

  const simBtn = document.createElement('button');
  simBtn.textContent = 'Simulate';
  simBtn.className = 'simulate-button';
  if (isLocked || hasFinished) simBtn.disabled = true;
  simBtn.onclick = () => mastersWatchSeries(id, team1, team2, bestOf, isGrandFinal);
  box.appendChild(simBtn);

  return box;
}

function createRound(roundName, matches, st, playerTeam) {
  const roundDiv = document.createElement('div');
  roundDiv.className = 'round';
  const title = document.createElement('h4');
  title.textContent = roundName;
  roundDiv.appendChild(title);

  const matchesContainer = document.createElement('div');
  matchesContainer.className = 'matches-vertical';

  matches.forEach(match => {
    const mData = st.series[match.id] || {};
    matchesContainer.appendChild(createMatchBox(
      match.team1, match.team2, mData.winner, playerTeam, 
      match.id, match.bestOf, match.isGrandFinal, mData.score
    ));
  });
  
  roundDiv.appendChild(matchesContainer);
  return roundDiv;
}

export function renderMasters(activeSave) {
  const mastersBracketEl = document.getElementById('mastersBracket');
  const notQualMsg = document.getElementById('not-qualified-msg');
  const qualCountEl = document.getElementById('qualified-teams-count');
  
  if (!mastersBracketEl) return;

  const qualifiedTeams = [];
  if (activeSave.qualifiedTeams) {
    Object.values(activeSave.qualifiedTeams).forEach(regionTeams => {
      if (Array.isArray(regionTeams)) {
        qualifiedTeams.push(...regionTeams);
      }
    });
  }
  
  qualCountEl.textContent = qualifiedTeams.length;

  if (qualifiedTeams.length < 8) {
    mastersBracketEl.style.display = 'none';
    notQualMsg.style.display = 'block';
    notQualMsg.innerHTML = `<h3>Masters Bangkok Qualification</h3><p>The tournament requires 8 teams to start. Currently ${qualifiedTeams.length} teams have qualified via regional kickoffs.</p>`;
    return;
  }

  mastersBracketEl.style.display = 'block';
  notQualMsg.style.display = 'none';

  if (!activeSave.mastersState) {
    // Initialize 8-team bracket
    const allTeams = shuffleArray([...qualifiedTeams]);
    
    activeSave.mastersState = {
      series: {},
      ubRound1: [
        { id: 'M-UB1-M1', team1: allTeams[0], team2: allTeams[1], bestOf: 3 },
        { id: 'M-UB1-M2', team1: allTeams[2], team2: allTeams[3], bestOf: 3 },
        { id: 'M-UB1-M3', team1: allTeams[4], team2: allTeams[5], bestOf: 3 },
        { id: 'M-UB1-M4', team1: allTeams[6], team2: allTeams[7], bestOf: 3 }
      ],
      ubRound2: [
        { id: 'M-UB2-M1', team1: '', team2: '', bestOf: 3 },
        { id: 'M-UB2-M2', team1: '', team2: '', bestOf: 3 }
      ],
      ubFinal: [
        { id: 'M-UBF', team1: '', team2: '', bestOf: 3 }
      ],
      lbRound1: [
        { id: 'M-LB1-M1', team1: '', team2: '', bestOf: 3 },
        { id: 'M-LB1-M2', team1: '', team2: '', bestOf: 3 }
      ],
      lbRound2: [
        { id: 'M-LB2-M1', team1: '', team2: '', bestOf: 3 },
        { id: 'M-LB2-M2', team1: '', team2: '', bestOf: 3 }
      ],
      lbRound3: [
        { id: 'M-LB3-M1', team1: '', team2: '', bestOf: 3 }
      ],
      grandFinal: [
        { id: 'M-GF', team1: '', team2: '', bestOf: 5, isGrandFinal: true }
      ]
    };
    saveCareer(activeSave);
  }

  const st = activeSave.mastersState;
  const playerTeam = activeSave.team;

  // Update logic for 8-team double elimination
  // UB Round 2
  st.ubRound2[0].team1 = st.series['M-UB1-M1']?.winner || '';
  st.ubRound2[0].team2 = st.series['M-UB1-M2']?.winner || '';
  st.ubRound2[1].team1 = st.series['M-UB1-M3']?.winner || '';
  st.ubRound2[1].team2 = st.series['M-UB1-M4']?.winner || '';

  // UB Final
  st.ubFinal[0].team1 = st.series['M-UB2-M1']?.winner || '';
  st.ubFinal[0].team2 = st.series['M-UB2-M2']?.winner || '';
  
  // LB Round 1 (Losers of UB Round 1)
  st.lbRound1[0].team1 = st.series['M-UB1-M1']?.loser || '';
  st.lbRound1[0].team2 = st.series['M-UB1-M2']?.loser || '';
  st.lbRound1[1].team1 = st.series['M-UB1-M3']?.loser || '';
  st.lbRound1[1].team2 = st.series['M-UB1-M4']?.loser || '';

  // LB Round 2 (Winners of LB Round 1 vs Losers of UB Round 2)
  st.lbRound2[0].team1 = st.series['M-LB1-M1']?.winner || '';
  st.lbRound2[0].team2 = st.series['M-UB2-M2']?.loser || ''; // Cross-over
  st.lbRound2[1].team1 = st.series['M-LB1-M2']?.winner || '';
  st.lbRound2[1].team2 = st.series['M-UB2-M1']?.loser || ''; // Cross-over

  // LB Round 3 (Winners of LB Round 2)
  st.lbRound3[0].team1 = st.series['M-LB2-M1']?.winner || '';
  st.lbRound3[0].team2 = st.series['M-LB2-M2']?.winner || '';

  // LB Final (Winner of LB Round 3 vs Loser of UB Final)
  // Re-using lbRound1 structure or adding lbFinal? Let's add lbFinal to state if needed, 
  // but for simplicity in this edit let's just use what we have or adjust.
  // Actually, let's just render what we have and fix the state if needed.
  
  if (!st.lbFinal) {
    st.lbFinal = [{ id: 'M-LBF', team1: '', team2: '', bestOf: 3 }];
  }
  st.lbFinal[0].team1 = st.series['M-LB3-M1']?.winner || '';
  st.lbFinal[0].team2 = st.series['M-UBF']?.loser || '';

  // Grand Final
  st.grandFinal[0].team1 = st.series['M-UBF']?.winner || '';
  st.grandFinal[0].team2 = st.series['M-LBF']?.winner || '';

  // Render
  const upperEl = document.getElementById('mastersUpperBracket');
  upperEl.innerHTML = '';
  upperEl.appendChild(createRound('Upper Quarters', st.ubRound1, st, playerTeam));
  upperEl.appendChild(createRound('Upper Semis', st.ubRound2, st, playerTeam));
  upperEl.appendChild(createRound('Upper Final', st.ubFinal, st, playerTeam));

  const lowerEl = document.getElementById('mastersLowerBracket');
  lowerEl.innerHTML = '';
  lowerEl.appendChild(createRound('Lower Round 1', st.lbRound1, st, playerTeam));
  lowerEl.appendChild(createRound('Lower Round 2', st.lbRound2, st, playerTeam));
  lowerEl.appendChild(createRound('Lower Round 3', st.lbRound3, st, playerTeam));
  lowerEl.appendChild(createRound('Lower Final', st.lbFinal, st, playerTeam));

  const gfEl = document.getElementById('mastersGrandFinalBracket');
  gfEl.innerHTML = '';
  gfEl.appendChild(createRound('Grand Final', st.grandFinal, st, playerTeam));
}

function mastersWatchSeries(id, team1, team2, bestOf, isGrandFinal) {
  const activeSave = loadCareer();
  const t1Name = typeof team1 === 'object' ? team1.name : team1;
  const t2Name = typeof team2 === 'object' ? team2.name : team2;

  const t1Data = getSafeTeamByName(t1Name);
  const t2Data = getSafeTeamByName(t2Name);

  if (!t1Data || !t2Data) return;

  const team1Obj = new Team(t1Data.name, t1Data.id);
  t1Data.players?.forEach(p => team1Obj.addPlayer(Player.fromJSON(p)));
  const team2Obj = new Team(t2Data.name, t2Data.id);
  t2Data.players?.forEach(p => team2Obj.addPlayer(Player.fromJSON(p)));

  const strategies = {};
  if (activeSave.team === t1Name) strategies[team1Obj.id] = activeSave.strategies;
  if (activeSave.team === t2Name) strategies[team2Obj.id] = activeSave.strategies;

  let t1Wins = 0, t2Wins = 0;
  const winsNeeded = Math.ceil(bestOf / 2);
  
  if (!activeSave.mastersState.series[id]) {
    activeSave.mastersState.series[id] = {};
  }

  while (t1Wins < winsNeeded && t2Wins < winsNeeded) {
    const maps = [...mapPool].sort(() => 0.5 - Math.random());
    const sim = new MatchSimulator(team1Obj, team2Obj, [maps[0]], strategies);
    const result = sim.simulateMatch();
    
    if (team1Obj.score > team2Obj.score) t1Wins++; else t2Wins++;
    
    // Track map results for history/display if needed
    if (!activeSave.mastersState.series[id].mapResults) {
      activeSave.mastersState.series[id].mapResults = [];
    }
    activeSave.mastersState.series[id].mapResults.push({
      map: maps[0],
      score: `${team1Obj.score}-${team2Obj.score}`
    });

    team1Obj.score = 0; team2Obj.score = 0;
  }

  const winner = t1Wins > t2Wins ? t1Name : t2Name;
  const loser = winner === t1Name ? t2Name : t1Name;

  activeSave.mastersState.series[id].winner = winner;
  activeSave.mastersState.series[id].loser = loser;
  activeSave.mastersState.series[id].score = `${t1Wins}-${t2Wins}`;

  // If Grand Final is finished, we could add championship points or rewards here
  if (isGrandFinal) {
    console.log(`Masters Bangkok Champion: ${winner}`);
  }

  saveCareer(activeSave);
  renderMasters(activeSave);
}
