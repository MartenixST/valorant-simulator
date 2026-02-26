import React, { useState } from 'react';
import { handleAiRosterChanges, hireFreeAgentForTeam } from '../ai_manager.js';
import { saveCareer, getKickoffState, saveKickoffState } from '../career_local_storage.jsx';
import { Player, Team, MatchSimulator, MAP_COORDINATES } from '../simulation.js';
import { teams, teamLogos } from '../teams.js';
import { ensureIglAssignment } from '../players.js';
import CareerLoadingOverlay from './CareerLoadingOverlay.jsx';
import { generateKickoffState, automateKickoffTournament, getQualifiedTeams } from '../tournaments/kickoff/kickoff_automation.js';
import { automateMastersTournament } from '../tournaments/masters/masters_automation.js';
import { initializeRegularSeason, generatePlayoffsBracket, simulatePlayoffsRound } from '../tournaments/regular_season/regular_season_logic.js';

const SimWeekButton = ({ activeSave, setActiveSave }) => {
  const [isSimulating, setIsSimulating] = useState(false);

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

  // Helper to simulate a match and return player stats
  const simulateAiMatch = (team1Data, team2Data, savePlayers, strategies = {}) => {
    // 1. Prepare Team objects
    const t1 = new Team(team1Data.name, team1Data.id);
    const t2 = new Team(team2Data.name, team2Data.id);

    // 2. Assign players to teams
    // Use a strict helper to match players to team
    const getTeamPlayers = (teamData) => {
        // First filter by exact team ID or name match and active status
        const candidates = savePlayers.filter(p => {
            if (p.status !== 'active') return false;
            
            const pTeamId = p.teamId ? String(p.teamId) : null;
            const tId = teamData.id ? String(teamData.id) : null;
            
            if (tId && pTeamId) {
                return pTeamId === tId;
            }
            
            const normalize = (n) => String(n || '').toLowerCase().trim();
            const pTeamNameNorm = normalize(p.team);
            const tNameNorm = normalize(teamData.name);
            
            return teamData.name && pTeamNameNorm && pTeamNameNorm === tNameNorm;
        });

        // Filter for designated starters (user teams)
        const starters = candidates.filter(p => p.isStarter === true);

        // If we have explicit starters, prioritize them
        if (starters.length > 0) {
            if (starters.length >= 5) {
                 // If we have enough starters, use the top 5 (sorted by overall just in case >5)
                 return starters.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 5);
            } else {
                 // If not enough starters, fill with best bench players to reach 5
                 // This ensures the match doesn't crash, but prioritizes starters
                 console.warn(`Team ${teamData.name} has fewer than 5 starters (${starters.length}). Filling with bench.`);
                 const nonStarters = candidates.filter(p => !p.isStarter).sort((a, b) => (b.overall || 0) - (a.overall || 0));
                 return [...starters, ...nonStarters].slice(0, 5);
            }
        }

        // Sort by overall rating to pick best players if > 5 (AI teams or no starters set)
        return candidates.sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 5);
    };

    const t1Players = getTeamPlayers(team1Data);
    const t2Players = getTeamPlayers(team2Data);

    // Convert to Player instances
    t1.players = t1Players.map(p => Player.fromJSON(p));
    t2.players = t2Players.map(p => Player.fromJSON(p));

    // 3. Simulate match (BO3)
    let t1Maps = 0;
    let t2Maps = 0;
    const mapResults = [];
    const allPlayerStats = {};
    const matchLogs = [];

    // Initialize stats tracking
    [...t1.players, ...t2.players].forEach(p => {
      // Ensure we start fresh for this BO3
      // p is a Player instance created from JSON, so p.stats might carry over if fromJSON didn't clear it
      // Let's force clear it here to be safe for the simulation context
      p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
      
      allPlayerStats[p.id] = {
        name: p.name,
        teamId: p.teamId,
        teamName: p.teamId === String(team1Data.id) ? team1Data.name : team2Data.name,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        hs: 0,
        rounds: 0
      };
    });

    // Map Picking Logic
    const uniqueMapPool = [...new Set(Object.keys(MAP_COORDINATES))];
    const availableMaps = uniqueMapPool.sort(() => 0.5 - Math.random());
    const matchMaps = [];

    // BO3 Logic: T2 Pick, T1 Pick, Decider
    matchMaps.push({ map: availableMaps[0], picker: team2Data.name });
    matchMaps.push({ map: availableMaps[1], picker: team1Data.name });
    matchMaps.push({ map: availableMaps[2], picker: 'Decider' });

    let mapIndex = 0;

    while (t1Maps < 2 && t2Maps < 2 && mapIndex < matchMaps.length) {
      t1.score = 0;
      t2.score = 0;
      t1.side = 'attack';
      t2.side = 'defense';
      
      // Get next map from pre-determined list
      const currentMapObj = matchMaps[mapIndex];
      const randomMap = currentMapObj.map;
      const picker = currentMapObj.picker;
      mapIndex++;
      
      const currentMapLogs = [];
      
      // RESET Player Stats for the new map!
      // The MatchSimulator accumulates into p.stats. If we don't reset, map 2 starts with map 1 stats.
      [...t1.players, ...t2.players].forEach(p => {
          p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
          p.kills = 0; p.deaths = 0; p.assists = 0; // Legacy props
      });

      const matchSim = new MatchSimulator(t1, t2, currentMapLogs, strategies, randomMap);
      matchSim.simulateMatch();

      const mapScore = `${t1.score}-${t2.score}`;
      mapResults.push({ score: mapScore, map: randomMap, picker: picker });
      matchLogs.push({ map: mapResults.length, mapName: randomMap, score: mapScore }); 

      if (t1.score >= 13) t1Maps++;
      else t2Maps++;

      // Update aggregated stats from this map
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

  const generateContendersMessage = (players) => {
    // Calculate current power/potential for ALL teams based on players in the save
    const teamStats = teams.map(t => {
        const teamPlayers = players.filter(p => {
            const pTeamId = p.teamId ? String(p.teamId) : null;
            if (t.id && pTeamId) {
                return pTeamId === String(t.id);
            }
            const normalize = (n) => String(n || '').toLowerCase().trim();
            const pTeamNameNorm = normalize(p.team);
            return t.name && pTeamNameNorm && pTeamNameNorm === normalize(t.name);
        });
        const avgPower = teamPlayers.length > 0 
            ? Math.round(teamPlayers.reduce((sum, p) => sum + (p.overall || 75), 0) / teamPlayers.length)
            : Math.round(t.power || 75);
        const avgPotential = teamPlayers.length > 0
            ? Math.round(teamPlayers.reduce((sum, p) => sum + (p.potential || 80), 0) / teamPlayers.length)
            : Math.round(t.potential || 80);
            
        return {
            ...t,
            currentPower: avgPower,
            currentPotential: avgPotential,
            strength: Math.round((avgPower + avgPotential) / 2)
        };
    });

    const contenders = teamStats.sort((a, b) => b.strength - a.strength).slice(0, 5);
    
    let htmlBody = `
        <div class="contenders-report">
            <p style="margin-bottom: 25px; color: rgba(236, 232, 225, 0.8); line-height: 1.6;">
                The analysts at the League News have updated the definitive list of championship contenders based on recent performance and roster development. These five organizations currently represent the absolute peak of the league.
            </p>
            <div class="contenders-list" style="display: flex; flex-direction: column; gap: 20px;">
    `;

    const reasonPools = {
        elite: [
            "A global powerhouse with a roster that defines the current meta. Their mechanical ceiling is unmatched.",
            "The undisputed giants of the league. Every player on this roster is a legitimate superstar in their own right.",
            "A terrifying combination of raw aim and flawless utility usage. They are currently the benchmark for excellence.",
            "A dynasty in the making. Their tactical depth is only rivaled by their individual fragging power."
        ],
        veteran: [
            "A veteran-heavy squad whose experience and discipline make them a nightmare to play against in high-stakes matches.",
            "Masters of the late-game. This team's composure under pressure is their greatest weapon against less experienced rivals.",
            "A battle-hardened core that knows exactly how to exploit the smallest mistakes in their opponents' setups.",
            "They play the 'boring' but perfect Valorant. Their fundamental execution is so clean it leaves no room for counter-play."
        ],
        rising: [
            "The league's most dangerous young core. Their rapid improvement suggests they will be unstoppable soon.",
            "A high-octane roster of rising stars. What they lack in experience, they more than make up for in sheer mechanical audacity.",
            "An explosive group of newcomers who are currently re-writing the tactical playbook with their aggressive style.",
            "Fearless and unpredictable. This young squad thrives in chaos and can out-aim almost anyone on their day."
        ],
        balanced: [
            "A perfectly balanced organization with deep strategic layers and a consistent track record of excellence.",
            "Renowned for their structural integrity. They play a disciplined style of Valorant that is incredibly difficult to break down.",
            "A well-rounded squad where every player understands their role perfectly, creating a whole that is greater than the sum of its parts.",
            "Masters of adaptation. This team can switch between aggressive and defensive styles mid-map without missing a beat."
        ]
    };

    const usedReasons = new Set();

    contenders.forEach((team, index) => {
        let reason = "";
        const avgStrength = team.strength;
        const logoUrl = teamLogos[team.name] || 'assets/team_logos/default.png';

        let pool;
        if (avgStrength >= 85) {
            pool = reasonPools.elite;
        } else if (team.currentPower > team.currentPotential + 2) {
            pool = reasonPools.veteran;
        } else if (team.currentPotential > team.currentPower + 2) {
            pool = reasonPools.rising;
        } else {
            pool = reasonPools.balanced;
        }

        // Find a reason that hasn't been used in this report
        let availableReasons = pool.filter(r => !usedReasons.has(r));

        // Fallback if somehow all in pool are used
        if (availableReasons.length === 0) {
            availableReasons = pool;
        }

        reason = availableReasons[Math.floor(Math.random() * availableReasons.length)];
        usedReasons.add(reason);

        htmlBody += `
            <div class="contender-item" style="display: flex; align-items: center; gap: 20px; background: rgba(255, 255, 255, 0.03); padding: 15px; border-left: 4px solid #ff4655;">
            <div class="contender-rank" style="font-family: 'Valorant', sans-serif; font-size: 24px; color: #ff4655; min-width: 30px;">#${index + 1}</div>
            <img src="${logoUrl}" alt="${team.name}" style="width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));" />
            <div class="contender-info" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                    <h4 style="margin: 0; font-family: 'Valorant', sans-serif; color: #ece8e1; font-size: 18px; text-transform: uppercase;">${team.name}</h4>
                    <span style="font-size: 10px; color: #00f6ff; background: rgba(0, 246, 255, 0.1); padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">${team.region}</span>
                </div>
                <div style="font-size: 11px; color: rgba(236, 232, 225, 0.5); margin-bottom: 8px; font-weight: bold;">
                    RATING: <span style="color: #00ff85;">${team.currentPower} PWR</span> / <span style="color: #ffb900;">${team.currentPotential} POT</span>
                </div>
                <div style="font-size: 13px; color: rgba(236, 232, 225, 0.7); font-style: italic; line-height: 1.4;">
                    "${reason}"
                </div>
            </div>
        </div>
    `;
    });

    htmlBody += `</div></div>`;

    return {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: "League News",
        subject: "Top 5 Championship Contenders Updated",
        body: htmlBody,
        date: new Date().toLocaleDateString(),
        read: false,
        contentType: 'html'
    };
  };

  const handleSimulateWeek = () => {
    // 1. Check if Kickoff is complete if we are on Week 4
    const currentWeek = activeSave.week || 1;
    if (currentWeek === 4) {
      const playerTeam = teams.find(t => String(t.id) === String(activeSave.teamId));
      if (playerTeam) {
        const region = playerTeam.region;
        const kickoffState = getKickoffState(region, activeSave.id);
        
        // Check if the grand final has a winner
        const isKickoffComplete = kickoffState && 
                                  kickoffState.series && 
                                  kickoffState.series['K-GF'] && 
                                  kickoffState.series['K-GF'].winner;
        
        if (!isKickoffComplete) {
          alert(`You must complete the ${region} Kickoff tournament before simulating to Week 5!`);
          setIsSimulating(false);
          return;
        }
      }
    }

    // 2. Check if player team is eligible (min 5 players) for MATCHES
    const myPlayers = activeSave.players.filter(p => {
        const normalize = (n) => String(n || '').toLowerCase().trim();
        const pTeamId = p.teamId ? String(p.teamId) : null;
        const pTeamNameNorm = normalize(p.team);
        const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
        const activeTeamNameNorm = normalize(activeSave.team);
        return (activeTeamId && pTeamId === activeTeamId) || (activeTeamNameNorm && pTeamNameNorm === activeTeamNameNorm);
    });

    // We no longer block the entire week simulation if < 5 players.
    // Instead, matches will handle forfeits if a team has < 5 players.
    // However, we should still warn the user if they are going into a match without a full roster.

    setIsSimulating(true);

    // Initialize newInboxMessages array early to avoid ReferenceError
    const newInboxMessages = [];

    // Add a small delay for the animation effect
    setTimeout(() => {
      const currentWeek = activeSave.week || 1;
      const isPrepWeek = currentWeek <= 3;
      // Week 4 is Kickoff. Weeks 5-6 are Masters Prep.
      const isMastersPrep = currentWeek === 5 || currentWeek === 6;
      
      // 1. Increment week
      let nextWeek = currentWeek + 1;
      let nextSeason = activeSave.season || 1;

      // Handle tournament transitions and break weeks
      // Kickoff is Week 4. Week 5-6 is Masters Prep. Week 7 is Masters Bangkok start.
      
      // 2. AI Roster Changes
      const { updatedSave: aiUpdatedSave, changes: rosterChanges } = handleAiRosterChanges(activeSave);

      // 2.5 Simulate AI Team Matches (Only if not prep week and not masters prep)
      const simulatedMatches = [];
      const aiTeams = teams.filter(t => String(t.id) !== String(activeSave.teamId));
      
      // Player team strategy (defaults if not set)
      const playerTeamStrategy = activeSave.strategies || {
        playstyle: 'balanced',
        focus: 'standard',
        eco: 'standard',
        activity: 'standard'
      };

      const regions = ["Americas", "EMEA", "Pacific", "China"];

      // Don't simulate regular season matches during:
      // 1. Pre-season (Weeks 1-3)
      // 2. Kickoff Week (Week 4) - handled separately
      // 3. Masters Prep (Weeks 5-6)
      // 4. Masters Bangkok (Weeks 7-9)
      // Regular Season starts Week 12
      const isRegularSeason = currentWeek >= 12 && currentWeek <= 16; 
      const isPlayoffs = currentWeek >= 17 && currentWeek <= 22;

      // INBOX MESSAGES: Week 11 (Masters Playoffs) and Week 12 (Masters Winner)
      if (nextWeek === 11) {
        newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "League Operations",
            subject: "Masters Bangkok Playoffs Begin!",
            body: `The Swiss Stage has concluded and the top 4 teams have advanced to the Playoffs! Who will lift the trophy in Bangkok? Check the tournament bracket to see the matchups.`,
            date: new Date().toLocaleDateString(),
            read: false
        });
      }

      // INBOX MESSAGE: Week 16 (Regular Season Playoffs)
      if (nextWeek === 17) {
        newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "League Operations",
            subject: "Regular Season Playoffs Begin!",
            body: `The Regular Season has concluded and the top 4 teams from each group have advanced to the Playoffs! Check the bracket to see the Quarterfinal matchups.`,
            date: new Date().toLocaleDateString(),
            read: false
        });
      }

      if (isRegularSeason) {
        // Initialize Regular Season if not present (starts Week 10)
        if (!aiUpdatedSave.regularSeason) {
            aiUpdatedSave.regularSeason = initializeRegularSeason(aiUpdatedSave);
        }

        // Get matches scheduled for this week
        const scheduledMatches = aiUpdatedSave.regularSeason.schedule[currentWeek] || [];

        scheduledMatches.forEach(match => {
            if (match.played) return;

            const t1 = teams.find(t => t.id === match.team1Id);
            const t2 = teams.find(t => t.id === match.team2Id);

            if (t1 && t2) {
                // Determine strategies
                const isT1Player = String(t1.id) === String(activeSave.teamId);
                const isT2Player = String(t2.id) === String(activeSave.teamId);

                const t1Strategy = isT1Player ? playerTeamStrategy : generateAiStrategy();
                const t2Strategy = isT2Player ? playerTeamStrategy : generateAiStrategy();

                const matchStrategies = {
                    [t1.id]: t1Strategy,
                    [t2.id]: t2Strategy
                };

                const matchResult = simulateAiMatch(t1, t2, aiUpdatedSave.players, matchStrategies);
                
                // Mark as played in the schedule
                match.played = true;
                match.winner = matchResult.winner;
                match.score = matchResult.score;

                simulatedMatches.push({
                    winner: matchResult.winner,
                    loser: matchResult.loser,
                    score: matchResult.score,
                    region: match.region,
                    group: match.group,
                    playerStats: matchResult.playerStats,
                    mapResults: matchResult.mapResults,
                    tournamentName: "Regular Season",
                    strategies: matchStrategies,
                    t1Name: t1.name,
                    t2Name: t2.name,
                    t1Id: t1.id,
                    t2Id: t2.id
                });
            }
        });
      }

      if (isRegularSeason) {

        // Update Standings based on simulated matches
        simulatedMatches.forEach(match => {
            if (match.tournamentName === "Regular Season") {
                const winnerName = match.winner;
                const loserName = match.loser;
                
                // Find team IDs
                const winnerTeam = teams.find(t => t.name === winnerName);
                const loserTeam = teams.find(t => t.name === loserName);
                
                if (winnerTeam && loserTeam) {
                    const wStats = aiUpdatedSave.regularSeason.standings[winnerTeam.id];
                    const lStats = aiUpdatedSave.regularSeason.standings[loserTeam.id];
                    
                    if (wStats) {
                        wStats.wins += 1;
                        wStats.points += 1; // 1 point per win
                    }
                    if (lStats) {
                        lStats.losses += 1;
                    }

                    // Calculate round difference from mapResults
                    if (match.mapResults) {
                        match.mapResults.forEach(mapRes => {
                            if (mapRes.score) {
                                const parts = mapRes.score.split('-').map(Number);
                                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                     // Assuming simulateAiMatch returns "score1-score2" where score1 corresponds to t1Name
                                     let t1Score = parts[0];
                                     let t2Score = parts[1];
                                     
                                     let winnerScore, loserScore;
                                     if (match.winner === match.t1Name) {
                                         winnerScore = t1Score;
                                         loserScore = t2Score;
                                     } else {
                                         winnerScore = t2Score;
                                         loserScore = t1Score;
                                     }
                                     
                                     if (wStats) {
                                         wStats.roundsWon += winnerScore;
                                         wStats.roundsLost += loserScore;
                                     }
                                     if (lStats) {
                                         lStats.roundsWon += loserScore;
                                         lStats.roundsLost += winnerScore;
                                     }
                                }
                            }
                        });
                    }
                    
                    // Add to history
                    aiUpdatedSave.regularSeason.matches.push({
                        week: currentWeek,
                        id: Date.now() + Math.random().toString(36).substr(2, 9),
                        ...match
                    });

                    // Award Championship Points for Regular Season wins
                    // 1 Point per win
                    if (!aiUpdatedSave.championshipPoints) aiUpdatedSave.championshipPoints = {};
                    aiUpdatedSave.championshipPoints[winnerName] = (aiUpdatedSave.championshipPoints[winnerName] || 0) + 1;
                }
            }
        });

        // Generate Playoff Bracket at the end of Regular Season (Week 16)
        if (currentWeek === 16) {
             console.log("Regular Season concluded. Generating Playoff Bracket...");
             if (!aiUpdatedSave.regularSeason) {
                 aiUpdatedSave.regularSeason = initializeRegularSeason(aiUpdatedSave);
             }
             // Ensure standings are fully up to date before generating
             aiUpdatedSave.regularSeason = generatePlayoffsBracket(aiUpdatedSave.regularSeason);
        }
      }

      if (isPlayoffs) {
          if (!aiUpdatedSave.regularSeason) {
               aiUpdatedSave.regularSeason = initializeRegularSeason(aiUpdatedSave);
          }
          // Always call to ensure brackets are valid/regenerated if broken
          aiUpdatedSave.regularSeason = generatePlayoffsBracket(aiUpdatedSave.regularSeason);

          // Playoffs Simulation (Weeks 17-22)
          if (currentWeek >= 17 && currentWeek <= 22) {
              aiUpdatedSave.regularSeason = simulatePlayoffsRound(
                  aiUpdatedSave.regularSeason, 
                  (t1, t2, players) => {
                      const isT1Player = String(t1.id) === String(activeSave.teamId);
                      const isT2Player = String(t2.id) === String(activeSave.teamId);
                      const t1Strategy = isT1Player ? playerTeamStrategy : generateAiStrategy();
                      const t2Strategy = isT2Player ? playerTeamStrategy : generateAiStrategy();
                      const strategies = { [t1.id]: t1Strategy, [t2.id]: t2Strategy };
                      return simulateAiMatch(t1, t2, players, strategies);
                  },
                  aiUpdatedSave.players, 
                  currentWeek
              );
              
              const recentMatches = aiUpdatedSave.regularSeason.matches.filter(m => m.week === currentWeek);
              recentMatches.forEach(m => {
                  simulatedMatches.push({
                      team1: m.t1Name,
                      team2: m.t2Name,
                      score: m.score,
                      winner: m.winner,
                      tournament: 'Playoffs'
                  });
              });
          }
      }

      // KICKOFF AUTOMATION: Start on Week 4 (after 3 weeks of prep)
      const allQualifiedTeams = activeSave.qualifiedTeams || {};
      const kickoffResults = activeSave.kickoffResults || {};
      const updatedPlayers = [...aiUpdatedSave.players];

      if (currentWeek === 4) {
        regions.forEach(region => {
          // Check if this region's kickoff is already done
          if (!kickoffResults[region] || kickoffResults[region].dirty) {
            console.log(`Automating Kickoff for ${region}...`);
            let regionState = generateKickoffState(region);
            
            // If it's the player's region, we might want to check if they have a state in localStorage
            const playerTeamData = teams.find(t => String(t.id) === String(activeSave.teamId));
            if (region === playerTeamData?.region) {
                const localState = getKickoffState(region, activeSave.id);
                if (localState && !localState.dirty) {
                    regionState = localState;
                }
            }

            // Automate the tournament
            const completedState = automateKickoffTournament(regionState, updatedPlayers, simulateAiMatch);
            kickoffResults[region] = completedState;
            allQualifiedTeams[region] = getQualifiedTeams(completedState);
            
      // 3. Update Championship Points based on Kickoff results
            // Kickoff winner gets 3 points.
            if (completedState.series['K-GF'] && completedState.series['K-GF'].winner) {
                const winnerName = completedState.series['K-GF'].winner;
                if (!aiUpdatedSave.championshipPoints) aiUpdatedSave.championshipPoints = {};
                aiUpdatedSave.championshipPoints[winnerName] = (aiUpdatedSave.championshipPoints[winnerName] || 0) + 3;
                console.log(`CP: ${winnerName} gets +3 points for winning Kickoff.`);
            }

            // Note: Individual match wins in Kickoff do NOT award points, only the event winner gets points.

            // Save the state for this region
            saveKickoffState(completedState, region, activeSave.id);
          }
        });
      }

      // MASTERS BANGKOK AUTOMATION: Start initialization after Kickoff (Week 5+)
      let mastersResults = activeSave.mastersState ? JSON.parse(JSON.stringify(activeSave.mastersState)) : null;
      
      // Initialize if we are entering the Masters prep week (Week 5) OR if we are past it but missing data
      // This ensures we reset/overwrite old data from previous seasons at the start of the new Masters cycle
      // Added safety check: if we have masters results but the season doesn't match, we must reset
      const shouldResetMasters = (nextWeek === 5) || 
                                 (nextWeek > 5 && !mastersResults) ||
                                 (nextWeek > 5 && mastersResults && mastersResults.season !== nextSeason);

      if (shouldResetMasters) {
        // Just initialize the state, don't simulate anything yet
        console.log("Initializing Masters Bangkok state (Resetting/Creating)...");
        const flatQualifiedTeams = [...new Set(
          Object.values(allQualifiedTeams)
            .flat()
            .filter(t => t && (typeof t === 'string' || t.name))
            .map(t => typeof t === 'string' ? t : t.name)
        )];
        
        if (flatQualifiedTeams.length >= 8) {
          mastersResults = {
            season: nextSeason,
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
            mastersResults.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
          });
        }
      } else if (nextWeek > 7) {
        // Handle Masters Bangkok progression
        if (mastersResults && !mastersResults.complete) {
          console.log("Checking Masters Bangkok completion status...", mastersResults);
          // Check if the current round is finished
          let allMatchesFinished = true;
          let stage = "unknown";
          
          // Determine current stage and check only those matches
          if (mastersResults.playoffs && mastersResults.playoffs.grandFinal) {
            stage = "Grand Final";
            const gfData = mastersResults.playoffs.matches[mastersResults.playoffs.grandFinal];
            const tpData = mastersResults.playoffs.thirdPlace ? mastersResults.playoffs.matches[mastersResults.playoffs.thirdPlace] : null;
            
            // If we have a winner for GF (and 3rd place if exists), it's finished!
            if (gfData && gfData.winner && (!mastersResults.playoffs.thirdPlace || (tpData && tpData.winner))) {
              console.log("SimWeekButton: Found Grand Final (and 3rd Place) winner");
              allMatchesFinished = true;
              // Sync the complete flag if it was somehow missing
              mastersResults.complete = true;
            } else {
              allMatchesFinished = false;
              console.log("SimWeekButton: Grand Final or 3rd Place not finished yet");
            }
          } else if (mastersResults.playoffs && mastersResults.playoffs.semifinals && mastersResults.playoffs.semifinals.length > 0) {
            stage = "Semifinals";
            const sfFinished = mastersResults.playoffs.semifinals.every(id => {
              const matchData = mastersResults.playoffs.matches[id];
              return matchData && matchData.winner !== null && typeof matchData.winner !== 'undefined';
            });
            if (!sfFinished) allMatchesFinished = false;
            console.log("SimWeekButton: Semifinals finished check:", sfFinished);
          } else if (mastersResults.swiss && mastersResults.swiss.rounds && mastersResults.swiss.rounds.length > 0) {
            stage = "Swiss";
            const latestRound = mastersResults.swiss.rounds[mastersResults.swiss.rounds.length - 1];
            if (latestRound && latestRound.matches) {
              allMatchesFinished = latestRound.matches.every(m => {
                const matchId = typeof m === 'string' ? m : (m.id || m);
                const matchData = mastersResults.swiss.matches[matchId];
                return matchData && matchData.winner !== null && typeof matchData.winner !== 'undefined';
              });
            }
            console.log("SimWeekButton: Swiss Stage finished check:", allMatchesFinished);
          }

          if (!allMatchesFinished) {
            console.warn(`Masters Bangkok ${stage} not finished yet!`, mastersResults);
            alert(`You must complete all matches in the current Masters Bangkok round (${stage}) before simulating to the next week!`);
            setIsSimulating(false);
            return;
          }
          console.log("SimWeekButton: All matches finished for stage:", stage);
        }

        // If tournament is already complete, we don't need to automate it anymore
        if (mastersResults && mastersResults.complete) {
          console.log("Masters Bangkok is already complete. Skipping automation.");
        } else {
          // console.log("Automating one round of Masters Bangkok...");
          const flatQualifiedTeams = [...new Set(
            Object.values(allQualifiedTeams)
              .flat()
              .filter(t => t && (typeof t === 'string' || t.name))
              .map(t => typeof t === 'string' ? t : t.name)
          )];

          if (flatQualifiedTeams.length >= 8) {
            const oldState = JSON.stringify(mastersResults);
            
            // AUTOMATION RESTORED BUT ONLY FOR ROUND GENERATION
            // We need `automateMastersTournament` to generate the next round's matchups if the previous round is finished.
            // But we do NOT want it to simulate the matches themselves if we want manual play.
            
            // Let's modify how we use it. We will call it, but we need to ensure `automateMastersTournament`
            // only generates the structure (pairings) and doesn't auto-resolve matches unless we want it to.
            // Looking at `masters_automation.js` (assumed logic), it likely does both or prepares the state.
            
            // If we completely removed the call, the bracket never advances to the next stage/round.
            // We need to advance the round (create new matches) when the previous ones are done.
            
            mastersResults = automateMastersTournament(flatQualifiedTeams, updatedPlayers, simulateAiMatch, mastersResults, activeSave.team);
            
            // --- Simulate AI vs AI matches in Masters immediately ---
            // REMOVED: We don't want to auto-simulate AI matches either. User must click "Simulate" on the match.
            /*
            const playerTeamName = teams.find(t => String(t.id) === String(activeSave.teamId))?.name;
            
            const simulatePendingMastersMatches = (matchesObj) => {
                if (!matchesObj) return;
                Object.values(matchesObj).forEach(match => {
                    if (!match.winner && match.team1 && match.team2) {
                        // Check if player involved
                        if (match.team1 !== playerTeamName && match.team2 !== playerTeamName) {
                            console.log(`Simulating Masters AI Match: ${match.team1} vs ${match.team2}`);
                            const t1 = teams.find(t => t.name === match.team1);
                            const t2 = teams.find(t => t.name === match.team2);
                            
                            if (t1 && t2) {
                                const result = simulateAiMatch(t1, t2, updatedPlayers);
                                match.winner = result.winner;
                                match.loser = result.loser;
                                match.score = result.score;
                                match.playerStats = result.playerStats;
                                match.mapResults = result.mapResults; // Ensure map results are saved
                            }
                        }
                    }
                });
            };

            if (mastersResults.swiss && mastersResults.swiss.matches) {
                simulatePendingMastersMatches(mastersResults.swiss.matches);
            }
            if (mastersResults.playoffs && mastersResults.playoffs.matches) {
                simulatePendingMastersMatches(mastersResults.playoffs.matches);
            }
            */
            // --------------------------------------------------------

            // CRITICAL FIX: Update the save object with the new masters state
            aiUpdatedSave.mastersState = mastersResults;

            if (mastersResults && JSON.stringify(mastersResults) !== oldState) {
                // Find what changed in matches
                const parsedOld = JSON.parse(oldState);
                
                // If Masters is newly complete, award 3 points to the winner
                // Also check if we just finished the Grand Final in this simulation step
                const gfMatch = mastersResults.playoffs.matches['M-PLAYOFF-GF'];
                const oldGfMatch = parsedOld.playoffs && parsedOld.playoffs.matches ? parsedOld.playoffs.matches['M-PLAYOFF-GF'] : null;
                
                if (gfMatch && gfMatch.winner && (!oldGfMatch || !oldGfMatch.winner)) {
                     const winnerName = gfMatch.winner;
                     if (!aiUpdatedSave.championshipPoints) aiUpdatedSave.championshipPoints = {};
                     aiUpdatedSave.championshipPoints[winnerName] = (aiUpdatedSave.championshipPoints[winnerName] || 0) + 3;
                     console.log(`CP: ${winnerName} gets +3 points for winning Masters.`);
                     mastersResults.complete = true; // Ensure complete flag is set
                }
            }
          }
        }
      }

      // Week 12 Inbox Message (Masters Winner)
      if (nextWeek === 12) {
          let winnerName = "TBD";
          if (aiUpdatedSave.mastersState && aiUpdatedSave.mastersState.playoffs && aiUpdatedSave.mastersState.playoffs.grandFinal) {
              const gf = aiUpdatedSave.mastersState.playoffs.matches[aiUpdatedSave.mastersState.playoffs.grandFinal];
              if (gf && gf.winner) {
                  winnerName = gf.winner;
              }
          }

          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "League News",
              subject: "Masters Bangkok Champion Crowned!",
              body: `The first international event of the year has concluded! Congratulations to <b>${winnerName}</b> for winning Masters Bangkok! The Regular Season begins now - teams will fight for their spot in Champions.`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // Regular Season Initialization (Week 12 Start)
      if (nextWeek === 12 && !aiUpdatedSave.regularSeason) {
          console.log("Initializing Regular Season state...");
          aiUpdatedSave.regularSeason = initializeRegularSeason(aiUpdatedSave);
      }

      // 3. Player Development & Match Performance
      // Apply match performance updates first
      // Ensure we use the players list that might have been updated by tournament automation
      const playersWithPerformance = [...updatedPlayers];
      simulatedMatches.forEach(match => {
        if (match.playerStats) {
          Object.keys(match.playerStats).forEach(playerId => {
            const playerIdx = playersWithPerformance.findIndex(p => String(p.id) === String(playerId));
            if (playerIdx !== -1) {
              const pData = playersWithPerformance[playerIdx];
              const player = Player.fromJSON(pData);
              const stats = match.playerStats[playerId];
              
              // Apply performance-based rating changes
              player.rating.applyMatchPerformance(stats);
              
              // Update the player data in our list
              playersWithPerformance[playerIdx] = {
                ...pData,
                rating: { ...player.rating },
                overall: player.overall,
                potential: player.potential
              };
            }
          });
        }
      });

      // Also apply performance from Kickoff tournaments if they happened
      if (currentWeek === 4) {
        regions.forEach(region => {
          const kickoff = kickoffResults[region];
          if (kickoff && kickoff.series) {
            Object.values(kickoff.series).forEach(series => {
              if (series.playerStats) {
                Object.keys(series.playerStats).forEach(playerId => {
                  const playerIdx = playersWithPerformance.findIndex(p => String(p.id) === String(playerId));
                  if (playerIdx !== -1) {
                    const pData = playersWithPerformance[playerIdx];
                    const player = Player.fromJSON(pData);
                    const stats = series.playerStats[playerId];
                    
                    player.rating.applyMatchPerformance(stats);
                    
                    playersWithPerformance[playerIdx] = {
                      ...pData,
                      rating: { ...player.rating },
                      overall: player.overall,
                      potential: player.potential
                    };
                  }
                });
              }
            });
          }
        });
      }

      // Apply performance from Masters Bangkok if it happened
      if (nextWeek >= 7 && mastersResults) {
        let matchesToApply = [];
        
        // 1. If we just simulated a Swiss round (nextWeek > 7 and Swiss is not finished)
        if (nextWeek > 7 && mastersResults.swiss && mastersResults.swiss.rounds.length > 0) {
          const activeSwissTeams = Object.values(mastersResults.swiss.teamStats).filter(s => !s.qualified && !s.eliminated).length;
          // If we are still in Swiss or just finished it
          const latestRound = mastersResults.swiss.rounds[mastersResults.swiss.rounds.length - 1];
          latestRound.matches.forEach(mId => {
            const match = mastersResults.swiss.matches[mId.id || mId];
            if (match) matchesToApply.push(match);
          });
        }
        
        // 2. If we just simulated a Playoff round
        if (nextWeek > 7 && mastersResults.playoffs) {
          // If Semifinals just happened (we are moving to week where GF is next)
          if (mastersResults.playoffs.semifinals.length === 2 && !mastersResults.playoffs.grandFinal) {
             mastersResults.playoffs.semifinals.forEach(mId => {
               const match = mastersResults.playoffs.matches[mId];
               if (match) matchesToApply.push(match);
             });
          }
          // If Grand Final just happened
          if (mastersResults.playoffs.grandFinal) {
            const match = mastersResults.playoffs.matches[mastersResults.playoffs.grandFinal];
            if (match) matchesToApply.push(match);
          }
        }
        
        matchesToApply.forEach(series => {
          if (series.playerStats) {
            Object.keys(series.playerStats).forEach(playerId => {
              const playerIdx = playersWithPerformance.findIndex(p => String(p.id) === String(playerId));
              if (playerIdx !== -1) {
                const pData = playersWithPerformance[playerIdx];
                const player = Player.fromJSON(pData);
                const stats = series.playerStats[playerId];
                player.rating.applyMatchPerformance(stats);
                playersWithPerformance[playerIdx] = {
                  ...pData,
                  rating: { ...player.rating },
                  overall: player.overall,
                  potential: player.potential
                };
              }
            });
          }
        });
      }

      // Apply weekly stat fluctuations to all players
      const developedPlayers = playersWithPerformance.map(pData => {
        const player = Player.fromJSON(pData);
        
        // Use player team's strategy activity if it's the player's team, else random for AI
        let activity = 'standard';
        const isPlayerTeam = (function() {
          const normalize = (n) => String(n || '').toLowerCase().trim();
          const pTeamId = pData.teamId ? String(pData.teamId) : null;
          const pTeamNameNorm = normalize(pData.team);
          const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
          const activeTeamNameNorm = normalize(activeSave.team);
          const matchesId = activeTeamId && pTeamId && pTeamId === activeTeamId;
          const matchesName = activeTeamNameNorm && pTeamNameNorm && pTeamNameNorm === activeTeamNameNorm;
          return matchesId || matchesName;
        })();

        if (isPlayerTeam) {
          activity = playerTeamStrategy.activity || 'standard';
        } else {
          // AI teams also practice/scrim occasionally
          const activities = ['standard', 'scrim', 'practice', 'bonding'];
          activity = activities[Math.floor(Math.random() * activities.length)];
        }

        player.rating.develop(activity);
        
        // Return updated data object
        return {
          ...pData,
          rating: { ...player.rating },
          overall: player.overall,
          potential: player.potential
        };
      });

          // 4. Process Pending Contract Offers
          const processedOffers = [];
          let updatedPlayersForOffers = [...developedPlayers];
          // const newInboxMessages = []; // MOVED TO TOP OF FUNCTION TO AVOID ReferenceError
    
          if (activeSave.pendingOffers && activeSave.pendingOffers.length > 0) {
            activeSave.pendingOffers.forEach(offer => {
              // FIND PLAYER BY IDENTITY (ID, Name, or Gamertag)
              const playerObj = updatedPlayersForOffers.find(p => 
                p.id === offer.playerId || 
                (p.name && p.name === offer.playerName) || 
                (p.gamertag && p.gamertag === offer.playerName)
              );
              
              if (!playerObj) return;
    
              const player = Player.fromJSON(playerObj);
          const marketValue = player.marketValue || 50000;
          const offeredSalary = offer.offeredSalary;
          
          // Logic for accepting/declining
          // 1. Salary comparison (primary factor)
          const salaryRatio = offeredSalary / marketValue;
          let acceptChance = 0.5; // Base 50% chance

          if (salaryRatio >= 1.5) acceptChance = 0.9;
          else if (salaryRatio >= 1.2) acceptChance = 0.75;
          else if (salaryRatio >= 1.0) acceptChance = 0.5;
          else if (salaryRatio >= 0.8) acceptChance = 0.2;
          else acceptChance = 0.05;

          const accepted = Math.random() < acceptChance;
          let reason = "";

          if (accepted) {
            const acceptReasons = [
                `The salary offer of $${offeredSalary.toLocaleString()} is very competitive and I believe in the vision of your organization.`,
                `I'm looking for a new challenge and your team seems like the perfect fit. The financial terms are also great.`,
                `After discussing with my agent, we've decided that joining your squad is the best move for my career right now.`,
                `The opportunity to play for your team is too good to pass up, especially with the contract you've put on the table.`
            ];
            reason = acceptReasons[Math.floor(Math.random() * acceptReasons.length)];
            
            // Update player team and salary
            updatedPlayersForOffers = updatedPlayersForOffers.map(p => {
              if (p.id === player.id) {
                // If they were on another team, they are no longer on that team
                // This ensures they don't appear for their old team in simulations
                console.log(`Player ${p.gamertag} moving from ${p.teamId || 'Free Agent'} to ${activeSave.teamId}`);
                
                // Track original team for replacement logic
                const originalTeamId = p.teamId;

                // CRITICAL: We update the player object to the new team.
                const updatedP = Player.fromJSON(p);
                updatedP.teamId = String(activeSave.teamId);
                updatedP.team = activeSave.team;
                updatedP.marketValue = offeredSalary; // New contract salary
                
                // If the player was poached from an AI team, handle replacement
                if (originalTeamId && String(originalTeamId) !== String(activeSave.teamId)) {
                  const originalTeam = teams.find(t => String(t.id) === String(originalTeamId));
                  if (originalTeam) {
                    const replacement = hireFreeAgentForTeam(originalTeam.id, originalTeam.name, originalTeam.region, updatedPlayersForOffers);
                    if (replacement) {
                      newInboxMessages.push({
                        id: Date.now() + Math.random().toString(36).substr(2, 9),
                        sender: "League News",
                        subject: "Roster Change: Player Poached",
                        body: `ALERT: ${originalTeam.name} has lost ${p.name || p.gamertag} to your team, ${activeSave.team}.\n\nTo fill the vacancy, ${originalTeam.name} has signed free agent ${replacement.name || replacement.gamertag} to their active roster.`,
                        date: new Date().toLocaleDateString(),
                        read: false
                      });
                    }
                  }
                }

                // IMPORTANT: We also need to remove any other occurrences of this player
                // from other teams to prevent them from appearing in multiple rosters.
                updatedPlayersForOffers = updatedPlayersForOffers.map(otherP => {
                  const isMatch = otherP && otherP.id !== p.id && (
                    (otherP.gamertag && otherP.gamertag === p.gamertag) || 
                    (otherP.name && otherP.name === p.name)
                  );
                  if (isMatch) {
                    // Mark as free agent or just remove them? 
                    // Better to mark as free agent so we don't break arrays, 
                    // or just let the next filter handle it.
                    return { ...otherP, teamId: null, team: null };
                  }
                  return otherP;
                });

                return {
                    ...p,
                    teamId: updatedP.teamId,
                    team: updatedP.team,
                    marketValue: updatedP.marketValue
                };
              }
              
              // REDUNDANCY CHECK: Ensure this player ID doesn't exist on any other team
              // We also check by name/gamertag for real players
              const isMatch = p && (p.id === offer.playerId || 
                                   (p.gamertag && p.gamertag === player.gamertag) || 
                                   (p.name && p.name === player.name));

              if (isMatch) {
                  const updatedP = Player.fromJSON(p);
                  updatedP.teamId = String(activeSave.teamId);
                  updatedP.team = activeSave.team;
                  return updatedP;
              }
              return p;
            });

            // CRITICAL: Ensure no other player has the same ID on another team (redundancy check)
            // This is primarily to handle the case where the simulation might be sourcing from a different data structure
            // though updatedPlayersForOffers should be the source of truth.
          } else {
            const declineReasons = [
                `The salary offer of $${offeredSalary.toLocaleString()} doesn't quite match my expectations given my current market value.`,
                `I've decided to stay with my current team for now. We have unfinished business here.`,
                `While I appreciate the interest, I don't feel that your team's current project aligns with my career goals.`,
                `I'm currently happy where I am and the offer wasn't convincing enough to make me consider a move.`
            ];
            reason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
          }

          newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: player.name || player.gamertag,
            subject: accepted ? "Contract Offer Accepted" : "Contract Offer Declined",
            body: `Hi Management,\n\n${reason}\n\nBest regards,\n${player.name || player.gamertag}`,
            date: new Date().toLocaleDateString(),
            read: false
          });
        });
      }

      // 5. Update basic info and sync kickoff state
      const playerTeamData = teams.find(t => String(t.id) === String(activeSave.teamId));
      const playerRegion = playerTeamData ? playerTeamData.region : "Americas";

      let updatedSave = {
        ...aiUpdatedSave,
        players: updatedPlayersForOffers,
        pendingOffers: [], // Clear pending offers
        week: nextWeek,
        season: nextSeason,
        history: [...(aiUpdatedSave.history || []), ...simulatedMatches.map(m => ({
          type: 'match',
          week: activeSave.week,
          text: `${m.winner} def. ${m.loser} (${m.score})`,
          logs: m.logs, // Ensure logs are passed to history
          details: m
        }))],
        kickoffState: getKickoffState(playerRegion, activeSave.id),
        regularSeasonMatches: [...(aiUpdatedSave.regularSeasonMatches || []), ...simulatedMatches],
        qualifiedTeams: allQualifiedTeams,
        kickoffResults: kickoffResults,
        mastersState: mastersResults,
        lastUpdate: Date.now()
      };

      // Ensure we include any player roster changes from tournament automation
      if (typeof updatedPlayers !== 'undefined') {
          updatedSave.players = updatedPlayers;
          // But we also need to keep the contract changes from updatedPlayersForOffers!
          // So we merge them back
          updatedPlayersForOffers.forEach(offerPlayer => {
              const idx = updatedSave.players.findIndex(p => p.id === offerPlayer.id);
              if (idx !== -1) {
                  updatedSave.players[idx] = offerPlayer;
              }
          });
      }

      // 6. Periodic Updates (Top 5 Contenders)
      if (nextWeek % 4 === 0) {
        const contendersMessage = generateContendersMessage(updatedPlayersForOffers);
        newInboxMessages.push(contendersMessage);
      }

      // 7. Create a descriptive inbox message
      let messageContent = `
        <div class="weekly-report">
          <div class="report-header">
            <h3>Week ${nextWeek} Report</h3>
            <div class="report-subtitle">Season ${nextSeason}</div>
          </div>
      `;
      
      if (simulatedMatches.length > 0) {
        messageContent += `
          <div class="report-section">
            <h4>Recent League Results</h4>
            <div class="match-results">
        `;
        simulatedMatches.forEach(m => {
          const winnerLogo = teamLogos[m.winner] || 'assets/team_logos/default.png';
          const loserLogo = teamLogos[m.loser] || 'assets/team_logos/default.png';
          messageContent += `
            <div class="match-result-item">
              <div class="match-team winner">
                <img src="${winnerLogo}" class="team-logo-small" alt="${m.winner}" />
                ${m.winner}
              </div>
              <div class="match-score">${m.score}</div>
              <div class="match-team loser">
                ${m.loser}
                <img src="${loserLogo}" class="team-logo-small" alt="${m.loser}" />
              </div>
            </div>
          `;
        });
        messageContent += `
            </div>
          </div>
        `;
      }

      if (rosterChanges.length > 0) {
        messageContent += `
          <div class="report-section">
            <h4>League News & Roster Changes</h4>
            <div class="roster-changes">
        `;
        rosterChanges.forEach(change => {
          messageContent += `<div class="roster-change-item">${change}</div>`;
        });
        messageContent += `
            </div>
          </div>
        `;
      } else if (!isMastersPrep) {
        messageContent += `
          <div class="report-section">
            <p>It was a relatively quiet week in the league with no major roster moves.</p>
          </div>
        `;
      }

      if (isMastersPrep && nextWeek < 7) {
        messageContent += `
          <div class="report-section">
            <h4>Mid-Season Break</h4>
            <p>The league is currently on a mid-season break. Teams are preparing for the upcoming Masters Bangkok tournament.</p>
          </div>
        `;
      }

      if (nextWeek === 7) {
        messageContent += `
          <div class="report-section">
            <h4>Masters Bangkok Begins!</h4>
            <p>The wait is over! Masters Bangkok kicks off this week. Check the bracket for upcoming matches.</p>
          </div>
        `;
      }

      if (nextWeek === 11) {
        messageContent += `
          <div class="report-section">
            <h4>Masters Bangkok Playoffs!</h4>
            <p>The Playoffs for Masters Bangkok has begun! This week we will crown a winner!</p>
          </div>
        `;
      }

      if (nextWeek === 12 && mastersResults && mastersResults.playoffs && mastersResults.playoffs.grandFinal) {
          const gfMatch = mastersResults.playoffs.matches[mastersResults.playoffs.grandFinal];
          const winner = gfMatch ? gfMatch.winner : "TBD";
          const tpMatch = mastersResults.playoffs.thirdPlace ? mastersResults.playoffs.matches[mastersResults.playoffs.thirdPlace] : null;
          const thirdPlace = tpMatch ? tpMatch.winner : "TBD";
          
          const winnerTeam = teams.find(t => t.name === winner);
          const winnerLogo = winnerTeam ? `assets/team_logos/${winnerTeam.name.toLowerCase().replace(/\s+/g, '_')}.png` : 'assets/team_logos/default.png';

          messageContent += `
            <div class="report-section" style="text-align: center; padding: 20px; background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; border-radius: 8px;">
                <h4 style="color: #FFD700; font-size: 1.4em; margin-bottom: 10px;">MASTERS BANGKOK CHAMPIONS</h4>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <img src="${winnerLogo}" alt="${winner}" style="width: 80px; height: 80px; object-fit: contain;" onerror="this.src='assets/team_logos/default.png'"/>
                    <div style="font-size: 1.5em; font-weight: bold; color: #fff;">${winner}</div>
                    <p style="margin-top: 5px;">Congratulations to ${winner} for winning Masters Bangkok and securing 3 Championship Points!</p>
                    ${thirdPlace !== 'TBD' ? `<p style="font-size: 0.9em; color: #ccc; margin-top: 5px;">3rd Place: <strong>${thirdPlace}</strong></p>` : ''}
                </div>
            </div>
          `;
      }

      if (activeSave.week === 4) {
        messageContent += `
          <div class="report-section">
            <h4>Masters Bangkok Qualified Teams</h4>
            <p style="margin-bottom: 15px;">The VCT Kickoff tournaments have concluded. Here are the teams qualified for Masters Bangkok:</p>
            <div class="kickoff-qualified-grid">
        `;
        regions.forEach(region => {
            const qualified = allQualifiedTeams[region];
            if (qualified && qualified.length > 0) {
                qualified.forEach(teamName => {
                   const logo = teamLogos[teamName] || 'assets/team_logos/default.png';
                   messageContent += `
                    <div class="qualified-team">
                        <img src="${logo}" class="team-logo-small" alt="${teamName}" />
                        <div>
                            <div class="qualified-region">${region.toUpperCase()}</div>
                            <div class="qualified-name">${teamName}</div>
                        </div>
                    </div>
                   `; 
                });
            }
        });
        messageContent += `
            </div>
          </div>
        `;
      }
      
      messageContent += `</div>`;

      const reportMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: "League Office",
        subject: `Week ${nextWeek} Report`,
        body: messageContent,
        contentType: 'html',
        date: new Date().toLocaleDateString(),
        read: false
      };

      // FINAL SANITY CHECK: Ensure every team (including user's) has exactly one IGL
      // This handles cases where user hired an IGL or released their own
      teams.forEach(t => {
        const teamId = String(t.id);
        const teamRoster = updatedSave.players.filter(p => String(p.teamId) === teamId);
        if (teamRoster.length > 0) {
            ensureIglAssignment(teamRoster);
        }
      });
      
      updatedSave.inbox = [reportMessage, ...newInboxMessages, ...(updatedSave.inbox || [])];
      console.log("SimWeekButton: Updated inbox count:", updatedSave.inbox.length);
      console.log("SimWeekButton: New message subject:", reportMessage.subject);

      // 8. Save and update state
      saveCareer(updatedSave);
      setActiveSave(updatedSave);
      
      // Force a standings update by dispatching a custom event
      // This is caught by CareerContent to refresh the regular season iframe
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("Week simulated:", nextWeek);
    }, 1500);
  };

  return (
    <>
      {isSimulating && <CareerLoadingOverlay />}
      <button 
        className="sim-week-btn" 
        onClick={handleSimulateWeek}
        disabled={isSimulating}
      >
        {isSimulating ? 'Simulating...' : 'Simulate Week'}
      </button>
    </>
  );
};

export default SimWeekButton;