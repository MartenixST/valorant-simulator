
import { teams } from '../../../teams.js';
import { Player, Team, MatchSimulator } from '../../../simulation.js';

/**
 * Automates one step of the Masters Tokyo tournament.
 * Structure:
 * - 4 High Seeds (Direct to Playoffs)
 * - 8 Low Seeds (Swiss Stage) -> Top 4 advance to Playoffs
 * - Playoffs: 8 Teams Double Elimination
 */
export function automateMastersTokyo(highSeeds, lowSeeds, savePlayers, simulateMatchFn, currentState = null, playerTeamName = null) {
    let highSeedNames = [];
    let lowSeedNames = [];

    // If state exists, we can skip initial validation of seeds
    if (!currentState) {
        // Validate inputs
        highSeedNames = (highSeeds || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
        lowSeedNames = (lowSeeds || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);

        if (highSeedNames.length !== 4 || lowSeedNames.length !== 8) {
            console.warn("Masters Tokyo requires exactly 4 High Seeds and 8 Low Seeds.", { high: highSeedNames.length, low: lowSeedNames.length });
            // return null; 
        }
    } else {
        // Recover names from state config if needed
        highSeedNames = currentState.config.highSeeds;
        lowSeedNames = currentState.config.lowSeeds;
    }

    const state = currentState || {
        config: {
            highSeeds: highSeedNames,
            lowSeeds: lowSeedNames
        },
        swiss: {
            rounds: [],
            teamStats: {},
            matches: {}
        },
        playoffs: {
            teams: [], // Will be filled with High Seeds + Swiss Qualifiers
            upper: {
                quarterfinals: [],
                semifinals: [],
                final: null
            },
            lower: {
                r1: [],
                r2: [],
                r3: [],
                final: null
            },
            grandFinal: null,
            matches: {}
        },
        complete: false,
        dirty: false
    };

    // --- SWISS STAGE ---
    // Initialize stats if needed
    lowSeedNames.forEach(teamName => {
        if (!state.swiss.teamStats[teamName]) {
            state.swiss.teamStats[teamName] = { wins: 0, losses: 0, qualified: false, eliminated: false };
        }
    });

    const swissQualifiers = lowSeedNames.filter(t => state.swiss.teamStats[t].qualified);
    const swissEliminated = lowSeedNames.filter(t => state.swiss.teamStats[t].eliminated);
    const swissActive = lowSeedNames.filter(t => !state.swiss.teamStats[t].qualified && !state.swiss.teamStats[t].eliminated);

    // Check if Swiss is done (4 qualified)
    const swissComplete = swissQualifiers.length === 4;

    if (!swissComplete) {
        // Check if latest round matches are finished
        if (state.swiss.rounds.length > 0) {
            const latestRound = state.swiss.rounds[state.swiss.rounds.length - 1];
            const allFinished = latestRound.matches.every(m => {
                const matchData = state.swiss.matches[m.id];
                return matchData && matchData.winner;
            });

            if (!allFinished) {
                console.log("Masters Tokyo: Swiss round in progress.");
                return state;
            }
            
            // Update stats from latest round if not already done
            // (Assumed updated externally, but safety check?)
            // We rely on the simulation updating the match winner in state.swiss.matches
            // We need to re-calculate stats to be sure
             lowSeedNames.forEach(t => {
                let wins = 0;
                let losses = 0;
                state.swiss.rounds.forEach(r => {
                    r.matches.forEach(m => {
                        const matchData = state.swiss.matches[m.id];
                        if (matchData && matchData.winner) {
                            if (matchData.winner === t) wins++;
                            if (matchData.loser === t) losses++;
                        }
                    });
                });
                
                state.swiss.teamStats[t].wins = wins;
                state.swiss.teamStats[t].losses = losses;
                state.swiss.teamStats[t].qualified = wins >= 2;
                state.swiss.teamStats[t].eliminated = losses >= 2;
            });
        }

        // Re-check completion after stats update
        const currentQualifiers = lowSeedNames.filter(t => state.swiss.teamStats[t].qualified);
        if (currentQualifiers.length === 4) {
            console.log("Masters Tokyo: Swiss Stage Complete!");
            // Update local variable so Playoff block can run
            swissQualifiers.length = 0; 
            swissQualifiers.push(...currentQualifiers);
        } else {
            // Generate Next Swiss Round
            const roundNum = state.swiss.rounds.length + 1;
            const roundMatches = [];
            
            // Get all active teams
            const currentActive = lowSeedNames.filter(t => !state.swiss.teamStats[t].qualified && !state.swiss.teamStats[t].eliminated);
            
            if (currentActive.length > 0) {
                // Sort by Wins (descending), then random
                currentActive.sort((a, b) => {
                    const statsA = state.swiss.teamStats[a];
                    const statsB = state.swiss.teamStats[b];
                    if (statsA.wins !== statsB.wins) return statsB.wins - statsA.wins;
                    return 0.5 - Math.random();
                });

                // Pair 1 vs 2, 3 vs 4, etc.
                for (let i = 0; i < currentActive.length - 1; i += 2) {
                    const t1 = currentActive[i];
                    const t2 = currentActive[i+1];
                    const matchId = `M-TOKYO-SWISS-R${roundNum}-${t1.replace(/\s+/g, '_')}-vs-${t2.replace(/\s+/g, '_')}`;
                    
                    state.swiss.matches[matchId] = {
                        team1: t1, team2: t2,
                        winner: null, loser: null, score: null, playerStats: null
                    };
                    roundMatches.push({ id: matchId, team1: t1, team2: t2 });
                }

                state.swiss.rounds.push({ round: roundNum, matches: roundMatches });
                return state;
            }
        }
    }

    // --- PLAYOFFS (Double Elimination) ---
    // High Seeds (4) + Swiss Qualifiers (4) = 8 Teams
    if (swissQualifiers.length === 4 && state.playoffs.upper.quarterfinals.length === 0) {
        console.log("Masters Tokyo: Generating Playoff Bracket...");
        
        const playoffTeams = [...highSeedNames, ...swissQualifiers];
        state.playoffs.teams = playoffTeams;

        // Seed: High Seeds vs Swiss Qualifiers
        // Randomly pair HS with SQ
        const shuffledHS = [...highSeedNames].sort(() => 0.5 - Math.random());
        const shuffledSQ = [...swissQualifiers].sort(() => 0.5 - Math.random());

        const qfMatches = [];
        for (let i = 0; i < 4; i++) {
            const t1 = shuffledHS[i];
            const t2 = shuffledSQ[i];
            const matchId = `M-TOKYO-PO-UB-QF${i+1}`;
            
            state.playoffs.matches[matchId] = {
                team1: t1, team2: t2,
                winner: null, loser: null, score: null
            };
            qfMatches.push(matchId);
        }
        state.playoffs.upper.quarterfinals = qfMatches;
        
        // Initialize other bracket slots
        state.playoffs.upper.semifinals = ['M-TOKYO-PO-UB-SF1', 'M-TOKYO-PO-UB-SF2'];
        state.playoffs.upper.final = 'M-TOKYO-PO-UB-F';
        
        state.playoffs.lower.r1 = ['M-TOKYO-PO-LB-R1-M1', 'M-TOKYO-PO-LB-R1-M2'];
        state.playoffs.lower.r2 = ['M-TOKYO-PO-LB-R2-M1', 'M-TOKYO-PO-LB-R2-M2'];
        state.playoffs.lower.r3 = 'M-TOKYO-PO-LB-R3';
        state.playoffs.lower.final = 'M-TOKYO-PO-LB-F';
        
        state.playoffs.grandFinal = 'M-TOKYO-PO-GF';

        // Pre-create empty match objects for structure
        [...state.playoffs.upper.semifinals, state.playoffs.upper.final, 
         ...state.playoffs.lower.r1, ...state.playoffs.lower.r2, state.playoffs.lower.r3, state.playoffs.lower.final,
         state.playoffs.grandFinal].forEach(mid => {
             state.playoffs.matches[mid] = {
                 team1: 'TBD', team2: 'TBD',
                 winner: null, loser: null, score: null
             };
         });

        return state;
    }

    // --- PLAYOFF PROGRESSION ---
    if (state.playoffs.upper.quarterfinals.length > 0) {
        const getMatch = (id) => state.playoffs.matches[id];
        
        // Helper to advance winner/loser
        const advance = (targetId, sourceId1, sourceId2, useLoser1 = false, useLoser2 = false) => {
            const target = getMatch(targetId);
            const m1 = getMatch(sourceId1);
            const m2 = getMatch(sourceId2); // Can be null if only 1 source

            if (!target || !m1) return;

            // Update Team 1
            if (target.team1 === 'TBD' && m1) {
                if (useLoser1 && m1.loser) target.team1 = m1.loser;
                else if (!useLoser1 && m1.winner) target.team1 = m1.winner;
            }

            // Update Team 2
            if (target.team2 === 'TBD' && m2) {
                if (useLoser2 && m2.loser) target.team2 = m2.loser;
                else if (!useLoser2 && m2.winner) target.team2 = m2.winner;
            }
        };

        const ub = state.playoffs.upper;
        const lb = state.playoffs.lower;

        // UB Semis (Winners of QF)
        advance(ub.semifinals[0], ub.quarterfinals[0], ub.quarterfinals[1]);
        advance(ub.semifinals[1], ub.quarterfinals[2], ub.quarterfinals[3]);

        // LB R1 (Losers of QF)
        advance(lb.r1[0], ub.quarterfinals[0], ub.quarterfinals[1], true, true);
        advance(lb.r1[1], ub.quarterfinals[2], ub.quarterfinals[3], true, true);

        // UB Final (Winners of SF)
        advance(ub.final, ub.semifinals[0], ub.semifinals[1]);

        // LB R2 (Losers of SF vs Winners of LB R1)
        // Cross grouping is common but let's keep simple for now
        advance(lb.r2[0], ub.semifinals[1], lb.r1[0], true, false); 
        advance(lb.r2[1], ub.semifinals[0], lb.r1[1], true, false);

        // LB R3 (Winners of LB R2)
        advance(lb.r3, lb.r2[0], lb.r2[1]);

        // LB Final (Loser of UB Final vs Winner of LB R3)
        advance(lb.final, ub.final, lb.r3, true, false);

        // Grand Final (Winner of UB Final vs Winner of LB Final)
        advance(state.playoffs.grandFinal, ub.final, lb.final);

        // Check Completion
        const gf = getMatch(state.playoffs.grandFinal);
        if (gf && gf.winner) {
            state.complete = true;
        }
    }

    return state;
}
