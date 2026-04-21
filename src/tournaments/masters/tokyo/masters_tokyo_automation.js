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
    console.log(`automateMastersTokyo called - Week ${currentState?.currentWeek}, simulateMatchFn=${!!simulateMatchFn}`);
    
    let highSeedNames = [];
    let lowSeedNames = [];

    // If state exists, we can skip initial validation of seeds
    if (!currentState) {
        // Validate inputs
        highSeedNames = (highSeeds || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
        lowSeedNames = (lowSeeds || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);

        if (highSeedNames.length !== 4 || lowSeedNames.length !== 8) {
            console.warn("Masters Tokyo requires exactly 4 High Seeds and 8 Low Seeds.", { high: highSeedNames.length, low: lowSeedNames.length });
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
            teams: [],
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
        // ALWAYS recalculate stats first
        if (state.swiss.rounds.length > 0) {
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

        // Check completion after recalc
        if (swissQualifiers.length === 4) {
            state.swiss.complete = true;
        }

        return state;
    }

    // --- PLAYOFFS ---
    if (swissComplete && state.playoffs.upper.quarterfinals.length === 0) {
        console.log("Masters Tokyo: Initializing Playoffs...");
        
        // 4 High Seeds + 4 Swiss Qualifiers = 8 Teams
        const playoffTeams = [...highSeedNames, ...swissQualifiers];
        state.playoffs.teams = playoffTeams;

        // Initialize Bracket Structure
        // UB Quarterfinals: 4 matches (High Seeds vs Swiss Qualifiers)
        state.playoffs.upper.quarterfinals = [
            'M-TOKYO-PO-UB-QF-1', 'M-TOKYO-PO-UB-QF-2',
            'M-TOKYO-PO-UB-QF-3', 'M-TOKYO-PO-UB-QF-4'
        ];
        
        // Create QF match objects with teams
        state.playoffs.matches['M-TOKYO-PO-UB-QF-1'] = { team1: highSeedNames[0], team2: swissQualifiers[0], bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-UB-QF-2'] = { team1: highSeedNames[1], team2: swissQualifiers[1], bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-UB-QF-3'] = { team1: highSeedNames[2], team2: swissQualifiers[2], bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-UB-QF-4'] = { team1: highSeedNames[3], team2: swissQualifiers[3], bestOf: 3 };

        // UB Semifinals (initially TBD)
        state.playoffs.upper.semifinals = [
            'M-TOKYO-PO-UB-SF-1', 'M-TOKYO-PO-UB-SF-2'
        ];
        state.playoffs.matches['M-TOKYO-PO-UB-SF-1'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-UB-SF-2'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // UB Final
        state.playoffs.upper.final = 'M-TOKYO-PO-UB-FINAL';
        state.playoffs.matches['M-TOKYO-PO-UB-FINAL'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // LB Round 1 (4 teams, 2 matches - losers of QF)
        state.playoffs.lower.r1 = ['M-TOKYO-PO-LB-R1-1', 'M-TOKYO-PO-LB-R1-2'];
        state.playoffs.matches['M-TOKYO-PO-LB-R1-1'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-LB-R1-2'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // LB Round 2
        state.playoffs.lower.r2 = ['M-TOKYO-PO-LB-R2-1', 'M-TOKYO-PO-LB-R2-2'];
        state.playoffs.matches['M-TOKYO-PO-LB-R2-1'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };
        state.playoffs.matches['M-TOKYO-PO-LB-R2-2'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // LB Round 3
        state.playoffs.lower.r3 = 'M-TOKYO-PO-LB-R3';
        state.playoffs.matches['M-TOKYO-PO-LB-R3'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // LB Final
        state.playoffs.lower.final = 'M-TOKYO-PO-LB-FINAL';
        state.playoffs.matches['M-TOKYO-PO-LB-FINAL'] = { team1: 'TBD', team2: 'TBD', bestOf: 3 };

        // Grand Final
        state.playoffs.grandFinal = 'M-TOKYO-PO-GF';
        state.playoffs.matches['M-TOKYO-PO-GF'] = { team1: 'TBD', team2: 'TBD', bestOf: 5 };

        console.log("Masters Tokyo: Playoffs Initialized!");
        state.dirty = true;
    }

    // --- PLAYOFF PROGRESSION ---
    if (state.playoffs.upper.quarterfinals.length > 0) {
        const currentWeek = currentState?.currentWeek;
        const getMatch = (id) => state.playoffs.matches[id];
        
        // Helper to advance winner/loser
        const advance = (targetId, sourceId1, sourceId2, useLoser1 = false, useLoser2 = false) => {
            const m1 = getMatch(sourceId1);
            const m2 = getMatch(sourceId2);
            if (!m1 || !m2) return;
            
            const team1 = useLoser1 ? (m1.winner === m1.team1 ? m1.team2 : m1.team1) : m1.winner;
            const team2 = useLoser2 ? (m2.winner === m2.team1 ? m2.team2 : m2.team1) : m2.winner;
            
            if (team1 && team2 && team1 !== 'TBD' && team2 !== 'TBD') {
                const target = state.playoffs.matches[targetId];
                if (target) {
                    target.team1 = team1;
                    target.team2 = team2;
                }
            }
        };

        // Helper to simulate if ready
        const simIfReady = (matchId) => {
            if (!simulateMatchFn || !matchId) return false;
            const matchData = state.playoffs.matches[matchId];
            if (matchData && !matchData.winner && matchData.team1 !== 'TBD' && matchData.team2 !== 'TBD') {
                console.log(`Auto-simulating: ${matchData.team1} vs ${matchData.team2}`);
                simulateMatchFn(matchId, matchData.team1, matchData.team2, 3);
                return true;
            }
            return false;
        };

        const ub = state.playoffs.upper;
        const lb = state.playoffs.lower;

        // ROUND 1: Quarterfinals (Week 28)
        if (simulateMatchFn && currentWeek === 28) {
            console.log(`Masters Tokyo Week ${currentWeek}: Simulating Quarterfinals...`);
            ub.quarterfinals.forEach(simIfReady);
        }

        // Advance to Round 2 (SF + LB R1) - happens after Week 28
        if (currentWeek >= 28) {
            console.log('Advancing bracket to Round 2...');
            advance(ub.semifinals[0], ub.quarterfinals[0], ub.quarterfinals[1]);
            advance(ub.semifinals[1], ub.quarterfinals[2], ub.quarterfinals[3]);
            advance(lb.r1[0], ub.quarterfinals[0], ub.quarterfinals[1], true, true);
            advance(lb.r1[1], ub.quarterfinals[2], ub.quarterfinals[3], true, true);
        }

        // ROUND 2: Semifinals (Week 29)
        if (simulateMatchFn && currentWeek === 29) {
            console.log(`Masters Tokyo Week ${currentWeek}: Simulating Semifinals...`);
            ub.semifinals.forEach(simIfReady);
        }

        // Advance to Round 3 (UB Final + LB R2) - happens after Week 29
        if (currentWeek >= 29) {
            console.log('Advancing bracket to Round 3...');
            advance(ub.final, ub.semifinals[0], ub.semifinals[1]);
            advance(lb.r2[0], ub.semifinals[1], lb.r1[0], true, false); 
            advance(lb.r2[1], ub.semifinals[0], lb.r1[1], true, false);
        }

        // ROUND 3: UB Final + LB R1 (Week 30)
        if (simulateMatchFn && currentWeek === 30) {
            console.log(`Masters Tokyo Week ${currentWeek}: Simulating UB Final + LB R1...`);
            simIfReady(ub.final);
            lb.r1.forEach(simIfReady);
        }

        // Advance to Round 4 (LB R3) - happens after Week 30
        if (currentWeek >= 30) {
            console.log('Advancing bracket to Round 4...');
            advance(lb.r3, lb.r2[0], lb.r2[1]);
        }

        // ROUND 4: LB R2 + LB R3 (Week 31)
        if (simulateMatchFn && currentWeek === 31) {
            console.log(`Masters Tokyo Week ${currentWeek}: Simulating LB R2 + LB R3...`);
            lb.r2.forEach(simIfReady);
            simIfReady(lb.r3);
        }

        // Advance to Round 5 (LB Final) - happens after Week 31
        if (currentWeek >= 31) {
            console.log('Advancing bracket to Round 5...');
            advance(lb.final, ub.final, lb.r3, true, false);
            advance(state.playoffs.grandFinal, ub.final, lb.final);
        }

        // ROUND 5: LB Final + Grand Final (Week 32)
        if (simulateMatchFn && currentWeek === 32) {
            console.log(`Masters Tokyo Week ${currentWeek}: Simulating LB Final + Grand Final...`);
            simIfReady(lb.final);
            simIfReady(state.playoffs.grandFinal);
        }

        // Check Completion
        const gf = getMatch(state.playoffs.grandFinal);
        if (gf && gf.winner) {
            state.complete = true;
        }
    }

    return state;
}
