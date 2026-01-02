export class PlayerRating {
    constructor(aim, movement, gameSense, clutch, aggression, utility, mental, teamwork, consistency, potential) {
        this.aim = aim || 50;
        this.movement = movement || 50;
        this.gameSense = gameSense || 50;
        this.clutch = clutch || 50;
        this.aggression = aggression || 50;
        this.utility = utility || 50;
        this.mental = mental || 50;
        this.teamwork = teamwork || 50;
        this.consistency = consistency || 50;
        this.potential = potential || Math.max(this.overall, 70);
    }

    // Generate random ratings for a new player
    static generateRandom(base = 50, variance = 40) {
        const rand = () => Math.floor(Math.random() * variance) + base;
        const ratings = new PlayerRating(
            rand(), // Aim
            rand(), // Movement
            rand(), // Game Sense
            rand(), // Clutch
            rand(), // Aggression
            rand(), // Utility
            rand(), // Mental
            rand(), // Teamwork
            rand()  // Consistency
        );
        ratings.potential = Math.min(99, Math.max(ratings.overall, rand() + 10));
        return ratings;
    }

    get overall() {
        return Math.round((this.aim + this.movement + this.gameSense + this.clutch + this.aggression + this.utility + this.mental + this.teamwork + this.consistency) / 9);
    }
}

export const ROLES = {
    DUELIST: "Duelist",
    INITIATOR: "Initiator",
    CONTROLLER: "Controller",
    SENTINEL: "Sentinel",
    FLEX: "Flex",
    IGL: "IGL"
};

// Weapons
export const WEAPONS = {
    CLASSIC: { name: "Classic", price: 0, damage: 26, type: "Sidearm" },
    SHORTY: { name: "Shorty", price: 450, damage: 50, type: "Sidearm" },
    FRENZY: { name: "Frenzy", price: 450, damage: 26, type: "Sidearm" },
    GHOST: { name: "Ghost", price: 500, damage: 30, type: "Sidearm" },
    SHERIFF: { name: "Sheriff", price: 800, damage: 55, type: "Sidearm" },
    
    STINGER: { name: "Stinger", price: 950, damage: 27, type: "SMG" },
    SPECTRE: { name: "Spectre", price: 1600, damage: 26, type: "SMG" },
    
    BUCKY: { name: "Bucky", price: 850, damage: 20, type: "Shotgun" },
    JUDGE: { name: "Judge", price: 1850, damage: 17, type: "Shotgun" },
    
    BULLDOG: { name: "Bulldog", price: 2050, damage: 35, type: "Rifle" },
    GUARDIAN: { name: "Guardian", price: 2250, damage: 65, type: "Rifle" },
    PHANTOM: { name: "Phantom", price: 2900, damage: 39, type: "Rifle" },
    VANDAL: { name: "Vandal", price: 2900, damage: 40, type: "Rifle" },
    
    MARSHAL: { name: "Marshal", price: 950, damage: 101, type: "Sniper" },
    OUTLAW: { name: "Outlaw", price: 2400, damage: 140, type: "Sniper" },
    OPERATOR: { name: "Operator", price: 4700, damage: 150, type: "Sniper" },
    
    ARES: { name: "Ares", price: 1600, damage: 30, type: "Heavy" },
    ODIN: { name: "Odin", price: 3200, damage: 38, type: "Heavy" }
};

// Shields
export const SHIELDS = {
    NONE: { name: "No Shield", price: 0, armor: 0 },
    LIGHT: { name: "Light Shield", price: 400, armor: 25 },
    REGEN: { name: "Regen Shield", price: 650, armor: 25*3 },
    HEAVY: { name: "Heavy Shield", price: 1000, armor: 50 }
};

// Player class
export class Player {
    constructor(name, role, ratings, teamId = null, nationality = "Unknown", age = 18) {
        this.id = String(Date.now() + Math.floor(Math.random() * 1000));
        this.name = name || Player.generateGamertag();
        this.gamertag = this.name;
        this.role = role || this.getRandomRole();
        this.rating = (ratings instanceof PlayerRating) ? ratings : new PlayerRating(
            ratings?.aim, ratings?.movement, ratings?.gameSense, 
            ratings?.clutch, ratings?.aggression, ratings?.utility, 
            ratings?.mental, ratings?.teamwork, ratings?.consistency,
            ratings?.potential
        );
        this.ratings = this.rating; // Compatibility
        this.nationality = nationality;
        this.age = age;
        this.teamId = teamId;
        
        // Market value based on rating and potential
        this.marketValue = this.calculateMarketValue();
        
        this.weapon = WEAPONS.CLASSIC;
        this.shield = SHIELDS.NONE;
        this.money = 800;
        this.kills = 0;
        this.deaths = 0;
        this.assists = 0;
        this.stats = {
            kills: 0,
            deaths: 0,
            assists: 0,
            hs: 0,
            damageDealt: 0
        };
    }
    
