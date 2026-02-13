import { teams } from '../../teams.js';
import { Player, Team, MatchSimulator } from '../../simulation.js';

/**
 * Automates one step of the Masters Bangkok tournament.
 * If Swiss is not complete, simulates one Swiss round.
 * If Swiss is complete but Playoffs are not, simulates one Playoff round.
 */
export function automateMastersTournament(qualifiedTeamsRaw, savePlayers, simulateMatchFn, currentState = null, playerTeamName = null) {
    if (!qualifiedTeamsRaw || qualifiedTeamsRaw.length < 8) return null;

    // Sanitize qualifiedTeams to ensure they are strings (team names)
    const qualifiedTeams = qualifiedTeamsRaw.map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
    if (qualifiedTeams.length < 8) return null;

    const state = currentState || {
        swiss: {
            rounds: [], // Each round will have matches
            teamStats: {}, // { teamName: { wins: 0, losses: 0, qualified: bool, eliminated: bool } }
            matches: {} // { matchId: matchResult }
        },
        playoffs: {
            semifinals: [],
            grandFinal: null,
            matches: {}
        },
        complete: false,
        dirty: false
    };

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
            const group = teamsByScore[score].sort(() => 0.5 - Math.random());
            for (let i = 0; i < group.length - 1; i += 2) {
                const team1 = group[i];
                const team2 = group[i+1];
                const matchId = `M-SWISS-R${currentSwissRound}-${team1.replace(/\s+/g, '_')}-vs-${team2.replace(/\s+/g, '_')}`;
                
                const team1Data = teams.find(t => t.name === team1);
                const team2Data = teams.find(t => t.name === team2);
                
                if (!team1Data || !team2Data) {
                    console.error(`Could not find team data for ${team1} or ${team2}`);
                    continue;
                }

                // ALWAYS skip auto-simulation for ALL teams so user can choose
                console.log(`Generating matchup for ${team1} vs ${team2}`);
                state.swiss.matches[matchId] = {
                    team1, team2, 
                    winner: null, 
                    loser: null,
                    score: null,
                    playerStats: null
                };
                roundMatches.push({ id: matchId, team1, team2, winner: null, score: null });
                continue;
            }
        });

        state.swiss.rounds.push({ round: currentSwissRound, matches: roundMatches });
        return state;
    }

    // --- PLAYOFFS (Single Elimination) ---
    // Qualifiers are those who reached 2 wins
    const playoffTeams = qualifiedTeams.filter(t => state.swiss.teamStats[t].qualified);
    
    // Semifinals
    if (state.playoffs.semifinals.length === 0 && playoffTeams.length >= 4) {
        const shuffledPlayoffTeams = [...playoffTeams].sort(() => 0.5 - Math.random());
        for (let i = 0; i < 4; i += 2) {
            const team1 = shuffledPlayoffTeams[i];
            const team2 = shuffledPlayoffTeams[i+1];
            const matchId = `M-PLAYOFF-SF${(i/2)+1}`;
            
            const team1Data = teams.find(t => t.name === team1);
            const team2Data = teams.find(t => t.name === team2);
            
            if (!team1Data || !team2Data) {
                console.error(`Could not find team data for ${team1} or ${team2}`);
                continue;
            }

            // ALWAYS skip auto-simulation for ALL teams so user can choose
            console.log(`Generating playoff matchup for ${team1} vs ${team2}`);
            state.playoffs.matches[matchId] = {
                team1, team2,
                winner: null,
                loser: null,
                score: null,
                playerStats: null
            };
            state.playoffs.semifinals.push(matchId);
            continue;
        }
        return state;
    }

    // Grand Final
    if (state.playoffs.semifinals.length === 2 && !state.playoffs.grandFinal) {
        const m1Id = state.playoffs.semifinals[0];
        const m2Id = state.playoffs.semifinals[1];
        const m1 = state.playoffs.matches[m1Id];
        const m2 = state.playoffs.matches[m2Id];
        
        // CRITICAL: Stop if either semifinal is not finished
        if (!m1 || !m1.winner || !m2 || !m2.winner) {
            console.log("Semifinals are not yet finished. Skipping Grand Final generation.");
            return state;
        }

        const f1 = m1.winner;
        const f2 = m2.winner;
        const gfMatchId = 'M-PLAYOFF-GF';
        
        const f1Data = teams.find(t => t.name === f1);
        const f2Data = teams.find(t => t.name === f2);
        
        if (!f1Data || !f2Data) return state;

        // ALWAYS skip auto-simulation for ALL teams so user can choose
        console.log(`Generating Grand Final matchup for ${f1} vs ${f2}`);
        state.playoffs.matches[gfMatchId] = {
            team1: f1, team2: f2, 
            winner: null, 
            loser: null,
            score: null, 
            playerStats: null
        };
        state.playoffs.grandFinal = gfMatchId;
        return state;
    }

    // Check if tournament is complete (Grand Final has a winner)
    if (state.playoffs.grandFinal) {
        const gfMatch = state.playoffs.matches[state.playoffs.grandFinal];
        if (gfMatch && gfMatch.winner) {
            state.complete = true;
        }
    }

    return state;
}

function getSafeTeamByName(name, players) {
    const teamData = teams.find(t => t.name === name);
    if (!teamData) return { name, id: 'unknown' };
    return teamData;
}
