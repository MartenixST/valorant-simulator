
import { automateMastersTokyo } from './src/tournaments/masters/tokyo/masters_tokyo_automation.js';

// Mock Teams
const highSeeds = ['FNC', 'PRX', 'LOUD', 'EG'];
const lowSeeds = ['DRX', 'NAVI', 'TL', 'FUT', 'T1', 'EDG', 'ASE', 'ZETA'];

// Mock State
let state = automateMastersTokyo(highSeeds, lowSeeds, null, null);

console.log('--- Initial State ---');
console.log('Swiss Rounds:', state.swiss.rounds.length);
console.log('Swiss Teams:', Object.keys(state.swiss.teamStats).length);

// Simulate Swiss Round 1
console.log('\n--- Simulating Swiss Round 1 ---');
// Round 1 is already generated in initial call if not complete?
// Actually, automateMastersTokyo generates round 1 if rounds is empty.
// Let's check logic:
// if (!swissComplete) {
//    if (state.swiss.rounds.length > 0) { ... check completion ... }
//    else { ... generate round 1 ... }
// }
// Wait, the logic I read earlier:
// if (!swissComplete) {
//    if (state.swiss.rounds.length > 0) { ... check if finished ... }
//    // If not finished, return state.
//    // If finished, update stats.
//    // Then re-check completion.
//    // If still not complete, generate next round.
// }
// BUT, where is the initial round generation?
// Ah, lines 114-147: "Generate Next Swiss Round"
// If rounds.length is 0, it falls through to this block because the first `if` (rounds > 0) is false.
// So Round 1 should be generated.

if (state.swiss.rounds.length === 1) {
    console.log('Round 1 Matches:', state.swiss.rounds[0].matches.length);
    state.swiss.rounds[0].matches.forEach(m => {
        console.log(`${m.team1} vs ${m.team2}`);
        // Simulate result
        state.swiss.matches[m.id].winner = m.team1; // Higher seed wins for test
        state.swiss.matches[m.id].loser = m.team2;
        state.swiss.matches[m.id].score = '2-0';
    });
}

// Update State (Round 1 Complete)
state = automateMastersTokyo(highSeeds, lowSeeds, null, null, state);
console.log('\n--- After Round 1 ---');
console.log('Swiss Rounds:', state.swiss.rounds.length); // Should be 2

if (state.swiss.rounds.length === 2) {
    console.log('Round 2 Matches:', state.swiss.rounds[1].matches.length);
    state.swiss.rounds[1].matches.forEach(m => {
        console.log(`${m.team1} vs ${m.team2}`);
        state.swiss.matches[m.id].winner = m.team1;
        state.swiss.matches[m.id].loser = m.team2;
        state.swiss.matches[m.id].score = '2-0';
    });
}

// Update State (Round 2 Complete)
state = automateMastersTokyo(highSeeds, lowSeeds, null, null, state);
console.log('\n--- After Round 2 ---');

if (state.swiss.rounds.length === 3) {
    console.log('Round 3 Matches:', state.swiss.rounds[2].matches.length);
    state.swiss.rounds[2].matches.forEach(m => {
        console.log(`${m.team1} vs ${m.team2}`);
        state.swiss.matches[m.id].winner = m.team1;
        state.swiss.matches[m.id].loser = m.team2;
        state.swiss.matches[m.id].score = '2-0';
    });
}

// Update State (Round 3 Complete)
state = automateMastersTokyo(highSeeds, lowSeeds, null, null, state);
console.log('\n--- After Round 3 ---');

console.log('Swiss Complete?', Object.values(state.swiss.teamStats).filter(t => t.qualified).length === 4);
console.log('Qualified:', Object.keys(state.swiss.teamStats).filter(t => state.swiss.teamStats[t].qualified));

if (state.playoffs.teams.length > 0) {
    console.log('\n--- Playoffs Generated ---');
    console.log('Teams:', state.playoffs.teams);
    console.log('UB QF Matches:', state.playoffs.upper.quarterfinals.length);
    
    // Simulate QF
    state.playoffs.upper.quarterfinals.forEach(mid => {
        const m = state.playoffs.matches[mid];
        m.winner = m.team1; // High seeds win
        m.loser = m.team2;
        m.score = '2-0';
    });

    // Update State (QF Complete)
    state = automateMastersTokyo(highSeeds, lowSeeds, null, null, state);
    
    console.log('UB SF Teams:', state.playoffs.upper.semifinals.map(mid => state.playoffs.matches[mid].team1 + ' vs ' + state.playoffs.matches[mid].team2));
    console.log('LB R1 Teams:', state.playoffs.lower.r1.map(mid => state.playoffs.matches[mid].team1 + ' vs ' + state.playoffs.matches[mid].team2));
} else {
    console.log('Playoffs NOT generated yet.');
}

