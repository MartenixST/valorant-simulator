import { teams } from '../../teams.js';
import { loadCareer, saveCareer, getSafeTeamByName } from "../../career_local_storage.jsx";
import { initializeRegularSeason, generatePlayoffsBracket, simulatePlayoffsRound } from './regular_season_logic.js';
import { Player, Team, MatchSimulator, MAP_COORDINATES } from '../../simulation.js';
import { automateMastersTokyo } from '../masters/tokyo/masters_tokyo_automation.js';


// Helper to generate a random strategy for AI teams
const generateAiStrategy = () => {
    const playstyles = ['aggressive', 'defensive', 'balanced'];
    const focuses = ['standard', 'entry', 'map-control', 'tactical'];
    const ecos = ['standard', 'greedy', 'safe'];

    return {
        playstyle: playstyles[Math.floor(Math.random() * playstyles.length)],
        focus: focuses[Math.floor(Math.random() * focuses.length)],
        eco: ecos[Math.floor(Math.random() * ecos.length)]
    };
};

// Helper to simulate a single match
const simulateRegularSeasonMatch = (team1Data, team2Data, savePlayers, strategies = {}) => {
    // 1. Prepare Team objects
    const t1 = new Team(team1Data.name, team1Data.id);
    const t2 = new Team(team2Data.name, team2Data.id);

    // 2. Assign players to teams
    // PRIORITIZE: If teamData already has players (from getSafeTeamByName), use them directly!
    // This fixes the "wrong players" issue by relying on the central source of truth for rosters.
    const getPlayersFromSource = (teamData) => {
        if (teamData.players && teamData.players.length > 0) {
            // STRICT FILTER: Only allow active players
            // Adverso (bench/inactive) should NOT be included if status is 'inactive' or 'bench'
            const activePlayers = teamData.players.filter(p => {
                // Check status if it exists
                if (p.status && (String(p.status).toLowerCase() === 'inactive' || String(p.status).toLowerCase() === 'bench')) return false;
                return true;
            });

            // First, prioritize starters
            // Handle both boolean true and string "true"
            const starters = activePlayers.filter(p => p.isStarter === true || p.isStarter === 'true');
            
            if (starters.length >= 5) {
                // If we have enough starters, take the top 5 by overall
                return starters.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 5);
            } else {
                // If not enough starters, fill with best remaining ACTIVE players
                const remainder = activePlayers
                    .filter(p => p.isStarter !== true && p.isStarter !== 'true')
                    .sort((a, b) => (b.overall || 0) - (a.overall || 0));
                return [...starters, ...remainder].slice(0, 5);
            }
        }

        // Fallback: Filter from savePlayers (legacy method, less reliable for transfers)
        const candidates = savePlayers.filter(p => {
            if (p.status && (String(p.status).toLowerCase() === 'inactive' || String(p.status).toLowerCase() === 'bench')) return false;
            // if (p.status !== 'active') return false; // Strict active check - REMOVED to allow missing status
            
            const pTeamId = p.teamId ? String(p.teamId) : null;
            const tId = teamData.id ? String(teamData.id) : null;
            if (tId && pTeamId) return pTeamId === tId;
            const normalize = (n) => String(n || '').toLowerCase().trim();
            const pTeamNameNorm = normalize(p.team);
            const tNameNorm = normalize(teamData.name);
            return teamData.name && pTeamNameNorm && pTeamNameNorm === tNameNorm;
        });

        const starters = candidates.filter(p => p.isStarter === true);
        if (starters.length > 0) {
            if (starters.length >= 5) {
                 return starters.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 5);
            } else {
                 const nonStarters = candidates.filter(p => !p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));
                 return [...starters, ...nonStarters].slice(0, 5);
            }
        }
        return candidates.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 5);
    };

    const t1Players = getPlayersFromSource(team1Data);
    const t2Players = getPlayersFromSource(team2Data);

    t1.players = t1Players.map(p => (p instanceof Player) ? p : Player.fromJSON(p));
    t2.players = t2Players.map(p => (p instanceof Player) ? p : Player.fromJSON(p));

    // 3. Simulate match (BO3)
    let t1Maps = 0;
    let t2Maps = 0;
    const mapResults = [];
    const allPlayerStats = {};
    const matchLogs = [];

    [...t1.players, ...t2.players].forEach(p => {
      p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
      allPlayerStats[p.id] = {
        name: p.name,
        teamId: p.teamId,
        teamName: p.teamId === String(team1Data.id) ? team1Data.name : team2Data.name,
        kills: 0, deaths: 0, assists: 0, damage: 0, hs: 0, rounds: 0
      };
    });

    const uniqueMapPool = [...new Set(Object.keys(MAP_COORDINATES))];
    const availableMaps = uniqueMapPool.sort(() => 0.5 - Math.random());
    const matchMaps = [];
    matchMaps.push({ map: availableMaps[0], picker: team2Data.name });
    matchMaps.push({ map: availableMaps[1], picker: team1Data.name });
    matchMaps.push({ map: availableMaps[2], picker: 'Decider' });

    let mapIndex = 0;
    while (t1Maps < 2 && t2Maps < 2 && mapIndex < matchMaps.length) {
      t1.score = 0; t2.score = 0; t1.side = 'attack'; t2.side = 'defense';
      const currentMapObj = matchMaps[mapIndex];
      const randomMap = currentMapObj.map;
      const picker = currentMapObj.picker;
      mapIndex++;
      
      [...t1.players, ...t2.players].forEach(p => {
          p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
          p.kills = 0; p.deaths = 0; p.assists = 0;
      });

      const matchSim = new MatchSimulator(t1, t2, [], strategies, randomMap);
      matchSim.simulateMatch();

      const mapScore = `${t1.score}-${t2.score}`;
      mapResults.push({ score: mapScore, map: randomMap, picker: picker });
      matchLogs.push({ map: mapResults.length, mapName: randomMap, score: mapScore }); 

      if (t1.score >= 13) t1Maps++;
      else t2Maps++;

      [...t1.players, ...t2.players].forEach(p => {
        if (allPlayerStats[p.id]) {
          allPlayerStats[p.id].kills += p.stats.kills;
          allPlayerStats[p.id].deaths += p.stats.deaths;
          allPlayerStats[p.id].assists += p.stats.assists;
          allPlayerStats[p.id].damage += p.stats.damageDealt;
          allPlayerStats[p.id].hs += p.stats.hs;
          allPlayerStats[p.id].rounds += (t1.score + t2.score);
        }
      });
    }

    return {
      winner: t1Maps > t2Maps ? team1Data.name : team2Data.name,
      loser: t1Maps > t2Maps ? team2Data.name : team1Data.name,
      score: `${t1Maps}-${t2Maps}`,
      playerStats: allPlayerStats,
      mapResults: mapResults,
      logs: matchLogs
    };
};

