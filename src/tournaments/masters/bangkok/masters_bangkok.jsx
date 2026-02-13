import { teams } from '../../../teams.js';
import { loadCareer, saveCareer, getSafeTeamByName } from "../../../career_local_storage.jsx";
import { Player, Team, MatchSimulator } from '../../../simulation.js';

const mapPool = ['Abyss', 'Bind', 'Corrode', 'Haven', 'Pearl', 'Split', 'Sunset'];

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createTeamElement(team, playerTeam, score = null, isWinner = false) {
  const teamDiv = document.createElement('div');
  teamDiv.className = 'team-element';
  if (isWinner) teamDiv.classList.add('winner');

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
    scoreSpan.textContent = score;
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
    if (scores.length === 2) { 
      t1Score = scores[0]; 
      t2Score = scores[1]; 
    }
  }

  const t1Winner = winner && (team1 === winner || (team1 && team1.name === winner));
  const t2Winner = winner && (team2 === winner || (team2 && team2.name === winner));

  box.appendChild(createTeamElement(team1, playerTeam, t1Score, t1Winner));
  box.appendChild(createTeamElement(team2, playerTeam, t2Score, t2Winner));
  
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

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.className = 'play-button';
  if (isLocked || hasFinished) playBtn.disabled = true;
  playBtn.onclick = () => {
    const t1 = typeof team1 === 'object' ? team1.name : team1;
    const t2 = typeof team2 === 'object' ? team2.name : team2;
    window.location.href = `match_simulation.html?team1=${encodeURIComponent(t1.toLowerCase().replace(/ /g, '_'))}&team2=${encodeURIComponent(t2.toLowerCase().replace(/ /g, '_'))}&matchId=${encodeURIComponent(id)}&bestOf=${bestOf}&playerTeam=${encodeURIComponent(playerTeam)}&tournament=masters`;
  };
  box.appendChild(playBtn);

  if (hasFinished) {
    const statsBtn = document.createElement('button');
    statsBtn.textContent = 'Stats';
    statsBtn.className = 'stats-button';
    statsBtn.onclick = () => showMatchStats(id);
    box.appendChild(statsBtn);
  }

  return box;
}

