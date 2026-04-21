/**
 * 8-Team Masters Tournament Automation
 * Traditional format used by Masters Bangkok
 * - 8 teams total (2 per region)
 * - All 8 teams play Swiss Stage
 * - Top 4 from Swiss advance to single-elimination playoffs
 */

import { teams } from '../../teams.js';

export function automate8TeamMasters(qualifiedTeamsRaw, savePlayers, simulateMatchFn, currentState = null, playerTeamName = null, prefix = 'M-', currentWeek = null) {
    if (!qualifiedTeamsRaw || qualifiedTeamsRaw.length < 8) return null;

    // Sanitize qualifiedTeams to ensure they are strings (team names)
    const allQualifiedTeams = qualifiedTeamsRaw.map(t => typeof t === 'string' ? t : (t?.name || t));
    
    console.log(`8-Team Masters: ${allQualifiedTeams.length} teams in Swiss Stage`);

    // Get or initialize state
    let state = currentState;
    if (!state) {
        state = {
            swiss: { rounds: [], teamStats: {}, matches: {} },
            playoffs: { matches: {}, semifinals: [], grandFinal: null, thirdPlace: null },
            series: {},
            champion: null,
            complete: false
        };
    }
    
    // Ensure Swiss structure exists
    if (!state.swiss) {
        state.swiss = { rounds: [], teamStats: {}, matches: {} };
    }
    
    // Ensure Playoffs structure exists (for Bangkok single elimination)
    if (!state.playoffs) {
        state.playoffs = { 
            matches: {}, 
            semifinals: [], 
            grandFinal: null,
            thirdPlace: null
        };
    }

    // --- SWISS STAGE (Weeks 7-9 for Bangkok-style) ---
    // Initialize team stats if first time
    if (Object.keys(state.swiss.teamStats).length === 0) {
        allQualifiedTeams.forEach(teamName => {
            state.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
        });
    }
    
    const activeTeams = allQualifiedTeams.filter(t => !state.swiss.teamStats[t].qualified && !state.swiss.teamStats[t].eliminated);
    
    // Check if the LATEST Swiss round is finished (all matches have a winner)
    if (state.swiss.rounds.length > 0) {
        const latestRound = state.swiss.rounds[state.swiss.rounds.length - 1];
        const allMatchesFinished = latestRound.matches.every(m => {
            const matchData = state.swiss.matches[m.id];
            return matchData && matchData.winner !== null;
        });

        if (!allMatchesFinished) {
            console.log("8-Team Masters: Not all matches in current Swiss round are finished. Skipping generation.");
            return state;
        }
    }

    if (activeTeams.length > 0) {
        const currentSwissRound = state.swiss.rounds.length + 1;
        if (currentSwissRound > 3) {
            console.log("8-Team Masters: All 3 Swiss rounds completed");
        } else {
            console.log(`8-Team Masters: Generating Swiss Round ${currentSwissRound}`);
        }
        
        const roundMatches = [];
        const teamsByScore = {};

        // Group teams by their current Swiss score (wins-losses)
        activeTeams.forEach(t => {
            const score = `${state.swiss.teamStats[t].wins}-${state.swiss.teamStats[t].losses}`;
            if (!teamsByScore[score]) teamsByScore[score] = [];
            teamsByScore[score].push(t);
        });

        // Create matches for each score group
        Object.keys(teamsByScore).forEach(score => {
            let group = teamsByScore[score];
            
            // For Round 1 (0-0), try to avoid same-region matchups
            if (currentSwissRound === 1) {
                // Multiple shuffles for extra randomness
                for (let shuffle = 0; shuffle < 3; shuffle++) {
                    group = group.sort(() => 0.5 - Math.random());
                }
                console.log(`Round 1 teams (shuffled x3): ${group.join(', ')}`);
                const paired = new Set();
                const pairs = [];
                
                // Helper to get region
                const getRegion = (tName) => {
                    const t = teams.find(team => team.name === tName);
                    return t ? t.region : 'Unknown';
                };

                for (let i = 0; i < group.length; i++) {
                    if (paired.has(i)) continue;
                    
                    let bestMatchIndex = -1;
                    const region1 = getRegion(group[i]);
                    
                    // Look for first available opponent from DIFFERENT region
                    for (let j = i + 1; j < group.length; j++) {
                        if (paired.has(j)) continue;
                        if (getRegion(group[j]) !== region1) {
                            bestMatchIndex = j;
                            break;
                        }
                    }
                    
                    // If no different region found, just take the next available (same region fallback)
                    if (bestMatchIndex === -1) {
                        for (let j = i + 1; j < group.length; j++) {
                            if (!paired.has(j)) {
                                bestMatchIndex = j;
                                break;
                            }
                        }
                    }
                    
                    if (bestMatchIndex !== -1) {
                        pairs.push([group[i], group[bestMatchIndex]]);
                        paired.add(i);
                        paired.add(bestMatchIndex);
                    }
                }
                
                // Use the pairs for matchmaking
                pairs.forEach(pair => {
                    const team1 = pair[0];
                    const team2 = pair[1];
                    const matchId = `${prefix}SWISS-R${currentSwissRound}-${team1.replace(/\s+/g, '_')}-vs-${team2.replace(/\s+/g, '_')}`;
                    
                    console.log(`Generating Round 1 matchup (Regional Check): ${team1} vs ${team2}`);
                    
                    // Only create match if it doesn't already exist (preserve existing match data)
                    if (!state.swiss.matches[matchId]) {
                        state.swiss.matches[matchId] = {
                            team1, team2, 
                            winner: null, 
                            loser: null,
                            score: null,
                            playerStats: null
                        };
                    }
                    const existingMatch = state.swiss.matches[matchId];
                    roundMatches.push({ id: matchId, team1, team2, winner: existingMatch.winner, score: existingMatch.score });
                });
                
            } else {
                // Standard random pairing for later rounds
                group = group.sort(() => 0.5 - Math.random());
                for (let i = 0; i < group.length - 1; i += 2) {
                    const team1 = group[i];
                    const team2 = group[i+1];
                    const matchId = `${prefix}SWISS-R${currentSwissRound}-${team1.replace(/\s+/g, '_')}-vs-${team2.replace(/\s+/g, '_')}`;
                    
                    console.log(`Generating matchup for ${team1} vs ${team2}`);
                    
                    // Only create match if it doesn't already exist (preserve existing match data)
                    if (!state.swiss.matches[matchId]) {
                        state.swiss.matches[matchId] = {
                            team1, team2, 
                            winner: null, 
                            loser: null,
                            score: null,
                            playerStats: null
                        };
                    }
                    const existingMatch = state.swiss.matches[matchId];
                    roundMatches.push({ id: matchId, team1, team2, winner: existingMatch.winner, score: existingMatch.score });
                }
            }
        });

        state.swiss.rounds.push({ round: currentSwissRound, matches: roundMatches });
    }

    // Check if Swiss is complete (3 rounds finished)
    if (state.swiss.rounds.length >= 3) {
        const allRoundsFinished = state.swiss.rounds.every(r => 
            r.matches.every(m => state.swiss.matches[m.id]?.winner !== null)
        );
        
        if (allRoundsFinished) {
            // Mark qualified teams (top 4 by wins)
            const teamArray = allQualifiedTeams.map(team => ({
                name: team,
                ...state.swiss.teamStats[team]
            }));
            teamArray.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
            
            // Top 4 qualify
            teamArray.slice(0, 4).forEach(t => {
                state.swiss.teamStats[t.name].qualified = true;
            });
            // Bottom 4 eliminated
            teamArray.slice(4).forEach(t => {
                state.swiss.teamStats[t.name].eliminated = true;
            });
            
            console.log("8-Team Masters: Swiss Stage complete, top 4 qualified for playoffs");
        }
    }

    // --- PLAYOFFS (Weeks 10-11 for Bangkok-style) ---
    const playoffWeeks = currentWeek >= 10 && currentWeek <= 11;
    const qualifiedTeams = allQualifiedTeams.filter(t => state.swiss.teamStats[t]?.qualified);
    
    if (playoffWeeks && qualifiedTeams.length >= 4) {
        // Ensure semifinals array exists
        if (!state.playoffs.semifinals) state.playoffs.semifinals = [];
        
        const existingMatchesCount = state.playoffs.semifinals.length;
        
        const shouldGenerateBracket = existingMatchesCount === 0;
        
        if (shouldGenerateBracket) {
            console.log("8-Team Masters: Generating single-elimination playoff bracket");
            
            // Top 4 from Swiss
            const top4 = [...qualifiedTeams].slice(0, 4);
            
            // Create semifinals (2 matches)
            for (let i = 0; i < 2; i++) {
                const team1 = top4[i * 2];
                const team2 = top4[i * 2 + 1];
                const matchId = `${prefix}PLAYOFF-SF${i + 1}`;
                
                state.playoffs.matches[matchId] = {
                    team1, team2,
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'semifinal', round: 'semifinal',
                    note: 'Semifinal'
                };
                
                state.playoffs.semifinals.push(matchId);
                console.log(`Created Semifinal ${i + 1}: ${team1} vs ${team2}`);
            }
            
            // Create Grand Final placeholder
            const finalId = `${prefix}PLAYOFF-GF`;
            state.playoffs.matches[finalId] = {
                team1: 'TBD', team2: 'TBD',
                winner: null, loser: null,
                score: null, playerStats: null,
                bracket: 'final', round: 'final',
                note: 'Grand Final'
            };
            state.playoffs.grandFinal = finalId;
            
            // Create 3rd Place Match placeholder
            const thirdPlaceId = `${prefix}PLAYOFF-3RD`;
            state.playoffs.matches[thirdPlaceId] = {
                team1: 'TBD', team2: 'TBD',
                winner: null, loser: null,
                score: null, playerStats: null,
                bracket: 'consolation', round: 'final',
                note: '3rd Place Match'
            };
            state.playoffs.thirdPlace = thirdPlaceId;
            
            console.log("8-Team Masters: Playoff bracket created");
        }
        
        // Check if semifinals are done and update finals
        const sf1 = state.playoffs.matches[`${prefix}PLAYOFF-SF1`];
        const sf2 = state.playoffs.matches[`${prefix}PLAYOFF-SF2`];
        
        if (sf1?.winner && sf2?.winner) {
            // Update Grand Final
            const gf = state.playoffs.matches[state.playoffs.grandFinal];
            if (gf && gf.team1 === 'TBD') {
                gf.team1 = sf1.winner;
                gf.team2 = sf2.winner;
                console.log(`Grand Final set: ${gf.team1} vs ${gf.team2}`);
            }
            
            // Update 3rd Place Match
            const tp = state.playoffs.matches[state.playoffs.thirdPlace];
            if (tp && tp.team1 === 'TBD') {
                tp.team1 = sf1.loser;
                tp.team2 = sf2.loser;
                console.log(`3rd Place set: ${tp.team1} vs ${tp.team2}`);
            }
        }
        
        // Check for tournament completion
        const gfMatch = state.playoffs.matches[state.playoffs.grandFinal];
        const tpMatch = state.playoffs.matches[state.playoffs.thirdPlace];
        
        if (gfMatch?.winner && tpMatch?.winner) {
            state.champion = gfMatch.winner;
            state.complete = true;
            console.log(`8-Team Masters complete! Champion: ${gfMatch.winner}`);
        }
    }

    return state;
}