    // Alias for compatibility with rating.getOverallRating()
    get overall() {
        return this.rating.overall;
    }

    calculateMarketValue() {
        const baseValue = 5000;
        const ratingMultiplier = Math.pow(this.overall / 60, 4); // Exponential increase for high ratings
        const potentialMultiplier = 1 + (this.rating.potential / 100);
        const ageFactor = (30 - this.age) / 12; // Younger players are slightly more valuable
        
        let value = baseValue * ratingMultiplier * potentialMultiplier * ageFactor;
        
        // Round to nearest 500
        return Math.max(1000, Math.round(value / 500) * 500);
    }

    get potential() {
        return this.rating.potential;
    }

    getOverallRating() {
        return this.rating.overall;
    }
    
    getRandomRole() {
        const roles = Object.values(ROLES);
        return roles[Math.floor(Math.random() * roles.length)];
    }
    
    // Generate a random gamertag
    static generateGamertag() {
        const prefixes = ["Toxic", "Pro", "Aim", "Clutch", "Ace", "Ninja", "Ghost", "Shadow", "Viper", "Phoenix"];
        const suffixes = ["Killer", "Slayer", "God", "Master", "King", "Legend", "Demon", "Hunter", "Shot", "Sniper"];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        return `${prefix}${suffix}${Math.floor(Math.random() * 100)}`;
    }
    
    // Buy weapons and shields based on available money
    buy(weapon, shield) {
        const weaponCost = weapon ? WEAPONS[weapon].price : 0;
        const shieldCost = shield ? SHIELDS[shield].price : 0;
        const totalCost = weaponCost + shieldCost;

        if (this.money >= totalCost) {
            this.money -= totalCost;
            if (weapon) this.weapon = WEAPONS[weapon];
            if (shield) this.shield = SHIELDS[shield];
            return true;
        }
        return false;
    }

    // Sell current weapon (only if not classic)
    sellWeapon() {
        if (this.weapon !== WEAPONS.CLASSIC) {
            this.money += this.weapon.price / 2; // Half price back
            this.weapon = WEAPONS.CLASSIC;
            return true;
        }
        return false;
    }
}

export class Team {
    constructor(name) {
        this.name = name;
        this.players = [];
        this.score = 0;
        this.side = 'attack'; // 'attack' or 'defense'
    }

    addPlayer(player) {
        this.players.push(player);
        player.teamId = this.name;
    }

    switchSide(side) {
        this.side = side || (this.side === 'attack' ? 'defense' : 'attack');
    }
}

export class EconomySystem {
    constructor() {
        console.log("EconomySystem initialized");
    }
}

export class RoundSimulator {
    constructor(attackers, defenders, roundNumber, logs) {
        this.attackers = attackers;
        this.defenders = defenders;
        this.roundNumber = roundNumber;
        this.logs = logs || [];
    }

    simulateRound() {
        const attackerPower = this.attackers.players.reduce((sum, p) => sum + p.getOverallRating(), 0);
        const defenderPower = this.defenders.players.reduce((sum, p) => sum + p.getOverallRating(), 0);
        
        const totalPower = attackerPower + defenderPower;
        const winChance = attackerPower / totalPower;
        
        const attackerWins = Math.random() < winChance;
        const winner = attackerWins ? this.attackers : this.defenders;
        const loser = attackerWins ? this.defenders : this.attackers;
        
        winner.score++;
        
        const log = `Round ${this.roundNumber}: ${winner.name} won against ${loser.name}`;
        this.logs.push(log);
        
        // Randomly assign some stats
        winner.players[Math.floor(Math.random() * 5)].kills++;
        loser.players[Math.floor(Math.random() * 5)].deaths++;
        
        return {
            winner: winner,
            logs: [log]
        };
    }
}

export class MatchSimulator {
    constructor(team1, team2, logs) {
        this.team1 = team1;
        this.team2 = team2;
        this.logs = logs || [];
    }

    simulateMatch() {
        while (this.team1.score < 13 && this.team2.score < 13) {
            const roundNum = this.team1.score + this.team2.score + 1;
            const roundSim = new RoundSimulator(
                this.team1.side === 'attack' ? this.team1 : this.team2,
                this.team1.side === 'defense' ? this.team1 : this.team2,
                roundNum,
                this.logs
            );
            roundSim.simulateRound();
            
            if (roundNum === 12) {
                this.team1.switchSide();
                this.team2.switchSide();
                this.logs.push("Sides switched!");
            }
        }
        
        const winner = this.team1.score >= 13 ? this.team1 : this.team2;
        this.logs.push(`Match finished! ${winner.name} won ${this.team1.score}-${this.team2.score}`);
        
        return {
            winner: winner,
            logs: this.logs
        };
    }
}