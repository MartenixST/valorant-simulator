import { teams } from './teams.js';
import { Player, PlayerRating } from './simulation.js';
import { realPlayers } from './real_players.js';

// Player data generation
export const nationalities = {
    "EMEA": ["UK", "France", "Germany", "Spain", "Turkey", "Russia", "Sweden", "Denmark", "Poland"],
    "Pacific": ["South Korea", "Japan", "Singapore", "Thailand", "Indonesia", "Philippines", "Australia", "India"],
    "Americas": ["Brazil", "Argentina", "Chile", "USA", "Canada", "Mexico"],
    "China": ["China"]
};

export const playerNames = {
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
        first: ["Gabriel", "Lucas", "Mateus", "Diego", "Felipe", "Thiago", "Joao", "Nicolas", "Enzo", "Gustavo", "Leonardo", "Bruno", "Rodrigo", "Ricardo", "Eduardo", "John", "Michael", "David", "James", "Robert", "William", "Christopher", "Joseph", "Daniel", "Matthew", "Andrew", "Joshua", "Kevin", "Brian", "Justin"],
        last: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"],
        gamertags: ["Jaguar", "Condor", "Puma", "Caiman", "Anaconda", "Ocelot", "Toucan", "Macaw", "Harpy", "Iguana", "Capybara", "Armadillo", "Tapir", "Sloth", "Coati", "Aero", "Blaze", "Cipher", "Dash", "Echo", "Frost", "Ghost", "Hades", "Icon", "Jolt", "Kryptic", "Lunar", "Moxie", "Nova", "Orbit", "Pulse", "Quantum", "Razor", "Specter", "Titan", "Vortex", "Wraith", "Xenon", "Yeti", "Zenith"]
    },
    "China": {
        first: ["Wei", "Hao", "Yi", "Bo", "Jun", "Zhe", "Chen", "Yang", "Fan", "Hui", "Tao", "Peng", "Qiang", "Lei", "Ming"],
        last: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou", "Xu", "Sun", "Ma", "Zhu", "Hu"],
        gamertags: ["Qilin", "Pixiu", "Fenghuang", "Long", "Baihu", "Zhuque", "Xuanwu", "Hundun", "Taotie", "Qiongqi", "Taowu", "Zhulong", "Bixi", "Chiwen", "Suanni"]
    }
};

let regionalEliteCount = {};

export function resetRegionalEliteCount() {
    regionalEliteCount = {};
}

