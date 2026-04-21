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

function createMatchBox(team1, team2, winner, playerTeam, id, bestOf, isGrandFinal, score, mapResults, isPlayable = true) {
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
  simBtn.onclick = () => mastersWatchSeries(id, team1, team2, bestOf, isGrandFinal);
  box.appendChild(simBtn);

  // Determine if it's the 3rd place match
  const isThirdPlace = id === 'M-PLAYOFF-3RD';
  const matchTypeLabel = isGrandFinal ? 'Grand Final' : isThirdPlace ? '3rd Place' : '';
  
  if (matchTypeLabel) {
      const typeLabel = document.createElement('div');
      typeLabel.style.fontSize = '0.7em';
      typeLabel.style.color = 'var(--bangkok-gold)';
      typeLabel.style.marginTop = '5px';
      typeLabel.style.textAlign = 'center';
      typeLabel.textContent = matchTypeLabel;
      box.insertBefore(typeLabel, simBtn);
      
      // Add locked message for GF and 3rd Place when not playable
      if (isPlayable === false && team1 && team1 !== 'TBD' && team2 && team2 !== 'TBD') {
          const lockedLabel = document.createElement('div');
          lockedLabel.style.fontSize = '0.65em';
          lockedLabel.style.color = '#ff6b6b';
          lockedLabel.style.marginTop = '3px';
          lockedLabel.style.textAlign = 'center';
          lockedLabel.style.fontWeight = '600';
          lockedLabel.textContent = '🔒 Week 11';
          box.insertBefore(lockedLabel, simBtn);
      }
  }

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
  
  // Build map results HTML
  let mapsHtml = '';
  if (matchData.mapResults && matchData.mapResults.length > 0) {
    mapsHtml = `<div class="stats-maps-container">`;
    matchData.mapResults.forEach(mr => {
      mapsHtml += `
        <div class="stats-map-item">
          <span class="map-name">${mr.map}</span>
          <span class="map-score">${mr.score}</span>
          ${mr.picker ? `<span class="map-picker">(${mr.picker}'s Pick)</span>` : ''}
        </div>
      `;
    });
    mapsHtml += `</div>`;
  }

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
    ${mapsHtml}
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
  
  if (qualCountEl) {
    qualCountEl.textContent = qualifiedTeams.length;
  }

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

  // If no mastersState, show "Not started" unless we are in prep week (Week 5+)
  if (!activeSave.mastersState) {
    // Check if we should initialize it early (e.g. user is on Week 5 or 6)
    if ((activeSave.week >= 5) && qualifiedTeams.length >= 8) {
        console.log("Initializing Masters Bangkok state early (Week " + activeSave.week + ")...");
        const flatQualifiedTeams = [...new Set(
            qualifiedTeams
            .filter(t => t && (typeof t === 'string' || t.name))
            .map(t => typeof t === 'string' ? t : t.name)
        )];

        if (flatQualifiedTeams.length >= 8) {
            activeSave.mastersState = {
                swiss: {
                    rounds: [],
                    teamStats: {},
                    matches: {}
                },
                playoffs: {
                    semifinals: [],
                    grandFinal: null,
                    matches: {}
                },
                series: {},
                complete: false,
                dirty: false
            };
            flatQualifiedTeams.forEach(teamName => {
                activeSave.mastersState.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
            });
            saveCareer(activeSave);
            // Notify parent just in case
            try {
                const event = new CustomEvent('careerUpdate', { detail: activeSave });
                window.parent.dispatchEvent(event);
            } catch (e) {}
        } else {
            mainBracketEl.innerHTML = '<div class="box"><p>Masters Bangkok will begin in Week 7 after the break weeks.</p></div>';
            return;
        }
    } else {
        mainBracketEl.innerHTML = '<div class="box"><p>Masters Bangkok will begin in Week 7 after the break weeks.</p></div>';
        return;
    }
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
    <p>Season 2025 • Swiss Stage & Playoffs</p>
  `;
  mainBracketEl.appendChild(header);

  // --- PREPARATION PHASE SPECIAL VIEW ---
  if (activeSave.week < 7 && !st.complete && (!st.swiss.rounds || st.swiss.rounds.length === 0)) {
     const prepSection = document.createElement('div');
     prepSection.innerHTML = `
        <div class="progress-box">
            <h4>Preparation Phase</h4>
            <p>Teams are currently in the preparation phase. The Swiss Stage matches will begin in Week 7.</p>
        </div>
        <h3 style="margin: 20px 0 10px; color: #fff; font-family: 'Valorant', sans-serif; font-size: 1.2rem;">Qualified Teams</h3>
     `;
     
     const grid = document.createElement('div');
     grid.className = 'qualified-grid';
     
     const flatQualifiedTeams = Object.keys(st.swiss.teamStats);

     flatQualifiedTeams.forEach(teamName => {
        const teamCard = document.createElement('div');
        teamCard.className = 'qualified-card';
        const normalizedPath = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
        
        // Find team region
        let region = 'International';
        for(const r in teams) {
            if(teams[r].find(t => t.name === teamName)) {
                region = r.charAt(0).toUpperCase() + r.slice(1);
                break;
            }
        }

        teamCard.innerHTML = `
            <img src="assets/team_logos/${normalizedPath}.png" onerror="this.src='assets/qmark.png'">
            <div class="qualified-info">
                <span class="qualified-region">${region}</span>
                <span class="qualified-name">${teamName}</span>
            </div>
        `;
        grid.appendChild(teamCard);
     });
     
     prepSection.appendChild(grid);
     mainBracketEl.appendChild(prepSection);
     return;
  }

  // --- PROGRESS INFO (For active tournament) ---
  const progressBox = document.createElement('div');
  progressBox.className = 'box progress-box';
  progressBox.style.marginBottom = '15px';
  progressBox.style.padding = '10px';
  progressBox.style.borderLeft = '4px solid var(--bangkok-red)';

  let currentPhase = 'Not Started';
  let nextStep = 'Next round will be simulated when you click "Simulate Week" in your office.';

  if (st.complete) {
    currentPhase = 'Tournament Complete';
    nextStep = 'The tournament has concluded. Congratulations to the champion!';
  } else if (activeSave.week < 7) {
    currentPhase = 'Preparation Phase';
    nextStep = 'Teams are currently in the preparation phase. The Swiss Stage matches will begin in Week 7.';
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
    <h4 style="margin:0 0 5px 0; color:var(--bangkok-red); font-family:'Valorant', sans-serif; letter-spacing:1px; font-size: 1rem;">Current Phase: ${currentPhase}</h4>
    <p style="margin:0; font-size:0.85em; color:#ece8e1; opacity:0.8;">${nextStep}</p>
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
          <th style="width: 30px">#</th>
          <th>Team</th>
          <th>W-L</th>
          <th>Map Diff</th>
          <th>Rd Diff</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    
    // Calculate detailed stats (Map Diff, Round Diff)
    const detailedStats = {};
    Object.keys(st.swiss.teamStats).forEach(team => {
        detailedStats[team] = {
            ...st.swiss.teamStats[team],
            mapDiff: 0,
            roundDiff: 0
        };
    });

    if (st.swiss.rounds) {
        st.swiss.rounds.forEach(round => {
            round.matches.forEach(m => {
                const matchId = typeof m === 'string' ? m : m.id;
                const match = st.swiss.matches[matchId];
                if (match && match.winner) {
                    // Map Diff
                    const [s1, s2] = match.score.split('-').map(Number);
                    if (detailedStats[match.team1]) detailedStats[match.team1].mapDiff += (s1 - s2);
                    if (detailedStats[match.team2]) detailedStats[match.team2].mapDiff += (s2 - s1);

                    // Round Diff
                    if (match.mapResults) {
                        match.mapResults.forEach(mr => {
                            const [r1, r2] = mr.score.split('-').map(Number);
                            if (detailedStats[match.team1]) detailedStats[match.team1].roundDiff += (r1 - r2);
                            if (detailedStats[match.team2]) detailedStats[match.team2].roundDiff += (r2 - r1);
                        });
                    }
                }
            });
        });
    }

    const sortedTeams = Object.keys(detailedStats).sort((a,b) => {
        const sA = detailedStats[a];
        const sB = detailedStats[b];
        
        // Sort Priority:
        // 1. Wins (Desc)
        // 2. Losses (Asc) - Fewer losses is better (e.g. 2-0 > 2-1)
        // 3. Map Diff (Desc)
        // 4. Round Diff (Desc)
        
        if (sB.wins !== sA.wins) return sB.wins - sA.wins;
        if (sB.losses !== sA.losses) return sA.losses - sB.losses;
        if (sB.mapDiff !== sA.mapDiff) return sB.mapDiff - sA.mapDiff;
        return sB.roundDiff - sA.roundDiff;
    });

    sortedTeams.forEach((teamName, index) => {
        const stats = detailedStats[teamName];
        const tr = document.createElement('tr');
        
        const statusText = stats.qualified ? 'Qualified' : stats.eliminated ? 'Eliminated' : 'Active';
        const statusClass = stats.qualified ? 'winner' : stats.eliminated ? 'eliminated' : 'active';
        
        // Color for diffs
        const getDiffClass = (val) => val > 0 ? 'diff-positive' : val < 0 ? 'diff-negative' : 'diff-neutral';
        const mdSign = stats.mapDiff > 0 ? '+' : '';
        const rdSign = stats.roundDiff > 0 ? '+' : '';

        tr.innerHTML = `
            <td style="color: #666; font-size: 0.8em;">${index + 1}</td>
            <td>${teamName}</td>
            <td style="font-weight:bold; letter-spacing:1px;">${stats.wins}-${stats.losses}</td>
            <td class="${getDiffClass(stats.mapDiff)}">${mdSign}${stats.mapDiff}</td>
            <td class="${getDiffClass(stats.roundDiff)}">${rdSign}${stats.roundDiff}</td>
            <td class="${statusClass}" style="font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.5px;">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });
    standingsBox.appendChild(table);
    swissContainer.appendChild(standingsBox);

    const swissGrid = document.createElement('div');
    swissGrid.className = 'bracket-grid swiss-rounds-grid';
    
    // Track team records round by round for display grouping
    const teamRecords = {}; 
    
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
      
      // Create round with current records snapshot
      const roundDiv = createRound(`Round ${round.round}`, roundMatches, st, playerTeam, JSON.parse(JSON.stringify(teamRecords)));
      swissGrid.appendChild(roundDiv);
      
      // Update records for next round
      roundMatches.forEach(m => {
        if (m.winner) {
            const loser = m.winner === m.team1 ? m.team2 : m.team1;
            
            if (!teamRecords[m.winner]) teamRecords[m.winner] = { wins: 0, losses: 0 };
            if (!teamRecords[loser]) teamRecords[loser] = { wins: 0, losses: 0 };
            
            teamRecords[m.winner].wins++;
            teamRecords[loser].losses++;
        }
      });
    });
    
    swissContainer.appendChild(swissGrid);
    swissSection.appendChild(swissContainer);
    mainBracketEl.appendChild(swissSection);
  }

  // 2. Playoffs Section
  if (st.playoffs) {
    const playoffSection = document.createElement('div');
    playoffSection.className = 'bracket-section';
    playoffSection.style.marginTop = '20px';
    playoffSection.innerHTML = '<h3>Knockout Stage</h3>';

    const playoffContainer = document.createElement('div');
    playoffContainer.className = 'bracket-wrapper';
    
    // Main Layout Container (Grid)
    const playoffLayout = document.createElement('div');
    playoffLayout.style.display = 'grid';
    playoffLayout.style.gridTemplateColumns = 'auto auto'; // 2 columns
    playoffLayout.style.gridTemplateRows = 'auto auto'; // 2 rows
    playoffLayout.style.gap = '30px'; // Space between cells
    playoffLayout.style.justifyContent = 'center';
    playoffLayout.style.alignItems = 'start';
    playoffLayout.style.marginTop = '20px';

    // Cell 1,1: Semifinals (Top Left)
    const semisCell = document.createElement('div');
    semisCell.style.gridColumn = '1';
    semisCell.style.gridRow = '1';
    
    if (st.playoffs.semifinals.length > 0) {
        const semiMatches = st.playoffs.semifinals.map(id => ({ id, ...st.playoffs.matches[id] }));
        semisCell.appendChild(createRound('Semifinals', semiMatches, st, playerTeam));
    } else {
        const emptyRound = createRound('Semifinals', [{id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}], st, playerTeam);
        semisCell.appendChild(emptyRound);
    }
    playoffLayout.appendChild(semisCell);

    // Cell 1,2: Grand Final (Top Right, aligned with Semis)
    const finalCell = document.createElement('div');
    finalCell.style.gridColumn = '2';
    finalCell.style.gridRow = '1';
    finalCell.style.display = 'flex';
    finalCell.style.flexDirection = 'column';
    finalCell.style.justifyContent = 'center'; // Center vertically relative to Semis height
    finalCell.style.height = '100%'; // Ensure full height for centering

    // Logic for 3rd place finish check and week lock (GF and 3rd Place locked until Week 11)
    const thirdId = st.playoffs.thirdPlace;
    const thirdMatch = thirdId ? st.playoffs.matches[thirdId] : null;
    const isThirdPlaceFinished = thirdMatch && thirdMatch.winner;
    const isWeek11OrLater = activeSave.week >= 11;

    if (st.playoffs.grandFinal) {
        const finalMatch = { 
            id: st.playoffs.grandFinal, 
            ...st.playoffs.matches[st.playoffs.grandFinal],
            isPlayable: isWeek11OrLater && !!isThirdPlaceFinished
        };
        finalCell.appendChild(createRound('Grand Final', [finalMatch], st, playerTeam));
    } else {
        const emptyRound = createRound('Grand Final', [{id:null, team1:'TBD', team2:'TBD', isGrandFinal:true, bestOf:5, isPlayable:false}], st, playerTeam);
        finalCell.appendChild(emptyRound);
    }
    playoffLayout.appendChild(finalCell);

    // Cell 2,1: 3rd Place Match (Bottom Left, under Semis)
    const thirdPlaceCell = document.createElement('div');
    thirdPlaceCell.style.gridColumn = '1';
    thirdPlaceCell.style.gridRow = '2';
    thirdPlaceCell.style.marginTop = '-10px'; // Pull up slightly to reduce gap visual if needed

    if (st.playoffs.thirdPlace) {
        const tpMatch = { 
            id: st.playoffs.thirdPlace, 
            ...st.playoffs.matches[st.playoffs.thirdPlace],
            isPlayable: isWeek11OrLater
        };
        thirdPlaceCell.appendChild(createRound('3rd Place Match', [tpMatch], st, playerTeam));
    } else {
        const emptyRound = createRound('3rd Place Match', [{id:null, team1:'TBD', team2:'TBD', isThirdPlace:true, bestOf:3}], st, playerTeam);
        thirdPlaceCell.appendChild(emptyRound);
    }
    playoffLayout.appendChild(thirdPlaceCell);

    playoffContainer.appendChild(playoffLayout);
    playoffSection.appendChild(playoffContainer);
    mainBracketEl.appendChild(playoffSection);

    // Champion display
    const finalId = st.playoffs.grandFinal;
    const finalMatch = finalId ? st.playoffs.matches[finalId] : null;

    if (finalMatch && finalMatch.winner) {
        const champBox = document.createElement('div');
        champBox.className = 'box champion-box';
        
        // Attempt to load logo if team exists
        const normalizedPath = finalMatch.winner.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
        
        let thirdPlaceHTML = '';
        if (thirdMatch && thirdMatch.winner) {
            const thirdNormalized = thirdMatch.winner.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
            thirdPlaceHTML = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">3rd Place</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="assets/team_logos/${thirdNormalized}.png" style="width: 30px; height: 30px; object-fit: contain;" onerror="this.style.display='none'">
                        <span style="font-weight: bold; color: #ddd;">${thirdMatch.winner}</span>
                    </div>
                </div>
            `;
        }

        champBox.innerHTML = `
            <div class="champion-label">Masters Bangkok Champion</div>
            <div class="champion-content">
                <img src="assets/team_logos/${normalizedPath}.png" class="champion-logo" onerror="this.style.display='none'">
                <div class="champion-name">${finalMatch.winner}</div>
            </div>
            <div class="champion-trophy">🏆</div>
            ${thirdPlaceHTML}
        `;
        mainBracketEl.appendChild(champBox);
    }
  }
}

function createRound(roundName, matches, st, playerTeam, teamRecords) {
  const roundDiv = document.createElement('div');
  roundDiv.className = 'round';
  const title = document.createElement('h4');
  title.textContent = roundName;
  roundDiv.appendChild(title);

  const matchesContainer = document.createElement('div');
  matchesContainer.className = 'matches-vertical';

  // Special request: Formatting based on rounds for bracket visualization
  if (roundName === 'Round 2' || roundName === 'Round 3') {
    matchesContainer.style.justifyContent = 'space-between';
    matchesContainer.style.height = '100%'; 
  } else if (roundName === 'Round 1') {
      matchesContainer.style.justifyContent = 'center'; // Center Round 1 vertically as well for aesthetics
      matchesContainer.style.height = '100%';
  } else {
    matchesContainer.style.justifyContent = 'flex-start';
  }

  if (teamRecords) {
    // Group matches by record
    const groups = {};
    matches.forEach(match => {
      // Determine record of team1 (or team2, they should match in Swiss)
      // Use team1 by default, fallback to 0-0 if not found
      const t1Record = teamRecords[match.team1] || { wins: 0, losses: 0 };
      const recordKey = `${t1Record.wins}-${t1Record.losses}`;
      
      if (!groups[recordKey]) groups[recordKey] = [];
      groups[recordKey].push(match);
    });
    
    // Sort groups: Wins desc, then Losses asc
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const [w1, l1] = a.split('-').map(Number);
      const [w2, l2] = b.split('-').map(Number);
      if (w1 !== w2) return w2 - w1; 
      return l1 - l2;
    });

    sortedKeys.forEach(key => {
      // Create a container for the group
      const groupDiv = document.createElement('div');
      groupDiv.className = 'match-group';
      
      // FIXED: Added overflow handling and spacing
      groupDiv.style.marginBottom = '20px';
      groupDiv.style.padding = '10px';
      groupDiv.style.backgroundColor = 'rgba(0,0,0,0.2)';
      groupDiv.style.borderRadius = '8px';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'match-group-header';
      // Inline styles moved to CSS class, keeping content logic
      
      const [w, l] = key.split('-');
      let label = `${w}-${l} Matches`;
      
      // Contextual labels
      if (w == 0 && l == 0) label = "Opening Matches (0-0)";
      else if (w == 1 && l == 0) label = "High Matches (1-0)";
      else if (w == 0 && l == 1) label = "Low Matches (0-1)";
      else if (w == 2 && l == 0) label = "Qualification Matches (2-0)";
      else if (w == 1 && l == 1) label = "Mid Matches (1-1)";
      else if (w == 0 && l == 2) label = "Elimination Matches (0-2)";
      else if (w == 2 && l == 1) label = "Qualification Matches (2-1)";
      else if (w == 1 && l == 2) label = "Elimination Matches (1-2)";
      else if (w == 2 && l == 2) label = "Decider Matches (2-2)";
      
      groupHeader.textContent = label;
      groupHeader.style.color = 'var(--bangkok-gold)';
      groupHeader.style.marginBottom = '10px';
      groupHeader.style.fontSize = '0.9em';
      groupHeader.style.fontWeight = 'bold';
      groupHeader.style.textTransform = 'uppercase';
      groupHeader.style.letterSpacing = '1px';
      
      groupDiv.appendChild(groupHeader);
      
      // Matches in this group
      groups[key].forEach(match => {
        const mData = (st.swiss && st.swiss.matches && st.swiss.matches[match.id]) || {};
        groupDiv.appendChild(createMatchBox(
          match.team1, match.team2, mData.winner, playerTeam, 
          match.id, match.bestOf || 3, match.isGrandFinal, mData.score, mData.mapResults,
          match.isPlayable
        ));
      });
      
      matchesContainer.appendChild(groupDiv);
    });

  } else {
    // Standard rendering (Playoffs / Series)
    matches.forEach(match => {
        const mData = (st.swiss && st.swiss.matches && st.swiss.matches[match.id]) || 
                      (st.playoffs && st.playoffs.matches && st.playoffs.matches[match.id]) || 
                      (st.series && st.series[match.id]) || {};
        
        matchesContainer.appendChild(createMatchBox(
          match.team1, match.team2, mData.winner, playerTeam, 
          match.id, match.bestOf || 3, match.isGrandFinal, mData.score, mData.mapResults,
          match.isPlayable
        ));
    });
  }
  
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
  t1Data.players?.filter(p => p.status === 'active').forEach(p => team1Obj.addPlayer(Player.fromJSON(p)));
  const team2Obj = new Team(t2Data.name, t2Data.id);
  t2Data.players?.filter(p => p.status === 'active').forEach(p => team2Obj.addPlayer(Player.fromJSON(p)));

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

  // Pre-generate map picks for the series
  // Ensure we have enough unique maps and no repeats
  const uniqueMapPool = [...new Set(mapPool)];
  const availableMaps = uniqueMapPool.sort(() => 0.5 - Math.random());
  const matchMaps = [];
  
  // Assign maps and pickers
  // Simple alternation for now: T2 picks first map, T1 picks second, etc.
  // BO3: T2, T1, Decider
  // BO5: T2, T1, T2, T1, Decider
  if (bestOf === 3) {
    matchMaps.push({ map: availableMaps[0], picker: t2Name });
    matchMaps.push({ map: availableMaps[1], picker: t1Name });
    matchMaps.push({ map: availableMaps[2], picker: 'Decider' });
  } else {
    // BO5
    matchMaps.push({ map: availableMaps[0], picker: t2Name });
    matchMaps.push({ map: availableMaps[1], picker: t1Name });
    matchMaps.push({ map: availableMaps[2], picker: t2Name });
    matchMaps.push({ map: availableMaps[3], picker: t1Name });
    matchMaps.push({ map: availableMaps[4], picker: 'Decider' });
  }

  let mapIndex = 0;

  while (t1Wins < winsNeeded && t2Wins < winsNeeded && mapIndex < matchMaps.length) {
    const currentMapObj = matchMaps[mapIndex];
    const mapName = currentMapObj.map;
    
    const sim = new MatchSimulator(team1Obj, team2Obj, [], strategies, mapName);
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
      map: mapName,
      score: `${team1Obj.score}-${team2Obj.score}`,
      picker: currentMapObj.picker
    });

    team1Obj.score = 0; team2Obj.score = 0;
    mapIndex++;
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
    console.log("Playoff Semifinal finished, checking if Grand Final and 3rd Place Match can be generated...");
    // If both semis are done, generate the GF and 3rd Place matchup
    const sf1 = st.playoffs.matches['M-PLAYOFF-SF1'];
    const sf2 = st.playoffs.matches['M-PLAYOFF-SF2'];
    if (sf1 && sf1.winner && sf2 && sf2.winner) {
      // Grand Final
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
      
      // 3rd Place Match
      st.playoffs.thirdPlace = 'M-PLAYOFF-3RD';
      st.playoffs.matches['M-PLAYOFF-3RD'] = {
        team1: sf1.loser,
        team2: sf2.loser,
        winner: null,
        score: null,
        playerStats: null,
        isThirdPlace: true,
        bestOf: 3
      };
      
      console.log(`Grand Final Set: ${sf1.winner} vs ${sf2.winner}`);
      console.log(`3rd Place Match Set: ${sf1.loser} vs ${sf2.loser}`);
    }
  }

  // Award Championship Points for winning Masters
  if (isGrandFinal || id === 'M-PLAYOFF-GF' || id === 'M-PLAYOFF-3RD') {
      const gfMatch = st.playoffs.matches['M-PLAYOFF-GF'];
      const tpMatch = st.playoffs.matches['M-PLAYOFF-3RD'];
      
      if (gfMatch && gfMatch.winner && tpMatch && tpMatch.winner) {
        st.complete = true;
        console.log(`Masters Bangkok Champion: ${gfMatch.winner}`);
        console.log(`Masters Bangkok 3rd Place: ${tpMatch.winner}`);

        // Award Championship Points for winning Masters
        if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
        
        // Ensure winner gets +3 points if not already added
        activeSave.championshipPoints[gfMatch.winner] = (activeSave.championshipPoints[gfMatch.winner] || 0) + 3;
        console.log(`CP: ${gfMatch.winner} gets +3 points for winning Masters.`);
      }
  }

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
