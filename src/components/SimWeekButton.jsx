import React, { useState, useEffect } from 'react';
import { handleAiRosterChanges, hireFreeAgentForTeam } from '../ai_manager.js';
import { saveCareer, loadCareer, getKickoffState, saveKickoffState, clearKickoffState } from '../career_local_storage.jsx';
import { Player, Team, MatchSimulator, MAP_COORDINATES } from '../simulation.js';
import { teams, teamLogos } from '../teams.js';
import { ensureIglAssignment } from '../players.js';
import CareerLoadingOverlay from './CareerLoadingOverlay.jsx';
import { generateKickoffState, automateKickoffTournament, getQualifiedTeams } from '../tournaments/kickoff/kickoff_automation.js';
import { automateMastersTournament, awardMastersMVP, setMastersRegionalSeeds } from '../tournaments/masters/masters_automation.js';
import { automate8TeamMasters } from '../tournaments/masters/automation_8_team.js';
import { automate12TeamMasters } from '../tournaments/masters/automation_12_team.js';
import { automate16TeamChampions } from '../tournaments/champions/automation_16_team.js';
import { getChampions16Qualifiers, getFlatQualifiedList, createQualifiedTeamsHTML } from '../tournaments/champions/qualification.js';
import { showContextualTip, getTutorialState } from '../tutorial-enhanced.js';
import { initializeRegularSeason, generatePlayoffsBracket, simulatePlayoffsRound, awardRegionalChampionship } from '../tournaments/regular_season/regular_season_logic.js';

