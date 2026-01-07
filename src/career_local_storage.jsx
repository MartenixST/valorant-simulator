import { teams } from './teams.js';
import { Player, PlayerRating } from "./simulation.js";
import { realPlayers } from './real_players.js';
import { generatePlayer, generatePlayersForRegion as genPlayersRegion, generatePlayersForTeam } from './players.js';

const API_BASE_URL = 'http://localhost:5000/api';

export function saveKickoffState(st, saveId = null) {
  const key = saveId ? `valorantKickoffState_${saveId}` : "valorantKickoffState";
  localStorage.setItem(key, JSON.stringify(st));
}

export function getKickoffState(saveId = null) {
  const key = saveId ? `valorantKickoffState_${saveId}` : "valorantKickoffState";
  const storedState = localStorage.getItem(key);
  const defaultState = {
    series: {},
    playInRound1: [],
    ubRound1: [],
    ubRound2: [],
    ubFinal: [],
    lbRound1: [],
    lbRound2: [],
    lbRound3: [],
    lbFinal: [],
    grandFinal: [],
    dirty: true // Mark as dirty to force re-initialization if state is incomplete
  };
  
  if (!storedState) return defaultState;
  
  try {
    const parsed = JSON.parse(storedState);
    return { ...defaultState, ...parsed };
  } catch (e) {
    console.error("Error parsing kickoff state:", e);
    return defaultState;
  }
}

export function getSafeTeamByName(name) {
    if (!name) {
        return { name: 'TBD', logo: 'assets/team_logos/default.png', players: [] };
    }

    const normalize = (n) => {
        if (!n) return '';
        if (typeof n === 'number') return String(n);
        return String(n).toLowerCase().trim().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
    };
    
    const normalizedTarget = normalize(name);
    const targetTeam = teams.find(t => normalize(t.name) === normalizedTarget || String(t.id) === normalizedTarget);

    const activeSave = loadCareer();
    if (activeSave && activeSave.players) {
        const teamPlayers = activeSave.players.filter(p => {
            const pTeamNorm = p.team ? normalize(p.team) : null;
            const pTeamIdNorm = p.teamId ? normalize(p.teamId) : null;
            const matchesName = (pTeamNorm && pTeamNorm === normalizedTarget);
            const matchesIdDirect = (pTeamIdNorm && pTeamIdNorm === normalizedTarget);
            const matchesIdRef = targetTeam && p.teamId && String(p.teamId) === String(targetTeam.id);
            const matchesNameRef = targetTeam && p.team && normalize(p.team) === normalize(targetTeam.name);
            return matchesName || matchesIdDirect || matchesIdRef || matchesNameRef;
        });

        if (teamPlayers.length > 0) {
            return {
                ...(targetTeam || { name: name, id: name }),
                logo: `assets/team_logos/${normalize(targetTeam ? targetTeam.name : name)}.png`,
                players: teamPlayers
            };
        }
    }

    if (targetTeam) {
        // IMPORTANT: generatePlayersForTeam already sets player.team and player.teamId correctly
        const generatedPlayers = generatePlayersForTeam(targetTeam.name, targetTeam.region, targetTeam.id, targetTeam.power);
        return {
            ...targetTeam,
            logo: `assets/team_logos/${normalize(targetTeam.name)}.png`,
            players: generatedPlayers
        };
    }

    return {
        name: name,
        logo: `assets/team_logos/default.png`,
        players: []
    };
}

function generateFreeAgents(region) {
    const freeAgents = [];
    const numFreeAgents = 20;

    for (let i = 0; i < numFreeAgents; i++) {
        const player = generatePlayer(region);
        player.teamId = null;
        freeAgents.push(player);
    }
    return freeAgents;
}

