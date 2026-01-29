import { teams } from './teams.js';
import { Player } from './simulation.js';
import { generatePlayer } from './players.js';

/**
 * Handles AI roster changes for all teams except the player's team.
 * @param {Object} activeSave - The current active save state.
 * @returns {Object} - The updated save state.
 */
export function handleAiRosterChanges(activeSave) {
    if (!activeSave || !activeSave.players) return { updatedSave: activeSave, changes: [] };

    const updatedPlayers = [...activeSave.players];
    const normalize = (n) => String(n || '').toLowerCase().trim();
    
    const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
    const playerTeamNameNorm = normalize(activeSave.team);
    const changes = [];
    
    // 1. Identify all AI teams
    const aiTeams = teams.filter(t => {
        const teamIdMatch = playerTeamId && String(t.id) === playerTeamId;
        const teamNameMatch = playerTeamNameNorm && normalize(t.name) === playerTeamNameNorm;
        return !(teamIdMatch || teamNameMatch);
    });

    aiTeams.forEach(team => {
        const teamId = String(team.id);
        const teamName = team.name;
        
        // Helper to get roster
        const getRoster = () => updatedPlayers.filter(p => {
            const pTeamId = p.teamId ? String(p.teamId) : null;
            if (teamId && pTeamId) return pTeamId === teamId;
            return p.team && p.team === teamName;
        });

        let teamRoster = getRoster();
        
        // MANDATORY: Always fill understaffed rosters immediately
        while (teamRoster.length < 5) {
            const hiredPlayer = hireFreeAgentForTeam(teamId, teamName, team.region, updatedPlayers);
            if (hiredPlayer) {
                changes.push(`${team.name} signed ${hiredPlayer.name || hiredPlayer.gamertag} to fill a roster vacancy.`);
                teamRoster = getRoster(); // Refresh roster count
            } else {
                break; // Should not happen as hireFreeAgentForTeam generates if none found
            }
        }

        // 5% chance for an AI team to make a strategic move this week
        if (Math.random() > 0.05) return;

        // Team is full, maybe release worst and hire new?
        // Sort by overall to find the worst player
        teamRoster.sort((a, b) => (a.overall || 0) - (b.overall || 0));
        const worstPlayer = teamRoster[0];

        // Only release if they are significantly worse than average or just random churn
        if (worstPlayer.overall < 60 || Math.random() < 0.2) {
            // Release worst player
            const playerIndex = updatedPlayers.findIndex(p => p.id === worstPlayer.id);
            if (playerIndex !== -1) {
                updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], teamId: null, team: null };
                
                // Hire a replacement
                const hiredPlayer = hireFreeAgentForTeam(teamId, teamName, team.region, updatedPlayers);
                if (hiredPlayer) {
                    changes.push(`${team.name} released ${worstPlayer.name || worstPlayer.gamertag} and hired ${hiredPlayer.name || hiredPlayer.gamertag}.`);
                } else {
                    changes.push(`${team.name} released ${worstPlayer.name || worstPlayer.gamertag}.`);
                }
            }
        }
    });

    return { updatedSave: { ...activeSave, players: updatedPlayers }, changes };
}

export function hireFreeAgentForTeam(teamId, teamName, region, players) {
    // Find best free agent in the region
    const freeAgents = players.filter(p => p.teamId === null || p.teamId === 'null' || !p.teamId);
    
    if (freeAgents.length > 0) {
        // Sort by overall descending
        freeAgents.sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const bestFA = freeAgents[0];
        
        const faIndex = players.findIndex(p => p.id === bestFA.id);
        if (faIndex !== -1) {
            // Update the player directly if it's an instance
            if (players[faIndex] instanceof Player) {
                players[faIndex].teamId = String(teamId);
                players[faIndex].team = teamName;
            } else {
                players[faIndex] = { ...players[faIndex], teamId: String(teamId), team: teamName };
            }
            return players[faIndex];
        }
    } else {
        // No free agents? Generate one
        const newPlayer = generatePlayer(region);
        newPlayer.teamId = String(teamId);
        newPlayer.team = teamName;
        players.push(newPlayer);
        return newPlayer;
    }
    return null;
}
