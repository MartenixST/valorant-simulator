
import { initializeRegularSeason, generatePlayoffsBracket, simulatePlayoffsRound } from './src/tournaments/regular_season/regular_season_logic.js';
import { teams } from './src/teams.js';

// Mock localStorage
global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = String(value); },
    removeItem: function(key) { delete this._data[key]; },
    key: function(i) { return Object.keys(this._data)[i]; },
    get length() { return Object.keys(this._data).length; }
};

// Mock fetch (not used but imported implicitly via career_local_storage if it did fetches)
global.fetch = () => Promise.resolve({ json: () => ({}) });

console.log("Starting Playoff Logic Test...");

// 1. Setup Active Save
const activeSave = {
    id: "test_save",
    week: 16,
    players: [], // Need dummy players? simulatePlayoffsRound uses them for simulation
    teamId: 1 // 100 Thieves
};

// 2. Initialize Regular Season
console.log("Initializing Regular Season...");
let regularSeason = initializeRegularSeason(activeSave);

// 3. Populate Standings (Simulate a season result)
console.log("Populating Standings...");
// We'll just assign random points to teams to ensure sorting works
Object.keys(regularSeason.standings).forEach(teamId => {
    regularSeason.standings[teamId].points = Math.floor(Math.random() * 10);
    regularSeason.standings[teamId].roundsWon = Math.floor(Math.random() * 200);
    regularSeason.standings[teamId].roundsLost = Math.floor(Math.random() * 200);
});

// 4. Generate Bracket
console.log("Generating Playoff Bracket (Week 16)...");
regularSeason = generatePlayoffsBracket(regularSeason);

// Verify Bracket
const region = "Americas";
if (!regularSeason.playoffs || !regularSeason.playoffs[region]) {
    console.error("FAILED: Bracket not generated for " + region);
    process.exit(1);
}

const ub_qf = regularSeason.playoffs[region].upper.quarterfinals;
console.log(`Americas UB QF Matches: ${ub_qf.length}`);
ub_qf.forEach(m => {
    console.log(`  ${m.id}: ${m.team1} vs ${m.team2}`);
    if (m.team1 === 'TBD' || m.team2 === 'TBD') {
        console.error("  ERROR: Team is TBD in QF!");
    }
});

// 5. Simulate Week 17 (UB QF)
console.log("\nSimulating Week 17 (UB QF)...");
const simulateMatchFn = (t1, t2) => {
    // Simple simulation mock
    return {
        winner: t1.name,
        loser: t2.name,
        score: "2-0",
        playerStats: {},
        logs: [],
        mapResults: []
    };
};

regularSeason = simulatePlayoffsRound(regularSeason, simulateMatchFn, [], 17);

// Verify Results
console.log("Verifying Week 17 Results...");
ub_qf.forEach(m => {
    console.log(`  ${m.id}: Winner = ${m.winner}`);
    if (!m.winner) console.error("  ERROR: Match not simulated!");
});

// Verify Progression (Week 18 Prep)
console.log("\nVerifying Progression to Week 18 (UB SF & LB R1)...");
// We need to run populate logic again (usually happens at start of next week sim)
// simulatePlayoffsRound calls populateMatch internally
regularSeason = simulatePlayoffsRound(regularSeason, simulateMatchFn, [], 18, true); // Only populate

const ub_sf = regularSeason.playoffs[region].upper.semifinals;
const lb_r1 = regularSeason.playoffs[region].lower.r1;

console.log("UB SF Matches:");
ub_sf.forEach(m => console.log(`  ${m.id}: ${m.team1} vs ${m.team2}`));

console.log("LB R1 Matches:");
lb_r1.forEach(m => console.log(`  ${m.id}: ${m.team1} vs ${m.team2}`));

if (ub_sf[0].team1 === 'TBD') console.error("ERROR: UB SF Team 1 is TBD (should be populated from QF winner)");
if (lb_r1[0].team1 === 'TBD') console.error("ERROR: LB R1 Team 1 is TBD (should be populated from QF loser)");

console.log("\nTest Complete.");
