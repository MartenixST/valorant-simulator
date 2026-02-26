
import { teams } from '../../teams.js';
import { getKickoffState } from '../../career_local_storage.jsx';

/**
 * Initializes the Regular Season structure (Groups and Schedule).
 * @param {Object} activeSave - The current career save object.
 * @returns {Object} - The initialized regularSeason object.
 */
export function initializeRegularSeason(activeSave) {
    const regularSeason = {
        groups: {}, // { "Americas": { "Group A": [teamIds], "Group B": [teamIds] }, ... }
        schedule: {}, // { weekNum: [ { matchId, team1Id, team2Id, region, group, played: false } ] }
        standings: {}, // { teamId: { wins, losses, ... } }
        matches: [] // History of played matches
    };

    const regions = ["Americas", "EMEA", "Pacific", "China"];

    // Initialize Standings
    teams.forEach(t => {
        regularSeason.standings[t.id] = {
            name: t.name,
            region: t.region,
            wins: 0,
            losses: 0,
            roundsWon: 0,
            roundsLost: 0,
            points: 0,
            group: null // Will be assigned below
        };
    });

    regions.forEach(region => {
        // 1. Get Kickoff Rankings
        const kickoffState = getKickoffState(region, activeSave.id);
        const rankedTeams = getRankedTeamsFromKickoff(region, kickoffState);

        // 2. Assign Groups (Seeded Random Draw)
        const groups = assignGroups(rankedTeams);
        regularSeason.groups[region] = groups;

        // Update standings with group info
        groups['Group A'].forEach(teamId => {
            if (regularSeason.standings[teamId]) regularSeason.standings[teamId].group = 'Group A';
        });
        groups['Group B'].forEach(teamId => {
            if (regularSeason.standings[teamId]) regularSeason.standings[teamId].group = 'Group B';
        });

        // 3. Generate Schedule (Round Robin for each group)
        const groupASchedule = generateRoundRobinSchedule(groups['Group A'], region, 'Group A');
        const groupBSchedule = generateRoundRobinSchedule(groups['Group B'], region, 'Group B');

        // Merge schedules into main schedule object
        // Regular Season starts Week 12.
        // Round Robin with 6 teams = 5 rounds.
        // Weeks: 12, 13, 14, 15, 16.
        
        [groupASchedule, groupBSchedule].forEach(sched => {
            sched.forEach((roundMatches, roundIndex) => {
                const weekNum = 12 + roundIndex;
                if (!regularSeason.schedule[weekNum]) {
                    regularSeason.schedule[weekNum] = [];
                }
                regularSeason.schedule[weekNum].push(...roundMatches);
            });
        });
    });

    return regularSeason;
}

/**
 * Ranks teams based on Kickoff performance.
 */