const SimWeekButton = ({ activeSave, setActiveSave }) => {
  const [isSimulating, setIsSimulating] = useState(false);

  // Define regions array at top level for use in all functions
  const regions = ["Americas", "EMEA", "Pacific", "China"];

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
    // Ensure savePlayers is an array
    if (!Array.isArray(savePlayers)) {
        console.error('simulateAiMatch: savePlayers must be an array, got:', typeof savePlayers, savePlayers);
        return;
    }
    
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

    // 2. Check if Masters Tokyo matches are pending (Weeks 25-32)
    // Prevent week simulation until all matches are played to ensure bracket saves correctly
    if (currentWeek >= 25 && currentWeek <= 32) {
        const mastersTokyoState = activeSave.mastersTokyoState;
        if (mastersTokyoState && !mastersTokyoState.complete) {
            // Check for pending Swiss matches
            const swissMatches = mastersTokyoState.swiss?.matches || {};
            const pendingSwiss = Object.values(swissMatches).filter(m => !m.winner && m.team1 && m.team2 && m.team1 !== 'TBD' && m.team2 !== 'TBD');
            
            // Check for pending Playoff matches
            const playoffMatches = mastersTokyoState.playoffs?.matches || {};
            const pendingPlayoffs = Object.values(playoffMatches).filter(m => !m.winner && m.team1 && m.team2 && m.team1 !== 'TBD' && m.team2 !== 'TBD');
            
            const totalPending = pendingSwiss.length + pendingPlayoffs.length;
            
            if (totalPending > 0) {
                alert(`⚠️ You have ${totalPending} unplayed Masters Tokyo match${totalPending > 1 ? 'es' : ''}!\n\nPlease complete all matches before simulating the week.\nThis ensures the bracket saves correctly.\n\nPending matches:\n- Swiss: ${pendingSwiss.length}\n- Playoffs: ${pendingPlayoffs.length}`);
                setIsSimulating(false);
                return;
            }
        }
    }

    // 3. Check if player team is eligible (min 5 players) for MATCHES
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
      
      // Helper to get strategy for any team with backward compatibility
      const getTeamStrategy = (teamId) => {
        const tIdStr = String(teamId);
        if (activeSave.strategies?.[tIdStr]) return activeSave.strategies[tIdStr];
        // Fallback for old saves (where strategies was the player strategy object directly)
        if (tIdStr === String(activeSave.teamId) && activeSave.strategies?.playstyle) return activeSave.strategies;
        // If still not found, return default
        return {
          playstyle: 'balanced',
          focus: 'standard',
          eco: 'standard',
          activity: 'standard'
        };
      };

      const playerTeamStrategy = getTeamStrategy(activeSave.teamId);

      // Don't simulate regular season matches during:
      // 1. Pre-season (Weeks 1-3)
      // 2. Kickoff Week (Week 4) - handled separately
      // 3. Masters Prep (Weeks 5-6)
      // 4. Masters Bangkok (Weeks 7-11) - 5 weeks
      // 5. Break Week (Week 12)
      // 6. Regular Season (Weeks 13-17) - 5 weeks
      // 7. Regional Playoffs (Weeks 18-23) - 6 weeks
      const isRegularSeason = currentWeek >= 13 && currentWeek <= 17; 
      const isPlayoffs = currentWeek >= 18 && currentWeek <= 23;

      // INBOX MESSAGE: Week 7 - Masters Bangkok Begins (Swiss Stage)
      if (nextWeek === 7) {
        newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "🌏 League Operations",
            subject: "Masters Bangkok - The Tournament Begins!",
            body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
              <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌏</span>
                <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Masters Bangkok Begins</h2>
                <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">The first international event of the season</p>
              </div>
              <div style="background: #0f1419; padding: 24px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                    The <strong style="color: #FFD700;">Swiss Stage</strong> has begun! Teams will compete to advance to the Playoffs.
                  </p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                  <div style="background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 6px;">🎯</div>
                    <div style="color: #FFD700; font-size: 11px; font-weight: 700; text-transform: uppercase;">Swiss Stage</div>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(246,224,94,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 6px;">⚔️</div>
                    <div style="color: #f6e05e; font-size: 11px; font-weight: 700; text-transform: uppercase;">Matches</div>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(251,211,141,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 6px;">🏆</div>
                    <div style="color: #fbd38d; font-size: 11px; font-weight: 700; text-transform: uppercase;">Glory</div>
                  </div>
                </div>
                <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(245,101,101,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                  <div style="color: #f6e05e; font-size: 16px; font-weight: 600;">Check the bracket to follow the action!</div>
                </div>
              </div>
              <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
              </div>
            </div>`,
            date: new Date().toLocaleDateString(),
            read: false,
            contentType: 'html'
        });
      }

      // INBOX MESSAGE: Week 9 - Masters Bangkok Playoffs Begin
      if (nextWeek === 9) {
        newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "🌏 League Operations",
            subject: "Masters Bangkok - Playoffs Begin!",
            body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
              <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌏</span>
                <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700;">Playoffs Begin</h2>
                <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Masters Bangkok Swiss Stage concluded</p>
              </div>
              <div style="background: #0f1419; padding: 24px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                    The top <strong style="color: #FFD700;">4 teams</strong> have advanced from the Swiss Stage!
                  </p>
                </div>
                <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 20px; text-align: center;">
                  <div style="font-size: 28px; margin-bottom: 8px;">🏆</div>
                  <div style="color: #FFD700; font-size: 16px; font-weight: 700; margin-bottom: 6px;">Who will lift the trophy?</div>
                  <div style="color: #faf089; font-size: 13px;">The international championship is within reach!</div>
                </div>
                <div style="background: rgba(251, 211, 141, 0.1); border: 1px solid rgba(251, 211, 141, 0.2); border-radius: 10px; padding: 14px; text-align: center; margin-top: 20px;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 18px;">📋</span>
                    <span style="color: #fbd38d; font-size: 14px; font-weight: 600;">Check the bracket for playoff matchups!</span>
                  </div>
                </div>
              </div>
              <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
              </div>
            </div>`,
            date: new Date().toLocaleDateString(),
            read: false,
            contentType: 'html'
        });
      }

      // INBOX MESSAGE: Week 18 (Regional Playoffs Begin)
      const regularSeasonState = aiUpdatedSave.regularSeason;
      const isRegularSeasonPlayoffsComplete = regularSeasonState?.playoffs?.grandFinal?.winner ||
                                              (regularSeasonState?.playoffs?.matches &&
                                               Object.values(regularSeasonState.playoffs.matches).every(m => m.winner));
      if (nextWeek === 18 && !isRegularSeasonPlayoffsComplete) {
        newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "🏆 League Operations",
            subject: "Regional Playoffs Begin!",
            body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
              <div style="background: linear-gradient(135deg, #1a3a2f 0%, #0d2618 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #48bb78;">
                <span style="font-size: 32px; margin-bottom: 8px; display: block;">🏆</span>
                <h2 style="color: #68d391; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Playoffs Begin</h2>
                <p style="color: #9ae6b4; margin: 8px 0 0 0; font-size: 14px;">The Regular Season has concluded</p>
              </div>
              <div style="background: #0f1419; padding: 24px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                    The top <strong style="color: #68d391;">4 teams</strong> from each group have advanced to the Regional Playoffs!
                  </p>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                  <div style="background: linear-gradient(135deg, rgba(72,187,120,0.2) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(72,187,120,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                    <div style="color: #68d391; font-size: 20px; font-weight: 800; margin-bottom: 4px;">QF</div>
                    <div style="color: #9ae6b4; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Quarterfinals</div>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(246,224,94,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(246,224,94,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                    <div style="color: #f6e05e; font-size: 20px; font-weight: 800; margin-bottom: 4px;">SF</div>
                    <div style="color: #faf089; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Semifinals</div>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(251,211,141,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(251,211,141,0.2); border-radius: 10px; padding: 14px; text-align: center;">
                    <div style="color: #fbd38d; font-size: 20px; font-weight: 800; margin-bottom: 4px;">WF</div>
                    <div style="color: #ffe4b5; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Winners Final</div>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                    <div style="color: #FFD700; font-size: 20px; font-weight: 800; margin-bottom: 4px;">GF</div>
                    <div style="color: #faf089; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Grand Final</div>
                  </div>
                </div>
                <div style="background: rgba(72, 187, 120, 0.1); border: 1px solid rgba(72, 187, 120, 0.2); border-radius: 10px; padding: 14px; text-align: center;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 18px;">📋</span>
                    <span style="color: #68d391; font-size: 14px; font-weight: 600;">Check the bracket for Quarterfinal matchups!</span>
                  </div>
                </div>
              </div>`,
            date: new Date().toLocaleDateString(),
            read: false,
            contentType: 'html'
        });
      }

      if (isRegularSeason) {
        // Initialize Regular Season if not present (starts Week 13)
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
                const t1Strategy = getTeamStrategy(t1.id);
                const t2Strategy = getTeamStrategy(t2.id);

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

        // Generate Playoff Bracket at the end of Regular Season (Week 17 - last match week)
        if (currentWeek === 17) {
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

          // Playoffs Simulation (Weeks 18-23)
              // Ensure playoffs bracket exists (for debug jumps or fresh starts)
              if (currentWeek >= 18 && currentWeek <= 23) {
              // Generate bracket if missing (handles debug jumps to mid-playoffs)
              if (!aiUpdatedSave.regularSeason.playoffs) {
                  console.log(`Week ${currentWeek}: Generating missing playoffs bracket...`);
                  aiUpdatedSave.regularSeason = generatePlayoffsBracket(aiUpdatedSave.regularSeason);
              }
              
              console.log(`Week ${currentWeek}: Simulating playoffs round...`, aiUpdatedSave.regularSeason.playoffs);
              
              aiUpdatedSave.regularSeason = simulatePlayoffsRound(
                  aiUpdatedSave.regularSeason, 
                  (t1, t2, players) => {
                      const t1Strategy = getTeamStrategy(t1.id);
                      const t2Strategy = getTeamStrategy(t2.id);
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
      const updatedPlayers = Array.isArray(aiUpdatedSave.players) ? [...aiUpdatedSave.players] : [];

      // Award Regional Championships after Grand Final week (Week 20 now, was 18)
      if (currentWeek === 20) {
          regions.forEach(region => {
              awardRegionalChampionship(aiUpdatedSave.regularSeason, region, updatedPlayers, activeSave.season || 1);
          });
      }

      // MASTERS TOKYO FLOW: Week 21 - Travel & Prep Week + Announce qualified teams
      if (nextWeek === 21) {
          // Gather qualified teams for announcement
          const highSeeds = [];
          const lowSeeds = [];
          
          regions.forEach(region => {
              const bracket = aiUpdatedSave.regularSeason?.playoffs?.[region];
              if (!bracket) return;
              
              const grandFinal = bracket?.grandFinal?.[0];
              const lbFinal = bracket?.lower?.final?.[0];
              
              if (grandFinal?.winner) highSeeds.push(grandFinal.winner);
              if (grandFinal?.loser) lowSeeds.push(grandFinal.loser);
              if (lbFinal?.loser) lowSeeds.push(lbFinal.loser);
          });
          
          if (highSeeds.length >= 4 && lowSeeds.length >= 8) {
              const teamsHtml = [...highSeeds, ...lowSeeds].map((t, i) => 
                  `<b>${i < 4 ? 'High Seed' : 'Low Seed'} ${i < 4 ? i + 1 : i - 3}:</b> ${t}`
              ).join('<br>');
              
              const highSeedsHtml = highSeeds.map((t, i) => `
                <div style="background: rgba(245, 101, 101, 0.2); padding: 8px 12px; border-radius: 6px; margin: 4px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="color: #fc8181; font-weight: bold; font-size: 12px;">HIGH ${i+1}</span>
                  <span style="color: #fff; font-weight: bold; font-size: 13px;">${t}</span>
                </div>
              `).join('');
              
              const lowSeedsHtml = lowSeeds.slice(0, 8).map((t, i) => `
                <div style="background: rgba(66, 153, 225, 0.2); padding: 8px 12px; border-radius: 6px; margin: 4px 0; display: flex; align-items: center; gap: 8px;">
                  <span style="color: #63b3ed; font-weight: bold; font-size: 12px;">LOW ${i+1}</span>
                  <span style="color: #fff; font-size: 13px;">${t}</span>
                </div>
              `).join('');
              
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "🎌 League Operations",
                  subject: "Masters Tokyo - 12 Teams Qualified!",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #2d1b4e 0%, #1a0f2e 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #f56565;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🗾</span>
                  <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700;">Masters Tokyo Qualifiers</h2>
                  <p style="color: #e9d8fd; margin: 8px 0 0 0; font-size: 14px;">12 teams. 4 regions. 1 international stage.</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <div style="background: rgba(245, 101, 101, 0.2); border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 12px;">
                        <span style="color: #fc8181; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">🔥 High Seeds (4)</span>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                          ${highSeeds.map((team, i) => `
                            <div style="background: linear-gradient(90deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.2) 100%); border-left: 3px solid #fc8181; border-radius: 0 6px 6px 0; padding: 8px 10px;">
                              <span style="color: #fff; font-size: 13px; font-weight: 600;">${team}</span>
                            </div>
                          `).join('')}
                        </div>
                    </div>
                    <div>
                      <div style="background: rgba(66, 153, 225, 0.2); border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 12px;">
                        <span style="color: #63b3ed; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">💧 Low Seeds (8)</span>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                          ${lowSeeds.slice(0, 8).map((team, i) => `
                            <div style="background: linear-gradient(90deg, rgba(66,153,225,0.1) 0%, rgba(26,35,50,0.2) 100%); border-left: 3px solid #63b3ed; border-radius: 0 6px 6px 0; padding: 6px 10px;">
                              <span style="color: #e2e8f0; font-size: 12px;">${team}</span>
                            </div>
                          `).join('')}
                        </div>
                    </div>
                  </div>
                  <div style="background: rgba(245, 101, 101, 0.1); border: 1px solid rgba(245, 101, 101, 0.2); border-radius: 8px; padding: 14px; text-align: center; margin-top: 20px;">
                    <span style="color: #fc8181; font-size: 14px; font-weight: 600;">⏰ Swiss Stage begins Week 25 (after Regional Playoffs)</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          }
      }

      // Check if playoffs are complete before allowing Week 24 to advance (after Grand Finals Week 23)
      if (nextWeek === 24) {
          let allPlayoffsComplete = true;
          let incompleteRegions = [];
          const highSeeds = [];
          const lowSeeds = [];

          regions.forEach(region => {
              const bracket = aiUpdatedSave.regularSeason?.playoffs?.[region];
              if (!bracket) {
                  allPlayoffsComplete = false;
                  incompleteRegions.push(region);
                  return;
              }

              // Check if Grand Final has a winner AND Lower Bracket Final has a loser (for 3rd place)
              const grandFinal = bracket?.grandFinal?.[0];
              const lbFinal = bracket?.lower?.final?.[0];
              if (!grandFinal || !grandFinal.winner) {
                  allPlayoffsComplete = false;
                  incompleteRegions.push(`${region} (Grand Final incomplete)`);
              } else if (!lbFinal || !lbFinal.loser) {
                  allPlayoffsComplete = false;
                  incompleteRegions.push(`${region} (Lower Bracket Final incomplete)`);
              } else {
                  // Collect qualified teams for Masters Tokyo
                  // 1st: Winner of GF -> High Seed
                  highSeeds.push(grandFinal.winner);
                  // 2nd: Loser of GF -> Low Seed
                  lowSeeds.push(grandFinal.loser);
                  // 3rd: Loser of LB Final -> Low Seed
                  lowSeeds.push(lbFinal.loser);
              }
          });

          if (!allPlayoffsComplete) {
              console.warn(`Playoffs not complete in regions: ${incompleteRegions.join(', ')}`);
              alert(`You must complete all Regional Playoffs Grand Finals before advancing! Incomplete regions: ${incompleteRegions.join(', ')}`);
              setIsSimulating(false);
              return;
          }
          
          // AUTO-QUALIFY for Masters Tokyo: All playoffs complete, populate mastersTokyoQualified
          if (highSeeds.length >= 4 && lowSeeds.length >= 8) {
              console.log("Auto-qualifying teams for Masters Tokyo:", { highSeeds, lowSeeds });
              aiUpdatedSave.mastersTokyoQualified = {
                  highSeeds: highSeeds.map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).slice(0, 4),
                  lowSeeds: lowSeeds.map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).slice(0, 8)
              };
              console.log("mastersTokyoQualified auto-populated:", aiUpdatedSave.mastersTokyoQualified);
          }
      }
      
      // FALLBACK: If at Week 24 and mastersTokyoQualified is missing, try to populate from completed playoffs
      if (nextWeek === 24 && !aiUpdatedSave.mastersTokyoQualified) {
          console.log("Week 24: mastersTokyoQualified missing, attempting to populate from completed playoffs...");
          const highSeeds = [];
          const lowSeeds = [];
          
          regions.forEach(region => {
              const bracket = aiUpdatedSave.regularSeason?.playoffs?.[region];
              if (!bracket) return;
              
              const grandFinal = bracket?.grandFinal?.[0];
              const lbFinal = bracket?.lower?.final?.[0];
              
              if (grandFinal?.winner && grandFinal?.loser && lbFinal?.loser) {
                  highSeeds.push(grandFinal.winner);
                  lowSeeds.push(grandFinal.loser);
                  lowSeeds.push(lbFinal.loser);
              }
          });
          
          if (highSeeds.length >= 4 && lowSeeds.length >= 8) {
              console.log("Fallback: Populated mastersTokyoQualified from completed playoffs:", { highSeeds, lowSeeds });
              aiUpdatedSave.mastersTokyoQualified = {
                  highSeeds: highSeeds.map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).slice(0, 4),
                  lowSeeds: lowSeeds.map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).slice(0, 8)
              };
          } else {
              console.warn("Fallback: Could not populate mastersTokyoQualified - not enough teams:", { highSeeds: highSeeds.length, lowSeeds: lowSeeds.length });
          }
      }

      // MASTERS TOKYO FLOW: Week 25 - Initialize Masters Tokyo Swiss Stage
      // Load from activeSave first (has most recent user-played matches from current week)
      // Fall back to aiUpdatedSave for state carried over from previous week simulation
      // CRITICAL: Prioritize aiUpdatedSave over activeSave since aiUpdatedSave contains
      // the most recent state updates from previous week simulations
      let mastersTokyoState = aiUpdatedSave.mastersTokyoState 
          ? JSON.parse(JSON.stringify(aiUpdatedSave.mastersTokyoState)) 
          : (activeSave.mastersTokyoState ? JSON.parse(JSON.stringify(activeSave.mastersTokyoState)) : null);
      
      // Check if we need to reset Masters Tokyo for a new season/tournament
      const isWeek25Start = nextWeek === 25;
      const isMissingState = (nextWeek > 25 && nextWeek <= 32) && !mastersTokyoState;
      const isNewSeason = mastersTokyoState && mastersTokyoState.season !== nextSeason;
      
      // Initialize if entering Tokyo week, missing data, or season changed
      const shouldResetMastersTokyo = isWeek25Start || isMissingState || isNewSeason;
      
      if (shouldResetMastersTokyo) {
        // If we have old state from previous season, clear it
        if (mastersTokyoState && isNewSeason) {
          console.log(`Resetting Masters Tokyo for new season ${nextSeason} (was season ${mastersTokyoState.season})`);
        }
        // Just initialize the state, don't simulate anything yet
        console.log("Initializing Masters Tokyo state (Resetting/Creating)...");
        
        // Use mastersTokyoQualified which has 4 high seeds + 8 low seeds (12 teams total)
        const tokyoQualified = activeSave.mastersTokyoQualified || {};
        const highSeeds = (tokyoQualified.highSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
        const lowSeeds = (tokyoQualified.lowSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
        
        // Combine for full qualified list (12 teams)
        const flatQualifiedTeams = [...highSeeds, ...lowSeeds];
        
        console.log(`Masters Tokyo qualified teams: ${flatQualifiedTeams.length} total (${highSeeds.length} high seeds, ${lowSeeds.length} low seeds)`);
        console.log("High seeds:", highSeeds);
        console.log("Low seeds:", lowSeeds);
        
        if (flatQualifiedTeams.length >= 8) {
          // Get #1 seeds from each region based on regular season standings
          const regionalSeeds = {};
          regions.forEach(region => {
            const regionStandings = Object.entries(aiUpdatedSave.regularSeason?.standings || {})
              .filter(([id, stats]) => stats.region === region)
              .map(([id, stats]) => ({ id: parseInt(id), ...stats }))
              .sort((a, b) => b.wins - a.wins || a.losses - b.losses); // Sort by wins desc, then losses asc
            
            if (regionStandings.length > 0) {
              const topTeam = regionStandings[0];
              regionalSeeds[region] = topTeam.name;
              console.log(`${region} #1 Seed: ${topTeam.name} (${topTeam.wins}-${topTeam.losses})`);
            }
          });
          
          mastersTokyoState = {
            season: nextSeason,
            swiss: {
              rounds: [],
              teamStats: {},
              matches: {}
            },
            playoffs: {
              upper: { round1: [], round2: [], final: null },
              lower: { round1: [], round2: [], final: null },
              grandFinal: null,
              matches: {},
              regionalSeeds: regionalSeeds
            },
            series: {},
            complete: false,
            dirty: false,
            messages: []
          };
          flatQualifiedTeams.forEach(teamName => {
            mastersTokyoState.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
          });
          
          aiUpdatedSave.mastersTokyoState = mastersTokyoState;
          
          newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "League Operations",
            subject: "🎌 Masters Tokyo Begins!",
            body: `<div style="padding: 16px; background: linear-gradient(135deg, #1a2332 0%, #2d3748 100%); border-radius: 12px; border-left: 4px solid #9ae6b4; text-align: center;">
              <h3 style="color: #9ae6b4; margin: 0 0 12px 0; font-size: 22px;">🎌 Masters Tokyo Begins!</h3>
              <p style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 15px; line-height: 1.6;">
                The second international event of the year has <strong style="color: #9ae6b4;">begun</strong>!
              </p>
              <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                <div style="text-align: center;">
                  <div style="font-size: 24px; margin-bottom: 5px;">🎯</div>
                  <div style="color: #9ae6b4; font-size: 12px;">Swiss Stage</div>
                  <div style="color: #e2e8f0; font-size: 14px; font-weight: bold;">8 Teams</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 24px; margin-bottom: 5px;">🏆</div>
                  <div style="color: #fbd38d; font-size: 12px;">Playoffs</div>
                  <div style="color: #e2e8f0; font-size: 14px; font-weight: bold;">Top 4 Advance</div>
                </div>
              </div>
              <div style="margin-top: 15px; padding: 10px; background: rgba(154, 230, 180, 0.15); border-radius: 8px;">
                <span style="color: #9ae6b4; font-weight: bold; font-size: 14px;">⚔️ Check the bracket and follow the action!</span>
              </div>
            </div>`,
            date: new Date().toLocaleDateString(),
            read: false,
            contentType: 'html'
          });
        }
      }

      // MASTERS TOKYO FLOW: Week 26 - Swiss Stage Round 2 (High/Low Matches)
      if (nextWeek === 26 && mastersTokyoState && !mastersTokyoState.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🌸 League Operations",
              subject: "Masters Tokyo - Swiss Stage Round 2",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #2d1b4e 0%, #1a0f2e 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #9f7aea;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌸</span>
                  <h2 style="color: #b794f4; margin: 0; font-size: 22px; font-weight: 700;">Swiss Stage - Round 2</h2>
                  <p style="color: #e9d8fd; margin: 8px 0 0 0; font-size: 14px;">High & Low Bracket Matches</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #b794f4;">Swiss Stage</strong> continues with Round 2!<br>
                    Winners move on, losers get eliminated!
                  </p>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(154,230,180,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(154,230,180,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">🏆</div>
                      <div style="color: #9ae6b4; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">High Matches</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">1-0 Records</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(245,101,101,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">⚠️</div>
                      <div style="color: #fc8181; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Low Matches</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">0-1 Records</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(159,122,234,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🏆 Qualification Rounds (1-1) next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 27 - Swiss Stage Final Rounds (1-1 Qualification/Elimination)
      if (nextWeek === 27 && mastersTokyoState && !mastersTokyoState.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🌸 League Operations",
              subject: "Masters Tokyo - Swiss Final Rounds!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #f56565;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌸</span>
                  <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700;">Swiss Final Rounds!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Qualification & Elimination Matches</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #ff6b6b;">Swiss Stage</strong> reaches its conclusion!<br>
                    Teams with 1-1 records face their final matches.<br>
                    <strong style="color: #FFD700;">Winners move on, losers get eliminated!</strong>
                  </p>
                  <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 8px; padding: 14px; text-align: center;">
                    <span style="color: #FFD700; font-size: 14px; font-weight: 600;">⏰ Top 4 qualify for Playoffs! Playoffs begin Week 28!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 28 - Playoffs Begin (Quarterfinals)
      if (nextWeek === 28 && mastersTokyoState && !mastersTokyoState.complete) {
          // Get actual bracket matchups from the generated matches
          const playoffs = mastersTokyoState.playoffs;
          const ubR1Matches = playoffs?.upper?.round1 || [];
          
          // Generate matchup messages from actual bracket matches
          let matchupHtml = '';
          ubR1Matches.forEach((matchId, index) => {
              const match = playoffs?.matches?.[matchId];
              if (match && match.team1 && match.team2) {
                  matchupHtml += `
                    <div style="background: linear-gradient(90deg, rgba(255,215,0,0.1) 0%, rgba(154,230,180,0.1) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #FFD700; font-weight: 600;">👑 ${match.team1}</span>
                        <span style="color: #718096;">vs</span>
                        <span style="color: #9ae6b4; font-weight: 600;">⚔️ ${match.team2}</span>
                      </div>
                    </div>
                  `;
              }
          });
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🏆 League Operations",
              subject: "Masters Tokyo - Playoffs Begin!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🏆</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700;">Playoffs Begin!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Double Elimination Bracket - Quarterfinals</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #FFD700;">Masters Tokyo Playoffs</strong> are here!<br>
                    4 Regional Champions face 4 Swiss Qualifiers!
                  </p>
                  
                  <div style="margin-bottom: 20px;">
                    <div style="color: #fc8181; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; text-align: center;">Quarterfinal Matchups</div>
                    ${matchupHtml}
                  </div>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">👑</div>
                      <div style="color: #FFD700; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">High Seeds</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">Regional Champions</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(154,230,180,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(154,230,180,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">⚔️</div>
                      <div style="color: #9ae6b4; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Swiss Qualifiers</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">Swiss Stage Top 4</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(245,101,101,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #FFD700; font-size: 14px; font-weight: 600;">⚔️ 4 Quarterfinal Matches - Double Elimination Begins!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 29 - Semifinals (2 UB) + LB Round 1 (2 matches)
      if (nextWeek === 29 && mastersTokyoState && !mastersTokyoState.complete) {
          // Get QF winners for display
          const playoffs = mastersTokyoState.playoffs;
          let qfWinners = [];
          if (playoffs?.upper?.round1?.length === 4) {
              qfWinners = playoffs.upper.round1.map(id => {
                  const match = playoffs.matches[id];
                  return match?.winner || 'TBD';
              }).filter(w => w !== 'TBD');
          }
          
          const winnersHtml = qfWinners.length > 0
              ? qfWinners.map(w => `<span style="color: #FFD700; font-weight: 600;">${w}</span>`).join(', ')
              : '<span style="color: #8b9dc3;">Quarterfinals in progress...</span>';
          
          // Get SF matchups
          let sfMatchups = [];
          if (playoffs?.upper?.round2?.length === 2) {
              sfMatchups = playoffs.upper.round2.map(id => {
                  const match = playoffs.matches[id];
                  return match ? `${match.team1} vs ${match.team2}` : 'TBD';
              });
          }
          
          const sfHtml = sfMatchups.length > 0
              ? sfMatchups.map(m => `<div style="color: #fc8181; font-size: 13px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">${m}</div>`).join('')
              : '<div style="color: #8b9dc3; font-size: 13px;">Bracket updating...</div>';
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🔥 League Operations",
              subject: "Masters Tokyo - Semifinals & LB R1!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #742a2a 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #f56565;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🔥</span>
                  <h2 style="color: #fc8181; margin: 0; font-size: 24px; font-weight: 700;">Semifinals & LB R1!</h2>
                  <p style="color: #feb2b2; margin: 8px 0 0 0; font-size: 14px;">4 matches this week - 2 UB + 2 LB</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <div style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="color: #FFD700; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; text-align: center;">UB Semifinals - 2 Matches</div>
                    <div style="color: #e2e8f0; font-size: 13px; text-align: center;">Winners: UB Final | Losers: LB Round 2</div>
                  </div>
                  <div style="background: rgba(252,129,129,0.1); border: 1px solid rgba(252,129,129,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="color: #fc8181; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; text-align: center;">LB Round 1 - 2 Matches</div>
                    <div style="color: #e2e8f0; font-size: 13px; text-align: center;">QF Losers battle - Elimination matches!</div>
                  </div>
                  <p style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    <strong style="color: #FFD700;">Semifinals:</strong> Winners to UB Final<br>
                    <strong style="color: #fc8181;">LB R1:</strong> Losers eliminated (5th-8th place)
                  </p>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #FFD700; font-size: 14px; font-weight: 600;">🏆 UB Final & LB R2 next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 25+ - Handle tournament progression (like Bangkok)
      // Week 25-27: Swiss Stage (3 weeks)
      // Week 28-32: Playoffs (5 weeks)
      // Week 33: Break (but ensure Tokyo is complete)
      // Weeks 34-35: Champions Prep
      // Week 36: Champions begins
      // Run Tokyo automation through Week 33 to ensure completion
      if (nextWeek >= 25 && nextWeek <= 33 && mastersTokyoState && !mastersTokyoState.complete) {
          // CHECK: Are there incomplete matches in current Masters Tokyo round?
          if (nextWeek >= 28 && nextWeek <= 32) {
              const playoffs = mastersTokyoState.playoffs;
              let currentRoundMatches = [];
              let roundName = '';
              
              // Determine current round based on week
              if (nextWeek === 28) {
                  currentRoundMatches = playoffs?.upper?.round1 || [];
                  roundName = 'Quarterfinals (UB Round 1)';
              } else if (nextWeek === 29) {
                  currentRoundMatches = [...(playoffs?.upper?.round2 || []), ...(playoffs?.lower?.round1 || [])];
                  roundName = 'Semifinals (UB Round 2 + LB Round 1)';
              } else if (nextWeek === 30) {
                  currentRoundMatches = [playoffs?.upper?.final, ...(playoffs?.lower?.round2 || [])].filter(Boolean);
                  roundName = 'UB Final + LB Round 2';
              } else if (nextWeek === 31) {
                  currentRoundMatches = [playoffs?.lower?.final].filter(Boolean);
                  roundName = 'LB Final';
              } else if (nextWeek === 32) {
                  currentRoundMatches = [playoffs?.grandFinal].filter(Boolean);
                  roundName = 'Grand Final';
              }
              
              // Check for incomplete matches
              const incompleteMatches = currentRoundMatches.filter(matchId => {
                  const match = playoffs?.matches?.[matchId];
                  return match && !match.winner && match.team1 && match.team2 && match.team1 !== 'TBD' && match.team2 !== 'TBD';
              });
              
              if (incompleteMatches.length > 0) {
                  console.warn(`Masters Tokyo ${roundName} has ${incompleteMatches.length} incomplete matches!`);
                  alert(`⚠️ You must complete all Masters Tokyo ${roundName} matches before advancing to the next week!\n\nIncomplete matches: ${incompleteMatches.length}\n\nPlease go to Masters Tokyo and simulate the remaining matches.`);
                  setIsSimulating(false);
                  return;
              }
          }
          
          // Use mastersTokyoQualified which has 4 high seeds + 8 low seeds (12 teams total)
          const tokyoQualified = activeSave.mastersTokyoQualified || {};
          const highSeeds = (tokyoQualified.highSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
          const lowSeeds = (tokyoQualified.lowSeeds || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);
          const flatQualifiedTeams = [...highSeeds, ...lowSeeds];
          
          console.log(`Masters Tokyo Week ${nextWeek}: ${flatQualifiedTeams.length} teams (${highSeeds.length} high, ${lowSeeds.length} low)`);

          if (flatQualifiedTeams.length >= 8) {
            const oldState = JSON.stringify(mastersTokyoState);
            
            // Build regional seeds object from high seeds
            const regionalSeeds = {};
            regions.forEach((region, index) => {
              if (highSeeds[index]) {
                regionalSeeds[region] = highSeeds[index];
              }
            });
            
            // AUTOMATION RESTORED BUT ONLY FOR ROUND GENERATION
            mastersTokyoState = automate12TeamMasters(flatQualifiedTeams, regionalSeeds, updatedPlayers, simulateAiMatch, mastersTokyoState, activeSave.team, 'M-TOKYO-', nextWeek);
            
            // --- Simulate AI vs AI matches in Masters Tokyo immediately ---
            // REMOVED: We don't want to auto-simulate AI matches either. User must click "Simulate" on the match.
            // --------------------------------------------------------

            // CRITICAL FIX: Update the save object with the new masters state
            aiUpdatedSave.mastersTokyoState = mastersTokyoState;

            if (mastersTokyoState && JSON.stringify(mastersTokyoState) !== oldState) {
                // Find what changed in matches
                const oldMasters = JSON.parse(oldState);
                
                // Check Swiss matches
                if (mastersTokyoState.swiss?.matches && oldMasters.swiss?.matches) {
                    Object.keys(mastersTokyoState.swiss.matches).forEach(matchId => {
                        const newMatch = mastersTokyoState.swiss.matches[matchId];
                        const oldMatch = oldMasters.swiss.matches[matchId];
                        
                        // If this match just got a winner
                        if (newMatch?.winner && (!oldMatch || !oldMatch.winner)) {
                            // Check if player team is involved
                            const isPlayerInvolved = (activeSave.team === newMatch.team1 || activeSave.team === newMatch.team2);
                            
                            if (!isPlayerInvolved) {
                                // This was an AI vs AI match that was just simulated by automation
                                console.log(`Masters Tokyo AI vs AI match completed: ${newMatch.team1} vs ${newMatch.team2}, Winner: ${newMatch.winner}`);
                            }
                        }
                    });
                }
                
                // Check Playoff matches
                if (mastersTokyoState.playoffs?.matches && oldMasters.playoffs?.matches) {
                    Object.keys(mastersTokyoState.playoffs.matches).forEach(matchId => {
                        const newMatch = mastersTokyoState.playoffs.matches[matchId];
                        const oldMatch = oldMasters.playoffs.matches[matchId];
                        
                        // If this match just got a winner
                        if (newMatch?.winner && (!oldMatch || !oldMatch.winner)) {
                            // Check if player team is involved
                            const isPlayerInvolved = (activeSave.team === newMatch.team1 || activeSave.team === newMatch.team2);
                            
                            if (!isPlayerInvolved) {
                                // This was an AI vs AI match that was just simulated by automation
                                console.log(`Masters Tokyo Playoff AI vs AI match completed: ${newMatch.team1} vs ${newMatch.team2}, Winner: ${newMatch.winner}`);
                            }
                        }
                    });
                }
            }

            // Award Championship Points if tournament just completed
            if (mastersTokyoState.complete) {
                // Check for winner and award points
                const gfMatchId = mastersTokyoState.playoffs?.grandFinal;
                const gfMatch = gfMatchId ? mastersTokyoState.playoffs.matches[gfMatchId] : null;
                const oldGfMatchId = JSON.parse(oldState).playoffs?.grandFinal;
                const oldGfMatch = oldGfMatchId ? JSON.parse(oldState).playoffs?.matches?.[oldGfMatchId] : null;
                
                if (gfMatch && gfMatch.winner && (!oldGfMatch || !oldGfMatch.winner)) {
                    const winnerName = gfMatch.winner;
                    if (!aiUpdatedSave.championshipPoints) aiUpdatedSave.championshipPoints = {};
                    aiUpdatedSave.championshipPoints[winnerName] = (aiUpdatedSave.championshipPoints[winnerName] || 0) + 3;
                    console.log(`CP: ${winnerName} gets +3 points for winning Masters Tokyo.`);
                    
                    // Award Masters Tokyo MVP
                    awardMastersMVP(mastersTokyoState, updatedPlayers, activeSave.season || 1);
                }
            }
          }
      }

      // MASTERS TOKYO FLOW: Week 30 - UB Final + LB Round 2
      if (nextWeek === 30 && mastersTokyoState && !mastersTokyoState.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🏆 League Operations",
              subject: "Masters Tokyo - UB Final & LB R2!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🏆</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700;">UB Final & LB R2!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">3 matches this week - 1 UB + 2 LB</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #FFD700;">Upper Bracket Final</strong> determines who goes directly to Grand Final!<br>
                    <strong style="color: #fc8181;">Lower Bracket Round 2:</strong> UB SF losers face LB R1 survivors.
                  </p>
                  <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="color: #FFD700; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">UB Final</div>
                      <div style="color: #fff; font-size: 18px; margin-top: 4px;">1 Match</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(245,101,101,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="color: #fc8181; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">LB Round 2</div>
                      <div style="color: #fff; font-size: 18px; margin-top: 4px;">2 Matches</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #FFD700; font-size: 14px; font-weight: 600;">🏆 LB Final coming next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 31 - LB Final (Lower Bracket Final)
      if (nextWeek === 31 && mastersTokyoState && !mastersTokyoState.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🔥 League Operations",
              subject: "Masters Tokyo - LB Final!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #742a2a 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #f56565;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🔥</span>
                  <h2 style="color: #fc8181; margin: 0; font-size: 24px; font-weight: 700;">LB Final!</h2>
                  <p style="color: #feb2b2; margin: 8px 0 0 0; font-size: 14px;">1 match - Winner advances to Grand Final</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #fc8181;">Lower Bracket Final</strong> decides who faces the UB Final loser!<br>
                    Winner qualifies for Grand Final. Loser finishes 3rd place.
                  </p>
                  <div style="background: rgba(245, 101, 101, 0.1); border: 1px solid rgba(245, 101, 101, 0.2); border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 16px;">
                    <div style="color: #fc8181; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Matchup</div>
                    <div style="color: #fff; font-size: 14px; margin-top: 8px;">LB Round 2 Winner vs UB Final Loser</div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(245,101,101,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🏆 Grand Final next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 32 - GRAND FINAL
      if (nextWeek === 32 && mastersTokyoState && !mastersTokyoState.complete) {
          // Structured Playoff Schedule (corrected):
          // Week 28: UB Quarterfinals (4 matches)
          // Week 29: UB Semifinals (2 matches) + LB Round 1 (2 matches) = 4 total
          // Week 30: UB Final (1 match) + LB Round 2 (2 matches) = 3 total
          // Week 31: LB Final (1 match)
          // Week 32: Grand Final (1 match)
          
          // URGENT: By Week 32, ensure all bracket rounds exist
          const playoffs = mastersTokyoState.playoffs;
          if (playoffs) {
              // Force generate any missing finals
              if (!playoffs.upper?.final && playoffs.upper?.round2?.length === 2) {
                  const ubR2Winners = playoffs.upper.round2.map(id => playoffs.matches[id]?.winner).filter(Boolean);
                  if (ubR2Winners.length === 2) {
                      const ubFinalId = 'M-TOKYO-PLAYOFF-UB-FINAL';
                      playoffs.matches[ubFinalId] = {
                          team1: ubR2Winners[0], team2: ubR2Winners[1],
                          winner: null, loser: null, score: null, playerStats: null,
                          bracket: 'upper', round: 'final'
                      };
                      playoffs.upper.final = ubFinalId;
                      console.log(`Week 32: Created UB Final: ${ubR2Winners[0]} vs ${ubR2Winners[1]}`);
                  }
              }
              
              if (!playoffs.lower?.final && playoffs.lower?.round2?.length === 2) {
                  const lbR2Winners = playoffs.lower.round2.map(id => playoffs.matches[id]?.winner).filter(Boolean);
                  if (lbR2Winners.length === 2) {
                      const lbFinalId = 'M-TOKYO-PLAYOFF-LB-FINAL';
                      playoffs.matches[lbFinalId] = {
                          team1: lbR2Winners[0], team2: lbR2Winners[1],
                          winner: null, loser: null, score: null, playerStats: null,
                          bracket: 'lower', round: 'final'
                      };
                      playoffs.lower.final = lbFinalId;
                      console.log(`Week 32: Created LB Final: ${lbR2Winners[0]} vs ${lbR2Winners[1]}`);
                  }
              }
              
              // Force create Grand Final if both finals have winners
              if (!playoffs.grandFinal) {
                  const ubFinalWinner = playoffs.upper?.final && playoffs.matches[playoffs.upper.final]?.winner;
                  const lbFinalWinner = playoffs.lower?.final && playoffs.matches[playoffs.lower.final]?.winner;
                  
                  if (ubFinalWinner && lbFinalWinner) {
                      const gfMatchId = 'M-TOKYO-PLAYOFF-GF';
                      playoffs.matches[gfMatchId] = {
                          team1: ubFinalWinner, team2: lbFinalWinner,
                          winner: null, loser: null, score: null, playerStats: null,
                          bracket: 'grand', round: 'final', note: 'Week 32 - Grand Final'
                      };
                      playoffs.grandFinal = gfMatchId;
                      console.log(`Week 32: Created Grand Final: ${ubFinalWinner} vs ${lbFinalWinner}`);
                  }
              }
          }
          
          // Get Grand Final matchup
          let gfMatchup = 'TBD vs TBD';
          if (playoffs?.grandFinal) {
              const gf = playoffs.matches[playoffs.grandFinal];
              if (gf) {
                  gfMatchup = `${gf.team1} vs ${gf.team2}`;
              }
          }
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🏆 League Operations",
              subject: "Masters Tokyo - GRAND FINAL!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 40px; margin-bottom: 8px; display: block;">🏆</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 28px; font-weight: 700;">GRAND FINAL!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">The ultimate showdown for the title!</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 16px;">
                    <div style="color: #FFD700; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Grand Final Matchup</div>
                    <div style="color: #fff; font-size: 20px; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${gfMatchup}</div>
                  </div>
                  <p style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #FFD700;">Masters Tokyo Grand Final</strong> is here!<br>
                    Complete the final match this week to crown the champion!
                  </p>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #FFD700; font-size: 14px; font-weight: 600;">⚠️ FINAL WEEK: Winner crowned next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }
      
      // MASTERS TOKYO FLOW: Week 33 - FINAL DEADLINE
      if (nextWeek === 33 && mastersTokyoState && !mastersTokyoState.complete) {
          // Auto-complete any remaining matches if needed
          console.log("Week 33: Tournament deadline reached - forcing completion check");
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "⚠️ League Operations",
              subject: "URGENT: Masters Tokyo Must Complete!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #ff6b6b;">
                  <span style="font-size: 40px; margin-bottom: 8px; display: block;">⚠️</span>
                  <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700;">FINAL DEADLINE!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Masters Tokyo must conclude this week</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    <strong style="color: #ff6b6b;">Week 33 is the final deadline!</strong><br>
                    Complete all remaining Masters Tokyo matches immediately.<br>
                    Champions 2025 begins next week!
                  </p>
                  <div style="background: linear-gradient(90deg, rgba(255,107,107,0.2) 0%, rgba(245,101,101,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center; border: 1px solid rgba(255,107,107,0.4);">
                    <span style="color: #ff6b6b; font-size: 14px; font-weight: 700;">🚨 FINAL CHANCE: Play all matches NOW!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // MASTERS TOKYO FLOW: Week 32 - Announce Winner
      if (nextWeek === 32) {
          let winnerName = "TBD";
          if (aiUpdatedSave.mastersTokyoState?.playoffs?.grandFinal) {
              const gfMatchId = aiUpdatedSave.mastersTokyoState.playoffs.grandFinal;
              const gf = aiUpdatedSave.mastersTokyoState.playoffs.matches[gfMatchId];
              if (gf?.winner) {
                  winnerName = gf.winner;
              }
          }

          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🏆 League News",
              subject: "Masters Tokyo Champion Crowned!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🗾</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Masters Tokyo Concludes</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">A new international champion has been crowned</p>
                </div>
                <div style="background: #0f1419; padding: 24px;">
                  <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">🏆</div>
                    <div style="color: #FFD700; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Masters Tokyo Champion</div>
                    <div style="color: #fff; font-size: 22px; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${winnerName}</div>
                  </div>
                  <p style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    Congratulations to <strong style="color: #f6e05e;">${winnerName}</strong> for conquering the international stage!
                  </p>
                  <div style="background: linear-gradient(90deg, rgba(245,101,101,0.2) 0%, rgba(246,224,94,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🎯 Champions qualification is now underway</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League News</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // CHAMPIONS FLOW: Week 31 - Announce qualified teams and prep (after Masters Tokyo)
      // NEW: 16-team format - Top 4 from each region qualify
      if (nextWeek === 31) {
          // Calculate Champions points standings by region
          // Pass teams data for region lookup and regular season standings for fill-in
          const qualifiedByRegion = getChampions16Qualifiers(
              aiUpdatedSave.championshipPoints, 
              updatedPlayers,
              teams,
              aiUpdatedSave.regularSeasonStandings
          );
          const flatQualifiedTeams = getFlatQualifiedList(qualifiedByRegion);
          const teamsHtml = createQualifiedTeamsHTML(qualifiedByRegion);
          
          // Store qualified teams (16 teams: 4 per region)
          aiUpdatedSave.championsQualified = flatQualifiedTeams.map(t => t.name);
          aiUpdatedSave.championsQualifiedByRegion = qualifiedByRegion;
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "👑 League Operations",
              subject: "Champions 2025 - 16 Teams Qualified!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #1a3a2f 0%, #0d2618 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">👑</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Champions 2025</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">16 Teams • 4 Groups • 1 Champion</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🏆 Top 4 from each region qualified (16 teams total)</span>
                  </div>
                  <div style="margin-bottom: 20px;">
                    ${teamsHtml}
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(72,187,120,0.15) 0%, rgba(26,35,50,0.3) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #68d391; font-size: 13px; font-weight: 600;">📅 Week 32-35: Preparation Phase</span>
                    <span style="color: #8b9dc3; font-size: 12px; margin: 0 8px;">|</span>
                    <span style="color: #f6e05e; font-size: 13px; font-weight: 600;">📅 Week 36: Group Stage Begins</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // BREAK WEEK: Week 33 - Rest after Masters Tokyo
      if (nextWeek === 33) {
          // Check if Masters Tokyo is complete
          const isTokyoComplete = mastersTokyoState?.complete;
          const hasGrandFinal = mastersTokyoState?.playoffs?.grandFinal;
          const grandFinalMatch = hasGrandFinal ? mastersTokyoState.playoffs.matches[hasGrandFinal] : null;
          const hasChampion = grandFinalMatch?.winner;
          
          if (!isTokyoComplete || !hasChampion) {
              // URGENT: Tournament should be complete by Week 33 but isn't
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "⚠️ League Operations",
                  subject: "URGENT: Masters Tokyo Matches Incomplete!",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                    <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #ff6b6b;">
                      <span style="font-size: 32px; margin-bottom: 8px; display: block;">⚠️</span>
                      <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700;">Tournament Incomplete!</h2>
                      <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Masters Tokyo matches must be completed</p>
                    </div>
                    <div style="background: #0f1419; padding: 20px;">
                      <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                        <strong style="color: #ff6b6b;">Week 33 has arrived</strong> but Masters Tokyo is not complete!<br>
                        Please finish all remaining playoff matches immediately.
                      </p>
                      <div style="background: linear-gradient(90deg, rgba(255,107,107,0.2) 0%, rgba(245,101,101,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center; border: 1px solid rgba(255,107,107,0.4);">
                        <span style="color: #ff6b6b; font-size: 14px; font-weight: 600;">⚠️ Play all remaining matches before proceeding to Champions!</span>
                      </div>
                    </div>
                    <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                      <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                    </div>
                  </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          } else {
              // Normal break week message
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "🌴 League Operations",
                  subject: "Break Week - Rest Before Champions",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                    <div style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #68d391;">
                      <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌴</span>
                      <h2 style="color: #68d391; margin: 0; font-size: 24px; font-weight: 700;">Break Week</h2>
                      <p style="color: #9ae6b4; margin: 8px 0 0 0; font-size: 14px;">Rest before the ultimate challenge</p>
                    </div>
                    <div style="background: #0f1419; padding: 20px;">
                      <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                        Congratulations to <strong style="color: #FFD700;">${grandFinalMatch.winner}</strong> for winning Masters Tokyo!<br>
                        Teams rest and strategize before Champions begins.
                      </p>
                      <div style="background: linear-gradient(90deg, rgba(104,211,145,0.2) 0%, rgba(72,187,120,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                        <span style="color: #68d391; font-size: 14px; font-weight: 600;">📅 Week 34-35: Champions Prep</span>
                      </div>
                    </div>
                    <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                      <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                    </div>
                  </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          }
      }

      // CHAMPIONS FLOW: Week 34-35 - Champions Prep (after Masters Tokyo)
      if (nextWeek === 34 || nextWeek === 35) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "👑 League Operations",
              subject: "Champions 2025 - Preparation",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">👑</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700;">Champions Prep</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">The pinnacle event approaches</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    Top 4 teams by <strong style="color: #FFD700;">Championship Points</strong> from each region prepare for the ultimate title.
                  </p>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(245,101,101,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <div style="color: #f6e05e; font-size: 24px; font-weight: 800; margin-bottom: 4px;">${36 - nextWeek} WEEKS</div>
                    <div style="color: #FFD700; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Until Champions 2025</div>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // CHAMPIONS FLOW: Week 36 - Initialize Champions (16-team Group Stage)
      let championsState = activeSave.championsState ? JSON.parse(JSON.stringify(activeSave.championsState)) : null;
      
      if (nextWeek === 36) {
          const qualifiedTeams = aiUpdatedSave.championsQualified || [];
          
          if (qualifiedTeams.length >= 16) {
              console.log("Initializing Champions 2025 with 16 teams:", qualifiedTeams);
              
              // Use the 16-team automation to generate groups and matches
              championsState = automate16TeamChampions(
                  qualifiedTeams.map(t => ({ name: t })),
                  updatedPlayers,
                  simulateAiMatch,
                  null, // fresh state
                  activeSave.team,
                  'CHAMP-',
                  36
              );
              
              // Save the generated state
              aiUpdatedSave.championsState = championsState;
              
              console.log("Champions groups generated:", championsState.groups);
              
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "👑 League News",
                  subject: "Champions 2025 - Group Stage Begins!",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                    <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                      <span style="font-size: 32px; margin-bottom: 8px; display: block;">👑</span>
                      <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Champions 2025</h2>
                      <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">16 Teams • 4 Groups • 1 Champion</p>
                    </div>
                    <div style="background: #0f1419; padding: 24px;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                          The <strong style="color: #FFD700;">most prestigious tournament</strong> of the year has begun!<br>
                          16 teams divided into 4 groups. Top 2 from each group advance!
                        </p>
                      </div>
                      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                          <div style="color: #FFD700; font-size: 20px; font-weight: 800; margin-bottom: 4px;">4</div>
                          <div style="color: #faf089; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Groups</div>
                          <div style="color: #8b9dc3; font-size: 9px; margin-top: 2px;">A • B • C • D</div>
                        </div>
                        <div style="background: linear-gradient(135deg, rgba(72,187,120,0.2) 0%, rgba(26,35,50,0.3) 100%); border: 1px solid rgba(72,187,120,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                          <div style="color: #48bb78; font-size: 20px; font-weight: 800; margin-bottom: 4px;">8</div>
                          <div style="color: #9ae6b4; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Teams Advance</div>
                          <div style="color: #8b9dc3; font-size: 9px; margin-top: 2px;">Top 2 per group</div>
                        </div>
                      </div>
                      <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 10px; padding: 14px; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                          <span style="font-size: 18px;">📅</span>
                          <span style="color: #f6e05e; font-size: 13px; font-weight: 600;">Week 36-38: Group Stage • Week 39-41: Playoffs</span>
                        </div>
                      </div>
                    </div>
                    <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                      <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League News</span>
                    </div>
                  </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          }
      }

      // CHAMPIONS FLOW: Week 35 - Swiss Stage Final Rounds
      if (nextWeek === 35 && championsState && !championsState.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "👑 League Operations",
              subject: "Champions 2025 - Swiss Stage Final Rounds",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #2d1b4e 0%, #1a0f2e 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #9f7aea;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">👑</span>
                  <h2 style="color: #b794f4; margin: 0; font-size: 22px; font-weight: 700;">Swiss Stage - Final Rounds</h2>
                  <p style="color: #e9d8fd; margin: 8px 0 0 0; font-size: 14px;">Qualification and Elimination matches</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #b794f4;">Swiss Stage</strong> enters its final phase.<br>
                    Teams with 2 wins fight for qualification. Teams with 2 losses face elimination.
                  </p>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(154,230,180,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(154,230,180,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">✅</div>
                      <div style="color: #9ae6b4; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Qualification</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">2-1 Records</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(245,101,101,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">❌</div>
                      <div style="color: #fc8181; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Elimination</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">1-2 Records</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(159,122,234,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🏆 Regional Playoffs begin next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // CHAMPIONS FLOW: Week 36 - Group Stage continues (only for old 8-team format)
      if (nextWeek === 36 && championsState && !championsState.complete && !championsState.groups) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "👑 League Operations",
              subject: "Champions 2025 - Playoffs Begin!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🏆</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700;">Playoffs Begin!</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Double Elimination Bracket - Quarterfinals</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #FFD700;">Champions 2025 Playoffs</strong> are here!<br>
                    4 High Seeds from Swiss + 4 Qualified teams battle for the title.
                  </p>
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">🔝</div>
                      <div style="color: #FFD700; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Upper Bracket</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">High Seeds</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(159,122,234,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(159,122,234,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">⬇️</div>
                      <div style="color: #9f7aea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Lower Bracket</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">Swiss Qualifiers</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(236,201,75,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">⚔️ Quarterfinals determine who advances!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // CHAMPIONS FLOW: Week 37 - Semifinals (only for old 8-team format)
      if (nextWeek === 37 && championsState && !championsState.complete && !championsState.groups) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🔥 League Operations",
              subject: "Champions 2025 - Semifinals & Lower Bracket",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #742a2a 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #ff6b6b;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🔥</span>
                  <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700;">Semifinals & Lower Bracket</h2>
                  <p style="color: #feb2b2; margin: 8px 0 0 0; font-size: 14px;">The bracket intensifies!</p>
                </div>
                <div style="background: #0f1419; padding: 20px;">
                  <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                    The <strong style="color: #ff6b6b;">Champions 2025</strong> bracket is heating up!<br>
                    Semifinals and Lower Bracket matches determine Grand Finalists.
                  </p>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(255,107,107,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">⚔️</div>
                      <div style="color: #ff6b6b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Semifinals</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">Upper Bracket SF</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(245,101,101,0.3); border-radius: 10px; padding: 14px; text-align: center;">
                      <div style="font-size: 20px; margin-bottom: 6px;">🔄</div>
                      <div style="color: #fc8181; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Lower Bracket</div>
                      <div style="color: #fff; font-size: 13px; margin-top: 4px;">Elimination Matches</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(255,107,107,0.2) 0%, rgba(255,69,0,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #ff9e9e; font-size: 14px; font-weight: 600;">🏆 Grand Final is approaching!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // CHAMPIONS FLOW: Week 36+ - Handle tournament progression (OLD 8-TEAM FORMAT ONLY)
      // Skip if using new 16-team format (detected by presence of 'groups' property)
      if (nextWeek >= 36 && nextWeek <= 41 && championsState && !championsState.complete && !championsState.groups) {
          // Check completion status
          let allMatchesFinished = true;
          let stage = "unknown";
          
          if (championsState.playoffs && championsState.playoffs.grandFinal) {
              stage = "Grand Final";
              const gfData = championsState.playoffs.matches[championsState.playoffs.grandFinal];
              if (gfData && gfData.winner) {
                  allMatchesFinished = true;
                  championsState.complete = true;
              } else {
                  allMatchesFinished = false;
              }
          } else if (championsState.playoffs && championsState.playoffs.semifinals?.length > 0) {
              stage = "Semifinals";
              allMatchesFinished = championsState.playoffs.semifinals.every(id => {
                  const matchData = championsState.playoffs.matches[id];
                  return matchData && matchData.winner !== null && typeof matchData.winner !== 'undefined';
              });
          } else if (championsState.swiss && championsState.swiss.rounds?.length > 0) {
              stage = "Swiss";
              const latestRound = championsState.swiss.rounds[championsState.swiss.rounds.length - 1];
              if (latestRound && latestRound.matches) {
                  allMatchesFinished = latestRound.matches.every(m => {
                      const matchId = typeof m === 'string' ? m : (m.id || m);
                      const matchData = championsState.swiss.matches[matchId];
                      return matchData && matchData.winner !== null && typeof matchData.winner !== 'undefined';
                  });
              }
          }
          
          if (!allMatchesFinished && nextWeek > 28) {
              console.warn(`Champions ${stage} not finished yet!`);
              alert(`You must complete all matches in the current Champions round (${stage}) before simulating to the next week!`);
              setIsSimulating(false);
              return;
          }
          
          // Automate tournament progression (only for old 8-team format)
          // Skip if using new 16-team group stage format (detected by presence of 'groups' property)
          if (!championsState.complete && !championsState.groups) {
              const flatQualifiedTeams = aiUpdatedSave.championsQualified || [];
              if (flatQualifiedTeams.length >= 4 && flatQualifiedTeams.length < 16) {
                  const oldState = JSON.stringify(championsState);
                  
                  championsState = automateMastersTournament(flatQualifiedTeams, updatedPlayers, simulateAiMatch, championsState, activeSave.team);
                  
                  aiUpdatedSave.championsState = championsState;
                  
                  // Check for winner and award points
                  const gfMatch = championsState.playoffs.matches['M-PLAYOFF-GF'];
                  const oldGfMatch = JSON.parse(oldState).playoffs?.matches?.['M-PLAYOFF-GF'];
                  
                  if (gfMatch && gfMatch.winner && (!oldGfMatch || !oldGfMatch.winner)) {
                      const winnerName = gfMatch.winner;
                      if (!aiUpdatedSave.championshipPoints) aiUpdatedSave.championshipPoints = {};
                      aiUpdatedSave.championshipPoints[winnerName] = (aiUpdatedSave.championshipPoints[winnerName] || 0) + 5; // +5 for winning Champions
                      console.log(`CP: ${winnerName} gets +5 points for winning Champions 2025.`);
                      championsState.complete = true;
                      
                      // Award Champions MVP
                      awardMastersMVP(championsState, updatedPlayers, activeSave.season || 1);
                  }
              }
          }
      }
      
      // NEW: 16-team Group Stage automation (Weeks 36-41) - OUTSIDE the old 8-team block!
      // Reload fresh championsState from localStorage to include manually simulated match results
      const freshSave = loadCareer();
      // Try freshSave first, then aiUpdatedSave (which might have updated state), then fall back to championsState prop
      let freshChampionsState = freshSave?.championsState || aiUpdatedSave?.championsState || championsState;
      
      // DEBUG: Check if we successfully loaded fresh data
      console.log('DEBUG - freshSave loaded:', freshSave ? 'YES' : 'NO');
      console.log('DEBUG - freshSave.championsState:', freshSave?.championsState ? 'EXISTS' : 'MISSING');
      console.log('DEBUG - aiUpdatedSave.championsState:', aiUpdatedSave?.championsState ? 'EXISTS' : 'MISSING');
      console.log('DEBUG - freshChampionsState.groupMatches count:', Object.keys(freshChampionsState?.groupMatches || {}).length);
      
      // WARN if falling back to potentially stale data
      if (!freshSave?.championsState) {
          if (aiUpdatedSave?.championsState) {
              console.warn('WARN - Using aiUpdatedSave.championsState (local state) instead of fresh from storage');
          } else if (championsState) {
              console.warn('WARN - Falling back to stale championsState prop! Week 37 results may be lost.');
          }
      }
      
      // Log specific Week 37 match status to verify persistence
      if (freshChampionsState?.groupMatches) {
          const wbfMatch = freshChampionsState.groupMatches['CHAMP-GROUP-A-WBF'];
          const lb1Match = freshChampionsState.groupMatches['CHAMP-GROUP-A-LB1'];
          console.log('DEBUG - Week 37 WBF match:', wbfMatch ? { completed: wbfMatch.completed, winner: wbfMatch.winner, team1: wbfMatch.team1, team2: wbfMatch.team2 } : 'NOT FOUND');
          console.log('DEBUG - Week 37 LB1 match:', lb1Match ? { completed: lb1Match.completed, winner: lb1Match.winner, team1: lb1Match.team1, team2: lb1Match.team2 } : 'NOT FOUND');
      }
      
      if (freshChampionsState && freshChampionsState.groups && !freshChampionsState.complete && nextWeek >= 36 && nextWeek <= 41) {
          console.log('Running 16-team Champions automation for Week', nextWeek);
          console.log('Using fresh championsState with', Object.keys(freshChampionsState.groupMatches || {}).length, 'matches');
          
          // Build qualified teams list from groups
          const qualifiedTeams = [];
          Object.values(freshChampionsState.groups).forEach(groupTeams => {
              groupTeams.forEach(team => qualifiedTeams.push({ name: team }));
          });
          
          const updatedChampionsState = automate16TeamChampions(
              qualifiedTeams,
              aiUpdatedSave.players || [],
              null, // No auto-sim for week progression - use SIM buttons or SIMULATE WEEK
              freshChampionsState,
              activeSave?.team,
              'CHAMP-',
              nextWeek
          );
          freshChampionsState = updatedChampionsState;
          
          // DEBUG: Verify Week 37 results are still present after automation
          console.log('DEBUG - After automation:');
          if (freshChampionsState?.groupMatches) {
              const wbfMatchAfter = freshChampionsState.groupMatches['CHAMP-GROUP-A-WBF'];
              const lb1MatchAfter = freshChampionsState.groupMatches['CHAMP-GROUP-A-LB1'];
              console.log('DEBUG - Week 37 WBF after automation:', wbfMatchAfter ? { completed: wbfMatchAfter.completed, winner: wbfMatchAfter.winner } : 'NOT FOUND');
              console.log('DEBUG - Week 37 LB1 after automation:', lb1MatchAfter ? { completed: lb1MatchAfter.completed, winner: lb1MatchAfter.winner } : 'NOT FOUND');
          }
          
          aiUpdatedSave.championsState = freshChampionsState;
      }

      // CHAMPIONS FLOW: Week 38 or 41 - Announce Winner and End Season (after tournament)
      // Week 38 for 8-team format, Week 41 for 16-team format
      if (nextWeek === 38 || nextWeek === 41) {
          let winnerName = "TBD";
          if (aiUpdatedSave.championsState?.playoffs?.grandFinal) {
              const gf = aiUpdatedSave.championsState.playoffs.matches[aiUpdatedSave.championsState.playoffs.grandFinal];
              if (gf?.winner) {
                  winnerName = gf.winner;
              }
          }
          
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "League News",
              subject: "Champions 2025 Champion Crowned!",
              body: `The ultimate tournament has concluded! Congratulations to <b>${winnerName}</b> for winning Champions 2025 and becoming the World Champion! This marks the end of Season ${activeSave.season || 1}. A new season will begin soon.`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

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
            const completedState = automateKickoffTournament(regionState, updatedPlayers, simulateAiMatch, activeSave.season || 1);
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
      } else if (nextWeek > 7 && nextWeek <= 12) {
        // Handle Masters Bangkok progression (only during weeks 8-11, and week 12 is break week cleanup)
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
            
            mastersResults = automate8TeamMasters(flatQualifiedTeams, updatedPlayers, simulateAiMatch, mastersResults, activeSave.team, 'M-', nextWeek);
            
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
                     
                     // Award Masters MVP
                     awardMastersMVP(mastersResults, updatedPlayers, activeSave.season || 1);
                }
            }
          }
        }
      }

      // Week 13: Break Week after Masters Bangkok
      if (nextWeek === 13) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "☕ League Operations",
              subject: "Break Week - Masters Bangkok Concluded",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #2d3748 0%, #1a2332 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #4fd1c5;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">☕</span>
                  <h2 style="color: #4fd1c5; margin: 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Break Week</h2>
                  <p style="color: #9ae6b4; margin: 8px 0 0 0; font-size: 14px;">Teams are recharging before the Regular Season</p>
                </div>
                <div style="background: #0f1419; padding: 24px;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                      The first <strong style="color: #4fd1c5;">international event</strong> has concluded and teams are taking a well-deserved break.
                    </p>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(79,209,197,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">😴</div>
                      <div style="color: #4fd1c5; font-size: 11px; font-weight: 700; text-transform: uppercase;">Rest</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(154,230,180,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🧘</div>
                      <div style="color: #9ae6b4; font-size: 11px; font-weight: 700; text-transform: uppercase;">Recover</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(184,241,201,0.1) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🎯</div>
                      <div style="color: #b8f1c9; font-size: 11px; font-weight: 700; text-transform: uppercase;">Prepare</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(72,187,120,0.2) 0%, rgba(79,209,197,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                    <div style="color: #68d391; font-size: 28px; font-weight: 800; margin-bottom: 4px;">1 WEEK</div>
                    <div style="color: #4fd1c5; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Until Regular Season Begins</div>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // Week 10 Inbox Message - Masters Bangkok Playoffs Continue (extended)
      if (nextWeek === 10 && mastersResults && !mastersResults.complete) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "🌏 League Operations",
              subject: "Masters Bangkok - Playoffs Continue!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌏</span>
                  <h2 style="color: #FFD700; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Playoffs Continue</h2>
                  <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">Semifinals & Lower Bracket</p>
                </div>
                <div style="background: #0f1419; padding: 24px;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                      The <strong style="color: #FFD700;">Masters Bangkok</strong> bracket intensifies!<br>
                      Semifinals and Lower Bracket matches determine Grand Finalists.
                    </p>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">⚔️</div>
                      <div style="color: #FFD700; font-size: 11px; font-weight: 700; text-transform: uppercase;">Semifinals</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(246,224,94,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(246,224,94,0.2); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🔄</div>
                      <div style="color: #f6e05e; font-size: 11px; font-weight: 700; text-transform: uppercase;">Lower Bracket</div>
                    </div>
                  </div>
                  <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 10px; padding: 14px; text-align: center;">
                    <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">🏆 Grand Final next week!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
      }

      // Week 11 Inbox Message - Masters Bangkok Grand Final Week or Champion Crowned
      if (nextWeek === 11) {
          const ms = mastersResults || aiUpdatedSave.mastersState;
          const grandFinal = ms?.playoffs?.matches?.[ms?.playoffs?.grandFinal];
          const hasWinner = grandFinal && grandFinal.winner;
          
          if (hasWinner) {
              // Grand Final completed - announce champion
              const winnerName = grandFinal.winner;
              const winnerLogo = teamLogos[winnerName] || "assets/team_logos/default.png";
              
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "🏆 League News",
                  subject: "Masters Bangkok Champion Crowned!",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                    <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #FFD700;">
                      <span style="font-size: 32px; margin-bottom: 8px; display: block;">🌏</span>
                      <h2 style="color: #FFD700; margin: 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Masters Bangkok Concludes</h2>
                      <p style="color: #faf089; margin: 8px 0 0 0; font-size: 14px;">A new international champion has been crowned</p>
                    </div>
                    <div style="background: #0f1419; padding: 24px;">
                      <div style="background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(26,35,50,0.3) 100%); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 40px; margin-bottom: 12px;">🏆</div>
                        <div style="color: #FFD700; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Masters Bangkok Champion</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                          <img src="${winnerLogo}" alt="${winnerName}" style="width: 40px; height: 40px; object-fit: contain;">
                          <span style="color: #fff; font-size: 22px; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${winnerName}</span>
                        </div>
                      </div>
                      <p style="color: #e2e8f0; margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                        Congratulations to <strong style="color: #f6e05e;">${winnerName}</strong> for winning the first international event of the year!
                      </p>
                      <div style="background: linear-gradient(90deg, rgba(79,209,197,0.2) 0%, rgba(79,209,197,0.1) 100%); border-radius: 10px; padding: 14px; text-align: center; margin-bottom: 12px;">
                        <span style="color: #4fd1c5; font-size: 14px; font-weight: 600;">☕ Next week is a break week</span>
                      </div>
                      <div style="background: linear-gradient(90deg, rgba(72,187,120,0.2) 0%, rgba(79,209,197,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                        <span style="color: #68d391; font-size: 14px; font-weight: 600;">📅 Regular Season begins after break</span>
                      </div>
                    </div>
                    <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                      <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League News</span>
                    </div>
                  </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          } else {
              // Grand Final week - prompt to complete the match
              newInboxMessages.push({
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  sender: "🏆 League Operations",
                  subject: "Masters Bangkok - Grand Final Week!",
                  body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                    <div style="background: linear-gradient(135deg, #744210 0%, #553c15 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #ff6b6b;">
                      <span style="font-size: 32px; margin-bottom: 8px; display: block;">🔥</span>
                      <h2 style="color: #ff6b6b; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Grand Final Week</h2>
                      <p style="color: #feb2b2; margin: 8px 0 0 0; font-size: 14px;">The final showdown for the Masters Bangkok title</p>
                    </div>
                    <div style="background: #0f1419; padding: 24px;">
                      <p style="color: #e2e8f0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; text-align: center;">
                        The tournament reaches its climax! The <strong style="color: #ff6b6b;">Grand Final</strong> match is ready.<br>
                        Complete the final match to crown the Masters Bangkok champion.
                      </p>
                      <div style="background: linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(26,35,50,0.2) 100%); border: 2px solid rgba(255,107,107,0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 36px; margin-bottom: 8px;">🏆</div>
                        <div style="color: #ff6b6b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Final Match Available</div>
                        <div style="color: #feb2b2; font-size: 12px;">Navigate to the tournament bracket</div>
                      </div>
                      <div style="background: linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(246,224,94,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
                        <span style="color: #f6e05e; font-size: 14px; font-weight: 600;">⚔️ Play the Grand Final to complete the tournament!</span>
                      </div>
                    </div>
                    <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                      <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                    </div>
                  </div>`,
                  date: new Date().toLocaleDateString(),
                  read: false,
                  contentType: 'html'
              });
          }
      }

      // Week 13 - Regular Season Begins
      if (nextWeek === 13) {
          newInboxMessages.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              sender: "📅 League Operations",
              subject: "Regular Season - The Grind Begins!",
              body: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #1a3a2f 0%, #0d2618 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #48bb78;">
                  <span style="font-size: 32px; margin-bottom: 8px; display: block;">📅</span>
                  <h2 style="color: #68d391; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Regular Season Begins</h2>
                  <p style="color: #9ae6b4; margin: 8px 0 0 0; font-size: 14px;">The road to Champions starts here</p>
                </div>
                <div style="background: #0f1419; padding: 24px;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6;">
                      The <strong style="color: #68d391;">Regular Season</strong> is underway!<br>
                      Teams compete in regional groups to earn Championship Points.
                    </p>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, rgba(72,187,120,0.15) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🌎</div>
                      <div style="color: #68d391; font-size: 11px; font-weight: 700; text-transform: uppercase;">4 Regions</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(154,230,180,0.15) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">⚔️</div>
                      <div style="color: #9ae6b4; font-size: 11px; font-weight: 700; text-transform: uppercase;">Group Stage</div>
                    </div>
                    <div style="background: linear-gradient(135deg, rgba(184,241,201,0.15) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🏆</div>
                      <div style="color: #b8f1c9; font-size: 11px; font-weight: 700; text-transform: uppercase;">Playoffs</div>
                    </div>
                  </div>
                  <div style="background: linear-gradient(90deg, rgba(72,187,120,0.2) 0%, rgba(79,209,197,0.2) 100%); border-radius: 10px; padding: 16px; text-align: center;">
                    <span style="color: #68d391; font-size: 14px; font-weight: 600;">📊 Check the Regional Groups tab to view matches!</span>
                  </div>
                </div>
                <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                  <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">League Operations</span>
                </div>
              </div>`,
              date: new Date().toLocaleDateString(),
              read: false,
              contentType: 'html'
          });
          
          if (!aiUpdatedSave.regularSeason) {
              console.log("Initializing Regular Season state...");
              aiUpdatedSave.regularSeason = initializeRegularSeason(aiUpdatedSave);
          } else {
              // Clear any existing playoffs data from previous season
              if (aiUpdatedSave.regularSeason.playoffs) {
                  console.log("New season: Clearing old playoffs data...");
                  delete aiUpdatedSave.regularSeason.playoffs;
              }
              
              // Clear playoff matches from history
              if (aiUpdatedSave.regularSeason.matches) {
                  const beforeCount = aiUpdatedSave.regularSeason.matches.length;
                  aiUpdatedSave.regularSeason.matches = aiUpdatedSave.regularSeason.matches.filter(m => m.stage !== 'Playoffs');
                  const afterCount = aiUpdatedSave.regularSeason.matches.length;
                  console.log(`New season: Cleared ${beforeCount - afterCount} playoff matches from history`);
              }
          }
          
          // Clear kickoffState.series to reset match history for new season
          if (aiUpdatedSave.kickoffState?.series) {
              console.log("New season: Clearing old kickoffState series...");
              aiUpdatedSave.kickoffState.series = {};
          }
          
          // CRITICAL: Also clear localStorage for all regions
          console.log("New season: Clearing localStorage kickoffState for all regions...");
          regions.forEach(region => {
              clearKickoffState(region, activeSave.id);
          });
          
          // CRITICAL: Clear _playoffsBackup which is used to restore playoffs on load
          if (aiUpdatedSave._playoffsBackup) {
              console.log("New season: Clearing _playoffsBackup...");
              delete aiUpdatedSave._playoffsBackup;
          }
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
        
        // NEW: Develop Role Proficiency
        const roleDev = player.developRoles();
        if (roleDev && isPlayerTeam) {
          newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "Coaching Staff",
            subject: "Role Proficiency Mastered",
            body: `Great news! ${player.name} has spent enough time playing as a ${roleDev.learned} to fully master the role. They can now switch to this role in the future without any performance penalties.`,
            date: new Date().toLocaleDateString(),
            read: false
          });
        }
        
        // Return updated data object
        return {
          ...pData,
          rating: { ...player.rating },
          overall: player.overall,
          potential: player.potential,
          role: player.role,
          secondaryRole: player.secondaryRole,
          roleProficiencies: player.roleProficiencies,
          roleExperience: player.roleExperience
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

      // CRITICAL: Preserve any tournament state changes made during this week (user-played matches)
      // aiUpdatedSave has the most recent state since we updated it during automation
      // For Champions: aiUpdatedSave.championsState is updated at line 2128 with fresh localStorage data + automation results
      // championsState prop is stale (from render time), so aiUpdatedSave.championsState must be checked FIRST
      const currentMastersTokyoState = mastersTokyoState || aiUpdatedSave.mastersTokyoState || activeSave.mastersTokyoState;
      const currentChampionsState = aiUpdatedSave.championsState || championsState || activeSave.championsState;
      
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
        mastersTokyoState: currentMastersTokyoState,
        championsState: currentChampionsState,
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
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() - ((activeSave.week || 1) * 7));
      const formattedDate = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      let messageContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 3px solid #ff4655;">
            <div style="display: inline-flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="font-size: 24px;">📊</span>
              <h2 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">WEEK ${nextWeek} REPORT</h2>
            </div>
            <div style="color: #8b9dc3; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
              Season ${nextSeason} • ${formattedDate}
            </div>
          </div>
          
          <!-- Content Container -->
          <div style="background: #0f1419; padding: 20px; border-radius: 0 0 12px 12px;">
      `;
      
      if (simulatedMatches.length > 0) {
        messageContent += `
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">⚔️</span>
              <h3 style="color: #fff; margin: 0; font-size: 16px; font-weight: 600;">Match Results</h3>
              <span style="background: rgba(255, 70, 85, 0.2); color: #ff4655; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto;">${simulatedMatches.length} Matches</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        simulatedMatches.forEach(m => {
          const winnerLogo = teamLogos[m.winner] || 'assets/team_logos/default.png';
          const loserLogo = teamLogos[m.loser] || 'assets/team_logos/default.png';
          // Format score as winnerScore-loserScore
          const scoreParts = m.score.split('-').map(Number);
          let displayScore = m.score;
          if (scoreParts.length === 2) {
            const isTeam1Winner = m.winner === m.t1Name;
            if (isTeam1Winner) {
              displayScore = `${scoreParts[0]}-${scoreParts[1]}`;
            } else {
              displayScore = `${scoreParts[1]}-${scoreParts[0]}`;
            }
          }
          messageContent += `
            <div style="background: linear-gradient(90deg, rgba(255,70,85,0.1) 0%, rgba(13,27,42,0.5) 100%); border: 1px solid rgba(255,70,85,0.2); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <img src="${winnerLogo}" style="width: 28px; height: 28px; object-fit: contain;" alt="${m.winner}" />
                <span style="color: #fff; font-weight: 600; font-size: 14px;">${m.winner}</span>
                <span style="background: #ff4655; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">W</span>
              </div>
              <div style="background: rgba(0,0,0,0.4); padding: 4px 12px; border-radius: 6px; font-family: monospace;">
                <span style="color: #ff4655; font-weight: 700; font-size: 14px;">${displayScore}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end;">
                <span style="background: rgba(139,157,195,0.2); color: #8b9dc3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">L</span>
                <span style="color: #8b9dc3; font-weight: 500; font-size: 14px;">${m.loser}</span>
                <img src="${loserLogo}" style="width: 28px; height: 28px; object-fit: contain; opacity: 0.7;" alt="${m.loser}" />
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
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">📰</span>
              <h3 style="color: #fff; margin: 0; font-size: 16px; font-weight: 600;">League News & Roster Changes</h3>
              <span style="background: rgba(246, 224, 94, 0.2); color: #f6e05e; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto;">${rosterChanges.length} Updates</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        rosterChanges.forEach(change => {
          messageContent += `
            <div style="background: linear-gradient(90deg, rgba(246,224,94,0.08) 0%, rgba(13,27,42,0.3) 100%); border-left: 3px solid #f6e05e; border-radius: 0 8px 8px 0; padding: 10px 12px;">
              <span style="color: #e2e8f0; font-size: 13px; line-height: 1.5;">${change}</span>
            </div>
          `;
        });
        messageContent += `
            </div>
          </div>
        `;
      } else if (!isMastersPrep) {
        messageContent += `
          <div style="margin-bottom: 20px; background: linear-gradient(135deg, rgba(45,55,72,0.4) 0%, rgba(26,35,50,0.2) 100%); border-radius: 10px; padding: 14px; text-align: center;">
            <span style="color: #8b9dc3; font-size: 13px;">📭 It was a quiet week in the league with no major roster moves.</span>
          </div>
        `;
      }

      // === ENHANCED: League Standings Update ===
      if (activeSave.regularSeason && activeSave.regularSeason.standings) {
        const userRegion = activeSave.region || 'Americas';
        const regionStandings = activeSave.regularSeason.standings[userRegion];
        if (regionStandings && regionStandings.length > 0) {
          const sorted = [...regionStandings].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
          const top3 = sorted.slice(0, 3);
          const bottom3 = sorted.slice(-3).reverse();
          
          const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
          
          messageContent += `
            <div style="margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 18px;">📈</span>
                <h3 style="color: #fff; margin: 0; font-size: 16px; font-weight: 600;">${userRegion} Standings Update</h3>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <!-- Top 3 -->
                <div style="background: linear-gradient(135deg, rgba(72,187,120,0.15) 0%, rgba(26,35,50,0.3) 100%); border-radius: 10px; padding: 12px; border: 1px solid rgba(72,187,120,0.3);">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                    <span style="font-size: 14px;">🔥</span>
                    <span style="color: #68d391; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Top Performers</span>
                  </div>
                  ${top3.map((t, i) => `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; ${i < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.05);' : ''}">
                      <span style="color: ${rankColors[i]}; font-weight: 700; font-size: 14px; width: 20px;">${i+1}</span>
                      <span style="color: #fff; font-size: 13px; font-weight: 500; flex: 1;">${t.teamName}</span>
                      <span style="color: #68d391; font-size: 12px; font-weight: 600; font-family: monospace;">${t.wins}W-${t.losses}L</span>
                    </div>
                  `).join('')}
                </div>
                <!-- Bottom 3 -->
                <div style="background: linear-gradient(135deg, rgba(245,101,101,0.15) 0%, rgba(26,35,50,0.3) 100%); border-radius: 10px; padding: 12px; border: 1px solid rgba(245,101,101,0.3);">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                    <span style="font-size: 14px;">⚠️</span>
                    <span style="color: #fc8181; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Needs Improvement</span>
                  </div>
                  ${bottom3.map((t, i) => `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; ${i < 2 ? 'border-bottom: 1px solid rgba(255,255,255,0.05);' : ''}">
                      <span style="color: #8b9dc3; font-weight: 700; font-size: 14px; width: 20px;">${sorted.length - 2 + i}</span>
                      <span style="color: #e2e8f0; font-size: 13px; font-weight: 500; flex: 1;">${t.teamName}</span>
                      <span style="color: #fc8181; font-size: 12px; font-weight: 600; font-family: monospace;">${t.wins}W-${t.losses}L</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }
      }

      // === ENHANCED: Weekly Upsets/Storylines ===
      const upsets = simulatedMatches.filter(m => {
        const t1Wins = m.t1Stats?.wins || 0;
        const t1Losses = m.t1Stats?.losses || 0;
        const t2Wins = m.t2Stats?.wins || 0;
        const t2Losses = m.t2Stats?.losses || 0;
        const t1WinPct = t1Wins + t1Losses > 0 ? t1Wins / (t1Wins + t1Losses) : 0;
        const t2WinPct = t2Wins + t2Losses > 0 ? t2Wins / (t2Wins + t2Losses) : 0;
        
        if (t1WinPct < t2WinPct && m.winner === m.t1Name) return true;
        if (t2WinPct < t1WinPct && m.winner === m.t2Name) return true;
        return false;
      });

      if (upsets.length > 0) {
        messageContent += `
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">⚡</span>
              <h3 style="color: #fff; margin: 0; font-size: 16px; font-weight: 600;">Weekly Upsets</h3>
              <span style="background: rgba(236, 201, 75, 0.2); color: #f6e05e; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto;">${upsets.length} Upsets</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
            ${upsets.slice(0, 3).map(m => {
              const winnerLogo = teamLogos[m.winner] || 'assets/team_logos/default.png';
              const loserLogo = teamLogos[m.loser] || 'assets/team_logos/default.png';
              return `
                <div style="background: linear-gradient(90deg, rgba(236,201,75,0.1) 0%, rgba(13,27,42,0.5) 100%); border: 1px solid rgba(236,201,75,0.3); border-radius: 10px; padding: 12px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <img src="${winnerLogo}" style="width: 24px; height: 24px; object-fit: contain;" alt="${m.winner}" />
                      <span style="color: #f6e05e; font-weight: 700; font-size: 13px;">${m.winner}</span>
                    </div>
                    <div style="background: rgba(236,201,75,0.2); color: #f6e05e; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;">UPSET</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #8b9dc3; font-weight: 500; font-size: 13px;">${m.loser}</span>
                      <img src="${loserLogo}" style="width: 24px; height: 24px; object-fit: contain; opacity: 0.6;" alt="${m.loser}" />
                    </div>
                  </div>
                  <div style="margin-top: 6px; color: #8b9dc3; font-size: 11px; text-align: center;">
                    Underdog victory shakes up the standings!
                  </div>
                </div>
              `;
            }).join('')}
            </div>
          </div>
        `;
      }

      if (isMastersPrep && nextWeek < 7) {
        messageContent += `
          <div style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #2d1b4e 0%, #1a0f2e 100%); border-radius: 8px; border-left: 4px solid #9f7aea; text-align: center;">
            <h4 style="color: #b794f6; margin: 0 0 10px 0; font-size: 18px;">✈️ Mid-Season Break</h4>
            <p style="margin: 0; color: #e9d8fd; font-size: 14px;">
              Teams are preparing for <strong style="color: #faf5ff;">Masters Bangkok</strong>. 
              The international tournament is approaching!
            </p>
          </div>
        `;
      }

      if (activeSave.week === 4) {
        messageContent += `
          <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">🌏</span>
              <h3 style="color: #fff; margin: 0; font-size: 16px; font-weight: 600;">Masters Bangkok Qualified Teams</h3>
              <span style="background: rgba(66, 153, 225, 0.2); color: #63b3ed; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto;">8 Teams</span>
            </div>
            <p style="margin: 0 0 12px 0; color: #8b9dc3; font-size: 13px;">
              The VCT Kickoff tournaments have concluded. These teams will compete on the international stage:
            </p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        `;
        regions.forEach(region => {
            const qualified = allQualifiedTeams[region];
            if (qualified && qualified.length > 0) {
                qualified.forEach(teamName => {
                   const logo = teamLogos[teamName] || 'assets/team_logos/default.png';
                   const regionColors = { 'Americas': '#fc8181', 'EMEA': '#9f7aea', 'Pacific': '#4fd1c5', 'China': '#f6ad55' };
                   const regionColor = regionColors[region] || '#4299e1';
                   messageContent += `
                    <div style="background: linear-gradient(135deg, rgba(66,153,225,0.1) 0%, rgba(26,35,50,0.2) 100%); border: 1px solid rgba(66,153,225,0.2); border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 10px; transition: all 0.2s;">
                        <img src="${logo}" style="width: 36px; height: 36px; object-fit: contain;" alt="${teamName}" onerror="this.src='assets/team_logos/default.png'"/>
                        <div style="flex: 1;">
                            <div style="color: ${regionColor}; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${region}</div>
                            <div style="color: #fff; font-size: 14px; font-weight: 600;">${teamName}</div>
                        </div>
                        <span style="font-size: 16px;">✈️</span>
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
      
      // Close Content Container
      messageContent += `
          </div>
          
          <!-- Footer -->
          <div style="background: #0d1b2a; padding: 12px 20px; border-radius: 0 0 12px 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
            <span style="color: #5a7090; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
              📅 Week ${nextWeek} of Season ${nextSeason} • League Office
            </span>
          </div>
        </div>
      `;

      const reportMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: "📬 League Office",
        subject: `📊 Week ${nextWeek} Report - ${upsets.length > 0 ? 'Upsets & Storylines' : 'League Update'}`,
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
      
      // Trigger save indicator
      window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Game Saved' } }));
      
      setActiveSave(updatedSave);
      
      // Force a standings update by dispatching a custom event
      // This is caught by CareerContent to refresh the regular season iframe
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("Week simulated:", nextWeek);

      // Contextual tips based on game state
      setTimeout(() => {
        const tutorialState = getTutorialState();
        
        // First match tip
        if (nextWeek === 1 && !tutorialState.dismissedTips?.includes('first-match')) {
          showContextualTip('first-match', { duration: 15000 });
        }
        
        // Kickoff tournament start
        if (nextWeek === 4 && updatedSave.kickoffState && !tutorialState.dismissedTips?.includes('kickoff-start')) {
          showContextualTip('kickoff-start', { duration: 12000 });
        }
        
        // Masters qualified - check if user team qualified
        if (nextWeek === 5 && updatedSave.mastersQualified?.includes(updatedSave.userTeam)) {
          showContextualTip('masters-qualified', { duration: 15000 });
        }
        
        // Playoffs start - check for any region
        const hasPlayoffs = regions.some(r => updatedSave.regularSeason?.playoffs?.[r]);
        if (hasPlayoffs && nextWeek >= 18 && !tutorialState.dismissedTips?.includes('playoffs-start')) {
          showContextualTip('playoffs-start', { duration: 12000 });
        }
      }, 1500);
    }, 500);
  }

  // DEBUG: Jump directly to Week 13 (start of Regular Season) for testing
  const handleDebugJumpToWeek13 = () => {
    if (!confirm('DEBUG: Jump to Week 13 and RESET all Regular Season matches? This will clear all group matches and standings.')) {
      return;
    }
    
    setIsSimulating(true);
    
    setTimeout(() => {
      const updatedSave = { ...activeSave };
      const currentWeek = updatedSave.week || 1;
      
      // Simulate all weeks from current to 13
      for (let week = currentWeek; week < 13; week++) {
        console.log(`DEBUG: Simulating week ${week}...`);
        updatedSave.week = week + 1;
      }
      
      // Ensure we're at week 13
      updatedSave.week = 13;
      
      // RESET Regular Season - reinitialize fresh
      console.log("DEBUG: Resetting Regular Season data...");
      updatedSave.regularSeason = initializeRegularSeason(updatedSave);
      
      // Clear any existing playoffs data too
      if (updatedSave.regularSeason.playoffs) {
        console.log("DEBUG: Clearing playoffs data...");
        delete updatedSave.regularSeason.playoffs;
      }
      
      // Clear playoff matches from history
      if (updatedSave.regularSeason.matches) {
        const beforeCount = updatedSave.regularSeason.matches.length;
        updatedSave.regularSeason.matches = updatedSave.regularSeason.matches.filter(m => m.stage !== 'Playoffs');
        console.log(`DEBUG: Cleared ${beforeCount - updatedSave.regularSeason.matches.length} playoff matches`);
      }
      
      // Clear kickoffState series
      if (updatedSave.kickoffState?.series) {
        console.log("DEBUG: Clearing kickoffState series...");
        updatedSave.kickoffState.series = {};
      }
      
      // Clear _playoffsBackup
      if (updatedSave._playoffsBackup) {
        console.log("DEBUG: Clearing _playoffsBackup...");
        delete updatedSave._playoffsBackup;
      }
      
      // Clear Masters Tokyo state (important for fresh tournament)
      if (updatedSave.mastersTokyoState) {
        console.log("DEBUG: Clearing old Masters Tokyo state...");
        delete updatedSave.mastersTokyoState;
      }
      
      // Clear Masters Bangkok state
      if (updatedSave.mastersState) {
        console.log("DEBUG: Clearing old Masters Bangkok state...");
        delete updatedSave.mastersState;
      }
      
      // Clear localStorage for all regions
      console.log("DEBUG: Clearing localStorage kickoffState...");
      regions.forEach(region => {
        clearKickoffState(region, activeSave.id);
      });
      
      // Save the debug state
      saveCareer(updatedSave);
      
      // Trigger save indicator
      window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Game Saved' } }));
      
      setActiveSave(updatedSave);
      
      // Trigger update
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("DEBUG: Jumped to Week 13 with fresh Regular Season");
      alert('DEBUG: Now at Week 13 with RESET Regular Season. All group matches are fresh - simulate through weeks 13-18, then test playoffs!');
    }, 500);
  };

  // DEBUG: Jump directly to Week 24 (prep week, before Tokyo starts) for testing
  const handleDebugJumpToWeek24 = () => {
    if (!confirm('DEBUG: Jump to Week 24 (Prep week before Tokyo)?')) {
      return;
    }
    
    setIsSimulating(true);
    
    setTimeout(() => {
      const updatedSave = { ...activeSave };
      const currentWeek = updatedSave.week || 1;
      
      // Simulate all weeks from current to 24
      for (let week = currentWeek; week < 24; week++) {
        console.log(`DEBUG: Simulating week ${week}...`);
        updatedSave.week = week + 1;
      }
      
      // Ensure we're at week 24
      updatedSave.week = 24;
      
      // Clear old Masters Tokyo state (fresh start)
      if (updatedSave.mastersTokyoState) {
        console.log("DEBUG: Clearing old Masters Tokyo state...");
        delete updatedSave.mastersTokyoState;
      }
      
      // Save the debug state
      saveCareer(updatedSave);
      
      // Trigger save indicator
      window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Game Saved' } }));
      
      setActiveSave(updatedSave);
      
      // Trigger update
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("DEBUG: Jumped to Week 24 (before Masters Tokyo)");
      alert('DEBUG: Now at Week 24 (Prep week before Tokyo). Simulate one more week to see qualified teams announcement, then Week 25 for the tournament!');
    }, 500);
  };

  // DEBUG: Jump directly to Week 25 (start of Masters Tokyo) for testing
  const handleDebugJumpToWeek25 = () => {
    if (!confirm('DEBUG: Jump to Week 25 (Masters Tokyo start)? This will reset any existing Tokyo data.')) {
      return;
    }
    
    setIsSimulating(true);
    
    setTimeout(() => {
      const updatedSave = { ...activeSave };
      const currentWeek = updatedSave.week || 1;
      
      // Simulate all weeks from current to 25
      for (let week = currentWeek; week < 25; week++) {
        console.log(`DEBUG: Simulating week ${week}...`);
        updatedSave.week = week + 1;
      }
      
      // Ensure we're at week 25
      updatedSave.week = 25;
      
      // Clear old Masters Tokyo state
      if (updatedSave.mastersTokyoState) {
        console.log("DEBUG: Clearing old Masters Tokyo state...");
        delete updatedSave.mastersTokyoState;
      }
      
      // Save the debug state
      saveCareer(updatedSave);
      
      // Trigger save indicator
      window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Game Saved' } }));
      
      setActiveSave(updatedSave);
      
      // Trigger update
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("DEBUG: Jumped to Week 25 (Masters Tokyo start)");
      alert('DEBUG: Now at Week 25 (Masters Tokyo start). Simulate a week to initialize the tournament!');
    }, 500);
  };

  // DEBUG: Jump directly to Week 36 (start of Champions) for testing
  const handleDebugJumpToWeek36 = () => {
    if (!confirm('DEBUG: Jump to Week 36 (Champions 2025 start)? This will reset any existing Champions data.')) {
      return;
    }
    
    setIsSimulating(true);
    
    setTimeout(() => {
      let updatedSave = { ...activeSave };
      const currentWeek = updatedSave.week || 1;
      
      // Simulate all weeks from current to 36
      for (let week = currentWeek; week < 36; week++) {
        console.log(`DEBUG: Simulating week ${week}...`);
        updatedSave.week = week + 1;
      }
      
      // Ensure we're at week 36
      updatedSave.week = 36;
      
      // Clear old Champions state
      if (updatedSave.championsState) {
        console.log("DEBUG: Clearing old Champions state...");
        delete updatedSave.championsState;
      }
      
      // Force qualify 16 teams if needed
      if (!updatedSave.championsQualified || updatedSave.championsQualified.length < 16) {
        console.log("DEBUG: Force qualifying 16 teams...");
        
        // Get all teams by region from championship points and regular season
        const qualifiedByRegion = getChampions16Qualifiers(
          updatedSave.championshipPoints,
          updatedSave.players,
          teams,
          updatedSave.regularSeasonStandings
        );
        
        const flatQualified = getFlatQualifiedList(qualifiedByRegion);
        updatedSave.championsQualified = flatQualified.map(t => t.name);
        updatedSave.championsQualifiedByRegion = qualifiedByRegion;
        
        console.log("DEBUG: Qualified teams:", updatedSave.championsQualified);
      }
      
      // Initialize Champions with 16 teams
      if (updatedSave.championsQualified.length >= 16) {
        console.log("DEBUG: Initializing Champions 2025...");
        
        const championsState = automate16TeamChampions(
          updatedSave.championsQualified.map(t => typeof t === 'string' ? { name: t } : t),
          updatedSave.players || [],
          null, // No auto-sim for debug
          null, // Fresh state
          updatedSave.team,
          'CHAMP-',
          36
        );
        
        updatedSave.championsState = championsState;
        console.log("DEBUG: Champions groups:", championsState.groups);
      }
      
      // Save the debug state
      saveCareer(updatedSave);
      
      // Trigger save indicator
      window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Game Saved' } }));
      
      setActiveSave(updatedSave);
      
      // Trigger update
      window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      
      setIsSimulating(false);
      console.log("DEBUG: Jumped to Week 36 (Champions 2025 start)");
      alert(`DEBUG: Now at Week 36 with ${updatedSave.championsQualified?.length || 0} teams qualified. Champions groups initialized! Check the Champions page.`);
    }, 500);
  };

  return (
    <>
      {isSimulating && <CareerLoadingOverlay />}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          className="sim-week-btn" 
          onClick={handleSimulateWeek}
          disabled={isSimulating}
        >
          {isSimulating ? 'Simulating...' : 'Simulate Week'}
        </button>
        {/* Debug: Jump to Week 13 for regional groups testing */}
        <button
          className="sim-week-btn debug-btn"
          onClick={handleDebugJumpToWeek13}
          disabled={isSimulating}
          style={{ backgroundColor: '#ff9800', fontSize: '0.8rem' }}
          title="DEBUG: Jump to Week 13 (start of Regular Season)"
        >
          DEBUG: W13
        </button>
        {/* Debug: Jump to Week 24 (before Tokyo) */}
        <button
          className="sim-week-btn debug-btn"
          onClick={handleDebugJumpToWeek24}
          disabled={isSimulating}
          style={{ backgroundColor: '#9c27b0', fontSize: '0.8rem' }}
          title="DEBUG: Jump to Week 24 (prep week before Tokyo)"
        >
          DEBUG: W24
        </button>
        {/* Debug: Jump to Week 25 for Masters Tokyo testing */}
        <button
          className="sim-week-btn debug-btn"
          onClick={handleDebugJumpToWeek25}
          disabled={isSimulating}
          style={{ backgroundColor: '#e91e63', fontSize: '0.8rem' }}
          title="DEBUG: Jump to Week 25 (start of Masters Tokyo)"
        >
          DEBUG: W25
        </button>
        {/* Debug: Jump to Week 36 for Champions 2025 testing */}
        <button
          className="sim-week-btn debug-btn"
          onClick={handleDebugJumpToWeek36}
          disabled={isSimulating}
          style={{ backgroundColor: '#FFD700', color: '#000', fontSize: '0.8rem', fontWeight: 'bold' }}
          title="DEBUG: Jump to Week 36 (start of Champions 2025 - initializes groups!)"
        >
          👑 CHAMPIONS
        </button>
      </div>
    </>
  );
};

export default SimWeekButton;