export function generatePlayer(region = "Americas", forceRole = null, forceRating = null) {
    const regionNationalities = nationalities[region] || nationalities["Americas"];
    const nationality = regionNationalities[Math.floor(Math.random() * regionNationalities.length)];
    const age = Math.floor(Math.random() * 10) + 17; // 17-26
    
    const regionNames = playerNames[region] || playerNames["Americas"];
    const gamertag = regionNames.gamertags[Math.floor(Math.random() * regionNames.gamertags.length)] + (Math.random() > 0.7 ? Math.floor(Math.random() * 99) : "");
    
    // Default range 40-74. Only 5 elites (75-80) per region.
    let base = forceRating;
    if (base === null) {
        if (!regionalEliteCount[region]) regionalEliteCount[region] = 0;
        
        if (regionalEliteCount[region] < 5 && Math.random() < 0.05) { // 5% chance to be elite if slots available
            base = Math.floor(Math.random() * 6) + 75; // 75-80
            regionalEliteCount[region]++;
        } else {
            base = Math.floor(Math.random() * 35) + 40; // 40-74
        }
    } else {
        // If forceRating is provided, we should still respect the 40-80 range
        base = Math.max(40, Math.min(80, base));
    }

    const ratings = PlayerRating.generateRandom(base, 15); // Lower variance for more consistent ratings around the base
    
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

// Ensure exactly one IGL if multiple were assigned or none
export function ensureIglAssignment(teamPlayers) {
    if (!teamPlayers || teamPlayers.length === 0) return teamPlayers;
    
    const igls = teamPlayers.filter(p => p.isIGL);
    if (igls.length !== 1) {
        // Remove IGL from everyone
        teamPlayers.forEach(p => p.isIGL = false);
        
        // Assign IGL to the best player by overall (or just first)
        // We prefer someone in the top 5 (starters)
        const starters = [...teamPlayers].sort((a, b) => {
            const getOvr = (p) => {
                if (typeof p.overall === 'number') return p.overall;
                if (p.rating) {
                    const stats = [
                        p.rating.aim, p.rating.movement, p.rating.gameSense, 
                        p.rating.clutch, p.rating.aggression, p.rating.utility, 
                        p.rating.mental, p.rating.teamwork, p.rating.consistency
                    ];
                    return Math.round(stats.reduce((a, b) => a + b, 0) / 9);
                }
                return 50;
            };
            return getOvr(b) - getOvr(a);
        }).slice(0, 5);

        if (starters.length > 0) {
            // Pick the best starter
            starters[0].isIGL = true;
        } else {
            teamPlayers[0].isIGL = true;
        }
    }
    return teamPlayers;
}

export function generatePlayersForTeam(teamName, region, teamId, teamPower = 70) {
    const teamPlayers = [];
    const normalizedTeamId = (teamId !== null && teamId !== undefined) ? String(teamId) : null;
    console.log(`generatePlayersForTeam called for ${teamName} (ID: ${normalizedTeamId})`);
    
    // Check if we have real players for this team (case-insensitive)
    const realTeamKey = Object.keys(realPlayers).find(k => k.toLowerCase() === teamName.toLowerCase());
    
    if (realTeamKey) {
        console.log(`Found ${realPlayers[realTeamKey].length} real players for ${teamName} (matched as ${realTeamKey})`);
        
        // Career mode: Add randomness so no team is guaranteed to dominate
        // Each new career, real teams get different player performances
        const careerVariance = () => Math.floor(Math.random() * 20) - 10; // -10 to +10 variance
        
        realPlayers[realTeamKey].forEach((p, index) => {
            // Scale real player ratings (originally ~70-90) to our new 40-80 range
            // High ratings (75+) should be rare.
            let baseRating = p.baseRating;
            if (baseRating > 70) {
                // Map 70-90 to 55-80
                baseRating = 55 + (baseRating - 70) * (25 / 20);
            } else {
                // Map <70 to 40-55
                baseRating = 40 + (baseRating / 70) * 15;
            }
            
            // Career mode balance: Add variance so any team can win
            baseRating += careerVariance();
            baseRating = Math.max(45, Math.min(85, baseRating)); // Keep within 45-85 range
            
            // Limit elite players (75+)
            if (baseRating >= 75) {
                if (!regionalEliteCount[region]) regionalEliteCount[region] = 0;
                if (regionalEliteCount[region] >= 8) { // Increased from 5 to 8 for more variety
                    baseRating = 70 + Math.floor(Math.random() * 5); // 70-74 if elite slots full
                } else {
                    regionalEliteCount[region]++;
                }
            }

            // Increased variance for more unpredictable careers
            const ratings = PlayerRating.generateRandom(baseRating, 15);
            // Use p.name as both name and gamertag for real players
            const player = new Player(p.name, p.role, ratings, normalizedTeamId, p.nationality, p.age);
            player.gamertag = p.name;
            player.name = p.name;
            // Also set team name for better filtering
            player.team = teamName;
            
            // Set all 5 players as starters (isStarter = true, status = 'active')
            player.isStarter = true;
            player.status = 'active';
            
            // Set first player as IGL by default for real teams if they have a dedicated IGL role (not in our ROLES anymore but maybe in realPlayers data)
            // or just pick the first one
            if (p.role === 'IGL' || index === 0) {
                player.isIGL = true;
            }
            
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
                // Set as starter
                player.isStarter = true;
                player.status = 'active';
                teamPlayers.push(player);
            }
        }
        
        ensureIglAssignment(teamPlayers);
    } else {
        console.log(`No real players found for ${teamName}, generating randoms...`);
        const roles = ["Duelist", "Duelist", "Initiator", "Controller", "Sentinel"];
        
        // Career mode: Give random teams a chance to be competitive
        // Random team power level for this career (45-75 range)
        const teamCareerPower = Math.floor(Math.random() * 30) + 45;
        
        roles.forEach((role, index) => {
            // Randomly generated teams now have competitive ratings
            // Base range: 50-70 (up from 45-65) with potential for elites
            let baseRating = Math.floor(Math.random() * 25) + 50; // 50-75 base for random teams
            
            // Check for elite slot (increased chance to 10%)
            if (Math.random() < 0.10) { // 10% chance for an elite player in a random team
                if (!regionalEliteCount[region]) regionalEliteCount[region] = 0;
                if (regionalEliteCount[region] < 8) {
                    baseRating = Math.floor(Math.random() * 10) + 72; // 72-82
                    regionalEliteCount[region]++;
                }
            }
            
            // Ensure at least one good player per random team
            if (index === 0 && baseRating < 65) {
                baseRating = 65 + Math.floor(Math.random() * 10); // First player at least 65-74
            }

            const player = generatePlayer(region, role, baseRating);
            player.teamId = normalizedTeamId;
            player.team = teamName;
            // Set all 5 as starters
            player.isStarter = true;
            player.status = 'active';
            if (index === 0) player.isIGL = true; // First player is IGL
            teamPlayers.push(player);
        });
        
        ensureIglAssignment(teamPlayers);
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