function getRankedTeamsFromKickoff(region, kickoffState) {
    const regionTeams = teams.filter(t => t.region === region);
    
    if (!kickoffState || !kickoffState.series) {
        // Fallback: Random shuffle if no kickoff data
        return regionTeams.map(t => t.id).sort(() => 0.5 - Math.random());
    }

    const s = kickoffState.series;
    const tiers = {
        1: [], // Winner K-GF
        2: [], // Loser K-GF
        3: [], // Loser K-LBF
        4: [], // Loser K-LB4-M1
        5: [], // Losers K-LB3 (2 teams)
        6: [], // Losers K-LB2 (2 teams)
        7: [], // Losers K-LB1 (4 teams)
        8: []  // Everyone else (shouldn't be any for 12 teams, but safe to have)
    };

    // Helper to find team ID by name
    const getId = (name) => {
        const t = regionTeams.find(rt => rt.name === name);
        return t ? t.id : null;
    };

    const winnerGF = s['K-GF']?.winner;
    const loserGF = s['K-GF']?.loser;
    if (winnerGF) tiers[1].push(getId(winnerGF));
    if (loserGF) tiers[2].push(getId(loserGF));

    const loserLBF = s['K-LBF']?.loser;
    if (loserLBF) tiers[3].push(getId(loserLBF));

    const loserLB4 = s['K-LB4-M1']?.loser;
    if (loserLB4) tiers[4].push(getId(loserLB4));

    ['K-LB3-M1', 'K-LB3-M2'].forEach(mid => {
        if (s[mid]?.loser) tiers[5].push(getId(s[mid].loser));
    });

    ['K-LB2-M1', 'K-LB2-M2'].forEach(mid => {
        if (s[mid]?.loser) tiers[6].push(getId(s[mid].loser));
    });

    ['K-LB1-M1', 'K-LB1-M2', 'K-LB1-M3', 'K-LB1-M4'].forEach(mid => {
        if (s[mid]?.loser) tiers[7].push(getId(s[mid].loser));
    });

    // Flatten and fill in any missing teams (e.g. if kickoff wasn't fully simulated properly)
    let rankedIds = [];
    Object.values(tiers).forEach(tierIds => {
        // Shuffle within tier
        tierIds.sort(() => 0.5 - Math.random());
        rankedIds.push(...tierIds);
    });

    // Add missing teams
    const processedIds = new Set(rankedIds);
    const missing = regionTeams.filter(t => !processedIds.has(t.id)).map(t => t.id);
    missing.sort(() => 0.5 - Math.random());
    rankedIds.push(...missing);

    // Filter nulls just in case
    return rankedIds.filter(id => id);
}

/**
 * Assigns teams to Group A and Group B using seeded random pots.
 */
function assignGroups(rankedTeamIds) {
    const groupA = [];
    const groupB = [];

    // Pots logic
    // Pot 1: 1-2
    // Pot 2: 3-4
    // Pot 3: 5-6
    // Pot 4: 7-8
    // Pot 5: 9-12 (4 teams)

    const pots = [
        rankedTeamIds.slice(0, 2),
        rankedTeamIds.slice(2, 4),
        rankedTeamIds.slice(4, 6),
        rankedTeamIds.slice(6, 8),
        rankedTeamIds.slice(8, 12)
    ];

    pots.forEach((pot, index) => {
        // Shuffle pot
        const shuffled = [...pot].sort(() => 0.5 - Math.random());
        
        // Distribute
        shuffled.forEach((teamId, i) => {
            // Alternate assignment to balance
            // For Pot 5 (4 teams), it will go A, B, A, B
            if (groupA.length <= groupB.length) {
                groupA.push(teamId);
            } else {
                groupB.push(teamId);
            }
        });
    });

    return { 'Group A': groupA, 'Group B': groupB };
}

/**
 * Generates Round Robin schedule for a group.
 * Returns array of rounds, where each round is array of matches.
 */
function generateRoundRobinSchedule(teamIds, region, groupName) {
    const rounds = [];
    const n = teamIds.length; // Should be 6
    
    // Circle method
    // Fix first team, rotate others
    let pool = [...teamIds];
    
    // If odd number of teams, add a dummy
    if (n % 2 !== 0) {
        pool.push(null);
    }

    const numRounds = pool.length - 1; // 5 rounds for 6 teams
    const half = pool.length / 2;

    for (let r = 0; r < numRounds; r++) {
        const roundMatches = [];
        for (let i = 0; i < half; i++) {
            const t1 = pool[i];
            const t2 = pool[pool.length - 1 - i];

            if (t1 !== null && t2 !== null) {
                roundMatches.push({
                    id: `RS-${region}-${groupName}-R${r+1}-M${i+1}`,
                    team1Id: t1,
                    team2Id: t2,
                    region: region,
                    group: groupName,
                    played: false
                });
            }
        }
        rounds.push(roundMatches);

        // Rotate pool (keep index 0 fixed)
        // [0, 1, 2, 3, 4, 5] -> [0, 5, 1, 2, 3, 4]
        const last = pool.pop();
        pool.splice(1, 0, last);
    }

    // Shuffle the order of rounds to make it less predictable? 
    // Or keep it standard. Standard is fine.
    // Maybe shuffle matches within a round.
    return rounds;
}

