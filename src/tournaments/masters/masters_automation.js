import { teams } from '../../teams.js';
import { Player, Team, MatchSimulator } from '../../simulation.js';

/**
 * Automates one step of the Masters Bangkok tournament.
 * If Swiss is not complete, simulates one Swiss round.
 * If Swiss is complete but Playoffs are not, simulates one Playoff round.
 * @param {string} prefix - Optional prefix for match IDs (e.g., 'M-TOKYO-' for Tokyo, 'M-' for Bangkok)
 */
export function automateMastersTournament(qualifiedTeamsRaw, savePlayers, simulateMatchFn, currentState = null, playerTeamName = null, prefix = 'M-', currentWeek = null) {
    if (!qualifiedTeamsRaw || qualifiedTeamsRaw.length < 8) return null;

    // Sanitize qualifiedTeams to ensure they are strings (team names)
    const allQualifiedTeams = qualifiedTeamsRaw.map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
    if (allQualifiedTeams.length < 8) return null;

    // Ensure state has correct structure (handles both new and existing states)
    const state = currentState || {};
    
    // Get regional seeds (4 regional champions who bypass Swiss Stage)
    let regionalSeeds = state.playoffs?.regionalSeeds || {};
    
    // FALLBACK: If no seeds set yet, try to extract from all qualified teams data
    if (Object.keys(regionalSeeds).length < 4) {
        const teamsByRegion = {};
        allQualifiedTeams.forEach(teamName => {
            const teamData = teams.find(t => t.name === teamName);
            if (teamData && teamData.region) {
                if (!teamsByRegion[teamData.region]) teamsByRegion[teamData.region] = [];
                teamsByRegion[teamData.region].push({ name: teamName, ...teamData });
            }
        });
        
        Object.keys(teamsByRegion).forEach(region => {
            if (!regionalSeeds[region]) {
                const sorted = teamsByRegion[region].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
                if (sorted.length > 0) {
                    regionalSeeds[region] = sorted[0].name;
                }
            }
        });
    }
    
    // Filter out regional seeds from Swiss Stage teams (TOKYO ONLY)
    // Regional champions go straight to playoffs, they don't play Swiss Stage
    // Bangkok uses traditional 8-team Swiss format
    const isTokyo = prefix.includes('TOKYO');
    const seedTeamNames = isTokyo ? Object.values(regionalSeeds).filter(Boolean) : [];
    const swissTeams = isTokyo ? allQualifiedTeams.filter(t => !seedTeamNames.includes(t)) : allQualifiedTeams;
    
    // For Swiss Stage, use appropriate teams (4 for Tokyo, 8 for Bangkok)
    let qualifiedTeams = swissTeams;
    
    if (isTokyo) {
        console.log(`Masters Tokyo: ${allQualifiedTeams.length} total teams, ${seedTeamNames.length} regional seeds, ${swissTeams.length} Swiss Stage teams`);
        console.log(`Regional seeds:`, seedTeamNames);
        console.log(`Swiss teams:`, swissTeams);
    } else {
        console.log(`Masters Bangkok: ${allQualifiedTeams.length} teams in Swiss Stage`);
    }
    
    // Initialize Swiss structure
    if (!state.swiss) {
        state.swiss = {
            rounds: [],
            teamStats: {},
            matches: {}
        };
    }
    
    // CLEANUP: Remove any #1 seeds that were incorrectly added to Swiss teamStats (TOKYO ONLY)
    if (isTokyo) {
        seedTeamNames.forEach(seedTeam => {
            if (state.swiss.teamStats[seedTeam]) {
                console.log(`Removing ${seedTeam} from Swiss teamStats (they are a #1 seed)`);
                delete state.swiss.teamStats[seedTeam];
            }
        });
    }
    
    // Initialize Playoffs structure (critical for double elimination)
    if (!state.playoffs) {
        state.playoffs = {
            upper: { round1: [], round2: [], final: null },
            lower: { round1: [], round2: [], final: null },
            grandFinal: null,
            matches: {},
            regionalSeeds: {}
        };
    } else {
        // Ensure existing playoffs has correct structure
        if (!state.playoffs.upper) state.playoffs.upper = { round1: [], round2: [], final: null };
        if (!state.playoffs.lower) state.playoffs.lower = { round1: [], round2: [], final: null };
        if (!state.playoffs.matches) state.playoffs.matches = {};
        if (!state.playoffs.regionalSeeds) state.playoffs.regionalSeeds = {};
    }
    
    if (!state.messages) state.messages = [];
    if (state.complete === undefined) state.complete = false;
    if (state.dirty === undefined) state.dirty = false;

    // Initialize team stats if first time
    if (Object.keys(state.swiss.teamStats).length === 0) {
        qualifiedTeams.forEach(teamName => {
            state.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
        });
    } else {
        // Ensure all currently qualified teams are in teamStats (safety check)
        qualifiedTeams.forEach(teamName => {
            if (!state.swiss.teamStats[teamName]) {
                state.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
            }
        });
    }

    // --- SWISS STAGE ---
    const activeTeams = qualifiedTeams.filter(t => !state.swiss.teamStats[t].qualified && !state.swiss.teamStats[t].eliminated);
    
    // Check if the LATEST Swiss round is finished (all matches have a winner)
    if (state.swiss.rounds.length > 0) {
        const latestRound = state.swiss.rounds[state.swiss.rounds.length - 1];
        const allMatchesFinished = latestRound.matches.every(m => {
            const matchData = state.swiss.matches[m.id];
            return matchData && matchData.winner !== null;
        });

        if (!allMatchesFinished) {
            console.log("Not all matches in the current Swiss round are finished. Skipping generation of next round.");
            return state;
        }
    }

    if (activeTeams.length > 0) {
        const currentSwissRound = state.swiss.rounds.length + 1;
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
                    
                    // ALWAYS skip auto-simulation for ALL teams so user can choose
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
        return state;
    }

    // --- PLAYOFFS (8-Team Double Elimination) ---
    // Tokyo: Top 4 from Swiss join 4 regional #1 seeds
    // Bangkok: Top 8 from Swiss (traditional format)
    const playoffTeams = qualifiedTeams.filter(t => state.swiss.teamStats[t].qualified);
    
    // FALLBACK: Extract regional seeds from Swiss results (TOKYO ONLY)
    if (isTokyo && Object.keys(regionalSeeds).length < 4) {
        console.log("Tokyo - Regional seeds not fully set, extracting from Swiss results...");
        
        // Group ALL qualified teams by region and pick the one with best record
        const teamsByRegion = {};
        allQualifiedTeams.forEach(teamName => {
            const teamData = teams.find(t => t.name === teamName);
            if (teamData && teamData.region) {
                if (!teamsByRegion[teamData.region]) teamsByRegion[teamData.region] = [];
                teamsByRegion[teamData.region].push({
                    name: teamName,
                    wins: state.swiss.teamStats[teamName].wins,
                    losses: state.swiss.teamStats[teamName].losses
                });
            }
        });
        
        // Pick top team from each region
        Object.keys(teamsByRegion).forEach(region => {
            if (!regionalSeeds[region]) {
                // Sort by wins desc, then losses asc
                const sorted = teamsByRegion[region].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
                if (sorted.length > 0) {
                    regionalSeeds[region] = sorted[0].name;
                    console.log(`Auto-set ${region} #1 seed: ${sorted[0].name}`);
                }
            }
        });
        
        // Save the extracted seeds
        state.playoffs.regionalSeeds = regionalSeeds;
    }
    
    // Initialize 8-team double elimination structure
    if (!state.playoffs.upper) {
        state.playoffs.upper = { round1: [], round2: [], final: null };
        state.playoffs.lower = { round1: [], round2: [], final: null };
    }
    
    // GENERATE ENTIRE PLAYOFF BRACKET AT ONCE when Swiss completes (Week 28)
    // This creates all 13 matches with TBD placeholders, allowing full bracket view
    // Playoffs run: Week 28-32 (5 weeks total)
    // Week 28: Play UB R1 (4 matches) - LB R1 visible with TBD
    // Week 29: UB R1 results populate LB R1, play UB R2 (2 matches) + LB R1 (2 matches)
    // Week 30: Play LB R2 (2 matches)
    // Week 31: Play UB Final (1 match) + LB Final (1 match)
    // Week 32: Play Grand Final (1 match)
    
    // Bangkok: Single elimination with top 4 from Swiss (Weeks 10-11)
    // Tokyo: Double elimination with 4 seeds + 4 Swiss (Weeks 28-32)
    const bangkokPlayoffWeeks = currentWeek >= 10 && currentWeek <= 11;
    const tokyoPlayoffWeeks = currentWeek >= 28 && currentWeek <= 32;
    
    console.log(`[DEBUG] Week ${currentWeek}, isTokyo: ${isTokyo}, bangkokPlayoffWeeks: ${bangkokPlayoffWeeks}, tokyoPlayoffWeeks: ${tokyoPlayoffWeeks}`);
    console.log(`[DEBUG] playoffTeams:`, playoffTeams);
    
    // Ensure Bangkok has semifinals array
    if (!isTokyo && !state.playoffs.semifinals) state.playoffs.semifinals = [];
    
    // Tokyo uses upper.round1, Bangkok uses semifinals
    const existingMatchesCount = isTokyo 
        ? state.playoffs.upper.round1.length 
        : (state.playoffs.semifinals?.length || 0);
    console.log(`[DEBUG] existing matches count: ${existingMatchesCount}`);
    
    const shouldGenerateFullBracket = (bangkokPlayoffWeeks || tokyoPlayoffWeeks) && 
                                     existingMatchesCount === 0 && 
                                     playoffTeams.length >= 4;
    
    console.log(`[DEBUG] shouldGenerateFullBracket: ${shouldGenerateFullBracket}`);
    
    if (shouldGenerateFullBracket) {
        // Randomize Swiss qualifiers
        const swissQualifiers = [...playoffTeams].sort(() => 0.5 - Math.random());
        
        // Get regional seeds and randomize their order too (TOKYO ONLY)
        const seedTeams = isTokyo ? Object.values(regionalSeeds).filter(Boolean).sort(() => 0.5 - Math.random()) : [];
        
        if (isTokyo) {
            console.log("Tokyo - Randomized matchups: Seeds", seedTeams, "vs Qualifiers", swissQualifiers);
            
            if (seedTeams.length < 4) {
                console.log("ERROR: Need 4 regional seeds to generate playoff bracket. Have:", seedTeams.length);
                console.log("Regional seeds:", regionalSeeds);
                return state;
            }
        } else {
            console.log("Bangkok - Top 4 Swiss teams for single elimination:", swissQualifiers.slice(0, 4));
            if (swissQualifiers.length < 4) {
                console.log("ERROR: Need 4 Swiss qualifiers for Bangkok playoffs. Have:", swissQualifiers.length);
                return state;
            }
        }
        
        console.log("=== GENERATING PLAYOFF BRACKET ===");
        
        if (isTokyo) {
            // === TOKYO: DOUBLE ELIMINATION (4 seeds vs 4 Swiss) ===
            // === UPPER BRACKET ROUND 1 (4 matches) ===
            for (let i = 0; i < 4; i++) {
                const team1 = seedTeams[i];
                const team2 = swissQualifiers[i];
                const matchId = `${prefix}PLAYOFF-UB-R1-${i+1}`;
                
                if (!team1 || !team2) {
                    console.error(`Missing team for match ${i+1}: seed=${team1}, swiss=${team2}`);
                    continue;
                }
                
                const team1Data = teams.find(t => t.name === team1);
                const region = team1Data?.region || 'Unknown';
                
                if (!state.playoffs.matches[matchId]) {
                    state.playoffs.matches[matchId] = {
                        team1, team2,
                        winner: null, loser: null,
                        score: null, playerStats: null,
                        bracket: 'upper', round: 1,
                        note: `${region} #1 Seed vs Swiss Qualifier`
                    };
                    console.log(`Created UB R1-${i+1}: ${team1} vs ${team2}`);
                }
                state.playoffs.upper.round1.push(matchId);
            }
            
            // === UPPER BRACKET ROUND 2 (2 matches) ===
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-UB-R2-${i+1}`;
                if (!state.playoffs.matches[matchId]) {
                    state.playoffs.matches[matchId] = {
                        team1: 'TBD', team2: 'TBD',
                        winner: null, loser: null,
                        score: null, playerStats: null,
                        bracket: 'upper', round: 2
                    };
                }
                state.playoffs.upper.round2.push(matchId);
            }
            
            // === UPPER BRACKET FINAL ===
            const ubFinalId = `${prefix}PLAYOFF-UB-FINAL`;
            if (!state.playoffs.matches[ubFinalId]) {
                state.playoffs.matches[ubFinalId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'upper', round: 'final'
                };
            }
            state.playoffs.upper.final = ubFinalId;
            
            // === LOWER BRACKET (Double Elimination) ===
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-LB-R1-${i+1}`;
                if (!state.playoffs.matches[matchId]) {
                    state.playoffs.matches[matchId] = {
                        team1: 'TBD', team2: 'TBD',
                        winner: null, loser: null,
                        score: null, playerStats: null,
                        bracket: 'lower', round: 1,
                        note: 'Loser eliminated (5th-8th place)'
                    };
                }
                state.playoffs.lower.round1.push(matchId);
            }
            
            for (let i = 0; i < 2; i++) {
                const matchId = `${prefix}PLAYOFF-LB-R2-${i+1}`;
                if (!state.playoffs.matches[matchId]) {
                    state.playoffs.matches[matchId] = {
                        team1: 'TBD', team2: 'TBD',
                        winner: null, loser: null,
                        score: null, playerStats: null,
                        bracket: 'lower', round: 2,
                        note: 'Loser eliminated (3rd-4th place)'
                    };
                }
                state.playoffs.lower.round2.push(matchId);
            }
            
            const lbFinalId = `${prefix}PLAYOFF-LB-FINAL`;
            if (!state.playoffs.matches[lbFinalId]) {
                state.playoffs.matches[lbFinalId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'lower', round: 'final'
                };
            }
            state.playoffs.lower.final = lbFinalId;
            
        } else {
            // === BANGKOK: SINGLE ELIMINATION (top 4 from Swiss) ===
            const top4 = swissQualifiers.slice(0, 4);
            
            // === SEMIFINALS (2 matches) - Create or update with actual teams ===
            // Bangkok uses M-PLAYOFF-SF1 and M-PLAYOFF-SF2 (no dash before number)
            for (let i = 0; i < 2; i++) {
                const team1 = top4[i * 2];      // 0, 2
                const team2 = top4[i * 2 + 1];  // 1, 3
                const matchId = `${prefix}PLAYOFF-SF${i+1}`;
                
                if (!team1 || !team2) {
                    console.error(`Missing team for semifinal ${i+1}`);
                    continue;
                }
                
                // Create match if it doesn't exist, or update teams if they're TBD
                if (!state.playoffs.matches[matchId]) {
                    state.playoffs.matches[matchId] = {
                        team1, team2,
                        winner: null, loser: null,
                        score: null, playerStats: null,
                        bracket: 'semifinal', round: 'semifinal',
                        note: 'Semifinal'
                    };
                    console.log(`Created SF-${i+1}: ${team1} vs ${team2}`);
                } else if (state.playoffs.matches[matchId].team1 === 'TBD' || 
                           state.playoffs.matches[matchId].team2 === 'TBD') {
                    // Update existing TBD matches with actual teams
                    state.playoffs.matches[matchId].team1 = team1;
                    state.playoffs.matches[matchId].team2 = team2;
                    console.log(`Updated SF-${i+1}: ${team1} vs ${team2}`);
                }
                
                // Add to semifinals array if not already there (Bangkok uses semifinals, not upper.round1)
                if (!state.playoffs.semifinals.includes(matchId)) {
                    state.playoffs.semifinals.push(matchId);
                }
            }
            
            // === GRAND FINAL ===
            const finalId = `${prefix}PLAYOFF-GF`;
            if (!state.playoffs.matches[finalId]) {
                state.playoffs.matches[finalId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'final', round: 'final',
                    note: 'Grand Final'
                };
                console.log(`Created Grand Final`);
            }
            state.playoffs.grandFinal = finalId;
            
            // === 3RD PLACE MATCH ===
            const thirdPlaceId = `${prefix}PLAYOFF-3RD`;
            if (!state.playoffs.matches[thirdPlaceId]) {
                state.playoffs.matches[thirdPlaceId] = {
                    team1: 'TBD', team2: 'TBD',
                    winner: null, loser: null,
                    score: null, playerStats: null,
                    bracket: 'consolation', round: 'final',
                    note: '3rd Place Match'
                };
                console.log(`Created 3rd Place Match`);
            }
            state.playoffs.thirdPlace = thirdPlaceId;
        }
        
        console.log(`=== FULL BRACKET CREATED ===`);
        return state;
    }
    
    // === BANGKOK: UPDATE EXISTING TBD MATCHES WITH ACTUAL TEAMS ===
    // This runs when bracket already exists but has TBD teams that need actual teams
    // Ensure semifinals array exists
    if (!state.playoffs.semifinals) state.playoffs.semifinals = [];
    
    console.log(`[DEBUG] Checking Bangkok TBD update: !isTokyo=${!isTokyo}, bangkokPlayoffWeeks=${bangkokPlayoffWeeks}, semifinals.length=${state.playoffs.semifinals.length}`);
    
    if (!isTokyo && bangkokPlayoffWeeks && state.playoffs.semifinals.length > 0) {
        const top4 = playoffTeams.slice(0, 4);
        console.log(`[DEBUG] Bangkok TBD update - top4:`, top4);
        
        if (top4.length >= 4) {
            console.log("[DEBUG] Bangkok - Checking for TBD matches to update...");
            console.log(`[DEBUG] Current matches:`, Object.keys(state.playoffs.matches));
            
            // Update semifinals if they have TBD teams
            // Bangkok uses M-PLAYOFF-SF1 and M-PLAYOFF-SF2 (no dash before number)
            for (let i = 0; i < 2; i++) {
                const team1 = top4[i * 2];
                const team2 = top4[i * 2 + 1];
                const matchId = `${prefix}PLAYOFF-SF${i+1}`;
                
                console.log(`[DEBUG] Checking match ${matchId}: exists=${!!state.playoffs.matches[matchId]}`);
                
                if (state.playoffs.matches[matchId]) {
                    const match = state.playoffs.matches[matchId];
                    console.log(`[DEBUG] Match ${matchId} teams: ${match.team1} vs ${match.team2}`);
                    if (match.team1 === 'TBD' || match.team2 === 'TBD') {
                        match.team1 = team1;
                        match.team2 = team2;
                        console.log(`[DEBUG] Updated SF-${i+1}: ${team1} vs ${team2}`);
                    } else {
                        console.log(`[DEBUG] Match ${matchId} already has real teams, skipping`);
                    }
                }
            }
        } else {
            console.log(`[DEBUG] ERROR: Need 4 playoff teams, only have ${top4.length}`);
        }
    } else {
        console.log(`[DEBUG] Bangkok TBD update skipped - conditions not met`);
    }
    
    // === UPDATE BRACKET WITH ACTUAL TEAMS AS MATCHES COMPLETE ===
    // This happens every week to populate TBD slots with actual winners/losers
    
    if (currentWeek >= 29 && state.playoffs.upper.round1.length === 4) {
        const ubR1Matches = state.playoffs.upper.round1.map(id => state.playoffs.matches[id]);
        
        // Update UB R2 with winners from UB R1
        if (state.playoffs.upper.round2.length === 2) {
            for (let i = 0; i < 2; i++) {
                const m1 = ubR1Matches[i * 2];
                const m2 = ubR1Matches[i * 2 + 1];
                const matchId = state.playoffs.upper.round2[i];
                
                if (m1?.winner && m2?.winner) {
                    state.playoffs.matches[matchId].team1 = m1.winner;
                    state.playoffs.matches[matchId].team2 = m2.winner;
                    console.log(`Updated UB R2-${i+1}: ${m1.winner} vs ${m2.winner}`);
                }
            }
        }
        
        // Update LB R1 with losers from UB R1
        if (state.playoffs.lower.round1.length === 2) {
            for (let i = 0; i < 2; i++) {
                const m1 = ubR1Matches[i * 2];
                const m2 = ubR1Matches[i * 2 + 1];
                const matchId = state.playoffs.lower.round1[i];
                
                if (m1?.loser && m2?.loser) {
                    state.playoffs.matches[matchId].team1 = m1.loser;
                    state.playoffs.matches[matchId].team2 = m2.loser;
                    console.log(`Updated LB R1-${i+1}: ${m1.loser} vs ${m2.loser}`);
                }
            }
        }
    }
    
    if (currentWeek >= 30 && state.playoffs.upper.round2.length === 2 && state.playoffs.lower.round1.length === 2) {
        const ubR2Matches = state.playoffs.upper.round2.map(id => state.playoffs.matches[id]);
        const lbR1Matches = state.playoffs.lower.round1.map(id => state.playoffs.matches[id]);
        
        // Update LB R2 with LB R1 winners vs UB R2 losers
        if (state.playoffs.lower.round2.length === 2) {
            for (let i = 0; i < 2; i++) {
                const lbWinner = lbR1Matches[i]?.winner;
                const ubLoser = ubR2Matches[i]?.loser;
                const matchId = state.playoffs.lower.round2[i];
                
                if (lbWinner && ubLoser) {
                    state.playoffs.matches[matchId].team1 = lbWinner;
                    state.playoffs.matches[matchId].team2 = ubLoser;
                    console.log(`Updated LB R2-${i+1}: ${lbWinner} vs ${ubLoser}`);
                }
            }
        }
    }
    
    if (currentWeek >= 31 && state.playoffs.upper.round2.length === 2) {
        const ubR2Matches = state.playoffs.upper.round2.map(id => state.playoffs.matches[id]);
        
        // Update UB Final with UB R2 winners
        if (ubR2Matches[0]?.winner && ubR2Matches[1]?.winner) {
            state.playoffs.matches[state.playoffs.upper.final].team1 = ubR2Matches[0].winner;
            state.playoffs.matches[state.playoffs.upper.final].team2 = ubR2Matches[1].winner;
            console.log(`Updated UB Final: ${ubR2Matches[0].winner} vs ${ubR2Matches[1].winner}`);
        }
    }
    
    if (currentWeek >= 31 && state.playoffs.lower.round2.length === 2) {
        const lbR2Matches = state.playoffs.lower.round2.map(id => state.playoffs.matches[id]);
        
        // Update LB Final with LB R2 winners
        if (lbR2Matches[0]?.winner && lbR2Matches[1]?.winner) {
            state.playoffs.matches[state.playoffs.lower.final].team1 = lbR2Matches[0].winner;
            state.playoffs.matches[state.playoffs.lower.final].team2 = lbR2Matches[1].winner;
            console.log(`Updated LB Final: ${lbR2Matches[0].winner} vs ${lbR2Matches[1].winner}`);
        }
    }
    
    if (currentWeek >= 32 && state.playoffs.upper.final && state.playoffs.lower.final) {
        const ubFinal = state.playoffs.matches[state.playoffs.upper.final];
        const lbFinal = state.playoffs.matches[state.playoffs.lower.final];
        
        // Update Grand Final with bracket finalists
        if (ubFinal?.winner && lbFinal?.winner) {
            state.playoffs.matches[state.playoffs.grandFinal].team1 = ubFinal.winner;
            state.playoffs.matches[state.playoffs.grandFinal].team2 = lbFinal.winner;
            console.log(`Updated Grand Final: ${ubFinal.winner} vs ${lbFinal.winner}`);
        }
    }
    
    // Check if tournament is complete
    if (state.playoffs.grandFinal) {
        const gfMatch = state.playoffs.matches[state.playoffs.grandFinal];
        if (gfMatch?.winner) {
            // Check if this is the first Grand Final (not a reset match)
            const isFirstGF = !gfMatch.bracketResetPlayed && !state.playoffs.grandFinal.includes('RESET');
            
            if (isFirstGF) {
                // Get the UB winner to check if bracket reset is needed
                const ubWinner = state.playoffs.matches[state.playoffs.upper.final]?.winner;
                const lbWinner = state.playoffs.matches[state.playoffs.lower.final]?.winner;
                
                // If LB winner beat UB winner, bracket reset is required
                if (gfMatch.winner === lbWinner && lbWinner !== ubWinner) {
                    console.log(`Bracket reset required! ${lbWinner} (LB) beat ${ubWinner} (UB) in first GF`);
                    
                    // Mark first GF as having had reset played
                    gfMatch.bracketResetPlayed = true;
                    
                    // Generate bracket reset match
                    const resetMatchId = `${prefix}PLAYOFF-GF-RESET`;
                    if (!state.playoffs.matches[resetMatchId]) {
                        state.playoffs.matches[resetMatchId] = {
                            team1: ubWinner, team2: lbWinner,
                            winner: null, loser: null,
                            score: null, playerStats: null,
                            bracket: 'grand', round: 'final-reset',
                            note: 'Bracket Reset - UB winner gets second chance'
                        };
                        state.playoffs.grandFinal = resetMatchId; // Update to point to reset match
                        state.playoffs.firstGrandFinal = gfMatch.id || state.playoffs.grandFinal; // Store first GF reference
                        console.log(`Created bracket reset match: ${ubWinner} vs ${lbWinner}`);
                        return state;
                    }
                } else {
                    // UB winner won first GF, no reset needed
                    state.complete = true;
                    console.log(`Masters tournament complete! Champion: ${gfMatch.winner} (no reset needed)`);
                }
            } else {
                // This is the reset match and it has a winner - tournament is complete
                state.complete = true;
                console.log(`Masters tournament complete after bracket reset! Champion: ${gfMatch.winner}`);
            }
        }
    }

    return state;
}

