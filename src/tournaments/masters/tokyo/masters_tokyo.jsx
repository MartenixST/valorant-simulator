import { teams } from '../../../teams.js';
import { loadCareer, saveCareer, getSafeTeamByName } from "../../../career_local_storage.jsx";
import { Player, Team, MatchSimulator } from '../../../simulation.js';
import { automateMastersTokyo } from './masters_tokyo_automation.js';

const mapPool = ['Abyss', 'Bind', 'Corrode', 'Haven', 'Pearl', 'Split', 'Sunset'];

// Helper to check status safely (same as in match_simulation.js)
const isActive = (p) => {
    if (!p.status) return true; // Default to active if missing
    const s = String(p.status).toLowerCase();
    return s !== 'bench' && s !== 'inactive' && s !== 'reserve' && s !== 'reserved';
};

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

function createMatchBox(team1, team2, winner, playerTeam, id, bestOf, isGrandFinal, score, mapResults, isPlayable = true) {
  const box = document.createElement('div');
  box.className = 'match';
  box.classList.add('tokyo-match'); 
  
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

  if (mapResults && mapResults.length > 0) {
    const mapsDiv = document.createElement('div');
    mapsDiv.className = 'match-maps-results';
    mapsDiv.style.marginTop = '8px';
    mapsDiv.style.fontSize = '0.8em';
    mapsDiv.style.color = '#ccc';
    mapsDiv.style.display = 'flex';
    mapsDiv.style.flexDirection = 'column';
    mapsDiv.style.gap = '2px';
    mapsDiv.style.alignItems = 'center';

    mapResults.forEach(mr => {
        const mapRow = document.createElement('div');
        mapRow.textContent = `${mr.map}: ${mr.score}`;
        mapsDiv.appendChild(mapRow);
    });
    box.appendChild(mapsDiv);
  }

  const isLocked = !team1 || team1 === 'TBD' || !team2 || team2 === 'TBD' || isPlayable === false;
  const hasFinished = !!score;

  const simBtn = document.createElement('button');
  simBtn.textContent = 'Simulate';
  simBtn.className = 'simulate-button';
  if (isLocked || hasFinished) simBtn.disabled = true;
  simBtn.onclick = () => mastersTokyoWatchSeries(id, team1, team2, bestOf, isGrandFinal);
  box.appendChild(simBtn);

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.className = 'play-button';
  if (isLocked || hasFinished) playBtn.disabled = true;
  playBtn.onclick = () => {
    const t1 = typeof team1 === 'object' ? team1.name : team1;
    const t2 = typeof team2 === 'object' ? team2.name : team2;
    window.location.href = `match_simulation.html?team1=${encodeURIComponent(t1.toLowerCase().replace(/ /g, '_'))}&team2=${encodeURIComponent(t2.toLowerCase().replace(/ /g, '_'))}&matchId=${encodeURIComponent(id)}&bestOf=${bestOf}&playerTeam=${encodeURIComponent(playerTeam)}&tournament=masters_tokyo`;
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
  const st = activeSave.mastersTokyoState;
  
  // Find match data in Swiss or Playoffs
  let matchData = null;
  if (st.swiss && st.swiss.matches && st.swiss.matches[matchId]) {
      matchData = st.swiss.matches[matchId];
  } else if (st.playoffs && st.playoffs.matches && st.playoffs.matches[matchId]) {
      matchData = st.playoffs.matches[matchId];
  }
  
  if (!matchData || !matchData.playerStats) {
    alert("No stats available for this match.");
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'stats-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
  modal.style.zIndex = '1000';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';

  const content = document.createElement('div');
  content.className = 'stats-modal-content';
  content.style.backgroundColor = '#1e1e1e';
  content.style.padding = '20px';
  content.style.borderRadius = '8px';
  content.style.maxWidth = '800px';
  content.style.width = '90%';
  content.style.maxHeight = '90%';
  content.style.overflowY = 'auto';
  content.style.color = '#fff';

  const header = document.createElement('div');
  header.className = 'stats-modal-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '20px';
  
  const title = document.createElement('h2');
  title.textContent = `${matchData.team1} vs ${matchData.team2} (${matchData.score})`;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => modal.remove();
  header.appendChild(closeBtn);

  content.appendChild(header);

  // Stats Table Helper
  const createTable = (teamName, players) => {
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginBottom = '20px';
      
      const thead = document.createElement('thead');
      thead.innerHTML = `
          <tr style="background: #333;">
              <th style="padding: 8px; text-align: left;">Player</th>
              <th style="padding: 8px;">K</th>
              <th style="padding: 8px;">D</th>
              <th style="padding: 8px;">A</th>
              <th style="padding: 8px;">Rating</th>
              <th style="padding: 8px;">ACS</th>
          </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      players.forEach(p => {
          const row = document.createElement('tr');
          row.style.borderBottom = '1px solid #444';
          row.innerHTML = `
              <td style="padding: 8px;">${p.name}</td>
              <td style="padding: 8px; text-align: center;">${p.kills}</td>
              <td style="padding: 8px; text-align: center;">${p.deaths}</td>
              <td style="padding: 8px; text-align: center;">${p.assists}</td>
              <td style="padding: 8px; text-align: center;">${p.rating}</td>
              <td style="padding: 8px; text-align: center;">${p.acs}</td>
          `;
          tbody.appendChild(row);
      });
      table.appendChild(tbody);
      
      const label = document.createElement('h3');
      label.textContent = teamName;
      label.style.borderBottom = '2px solid #555';
      label.style.paddingBottom = '5px';
      
      const container = document.createElement('div');
      container.appendChild(label);
      container.appendChild(table);
      return container;
  };

  // Separate stats by team
  const t1Stats = [];
  const t2Stats = [];
  
  // Check if playerStats is array or object
  const allStats = Array.isArray(matchData.playerStats) ? matchData.playerStats : Object.values(matchData.playerStats);
  
  // We need to know which player belongs to which team. 
  // In `matchData.playerStats`, we might have team info if we stored it, or we guess by roster.
  // Assuming `getSafeTeamByName` can help resolve team rosters.
  const t1Data = getSafeTeamByName(matchData.team1);
  const t2Data = getSafeTeamByName(matchData.team2);

  if (t1Data && t2Data) {
      allStats.forEach(p => {
          // Check if player is in team 1
          const isT1 = t1Data.players.some(tp => tp.name === p.name);
          if (isT1) t1Stats.push(p);
          else t2Stats.push(p);
      });
  } else {
      // Fallback: split evenly
      const half = Math.ceil(allStats.length / 2);
      t1Stats.push(...allStats.slice(0, half));
      t2Stats.push(...allStats.slice(half));
  }

  content.appendChild(createTable(matchData.team1, t1Stats));
  content.appendChild(createTable(matchData.team2, t2Stats));

  modal.appendChild(content);
  document.body.appendChild(modal);
}

export function renderMastersTokyo(activeSave) {
  const mastersBracketEl = document.getElementById('mastersBracket');
  const mainBracketEl = document.getElementById('mastersMainBracket');
  
  if (!mastersBracketEl || !mainBracketEl) return;

  const st = activeSave.mastersTokyoState;
  const playerTeamName = teams.find(t => String(t.id) === String(activeSave.team))?.name || activeSave.team;
  
  // If no state, show nothing or initialization message
  if (!st) {
      mainBracketEl.innerHTML = '<div class="box"><p>Masters Tokyo is not active.</p></div>';
      return;
  }

  mastersBracketEl.style.display = 'block';
  mainBracketEl.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'masters-header';
  header.innerHTML = `
    <div class="bangkok-logo-container">
      <img src="assets/vct_logo.png" class="vct-logo" onerror="this.style.display='none'">
      <h1>Masters Tokyo</h1>
    </div>
    <div class="header-divider"></div>
    <p>Season 2025 • High/Low Seeds • Swiss & Double Elim Playoffs</p>
  `;
  mainBracketEl.appendChild(header);

  // 1. Swiss Stage (Low Seeds)
  if (st.swiss && st.swiss.rounds) {
    const swissSection = document.createElement('div');
    swissSection.className = 'bracket-section';
    swissSection.innerHTML = '<h3>Swiss Stage (Low Seeds)</h3>';
    
    // Simple Swiss Matches List
    const swissContainer = document.createElement('div');
    swissContainer.className = 'swiss-matches-container';
    
    st.swiss.rounds.forEach(round => {
        const roundTitle = document.createElement('h4');
        roundTitle.textContent = `Round ${round.round}`;
        swissContainer.appendChild(roundTitle);
        
        const roundDiv = document.createElement('div');
        roundDiv.style.display = 'flex';
        roundDiv.style.flexWrap = 'wrap';
        roundDiv.style.gap = '10px';
        
        round.matches.forEach(m => {
            const matchId = typeof m === 'string' ? m : m.id;
            const matchData = st.swiss.matches[matchId];
            roundDiv.appendChild(createMatchBox(
                matchData.team1, matchData.team2, matchData.winner, playerTeamName,
                matchId, 3, false, matchData.score, matchData.mapResults
            ));
        });
        swissContainer.appendChild(roundDiv);
    });
    
    swissSection.appendChild(swissContainer);
    mainBracketEl.appendChild(swissSection);
  }

  // 2. Playoffs (Double Elim)
  if (st.playoffs && st.playoffs.teams.length > 0) {
      const playoffSection = document.createElement('div');
      playoffSection.className = 'bracket-section';
      playoffSection.innerHTML = '<h3>Playoffs (Double Elimination)</h3>';
      
      const bracketContainer = document.createElement('div');
      bracketContainer.style.display = 'flex';
      bracketContainer.style.flexDirection = 'column';
      bracketContainer.style.gap = '20px';

      // Upper Bracket
      const ubDiv = document.createElement('div');
      ubDiv.innerHTML = '<h4>Upper Bracket</h4>';
      ubDiv.style.display = 'flex';
      ubDiv.style.gap = '20px';
      ubDiv.style.overflowX = 'auto';

      // UB QF
      const qfDiv = createColumn('Quarterfinals', st.playoffs.upper.quarterfinals, st, playerTeamName);
      ubDiv.appendChild(qfDiv);
      
      // UB SF
      const sfDiv = createColumn('Semifinals', st.playoffs.upper.semifinals, st, playerTeamName);
      ubDiv.appendChild(sfDiv);
      
      // UB Final
      const ubfDiv = createColumn('UB Final', [st.playoffs.upper.final], st, playerTeamName);
      ubDiv.appendChild(ubfDiv);

      bracketContainer.appendChild(ubDiv);

      // Lower Bracket
      const lbDiv = document.createElement('div');
      lbDiv.innerHTML = '<h4>Lower Bracket</h4>';
      lbDiv.style.display = 'flex';
      lbDiv.style.gap = '20px';
      lbDiv.style.overflowX = 'auto';

      lbDiv.appendChild(createColumn('LB R1', st.playoffs.lower.r1, st, playerTeamName));
      lbDiv.appendChild(createColumn('LB R2', st.playoffs.lower.r2, st, playerTeamName));
      lbDiv.appendChild(createColumn('LB R3', [st.playoffs.lower.r3], st, playerTeamName));
      lbDiv.appendChild(createColumn('LB Final', [st.playoffs.lower.final], st, playerTeamName));

      bracketContainer.appendChild(lbDiv);

      // Grand Final
      const gfDiv = document.createElement('div');
      gfDiv.innerHTML = '<h4>Grand Final</h4>';
      gfDiv.appendChild(createMatchBox(
          st.playoffs.matches[st.playoffs.grandFinal].team1,
          st.playoffs.matches[st.playoffs.grandFinal].team2,
          st.playoffs.matches[st.playoffs.grandFinal].winner,
          playerTeamName,
          st.playoffs.grandFinal,
          5,
          true,
          st.playoffs.matches[st.playoffs.grandFinal].score,
          st.playoffs.matches[st.playoffs.grandFinal].mapResults
      ));
      bracketContainer.appendChild(gfDiv);

      playoffSection.appendChild(bracketContainer);
      mainBracketEl.appendChild(playoffSection);
  }
}

function createColumn(title, matchIds, st, playerTeam) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '10px';
    col.innerHTML = `<h5>${title}</h5>`;
    
    matchIds.forEach(mid => {
        const m = st.playoffs.matches[mid];
        if (m) {
            col.appendChild(createMatchBox(
                m.team1, m.team2, m.winner, playerTeam,
                mid, m.bestOf || 3, false, m.score, m.mapResults
            ));
        }
    });
    return col;
}

function mastersTokyoWatchSeries(id, team1, team2, bestOf, isGrandFinal) {
  const activeSave = loadCareer();
  const t1Name = typeof team1 === 'object' ? team1.name : team1;
  const t2Name = typeof team2 === 'object' ? team2.name : team2;

  const t1Data = getSafeTeamByName(t1Name);
  const t2Data = getSafeTeamByName(t2Name);

  if (!t1Data || !t2Data) return;

  const team1Obj = new Team(t1Data.name, t1Data.id);
  // Filter active players using helper
  t1Data.players?.filter(isActive).forEach(p => team1Obj.addPlayer(Player.fromJSON(p)));
  const team2Obj = new Team(t2Data.name, t2Data.id);
  t2Data.players?.filter(isActive).forEach(p => team2Obj.addPlayer(Player.fromJSON(p)));

  const strategies = {};
  if (activeSave.team === t1Name) strategies[team1Obj.id] = activeSave.strategies;
  if (activeSave.team === t2Name) strategies[team2Obj.id] = activeSave.strategies;

  // Match Simulation Logic
  let t1Wins = 0, t2Wins = 0;
  const winsNeeded = Math.ceil(bestOf / 2);
  
  // Storage
  const st = activeSave.mastersTokyoState;
  let matchData;
  if (id.startsWith('M-TOKYO-SWISS')) {
    matchData = st.swiss.matches[id];
  } else {
    matchData = st.playoffs.matches[id];
  }

  // Simulate Maps
  const matchMaps = []; 
  // Map Pick Logic
  const availableMaps = [...mapPool];
  for(let i=0; i<bestOf; i++) {
      const idx = Math.floor(Math.random() * availableMaps.length);
      matchMaps.push({map: availableMaps[idx], picker: 'Random'});
      availableMaps.splice(idx, 1);
  }

  if (!matchData.mapResults) matchData.mapResults = [];
  if (!matchData.playerStats) matchData.playerStats = [];

  let mapIndex = 0;
  
  // Track aggregated stats for the series
  const seriesStats = {};

  while (t1Wins < winsNeeded && t2Wins < winsNeeded && mapIndex < matchMaps.length) {
      const mapName = matchMaps[mapIndex].map;
      
      // Reset scores and stats for new map
      team1Obj.score = 0;
      team2Obj.score = 0;
      [...team1Obj.players, ...team2Obj.players].forEach(p => {
          p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0, rating: 0 };
          p.kills = 0; p.deaths = 0; p.assists = 0;
      });

      const sim = new MatchSimulator(team1Obj, team2Obj, [], strategies, mapName);
      const result = sim.simulateMatch();
      
      // Update score
      const winner = result.winner;
      const score1 = team1Obj.score;
      const score2 = team2Obj.score;
      
      if (winner.name === t1Name) t1Wins++; else t2Wins++;
      
      matchData.mapResults.push({
          map: mapName,
          score: `${score1}-${score2}`,
          picker: matchMaps[mapIndex].picker
      });
      
      // Aggregate stats
      [...team1Obj.players, ...team2Obj.players].forEach(p => {
          if (!seriesStats[p.name]) {
              seriesStats[p.name] = { 
                  name: p.name, 
                  kills: 0, deaths: 0, assists: 0, 
                  rounds: 0, ratingSum: 0 
              };
          }
          seriesStats[p.name].kills += p.stats.kills;
          seriesStats[p.name].deaths += p.stats.deaths;
          seriesStats[p.name].assists += p.stats.assists;
          seriesStats[p.name].rounds += (score1 + score2);
          seriesStats[p.name].ratingSum += (p.stats.rating || 0) * (score1 + score2); 
      });

      mapIndex++;
  }

  // Finalize stats
  const finalStats = Object.values(seriesStats).map(s => ({
      name: s.name,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      rating: s.rounds > 0 ? (s.ratingSum / s.rounds).toFixed(2) : "0.00",
      acs: 0 // Placeholder
  }));
  matchData.playerStats = finalStats;

  const winner = t1Wins > t2Wins ? t1Name : t2Name;
  const loser = winner === t1Name ? t2Name : t1Name;
  
  matchData.winner = winner;
  matchData.loser = loser;
  matchData.score = `${t1Wins}-${t2Wins}`;
  matchData.team1 = t1Name;
  matchData.team2 = t2Name;

  // Update State via Automation Helper
  const newState = automateMastersTokyo([], [], [], null, st);
  activeSave.mastersTokyoState = newState;
  
  saveCareer(activeSave);
  renderMastersTokyo(activeSave);
}
