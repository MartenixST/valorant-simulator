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
    "North America": {
        first: ["John", "Michael", "David", "James", "Robert", "William", "Christopher", "Joseph", "Daniel", "Matthew", "Andrew", "Joshua", "Kevin", "Brian", "Justin"],
        last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"],
        gamertags: ["Aero", "Blaze", "Cipher", "Dash", "Echo", "Frost", "Ghost", "Hades", "Icon", "Jolt", "Kryptic", "Lunar", "Moxie", "Nova", "Orbit", "Pulse", "Quantum", "Razor", "Specter", "Titan", "Vortex", "Wraith", "Xenon", "Yeti", "Zenith"]
    },
    "EMEA": {
        first: ["Lukas", "Nikita", "Antoine", "Marco", "Sven", "Erik", "Aleksandr", "Mateo", "Can", "Filip", "Marius", "Piotr", "Lars", "Olav", "Zoran"],
        last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Novak", "Ivanov", "Kuznetsov", "Popov", "Sokolov"],
        gamertags: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega"]
    },
    "Pacific": {
        first: ["Jung", "Hiroshi", "Wei", "Somsak", "Budi", "Juan", "Liam", "Arjun", "Kenji", "Min-ho", "Satoshi", "Tae-hyun", "Anwar", "Ravi", "Yuki"],
        last: ["Kim", "Lee", "Park", "Choi", "Jeong", "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Chen", "Wang", "Li", "Zhang", "Liu"],
        gamertags: ["Raijin", "Fujin", "Tengu", "Kappa", "Kitsune", "Tanuki", "Oni", "Yurei", "Bakemono", "Kodama", "Dragon", "Tiger", "Crane", "Monkey", "Snake"]
    },
    "Americas": {
        first: ["Gabriel", "Lucas", "Mateus", "Diego", "Felipe", "Thiago", "Joao", "Nicolas", "Enzo", "Gustavo", "Leonardo", "Bruno", "Rodrigo", "Ricardo", "Eduardo"],
        last: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida"],
        gamertags: ["Jaguar", "Condor", "Puma", "Caiman", "Anaconda", "Ocelot", "Toucan", "Macaw", "Harpy", "Iguana", "Capybara", "Armadillo", "Tapir", "Sloth", "Coati"]
    },
    "China": {
        first: ["Wei", "Hao", "Yi", "Bo", "Jun", "Zhe", "Chen", "Yang", "Fan", "Hui", "Tao", "Peng", "Qiang", "Lei", "Ming"],
        last: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou", "Xu", "Sun", "Ma", "Zhu", "Hu"],
        gamertags: ["Qilin", "Pixiu", "Fenghuang", "Long", "Baihu", "Zhuque", "Xuanwu", "Hundun", "Taotie", "Qiongqi", "Taowu", "Zhulong", "Bixi", "Chiwen", "Suanni"]
    }
};

export function generatePlayer(region = "North America", forceRole = null, forceRating = null) {
    const regionNationalities = nationalities[region] || nationalities["North America"];
    const nationality = regionNationalities[Math.floor(Math.random() * regionNationalities.length)];
    const age = Math.floor(Math.random() * 10) + 17; // 17-26
    
    const regionNames = playerNames[region] || playerNames["North America"];
    const gamertag = regionNames.gamertags[Math.floor(Math.random() * regionNames.gamertags.length)] + (Math.random() > 0.7 ? Math.floor(Math.random() * 99) : "");
    
    const base = forceRating || 75;
    const ratings = PlayerRating.generateRandom(base, 25);
    
    const role = forceRole || Player.prototype.getRandomRole();
    const player = new Player(gamertag, role, ratings, null, nationality, age);
    player.gamertag = gamertag; // Set gamertag explicitly as well
    player.name = gamertag;     // Ensure name is also just the gamertag
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
            // Use p.name as both name and gamertag for real players
            const player = new Player(p.name, p.role, ratings, normalizedTeamId, p.nationality, p.age);
            player.gamertag = p.name;
            player.name = p.name;
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
            const baseRating = Math.round(75 + (teamPower / 10));
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
            const baseRating = Math.round(75 + (teamPower / 10));
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