function showMatchStats(matchId) {
  const activeSave = loadCareer();
  const st = activeSave.mastersState;
  const matchData = (st.swiss && st.swiss.matches && st.swiss.matches[matchId]) || 
                   (st.playoffs && st.playoffs.matches && st.playoffs.matches[matchId]) || 
                   (st.series && st.series[matchId]);
  
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
        <span class="team-name">${matchData.team1 || matchData.team1Name}</span>
        <span class="team-score">${matchData.score?.split('-')[0] || 0}</span>
      </div>
      <div class="summary-vs">VS</div>
      <div class="summary-team">
        <span class="team-score">${matchData.score?.split('-')[1] || 0}</span>
        <span class="team-name">${matchData.team2 || matchData.team2Name}</span>
      </div>
    </div>
  `;
  content.appendChild(header);

  const statsContainer = document.createElement('div');
  statsContainer.className = 'stats-container';

  const renderTeamStats = (teamName, players, rounds = 24) => {
    const teamHeader = document.createElement('div');
    teamHeader.className = 'team-stats-header';
    const normalizedName = teamName.toLowerCase().replace(/ /g, '_');
    teamHeader.innerHTML = `
      <div class="team-header-content">
        <img src="assets/team_logos/${normalizedName}.png" class="team-logo-small" onerror="this.src='assets/qmark.png'">
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
          <th class="text-center">ADR</th>
        </tr>
      </thead>
      <tbody>
        ${players.sort((a, b) => b.kills - a.kills).map(p => `
          <tr>
            <td class="player-name-cell">${p.name}</td>
            <td class="stat-k text-center">${p.kills}</td>
            <td class="stat-d text-center">${p.deaths}</td>
            <td class="stat-a text-center">${p.assists}</td>
            <td class="stat-adr text-center">${Math.round(p.damage / rounds)}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    statsContainer.appendChild(statsTable);
  };

  const allPlayers = Object.values(matchData.playerStats);
  const t1Name = matchData.team1 || matchData.team1Name;
  const t2Name = matchData.team2 || matchData.team2Name;
  
  const t1Players = allPlayers.filter(p => p.teamName === t1Name);
  const t2Players = allPlayers.filter(p => p.teamName === t2Name);

  const totalRounds = matchData.score?.split('-').reduce((a,b) => parseInt(a)+parseInt(b), 0) * 20 || 24;

  if (t1Players.length > 0) renderTeamStats(t1Name, t1Players, totalRounds);
  if (t2Players.length > 0) renderTeamStats(t2Name, t2Players, totalRounds);

  content.appendChild(statsContainer);
  modal.appendChild(content);
  document.body.appendChild(modal);

  modal.querySelector('.close-stats').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

export function renderMasters(activeSave) {
  const mastersBracketEl = document.getElementById('mastersBracket');
  const mainBracketEl = document.getElementById('mastersMainBracket');
  const notQualMsg = document.getElementById('not-qualified-msg');
  const qualCountEl = document.getElementById('qualified-teams-count');
  
  if (!mastersBracketEl || !mainBracketEl) return;

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
    notQualMsg.className = 'progress-box';
    notQualMsg.innerHTML = `
      <div class="masters-header">
        <h1>Masters Bangkok 2025</h1>
        <p>Road to the Global Championship</p>
      </div>
      <div class="box">
        <h3>Qualification Status</h3>
        <p>The tournament requires 8 teams to start. Currently <strong>${qualifiedTeams.length}</strong> teams have qualified via regional kickoffs.</p>
        <div style="margin-top: 20px; background: rgba(255,255,255,0.05); height: 10px; border-radius: 5px; overflow: hidden;">
          <div style="background: var(--bangkok-red); width: ${(qualifiedTeams.length / 8) * 100}%; height: 100%; transition: width 0.5s ease;"></div>
        </div>
      </div>
    `;
    return;
  }

  mastersBracketEl.style.display = 'block';
  notQualMsg.style.display = 'none';

  // If no mastersState, show "Not started"
  if (!activeSave.mastersState) {
    mainBracketEl.innerHTML = '<div class="box"><p>Masters Bangkok will begin in Week 6 after the break week.</p></div>';
    return;
  }

  const st = activeSave.mastersState;
  const playerTeam = activeSave.team;

  // AUTO-COMPLETE CHECK: If GF has a winner but not marked complete, fix it
  if (!st.complete && st.playoffs && st.playoffs.grandFinal) {
    const gfMatch = st.playoffs.matches[st.playoffs.grandFinal];
    if (gfMatch && gfMatch.winner) {
      console.log("Masters: Detected finished GF but complete flag was false. Fixing...");
      st.complete = true;
      saveCareer(activeSave);
      // Notify parent just in case
      try {
        window.parent.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
        window.parent.postMessage({ type: 'careerUpdate', data: activeSave }, window.location.origin);
      } catch (e) {}
    }
  }

  // Clear and rebuild the bracket UI for Swiss + Playoffs
  mainBracketEl.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'masters-header';
  header.innerHTML = `
    <div class="bangkok-logo-container">
      <img src="assets/vct_logo.png" class="vct-logo" onerror="this.style.display='none'">
      <h1>Masters Bangkok</h1>
    </div>
    <div class="header-divider"></div>
    <p>Season 2026 • Swiss Stage & Playoffs</p>
  `;
  mainBracketEl.appendChild(header);

  // --- PROGRESS INFO ---
  const progressBox = document.createElement('div');
  progressBox.className = 'box progress-box';
  progressBox.style.marginBottom = '30px';
  progressBox.style.padding = '20px';
  progressBox.style.borderLeft = '4px solid var(--bangkok-red)';

  let currentPhase = 'Not Started';
  let nextStep = 'Next round will be simulated when you click "Simulate Week" in your office.';

  if (st.complete) {
    currentPhase = 'Tournament Complete';
    nextStep = 'The tournament has concluded. Congratulations to the champion!';
  } else if (st.playoffs && st.playoffs.grandFinal && st.playoffs.matches[st.playoffs.grandFinal]?.score) {
    currentPhase = 'Grand Final Complete';
  } else if (st.playoffs && st.playoffs.grandFinal) {
    currentPhase = 'Playoffs - Grand Final';
  } else if (st.playoffs && st.playoffs.semifinals.length > 0) {
    currentPhase = 'Playoffs - Semifinals';
  } else if (st.swiss && st.swiss.rounds.length > 0) {
    currentPhase = `Swiss Stage - Round ${st.swiss.rounds.length}`;
    const activeSwissTeams = Object.values(st.swiss.teamStats).filter(s => !s.qualified && !s.eliminated).length;
    if (activeSwissTeams === 0) {
      currentPhase = 'Swiss Stage Complete';
    }
  }

  progressBox.innerHTML = `
    <h4 style="margin:0 0 8px 0; color:var(--bangkok-red); font-family:'Valorant', sans-serif; letter-spacing:1px;">Current Phase: ${currentPhase}</h4>
    <p style="margin:0; font-size:0.95em; color:#ece8e1; opacity:0.8;">${nextStep}</p>
  `;
  mainBracketEl.appendChild(progressBox);

  // 1. Swiss Stage Section
  if (st.swiss && st.swiss.rounds) {
    const swissSection = document.createElement('div');
    swissSection.className = 'bracket-section';
    swissSection.innerHTML = '<h3>Swiss Stage</h3>';
    
    const swissContainer = document.createElement('div');
    swissContainer.className = 'bracket-wrapper swiss-layout';

    // Swiss Standings
    const standingsBox = document.createElement('div');
    standingsBox.className = 'box swiss-standings-box';
    standingsBox.innerHTML = '<h4>Swiss Standings</h4>';
    const table = document.createElement('table');
    table.className = 'swiss-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Team</th>
          <th>Score</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    
    Object.keys(st.swiss.teamStats).sort((a,b) => {
        const sA = st.swiss.teamStats[a];
        const sB = st.swiss.teamStats[b];
        if (sA.qualified !== sB.qualified) return sB.qualified ? 1 : -1;
        if (sA.eliminated !== sB.eliminated) return sA.eliminated ? 1 : -1;
        return sB.wins - sA.wins;
    }).forEach(teamName => {
        const stats = st.swiss.teamStats[teamName];
        const tr = document.createElement('tr');
        const statusText = stats.qualified ? 'Qualified' : stats.eliminated ? 'Eliminated' : 'Active';
        const statusClass = stats.qualified ? 'winner' : stats.eliminated ? 'eliminated' : '';
        tr.innerHTML = `<td>${teamName}</td><td>${stats.wins}-${stats.losses}</td><td class="${statusClass}">${statusText}</td>`;
        tbody.appendChild(tr);
    });
    standingsBox.appendChild(table);
    swissContainer.appendChild(standingsBox);

    const swissGrid = document.createElement('div');
    swissGrid.className = 'bracket-grid swiss-rounds-grid';
    st.swiss.rounds.forEach(round => {
      const roundMatches = round.matches.map(m => {
        const matchId = typeof m === 'string' ? m : m.id;
        const matchData = st.swiss.matches[matchId] || m;
        return { 
          id: matchId, 
          team1: matchData.team1, 
          team2: matchData.team2,
          winner: matchData.winner,
          score: matchData.score,
          bestOf: matchData.bestOf || 3
        };
      });
      const roundDiv = createRound(`Round ${round.round}`, roundMatches, st, playerTeam);
      swissGrid.appendChild(roundDiv);
    });
    
    swissContainer.appendChild(swissGrid);
    swissSection.appendChild(swissContainer);
    mainBracketEl.appendChild(swissSection);
  }

  // 2. Playoffs Section
  if (st.playoffs) {
    const playoffSection = document.createElement('div');
    playoffSection.className = 'bracket-section';
    playoffSection.style.marginTop = '40px';
    playoffSection.innerHTML = '<h3>Knockout Stage</h3>';

    const playoffContainer = document.createElement('div');
    playoffContainer.className = 'bracket-wrapper';
    const playoffGrid = document.createElement('div');
    playoffGrid.className = 'bracket-grid';

    // Semis
    if (st.playoffs.semifinals.length > 0) {
        const semiMatches = st.playoffs.semifinals.map(id => ({ id, ...st.playoffs.matches[id] }));
        playoffGrid.appendChild(createRound('Semifinals', semiMatches, st, playerTeam));
    } else {
        const emptyRound = createRound('Semifinals', [{id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}], st, playerTeam);
        playoffGrid.appendChild(emptyRound);
    }

    // Grand Final
    if (st.playoffs.grandFinal) {
        const finalMatch = { id: st.playoffs.grandFinal, ...st.playoffs.matches[st.playoffs.grandFinal] };
        playoffGrid.appendChild(createRound('Grand Final', [finalMatch], st, playerTeam));
    } else {
        const emptyRound = createRound('Grand Final', [{id:null, team1:'TBD', team2:'TBD', isGrandFinal:true, bestOf:5}], st, playerTeam);
        playoffGrid.appendChild(emptyRound);
    }

    playoffContainer.appendChild(playoffGrid);
    playoffSection.appendChild(playoffContainer);
    mainBracketEl.appendChild(playoffSection);

    // Champion display
    const finalId = st.playoffs.grandFinal;
    const finalMatch = finalId ? st.playoffs.matches[finalId] : null;
    if (finalMatch && finalMatch.winner) {
        const champBox = document.createElement('div');
        champBox.className = 'box progress-box';
        champBox.style.textAlign = 'center';
        champBox.style.marginTop = '40px';
        champBox.style.padding = '40px';
        champBox.style.border = '1px solid var(--bangkok-gold)';
        champBox.style.background = 'linear-gradient(180deg, rgba(255, 180, 0, 0.05) 0%, transparent 100%)';
        champBox.innerHTML = `
            <div style="color:var(--bangkok-gold); font-family:'Valorant', sans-serif; font-size:1.2rem; letter-spacing:2px; margin-bottom:15px;">MASTERS BANGKOK CHAMPION</div>
            <div style="font-size:3rem; font-weight:900; color:#fff; text-shadow: 0 0 20px rgba(255,180,0,0.4);">${finalMatch.winner}</div>
        `;
        mainBracketEl.appendChild(champBox);
    }
  }
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
    const mData = (st.swiss && st.swiss.matches && st.swiss.matches[match.id]) || 
                  (st.playoffs && st.playoffs.matches && st.playoffs.matches[match.id]) || 
                  (st.series && st.series[match.id]) || {};
    
    matchesContainer.appendChild(createMatchBox(
      match.team1, match.team2, mData.winner, playerTeam, 
      match.id, match.bestOf || 3, match.isGrandFinal, mData.score
    ));
  });
  
  roundDiv.appendChild(matchesContainer);
  return roundDiv;
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
  
  // Ensure the state structure exists
  const st = activeSave.mastersState;
  if (!st.series) st.series = {};
  if (!st.swiss) st.swiss = { matches: {}, teamStats: {}, rounds: [] };
  if (!st.playoffs) st.playoffs = { matches: {}, semifinals: [], grandFinal: null };

  // Use the specific match storage based on ID prefix
  let matchData;
  if (id.startsWith('M-SWISS')) {
    if (!st.swiss.matches[id]) st.swiss.matches[id] = {};
    matchData = st.swiss.matches[id];
  } else if (id.startsWith('M-PLAYOFF')) {
    if (!st.playoffs.matches[id]) st.playoffs.matches[id] = {};
    matchData = st.playoffs.matches[id];
  } else {
    if (!st.series[id]) st.series[id] = {};
    matchData = st.series[id];
  }

  while (t1Wins < winsNeeded && t2Wins < winsNeeded) {
    const maps = [...mapPool].sort(() => 0.5 - Math.random());
    const sim = new MatchSimulator(team1Obj, team2Obj, [], strategies, maps[0]);
    const result = sim.simulateMatch();
    
    // Aggregated stats for the whole series
    if (!matchData.playerStats) {
      matchData.playerStats = {};
    }
    
    // Accumulate player stats
    [...team1Obj.players, ...team2Obj.players].forEach(p => {
      if (!matchData.playerStats[p.name]) {
        matchData.playerStats[p.name] = {
          name: p.name,
          teamName: p.teamId === team1Obj.id ? team1Obj.name : team2Obj.name,
          kills: 0, deaths: 0, assists: 0, damage: 0
        };
      }
      const ps = matchData.playerStats[p.name];
      ps.kills += p.stats.kills;
      ps.deaths += p.stats.deaths;
      ps.assists += p.stats.assists;
      ps.damage += p.stats.damageDealt;
      
      // Reset player stats for next map
      p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
    });

    if (team1Obj.score > team2Obj.score) t1Wins++; else t2Wins++;
    
    // Track map results
    if (!matchData.mapResults) {
      matchData.mapResults = [];
    }
    matchData.mapResults.push({
      map: maps[0],
      score: `${team1Obj.score}-${team2Obj.score}`
    });

    team1Obj.score = 0; team2Obj.score = 0;
  }

  const winner = t1Wins > t2Wins ? t1Name : t2Name;
  const loser = winner === t1Name ? t2Name : t1Name;

  matchData.winner = winner;
  matchData.loser = loser;
  matchData.score = `${t1Wins}-${t2Wins}`;
  matchData.team1 = t1Name;
  matchData.team2 = t2Name;

  // Update Swiss stats if it's a Swiss match
  if (id.startsWith('M-SWISS')) {
    if (st.swiss.teamStats && st.swiss.teamStats[winner]) {
      st.swiss.teamStats[winner].wins++;
      st.swiss.teamStats[loser].losses++;
      if (st.swiss.teamStats[winner].wins === 2) st.swiss.teamStats[winner].qualified = true;
      if (st.swiss.teamStats[loser].losses === 2) st.swiss.teamStats[loser].eliminated = true;
    }
  }

  // Update Playoffs progression if it's a Playoff match
  if (id.startsWith('M-PLAYOFF-SF')) {
    console.log("Playoff Semifinal finished, checking if Grand Final can be generated...");
    // If both semis are done, generate the GF matchup
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
      console.log(`Grand Final Set: ${sf1.winner} vs ${sf2.winner}`);
    }
  }

  // If Grand Final is finished, mark tournament as complete
  if (isGrandFinal || id === 'M-PLAYOFF-GF') {
    st.complete = true;
    console.log(`Masters Bangkok Champion: ${winner}`);

    // Award Championship Points for winning Masters
    if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
    activeSave.championshipPoints[winner] = (activeSave.championshipPoints[winner] || 0) + 3;
    console.log(`CP: ${winner} gets +3 points for winning Masters.`);
  }

  // Award Championship Points for the match win
  if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
  activeSave.championshipPoints[winner] = (activeSave.championshipPoints[winner] || 0) + 1;
  console.log(`CP: ${winner} gets +1 point for a match win in Masters.`);

  saveCareer(activeSave);
  
  // Notify parent React app of the update
  try {
    const event = new CustomEvent('careerUpdate', { detail: activeSave });
    window.parent.dispatchEvent(event);
    // Also try postMessage as a backup
    window.parent.postMessage({ type: 'careerUpdate', data: activeSave }, window.location.origin);
  } catch (e) {
    console.warn("Failed to notify parent of career update:", e);
  }

  renderMasters(activeSave);
}
