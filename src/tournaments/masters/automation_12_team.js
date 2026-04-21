/**
 * 12-Team Masters Tournament Automation
 * Format used by Masters Tokyo
 * - 12 teams total (3 per region)
 * - 4 #1 seeds go directly to playoffs
 * - 8 teams (#2 and #3 from each region) play Swiss Stage
 * - Top 4 from Swiss join 4 #1 seeds in 8-team double-elimination playoffs
 */

export function automate12TeamMasters(qualifiedTeamsRaw, regionalSeeds, savePlayers, simulateMatchFn, currentState = null, playerTeamName = null, prefix = 'M-', currentWeek = null) {
    if (!qualifiedTeamsRaw || qualifiedTeamsRaw.length < 8) {
        console.log("12-Team Masters: Need at least 8 teams, got", qualifiedTeamsRaw?.length);
        return null;
    }
    
    // Support both 8-team (2 per region) and 12-team (3 per region) formats
    const isFullFormat = qualifiedTeamsRaw.length >= 12;
    console.log(`12-Team Masters: ${qualifiedTeamsRaw.length} teams (${isFullFormat ? '12-team' : '8-team fallback'} format)`);

    // Sanitize qualifiedTeams
    const allQualifiedTeams = qualifiedTeamsRaw.map(t => typeof t === 'string' ? t : (t?.name || t));
    
    // Extract seed team names
    const seedTeamNames = Object.values(regionalSeeds || {}).filter(Boolean);
    
    // Swiss Stage teams = all teams minus the #1 seeds
    const swissTeams = allQualifiedTeams.filter(t => !seedTeamNames.includes(t));
    
    console.log(`12-Team Masters: ${allQualifiedTeams.length} total teams, ${seedTeamNames.length} regional seeds, ${swissTeams.length} Swiss Stage teams`);
    console.log(`Regional seeds:`, seedTeamNames);
    console.log(`Swiss teams:`, swissTeams);

    // Get or initialize state
    let state = currentState;
    if (!state) {
        state = {
            playoffs: { 
                matches: {}, 
                upper: { round1: [], round2: [], final: null },
                lower: { round1: [], round2: [], final: null },
                regionalSeeds: regionalSeeds || {}
            },
            swiss: { rounds: [], teamStats: {}, matches: {} },
            series: {},
            champion: null,
            complete: false
        };
    }
    
    // Ensure structures exist
    if (!state.swiss) state.swiss = { rounds: [], teamStats: {}, matches: {} };
    if (!state.playoffs) {
        state.playoffs = { 
            matches: {}, 
            upper: { round1: [], round2: [], final: null },
            lower: { round1: [], round2: [], final: null },
            regionalSeeds: regionalSeeds || {}
        };
    }
    if (!state.playoffs.upper) state.playoffs.upper = { round1: [], round2: [], final: null };
    if (!state.playoffs.lower) state.playoffs.lower = { round1: [], round2: [], final: null };
    
    // Store regional seeds in state
    state.playoffs.regionalSeeds = regionalSeeds || state.playoffs.regionalSeeds || {};

    // CLEANUP: Remove any #1 seeds that were incorrectly added to Swiss teamStats
    seedTeamNames.forEach(seedTeam => {
        if (state.swiss.teamStats[seedTeam]) {
            console.log(`Removing ${seedTeam} from Swiss teamStats (they are a #1 seed)`);
            delete state.swiss.teamStats[seedTeam];
        }
    });
    
    // Initialize Swiss teamStats for Swiss teams only (not seeds)
    swissTeams.forEach(team => {
        if (!state.swiss.teamStats[team]) {
            state.swiss.teamStats[team] = { 
                wins: 0, 
                losses: 0, 
                roundsPlayed: 0,
                qualified: false,
                eliminated: false
            };
        }
    });

    // --- SWISS STAGE (Weeks 25-27 for Tokyo-style) ---
    const swissWeeks = currentWeek >= 25 && currentWeek <= 27;
    
    if (swissWeeks) {
        const roundIndex = state.swiss.rounds.length;
        
        // After Round 2: Qualify 2-0 teams, eliminate 0-2 teams
        if (roundIndex === 2) {
            const teamsByWins = {};
            swissTeams.forEach(team => {
                const wins = state.swiss.teamStats[team].wins;
                if (!teamsByWins[wins]) teamsByWins[wins] = [];
                teamsByWins[wins].push(team);
            });
            
            // Qualify teams with 2 wins (2-0 record)
            if (teamsByWins[2]) {
                teamsByWins[2].forEach(team => {
                    state.swiss.teamStats[team].qualified = true;
                    console.log(`12-Team Masters: ${team} qualified with 2-0 record`);
                });
            }
            
            // Eliminate teams with 2 losses (0-2 record)
            if (teamsByWins[0] && state.swiss.teamStats[teamsByWins[0][0]]?.losses === 2) {
                teamsByWins[0].forEach(team => {
                    state.swiss.teamStats[team].eliminated = true;
                    console.log(`12-Team Masters: ${team} eliminated with 0-2 record`);
                });
            }
        }
        
        // Only generate if we haven't completed all rounds
        if (roundIndex < 3) {
            console.log(`12-Team Masters: Generating Swiss Round ${roundIndex + 1}`);
            
            // Group teams by wins
            const teamsByWins = {};
            swissTeams.forEach(team => {
                const wins = state.swiss.teamStats[team].wins;
                if (!teamsByWins[wins]) teamsByWins[wins] = [];
                teamsByWins[wins].push(team);
            });

            // Generate matches
            const roundMatches = [];
            
            if (roundIndex === 2) {
                // ROUND 3: Only 1-1 teams play each other
                // 2-0 teams already qualified, 0-2 teams already eliminated
                const oneOneTeams = swissTeams.filter(team => {
                    const stats = state.swiss.teamStats[team];
                    return stats.wins === 1 && stats.losses === 1 && !stats.qualified && !stats.eliminated;
                });
                
                console.log(`12-Team Masters: Round 3 - ${oneOneTeams.length} teams at 1-1`);
                
                // Shuffle for randomness
                oneOneTeams.sort(() => 0.5 - Math.random());
                
                // Pair 1-1 teams
                for (let i = 0; i < oneOneTeams.length; i += 2) {
                    if (i + 1 < oneOneTeams.length) {
                        const team1 = oneOneTeams[i];
                        const team2 = oneOneTeams[i + 1];
                        const matchId = `${prefix}SWISS-R${roundIndex + 1}-${roundMatches.length + 1}`;
                        
                        state.swiss.matches[matchId] = {
                            team1, team2,
                            winner: null, loser: null,
                            score: null, playerStats: null
                        };
                        
                        roundMatches.push(matchId);
                    }
                }
            } else {
                // ROUNDS 1-2: Normal pairing by win count
                const winCounts = Object.keys(teamsByWins).map(Number).sort((a, b) => b - a);
                
                winCounts.forEach(wins => {
                    const teamsAtWins = teamsByWins[wins];
                    // Shuffle for randomness
                    teamsAtWins.sort(() => 0.5 - Math.random());
                    
                    // Pair teams
                    for (let i = 0; i < teamsAtWins.length; i += 2) {
                        if (i + 1 < teamsAtWins.length) {
                            const team1 = teamsAtWins[i];
                            const team2 = teamsAtWins[i + 1];
                            const matchId = `${prefix}SWISS-R${roundIndex + 1}-${roundMatches.length + 1}`;
                            
                            state.swiss.matches[matchId] = {
                                team1, team2,
                                winner: null, loser: null,
                                score: null, playerStats: null
                            };
                            
                            roundMatches.push(matchId);
                        }
                    }
                });
            }
            
            state.swiss.rounds.push({
                round: roundIndex + 1,
                matches: roundMatches
            });
        }

        // Check Swiss completion
        const swissComplete = state.swiss.rounds.length >= 3 && 
            state.swiss.rounds.every(r => r.matches.every(m => state.swiss.matches[m]?.winner));
        
        if (swissComplete) {
            // After Round 3: Winners of 1-1 matches join 2-0 teams as qualified
            const swissArray = swissTeams.map(team => ({
                name: team,
                ...state.swiss.teamStats[team]
            }));
            
            // Sort by wins, then by losses (fewer losses = better)
            swissArray.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
            
            // Top 4 qualify (should be 2 teams from 2-0 and 2 teams from 1-1 winners)
            swissArray.slice(0, 4).forEach(t => {
                state.swiss.teamStats[t.name].qualified = true;
                state.swiss.teamStats[t.name].eliminated = false;
            });
            
            // Bottom 4 eliminated (2 from 0-2 and 2 from 1-1 losers)
            swissArray.slice(4).forEach(t => {
                state.swiss.teamStats[t.name].qualified = false;
                state.swiss.teamStats[t.name].eliminated = true;
            });
            
            console.log("12-Team Masters: Swiss complete, qualified teams:", swissArray.slice(0, 4).map(t => `${t.name} (${t.wins}-${t.losses})`));
        }
    }

    // --- PLAYOFFS (Weeks 28-32 for Tokyo-style) ---
    const playoffWeeks = currentWeek >= 28 && currentWeek <= 32;
    const qualifiedSwissTeams = swissTeams.filter(t => state.swiss.teamStats[t]?.qualified);
    
    if (playoffWeeks && qualifiedSwissTeams.length >= 4 && seedTeamNames.length >= 4) {
        const existingMatchesCount = state.playoffs.upper.round1.length;
        const shouldGenerateBracket = existingMatchesCount === 0;
        
        if (shouldGenerateBracket) {
            console.log("12-Team Masters: Generating double-elimination playoff bracket");
            
            // Randomize order
            const swissQualifiers = [...qualifiedSwissTeams].sort(() => 0.5 - Math.random());
            const seedTeams = [...seedTeamNames].sort(() => 0.5 - Math.random());
            
            // UPPER BRACKET ROUND 1: Seeds vs Swiss Qualifiers
            for (let i = 0; i < 4; i++) {
                const team1 = seedTeams[i];
                const team2 = swissQualifiers[i];
                const matchId = `${prefix}PLAYOFF-UB-R1-${i + 1}`;
                
                state.playoffs.matches[matchId] = {
                    team1, team2,
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'upper', round: 'round1',
                    note: 'UB Round 1'
                };
                
                state.playoffs.upper.round1.push(matchId);
            }
            
            // UPPER BRACKET ROUND 2: Winners from UB R1
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-UB-R2-${i + 1}`;
                state.playoffs.matches[matchId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'upper', round: 'round2',
                    note: 'UB Round 2'
                };
                state.playoffs.upper.round2.push(matchId);
            }
            
            // LOWER BRACKET ROUND 1: Losers from UB R1
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-LB-R1-${i + 1}`;
                state.playoffs.matches[matchId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'lower', round: 'round1',
                    note: 'LB Round 1'
                };
                state.playoffs.lower.round1.push(matchId);
            }
            
            // LOWER BRACKET ROUND 2: Winners from LB R1 vs Losers from UB R2
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-LB-R2-${i + 1}`;
                state.playoffs.matches[matchId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'lower', round: 'round2',
                    note: 'LB Round 2'
                };
                state.playoffs.lower.round2.push(matchId);
            }
            
            // UPPER BRACKET FINAL
            const ubFinalId = `${prefix}PLAYOFF-UB-FINAL`;
            state.playoffs.matches[ubFinalId] = {
                team1: 'TBD', team2: 'TBD',
                winner: null, loser: null,
                score: null, playerStats: null,
                bracket: 'upper', round: 'final',
                note: 'UB Final'
            };
            state.playoffs.upper.final = ubFinalId;
            
            // LOWER BRACKET FINAL
            const lbFinalId = `${prefix}PLAYOFF-LB-FINAL`;
            state.playoffs.matches[lbFinalId] = {
                team1: 'TBD', team2: 'TBD',
                winner: null, loser: null,
                score: null, playerStats: null,
                bracket: 'lower', round: 'final',
                note: 'LB Final'
            };
            state.playoffs.lower.final = lbFinalId;
            
            // GRAND FINAL
            const gfId = `${prefix}PLAYOFF-GF`;
            state.playoffs.matches[gfId] = {
                team1: 'TBD', team2: 'TBD',
                winner: null, loser: null,
                score: null, playerStats: null,
                bracket: 'grand_final', round: 'final',
                note: 'Grand Final'
            };
            
            console.log("12-Team Masters: Double-elimination bracket created");
        }
        
        // --- BRACKET PROGRESSION: Populate subsequent rounds with winners/losers ---
        
        // Helper to get winner/loser of a match
        const getWinner = (matchId) => state.playoffs.matches[matchId]?.winner;
        const getLoser = (matchId) => state.playoffs.matches[matchId]?.loser;
        const isComplete = (matchId) => !!state.playoffs.matches[matchId]?.winner;
        
        // 1. UB Round 1 → UB Round 2 (winners) + LB Round 1 (losers)
        const ubR1 = state.playoffs.upper.round1;
        const ubR2 = state.playoffs.upper.round2;
        const lbR1 = state.playoffs.lower.round1;
        
        if (ubR1.length === 4 && ubR2.length === 2 && lbR1.length === 2) {
            // Check if all UB R1 matches are complete
            const ubR1Complete = ubR1.every(isComplete);
            
            if (ubR1Complete) {
                // UB R2 Match 1: Winners of UB R1 Match 1 & 2
                if (state.playoffs.matches[ubR2[0]].team1 === 'TBD') {
                    state.playoffs.matches[ubR2[0]].team1 = getWinner(ubR1[0]);
                    state.playoffs.matches[ubR2[0]].team2 = getWinner(ubR1[1]);
                    console.log(`Populated UB R2-1: ${getWinner(ubR1[0])} vs ${getWinner(ubR1[1])}`);
                }
                
                // UB R2 Match 2: Winners of UB R1 Match 3 & 4
                if (state.playoffs.matches[ubR2[1]].team1 === 'TBD') {
                    state.playoffs.matches[ubR2[1]].team1 = getWinner(ubR1[2]);
                    state.playoffs.matches[ubR2[1]].team2 = getWinner(ubR1[3]);
                    console.log(`Populated UB R2-2: ${getWinner(ubR1[2])} vs ${getWinner(ubR1[3])}`);
                }
                
                // LB R1 Match 1: Losers of UB R1 Match 1 & 2
                if (state.playoffs.matches[lbR1[0]].team1 === 'TBD') {
                    state.playoffs.matches[lbR1[0]].team1 = getLoser(ubR1[0]);
                    state.playoffs.matches[lbR1[0]].team2 = getLoser(ubR1[1]);
                    console.log(`Populated LB R1-1: ${getLoser(ubR1[0])} vs ${getLoser(ubR1[1])}`);
                }
                
                // LB R1 Match 2: Losers of UB R1 Match 3 & 4
                if (state.playoffs.matches[lbR1[1]].team1 === 'TBD') {
                    state.playoffs.matches[lbR1[1]].team1 = getLoser(ubR1[2]);
                    state.playoffs.matches[lbR1[1]].team2 = getLoser(ubR1[3]);
                    console.log(`Populated LB R1-2: ${getLoser(ubR1[2])} vs ${getLoser(ubR1[3])}`);
                }
            }
        }
        
        // 2. UB Round 2 → UB Final (winners) + LB Round 2 (losers)
        const ubFinal = state.playoffs.upper.final;
        const lbR2 = state.playoffs.lower.round2;
        
        if (ubR2.length === 2 && ubFinal && lbR2.length === 2) {
            const ubR2Complete = ubR2.every(isComplete);
            
            if (ubR2Complete) {
                // UB Final: Winners of UB R2
                if (state.playoffs.matches[ubFinal].team1 === 'TBD') {
                    state.playoffs.matches[ubFinal].team1 = getWinner(ubR2[0]);
                    state.playoffs.matches[ubFinal].team2 = getWinner(ubR2[1]);
                    console.log(`Populated UB Final: ${getWinner(ubR2[0])} vs ${getWinner(ubR2[1])}`);
                }
                
                // LB R2: Losers of UB R2 vs Winners of LB R1
                // Wait for LB R1 to complete
                if (lbR1.every(isComplete)) {
                    // LB R2 Match 1: Loser UB R2-1 vs Winner LB R1-1
                    if (state.playoffs.matches[lbR2[0]].team1 === 'TBD') {
                        state.playoffs.matches[lbR2[0]].team1 = getLoser(ubR2[0]);
                        state.playoffs.matches[lbR2[0]].team2 = getWinner(lbR1[0]);
                        console.log(`Populated LB R2-1: ${getLoser(ubR2[0])} vs ${getWinner(lbR1[0])}`);
                    }
                    
                    // LB R2 Match 2: Loser UB R2-2 vs Winner LB R1-2
                    if (state.playoffs.matches[lbR2[1]].team1 === 'TBD') {
                        state.playoffs.matches[lbR2[1]].team1 = getLoser(ubR2[1]);
                        state.playoffs.matches[lbR2[1]].team2 = getWinner(lbR1[1]);
                        console.log(`Populated LB R2-2: ${getLoser(ubR2[1])} vs ${getWinner(lbR1[1])}`);
                    }
                }
            }
        }
        
        // 3. LB Round 2 → LB Consolidation (winners play each other)
        const lbFinal = state.playoffs.lower.final;
        
        if (lbR2.length === 2 && lbFinal) {
            // First, check if LB R2 is complete and populate LB Final
            if (lbR2.every(isComplete)) {
                // LB R2 winners play each other in the LB Final
                // Loser of UB Final will join as Team 1 once UB Final is complete
                const lbR2Winner1 = getWinner(lbR2[0]);
                const lbR2Winner2 = getWinner(lbR2[1]);
                
                if (state.playoffs.matches[lbFinal].team2 === 'TBD') {
                    // One LB R2 winner goes to LB Final team2 slot
                    // They'll wait for the UB Final loser
                    state.playoffs.matches[lbFinal].team2 = lbR2Winner1;
                    console.log(`Populated LB Final team2: ${lbR2Winner1} (waiting for UB Final loser)`);
                }
            }
            
            // Then, when UB Final completes, add the loser to LB Final
            if (isComplete(ubFinal)) {
                if (state.playoffs.matches[lbFinal].team1 === 'TBD') {
                    state.playoffs.matches[lbFinal].team1 = getLoser(ubFinal);
                    console.log(`Populated LB Final team1: ${getLoser(ubFinal)} (dropped from UB Final)`);
                }
            }
        }
        
        // 4. UB Final + LB Final → Grand Final
        const grandFinal = state.playoffs.grandFinal || state.playoffs.matches?.[`${prefix}PLAYOFF-GF`];
        
        if (ubFinal && lbFinal && grandFinal) {
            // Ensure the Grand Final match exists in the matches object
            if (!state.playoffs.matches[grandFinal]) {
                // Create the Grand Final match if it doesn't exist
                state.playoffs.matches[grandFinal] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'grand_final', round: 'final',
                    note: 'Grand Final'
                };
                console.log(`Created missing Grand Final match: ${grandFinal}`);
            }
            
            // Grand Final: Winner UB Final vs Winner LB Final
            if (isComplete(ubFinal) && isComplete(lbFinal)) {
                const ubFinalWinner = getWinner(ubFinal);
                const lbFinalWinner = getWinner(lbFinal);
                
                if (state.playoffs.matches[grandFinal].team1 === 'TBD') {
                    state.playoffs.matches[grandFinal].team1 = ubFinalWinner;
                    state.playoffs.matches[grandFinal].team2 = lbFinalWinner;
                    console.log(`Populated Grand Final: ${ubFinalWinner} vs ${lbFinalWinner}`);
                }
            }
        }
    }

    return state;
}