function getSafeTeamByName(name, players) {
    const teamData = teams.find(t => t.name === name);
    if (!teamData) return { name, id: 'unknown' };
    return teamData;
}

/**
 * Sets the 4 regional #1 seeds for the Masters tournament playoffs.
 * These seeds join the 4 Swiss qualifiers in the 8-team double elimination bracket.
 * @param {Object} state - The tournament state
 * @param {Object} seeds - { Americas: teamName, EMEA: teamName, Pacific: teamName, China: teamName }
 */
export function setMastersRegionalSeeds(state, seeds) {
    if (!state.playoffs) state.playoffs = {};
    state.playoffs.regionalSeeds = seeds;
    console.log("Regional seeds set for Masters:", seeds);
}

/**
 * Awards MVP trophy for the Masters tournament.
 * Call this when the tournament is complete.
 */
export function awardMastersMVP(state, savePlayers, season = 1) {
    if (!state || !state.complete) return;
    
    // Check if MVP was already awarded
    if (state.mvpAwarded) return;
    state.mvpAwarded = true;
    
    // Collect all player stats from all matches
    const playerStats = {};
    
    // Swiss stage matches
    if (state.swiss?.matches) {
        Object.values(state.swiss.matches).forEach(match => {
            if (match.playerStats) {
                Object.entries(match.playerStats).forEach(([playerId, stats]) => {
                    if (!playerStats[playerId]) {
                        playerStats[playerId] = {
                            name: stats.name,
                            teamName: stats.teamName,
                            kills: 0,
                            deaths: 0,
                            assists: 0,
                            damage: 0,
                            maps: 0
                        };
                    }
                    playerStats[playerId].kills += stats.kills || 0;
                    playerStats[playerId].deaths += stats.deaths || 0;
                    playerStats[playerId].assists += stats.assists || 0;
                    playerStats[playerId].damage += stats.damage || stats.damageDealt || 0;
                    playerStats[playerId].maps += 1;
                });
            }
        });
    }
    
    // Playoff matches
    if (state.playoffs?.matches) {
        Object.values(state.playoffs.matches).forEach(match => {
            if (match.playerStats) {
                Object.entries(match.playerStats).forEach(([playerId, stats]) => {
                    if (!playerStats[playerId]) {
                        playerStats[playerId] = {
                            name: stats.name,
                            teamName: stats.teamName,
                            kills: 0,
                            deaths: 0,
                            assists: 0,
                            damage: 0,
                            maps: 0
                        };
                    }
                    playerStats[playerId].kills += stats.kills || 0;
                    playerStats[playerId].deaths += stats.deaths || 0;
                    playerStats[playerId].assists += stats.assists || 0;
                    playerStats[playerId].damage += stats.damage || stats.damageDealt || 0;
                    playerStats[playerId].maps += 1;
                });
            }
        });
    }
    
    // Calculate performance score for each player
    let bestPlayer = null;
    let bestScore = 0;
    
    Object.entries(playerStats).forEach(([playerId, stats]) => {
        if (stats.maps === 0) return;
        
        const kpr = stats.kills / stats.maps;
        const kd = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
        const adr = stats.damage / stats.maps / 100;
        
        // Performance score
        const score = (kpr * 10) + (kd * 15) + (adr * 5);
        
        if (score > bestScore) {
            bestScore = score;
            bestPlayer = {
                id: playerId,
                name: stats.name,
                teamName: stats.teamName,
                stats: stats,
                score: score
            };
        }
    });
    
    if (bestPlayer) {
        // Find the player in savePlayers
        const player = savePlayers.find(p => String(p.id) === String(bestPlayer.id) || p.name === bestPlayer.name);
        if (player) {
            // Initialize trophies array if not exists
            if (!player.trophies) player.trophies = [];
            
            // Add MVP trophy
            player.trophies.push({
                type: 'Masters MVP',
                region: 'International',
                team: bestPlayer.teamName,
                season: season,
                stats: {
                    kills: bestPlayer.stats.kills,
                    deaths: bestPlayer.stats.deaths,
                    assists: bestPlayer.stats.assists,
                    kpr: (bestPlayer.stats.kills / bestPlayer.stats.maps).toFixed(2),
                    kd: (bestPlayer.stats.deaths > 0 ? bestPlayer.stats.kills / bestPlayer.stats.deaths : bestPlayer.stats.kills).toFixed(2)
                },
                date: new Date().toISOString()
            });
            
            console.log(`Awarded Masters MVP to ${player.name} (${bestPlayer.teamName}) - K/D: ${(bestPlayer.stats.kills/bestPlayer.stats.deaths).toFixed(2)}, Kills: ${bestPlayer.stats.kills}`);
        }
    }
}