/**
 * Generates the Regular Season Playoffs bracket for all regions.
 * Top 4 from each group qualify (8 teams total).
 * Single Elimination: Quarterfinals -> Semifinals -> Final.
 */
export function generatePlayoffsBracket(regularSeasonState) {
    if (!regularSeasonState.playoffs) {
        regularSeasonState.playoffs = {};
    }

    const regions = ["Americas", "EMEA", "Pacific", "China"];

    regions.forEach(region => {
        // Prevent overwriting if already generated AND has the correct structure (double elim)
        // BUT if the first match is TBD (which shouldn't happen for Quarterfinals as they come from standings), regenerate.
        if (regularSeasonState.playoffs[region] && regularSeasonState.playoffs[region].upper) {
             const firstMatch = regularSeasonState.playoffs[region].upper.quarterfinals[0];
             if (firstMatch && firstMatch.team1 !== 'TBD') {
                 return;
             }
             console.log(`Regenerating playoffs for ${region} due to invalid/TBD state...`);
        }

        // 1. Get teams from standings for this region
        const regionalTeams = Object.entries(regularSeasonState.standings)
            .filter(([id, stats]) => stats.region === region)
            .map(([id, stats]) => ({ id: parseInt(id), ...stats }));

        // 2. Separate by Group
        let groupA = regionalTeams.filter(t => t.group === 'Group A');
        let groupB = regionalTeams.filter(t => t.group === 'Group B');

        // Fallback: If groups are not set in standings, try to retrieve from regularSeasonState.groups
        if ((groupA.length === 0 || groupB.length === 0) && regularSeasonState.groups && regularSeasonState.groups[region]) {
             console.warn(`Groups missing in standings for ${region}. Attempting to resolve from group structure.`);
             
             const regionGroups = regularSeasonState.groups[region];
             const groupAIds = regionGroups['Group A'] || [];
             const groupBIds = regionGroups['Group B'] || [];
             
             groupA = regionalTeams.filter(t => groupAIds.includes(t.id));
             groupB = regionalTeams.filter(t => groupBIds.includes(t.id));

             // Also patch the standings so it doesn't happen again
             groupA.forEach(t => {
                 if (regularSeasonState.standings[t.id]) regularSeasonState.standings[t.id].group = 'Group A';
             });
             groupB.forEach(t => {
                 if (regularSeasonState.standings[t.id]) regularSeasonState.standings[t.id].group = 'Group B';
             });
        }

        // 3. Sort each group
        const sortTeams = (teams) => {
            return teams.sort((a, b) => {
                // Points (Wins)
                if (b.points !== a.points) return b.points - a.points;
                // Round Diff
                const rdA = a.roundsWon - a.roundsLost;
                const rdB = b.roundsWon - b.roundsLost;
                if (rdB !== rdA) return rdB - rdA;
                return 0;
            });
        };

        const sortedA = sortTeams(groupA);
        const sortedB = sortTeams(groupB);

        // 4. Take Top 4 from each
        const topA = sortedA.slice(0, 4);
        const topB = sortedB.slice(0, 4);

        // 5. Create Bracket Structure (Double Elimination)
        
        const createMatch = (id, t1, t2, bestOf = 3) => ({
            id,
            team1: t1 ? t1.name : 'TBD',
            team2: t2 ? t2.name : 'TBD',
            team1Id: t1 ? t1.id : null,
            team2Id: t2 ? t2.id : null,
            winner: null,
            winnerId: null,
            loser: null,
            loserId: null,
            score: null,
            bestOf
        });

        // Upper Bracket Quarterfinals (Week 17)
        const ub_qf = [
            createMatch(`RS-${region}-UB-QF1`, topA[0], topB[3]), // A1 vs B4
            createMatch(`RS-${region}-UB-QF2`, topB[1], topA[2]), // B2 vs A3
            createMatch(`RS-${region}-UB-QF3`, topA[1], topB[2]), // A2 vs B3
            createMatch(`RS-${region}-UB-QF4`, topB[0], topA[3])  // B1 vs A4
        ];

        // Upper Bracket Semifinals (Week 18)
        const ub_sf = [
            createMatch(`RS-${region}-UB-SF1`, null, null), // Winner QF1 vs Winner QF2
            createMatch(`RS-${region}-UB-SF2`, null, null)  // Winner QF3 vs Winner QF4
        ];

        // Upper Bracket Final (Week 19)
        const ub_final = [
            createMatch(`RS-${region}-UB-F`, null, null) // Winner SF1 vs Winner SF2
        ];

        // Lower Bracket Round 1 (Week 18)
        const lb_r1 = [
            createMatch(`RS-${region}-LB-R1-M1`, null, null), // Loser QF1 vs Loser QF2
            createMatch(`RS-${region}-LB-R1-M2`, null, null)  // Loser QF3 vs Loser QF4
        ];

        // Lower Bracket Round 2 (Week 19)
        const lb_r2 = [
            createMatch(`RS-${region}-LB-R2-M1`, null, null), // Loser SF2 vs Winner LB R1 M1 (Cross grouping usually)
            createMatch(`RS-${region}-LB-R2-M2`, null, null)  // Loser SF1 vs Winner LB R1 M2
        ];

        // Lower Bracket Round 3 (Week 20)
        const lb_r3 = [
            createMatch(`RS-${region}-LB-R3`, null, null) // Winner LB R2 M1 vs Winner LB R2 M2
        ];

        // Lower Bracket Final (Week 21)
        const lb_final = [
            createMatch(`RS-${region}-LB-F`, null, null) // Loser UB Final vs Winner LB R3
        ];

        // Grand Final (Week 22)
        const grand_final = [
            createMatch(`RS-${region}-GF`, null, null, 5) // Winner UB Final vs Winner LB Final
        ];

        regularSeasonState.playoffs[region] = {
            upper: {
                quarterfinals: ub_qf,
                semifinals: ub_sf,
                final: ub_final
            },
            lower: {
                r1: lb_r1,
                r2: lb_r2,
                r3: lb_r3,
                final: lb_final
            },
            grandFinal: grand_final
        };
    });

    return regularSeasonState;
}

