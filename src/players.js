import { teams } from './teams.js';
import { Player, PlayerRating } from './simulation.js';
import { realPlayers } from './real_players.js';

// Player data generation
export const nationalities = {
    "North America": ["USA", "Canada", "Mexico"],
    "EMEA": ["UK", "France", "Germany", "Spain", "Turkey", "Russia", "Sweden", "Denmark", "Poland"],
    "Pacific": ["South Korea", "Japan", "Singapore", "Thailand", "Indonesia", "Philippines", "Australia", "India"],
    "Americas": ["Brazil", "Argentina", "Chile", "USA", "Canada"],
    "China": ["China"]
};

export const playerNames = {
    "North America": ["John", "Michael", "David", "James", "Robert", "William", "Christopher", "Joseph", "Daniel", "Matthew"],
    "EMEA": ["Lukas", "Nikita", "Antoine", "Marco", "Sven", "Erik", "Aleksandr", "Mateo", "Can", "Filip"],
    "Pacific": ["Jung", "Hiroshi", "Wei", "Somsak", "Budi", "Juan", "Liam", "Arjun", "Kenji", "Min-ho"],
    "Americas": ["Gabriel", "Lucas", "Mateus", "Diego", "Felipe", "Thiago", "Joao", "Nicolas", "Enzo", "Gustavo"],
    "China": ["Wei", "Hao", "Yi", "Bo", "Jun", "Zhe", "Chen", "Yang", "Fan", "Hui"]
};

export function generatePlayer(region = "North America", forceRole = null, forceRating = null) {
    const regionNationalities = nationalities[region] || nationalities["North America"];
    const nationality = regionNationalities[Math.floor(Math.random() * regionNationalities.length)];
    const age = Math.floor(Math.random() * 10) + 17; // 17-26
    
    const base = forceRating || 75;
    const ratings = PlayerRating.generateRandom(base, 25);
    
    const role = forceRole || Player.prototype.getRandomRole();
    const player = new Player(null, role, ratings, null, nationality, age);
    player.teamId = null; // Explicitly set teamId to null for free agents
    player.team = null;   // Explicitly set team to null for free agents
    
    return player;
}

export function generatePlayersForRegion(region, count = 20) {
    const players = [];
    for (let i = 0; i < count; i++) {
        players.push(generatePlayer(region));
    }
    return players;
}

export function assignPlayersToTeams(teamsToAssign, region) {
    const teamsWithPlayers = teamsToAssign.map(team => {
        const teamPlayers = generatePlayersForTeam(team.name, team.region || region, team.id, team.power);
        
        return {
            ...team,
            players: teamPlayers,
            // Recalculate power based on assigned players
            power: Math.round(teamPlayers.reduce((sum, p) => sum + p.overall, 0) / teamPlayers.length)
        };
    });
    return teamsWithPlayers;
}

export function generatePlayersForTeam(teamName, region, teamId = null, teamPower = 70) {
    const teamPlayers = [];
    const normalizedTeamId = (teamId !== null && teamId !== undefined) ? String(teamId) : null;
    console.log(`generatePlayersForTeam called for ${teamName} (ID: ${normalizedTeamId})`);
    
    // Check if we have real players for this team (case-insensitive)
    const realTeamKey = Object.keys(realPlayers).find(k => k.toLowerCase() === teamName.toLowerCase());
    
    if (realTeamKey) {
        console.log(`Found ${realPlayers[realTeamKey].length} real players for ${teamName} (matched as ${realTeamKey})`);
        realPlayers[realTeamKey].forEach(p => {
            const ratings = PlayerRating.generateRandom(p.baseRating, 15);
            const player = new Player(p.name, p.role, ratings, normalizedTeamId, p.nationality, p.age);
            // Also set team name for better filtering
            player.team = teamName;
            teamPlayers.push(player);
        });
        
        // Ensure 5 players
        if (teamPlayers.length < 5) {
            console.log(`Only ${teamPlayers.length} real players found, adding randoms...`);
            const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
            for (let i = teamPlayers.length; i < 5; i++) {
                const role = roles[i] || "Flex";
                const baseRating = 75 + (teamPower / 10);
                const player = generatePlayer(region, role, baseRating);
                player.teamId = normalizedTeamId;
                player.team = teamName;
                teamPlayers.push(player);
            }
        }
    } else {
        console.log(`No real players found for ${teamName}, generating randoms...`);
        const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
        roles.forEach(role => {
            const baseRating = 75 + (teamPower / 10);
            const player = generatePlayer(region, role, baseRating);
            player.teamId = normalizedTeamId;
            player.team = teamName;
            teamPlayers.push(player);
        });
    }
    
    console.log(`generatePlayersForTeam returning ${teamPlayers.length} players for ${teamName}`);
    return teamPlayers;
}

export function generateTeamWithPlayers(team) {
    const newTeam = { ...team };
    newTeam.players = generatePlayersForTeam(team.name, team.region, team.id, team.power);
    return newTeam;
}

// Get teams with players
export function getTeamsWithPlayers(forceRefresh = false) {
    // Check if we already have teams with players in localStorage
    const savedTeams = localStorage.getItem('teamsWithPlayers');
    if (savedTeams && !forceRefresh) {
        return JSON.parse(savedTeams);
    }
    
    // If not, generate new teams with players
    const teamsWithPlayers = teams.map(team => generateTeamWithPlayers(team));
    try {
        localStorage.setItem('teamsWithPlayers', JSON.stringify(teamsWithPlayers));
    } catch (e) {
        console.warn("getAllTeamsWithPlayers: localStorage quota exceeded", e);
    }
    return teamsWithPlayers;
}