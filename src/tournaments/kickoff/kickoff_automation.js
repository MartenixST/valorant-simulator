import { teams } from '../../teams.js';
import { Player, Team, MatchSimulator } from '../../simulation.js';
import { hireFreeAgentForTeam } from '../../ai_manager.js';

/**
 * Generates an initial kickoff bracket state for a specific region.
 */
export function generateKickoffState(region) {
    let initialUsedTeams = [];
    const regionTeams = teams.filter(t => t.region === region);
    
    const getRandomTeamFromRegion = (exclude = []) => {
        const excludedNames = exclude.map(t => typeof t === 'object' ? t.name : t);
        const available = regionTeams.filter(t => !excludedNames.includes(t.name));
        if (available.length === 0) return { name: 'TBD' };
        return available[Math.floor(Math.random() * available.length)];
    };

    // Select 4 teams for byes
    const byeTeams = [];
    for (let i = 0; i < 4; i++) {
        let team = getRandomTeamFromRegion(initialUsedTeams);
        byeTeams.push(team.name);
        initialUsedTeams.push(team);
    }

    const state = {
        region: region,
        series: {},
        playInRound1: [],
        ubRound1: [],
        ubRound2: [],
        ubFinal: [],
        lbRound1: [],
        lbRound2: [],
        lbRound3: [],
        lbRound4: [],
        lbFinal: [],
        grandFinal: [],
        dirty: false
    };

    // Initialize play-in matches (Round 1 for 8 teams)
    state.playInRound1 = [
        { id: 'K-P1-M1', team1: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), team2: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M2', team1: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), team2: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M3', team1: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), team2: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-P1-M4', team1: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), team2: (() => { let t = getRandomTeamFromRegion(initialUsedTeams); initialUsedTeams.push(t); return t.name; })(), winner: null, bestOf: 3, isGrandFinal: false },
    ];

    // Initialize upper bracket Round 1 (where bye teams join)
    state.ubRound1 = [
        { id: 'K-UB1-M1', team1: byeTeams[0], team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-UB1-M2', team1: byeTeams[1], team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-UB1-M3', team1: byeTeams[2], team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-UB1-M4', team1: byeTeams[3], team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.ubRound2 = [
        { id: 'K-UB2-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-UB2-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.ubFinal = [
        { id: 'K-UBF-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    // Initialize lower bracket rounds
    state.lbRound1 = [
        { id: 'K-LB1-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB1-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB1-M3', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB1-M4', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.lbRound2 = [
        { id: 'K-LB2-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB2-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.lbRound3 = [
        { id: 'K-LB3-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
        { id: 'K-LB3-M2', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.lbRound4 = [
        { id: 'K-LB4-M1', team1: '', team2: '', winner: null, bestOf: 3, isGrandFinal: false },
    ];

    state.lbFinal = [
        { id: 'K-LBF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
    ];

    state.grandFinal = [
        { id: 'K-GF', team1: '', team2: '', winner: null, bestOf: 5, isGrandFinal: true },
    ];

    return state;
}

/**
 * Automates the simulation of a kickoff tournament for a region.
 */
export function automateKickoffTournament(state, savePlayers, simulateMatchFn) {
    const rounds = [
        'playInRound1',
        'ubRound1',
        'ubRound2',
        'ubFinal',
        'lbRound1',
        'lbRound2',
        'lbRound3',
        'lbRound4',
        'lbFinal',
        'grandFinal'
    ];

    rounds.forEach(roundKey => {
        updateBracketProgression(state);
        const matches = state[roundKey];
        if (!matches) return;

        matches.forEach(match => {
            // Only simulate if match is ready (both teams decided) and not yet played
            if (match.team1 && match.team2 && match.team1 !== 'TBD' && match.team2 !== 'TBD' && !state.series[match.id]) {
                const team1Data = teams.find(t => t.name === match.team1);
                const team2Data = teams.find(t => t.name === match.team2);
                
                if (team1Data && team2Data) {
                    // BEFORE SIMULATING: Ensure both teams have 5 players
                    // Use a more robust check for roster size
                    const getRosterSize = (teamData) => {
                        return savePlayers.filter(p => {
                            const pTeamId = p.teamId ? String(p.teamId) : null;
                            const tId = teamData.id ? String(teamData.id) : null;
                            const normalize = (n) => String(n || '').toLowerCase().trim();
                            const pTeamNameNorm = normalize(p.team);
                            const teamNameNorm = normalize(teamData.name);

                            const matchesId = tId && pTeamId && pTeamId === tId;
                            const matchesName = teamNameNorm && pTeamNameNorm && pTeamNameNorm === teamNameNorm;
                            return matchesId || matchesName;
                        }).length;
                    };

                    // Fill Team 1
                    while (getRosterSize(team1Data) < 5) {
                        hireFreeAgentForTeam(team1Data.id, team1Data.name, team1Data.region, savePlayers);
                    }
                    // Fill Team 2
                    while (getRosterSize(team2Data) < 5) {
                        hireFreeAgentForTeam(team2Data.id, team2Data.name, team2Data.region, savePlayers);
                    }

                    const result = simulateMatchFn(team1Data, team2Data, savePlayers);
                    state.series[match.id] = {
                        winner: result.winner,
                        loser: result.loser,
                        score: result.score,
                        playerStats: result.playerStats,
                        mapResults: result.mapResults,
                        team1Name: team1Data.name,
                        team2Name: team2Data.name,
                        bestOf: match.bestOf
                    };
                    match.winner = result.winner;
                }
            }
        });
    });

    updateBracketProgression(state); // Final update
    return state;
}

/**
 * Updates team placements in the bracket based on existing match results.
 * Ported from kickoff.jsx
 */
function updateBracketProgression(st) {
    if (st.playInRound1) {
        st.ubRound1[0].team2 = st.series['K-P1-M1']?.winner || st.ubRound1[0].team2;
        st.ubRound1[1].team2 = st.series['K-P1-M2']?.winner || st.ubRound1[1].team2;
        st.ubRound1[2].team2 = st.series['K-P1-M3']?.winner || st.ubRound1[2].team2;
        st.ubRound1[3].team2 = st.series['K-P1-M4']?.winner || st.ubRound1[3].team2;

        st.lbRound1[0].team1 = st.series['K-P1-M1']?.loser || st.lbRound1[0].team1;
        st.lbRound1[1].team1 = st.series['K-P1-M2']?.loser || st.lbRound1[1].team1;
        st.lbRound1[2].team1 = st.series['K-P1-M3']?.loser || st.lbRound1[2].team1;
        st.lbRound1[3].team1 = st.series['K-P1-M4']?.loser || st.lbRound1[3].team1;
    }

    if (st.ubRound1) {
        st.ubRound2[0].team1 = st.series['K-UB1-M1']?.winner || st.ubRound2[0].team1;
        st.ubRound2[0].team2 = st.series['K-UB1-M2']?.winner || st.ubRound2[0].team2;
        st.ubRound2[1].team1 = st.series['K-UB1-M3']?.winner || st.ubRound2[1].team1;
        st.ubRound2[1].team2 = st.series['K-UB1-M4']?.winner || st.ubRound2[1].team2;

        st.lbRound1[0].team2 = st.series['K-UB1-M1']?.loser || st.lbRound1[0].team2;
        st.lbRound1[1].team2 = st.series['K-UB1-M2']?.loser || st.lbRound1[1].team2;
        st.lbRound1[2].team2 = st.series['K-UB1-M3']?.loser || st.lbRound1[2].team2;
        st.lbRound1[3].team2 = st.series['K-UB1-M4']?.loser || st.lbRound1[3].team2;
    }

    if (st.ubRound2) {
        st.ubFinal[0].team1 = st.series['K-UB2-M1']?.winner || st.ubFinal[0].team1;
        st.ubFinal[0].team2 = st.series['K-UB2-M2']?.winner || st.ubFinal[0].team2;

        st.lbRound3[0].team2 = st.series['K-UB2-M1']?.loser || st.lbRound3[0].team2;
        st.lbRound3[1].team2 = st.series['K-UB2-M2']?.loser || st.lbRound3[1].team2;
    }

    if (st.lbRound1) {
        st.lbRound2[0].team1 = st.series['K-LB1-M1']?.winner || st.lbRound2[0].team1;
        st.lbRound2[0].team2 = st.series['K-LB1-M2']?.winner || st.lbRound2[0].team2;
        st.lbRound2[1].team1 = st.series['K-LB1-M3']?.winner || st.lbRound2[1].team1;
        st.lbRound2[1].team2 = st.series['K-LB1-M4']?.winner || st.lbRound2[1].team2;
    }

    if (st.lbRound2) {
        st.lbRound3[0].team1 = st.series['K-LB2-M1']?.winner || st.lbRound3[0].team1;
        st.lbRound3[1].team1 = st.series['K-LB2-M2']?.winner || st.lbRound3[1].team1;
    }

    if (st.lbRound3) {
        st.lbRound4[0].team1 = st.series['K-LB3-M1']?.winner || st.lbRound4[0].team1;
        st.lbRound4[0].team2 = st.series['K-LB3-M2']?.winner || st.lbRound4[0].team2;
    }

    if (st.lbRound4 && st.ubFinal) {
        st.lbFinal[0].team1 = st.series['K-LB4-M1']?.winner || st.lbFinal[0].team1;
        st.lbFinal[0].team2 = st.series['K-UBF-M1']?.loser || st.lbFinal[0].team2;
    }

    if (st.ubFinal && st.lbFinal) {
        st.grandFinal[0].team1 = st.series['K-UBF-M1']?.winner || st.grandFinal[0].team1;
        st.grandFinal[0].team2 = st.series['K-LBF']?.winner || st.grandFinal[0].team2;
    }
}

/**
 * Returns the teams that qualified for Masters (top 2 from kickoff).
 */
export function getQualifiedTeams(state) {
    const qualified = [];
    if (state.series['K-UBF-M1'] && state.series['K-UBF-M1'].winner) {
        qualified.push(state.series['K-UBF-M1'].winner);
    }
    if (state.series['K-LBF'] && state.series['K-LBF'].winner) {
        qualified.push(state.series['K-LBF'].winner);
    }
    return qualified;
}
