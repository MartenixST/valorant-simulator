/**
 * Champions 16-Team Qualification Logic
 * Top 4 teams from each region qualify based on Championship Points
 */

const REGIONS = ["Americas", "EMEA", "Pacific", "China"];

/**
 * Get top 4 teams from each region based on championship points
 * @param {Object} championshipPoints - Object with team names as keys and points as values
 * @param {Array} allPlayers - Array of player objects with team and region info
 * @returns {Object} - Object with regions as keys and arrays of qualified team names as values
 */
export function getChampions16Qualifiers(championshipPoints, allPlayers, teams, regularSeasonStandings) {
    const qualifiedByRegion = {
        Americas: [],
        EMEA: [],
        Pacific: [],
        China: []
    };
    
    // Create a map of team -> region from player data
    const teamRegions = {};
    if (allPlayers && Array.isArray(allPlayers)) {
        allPlayers.forEach(player => {
            if (player.team && player.region && !teamRegions[player.team]) {
                teamRegions[player.team] = player.region;
            }
        });
    }
    
    // Also get regions from teams data as fallback
    if (teams && Array.isArray(teams)) {
        teams.forEach(team => {
            if (team.name && team.region && !teamRegions[team.name]) {
                teamRegions[team.name] = team.region;
            }
        });
    }
    
    // Group teams by region
    const teamsByRegion = {
        Americas: [],
        EMEA: [],
        Pacific: [],
        China: []
    };
    
    // Add teams with championship points
    Object.entries(championshipPoints || {}).forEach(([teamName, points]) => {
        const region = teamRegions[teamName];
        if (region && teamsByRegion[region]) {
            teamsByRegion[region].push({ name: teamName, points: points || 0 });
        }
    });
    
    // If we don't have enough teams, fill from regular season standings
    if (regularSeasonStandings) {
        REGIONS.forEach(region => {
            const regionTeams = regularSeasonStandings[region] || [];
            const existingNames = teamsByRegion[region].map(t => t.name);
            
            // Sort by wins/record and fill missing spots
            const sortedRegionTeams = regionTeams
                .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                .slice(0, 12); // Top 12 from regular season
            
            sortedRegionTeams.forEach(team => {
                if (!existingNames.includes(team.name)) {
                    const points = (championshipPoints || {})[team.name] || 0;
                    teamsByRegion[region].push({ 
                        name: team.name, 
                        points: points,
                        wins: team.wins || 0,
                        losses: team.losses || 0
                    });
                }
            });
        });
    }
    
    // Sort each region by points and take top 4
    REGIONS.forEach(region => {
        const sorted = teamsByRegion[region]
            .sort((a, b) => b.points - a.points || (b.wins || 0) - (a.wins || 0))
            .slice(0, 4);
        qualifiedByRegion[region] = sorted;
    });
    
    // Log qualification results
    console.log("Champions 16 Qualification Results:");
    REGIONS.forEach(region => {
        console.log(`  ${region}:`, qualifiedByRegion[region].map(t => `${t.name} (${t.points} pts)`));
    });
    
    return qualifiedByRegion;
}

/**
 * Get flat array of all 16 qualified teams
 * @param {Object} qualifiedByRegion - Output from getChampions16Qualifiers
 * @returns {Array} - Array of 16 team objects with name, region, and points
 */
export function getFlatQualifiedList(qualifiedByRegion) {
    const flatList = [];
    REGIONS.forEach(region => {
        qualifiedByRegion[region].forEach(team => {
            flatList.push({
                name: team.name,
                region: region,
                points: team.points
            });
        });
    });
    return flatList;
}

/**
 * Create HTML for qualified teams display by region
 * @param {Object} qualifiedByRegion - Output from getChampions16Qualifiers
 * @returns {String} - HTML string for inbox message
 */
export function createQualifiedTeamsHTML(qualifiedByRegion) {
    const regionColors = {
        Americas: '#ff6b6b',
        EMEA: '#4ecdc4',
        Pacific: '#ffe66d',
        China: '#95e1d3'
    };
    
    let html = '';
    REGIONS.forEach(region => {
        const teams = qualifiedByRegion[region];
        if (teams && teams.length > 0) {
            html += `
                <div style="margin-bottom: 16px;">
                    <div style="color: ${regionColors[region]}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 2px solid ${regionColors[region]}; padding-bottom: 4px;">
                        ${region} (${teams.length} Teams)
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
            `;
            
            teams.forEach((team, index) => {
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#9f7aea'];
                html += `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(45,55,72,0.4); border-radius: 6px; border-left: 3px solid ${rankColors[index]};">
                        <span style="color: ${rankColors[index]}; font-weight: 700; font-size: 14px; min-width: 20px; text-align: center;">${index + 1}</span>
                        <span style="color: #fff; font-weight: 600; font-size: 13px; flex: 1;">${team.name}</span>
                        <span style="color: #8b9dc3; font-size: 11px; font-family: monospace;">${team.points} pts</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });
    
    return html;
}