export function createNewSave(managerName, teamName, region) {
    const selectedTeam = teams.find(t => t.name === teamName);
    const teamId = selectedTeam ? selectedTeam.id : null;

    const teamPlayers = generatePlayersForTeam(teamName, region, teamId, selectedTeam ? selectedTeam.power : 70);
    const freeAgents = generateFreeAgents(region);

    // Also generate players for ALL other teams, not just the same region
    // This ensures all teams in the sim have players assigned correctly
    const otherTeams = teams.filter(t => t.name !== teamName);
    const otherTeamsPlayers = otherTeams.flatMap(t => generatePlayersForTeam(t.name, t.region, t.id, t.power));

    // Generate random budgets for EVERY team (600k - 1.4m)
    const teamBudgets = {};
    teams.forEach(t => {
        teamBudgets[String(t.id)] = Math.floor(Math.random() * (1400000 - 600000 + 1)) + 600000;
    });

    const inboxMessages = [
        createChampionshipContendersMessage(),
        createKickoffPreviewMessage(),
        createWelcomeMessage2(teamName, teamPlayers),
        createBetaTesterMessage()
    ];

    const newSave = {
        id: String(Date.now()),
        manager: managerName,
        team: teamName,
        teamId: teamId,
        region: region,
        season: 1,
        week: 1,
        budget: teamBudgets[String(teamId)] || 1000000,
        teamBudgets: teamBudgets,
        players: [...teamPlayers, ...freeAgents, ...otherTeamsPlayers],
        pendingOffers: [],
        stats: { wins: 0, losses: 0 },
        inbox: inboxMessages,
        history: [],
        offseason: { phase: 'offseason', week: 1, offers: [] },
        kickoffState: {
            series: {},
        }
    };
    saveKickoffState(newSave.id, newSave.kickoffState);
    return newSave;
}

