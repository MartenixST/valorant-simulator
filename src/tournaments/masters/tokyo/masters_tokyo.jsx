import { teams } from '../../../teams.js';
import { loadCareer, saveCareer, getSafeTeamByName } from "../../../career_local_storage.jsx";
import { Player, Team, MatchSimulator } from '../../../simulation.js';
import { automateMastersTournament } from '../masters_automation.js';

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

  // Determine if it's the 3rd place match
  const isThirdPlace = id === 'M-TOKYO-PLAYOFF-3RD';
  const matchTypeLabel = isGrandFinal ? 'Grand Final' : isThirdPlace ? '3rd Place' : '';
  
  if (matchTypeLabel) {
      const typeLabel = document.createElement('div');
      typeLabel.style.fontSize = '0.7em';
      typeLabel.style.color = '#9ae6b4';
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
          lockedLabel.textContent = '🔒 Week 32';
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

export function renderMastersTokyo(activeSave) {
  const mastersBracketEl = document.getElementById('mastersBracket');
  const mainBracketEl = document.getElementById('mastersMainBracket');
  const notQualMsg = document.getElementById('not-qualified-msg');
  const qualCountEl = document.getElementById('qualified-teams-count');
  
  if (!mastersBracketEl || !mainBracketEl) return;

  // Use mastersTokyoQualified (12 teams from regional playoffs) instead of qualifiedTeams (8 teams from kickoff)
  const tokyoQualified = activeSave.mastersTokyoQualified || {};
  const highSeeds = (tokyoQualified.highSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
  const lowSeeds = (tokyoQualified.lowSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
  const qualifiedTeams = [...highSeeds, ...lowSeeds];
  
  if (qualCountEl) {
    qualCountEl.textContent = qualifiedTeams.length;
  }

  if (qualifiedTeams.length < 8) {
    mastersBracketEl.style.display = 'none';
    notQualMsg.style.display = 'block';
    notQualMsg.className = 'progress-box';
    notQualMsg.innerHTML = `
      <div class="masters-header">
        <h1>Masters Tokyo 2025</h1>
        <p>Road to the Global Championship</p>
      </div>
      <div class="box">
        <h3>Qualification Status</h3>
        <p>The tournament requires 12 teams (3 per region). Currently <strong>${qualifiedTeams.length}</strong> teams have qualified via regional playoffs.</p>
        <div style="margin-top: 20px; background: rgba(255,255,255,0.05); height: 10px; border-radius: 5px; overflow: hidden;">
          <div style="background: #9ae6b4; width: ${(qualifiedTeams.length / 12) * 100}%; height: 100%; transition: width 0.5s ease;"></div>
        </div>
      </div>
    `;
    return;
  }

  mastersBracketEl.style.display = 'block';
  notQualMsg.style.display = 'none';

  // If no mastersTokyoState, show "Not started" unless we are in prep week (Week 23+)
  if (!activeSave.mastersTokyoState) {
    if ((activeSave.week >= 23) && qualifiedTeams.length >= 8) {
        const flatQualifiedTeams = [...new Set(
            qualifiedTeams
            .filter(t => t && (typeof t === 'string' || t.name))
            .map(t => typeof t === 'string' ? t : t.name)
        )];

        if (flatQualifiedTeams.length >= 12) {
            activeSave.mastersTokyoState = {
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
                activeSave.mastersTokyoState.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
            });
            saveCareer(activeSave);
            try {
                const event = new CustomEvent('careerUpdate', { detail: activeSave });
                window.parent.dispatchEvent(event);
            } catch (e) {}
        } else {
            mainBracketEl.innerHTML = '<div class="box"><p>Masters Tokyo will begin in Week 25 after the break weeks.</p></div>';
            return;
        }
    } else {
        mainBracketEl.innerHTML = '<div class="box"><p>Masters Tokyo will begin in Week 25 after the break weeks.</p></div>';
        return;
    }
  }

  const st = activeSave.mastersTokyoState;
  const playerTeam = activeSave.team;
  const currentWeek = activeSave?.week || 0;

  // AUTO-COMPLETE CHECK: If GF has a winner but not marked complete, fix it
  if (!st.complete && st.playoffs && st.playoffs.grandFinal) {
    const gfMatch = st.playoffs.matches[st.playoffs.grandFinal];
    if (gfMatch && gfMatch.winner) {
      st.complete = true;
      saveCareer(activeSave);
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
      <h1>Masters Tokyo</h1>
    </div>
    <div class="header-divider"></div>
    <p>Season 2025 • Swiss Stage & Playoffs</p>
  `;
  mainBracketEl.appendChild(header);

  // --- PREPARATION PHASE SPECIAL VIEW ---
  if (currentWeek < 25 && !st.complete && (!st.swiss.rounds || st.swiss.rounds.length === 0)) {
     const prepSection = document.createElement('div');
     prepSection.innerHTML = `
        <div class="progress-box">
            <h4>Preparation Phase</h4>
            <p>Teams are currently in the preparation phase. The Swiss Stage matches will begin in Week 25.</p>
        </div>
     `;
     
     // Show Regional #1 Seeds (directly qualified for playoffs)
     let seeds = st.playoffs?.regionalSeeds || {};
     
     // FALLBACK: Extract #1 seeds from highSeeds in mastersTokyoQualified
     if (Object.keys(seeds).length < 4) {
         const extractedSeeds = {};
         const regions = ['americas', 'emea', 'pacific', 'china'];
         
         // Map high seeds to regions based on their position in the array
         // highSeeds[0]=Americas #1, highSeeds[1]=EMEA #1, etc.
         highSeeds.forEach((teamName, index) => {
             if (teamName && regions[index]) {
                 extractedSeeds[regions[index]] = teamName;
             }
         });
         
         seeds = extractedSeeds;
     }
     
     const seedTeams = Object.entries(seeds).filter(([region, team]) => team);
     
     if (seedTeams.length > 0) {
        const seedsHeader = document.createElement('h3');
        seedsHeader.style.cssText = 'margin: 20px 0 10px; color: #FFD700; font-family: "Valorant", sans-serif; font-size: 1.2rem;';
        seedsHeader.innerHTML = 'Regional #1 Seeds (Direct Playoff Qualifiers)';
        prepSection.appendChild(seedsHeader);
        
        const seedsGrid = document.createElement('div');
        seedsGrid.className = 'qualified-grid';
        
        seedTeams.forEach(([region, teamName]) => {
           const teamCard = document.createElement('div');
           teamCard.className = 'qualified-card';
           teamCard.style.borderLeft = '3px solid #FFD700';
           const normalizedPath = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
           
           teamCard.innerHTML = `
               <img src="assets/team_logos/${normalizedPath}.png" onerror="this.src='assets/qmark.png'">
               <div class="qualified-info">
                   <span class="qualified-region" style="color: #FFD700;">${region.charAt(0).toUpperCase() + region.slice(1)} #1 Seed</span>
                   <span class="qualified-name">${teamName}</span>
               </div>
           `;
           seedsGrid.appendChild(teamCard);
        });
        
        prepSection.appendChild(seedsGrid);
     }
     
     // Show Swiss Stage Teams (excluding #1 seeds)
     const swissHeader = document.createElement('h3');
     swissHeader.style.cssText = 'margin: 20px 0 10px; color: #fff; font-family: "Valorant", sans-serif; font-size: 1.2rem;';
     swissHeader.innerHTML = 'Swiss Stage Teams';
     prepSection.appendChild(swissHeader);
     
     const grid = document.createElement('div');
     grid.className = 'qualified-grid';
     
     // Filter out #1 seeds from Swiss Stage display
     const seedNames = Object.values(seeds).filter(Boolean);
     const flatQualifiedTeams = Object.keys(st.swiss.teamStats).filter(t => !seedNames.includes(t));

     flatQualifiedTeams.forEach(teamName => {
        const teamCard = document.createElement('div');
        teamCard.className = 'qualified-card';
        const normalizedPath = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
        
        // Find team region and seed number
        let region = 'International';
        let seedNum = '';
        
        // Determine region and seed from mastersTokyoQualified structure
        // highSeeds = [#1 Americas, #1 EMEA, #1 Pacific, #1 China]
        // lowSeeds = [#2 Americas, #3 Americas, #2 EMEA, #3 EMEA, #2 Pacific, #3 Pacific, #2 China, #3 China]
        const regions = ['americas', 'emea', 'pacific', 'china'];
        
        // Check if team is in highSeeds (shouldn't happen since we filter them out, but just in case)
        const highSeedIndex = highSeeds.indexOf(teamName);
        if (highSeedIndex !== -1) {
            region = regions[highSeedIndex].charAt(0).toUpperCase() + regions[highSeedIndex].slice(1);
            seedNum = '#1 SEED';
        } else {
            // Check lowSeeds - they're ordered by region: 2 Americas, 3 Americas, 2 EMEA, 3 EMEA, etc.
            const lowSeedIndex = lowSeeds.indexOf(teamName);
            if (lowSeedIndex !== -1) {
                const regionIndex = Math.floor(lowSeedIndex / 2);
                const isThirdSeed = lowSeedIndex % 2 === 1;
                if (regionIndex < regions.length) {
                    region = regions[regionIndex].charAt(0).toUpperCase() + regions[regionIndex].slice(1);
                    seedNum = isThirdSeed ? '#3 SEED' : '#2 SEED';
                }
            }
        }

        teamCard.innerHTML = `
            <img src="assets/team_logos/${normalizedPath}.png" onerror="this.src='assets/qmark.png'">
            <div class="qualified-info">
                <span class="qualified-region">${region} ${seedNum}</span>
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
  progressBox.style.borderLeft = '4px solid #9ae6b4';

  let currentPhase = 'Not Started';
  let nextStep = 'Next round will be simulated when you click "Simulate Week" in your office.';

  if (st.complete) {
    currentPhase = 'Tournament Complete';
    nextStep = 'The tournament has concluded. Congratulations to the champion!';
  } else if (currentWeek < 25) {
    currentPhase = 'Preparation Phase';
    nextStep = 'Teams are currently in the preparation phase. The Swiss Stage matches will begin in Week 25.';
  } else if (st.playoffs && st.playoffs.grandFinal && st.playoffs.matches[st.playoffs.grandFinal]?.score) {
    currentPhase = 'Grand Final Complete';
  } else if (st.playoffs && st.playoffs.grandFinal) {
    currentPhase = 'Playoffs - Grand Final';
  } else if (st.playoffs && st.playoffs.upper?.round1?.length > 0) {
    currentPhase = 'Playoffs - Quarterfinals';
  } else if (st.swiss && st.swiss.rounds.length > 0) {
    currentPhase = `Swiss Stage - Round ${st.swiss.rounds.length}`;
    const activeSwissTeams = Object.values(st.swiss.teamStats).filter(s => !s.qualified && !s.eliminated).length;
    if (activeSwissTeams === 0) {
      currentPhase = 'Swiss Stage Complete';
    }
  }

  progressBox.innerHTML = `
    <h4 style="margin:0 0 5px 0; color:#9ae6b4; font-family:'Valorant', sans-serif; letter-spacing:1px; font-size: 1rem;">Current Phase: ${currentPhase}</h4>
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
      
      // Swiss locking: All Swiss rounds playable during Weeks 25-27
      const isSwissRoundPlayable = currentWeek >= 25 && currentWeek <= 27;
      
      // Create round with current records snapshot
      const roundDiv = createRound(`Round ${round.round}`, roundMatches, st, playerTeam, JSON.parse(JSON.stringify(teamRecords)), isSwissRoundPlayable);
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

  // 2. Playoffs Section (8-Team Double Elimination with Enhanced Design)
  if (st.playoffs) {
    const playoffSection = document.createElement('div');
    playoffSection.className = 'bracket-section';
    playoffSection.style.marginTop = '30px';
    playoffSection.innerHTML = `
      <h3 style="text-align: center; color: #FFD700; font-size: 24px; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);">
        🏆 Double Elimination Bracket 🏆
      </h3>
    `;

    const playoffContainer = document.createElement('div');
    playoffContainer.className = 'bracket-wrapper';
    playoffContainer.style.padding = '20px';
    playoffContainer.style.background = 'linear-gradient(135deg, rgba(26, 32, 44, 0.8) 0%, rgba(45, 55, 72, 0.6) 100%)';
    playoffContainer.style.borderRadius = '16px';
    playoffContainer.style.border = '1px solid rgba(255, 215, 0, 0.2)';
    
    // Create bracket layout with visual flow
    const bracketWrapper = document.createElement('div');
    bracketWrapper.style.display = 'flex';
    bracketWrapper.style.flexDirection = 'column';
    bracketWrapper.style.gap = '30px';
    
    const isPlayoffsPlayable = currentWeek >= 28;
    const isFinalsPlayable = currentWeek >= 32;
    
    // UPPER BRACKET SECTION
    const ubSection = document.createElement('div');
    ubSection.style.display = 'flex';
    ubSection.style.flexDirection = 'column';
    ubSection.style.gap = '15px';
    
    const ubHeader = document.createElement('div');
    ubHeader.style.textAlign = 'center';
    ubHeader.style.padding = '12px 24px';
    ubHeader.style.background = 'linear-gradient(90deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.1) 50%, rgba(255, 215, 0, 0.2) 100%)';
    ubHeader.style.borderRadius = '8px';
    ubHeader.style.border = '1px solid rgba(255, 215, 0, 0.4)';
    ubHeader.innerHTML = `
      <span style="color: #FFD700; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 2px;">
        👑 Upper Bracket (Winners Path)
      </span>
    `;
    ubSection.appendChild(ubHeader);
    
    // UB Rounds Grid
    const ubGrid = document.createElement('div');
    ubGrid.style.display = 'grid';
    ubGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    ubGrid.style.gap = '20px';
    ubGrid.style.alignItems = 'center';
    
    // UB Round 1 (4 matches) - spread across 2 rows
    let ubR1Matches = st.playoffs.upper?.round1 || [];
    
    // VALIDATION: Check for duplicate teams in Round 1 (prevents corrupted bracket display)
    if (ubR1Matches.length > 0) {
      const teamsInR1 = new Set();
      const duplicates = [];
      ubR1Matches.forEach(id => {
        const match = st.playoffs.matches[id];
        if (match) {
          if (teamsInR1.has(match.team1)) duplicates.push(match.team1);
          if (teamsInR1.has(match.team2)) duplicates.push(match.team2);
          teamsInR1.add(match.team1);
          teamsInR1.add(match.team2);
        }
      });
      
      if (duplicates.length > 0) {
        console.error(`CRITICAL: Duplicate teams detected in playoff bracket: ${duplicates.join(', ')}. Resetting bracket...`);
        // Reset the playoff bracket to prevent corrupted display
        st.playoffs.upper.round1 = [];
        st.playoffs.upper.round2 = [];
        st.playoffs.upper.final = null;
        st.playoffs.lower.round1 = [];
        st.playoffs.lower.round2 = [];
        st.playoffs.lower.final = null;
        st.playoffs.grandFinal = null;
        ubR1Matches = [];
        
        // Show error message in UI
        const errorMsg = document.createElement('div');
        errorMsg.style.background = 'rgba(255, 0, 0, 0.2)';
        errorMsg.style.border = '1px solid rgba(255, 0, 0, 0.5)';
        errorMsg.style.borderRadius = '8px';
        errorMsg.style.padding = '15px';
        errorMsg.style.marginBottom = '20px';
        errorMsg.style.color = '#ff6b6b';
        errorMsg.style.textAlign = 'center';
        errorMsg.innerHTML = `
          <strong>⚠️ Bracket Error Detected</strong><br>
          Duplicate teams found: ${duplicates.join(', ')}<br>
          <span style="font-size: 12px;">The bracket has been reset. Please simulate the week again to regenerate matches.</span>
        `;
        mainBracketEl.appendChild(errorMsg);
      }
    }
    
    const ubR1Data = ubR1Matches.length > 0 
      ? ubR1Matches.map(id => ({ id, ...st.playoffs.matches[id] }))
      : [{id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}];
    
    const ubR1Cell = document.createElement('div');
    ubR1Cell.style.gridColumn = '1';
    ubR1Cell.style.display = 'flex';
    ubR1Cell.style.flexDirection = 'column';
    ubR1Cell.style.gap = '10px';
    ubR1Cell.appendChild(createRound('Quarterfinals (4 Matches)', ubR1Data.slice(0, 2), st, playerTeam, null, isPlayoffsPlayable));
    ubR1Cell.appendChild(createRound('', ubR1Data.slice(2, 4), st, playerTeam, null, isPlayoffsPlayable));
    ubGrid.appendChild(ubR1Cell);
    
    // UB Round 2 (2 matches)
    const ubR2Matches = st.playoffs.upper?.round2 || [];
    const ubR2Data = ubR2Matches.length > 0 
      ? ubR2Matches.map(id => ({ id, ...st.playoffs.matches[id] }))
      : (ubR1Matches.length === 4 ? [{id:null, team1:'TBD', team2:'TBD'}, {id:null, team1:'TBD', team2:'TBD'}] : []);
    
    const ubR2Cell = document.createElement('div');
    ubR2Cell.style.gridColumn = '2';
    ubR2Cell.style.display = 'flex';
    ubR2Cell.style.flexDirection = 'column';
    ubR2Cell.style.gap = '10px';
    ubR2Cell.style.justifyContent = 'center';
    if (ubR2Data.length > 0 || ubR1Matches.length === 4) {
      ubR2Cell.appendChild(createRound('Semifinals (2 Matches)', ubR2Data, st, playerTeam, null, isPlayoffsPlayable));
    }
    ubGrid.appendChild(ubR2Cell);
    
    // UB Final (1 match)
    const ubFinalId = st.playoffs.upper?.final;
    const ubFinalData = ubFinalId 
      ? [{ id: ubFinalId, ...st.playoffs.matches[ubFinalId] }]
      : (ubR2Matches.length === 2 ? [{id:null, team1:'TBD', team2:'TBD'}] : []);
    
    const ubFinalCell = document.createElement('div');
    ubFinalCell.style.gridColumn = '3';
    ubFinalCell.style.display = 'flex';
    ubFinalCell.style.flexDirection = 'column';
    ubFinalCell.style.justifyContent = 'center';
    if (ubFinalData.length > 0) {
      ubFinalCell.appendChild(createRound('👑 Upper Final', ubFinalData, st, playerTeam, null, isPlayoffsPlayable));
    }
    ubGrid.appendChild(ubFinalCell);
    
    ubSection.appendChild(ubGrid);
    bracketWrapper.appendChild(ubSection);
    
    // LOWER BRACKET SECTION
    const lbSection = document.createElement('div');
    lbSection.style.display = 'flex';
    lbSection.style.flexDirection = 'column';
    lbSection.style.gap = '15px';
    
    const lbHeader = document.createElement('div');
    lbHeader.style.textAlign = 'center';
    lbHeader.style.padding = '12px 24px';
    lbHeader.style.background = 'linear-gradient(90deg, rgba(154, 230, 180, 0.2) 0%, rgba(154, 230, 180, 0.1) 50%, rgba(154, 230, 180, 0.2) 100%)';
    lbHeader.style.borderRadius = '8px';
    lbHeader.style.border = '1px solid rgba(154, 230, 180, 0.4)';
    lbHeader.innerHTML = `
      <span style="color: #9ae6b4; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 2px;">
        ⚔️ Lower Bracket (Elimination Path)
      </span>
    `;
    lbSection.appendChild(lbHeader);
    
    // LB Rounds Grid
    const lbGrid = document.createElement('div');
    lbGrid.style.display = 'grid';
    lbGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    lbGrid.style.gap = '20px';
    lbGrid.style.alignItems = 'center';
    
    // LB Round 1 (2 elimination matches)
    const lbR1Matches = st.playoffs.lower?.round1 || [];
    const lbR1Data = lbR1Matches.length > 0 
      ? lbR1Matches.map(id => ({ id, ...st.playoffs.matches[id], note: 'Loser eliminated (5th-8th)' }))
      : (ubR1Matches.length === 4 ? [{id:null, team1:'TBD', team2:'TBD', note:'5th-8th place'}, {id:null, team1:'TBD', team2:'TBD', note:'5th-8th place'}] : []);
    
    const lbR1Cell = document.createElement('div');
    lbR1Cell.style.gridColumn = '1';
    if (lbR1Data.length > 0 || ubR1Matches.length === 4) {
      lbR1Cell.appendChild(createRound('Round 1 (2 Elim.)', lbR1Data, st, playerTeam, null, isPlayoffsPlayable));
    }
    lbGrid.appendChild(lbR1Cell);
    
    // LB Round 2 (2 elimination matches)
    const lbR2Matches = st.playoffs.lower?.round2 || [];
    const lbR2Data = lbR2Matches.length > 0 
      ? lbR2Matches.map(id => ({ id, ...st.playoffs.matches[id], note: 'Loser eliminated (3rd-4th)' }))
      : (lbR1Matches.length === 2 && ubR2Matches.length === 2 ? [{id:null, team1:'TBD', team2:'TBD', note:'3rd-4th place'}, {id:null, team1:'TBD', team2:'TBD', note:'3rd-4th place'}] : []);
    
    const lbR2Cell = document.createElement('div');
    lbR2Cell.style.gridColumn = '2';
    if (lbR2Data.length > 0) {
      lbR2Cell.appendChild(createRound('Round 2 (2 Elim.)', lbR2Data, st, playerTeam, null, isPlayoffsPlayable));
    }
    lbGrid.appendChild(lbR2Cell);
    
    // LB Final (1 match)
    const lbFinalId = st.playoffs.lower?.final;
    const lbFinalData = lbFinalId 
      ? [{ id: lbFinalId, ...st.playoffs.matches[lbFinalId] }]
      : (lbR2Matches.length === 2 ? [{id:null, team1:'TBD', team2:'TBD'}] : []);
    
    const lbFinalCell = document.createElement('div');
    lbFinalCell.style.gridColumn = '3';
    if (lbFinalData.length > 0) {
      lbFinalCell.appendChild(createRound('⚔️ Lower Final', lbFinalData, st, playerTeam, null, isPlayoffsPlayable));
    }
    lbGrid.appendChild(lbFinalCell);
    
    lbSection.appendChild(lbGrid);
    bracketWrapper.appendChild(lbSection);
    
    // GRAND FINAL SECTION
    const gfSection = document.createElement('div');
    gfSection.style.display = 'flex';
    gfSection.style.flexDirection = 'column';
    gfSection.style.gap = '15px';
    gfSection.style.alignItems = 'center';
    gfSection.style.padding = '20px';
    gfSection.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 100, 100, 0.1) 100%)';
    gfSection.style.borderRadius = '12px';
    gfSection.style.border = '2px solid rgba(255, 215, 0, 0.3)';
    
    const gfHeader = document.createElement('div');
    gfHeader.innerHTML = `
      <span style="color: #FFD700; font-weight: bold; font-size: 20px; text-transform: uppercase; letter-spacing: 3px;">
        🏆 GRAND FINAL 🏆
      </span>
    `;
    gfSection.appendChild(gfHeader);
    
    // GF Match
    const gfId = st.playoffs.grandFinal;
    if (gfId) {
      const match = { id: gfId, ...st.playoffs.matches[gfId], isGrandFinal: true, bestOf: 5 };
      gfSection.appendChild(createRound('', [match], st, playerTeam, null, isFinalsPlayable));
    } else if (ubFinalId && lbFinalId) {
      gfSection.appendChild(createRound('', [{id:null, team1:'TBD', team2:'TBD', isGrandFinal:true, bestOf:5}], st, playerTeam, null, false));
    }
    
    // Bracket Reset info
    const firstGFId = st.playoffs.firstGrandFinal;
    if (firstGFId && st.playoffs.matches[firstGFId]?.bracketResetPlayed) {
      const firstGFMatch = st.playoffs.matches[firstGFId];
      const resetInfo = document.createElement('div');
      resetInfo.style.marginTop = '10px';
      resetInfo.style.padding = '10px 20px';
      resetInfo.style.background = 'rgba(255, 100, 100, 0.2)';
      resetInfo.style.borderRadius = '8px';
      resetInfo.style.border = '1px solid rgba(255, 100, 100, 0.4)';
      resetInfo.innerHTML = `
        <div style="color: #ff6b6b; font-size: 14px; text-align: center;">
          ⚠️ Bracket Reset Required<br>
          <span style="font-size: 12px;">${firstGFMatch.winner} won first series - UB winner gets second chance</span>
        </div>
      `;
      gfSection.appendChild(resetInfo);
    }
    
    // Bracket Reset match (if needed)
    const gfResetId = 'M-TOKYO-PLAYOFF-GF-RESET';
    if (st.playoffs.matches[gfResetId]) {
      const resetMatch = { id: gfResetId, ...st.playoffs.matches[gfResetId], isGrandFinal: true, bestOf: 5, note: 'Bracket Reset Match' };
      const resetSection = document.createElement('div');
      resetSection.style.display = 'flex';
      resetSection.style.flexDirection = 'column';
      resetSection.style.gap = '10px';
      resetSection.style.alignItems = 'center';
      resetSection.style.padding = '15px';
      resetSection.style.background = 'rgba(255, 100, 100, 0.15)';
      resetSection.style.borderRadius = '8px';
      resetSection.style.border = '1px solid rgba(255, 100, 100, 0.3)';
      resetSection.innerHTML = `<span style="color: #ff6b6b; font-weight: bold;">🏆 BRACKET RESET MATCH</span>`;
      resetSection.appendChild(createRound('', [resetMatch], st, playerTeam, null, isFinalsPlayable));
      gfSection.appendChild(resetSection);
    }
    
    bracketWrapper.appendChild(gfSection);
    playoffContainer.appendChild(bracketWrapper);
    playoffSection.appendChild(playoffContainer);
    mainBracketEl.appendChild(playoffSection);

    // Champion display
    const finalId = st.playoffs.grandFinal;
    const finalMatch = finalId ? st.playoffs.matches[finalId] : null;

    if (finalMatch && finalMatch.winner && st.complete) {
        const champBox = document.createElement('div');
        champBox.className = 'box champion-box';
        
        const normalizedPath = finalMatch.winner.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
        
        // Check if this was after a bracket reset
        const hadReset = st.playoffs.firstGrandFinal && st.playoffs.matches[st.playoffs.firstGrandFinal]?.bracketResetPlayed;
        const resetNote = hadReset ? '<div style="font-size: 12px; color: #FFD700; margin-top: 5px;">(Won via Bracket Reset)</div>' : '';

        champBox.innerHTML = `
            <div class="champion-label">Masters Tokyo Champion</div>
            <div class="champion-content">
                <img src="assets/team_logos/${normalizedPath}.png" class="champion-logo" onerror="this.style.display='none'">
                <div class="champion-name">${finalMatch.winner}</div>
                ${resetNote}
            </div>
            <div class="champion-trophy">🏆</div>
        `;
        mainBracketEl.appendChild(champBox);
    }
  }
}

function createRound(roundName, matches, st, playerTeam, teamRecords, isPlayable = true) {
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
      matchesContainer.style.justifyContent = 'center';
      matchesContainer.style.height = '100%';
  } else {
    matchesContainer.style.justifyContent = 'flex-start';
  }

  if (teamRecords) {
    // Group matches by record
    const groups = {};
    matches.forEach(match => {
      // Determine record of team1 (or team2, they should match in Swiss)
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
      groupHeader.style.color = '#9ae6b4';
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
          match.isPlayable !== undefined ? match.isPlayable : isPlayable
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
          match.isPlayable !== undefined ? match.isPlayable : isPlayable
        ));
    });
  }
  
  roundDiv.appendChild(matchesContainer);
  return roundDiv;
}

function mastersTokyoWatchSeries(id, team1, team2, bestOf, isGrandFinal) {
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
  const st = activeSave.mastersTokyoState;
  if (!st.series) st.series = {};
  if (!st.swiss) st.swiss = { matches: {}, teamStats: {}, rounds: [] };
  if (!st.playoffs) st.playoffs = { matches: {}, semifinals: [], grandFinal: null };

  // Use the specific match storage based on ID prefix
  let matchData;
  if (id.startsWith('M-TOKYO-SWISS')) {
    if (!st.swiss.matches[id]) st.swiss.matches[id] = {};
    matchData = st.swiss.matches[id];
  } else if (id.startsWith('M-TOKYO-PLAYOFF')) {
    if (!st.playoffs.matches[id]) st.playoffs.matches[id] = {};
    matchData = st.playoffs.matches[id];
  } else {
    if (!st.series[id]) st.series[id] = {};
    matchData = st.series[id];
  }

  // Pre-generate map picks for the series
  const uniqueMapPool = [...new Set(mapPool)];
  const availableMaps = uniqueMapPool.sort(() => 0.5 - Math.random());
  const matchMaps = [];
  
  // Assign maps and pickers
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
  if (id.startsWith('M-TOKYO-SWISS')) {
    if (st.swiss.teamStats && st.swiss.teamStats[winner]) {
      st.swiss.teamStats[winner].wins++;
      st.swiss.teamStats[loser].losses++;
      if (st.swiss.teamStats[winner].wins === 2) st.swiss.teamStats[winner].qualified = true;
      if (st.swiss.teamStats[loser].losses === 2) st.swiss.teamStats[loser].eliminated = true;
    }
  }

  // Update Playoffs progression if it's a Playoff match
  if (id.startsWith('M-TOKYO-PLAYOFF-SF')) {
    if (st.playoffs.matches['M-TOKYO-PLAYOFF-SF1'] && st.playoffs.matches['M-TOKYO-PLAYOFF-SF1'].winner && st.playoffs.matches['M-TOKYO-PLAYOFF-SF2'] && st.playoffs.matches['M-TOKYO-PLAYOFF-SF2'].winner) {
      // Grand Final
      st.playoffs.grandFinal = 'M-TOKYO-PLAYOFF-GF';
      st.playoffs.matches['M-TOKYO-PLAYOFF-GF'] = {
        team1: st.playoffs.matches['M-TOKYO-PLAYOFF-SF1'].winner,
        team2: st.playoffs.matches['M-TOKYO-PLAYOFF-SF2'].winner,
        winner: null,
        score: null,
        playerStats: null,
        isGrandFinal: true,
        bestOf: 5
      };
      
      // 3rd Place Match
      st.playoffs.thirdPlace = 'M-TOKYO-PLAYOFF-3RD';
      st.playoffs.matches['M-TOKYO-PLAYOFF-3RD'] = {
        team1: st.playoffs.matches['M-TOKYO-PLAYOFF-SF1'].loser,
        team2: st.playoffs.matches['M-TOKYO-PLAYOFF-SF2'].loser,
        winner: null,
        score: null,
        playerStats: null,
        isThirdPlace: true,
        bestOf: 3
      };
    }
  }

  // Award Championship Points for winning Masters Tokyo
  if (isGrandFinal || id === 'M-TOKYO-PLAYOFF-GF' || id === 'M-TOKYO-PLAYOFF-3RD') {
    const gfMatch = st.playoffs.matches['M-TOKYO-PLAYOFF-GF'];
    const tpMatch = st.playoffs.matches['M-TOKYO-PLAYOFF-3RD'];
    
    if (gfMatch && gfMatch.winner && tpMatch && tpMatch.winner) {
      st.complete = true;
      if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
      const tpMatch = st.playoffs.matches['M-TOKYO-PLAYOFF-3RD'];
      
      if (gfMatch && gfMatch.winner && tpMatch && tpMatch.winner) {
        st.complete = true;
        console.log(`Masters Tokyo Champion: ${gfMatch.winner}`);
        console.log(`Masters Tokyo 3rd Place: ${tpMatch.winner}`);

        // Award Championship Points for winning Masters
        if (!activeSave.championshipPoints) activeSave.championshipPoints = {};
        
        // Ensure winner gets +3 points
        activeSave.championshipPoints[gfMatch.winner] = (activeSave.championshipPoints[gfMatch.winner] || 0) + 3;
        console.log(`CP: ${gfMatch.winner} gets +3 points for winning Masters Tokyo.`);
      }
    }
  }

  saveCareer(activeSave);
  
  // Notify parent React app of the update
  try {
    const event = new CustomEvent('careerUpdate', { detail: activeSave });
    window.parent.dispatchEvent(event);
    window.parent.postMessage({ type: 'careerUpdate', data: activeSave }, window.location.origin);
  } catch (e) {
    console.warn("Failed to notify parent of career update:", e);
  }

  renderMastersTokyo(activeSave);
}