/**
 * Simulates a playoffs round based on the week.
 * @param {Object} regularSeasonState 
 * @param {Function} simulateMatchFn 
 * @param {Array} savePlayers 
 * @param {Number} weekNum 
 */
export function simulatePlayoffsRound(regularSeasonState, simulateMatchFn, savePlayers, weekNum, onlyPopulate = false) {
    const regions = ["Americas", "EMEA", "Pacific", "China"];
    
    regions.forEach(region => {
        const bracket = regularSeasonState.playoffs[region];
        if (!bracket) return;
        if (!bracket.upper) return;

        // Helper to populate match if TBD
        const populateMatch = (match, source1, source2, useLoser1 = false, useLoser2 = false) => {
            if (match.team1 === 'TBD' && source1) {
                if (useLoser1 && source1.loser) {
                    match.team1 = source1.loser;
                    // match.team1Id = source1.loserId; // need to ensure loserId is set in sim
                    // Find loser ID if not set (legacy check)
                    const loserName = source1.loser;
                    const loserObj = teams.find(t => t.name === loserName);
                    if (loserObj) match.team1Id = loserObj.id;
                } else if (!useLoser1 && source1.winner) {
                    match.team1 = source1.winner;
                    match.team1Id = source1.winnerId;
                }
            }
            if (match.team2 === 'TBD' && source2) {
                if (useLoser2 && source2.loser) {
                    match.team2 = source2.loser;
                    const loserName = source2.loser;
                    const loserObj = teams.find(t => t.name === loserName);
                    if (loserObj) match.team2Id = loserObj.id;
                } else if (!useLoser2 && source2.winner) {
                    match.team2 = source2.winner;
                    match.team2Id = source2.winnerId;
                }
            }
        };

        // --- POPULATE ALL ROUNDS (Cascading) ---
        // This ensures that if a previous round is finished (even manually), the next round is ready.
        
        // UB SF
        populateMatch(bracket.upper.semifinals[0], bracket.upper.quarterfinals[0], bracket.upper.quarterfinals[1]);
        populateMatch(bracket.upper.semifinals[1], bracket.upper.quarterfinals[2], bracket.upper.quarterfinals[3]);

        // LB R1
        populateMatch(bracket.lower.r1[0], bracket.upper.quarterfinals[0], bracket.upper.quarterfinals[1], true, true);
        populateMatch(bracket.lower.r1[1], bracket.upper.quarterfinals[2], bracket.upper.quarterfinals[3], true, true);

        // UB Final
        populateMatch(bracket.upper.final[0], bracket.upper.semifinals[0], bracket.upper.semifinals[1]);

        // LB R2
        populateMatch(bracket.lower.r2[0], bracket.upper.semifinals[1], bracket.lower.r1[0], true, false);
        populateMatch(bracket.lower.r2[1], bracket.upper.semifinals[0], bracket.lower.r1[1], true, false);

        // LB R3
        populateMatch(bracket.lower.r3[0], bracket.lower.r2[0], bracket.lower.r2[1]);

        // LB Final
        populateMatch(bracket.lower.final[0], bracket.upper.final[0], bracket.lower.r3[0], true, false);

        // Grand Final
        populateMatch(bracket.grandFinal[0], bracket.upper.final[0], bracket.lower.final[0]);


        const simulateList = (matches, stageName) => {
            if (onlyPopulate) return;
            
            matches.forEach(match => {
                if (match.winner) return; // Already played

                if (match.team1 !== 'TBD' && match.team2 !== 'TBD') {
                    // Try to find by ID first, fallback to name
                    const team1Data = teams.find(t => (match.team1Id && t.id === match.team1Id) || t.name === match.team1);
                    const team2Data = teams.find(t => (match.team2Id && t.id === match.team2Id) || t.name === match.team2);

                    if (team1Data && team2Data) {
                        const result = simulateMatchFn(team1Data, team2Data, savePlayers);
                        
                        match.winner = result.winner;
                        match.loser = result.loser;
                        match.winnerId = result.winner === team1Data.name ? team1Data.id : team2Data.id;
                        match.loserId = result.loser === team1Data.name ? team1Data.id : team2Data.id;
                        
                        match.score = result.score;
                        match.playerStats = result.playerStats;
                        match.logs = result.logs;
                        match.mapResults = result.mapResults;

                        // Add to match history
                        regularSeasonState.matches.push({
                            week: weekNum,
                            id: match.id,
                            t1Name: match.team1,
                            t2Name: match.team2,
                            winner: match.winner,
                            loser: match.loser,
                            score: match.score,
                            region: region,
                            tournament: 'Regular Season Playoffs',
                            stage: stageName
                        });
                    }
                }
            });
        };

        // --- WEEK 17: Upper Quarterfinals ---
        if (weekNum === 17) {
            simulateList(bracket.upper.quarterfinals, 'Upper Quarterfinals');
        }

        // --- WEEK 18: Upper Semifinals + Lower Round 1 ---
        if (weekNum === 18) {
            simulateList(bracket.upper.semifinals, 'Upper Semifinals');
            simulateList(bracket.lower.r1, 'Lower Round 1');
        }

        // --- WEEK 19: Upper Final + Lower Round 2 ---
        if (weekNum === 19) {
            simulateList(bracket.upper.final, 'Upper Final');
            simulateList(bracket.lower.r2, 'Lower Round 2');
        }

        // --- WEEK 20: Lower Round 3 ---
        if (weekNum === 20) {
            simulateList(bracket.lower.r3, 'Lower Round 3');
        }

        // --- WEEK 21: Lower Final ---
        if (weekNum === 21) {
            simulateList(bracket.lower.final, 'Lower Final');
        }

        // --- WEEK 22: Grand Final ---
        if (weekNum === 22) {
            simulateList(bracket.grandFinal, 'Grand Final');
        }
    });

    return regularSeasonState;
}