export async function startCareer(managerName, teamName, region) {
    if (!managerName) {
        alert("Please enter your manager name.");
        return;
    }
    if (!teamName) {
        alert("Please select a team.");
        return;
    }
    if (!region) {
        alert("Please select a region.");
        return;
    }

    const save = createNewSave(managerName, teamName, region);

    try {
        const apiUrl = `${API_BASE_URL}/saves`;
        console.log("Attempting to POST to:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(save),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Always save to localStorage as well
        localStorage.setItem(`save_${save.id}`, JSON.stringify(save));
        localStorage.setItem('activeSaveId', String(save.id));
        
        console.log("New save created and activeSaveId set:", save.id);
        window.location.href = 'career.html';
    } catch (error) {
        console.error("Error creating new save:", error);
        alert("Failed to create new save. Please try again.");
    }
}

export async function loadCareerAsync() {
    let activeSaveId = localStorage.getItem('activeSaveId');
    console.log("loadCareerAsync: activeSaveId (raw)", activeSaveId);
    
    if (!activeSaveId) {
        console.log("loadCareerAsync: No activeSaveId found.");
        return null;
    }

    // Function to try loading a specific ID
    const tryLoad = async (id) => {
        console.log(`tryLoad: Attempting to load ID "${id}"`);
        try {
            const response = await fetch(`${API_BASE_URL}/saves/${id}`);
            console.log(`tryLoad: API response status for "${id}":`, response.status);
            if (response.ok) {
                const foundSave = await response.json();
                console.log(`tryLoad: successfully loaded ID "${id}" from API`);
                return foundSave;
            }
        } catch (e) {
            console.error(`tryLoad: Error trying to load ID "${id}" from API:`, e);
        }
        
        // Try localStorage as fallback for this specific ID
        const localSave = localStorage.getItem(`save_${id}`);
        if (localSave) {
            console.log(`tryLoad: found ID "${id}" in localStorage`);
            return JSON.parse(localSave);
        }
        console.log(`tryLoad: ID "${id}" not found in API or localStorage`);
        return null;
    };

    // 1. Try raw ID
    let save = await tryLoad(activeSaveId);
    if (save) {
        console.log("loadCareerAsync: Found save using raw ID");
        return finalizeLoad(save, activeSaveId);
    }

    // 2. If ID has .0, try without it
    if (activeSaveId.endsWith('.0')) {
        const sanitized = activeSaveId.slice(0, -2);
        console.log(`loadCareerAsync: Raw ID had .0, trying sanitized ID "${sanitized}"`);
        save = await tryLoad(sanitized);
        if (save) {
            console.log("loadCareerAsync: Found save using sanitized ID");
            return finalizeLoad(save, sanitized);
        }
    }

    // 3. If ID doesn't have .0, try with it (for legacy saves)
    if (!activeSaveId.endsWith('.0')) {
        const legacy = activeSaveId + '.0';
        console.log(`loadCareerAsync: Raw ID did not have .0, trying legacy ID "${legacy}"`);
        save = await tryLoad(legacy);
        if (save) {
            console.log("loadCareerAsync: Found save using legacy ID");
            return finalizeLoad(save, legacy);
        }
    }

    console.warn("loadCareerAsync: Could not find save in API or localStorage with any ID variation.");
    return null;
}

// Synchronous version for legacy code
export function loadCareer() {
    const activeSaveId = localStorage.getItem('activeSaveId');
    if (!activeSaveId) return null;

    const trySyncLoad = (id) => {
        const localSave = localStorage.getItem(`save_${id}`);
        if (localSave) {
            try {
                const save = JSON.parse(localSave);
                return finalizeLoad(save, id);
            } catch (e) {
                console.error(`Error parsing local save ${id}:`, e);
            }
        }
        return null;
    };

    // Try variations
    let save = trySyncLoad(activeSaveId);
    if (save) return save;

    if (activeSaveId.endsWith('.0')) {
        save = trySyncLoad(activeSaveId.slice(0, -2));
        if (save) return save;
    } else {
        save = trySyncLoad(activeSaveId + '.0');
        if (save) return save;
    }

    return null;
}

// Helper to finalize the load (merge kickoff state, etc.)
export function finalizeLoad(foundSave, actualId) {
    if (!foundSave) return null;

    console.log(`finalizeLoad: Starting for save ${actualId}. Initial player count: ${foundSave.players?.length || 0}`);

    // 1. Convert all raw player objects to Player instances and Sanitize
    if (foundSave.players && foundSave.players.length > 0) {
        foundSave.players = foundSave.players.map(p => {
            try {
                // If it's already a Player instance with the getter, keep it
                const player = (p instanceof Player && typeof p.overall === 'number') ? p : Player.fromJSON(p);
                
                // Fix common data issues
                if (!player.teamId && p.teamId) player.teamId = String(p.teamId);
                if (!player.team && p.team) player.team = p.team;
                
                // CRITICAL FIX: If teamId is a name (e.g. "MIBR"), convert it to numeric ID
                if (player.teamId && isNaN(Number(player.teamId))) {
                    const teamObj = teams.find(t => t.name.toLowerCase() === player.teamId.toLowerCase());
                    if (teamObj) {
                        player.teamId = String(teamObj.id);
                        player.team = teamObj.name;
                    }
                }

                // Standardize team name from teams.js source of truth if we have numeric ID
                if (player.teamId && !isNaN(Number(player.teamId))) {
                    const teamObj = teams.find(t => String(t.id) === String(player.teamId));
                    if (teamObj) player.team = teamObj.name;
                }

                // Fix corrupted ratings/weapon/shield
                const isCorrupted = (val) => typeof val === 'string' && val.includes('[object Object]');
                if (isCorrupted(player.ratings) || isCorrupted(player.rating) || !player.rating) {
                    let baseRatingValue = 75;
                    try {
                        if (typeof player.overall === 'number') baseRatingValue = player.overall;
                        else if (p.overall) baseRatingValue = p.overall;
                    } catch (e) {
                        if (p.overall) baseRatingValue = p.overall;
                    }
                    player.ratings = PlayerRating.generateRandom(baseRatingValue, 20);
                    player.rating = player.ratings;
                }
                
                if (isCorrupted(player.weapon) || !player.weapon) {
                    player.weapon = { name: "Classic", price: 0, damage: 26, type: "Sidearm" };
                }
                if (isCorrupted(player.shield) || !player.shield) {
                    player.shield = { name: "No Shield", price: 0, armor: 0 };
                }
                
                // Ensure salary is correctly calculated (fixes the 5k placeholder issue)
                if (!player.marketValue || player.marketValue < 50000) {
                    player.marketValue = player.calculateMarketValue();
                }

                return player;
            } catch (err) {
                console.error("Error re-instantiating player:", err, p);
                return p;
            }
        }).filter(Boolean);
    } else {
        foundSave.players = [];
    }

    // 2. Full World Recovery: Ensure every team from teams.js has at least 5 players
    
    // First, try to assign players who have a team name but no teamId
    // AND ALSO try to match by name if teamId is missing
    foundSave.players.forEach(p => {
        if (!p.teamId && p.team) {
            const teamObj = teams.find(t => t.name.toLowerCase() === p.team.toLowerCase());
            if (teamObj) {
                p.teamId = String(teamObj.id);
                p.team = teamObj.name;
            }
        }
    });

    const teamsWithPlayers = new Set();
    foundSave.players.forEach(p => {
        const teamIdStr = (p.teamId && p.teamId !== 'null' && p.teamId !== 'undefined') ? String(p.teamId) : null;
        if (teamIdStr) {
            teamsWithPlayers.add(teamIdStr);
        }
    });

    console.log(`finalizeLoad: Found players for ${teamsWithPlayers.size} teams.`);

    let addedPlayersCount = 0;
    for (const team of teams) {
        const teamIdStr = String(team.id);
        const teamPlayers = foundSave.players.filter(p => String(p.teamId) === teamIdStr);
        
        if (teamPlayers.length < 5) {
            console.log(`finalizeLoad: Team ${team.name} (ID: ${teamIdStr}) only has ${teamPlayers.length} players. Generating missing...`);
            const missingCount = 5 - teamPlayers.length;
            
            // Use generatePlayersForTeam which handles real players vs randoms
            // We only want the NEW ones, so we'll filter out ones that might already exist by name
            const allPossibleTeamPlayers = generatePlayersForTeam(team.name, team.region, team.id, team.power);
            
            allPossibleTeamPlayers.forEach(newP => {
                const alreadyExists = teamPlayers.some(p => p.name.toLowerCase() === newP.name.toLowerCase());
                if (!alreadyExists && foundSave.players.filter(p => String(p.teamId) === teamIdStr).length < 5) {
                    foundSave.players.push(newP);
                    addedPlayersCount++;
                }
            });
            
            // If still missing (e.g., real_players only had 2 and generatePlayersForTeam didn't give enough)
            while (foundSave.players.filter(p => String(p.teamId) === teamIdStr).length < 5) {
                const roles = ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"];
                const currentCount = foundSave.players.filter(p => String(p.teamId) === teamIdStr).length;
                const role = roles[currentCount % roles.length];
                const p = generatePlayer(team.region, role, 70 + (team.power / 10));
                p.teamId = teamIdStr;
                p.team = team.name;
                foundSave.players.push(p);
                addedPlayersCount++;
            }
        }
    }

    if (addedPlayersCount > 0) {
        console.log(`finalizeLoad: Added ${addedPlayersCount} players to fill rosters.`);
    }

    // 3. Deduplicate (ID first, then Name+Team)
    const finalPlayersMap = new Map();
    foundSave.players.forEach(p => {
        if (!finalPlayersMap.has(p.id)) {
            const nameKey = `${p.name.toLowerCase().trim()}_${String(p.teamId)}`;
            let duplicateFound = false;
            for (const existing of finalPlayersMap.values()) {
                if (`${existing.name.toLowerCase().trim()}_${String(existing.teamId)}` === nameKey) {
                    duplicateFound = true;
                    break;
                }
            }
            if (!duplicateFound) {
                finalPlayersMap.set(p.id, p);
            }
        }
    });
    foundSave.players = Array.from(finalPlayersMap.values());

    if (!foundSave.stats) foundSave.stats = { wins: 0, losses: 0 };
    if (!foundSave.history) foundSave.history = [];
    if (!foundSave.pendingOffers) foundSave.pendingOffers = [];
    if (!foundSave.inbox) foundSave.inbox = [];

    // 5. User Team specific check
    if (foundSave.teamId) {
        foundSave.teamId = String(foundSave.teamId);
        const myTeamObj = teams.find(t => String(t.id) === foundSave.teamId);
        if (myTeamObj) foundSave.team = myTeamObj.name;
    }

    // Final kickoff state sync
    const kickoffState = getKickoffState(actualId);
    foundSave.kickoffState = kickoffState;
    
    // Sync back to localStorage for consistency
    localStorage.setItem(`save_${actualId}`, JSON.stringify(foundSave));
    
    console.log(`finalizeLoad: Completed. Final player count: ${foundSave.players.length}`);
    return foundSave;
}

export async function renderSaves() {
    const saveList = document.getElementById("saveList");
    if (!saveList) return;
    saveList.innerHTML = "";

    let saves = [];
    try {
        const response = await fetch(`${API_BASE_URL}/saves`);
        console.log("renderSaves: API response status:", response.status);
        if (response.ok) {
            saves = await response.json();
            console.log("renderSaves: Loaded saves from API:", saves.length);
        } else {
            console.warn("renderSaves: API failed to load saves, trying localStorage.");
            saves = getSavesFromLocalStorage();
        }
    } catch (e) {
        console.error("renderSaves: Error fetching saves from API:", e);
        saves = getSavesFromLocalStorage();
    }

    if (saves.length === 0) {
        saveList.innerHTML = "<li>No saves found.</li>";
        return;
    }

    saves.forEach(save => {
        const li = document.createElement("li");

        // Save info
        const span = document.createElement("span");
        span.textContent = `${save.manager} - ${save.team} (Season ${save.season})`;
        span.style.cursor = "pointer";
        span.onclick = () => {
            console.log("renderSaves: Clicked save:", save.id, typeof save.id);
            localStorage.setItem('activeSaveId', String(save.id));
            console.log("renderSaves: Set activeSaveId in localStorage to:", localStorage.getItem('activeSaveId'));
            window.location.href = 'career.html';
        };

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.style.marginLeft = "10px";
        delBtn.onclick = (e) => {
            e.stopPropagation(); // prevent triggering load
            deleteSave(save.id);
        };

        li.appendChild(span);
        li.appendChild(delBtn);
        saveList.appendChild(li);
    });
}

export function loadSave(id) {
    console.log("loadSave called with ID:", id);
    if (id) {
        localStorage.setItem('activeSaveId', String(id));
        console.log("loadSave: Set activeSaveId to:", localStorage.getItem('activeSaveId'));
        window.location.href = 'career.html';
    } else {
        return loadCareer();
    }
}

export async function saveCareer(updatedSave) {
    if (!updatedSave) return;

    // Safety check: Prevent saving an exploded number of players
    if (updatedSave.players && updatedSave.players.length > 2000) {
        console.warn(`saveCareer: Save has ${updatedSave.players.length} players. Truncating to prevent database bloat.`);
        // 1. Keep ALL players who belong to ANY team
        const teamPlayers = updatedSave.players.filter(p => p.teamId && p.teamId !== 'null' && p.teamId !== 'undefined');
        // 2. Keep free agents up to a reasonable limit
        const freeAgents = updatedSave.players.filter(p => !p.teamId || p.teamId === 'null' || p.teamId === 'undefined');
        
        updatedSave.players = [...teamPlayers, ...freeAgents.slice(0, 1000)];
    }

    // Get the current kickoff state from localStorage before saving
    // If it's not on the object, try to fetch it to ensure it's preserved
    if (!updatedSave.kickoffState) {
        updatedSave.kickoffState = getKickoffState(updatedSave.id);
    }
    
    // Always save to localStorage as a primary backup/source
    localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(updatedSave));
    localStorage.setItem('activeSaveId', String(updatedSave.id));

    try {
        const response = await fetch(`${API_BASE_URL}/saves`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedSave),
        });

        if (!response.ok) {
            console.warn(`API save error! status: ${response.status}. Data is safe in localStorage.`);
        } else {
            console.log("Career saved to API successfully.");
        }
    } catch (error) {
        console.error("Error saving career to API, but it's saved in localStorage:", error);
    }
}

