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
        this.potential = Math.round(potential || Math.max(currentOverall, 70));
    }

    // Generate random ratings for a new player
    static generateRandom(base = 60, variance = 40) {
        // Range: base +/- variance/2
        // If base is 60 and variance is 40, range is 40-80
        const rand = () => Math.round(Math.floor(Math.random() * variance) + (base - variance/2));
        
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
        return Math.round(avg);
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
    develop(activity = 'standard') {
        // Slower growth logic:
        // 1. Lower base growth chance (max 15% instead of 40%)
        // 2. High potential ("gifted") players get a slight boost
        const isGifted = this.potential >= 85;
        let baseGrowthChance = (this.potential / 100) * 0.15; 
        if (isGifted) baseGrowthChance *= 1.2; // Gifted players grow slightly more consistently

        const declineChance = (1 - (this.potential / 100)) * 0.05; // Lower decline chance

        // Activity modifiers
        let activityMultiplier = 1.0;
        if (activity === 'scrim') {
            activityMultiplier = 1.3;
        }

        const stats = ['aim', 'movement', 'gameSense', 'clutch', 'aggression', 'utility', 'mental', 'teamwork', 'consistency'];
        
        // Instead of checking all 9 stats, only pick 3 random stats to potentially grow each week
        // This significantly slows down overall progression
        const shuffledStats = [...stats].sort(() => 0.5 - Math.random());
        const statsToProcess = shuffledStats.slice(0, 3);

        statsToProcess.forEach(stat => {
            let statGrowthChance = baseGrowthChance * activityMultiplier;
            let growthAmount = 1; // Always 1 point instead of 1-2

            // Activity specific stat boosts
            if (activity === 'practice') {
                if (stat === 'aim' || stat === 'movement') {
                    statGrowthChance *= 1.5;
                }
            } else if (activity === 'bonding') {
                if (stat === 'teamwork' || stat === 'mental') {
                    statGrowthChance *= 1.5;
                }
            }

            if (Math.random() < statGrowthChance) {
                // Slower growth: Only 1 point at a time
                this[stat] = Math.min(99, this[stat] + growthAmount);
            } else if (Math.random() < declineChance) {
                // Small chance to decline slightly
                this[stat] = Math.max(1, this[stat] - 1);
            }
        });

        // Potential naturally declines very slowly as player nears it
        if (this.calculateOverall() >= this.potential - 3) {
            if (Math.random() < 0.05) { // 5% chance to drop potential (was 10%)
                this.potential = Math.max(this.calculateOverall(), this.potential - 1);
            }
        }

        // Update potential to be at least overall, and round it
        this.potential = Math.round(Math.max(this.potential, this.overall));
    }

    // Performance-based rating changes
    applyMatchPerformance(stats) {
        if (!stats || stats.rounds === 0) return;

        const adr = stats.damage / stats.rounds;
        const kd = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
        const hsPercent = stats.kills > 0 ? (stats.hs / stats.kills) * 100 : 0;

        // Determine if performance was "good", "average", or "bad"
        // Requirements are now stricter
        let performanceScore = 0;
        
        // ADR contribution (average is ~130-150)
        if (adr > 180) performanceScore += 2;
        else if (adr > 160) performanceScore += 1;
        else if (adr < 90) performanceScore -= 1;
        else if (adr < 70) performanceScore -= 2;

        // KD contribution (average is 1.0)
        if (kd > 1.8) performanceScore += 2;
        else if (kd > 1.4) performanceScore += 1;
        else if (kd < 0.7) performanceScore -= 1;
        else if (kd < 0.5) performanceScore -= 2;

        // Apply changes to specific stats based on performance
        // Much lower chance to gain stats (20% instead of 50%)
        if (performanceScore > 0) {
            // Good performance - boost stats
            const statsToBoost = ['aim', 'consistency', 'mental'];
            if (adr > 170) statsToBoost.push('aggression');
            if (hsPercent > 45) statsToBoost.push('aim');
            
            const isGifted = this.potential >= 85;

            statsToBoost.forEach(s => {
                // Slower: Only 20% chance to gain 1 point (30% if gifted)
                const gainChance = isGifted ? 0.3 : 0.2;
                if (Math.random() < gainChance) {
                    this[s] = Math.min(99, this[s] + 1);
                }
            });

            // Potential only increases on legendary performances
            const potentialGainChance = isGifted ? 0.1 : 0.05;
            if (performanceScore >= 4 && Math.random() < potentialGainChance) {
                this.potential = Math.min(99, this.potential + 1);
            }
        } else if (performanceScore < 0) {
            // Bad performance - potential for slight dip
            const statsToDip = ['consistency', 'mental'];
            const dipAmount = 1;
            
            statsToDip.forEach(s => {
                // Slower: Only 15% chance to lose 1 point
                if (Math.random() < 0.15) {
                    this[s] = Math.max(1, this[s] - dipAmount);
                }
            });
        }
        
        this.potential = Math.round(Math.max(this.potential, this.overall));
    }
}