let currentRegion = 'Americas'; // Default
let currentWeekFilter = 'all';
let currentView = 'groups'; // 'groups' or 'playoffs'
let isInitialized = false;


// Helper to check and apply playoff match results from localStorage
function checkPlayoffResults(rsState, activeSave) {
    let stateUpdated = false;
    const regions = ["Americas", "EMEA", "Pacific", "China"];
    
    // Check for match results
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('matchResult_RS-')) {
            try {
                const matchResult = JSON.parse(localStorage.getItem(key));
                if (matchResult && matchResult.id) {
                    let matchFound = false;
                    
                    regions.forEach(region => {
                        if (matchFound) return;
                        if (!rsState.playoffs || !rsState.playoffs[region]) return;
                        
                        const bracket = rsState.playoffs[region];
                        const allMatches = [
                            ...(bracket.upper?.quarterfinals || []),
                            ...(bracket.upper?.semifinals || []),
                            ...(bracket.upper?.final || []),
                            ...(bracket.lower?.r1 || []),
                            ...(bracket.lower?.r2 || []),
                            ...(bracket.lower?.r3 || []),
                            ...(bracket.lower?.final || []),
                            ...(bracket.grandFinal || [])
                        ];
                        
                        const match = allMatches.find(m => m.id === matchResult.id);
                        
                        if (match) {
                            match.winner = matchResult.winner;
                            match.loser = matchResult.loser;
                            match.score = matchResult.score;
                            match.playerStats = matchResult.playerStats;
                            match.logs = matchResult.logs; 
                            match.mapResults = matchResult.mapResults;
                            
                            // Determine winnerId
                            const winnerObj = teams.find(t => t.name === matchResult.winner);
                            if (winnerObj) match.winnerId = winnerObj.id;
                            const loserObj = teams.find(t => t.name === matchResult.loser);
                            if (loserObj) match.loserId = loserObj.id;
                            
                            // Add or Update match history
                            let historyMatch = rsState.matches.find(m => m.id === match.id);
                            if (!historyMatch) {
                                historyMatch = {
                                    week: activeSave.week,
                                    id: match.id,
                                    t1Name: match.team1,
                                    t2Name: match.team2,
                                    region: region,
                                    tournament: 'Regular Season Playoffs',
                                    stage: 'Playoffs'
                                };
                                rsState.matches.push(historyMatch);
                            }
                            
                            // Always update with latest results
                            historyMatch.winner = match.winner;
                            historyMatch.loser = match.loser;
                            historyMatch.score = match.score;
                            historyMatch.playerStats = match.playerStats;
                            historyMatch.mapResults = match.mapResults;
                            historyMatch.logs = match.logs;
                            
                            matchFound = true;
                            stateUpdated = true;
                            localStorage.removeItem(key);
                        }
                    });
                }
            } catch (e) {
                console.error("Error processing match result:", key, e);
            }
        }
    }
    
    if (stateUpdated) {
        saveCareer(activeSave);
    }
}