export async function deleteSave(saveId) {
    try {
        const response = await fetch(`${API_BASE_URL}/saves/${saveId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log("Save deleted successfully.", saveId);
        renderSaves(); // refresh list
    } catch (error) {
        console.error("Error deleting save:", error);
        alert("Failed to delete save. Please try again.");
    }
}

function createBetaTesterMessage() {
    return {
        sender: "Martenix",
        subject: "BETA Tester Introduction 🦩",
        body: "Hello BETA Tester!\n\nThank you for being a part of the BETA testing phase. Your feedback is invaluable!\n\n- Martenix"
    };
}

function createWelcomeMessage1() {
    return {
        sender: "@Martenix",
        subject: "Welcome to Career Mode!",
        body: "Hello !\n\nThank you for taking the time to test my version of Career Mode.\n\nDon't hesitate to share your thoughts, suggestions, and ideas on the Discord Server. I appreciate your enthusiasm for the project.\n\n- @Martenix"
    };
}

function createWelcomeMessage2(team, players) {
    // Use .overall or .rating.overall for rating display
    const getPRating = (p) => {
        if (!p) return 75;
        // If it's a Player instance, use the overall getter
        if (typeof p.overall === 'number') return p.overall;
        // If it has a rating object with overall property
        if (p.rating && typeof p.rating.overall === 'number') return p.rating.overall;
        // If it has a rating object with calculateOverall method (PlayerRating instance)
        if (p.rating && typeof p.rating.calculateOverall === 'function') return p.rating.calculateOverall();
        // If it has ratings object
        const r = p.rating || p.ratings;
        if (r && typeof r.aim === 'number') {
            const sum = (Number(r.aim) || 50) + (Number(r.movement) || 50) + (Number(r.gameSense) || 50) + 
                        (Number(r.clutch) || 50) + (Number(r.aggression) || 50) + (Number(r.utility) || 50) + 
                        (Number(r.mental) || 50) + (Number(r.teamwork) || 50) + (Number(r.consistency) || 50);
            return Math.round(sum / 9);
        }
        // Fallback to overall property if it's just a number
        if (typeof p.overall === 'number') return p.overall;
        return 75;
    };

    const playerNames = players.map(p => `${p.name} (${getPRating(p)})`);
    const bestPlayer = players.reduce((prev, current) => (getPRating(prev) > getPRating(current)) ? prev : current);
    const expiringContractPlayer = players[Math.floor(Math.random() * players.length)]; // Randomly select one for now

    return {
        sender: `${team} Board`,
        subject: `Welcome to the ${team} family!`, 
        body: `Hello !\n\nWelcome to the ${team} family! You will play a crucial role in our esports organization, and we're confident that your leadership and expertise will take us to Champions.\n\nThese are the players that will be representing our team in the upcoming season:\n${playerNames.join(", ")}\n\nOur best current player is ${bestPlayer.name} (${getPRating(bestPlayer)}).\n\nThe following players have contracts expiring at the end of the season: ${expiringContractPlayer.name}\nYou'll be responsible for overseeing our team's operations, strategy, and performance.\n\nLet's show the world what we're capable of—welcome to the squad!\n\n-${team} Board of Directors`
    };
}

function createKickoffPreviewMessage() {
    return {
        sender: "League Admin",
        subject: "Kickoff Preview",
        body: "The Kickoff is about to start. Get ready for the action!\n\nPoints at Stake:\n\n1st Place: 3 Points\n2nd Place: 2 Points\n3rd Place: 1 Points\n4th Place: 1 Points\nThe stage is set. Let the games begin!"
    };
}

function createChampionshipContendersMessage() {
    // Logic to select top 5 teams based on power and potential
    // For now, using static teams as a placeholder
    const topTeams = teams.sort((a, b) => (b.power + b.potential) - (a.power + a.potential)).slice(0, 5);
    const topTeamNames = topTeams.map(t => t.name).join("\n");

    return {
        sender: "League News",
        subject: "Contenders for the Championship!",
        body: `The stage is set for another exciting season! Our latest report reveals the top 5 teams primed for a championship run.\n\nHere are the teams expected to take it all this season:\n\n${topTeamNames}`
    };
}

export function backToMenu() {
    console.log('backToMenu called');
    window.location.href = 'career_entry.html';
}

function getSavesFromLocalStorage() {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('save_')) {
            try {
                const save = JSON.parse(localStorage.getItem(key));
                if (save && save.id) {
                    saves.push(save);
                }
            } catch (e) {
                console.error("Error parsing save from localStorage:", key, e);
            }
        }
    }
    return saves;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('saveList')) {
        renderSaves();
    }
});