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
    
    const base = forceRating || 60;
    const ratings = PlayerRating.generateRandom(base, 30);
    
    const role = forceRole || Player.prototype.getRandomRole();
    const player = new Player(null, role, ratings, null, nationality, age);
    
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
        const teamPlayers = [];
        const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
        
        roles.forEach(role => {
            const baseRating = 60 + (team.power / 10);
            teamPlayers.push(generatePlayer(region, role, baseRating));
        });
        
        return {
            ...team,
            players: teamPlayers
        };
    });
    return teamsWithPlayers;
}

export function generatePlayersForTeam(teamName, region, teamId = null, teamPower = 70) {
    const teamPlayers = [];
    
    // Check if we have real players for this team
    if (realPlayers[teamName]) {
        realPlayers[teamName].forEach(p => {
            const ratings = PlayerRating.generateRandom(p.baseRating, 15);
            const player = new Player(p.name, p.role, ratings, teamId, p.nationality, p.age);
            teamPlayers.push(player);
        });
        
        // Ensure 5 players
        if (teamPlayers.length < 5) {
            const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
            for (let i = teamPlayers.length; i < 5; i++) {
                const role = roles[i] || "Flex";
                const baseRating = 60 + (teamPower / 10);
                const player = generatePlayer(region, role, baseRating);
                player.teamId = teamId;
                teamPlayers.push(player);
            }
        }
    } else {
        const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
        roles.forEach(role => {
            const baseRating = 60 + (teamPower / 10);
            const player = generatePlayer(region, role, baseRating);
            player.teamId = teamId;
            teamPlayers.push(player);
        });
    }
    
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
    localStorage.setItem('teamsWithPlayers', JSON.stringify(teamsWithPlayers));
    return teamsWithPlayers;
}