export function renderRegularSeason(activeSave) {
  const container = document.getElementById('regularSeasonContent');
  if (!container) return;
  container.innerHTML = '';
  
  // Set default region to player's region on first load
  if (!isInitialized && activeSave.teamId) {
      const playerTeam = teams.find(t => String(t.id) === String(activeSave.teamId));
      if (playerTeam) { 
          currentRegion = playerTeam.region;
      }
      if (activeSave.week >= 17) {
          currentView = 'playoffs';
      }
      isInitialized = true;
  }

  container.innerHTML = '';
  
  const header = document.createElement('div');
  header.className = 'regular-season-header';
  
  if (activeSave.week >= 17) {
      header.innerHTML = `
        <h1>Regular Season Playoffs</h1>
        <p>Stage 2 • Week ${activeSave.week}</p>
      `;
  } else {
      header.innerHTML = `
        <h1>Regular Season Groups</h1>
        <p>Stage 2 • Week ${activeSave.week}</p>
      `;
  }
  
  container.appendChild(header);

  if (activeSave.week < 12) {
     const msg = document.createElement('div');
     msg.className = 'box';
     msg.innerHTML = '<p>Regular Season (Stage 2) will begin after Masters Bangkok concludes (Week 11).</p>';
     container.appendChild(msg);
     return;
  }
  
  // Initialize state if missing (display only, doesn't save back unless we want to)
  let rsState = activeSave.regularSeason;
  if (!rsState && activeSave.week >= 12) {
      rsState = initializeRegularSeason(activeSave);
      activeSave.regularSeason = rsState;
      saveCareer(activeSave);
  }
  
  // Initialize Playoffs Bracket if in playoffs (Week 17+)
  if (activeSave.week >= 17) {
      // If playoffs object missing or empty for current region, generate it
      // generatePlayoffsBracket handles the check internally per region now
      rsState = generatePlayoffsBracket(rsState);
      
      // Populate TBD matches for the current week based on previous results
      // We pass null for simulation fn/players because we only want to populate
      rsState = simulatePlayoffsRound(rsState, null, null, activeSave.week, true);
      
      activeSave.regularSeason = rsState;
      saveCareer(activeSave);
  }

  // Check for playoff match results
  checkPlayoffResults(rsState, activeSave);

  rsState = rsState || { standings: {}, matches: [] };
  
  // Region Tabs
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'region-tabs';
  const regions = ['Americas', 'EMEA', 'Pacific', 'China'];
  
  regions.forEach(region => {
      const tab = document.createElement('button');
      tab.className = `region-tab ${currentRegion === region ? 'active' : ''}`;
      tab.textContent = region;
      tab.onclick = () => {
          currentRegion = region;
          renderRegularSeason(activeSave); // Re-render
      };
      tabsContainer.appendChild(tab);
  });
  container.appendChild(tabsContainer);

  // Stage Tabs (Groups vs Playoffs)
  const stageTabs = document.createElement('div');
  stageTabs.className = 'rs-stage-tabs';
  stageTabs.style.display = 'flex';
  stageTabs.style.gap = '10px';
  stageTabs.style.marginBottom = '20px';
  stageTabs.style.justifyContent = 'center';

  const stages = [
      { id: 'groups', label: 'Group Stage' },
      { id: 'playoffs', label: 'Playoffs' }
  ];

  stages.forEach(stage => {
      const tab = document.createElement('button');
      tab.className = `rs-stage-tab ${currentView === stage.id ? 'active' : ''}`;
      tab.innerText = stage.label;
      tab.style.padding = '8px 16px';
      tab.style.cursor = 'pointer';
      tab.style.backgroundColor = currentView === stage.id ? '#ff4655' : '#333';
      tab.style.color = 'white';
      tab.style.border = 'none';
      tab.style.borderRadius = '4px';
      tab.style.fontWeight = 'bold';

      tab.onclick = () => {
          if (currentView !== stage.id) {
              currentView = stage.id;
              renderRegularSeason(activeSave);
          }
      };
      stageTabs.appendChild(tab);
  });
  
  container.appendChild(stageTabs);
 
  // Automatically set default view based on week ONLY if not already set by user interaction
  // logic: if we just loaded (isInitialized check handles this), set default.
  // But isInitialized is global.
  // We can trust currentView persistence.

  if (currentView === 'playoffs') {
      renderPlayoffsView(container, rsState, currentRegion, activeSave);

      // CHECK FOR MASTERS TOKYO QUALIFICATION
      const regions = ['Americas', 'EMEA', 'Pacific', 'China'];
      // Helper to check if region is complete
      const isRegionComplete = (r) => {
          const b = rsState.playoffs && rsState.playoffs[r];
          // Check if Grand Final has a winner
          // structure: b.grandFinal is array of matches. [0] is the match object.
          // Wait, in renderPlayoffsView logic:
          // createRoundCol('Grand Final', bracket.grandFinal, 22)
          // So bracket.grandFinal is an array of match objects.
          return b && b.grandFinal && b.grandFinal[0] && b.grandFinal[0].winner;
      };

      const allComplete = regions.every(r => isRegionComplete(r));

      if (allComplete) {
          const btnDiv = document.createElement('div');
          btnDiv.style.textAlign = 'center';
          btnDiv.style.marginTop = '20px';
          btnDiv.style.marginBottom = '40px';
          
          const qualBtn = document.createElement('button');
          qualBtn.className = 'rs-bracket-btn play'; 
          qualBtn.style.padding = '15px 30px';
          qualBtn.style.fontSize = '1.2em';
          qualBtn.style.backgroundColor = '#ff4655';
          qualBtn.style.color = 'white';
          qualBtn.style.border = 'none';
          qualBtn.style.borderRadius = '5px';
          qualBtn.style.cursor = 'pointer';
          qualBtn.innerText = 'PROCEED TO MASTERS TOKYO';
          
          qualBtn.onclick = () => {
              if (confirm("Are you sure you want to proceed to Masters Tokyo? This will end the Regular Season Playoffs.")) {
                  // Gather qualified teams
                  const highSeeds = [];
                  const lowSeeds = [];
                  
                  regions.forEach(r => {
                      const b = rsState.playoffs[r];
                      const gf = b.grandFinal[0];
                      const lbf = b.lower.final[0]; 
                      
                      // 1st: Winner of GF -> High Seed
                      highSeeds.push(gf.winner);
                      
                      // 2nd: Loser of GF -> Low Seed
                      lowSeeds.push(gf.loser);
                      
                      // 3rd: Loser of LB Final -> Low Seed
                      // (LB Final winner went to GF, loser was eliminated as 3rd)
                      lowSeeds.push(lbf.loser);
                  });
                  
                  console.log("Qualifying for Masters Tokyo:", { highSeeds, lowSeeds });

                  // Initialize Masters Tokyo
                  // We pass names as strings
                  const newState = automateMastersTokyo(highSeeds, lowSeeds, activeSave.players, null);
                  activeSave.mastersTokyoState = newState;
                  
                  // Set current tournament flag
                  activeSave.currentTournament = 'masters_tokyo'; 
                  
                  saveCareer(activeSave);
                  window.location.href = 'masters_tokyo.html';
              }
          };
          
          btnDiv.appendChild(qualBtn);
          container.appendChild(btnDiv);
      }
  } else {
      // Content Grid (Standings + Matches)
      const grid = document.createElement('div');
  grid.className = 'rs-grid';
  
  // Standings Column
  const standingsCol = document.createElement('div');
  standingsCol.className = 'rs-column';
  standingsCol.innerHTML = '<h2>Standings</h2>';
  grid.appendChild(standingsCol);
  
  // Populate Standings
  const regionalTeams = teams.filter(t => t.region === currentRegion);
  
  // Map teams to stats
  const teamStats = regionalTeams.map(t => {
      const stats = rsState.standings[t.id] || { 
          name: t.name, 
          wins: 0, 
          losses: 0, 
          roundsWon: 0, 
          roundsLost: 0, 
          points: 0,
          group: null
      };
      return {
          ...t,
          stats
      };
  });
  
  // Helper for Head-to-Head
  const getHeadToHead = (teamA, teamB) => {
      const matches = rsState.matches.filter(m => 
        (m.t1Name === teamA.name && m.t2Name === teamB.name) ||
        (m.t1Name === teamB.name && m.t2Name === teamA.name)
      );
      
      let aWins = 0;
      let bWins = 0;
      
      matches.forEach(m => {
          if (m.winner === teamA.name) aWins++;
          else if (m.winner === teamB.name) bWins++;
      });
      
      return aWins - bWins;
  };

  // Helper to Render Group Table
  const renderGroupTable = (title, teamsInGroup) => {
      if (teamsInGroup.length === 0) return;

      const groupHeader = document.createElement('h3');
      groupHeader.innerHTML = `${title} <span style="font-size: 0.6em; color: #4caf50; vertical-align: middle; margin-left: 10px;">TOP 4 QUALIFY</span>`;
      standingsCol.appendChild(groupHeader);

      const table = document.createElement('table');
      table.className = 'rs-table';
      table.innerHTML = `
        <thead>
            <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>W-L</th>
                <th>RD</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody id="rs-standings-body-${title.replace(' ', '-')}"></tbody>
      `;
      standingsCol.appendChild(table);

      const tbody = table.querySelector('tbody');

      // Sort
      teamsInGroup.sort((a, b) => {
          // 1. Points (Wins)
          if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
          
          // 2. Head-to-Head
          const h2h = getHeadToHead(a, b);
          if (h2h !== 0) return -h2h; 
          
          // 3. Round Diff
          const rdA = a.stats.roundsWon - a.stats.roundsLost;
          const rdB = b.stats.roundsWon - b.stats.roundsLost;
          if (rdB !== rdA) return rdB - rdA;
          
          return 0; // Tie
      });
      
      teamsInGroup.forEach((t, index) => {
          const tr = document.createElement('tr');
          let className = '';
          if (String(t.id) === String(activeSave.teamId)) className += ' my-team';
          if (index < 4) className += ' playoff-spot';
          tr.className = className.trim();
          
          const rd = t.stats.roundsWon - t.stats.roundsLost;
          const rdClass = rd > 0 ? 'pos' : (rd < 0 ? 'neg' : '');
          const rdSign = rd > 0 ? '+' : '';
          
          // Logo
          const normalizedPath = t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
          const logoSrc = `assets/team_logos/${normalizedPath}.png`;

          tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="team-cell">
                <img src="${logoSrc}" onerror="this.src='assets/qmark.png'">
                ${t.name}
            </td>
            <td>${t.stats.wins} - ${t.stats.losses}</td>
            <td class="${rdClass}">${rdSign}${rd}</td>
            <td>${t.stats.points}</td>
          `;
          tbody.appendChild(tr);
      });
  };

  const groupATeams = teamStats.filter(t => t.stats.group === 'Group A');
  const groupBTeams = teamStats.filter(t => t.stats.group === 'Group B');

  if (groupATeams.length > 0 || groupBTeams.length > 0) {
      renderGroupTable('Group A', groupATeams);
      renderGroupTable('Group B', groupBTeams);
  } else {
      renderGroupTable('Standings', teamStats);
  }

  // Matches Column
  const matchesCol = document.createElement('div');
  matchesCol.className = 'rs-column';
  matchesCol.innerHTML = '<h2>Recent Matches</h2>';
  
  // Week Filter
  const filterContainer = document.createElement('div');
  filterContainer.className = 'week-filter';
  
  // Get available weeks
  const weeks = [...new Set(rsState.matches.map(m => m.week))].sort((a, b) => b - a);
  
  const select = document.createElement('select');
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Weeks';
  select.appendChild(allOption);
  
  weeks.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = `Week ${w}`;
      select.appendChild(opt);
  });
  
  select.value = currentWeekFilter;
  select.onchange = (e) => {
      currentWeekFilter = e.target.value;
      renderRegularSeason(activeSave);
  };
  
  filterContainer.appendChild(document.createTextNode('Filter: '));
  filterContainer.appendChild(select);
  matchesCol.insertBefore(filterContainer, matchesCol.lastChild); // Insert after H2

  const matchesList = document.createElement('div');
  matchesList.className = 'rs-matches-list';
  
  // Filter matches for this region and week
  let regionMatches = rsState.matches
      .filter(m => m.region === currentRegion)
      // Exclude playoffs matches if in group view
      .filter(m => currentView === 'groups' ? m.stage !== 'Playoffs' : true)
      .map(m => ({ ...m, status: 'completed' }));
      
  // Add scheduled matches that haven't been played yet
  if (rsState.regularSeason?.schedule) {
      const schedule = rsState.regularSeason.schedule;
      Object.entries(schedule).forEach(([weekStr, matches]) => {
          const week = parseInt(weekStr);
          matches.forEach(m => {
              // Check if played (exists in regionMatches with same teams and week)
              // Note: m.team1Id and m.team2Id are in schedule. regionMatches has t1Name/t2Name.
              const t1 = teams.find(t => t.id === m.team1Id);
              const t2 = teams.find(t => t.id === m.team2Id);
              
              if (t1 && t2 && t1.region === currentRegion) {
                  const isPlayed = regionMatches.some(rm => 
                      rm.week === week && 
                      ((rm.t1Name === t1.name && rm.t2Name === t2.name) || 
                       (rm.t1Name === t2.name && rm.t2Name === t1.name))
                  );
                  
                  if (!isPlayed) {
                      regionMatches.push({
                          week: week,
                          t1Name: t1.name,
                          t2Name: t2.name,
                          region: t1.region,
                          status: 'scheduled',
                          score: 'vs'
                      });
                  }
              }
          });
      });
  }

  regionMatches.sort((a, b) => {
      if (b.week !== a.week) return b.week - a.week; // Newest week first
      // Within week, put scheduled first or last? 
      // Maybe scheduled first so they are at the top if it's the current week?
      // Or completed first? 
      // Let's just keep them mixed or simple sort.
      return 0;
  });

  if (currentWeekFilter !== 'all') {
      regionMatches = regionMatches.filter(m => String(m.week) === String(currentWeekFilter));
  }
      
  if (regionMatches.length === 0) {
      matchesList.innerHTML = '<div class="no-matches">No matches found.</div>';
  } else {
      regionMatches.forEach(m => {
          const item = document.createElement('div');
          item.className = `rs-match-item ${m.status}`;
          if (m.status === 'completed') {
            item.onclick = () => renderMatchModal(m);
          }
          
          let t1Class = '';
          let t2Class = '';
          
          if (m.status === 'completed') {
              const winnerIsT1 = m.winner === m.t1Name;
              t1Class = winnerIsT1 ? 'winner' : 'loser';
              t2Class = winnerIsT1 ? 'loser' : 'winner';
          }
          
          item.innerHTML = `
            <div class="match-week">Week ${m.week}</div>
            <div class="match-teams">
                <div class="team ${t1Class}">${m.t1Name}</div>
                <div class="score ${m.status === 'scheduled' ? 'vs-badge' : ''}">${m.score}</div>
                <div class="team ${t2Class}">${m.t2Name}</div>
            </div>
          `;
          matchesList.appendChild(item);
      });
  }
  matchesCol.appendChild(matchesList);
  grid.appendChild(matchesCol);
  
  container.appendChild(grid);
  }
}

function renderMatchModal(match) {
    // Remove existing modal if any
    const existing = document.querySelector('.rs-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rs-modal-overlay';
    
    // Close on background click
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    const content = document.createElement('div');
    content.className = 'rs-modal-content';

    const header = document.createElement('div');
    header.className = 'rs-modal-header';
    header.innerHTML = `
        <h2>Match Details - Week ${match.week}</h2>
        <button class="rs-close-modal">&times;</button>
    `;
    header.querySelector('.rs-close-modal').onclick = () => overlay.remove();
    content.appendChild(header);

    const body = document.createElement('div');
    body.className = 'rs-modal-body';

    // Map Scores
    if (match.mapResults && match.mapResults.length > 0) {
        const mapSection = document.createElement('div');
        mapSection.innerHTML = '<div class="rs-modal-section-title">Map Scores</div>';
        match.mapResults.forEach(res => {
            const row = document.createElement('div');
            row.className = 'rs-map-score-row';
            row.innerHTML = `
                <span class="map-name">
                    ${res.map}
                    ${res.picker ? `<span style="font-size: 0.75em; color: rgba(255,255,255,0.5); margin-left: 8px; font-weight: normal;">(${res.picker}'s Pick)</span>` : ''}
                </span>
                <span class="map-score">${res.score}</span>
            `;
            mapSection.appendChild(row);
        });
        body.appendChild(mapSection);
    }

    // Player Stats
    if (match.playerStats) {
        const statsSection = document.createElement('div');
        
        // Handle property differences between history match (t1Name) and bracket match (team1)
        const t1Name = match.t1Name || match.team1;
        const t2Name = match.t2Name || match.team2;

        // Group by Team
        const t1Players = [];
        const t2Players = [];
        
        Object.values(match.playerStats).forEach(p => {
            if (p.teamName === t1Name) t1Players.push(p);
            else t2Players.push(p);
        });

        const renderTable = (teamName, players) => {
            let html = `<div class="rs-modal-section-title">${teamName}</div>`;
            html += `<table class="rs-player-stats-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>K</th>
                        <th>D</th>
                        <th>A</th>
                        <th>+/-</th>
                        <th>HS</th>
                        <th>ADR</th>
                    </tr>
                </thead>
                <tbody>`;
            
            players.sort((a, b) => b.kills - a.kills).forEach(p => {
                const diff = p.kills - p.deaths;
                const diffColor = diff > 0 ? '#4caf50' : (diff < 0 ? '#f44336' : '#888');
                const adr = Math.round(p.damage / (p.rounds || 1));
                
                html += `<tr>
                    <td>${p.name}</td>
                    <td>${p.kills}</td>
                    <td>${p.deaths}</td>
                    <td>${p.assists}</td>
                    <td style="color: ${diffColor}">${diff > 0 ? '+' : ''}${diff}</td>
                    <td>${p.hs}</td>
                    <td>${adr}</td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
            return html;
        };

        statsSection.innerHTML = renderTable(t1Name, t1Players) + 
                               renderTable(t2Name, t2Players);
        body.appendChild(statsSection);
    }

    content.appendChild(body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

function renderPlayoffsView(container, rsState, region, activeSave) {
    if (!rsState.playoffs || !rsState.playoffs[region]) {
        const msg = document.createElement('div');
        msg.className = 'box';
        msg.innerHTML = '<p>Playoffs bracket not available yet. Regular Season must conclude (Week 16).</p>';
        container.appendChild(msg);
        return;
    }

    // Refresh bracket structure (move winners to next round if needed)
    simulatePlayoffsRound(rsState, null, activeSave.players, activeSave.week, true);

    const bracket = rsState.playoffs[region];

    const bracketWrapper = document.createElement('div');
    bracketWrapper.className = 'rs-bracket-wrapper';

    // Add Reset Button (for "Redo" request)
    const controlsHeader = document.createElement('div');
    controlsHeader.className = 'rs-controls-header';
    controlsHeader.style.marginBottom = '20px';
    controlsHeader.style.textAlign = 'right';
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'rs-btn-control';
    resetBtn.innerText = 'Reset Bracket';
    resetBtn.style.backgroundColor = '#ff4655';
    resetBtn.onclick = () => {
        if (confirm('Are you sure you want to reset the Playoffs Bracket? All playoff progress will be lost.')) {
            rsState.playoffs = null;
            // Also clear playoff matches from history to avoid ghost stats
            rsState.matches = rsState.matches.filter(m => m.stage !== 'Playoffs');
            
            // Clear localStorage match results
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('matchResult_RS-')) {
                    localStorage.removeItem(key);
                }
            }
            
            saveCareer(activeSave);
            renderRegularSeason(activeSave);
        }
    };
    controlsHeader.appendChild(resetBtn);
    container.appendChild(controlsHeader);
    
    // Helper to create a match element (Kickoff Style)
    const renderMatch = (m, scheduledWeek) => {
        const div = document.createElement('div');
        div.className = `rs-bracket-match ${m.winner ? 'played' : ''}`;
        div.dataset.matchId = m.id;

        // Determine user involvement
        const isMyTeam = (activeSave.teamId && (String(m.team1Id) === String(activeSave.teamId) || String(m.team2Id) === String(activeSave.teamId))) ||
                         (activeSave.team && (m.team1 === activeSave.team || m.team2 === activeSave.team));
        
        const isCurrentWeek = activeSave.week === scheduledWeek;
        const canPlay = isMyTeam && isCurrentWeek && !m.winner && m.team1 !== 'TBD' && m.team2 !== 'TBD';
        
        if (canPlay) {
            div.classList.add('rs-my-team-match');
        }

        // Add click handler for the whole box if match is completed
        if (m.winner) {
            div.style.cursor = 'pointer';
            div.onclick = (e) => {
                 // Prevent triggering if clicking controls
                 if (e.target.closest('.rs-match-controls')) return;
                 
                 let fullMatch = rsState.matches ? rsState.matches.find(rm => rm.id === m.id) : null;
                 if (fullMatch && !fullMatch.playerStats && m.playerStats) {
                     fullMatch = m;
                 }
                 renderMatchModal(fullMatch || m);
            };
        }

        const winnerName = m.winner;
        
        // Parse score
        let s1 = '', s2 = '';
        if (m.score) {
             const parts = m.score.split('-');
             if (parts.length === 2) {
                 if (m.winner === m.team1) { s1 = parts[0]; s2 = parts[1]; }
                 else { s1 = parts[1]; s2 = parts[0]; }
             }
        }

        // Helper for Team Slot
        const createTeamSlot = (teamName, score, isWinner) => {
            const slot = document.createElement('div');
            slot.className = `rs-team-slot ${isWinner ? 'winner' : ''}`;
            
            // Highlight user team
            if (activeSave.team && teamName === activeSave.team) {
                slot.classList.add('my-team');
            }

            const logo = document.createElement('img');
            logo.className = 'rs-team-logo';
            const normName = String(teamName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
            logo.src = teamName === 'TBD' ? 'assets/qmark.png' : `assets/team_logos/${normName}.png`;
            logo.onerror = () => { logo.src = 'assets/qmark.png'; };
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'rs-team-name';
            nameSpan.innerText = teamName;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'rs-team-score';
            scoreSpan.innerText = score || '';

            slot.appendChild(logo);
            slot.appendChild(nameSpan);
            slot.appendChild(scoreSpan);
            
            return slot;
        };

        const t1IsWinner = winnerName && winnerName === m.team1;
        const t2IsWinner = winnerName && winnerName === m.team2;

        div.appendChild(createTeamSlot(m.team1, s1, t1IsWinner));
        div.appendChild(createTeamSlot(m.team2, s2, t2IsWinner));

        // Winner Indicator
        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'rs-match-winner';
        winnerDiv.innerText = m.winner || 'TBD';
        div.appendChild(winnerDiv);

        // Controls Container
        const controls = document.createElement('div');
        controls.className = 'rs-match-controls';
        
        if (!m.winner && m.team1 !== 'TBD' && m.team2 !== 'TBD') {
            // SIMULATE BUTTON
            const simBtn = document.createElement('button');
            simBtn.className = 'rs-bracket-btn simulate';
            simBtn.innerText = 'SIM';
            simBtn.onclick = (e) => {
                e.stopPropagation();
                simBtn.innerText = '...';
                simBtn.disabled = true;
                
                setTimeout(() => {
                    const t1Data = getSafeTeamByName(m.team1);
                    const t2Data = getSafeTeamByName(m.team2);
                    
                    if (t1Data && t2Data) {
                        const result = simulateRegularSeasonMatch(t1Data, t2Data, activeSave.players, generateAiStrategy());
                        
                        m.winner = result.winner;
                        m.loser = result.loser;
                        m.winnerId = result.winner === m.team1 ? m.team1Id : m.team2Id;
                        m.loserId = result.loser === m.team1 ? m.team1Id : m.team2Id;
                        m.score = result.score;
                        m.playerStats = result.playerStats;
                        m.logs = result.logs;
                        m.mapResults = result.mapResults;
                        
                        if (!rsState.matches) rsState.matches = [];
                        
                        // Check if match already exists in history
                        let historyMatch = rsState.matches.find(hm => hm.id === m.id);
                        if (!historyMatch) {
                            historyMatch = {
                                week: scheduledWeek,
                                id: m.id,
                                t1Name: m.team1,
                                t2Name: m.team2,
                                region: region,
                                tournament: 'Regular Season Playoffs',
                                stage: 'Playoffs'
                            };
                            rsState.matches.push(historyMatch);
                        }
                        
                        // Update history match
                        historyMatch.winner = result.winner;
                        historyMatch.loser = result.loser;
                        historyMatch.score = result.score;
                        historyMatch.playerStats = result.playerStats;
                        historyMatch.mapResults = result.mapResults;
                        historyMatch.logs = result.logs;
                        
                        simulatePlayoffsRound(rsState, null, activeSave.players, scheduledWeek, true);
                        saveCareer(activeSave);
                        renderRegularSeason(activeSave);
                    } else {
                        console.error('Teams not found for simulation', m.team1, m.team2);
                        simBtn.innerText = 'ERR';
                    }
                }, 50);
            };
            controls.appendChild(simBtn);

            // PLAY BUTTON
            if (canPlay) {
                const playBtn = document.createElement('button');
                playBtn.className = 'rs-bracket-btn play';
                playBtn.innerText = 'PLAY';
                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `match_simulation.html?matchId=${m.id}&team1=${encodeURIComponent(m.team1)}&team2=${encodeURIComponent(m.team2)}&bestOf=${m.bestOf || 3}&playerTeam=${encodeURIComponent(activeSave.team)}&tournament=regular_season`;
                };
                controls.appendChild(playBtn);
            }
        } else if (m.winner) {
             // STATS BUTTON
             const statsBtn = document.createElement('button');
             statsBtn.className = 'rs-bracket-btn stats';
             statsBtn.innerText = 'STATS';
             statsBtn.onclick = (e) => {
                 e.stopPropagation();
                 let fullMatch = rsState.matches ? rsState.matches.find(rm => rm.id === m.id) : null;
                 if (fullMatch && !fullMatch.playerStats && m.playerStats) {
                     fullMatch = m;
                 }
                 renderMatchModal(fullMatch || m);
             };
             controls.appendChild(statsBtn);
        }
        
        div.appendChild(controls);
        return div;
    };

    // Helper to create round column
    const createRoundCol = (title, matches, week) => {
        const col = document.createElement('div');
        col.className = 'rs-round';
        col.innerHTML = `<h4>${title}</h4>`;
        
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'rs-matches-container';
        
        if (matches && matches.length > 0) {
            matches.forEach(m => matchesContainer.appendChild(renderMatch(m, week)));
        }
        col.appendChild(matchesContainer);
        return col;
    };

    // --- Upper Bracket ---
    if (bracket.upper) {
        const ubSection = document.createElement('div');
        ubSection.className = 'rs-bracket-section';
        ubSection.id = 'rs-upper-bracket';
        ubSection.innerHTML = '<h3>Upper Bracket</h3>';
        
        const ubGrid = document.createElement('div');
        ubGrid.className = 'rs-bracket-grid';
        
        ubGrid.appendChild(createRoundCol('Quarterfinals', bracket.upper.quarterfinals, 17));
        ubGrid.appendChild(createRoundCol('Semifinals', bracket.upper.semifinals, 18));
        ubGrid.appendChild(createRoundCol('Upper Final', bracket.upper.final, 19));
        
        ubSection.appendChild(ubGrid);
        bracketWrapper.appendChild(ubSection);
    }

    // --- Lower Bracket ---
    if (bracket.lower) {
        const lbSection = document.createElement('div');
        lbSection.className = 'rs-bracket-section';
        lbSection.id = 'rs-lower-bracket';
        lbSection.innerHTML = '<h3>Lower Bracket</h3>';
        
        const lbGrid = document.createElement('div');
        lbGrid.className = 'rs-bracket-grid';

        lbGrid.appendChild(createRoundCol('Round 1', bracket.lower.r1, 18));
        lbGrid.appendChild(createRoundCol('Round 2', bracket.lower.r2, 19));
        lbGrid.appendChild(createRoundCol('Round 3', bracket.lower.r3, 20));
        lbGrid.appendChild(createRoundCol('Lower Final', bracket.lower.final, 21));
        
        lbSection.appendChild(lbGrid);
        bracketWrapper.appendChild(lbSection);
    }

    // --- Grand Final ---
    if (bracket.grandFinal) {
        const gfSection = document.createElement('div');
        gfSection.className = 'rs-bracket-section';
        gfSection.id = 'rs-grand-final';
        gfSection.innerHTML = '<h3>Grand Final</h3>';
        
        const gfGrid = document.createElement('div');
        gfGrid.className = 'rs-bracket-grid';
        gfGrid.style.justifyContent = 'center';
        
        gfGrid.appendChild(createRoundCol('Grand Final', bracket.grandFinal, 22));
        
        gfSection.appendChild(gfGrid);
        bracketWrapper.appendChild(gfSection);
    }

    container.appendChild(bracketWrapper);
}
