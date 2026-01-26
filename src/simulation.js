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
        
        // Potential should always be at least the current overall
        const currentOverall = this.calculateOverall();
        this.potential = Math.round((potential || Math.max(currentOverall, 70)) * 10) / 10;
    }

    // Generate random ratings for a new player
    static generateRandom(base = 75, variance = 30) {
        // Ensure base is high enough for competitive play
        const effectiveBase = Math.max(base, 65);
        const rand = () => Math.floor(Math.random() * variance) + (effectiveBase - variance/2);
        
        const ratings = new PlayerRating(
            Math.max(1, Math.min(99, rand())), // Aim
            Math.max(1, Math.min(99, rand())), // Movement
            Math.max(1, Math.min(99, rand())), // Game Sense
            Math.max(1, Math.min(99, rand())), // Clutch
            Math.max(1, Math.min(99, rand())), // Aggression
            Math.max(1, Math.min(99, rand())), // Utility
            Math.max(1, Math.min(99, rand())), // Mental
            Math.max(1, Math.min(99, rand())), // Teamwork
            Math.max(1, Math.min(99, rand()))  // Consistency
        );
        
        const overall = ratings.overall;
        // Potential should be at least the overall, but can go up to 99
        ratings.potential = Math.min(99, Math.max(overall, Math.floor(Math.random() * (100 - overall)) + overall));
        return ratings;
    }

    calculateOverall() {
        const avg = (this.aim + this.movement + this.gameSense + this.clutch + this.aggression + this.utility + this.mental + this.teamwork + this.consistency) / 9;
        return Math.round(avg * 10) / 10;
    }

    get overall() {
        return this.calculateOverall();
    }

    static fromJSON(data) {
        if (!data) return null;
        
        // Handle case where data might be a simple number (old rating format)
        let ratingData = data;
        if (typeof ratingData === 'number') {
            ratingData = {
                aim: ratingData,
                movement: ratingData,
                gameSense: ratingData,
                clutch: ratingData,
                aggression: ratingData,
                utility: ratingData,
                mental: ratingData,
                teamwork: ratingData,
                consistency: ratingData,
                potential: ratingData + 10
            };
        }

        const ratings = new PlayerRating(
            Number(ratingData?.aim ?? 50),
            Number(ratingData?.movement ?? 50),
            Number(ratingData?.gameSense ?? 50),
            Number(ratingData?.clutch ?? 50),
            Number(ratingData?.aggression ?? 50),
            Number(ratingData?.utility ?? 50),
            Number(ratingData?.mental ?? 50),
            Number(ratingData?.teamwork ?? 50),
            Number(ratingData?.consistency ?? 50),
            Number(ratingData?.potential ?? 70)
        );
        return ratings;
    }

    // New development logic
    develop() {
        // Higher potential means faster and more likely growth
        const growthChance = (this.potential / 100) * 0.4; // Up to 40% chance of growth
        const declineChance = (1 - (this.potential / 100)) * 0.1; // Small chance of decline if potential is low

        const stats = ['aim', 'movement', 'gameSense', 'clutch', 'aggression', 'utility', 'mental', 'teamwork', 'consistency'];
        
        stats.forEach(stat => {
            if (Math.random() < growthChance) {
                // Grow by 0.1 to 1.5 points, rounded to 1 decimal place
                const growth = Math.random() * 1.4 + 0.1;
                this[stat] = Math.round(Math.min(99, this[stat] + growth) * 10) / 10;
            } else if (Math.random() < declineChance) {
                // Small chance to decline slightly, rounded to 1 decimal place
                const decline = Math.random() * 0.5;
                this[stat] = Math.round(Math.max(1, this[stat] - decline) * 10) / 10;
            }
        });

        // Potential naturally declines very slowly as player nears it
        if (this.calculateOverall() >= this.potential - 5) {
            this.potential = Math.max(this.calculateOverall(), this.potential - 0.05);
        }

        // Update potential to be at least overall, and round it
        this.potential = Math.round(Math.max(this.potential, this.overall) * 10) / 10;
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
        this.id = String(Date.now() + Math.random().toString(36).substr(2, 9));
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
        this.teamId = (teamId !== null && teamId !== undefined && teamId !== 'undefined' && teamId !== 'null') ? String(teamId) : null;
        this.team = null; // Add team name property
        this.status = "active"; // "active" or "bench"
        
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

    get potential() {
        return this.rating.potential;
    }

    getOverallRating() {
        return this.rating.overall;
    }

    calculateMarketValue() {
        const rating = this.overall || 75;
        // Base salary of 50,000, scales up with rating
        // A player with 60 rating gets ~50,000
        // A player with 90 rating gets ~250,000+
        const base = 50000;
        if (rating <= 60) return base;
        
        const scaled = Math.floor(Math.pow(rating / 60, 4) * base);
        // Round to nearest 1000 for cleaner numbers
        return Math.round(scaled / 1000) * 1000;
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

    static fromJSON(data) {
        if (!data) return null;
        
        // If it's already a Player instance with the necessary methods, return it
        if (data instanceof Player && typeof data.getOverallRating === 'function') return data;
        
        // Ensure we always have some rating data
        let ratingData = data.rating || data.ratings;
        if (!ratingData) {
            // Fallback for very old data or missing ratings
            const base = data.overall || 75;
            ratingData = {
                aim: base, movement: base, gameSense: base,
                clutch: base, aggression: base, utility: base,
                mental: base, teamwork: base, consistency: base,
                potential: base + 5
            };
        }
        
        const ratings = PlayerRating.fromJSON(ratingData);
        
        const player = new Player(
            data.name || data.gamertag, 
            data.role, 
            ratings, 
            data.teamId, 
            data.nationality || "Unknown", 
            data.age ? Number(data.age) : 18
        );
        
        // Use a consistent ID if provided
        if (data.id) player.id = String(data.id);
        
        player.gamertag = data.gamertag || data.name || player.gamertag;
        player.money = Number(data.money ?? 800);
        player.kills = Number(data.kills ?? 0);
        player.deaths = Number(data.deaths ?? 0);
        player.assists = Number(data.assists ?? 0);
        player.stats = data.stats || { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
        player.status = data.status || "active";
        
        // Preserve team name if present
        if (data.team) player.team = data.team;
        
        // Ensure ALL properties from data are copied to the instance
        // This is critical for preserving nationality, age, etc.
        Object.keys(data).forEach(key => {
            // Don't overwrite the complex objects we just handled
            // AND skip read-only getters like 'overall' and 'potential'
            if (['rating', 'ratings', 'stats', 'overall', 'potential'].includes(key)) return;
            
            // For simple properties, if they exist in data, copy them
            if (data[key] !== undefined && data[key] !== null) {
                // If it's age, ensure it's a number
                if (key === 'age') player.age = Number(data[key]);
                else if (key === 'teamId') player.teamId = String(data[key]);
                else player[key] = data[key];
            }
        });

        // CRITICAL: Recalculate market value AFTER copying properties to ensure it's not the old 5k
        if (!player.marketValue || player.marketValue < 50000) {
            player.marketValue = player.calculateMarketValue();
        }

        return player;
    }
}

export class Team {
    constructor(name, id = null) {
        this.name = name;
        this.id = id !== null && id !== undefined ? String(id) : null;
        this.players = [];
        this.score = 0;
        this.side = 'attack'; // 'attack' or 'defense'
    }

    addPlayer(player) {
        this.players.push(player);
        if (this.id) {
            player.teamId = String(this.id);
        } else {
            player.teamId = String(this.name);
        }
    }

    switchSide(side) {
        this.side = side || (this.side === 'attack' ? 'defense' : 'attack');
    }

    get power() {
        const activePlayers = this.players.filter(p => p.status !== 'bench');
        if (activePlayers.length === 0) return 50;
        return Math.round((activePlayers.reduce((sum, p) => sum + p.overall, 0) / activePlayers.length) * 10) / 10;
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
        // In manual match simulation, we pass exactly 5 players. 
        // In weekly simulation, we might have more and need to filter by status.
        const activeAttackers = this.attackers.players.length <= 5 ? this.attackers.players : this.attackers.players.filter(p => p.status !== 'bench').slice(0, 5);
        const activeDefenders = this.defenders.players.length <= 5 ? this.defenders.players : this.defenders.players.filter(p => p.status !== 'bench').slice(0, 5);

        const attackerPower = activeAttackers.reduce((sum, p) => sum + p.getOverallRating(), 0);
        const defenderPower = activeDefenders.reduce((sum, p) => sum + p.getOverallRating(), 0);
        
        // Base win chance on power, but add some variance
        const totalPower = attackerPower + defenderPower;
        let winChance = attackerPower / (totalPower || 1);
        
        // Advantage to defense (typical in Valorant)
        winChance -= 0.02; 
        
        // Clamp win chance
        winChance = Math.max(0.1, Math.min(0.9, winChance));
        
        const attackerWins = Math.random() < winChance;
        const winner = attackerWins ? this.attackers : this.defenders;
        const loser = attackerWins ? this.defenders : this.attackers;
        const activeWinnerPlayers = attackerWins ? activeAttackers : activeDefenders;
        const activeLoserPlayers = attackerWins ? activeDefenders : activeAttackers;
        
        winner.score++;
        
        const log = `Round ${this.roundNumber}: ${winner.name} won against ${loser.name}`;
        this.logs.push(log);
        
        // --- Realistic Stat Simulation ---
        // Loser deaths: 4 or 5 (most common outcomes)
        const loserDeathsCount = Math.random() < 0.7 ? 5 : 4;
        // Winner deaths: 0 to 4
        const winnerDeathsCount = Math.floor(Math.random() * 5);

        const simulateDeath = (victimTeam, killerTeam) => {
            const victim = victimTeam[Math.floor(Math.random() * victimTeam.length)];
            
            // Weight killer selection by overall rating
            const totalKillerPower = killerTeam.reduce((sum, p) => sum + p.overall, 0);
            let r = Math.random() * totalKillerPower;
            let killer = killerTeam[killerTeam.length - 1];
            for (let p of killerTeam) {
                r -= p.overall;
                if (r <= 0) {
                    killer = p;
                    break;
                }
            }

            if (victim && killer) {
                // Update victim
                victim.deaths++;
                if (!victim.stats) victim.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
                victim.stats.deaths++;

                // Update killer
                killer.kills++;
                if (!killer.stats) killer.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
                killer.stats.kills++;
                
                // HS chance based on aim
                if (Math.random() < (killer.rating.aim / 250) + 0.1) {
                    killer.stats.hs++;
                }

                // Killer damage (at least 150 for the kill)
                killer.stats.damageDealt += 150 + Math.floor(Math.random() * 50);

                // Optional assist
                const assistCandidate = killerTeam.filter(p => p.id !== killer.id);
                if (assistCandidate.length > 0 && Math.random() < 0.35) {
                    const assister = assistCandidate[Math.floor(Math.random() * assistCandidate.length)];
                    assister.assists++;
                    if (!assister.stats) assister.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
                    assister.stats.assists++;
                    // Assister damage
                    assister.stats.damageDealt += 50 + Math.floor(Math.random() * 50);
                }
            }
        };

        // Simulate deaths for loser team (killed by winner team)
        for (let i = 0; i < loserDeathsCount; i++) {
            simulateDeath(activeLoserPlayers, activeWinnerPlayers);
        }

        // Simulate deaths for winner team (killed by loser team)
        for (let i = 0; i < winnerDeathsCount; i++) {
            simulateDeath(activeWinnerPlayers, activeLoserPlayers);
        }

        // Add some "chip damage" for everyone else who didn't get a kill/assist
        [...activeWinnerPlayers, ...activeLoserPlayers].forEach(p => {
            if (!p.stats) p.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, damageDealt: 0 };
            p.stats.damageDealt += Math.floor(Math.random() * 40);
        });
        
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