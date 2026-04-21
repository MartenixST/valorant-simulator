/**
 * Champions Tournament - 16 Team Automation
 * Format: 4 Groups of 4 teams (1 from each region per group)
 * -> Top 2 from each group advance to Playoffs (8 teams)
 * -> Single Elimination Playoffs (Quarterfinals, Semifinals, Grand Final)
 */

import { teams as allTeamsData } from '../../teams.js';

export function automate16TeamChampions(qualifiedTeams, allPlayers, simulateMatch, state, playerTeamName, prefix = 'CHAMP-', currentWeek = 36) {
    console.log("16-Team Champions: Automating week", currentWeek, "for teams:", qualifiedTeams.length);
    
    // Initialize or load state
    if (!state) {
        console.log("16-Team Champions: Creating new state");
        state = {
            groups: { A: [], B: [], C: [], D: [] },
            groupMatches: {},
            playoffs: {
                quarterfinals: [],
                semifinals: [],
                grandFinal: null,
                matches: {}
            },
            teamStats: {},
            complete: false,
            season: null
        };
    }

    // Ensure state structure
    if (!state.groups) state.groups = { A: [], B: [], C: [], D: [] };
    if (!state.groupMatches) state.groupMatches = {};
    if (!state.playoffs) {
        state.playoffs = {
            quarterfinals: [],
            semifinals: [],
            grandFinal: null,
            matches: {}
        };
    }
    if (!state.teamStats) state.teamStats = {};

    const groupStageWeeks = currentWeek >= 36 && currentWeek <= 38; // Weeks 36-38: Group Stage
    const playoffWeeks = currentWeek >= 39 && currentWeek <= 41; // Weeks 39-41: Playoffs

    // --- GROUP STAGE SETUP (Week 36) ---
    if (currentWeek === 36 && qualifiedTeams.length >= 16) {
        const existingGroupsPopulated = Object.values(state.groups).some(g => g.length > 0);
        
        if (!existingGroupsPopulated) {
            console.log("16-Team Champions: Distributing teams into groups");
            
            // Sort teams by region
            const teamsByRegion = {
                Americas: [],
                EMEA: [],
                Pacific: [],
                China: []
            };
            
            qualifiedTeams.forEach(team => {
                // Determine region from team data or qualifiedTeams structure
                const region = team.region || getRegionForTeam(team, allPlayers);
                if (teamsByRegion[region]) {
                    teamsByRegion[region].push(team.name || team);
                }
            });
            
            // Randomize order within each region
            Object.keys(teamsByRegion).forEach(region => {
                teamsByRegion[region].sort(() => 0.5 - Math.random());
            });
            
            // Distribute to groups - 1 from each region per group
            const groups = ['A', 'B', 'C', 'D'];
            groups.forEach((group, index) => {
                Object.keys(teamsByRegion).forEach(region => {
                    if (teamsByRegion[region][index]) {
                        state.groups[group].push(teamsByRegion[region][index]);
                    }
                });
            });
            
            console.log("16-Team Champions: Groups formed:", state.groups);
            
            // Initialize team stats
            Object.values(state.groups).flat().forEach(team => {
                if (!state.teamStats[team]) {
                    state.teamStats[team] = { 
                        wins: 0, 
                        losses: 0, 
                        points: 0,
                        group: null
                    };
                }
            });
            
            // Assign group to each team
            Object.keys(state.groups).forEach(group => {
                state.groups[group].forEach(team => {
                    if (state.teamStats[team]) {
                        state.teamStats[team].group = group;
                    }
                });
            });
            
            // Generate Group Stage matches (Double Elimination - GSL Format)
            // Week 36: WB Round 1 (4 matches per group - 2 matches actually, all groups)
            // Week 37: WB Final + LB Round 1
            // Week 38: LB Final - Winners advance
            
            Object.keys(state.groups).forEach(group => {
                const groupTeams = state.groups[group];
                if (groupTeams.length === 4) {
                    const [t1, t2, t3, t4] = groupTeams;
                    
                    // Helper to create match only if it doesn't exist (preserve manual results)
                    const createMatch = (matchId, matchData) => {
                        if (!state.groupMatches[matchId]) {
                            state.groupMatches[matchId] = matchData;
                        }
                    };
                    
                    // Week 36: WB Round 1
                    // WB Match 1: t1 vs t2
                    createMatch(`${prefix}GROUP-${group}-WB1`, {
                        team1: t1, team2: t2, winner: null, loser: null, score: null,
                        week: 36, group: group, bracket: 'WB', round: 1, match: 1
                    });
                    // WB Match 2: t3 vs t4  
                    createMatch(`${prefix}GROUP-${group}-WB2`, {
                        team1: t3, team2: t4, winner: null, loser: null, score: null,
                        week: 36, group: group, bracket: 'WB', round: 1, match: 2
                    });
                    
                    // Week 37: WB Final + LB Round 1
                    // WB Final (placeholder teams - will be set after WB1/WB2)
                    createMatch(`${prefix}GROUP-${group}-WBF`, {
                        team1: null, team2: null, winner: null, loser: null, score: null,
                        week: 37, group: group, bracket: 'WB', round: 'Final', match: 1,
                        dependsOn: [`${prefix}GROUP-${group}-WB1`, `${prefix}GROUP-${group}-WB2`]
                    });
                    // LB Match 1: Loser WB1 vs Loser WB2
                    createMatch(`${prefix}GROUP-${group}-LB1`, {
                        team1: null, team2: null, winner: null, loser: null, score: null,
                        week: 37, group: group, bracket: 'LB', round: 1, match: 1,
                        dependsOn: [`${prefix}GROUP-${group}-WB1`, `${prefix}GROUP-${group}-WB2`]
                    });
                    
                    // Week 38: LB Final
                    // LB Final: Winner LB1 vs Loser WBF (deciider match)
                    createMatch(`${prefix}GROUP-${group}-LBF`, {
                        team1: null, team2: null, winner: null, loser: null, score: null,
                        week: 38, group: group, bracket: 'LB', round: 'Final', match: 1,
                        dependsOn: [`${prefix}GROUP-${group}-WBF`, `${prefix}GROUP-${group}-LB1`]
                    });
                }
            });
            
            console.log("16-Team Champions: Group matches generated");
        }
    }

    // --- BRACKET PROGRESSION: Resolve teams for dependent matches ---
    function resolveBracketProgression() {
        const matches = state.groupMatches;
        console.log(`resolveBracketProgression: Checking ${Object.keys(matches).length} matches`);
        
        // Resolve WB Final teams (Winners of WB1 and WB2)
        Object.keys(matches).forEach(matchId => {
            const match = matches[matchId];
            if (match.dependsOn) {
                console.log(`Checking ${matchId}: has dependsOn, teams are team1=${match.team1}, team2=${match.team2}`);
                if (!match.team1 && !match.team2) {
                    const deps = match.dependsOn.map(id => matches[id]).filter(Boolean);
                    console.log(`  Dependencies: ${match.dependsOn.join(', ')} - found ${deps.length} matches`);
                    
                    const allHaveWinners = deps.every(d => d.winner);
                    console.log(`  All dependencies have winners: ${allHaveWinners}`);
                    deps.forEach((d, i) => {
                        console.log(`    Dep ${i}: ${match.dependsOn[i]} -> winner=${d.winner}, loser=${d.loser}`);
                    });
                    
                    if (allHaveWinners) {
                        if (matchId.includes('WBF')) {
                            // WB Final: Winners of WB1 and WB2
                            match.team1 = matches[match.dependsOn[0]]?.winner;
                            match.team2 = matches[match.dependsOn[1]]?.winner;
                            console.log(`  -> WBF resolved: ${match.team1} vs ${match.team2}`);
                        } else if (matchId.includes('LB1')) {
                            // LB Round 1: Losers of WB1 and WB2
                            match.team1 = matches[match.dependsOn[0]]?.loser;
                            match.team2 = matches[match.dependsOn[1]]?.loser;
                            console.log(`  -> LB1 resolved: ${match.team1} vs ${match.team2}`);
                        } else if (matchId.includes('LBF')) {
                            // LB Final: Winner of LB1 vs Loser of WBF
                            match.team1 = matches[match.dependsOn[1]]?.winner; // Winner of LB1
                            match.team2 = matches[match.dependsOn[0]]?.loser;  // Loser of WBF
                            console.log(`  -> LBF resolved: ${match.team1} vs ${match.team2}`);
                        }
                        console.log(`✓ Bracket resolved: ${matchId} -> ${match.team1} vs ${match.team2}`);
                    }
                } else {
                    console.log(`  Skipping ${matchId}: teams already assigned (${match.team1} vs ${match.team2})`);
                }
            }
        });
    }
    
    // Resolve bracket before simulating
    resolveBracketProgression();

    // --- GROUP STAGE PROGRESSION & SIMULATION ---
    if (groupStageWeeks) {
        // Simulate AI matches for current week
        Object.keys(state.groupMatches).forEach(matchId => {
            const match = state.groupMatches[matchId];
            if (match.week === currentWeek && !match.winner && match.team1 && match.team2) {
                // Check if player team is involved
                const isPlayerInvolved = (playerTeamName === match.team1 || playerTeamName === match.team2);
                
                if (!isPlayerInvolved && typeof simulateMatch === 'function') {
                    // Auto-simulate AI vs AI matches
                    const result = simulateMatch(match.team1, match.team2, allPlayers, { matchType: 'champions_group' });
                    if (result && result.winner) {
                        match.winner = result.winner;
                        match.loser = result.loser;
                        match.score = result.score;
                        match.playerStats = result.playerStats;
                        
                        // Update stats
                        if (match.winner && state.teamStats[match.winner]) {
                            state.teamStats[match.winner].wins++;
                            state.teamStats[match.winner].points += 3;
                        }
                        if (match.loser && state.teamStats[match.loser]) {
                            state.teamStats[match.loser].losses++;
                        }
                        
                        console.log(`Group match completed: ${match.team1} vs ${match.team2}, Winner: ${match.winner}`);
                    }
                }
            }
        });
        
        // Resolve bracket after simulation for next week's matches
        resolveBracketProgression();
    }

    // --- CHECK GROUP STAGE COMPLETION & FORM PLAYOFFS (End of Week 38) ---
    if (currentWeek === 38) {
        const allGroupMatchesComplete = Object.values(state.groupMatches).every(m => m.winner);
        
        if (allGroupMatchesComplete && state.playoffs.quarterfinals.length === 0) {
            console.log("16-Team Champions: Group stage complete, forming playoffs");
            
            // Get top 2 from each group
            const advancingTeams = [];
            Object.keys(state.groups).forEach(group => {
                const groupTeams = state.groups[group].map(team => ({
                    name: team,
                    ...state.teamStats[team]
                })).sort((a, b) => b.points - a.points || b.wins - a.wins);
                
                // Top 2 advance
                advancingTeams.push(...groupTeams.slice(0, 2).map(t => t.name));
                
                console.log(`Group ${group} standings:`, groupTeams.map(t => `${t.name} (${t.wins}-${t.losses}, ${t.points}pts)`));
            });
            
            console.log("Advancing to playoffs:", advancingTeams);
            
            // Create Quarterfinals (8 teams -> 4 matches)
            // Cross-group matchups: Group A #1 vs Group B #2, Group B #1 vs Group A #2, etc.
            const qfMatchups = [
                [advancingTeams[0], advancingTeams[3]], // A1 vs B2
                [advancingTeams[2], advancingTeams[1]], // B1 vs A2
                [advancingTeams[4], advancingTeams[7]], // C1 vs D2
                [advancingTeams[6], advancingTeams[5]]  // D1 vs C2
            ];
            
            qfMatchups.forEach((matchup, index) => {
                const matchId = `${prefix}QF-${index + 1}`;
                state.playoffs.matches[matchId] = {
                    team1: matchup[0],
                    team2: matchup[1],
                    winner: null,
                    loser: null,
                    score: null,
                    round: 'quarterfinals'
                };
                state.playoffs.quarterfinals.push(matchId);
            });
        }
    }

    // --- PLAYOFFS (Weeks 39-41) ---
    if (playoffWeeks) {
        // Week 39: Quarterfinals
        if (currentWeek === 39) {
            state.playoffs.quarterfinals.forEach(matchId => {
                const match = state.playoffs.matches[matchId];
                if (!match.winner && match.team1 && match.team2) {
                    const isPlayerInvolved = (playerTeamName === match.team1 || playerTeamName === match.team2);
                    
                    if (!isPlayerInvolved) {
                        const result = simulateMatch(match.team1, match.team2, 'champions_playoffs');
                        match.winner = result.winner;
                        match.loser = result.loser;
                        match.score = result.score;
                        match.playerStats = result.playerStats;
                        console.log(`QF completed: ${match.team1} vs ${match.team2}, Winner: ${match.winner}`);
                    }
                }
            });
            
            // Populate Semifinals if QFs are done
            const qfWinners = state.playoffs.quarterfinals.map(id => state.playoffs.matches[id]?.winner).filter(Boolean);
            if (qfWinners.length === 4 && state.playoffs.semifinals.length === 0) {
                // SF1: QF1 Winner vs QF2 Winner
                // SF2: QF3 Winner vs QF4 Winner
                const sfMatchups = [
                    [qfWinners[0], qfWinners[1]],
                    [qfWinners[2], qfWinners[3]]
                ];
                
                sfMatchups.forEach((matchup, index) => {
                    const matchId = `${prefix}SF-${index + 1}`;
                    state.playoffs.matches[matchId] = {
                        team1: matchup[0],
                        team2: matchup[1],
                        winner: null,
                        loser: null,
                        score: null,
                        round: 'semifinals'
                    };
                    state.playoffs.semifinals.push(matchId);
                });
            }
        }
        
        // Week 40: Semifinals
        if (currentWeek === 40) {
            state.playoffs.semifinals.forEach(matchId => {
                const match = state.playoffs.matches[matchId];
                if (!match.winner && match.team1 && match.team2) {
                    const isPlayerInvolved = (playerTeamName === match.team1 || playerTeamName === match.team2);
                    
                    if (!isPlayerInvolved) {
                        const result = simulateMatch(match.team1, match.team2, 'champions_playoffs');
                        match.winner = result.winner;
                        match.loser = result.loser;
                        match.score = result.score;
                        match.playerStats = result.playerStats;
                        console.log(`SF completed: ${match.team1} vs ${match.team2}, Winner: ${match.winner}`);
                    }
                }
            });
            
            // Populate Grand Final if SFs are done
            const sfWinners = state.playoffs.semifinals.map(id => state.playoffs.matches[id]?.winner).filter(Boolean);
            if (sfWinners.length === 2 && !state.playoffs.grandFinal) {
                const gfId = `${prefix}GF`;
                state.playoffs.matches[gfId] = {
                    team1: sfWinners[0],
                    team2: sfWinners[1],
                    winner: null,
                    loser: null,
                    score: null,
                    round: 'grandfinal'
                };
                state.playoffs.grandFinal = gfId;
            }
        }
        
        // Week 41: Grand Final
        if (currentWeek === 41 && state.playoffs.grandFinal) {
            const gf = state.playoffs.matches[state.playoffs.grandFinal];
            if (!gf.winner && gf.team1 && gf.team2) {
                const isPlayerInvolved = (playerTeamName === gf.team1 || playerTeamName === gf.team2);
                
                if (!isPlayerInvolved) {
                    const result = simulateMatch(gf.team1, gf.team2, 'champions_final');
                    gf.winner = result.winner;
                    gf.loser = result.loser;
                    gf.score = result.score;
                    gf.playerStats = result.playerStats;
                    console.log(`Grand Final completed: ${gf.team1} vs ${gf.team2}, Winner: ${gf.winner}`);
                }
            }
            
            // Mark tournament complete
            if (gf.winner) {
                const allCompleted = Object.values(state.playoffs.matches).every(m => m.winner);
                const weekMatches = Object.values(state.playoffs.matches).filter(m => m.round === 'grandfinal');
                if (allCompleted && weekMatches.length > 0) {
                    console.log(`16-Team Champions: Week ${currentWeek} already completed, resolving bracket progression`);
                }
            }
        }
    }

    return state;
}

// Helper function to determine region for a team
function getRegionForTeam(team, allPlayers) {
    const teamName = team.name || team;
    
    // First try to find from imported teams data (most reliable)
    const teamData = allTeamsData.find(t => t.name === teamName);
    if (teamData && teamData.region) {
        return teamData.region;
    }
    
    // Try to find region from player data
    if (allPlayers) {
        const player = allPlayers.find(p => p.team === teamName);
        if (player && player.region) {
            return player.region;
        }
    }
    
    // Try to infer from team name patterns
    const nameLower = teamName.toLowerCase();
    if (/prx|paper rex|gen.g|drx|t1|zeta|detonation|talon|secret|bleed|rrq|geekay/i.test(nameLower)) return 'Pacific';
    if (/navi|fnc|fnatic|liquid|g2|karmine|kc|team vitality|m8|gentle|fut|bbl/i.test(nameLower)) return 'EMEA';
    if (/edg|edward|fpx|funplus|drg|dragon|tyloo|te|trace|nova|xlg|weibo/i.test(nameLower)) return 'China';
    
    // Default fallback
    return 'Americas';
}