export const ROLES = {
    DUELIST: "Duelist",
    INITIATOR: "Initiator",
    CONTROLLER: "Controller",
    SENTINEL: "Sentinel",
    FLEX: "Flex"
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
        this.isIGL = false;
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
        return this.rating ? this.rating.overall : 0;
    }

    set overall(value) {
        // overall is a computed property from ratings, so we don't allow setting it directly
        // but we provide a setter to prevent "only a getter" errors in legacy code
    }

    get potential() {
        return this.rating ? this.rating.potential : 0;
    }

    set potential(value) {
        if (this.rating) {
            this.rating.potential = value;
        }
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
        player.isIGL = !!data.isIGL;
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
        // Teams must have at least 5 players to be eligible
        if (this.players.length < 5) return 0;

        // Filter for active players first
        const activeRoster = this.players.filter(p => p.status === 'active');
        
        // Sort players by overall rating to get the strongest 5
        const sortedPlayers = [...activeRoster].sort((a, b) => b.overall - a.overall);
        const activePlayers = sortedPlayers.slice(0, 5);
        
        if (activePlayers.length === 0) return 50;
        
        let basePower = activePlayers.reduce((sum, p) => sum + p.overall, 0) / activePlayers.length;
        
        // IGL Bonus: If the team has a designated IGL among active players, they get a strategy boost
        const igl = activePlayers.find(p => p.isIGL);
        if (igl) {
            // Bonus scales with IGL's game sense and teamwork (up to +5 overall)
            const iglBonus = ((igl.rating.gameSense + igl.rating.teamwork) / 200) * 5;
            basePower += iglBonus;
        }

        return Math.round(basePower);
    }
}

// Map Coordinates for Interactive Map (Percentage based x, y)
export const MAP_COORDINATES = {
    'Abyss': {
        'Attack Spawn': { x: 50, y: 92 },
        'Defense Spawn': { x: 50, y: 8 },
        'A Site': { x: 80, y: 35 },
        'B Site': { x: 20, y: 35 },
        'Mid': { x: 50, y: 50 },
        'A Main': { x: 75, y: 65 },
        'B Main': { x: 25, y: 65 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['B Main'], 'Mid': ['Mid'] },
            'A Main': { 'A Site': ['A Site'] },
            'B Main': { 'B Site': ['B Site'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    },
    'Ascent': {
        'Attack Spawn': { x: 50, y: 88 },
        'Defense Spawn': { x: 50, y: 12 },
        'A Site': { x: 82, y: 32 },
        'B Site': { x: 18, y: 32 },
        'Mid': { x: 50, y: 50 },
        'A Main': { x: 75, y: 65 },
        'B Main': { x: 25, y: 65 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['B Main'], 'Mid': ['Mid'] },
            'A Main': { 'A Site': ['A Site'] },
            'B Main': { 'B Site': ['B Site'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    },
    'Bind': {
        'Attack Spawn': { x: 50, y: 92 },
        'Defense Spawn': { x: 50, y: 10 },
        'A Site': { x: 85, y: 35 },
        'B Site': { x: 15, y: 35 },
        'A Short': { x: 70, y: 55 },
        'B Long': { x: 30, y: 65 },
        'Hookah': { x: 20, y: 50 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Short'], 'B Site': ['B Long', 'Hookah'] },
            'A Short': { 'A Site': ['A Site'] },
            'B Long': { 'B Site': ['B Site'] },
            'Hookah': { 'B Site': ['B Site'] }
        }
    },
    'Haven': {
        'Attack Spawn': { x: 50, y: 92 },
        'Defense Spawn': { x: 50, y: 8 },
        'A Site': { x: 85, y: 30 },
        'B Site': { x: 50, y: 30 },
        'C Site': { x: 15, y: 30 },
        'Mid': { x: 50, y: 60 },
        'A Main': { x: 80, y: 65 },
        'C Main': { x: 20, y: 65 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['Mid'], 'C Site': ['C Main'] },
            'A Main': { 'A Site': ['A Site'] },
            'Mid': { 'B Site': ['B Site'], 'A Site': ['A Site'], 'C Site': ['C Site'] },
            'C Main': { 'C Site': ['C Site'] }
        }
    },
    'Split': {
        'Attack Spawn': { x: 15, y: 92 },
        'Defense Spawn': { x: 85, y: 8 },
        'A Site': { x: 80, y: 28 },
        'B Site': { x: 20, y: 28 },
        'Mid': { x: 50, y: 55 },
        'A Main': { x: 75, y: 72 },
        'B Main': { x: 25, y: 72 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['B Main'], 'Mid': ['Mid'] },
            'A Main': { 'A Site': ['A Site'] },
            'B Main': { 'B Site': ['B Site'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    },
    'Sunset': {
        'Attack Spawn': { x: 85, y: 92 },
        'Defense Spawn': { x: 15, y: 8 },
        'A Site': { x: 82, y: 34 },
        'B Site': { x: 18, y: 34 },
        'Mid': { x: 50, y: 55 },
        'A Main': { x: 78, y: 68 },
        'B Main': { x: 22, y: 68 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['B Main'], 'Mid': ['Mid'] },
            'A Main': { 'A Site': ['A Site'] },
            'B Main': { 'B Site': ['B Site'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    },
    'Pearl': {
        'Attack Spawn': { x: 10, y: 50 },
        'Defense Spawn': { x: 90, y: 50 },
        'A Site': { x: 80, y: 38 },
        'B Site': { x: 15, y: 38 },
        'Mid': { x: 50, y: 55 },
        'A Main': { x: 72, y: 72 },
        'B Main': { x: 28, y: 75 },
        'paths': {
            'Attack Spawn': { 'A Site': ['A Main'], 'B Site': ['B Main'], 'Mid': ['Mid'] },
            'A Main': { 'A Site': ['A Site'] },
            'B Main': { 'B Site': ['B Site'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    },
    'Corrode': {
        'Attack Spawn': { x: 90, y: 50 },
        'Defense Spawn': { x: 10, y: 50 },
        'A Site': { x: 78, y: 35 },
        'B Site': { x: 22, y: 35 },
        'Mid': { x: 50, y: 50 },
        'paths': {
            'Attack Spawn': { 'A Site': ['Mid'], 'B Site': ['Mid'], 'Mid': ['Mid'] },
            'Mid': { 'A Site': ['A Site'], 'B Site': ['B Site'] }
        }
    }
};

export class RoundSimulator {
    constructor(attackers, defenders, roundNumber, logs, strategies = {}, mapName = 'Ascent') {
        this.attackers = attackers;
        this.defenders = defenders;
        this.roundNumber = roundNumber;
        this.logs = logs || [];
        this.strategies = strategies; // { team1Id: strategy, team2Id: strategy }
        this.mapName = mapName;
    }

    // Helper to get random position in a zone with jitter
    getRandomPos(zoneName, playerIndex = 0, teamSide = null) {
        const mapData = MAP_COORDINATES[this.mapName] || MAP_COORDINATES['Ascent'];
        
        let targetZoneName = zoneName;
        // Map specific side names to coordinate keys if needed
        if (zoneName === 'Spawn') {
            targetZoneName = teamSide === 'attack' ? 'Attack Spawn' : 'Defense Spawn';
        }

        const zone = mapData[targetZoneName] || { x: 50, y: 50 };
        
        // Use player index to create a deterministic offset to prevent overlap
        // but still keep it within the zone
        const angle = (playerIndex / 5) * Math.PI * 2;
        const radius = 2 + Math.random() * 2; // 2-4% radius
        
        return {
            x: zone.x + Math.cos(angle) * radius,
            y: zone.y + Math.sin(angle) * radius
        };
    }

    // Pathing helper to get a route between two zones
    getRoute(startZone, endZone) {
        const mapData = MAP_COORDINATES[this.mapName] || MAP_COORDINATES['Ascent'];
        const paths = mapData.paths || {};
        
        if (paths[startZone] && paths[startZone][endZone]) {
            return [...paths[startZone][endZone], endZone];
        }
        
        return [endZone];
    }

    handleEconomy(players, team) {
        const strat = this.strategies[team.id] || { eco: 'standard' };
        
        // Simple buy logic
        const minFullBuy = 3900; // Vandal/Phantom (2900) + Heavy Shield (1000)
        const avgMoney = players.reduce((sum, p) => sum + p.money, 0) / players.length;

        let buyType = 'full';
        if (this.roundNumber === 1 || this.roundNumber === 13) {
            buyType = 'pistol';
        } else if (avgMoney < 2000) {
            buyType = strat.eco === 'aggressive-buy' ? 'force' : 'eco';
        } else if (avgMoney < 3900) {
            buyType = strat.eco === 'stingy' ? 'eco' : 'force';
        }

        players.forEach(p => {
            if (buyType === 'pistol') {
                p.buy('GHOST', 'NONE');
            } else if (buyType === 'full') {
                const weapon = p.role === 'Duelist' ? 'VANDAL' : 'PHANTOM';
                p.buy(weapon, 'HEAVY');
            } else if (buyType === 'force') {
                p.buy('SPECTRE', 'LIGHT');
            } else {
                p.weapon = WEAPONS.CLASSIC;
                p.shield = SHIELDS.NONE;
            }
        });
    }

    updateEconomy(winners, losers, attackerWon) {
        winners.forEach(p => {
            p.money += 3000; // Win bonus
            // Survival bonus
            if (p.stats.deaths === 0) p.money += 0; 
        });

        losers.forEach(p => {
            p.money += 1900; // Base loss bonus
            // Bonus increases on loss streaks (simplified)
            p.money += 500; 
        });
    }

    simulateRound() {
        // Teams must have at least 5 players to play
        if (this.attackers.players.length < 5 || this.defenders.players.length < 5) {
            const forfeiter = this.attackers.players.length < 5 ? this.attackers : this.defenders;
            const winner = forfeiter === this.attackers ? this.defenders : this.attackers;
            this.logs.push(`CRITICAL: ${forfeiter.name} does not have enough players (min 5). FORFEIT!`);
            winner.score = 13; // Fast forward to end
            forfeiter.score = 0;
            return { forfeit: true, winner: winner };
        }

        // Automatically select the top 5 players by overall rating for each team
        let activeAttackers = [...this.attackers.players]
            .filter(p => p.status === 'active')
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 5);
            
        let activeDefenders = [...this.defenders.players]
            .filter(p => p.status === 'active')
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 5);
        
        // Fallback for empty teams
        if (activeAttackers.length === 0) activeAttackers = this.attackers.players.slice(0, 5);
        if (activeDefenders.length === 0) activeDefenders = this.defenders.players.slice(0, 5);

        // --- Handle Economy & Buys ---
        this.handleEconomy(activeAttackers, this.attackers);
        this.handleEconomy(activeDefenders, this.defenders);

        const events = [];
        const playerPositions = {};
        const playerCurrentZones = {};
        const aliveAttackers = [...activeAttackers];
        const aliveDefenders = [...activeDefenders];
        const playerMarkers = {}; // Track all players for events

        // Initialize positions
        [...activeAttackers, ...activeDefenders].forEach((p, idx) => {
            const teamSide = p.teamId === this.attackers.id ? 'attack' : 'defense';
            const spawnZone = teamSide === 'attack' ? 'Attack Spawn' : 'Defense Spawn';
            playerPositions[p.id] = this.getRandomPos(spawnZone, idx % 5, teamSide);
            playerCurrentZones[p.id] = spawnZone;
        });
        
        events.push({
            type: 'initial_positions',
            positions: { ...playerPositions },
            time: 0
        });

        // Set targets for movement
        const zones = Object.keys(MAP_COORDINATES[this.mapName] || MAP_COORDINATES['Ascent']).filter(k => k !== 'paths');
        const sites = zones.filter(z => z.includes('Site') || z === 'Mid');
        const playerTargets = {};
        [...activeAttackers, ...activeDefenders].forEach(p => {
            playerTargets[p.id] = sites[Math.floor(Math.random() * sites.length)];
        });

        let currentTime = 5;
        
        // Simulation loop: continues until one team is eliminated
        while (aliveAttackers.length > 0 && aliveDefenders.length > 0) {
            // 1. Movement Step
            const movementSnapshot = {};
            [...aliveAttackers, ...aliveDefenders].forEach((p, idx) => {
                const teamSide = p.teamId === this.attackers.id ? 'attack' : 'defense';
                const currentZone = playerCurrentZones[p.id];
                const finalTarget = playerTargets[p.id];
                const route = this.getRoute(currentZone, finalTarget);
                const nextStepZone = route[0];
                const currentPos = playerPositions[p.id];
                const targetPos = this.getRandomPos(nextStepZone, idx % 5, teamSide);
                
                const newPos = {
                    x: currentPos.x + (targetPos.x - currentPos.x) * 0.3,
                    y: currentPos.y + (targetPos.y - currentPos.y) * 0.3
                };
                
                const dist = Math.sqrt(Math.pow(newPos.x - targetPos.x, 2) + Math.pow(newPos.y - targetPos.y, 2));
                if (dist < 8) playerCurrentZones[p.id] = nextStepZone;

                playerPositions[p.id] = newPos;
                movementSnapshot[p.id] = newPos;
            });

            events.push({
                type: 'move',
                positions: { ...movementSnapshot },
                time: currentTime++
            });

            // 2. Combat Step: Check for clashes
            // Clash chance increases as players get closer to objectives or each other
            if (Math.random() < 0.4) {
                const attacker = aliveAttackers[Math.floor(Math.random() * aliveAttackers.length)];
                const defender = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
                
                // Calculate win probability for attacker in this specific duel
                const atkPower = attacker.overall + (attacker.weapon.type === 'Rifle' ? 5 : 0);
                const defPower = defender.overall + (defender.weapon.type === 'Rifle' ? 5 : 0);
                const atkWinProb = atkPower / (atkPower + defPower);
                
                const attackerWinsDuel = Math.random() < atkWinProb;
                const killer = attackerWinsDuel ? attacker : defender;
                const victim = attackerWinsDuel ? defender : attacker;
                const victimTeam = attackerWinsDuel ? aliveDefenders : aliveAttackers;
                
                // Remove victim from alive players (they only have 1 life)
                const victimIdx = victimTeam.findIndex(p => p.id === victim.id);
                victimTeam.splice(victimIdx, 1);
                
                // Update stats
                victim.stats.deaths++;
                killer.stats.kills++;
                const isHS = Math.random() < (killer.rating.aim / 250) + 0.1;
                if (isHS) killer.stats.hs++;
                killer.stats.damageDealt += 150;

                // Record kill event
                events.push({
                    type: 'kill',
                    killer: { name: killer.name, teamId: killer.teamId, role: killer.role, id: killer.id },
                    victim: { name: victim.name, teamId: victim.teamId, role: victim.role, id: victim.id },
                    weapon: killer.weapon.name,
                    hs: isHS,
                    position: playerPositions[victim.id],
                    time: currentTime++
                });
            }
            
            // Safety break to prevent infinite loops if something goes wrong
            if (currentTime > 100) break;
        }

        const winner = aliveAttackers.length > 0 ? this.attackers : this.defenders;
        const loser = winner === this.attackers ? this.defenders : this.attackers;
        winner.score++;

        // Economy updates
        this.updateEconomy(
            winner === this.attackers ? activeAttackers : activeDefenders,
            winner === this.attackers ? activeDefenders : activeAttackers,
            winner === this.attackers
        );

        const log = `Round ${this.roundNumber}: ${winner.name} won by eliminating all enemies.`;
        this.logs.push(log);

        return {
            winner: winner,
            logs: [log],
            events: events
        };
    }
}

export class MatchSimulator {
    constructor(team1, team2, logs, strategies = {}, mapName = 'Ascent') {
        this.team1 = team1;
        this.team2 = team2;
        this.logs = logs || [];
        this.strategies = strategies; // { team1Id: strategy, team2Id: strategy }
        this.mapName = mapName;
    }

    isMatchFinished() {
        const s1 = this.team1.score;
        const s2 = this.team2.score;
        
        // Standard win
        if ((s1 === 13 && s2 < 12) || (s2 === 13 && s1 < 12)) return true;
        
        // Overtime win (must win by 2)
        if (s1 >= 13 || s2 >= 13) {
            return Math.abs(s1 - s2) >= 2;
        }
        
        return false;
    }

    simulateMatch() {
        while (!this.isMatchFinished()) {
            const roundNum = this.team1.score + this.team2.score + 1;
            
            // Handle overtime side switching (every 2 rounds in OT)
            if (roundNum > 24) {
                if ((roundNum - 25) % 2 === 0 && roundNum > 25) {
                    this.team1.switchSide();
                    this.team2.switchSide();
                    this.logs.push("Overtime sides switched!");
                }
            } else if (roundNum === 13) {
                this.team1.switchSide();
                this.team2.switchSide();
                this.logs.push("Sides switched!");
            }

            const roundSim = new RoundSimulator(
                this.team1.side === 'attack' ? this.team1 : this.team2,
                this.team1.side === 'defense' ? this.team1 : this.team2,
                roundNum,
                this.logs,
                this.strategies,
                this.mapName
            );
            const roundResult = roundSim.simulateRound();
            
            // Handle forfeit
            if (roundResult && roundResult.forfeit) {
                break;
            }
            
            if (roundNum === 12 && this.team1.score === 12 && this.team2.score === 12) {
                this.logs.push("MATCH GOING TO OVERTIME!");
            }
        }
        
        const winner = this.team1.score > this.team2.score ? this.team1 : this.team2;
        this.logs.push(`Match finished! ${winner.name} won ${this.team1.score}-${this.team2.score}`);
        
        return {
            winner: winner,
            logs: this.logs
        };
    }
}