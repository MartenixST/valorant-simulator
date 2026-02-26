import { teams, teamLogos } from './teams.js';
import { Player, PlayerRating } from "./simulation.js";
import { realPlayers } from './real_players.js';
import { generatePlayer, generatePlayersForRegion as genPlayersRegion, generatePlayersForTeam, resetRegionalEliteCount } from './players.js';

const API_BASE_URL = 'http://localhost:5000/api';

export function saveKickoffState(st, region = "Americas", saveId = null) {
  const key = saveId ? `valorantKickoffState_${region}_${saveId}` : `valorantKickoffState_${region}`;
  
  // OPTIMIZATION: Before saving, clean up any old kickoff states from other saves to free up space
  if (saveId) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('valorantKickoffState_') && k !== key) {
          // If it's a different save's kickoff state, we can probably remove it or at least log it
          // For now, let's be safe and only remove it if we hit a quota error later
        }
      }
    } catch (e) {}
  }

  try {
    localStorage.setItem(key, JSON.stringify(st));
  } catch (e) {
    console.warn("saveKickoffState: localStorage quota exceeded, attempting to slim state...", e);
    
    // If quota exceeded, try to slim down the state by removing mapResults from ALL series
    if (st && st.series) {
      const seriesIds = Object.keys(st.series);
      seriesIds.forEach((id) => {
        // Keep only essential result info, remove stats/details if we're desperate
        if (st.series[id].mapResults) {
          delete st.series[id].mapResults;
        }
        if (st.series[id].playerStats) {
          // delete st.series[id].playerStats; // Keep playerStats if possible, but mapResults is usually the big one
        }
      });
      
      try {
        localStorage.setItem(key, JSON.stringify(st));
        console.log("Successfully saved slimmed kickoff state.");
      } catch (e2) {
        console.error("Critical: Could not save even slimmed kickoff state. Clearing old data to free up space.", e2);
        
        // Desperation move: clear ALL matchResult_ keys AND other saves' kickoff states
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            if (k.startsWith('matchResult_') || k.startsWith('match_')) {
              localStorage.removeItem(k);
            } else if (k.startsWith('valorantKickoffState_') && k !== key) {
              localStorage.removeItem(k);
            }
          }
        }
        
        // Final attempt
        try {
          localStorage.setItem(key, JSON.stringify(st));
          console.log("Successfully saved after clearing other data.");
        } catch (e3) {
          console.error("Absolute failure: localStorage is completely full and cannot be cleared enough.", e3);
        }
      }
    }
  }
}

export function getKickoffState(region = "Americas", saveId = null) {
  const key = saveId ? `valorantKickoffState_${region}_${saveId}` : `valorantKickoffState_${region}`;
  const storedState = localStorage.getItem(key);
  const defaultState = {
    region: region,
    series: {},
    playInRound1: [],
    ubRound1: [],
    ubRound2: [],
    ubFinal: [],
    lbRound1: [],
    lbRound2: [],
    lbRound3: [],
    lbRound4: [],
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
        // Better normalization: remove accents first, then strip non-alphanumeric
        return String(n)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim()
            .replace(/ /g, '_')
            .replace(/[^a-z0-9_]/g, '');
    };
    
    const normalizedTarget = normalize(name);
    const targetTeam = teams.find(t => normalize(t.name) === normalizedTarget || String(t.id) === normalizedTarget);

    const activeSave = loadCareer();
    if (activeSave && activeSave.players) {
        // Find which players are ON the user's team by identity (ID, Name, Gamertag)
        const userTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
        const userTeamName = activeSave.team ? activeSave.team : null;
        
        // DIRECT MATCH FOR USER TEAM:
        // If the requested name matches the user's team name, strictly return the user's players
        // Also check by ID if targetTeam was found
        const userTeamIdStr = userTeamId ? String(userTeamId) : null;
        const targetTeamIdStr = targetTeam && targetTeam.id ? String(targetTeam.id) : null;
        
        const isUserTeamById = targetTeamIdStr && userTeamIdStr && targetTeamIdStr === userTeamIdStr;
        const isUserTeamByName = userTeamName && normalize(name) === normalize(userTeamName);
        
        if (isUserTeamByName || isUserTeamById) {
             console.log(`getSafeTeamByName: Identified user team request for ${name} (User Team: ${userTeamName})`);
             
             // Get players from activeSave that belong to user team
             const myPlayers = activeSave.players.filter(p => {
                 const pTeamIdStr = p.teamId ? String(p.teamId) : null;
                 const pTeamNameNorm = p.team ? normalize(p.team) : null;
                 const userTeamNameNorm = userTeamName ? normalize(userTeamName) : null;
                 
                 // Check by ID first (most reliable)
                 if (userTeamIdStr && pTeamIdStr === userTeamIdStr) return true;
                 
                 // Check by Name
                 if (userTeamNameNorm && pTeamNameNorm === userTeamNameNorm) return true;
                 
                 return false;
             });
             
             if (myPlayers.length > 0) {
                 console.log(`getSafeTeamByName: Returning ${myPlayers.length} user players for ${name}`);
                 return {
                     ...(targetTeam || { name: userTeamName, id: userTeamId }),
                     name: userTeamName, // Ensure name is correct from save
                     id: userTeamId,     // Ensure ID is correct from save
                     logo: `assets/team_logos/${normalize(userTeamName)}.png`,
                     players: myPlayers
                 };
             }
        }

        const userPlayersByIdentity = activeSave.players.filter(p => {
            const pTeamId = p.teamId ? String(p.teamId) : null;
            const pTeamName = p.team ? p.team : null;
            return (userTeamId && pTeamId === userTeamId) || (userTeamName && pTeamName === userTeamName);
        });

        const teamPlayers = activeSave.players.filter(p => {
            const pTeamNorm = p.team ? normalize(p.team) : null;
            const pTeamIdNorm = p.teamId ? String(p.teamId) : null;
            
            let isTargetTeam = false;

            // Priority 1: Check by Team ID if available
            if (targetTeam && targetTeam.id && pTeamIdNorm) {
                isTargetTeam = pTeamIdNorm === String(targetTeam.id);
            } else if (pTeamIdNorm && pTeamIdNorm === normalizedTarget) {
                // Priority 2: Check by Team ID directly if normalizedTarget is an ID
                isTargetTeam = true;
            } else {
                // Priority 3: Fallback to Team Name
                const matchesName = (pTeamNorm && pTeamNorm === normalizedTarget);
                const matchesNameRef = targetTeam && p.team && normalize(p.team) === normalize(targetTeam.name);
                isTargetTeam = matchesName || matchesNameRef;
            }

            if (!isTargetTeam) return false;

            // CRITICAL: If this is NOT the user's team being requested,
            // we must EXCLUDE any player that is currently on the user's team by identity.
            // This prevents "duplicates" like Boostio appearing on 100 Thieves after being hired.
            const isActuallyOnUserTeam = (userTeamId && normalizedTarget !== normalize(userTeamName)) && userPlayersByIdentity.some(up => 
                up.id === p.id || 
                (up.gamertag && up.gamertag === p.gamertag) || 
                (up.name && up.name === p.name)
            );

            return !isActuallyOnUserTeam;
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
    resetRegionalEliteCount();
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

    const allPlayers = [...teamPlayers, ...freeAgents, ...otherTeamsPlayers];

    const inboxMessages = [
        createChampionshipContendersMessage(allPlayers),
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
        players: allPlayers,
        pendingOffers: [],
        stats: { wins: 0, losses: 0 },
        inbox: inboxMessages,
        history: [],
        offseason: { phase: 'offseason', week: 1, offers: [] },
        kickoffState: {
            series: {},
        },
        tutorialPending: true // Flag to prompt for tutorial on first load
    };
    saveKickoffState(newSave.kickoffState, newSave.id);
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

    // Always save to localStorage as well, but handle quota errors gracefully
    try {
        // Optimization: For localStorage, we can store a slimmed-down version of the save 
        // if it's too big, as the server holds the full data.
        const saveToStore = { ...save };
        
        // If the save is very large (e.g., > 2000 players), slim it down for local storage
        if (saveToStore.players && saveToStore.players.length > 500) {
            console.log("startCareer: Slimming down localStorage backup to save space.");
            // Keep only essential players (user team + some free agents)
            const userTeamPlayers = saveToStore.players.filter(p => String(p.teamId) === String(saveToStore.teamId));
            const otherPlayers = saveToStore.players.filter(p => String(p.teamId) !== String(saveToStore.teamId));
            saveToStore.players = [...userTeamPlayers, ...otherPlayers.slice(0, 500)];
        }

        localStorage.setItem(`save_${save.id}`, JSON.stringify(saveToStore));
        localStorage.setItem('activeSaveId', String(save.id));
    } catch (lsError) {
        console.warn("localStorage quota exceeded, but data was sent to server:", lsError);
        // Even if local storage fails, we have the activeSaveId so we can try to load from API
        try {
            localStorage.setItem('activeSaveId', String(save.id));
        } catch (e) {
            console.error("Critical: Could not even save activeSaveId to localStorage");
        }
    }
        
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

    // 2. Full World Recovery: Ensure every team from teams.js (EXCEPT the user's team) has at least 5 players
    // The user's team is allowed to have fewer than 5 players if they want to release everyone.
    
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
        const isUserTeam = foundSave.teamId && String(foundSave.teamId) === teamIdStr;
        
        // Skip user's team if it has fewer than 5 players - they might be doing roster management
        if (isUserTeam) {
            continue;
        }

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
    const playerTeamData = teams.find(t => String(t.id) === String(foundSave.teamId));
    const playerRegion = playerTeamData ? playerTeamData.region : "Americas";
    const kickoffState = getKickoffState(playerRegion, actualId);
    foundSave.kickoffState = kickoffState;
    
    // Sync back to localStorage for consistency, handling quota errors
    try {
        const saveToStore = { ...foundSave };
        
        // CRITICAL STORAGE OPTIMIZATION: Remove large redundant objects for localStorage backup
        // kickoffState is already stored in its own key 'valorantKickoffState_${actualId}'
        delete saveToStore.kickoffState;
        
        // More aggressive slimming for localStorage
        if (saveToStore.players && saveToStore.players.length > 300) {
            console.log("finalizeLoad: Aggressively slimming players for localStorage backup.");
            const userTeamId = String(foundSave.teamId);
            const userTeamPlayers = saveToStore.players.filter(p => String(p.teamId) === userTeamId);
            const otherPlayers = saveToStore.players.filter(p => String(p.teamId) !== userTeamId);
            saveToStore.players = [...userTeamPlayers, ...otherPlayers.slice(0, 300)];
        }
        
        if (saveToStore.inbox && saveToStore.inbox.length > 20) {
            console.log("finalizeLoad: Slimming inbox for localStorage backup.");
            saveToStore.inbox = saveToStore.inbox.slice(0, 20);
        }
        
        if (saveToStore.history && saveToStore.history.length > 50) {
            console.log("finalizeLoad: Slimming history for localStorage backup.");
            saveToStore.history = saveToStore.history.slice(-50);
        }
        
        if (saveToStore.regularSeasonMatches && saveToStore.regularSeasonMatches.length > 50) {
            console.log("finalizeLoad: Slimming regularSeasonMatches for localStorage backup.");
            saveToStore.regularSeasonMatches = saveToStore.regularSeasonMatches.slice(-50);
        }

        localStorage.setItem(`save_${actualId}`, JSON.stringify(saveToStore));
    } catch (lsError) {
        console.warn("finalizeLoad: localStorage quota exceeded while syncing. Data remains in memory and API.", lsError);
        // Try even more desperate slimming if it still fails
        try {
            const desperateSave = { ...foundSave };
            delete desperateSave.kickoffState;
            delete desperateSave.history;
            delete desperateSave.regularSeasonMatches;
            desperateSave.inbox = desperateSave.inbox ? desperateSave.inbox.slice(0, 5) : [];
            desperateSave.players = desperateSave.players ? desperateSave.players.filter(p => String(p.teamId) === String(foundSave.teamId)) : [];
            
            localStorage.setItem(`save_${actualId}`, JSON.stringify(desperateSave));
            console.log("finalizeLoad: Desperate slimming successful.");
        } catch (e) {
            // If even desperate slimming fails, try clearing other saves
            try {
                const keys = Object.keys(localStorage);
                const otherSaveKeys = keys.filter(k => (k.startsWith('save_') || k.startsWith('valorantKickoffState_')) && !k.includes(String(actualId)));
                if (otherSaveKeys.length > 0) {
                    otherSaveKeys.forEach(k => localStorage.removeItem(k));
                    // Try the initial saveToStore again
                    const retrySave = { ...foundSave };
                    delete retrySave.kickoffState;
                    localStorage.setItem(`save_${actualId}`, JSON.stringify(retrySave));
                }
            } catch (e2) {}
        }
    }
    
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
        const playerTeamData = teams.find(t => String(t.id) === String(updatedSave.teamId));
        const playerRegion = playerTeamData ? playerTeamData.region : "Americas";
        updatedSave.kickoffState = getKickoffState(playerRegion, updatedSave.id);
    }
    
    // Always save to localStorage as a primary backup/source, but handle quota errors
    try {
        const saveToStore = { ...updatedSave };
        
        // CRITICAL STORAGE OPTIMIZATION: Remove large redundant objects for localStorage backup
        // kickoffState is already stored in its own key 'valorantKickoffState_${updatedSave.id}'
        delete saveToStore.kickoffState;
        
        // More aggressive slimming for localStorage
        if (saveToStore.players && saveToStore.players.length > 300) {
            console.log("saveCareer: Aggressively slimming players for localStorage backup.");
            const userTeamId = String(updatedSave.teamId);
            const userTeamPlayers = saveToStore.players.filter(p => String(p.teamId) === userTeamId);
            const otherPlayers = saveToStore.players.filter(p => String(p.teamId) !== userTeamId);
            saveToStore.players = [...userTeamPlayers, ...otherPlayers.slice(0, 300)];
        }
        
        if (saveToStore.inbox && saveToStore.inbox.length > 20) {
            saveToStore.inbox = saveToStore.inbox.slice(0, 20);
        }
        
        if (saveToStore.history && saveToStore.history.length > 50) {
            saveToStore.history = saveToStore.history.slice(-50);
        }
        
        if (saveToStore.regularSeasonMatches && saveToStore.regularSeasonMatches.length > 50) {
            saveToStore.regularSeasonMatches = saveToStore.regularSeasonMatches.slice(-50);
        }

        localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(saveToStore));
        localStorage.setItem('activeSaveId', String(updatedSave.id));
    } catch (lsError) {
        console.warn("saveCareer: localStorage quota exceeded. Relying on API for full data.", lsError);
        // Try even more desperate slimming if it still fails
        try {
            const desperateSave = { ...updatedSave };
            delete desperateSave.kickoffState;
            delete desperateSave.history;
            delete desperateSave.regularSeasonMatches;
            desperateSave.inbox = desperateSave.inbox ? desperateSave.inbox.slice(0, 5) : [];
            desperateSave.players = desperateSave.players ? desperateSave.players.filter(p => String(p.teamId) === String(updatedSave.teamId)) : [];
            
            localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(desperateSave));
            console.log("saveCareer: Desperate slimming successful.");
        } catch (e) {
            // Clean up old saves to make room
            try {
                const keys = Object.keys(localStorage);
                const saveKeys = keys.filter(k => (k.startsWith('save_') || k.startsWith('valorantKickoffState_')) && !k.includes(String(updatedSave.id)));
                if (saveKeys.length > 0) {
                    console.log(`saveCareer: Removing ${saveKeys.length} old save-related keys from localStorage to free space.`);
                    saveKeys.forEach(k => localStorage.removeItem(k));
                    // Try saving again with initial slimmed version
                    const retrySave = { ...updatedSave };
                    delete retrySave.kickoffState;
                    localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(retrySave));
                }
            } catch (e2) {
                console.error("saveCareer: Failed to free space in localStorage.", e2);
            }
        }
    }

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
        // If it's a Player instance, use the overall getter (already rounded)
        if (typeof p.getOverallRating === 'function') return p.getOverallRating();
        if (typeof p.overall === 'number' && String(p.overall).includes('.')) {
            // If it's a raw number with many decimals, round it
            return Math.round(p.overall * 10) / 10;
        }
        // If it has a rating object
        const r = p.rating || p.ratings;
        if (r) {
            if (typeof r.overall === 'number') return Math.round(r.overall * 10) / 10;
            if (typeof r.aim === 'number') {
                const sum = (Number(r.aim) || 50) + (Number(r.movement) || 50) + (Number(r.gameSense) || 50) + 
                            (Number(r.clutch) || 50) + (Number(r.aggression) || 50) + (Number(r.utility) || 50) + 
                            (Number(r.mental) || 50) + (Number(r.teamwork) || 50) + (Number(r.consistency) || 50);
                return Math.round((sum / 9) * 10) / 10;
            }
        }
        // Fallback to overall property if it's just a number
        if (typeof p.overall === 'number') return Math.round(p.overall * 10) / 10;
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

function createChampionshipContendersMessage(players = []) {
    // If no players provided, fall back to base team stats with some randomness
    let teamStats;
    if (players.length > 0) {
        teamStats = teams.map(t => {
            const teamPlayers = players.filter(p => String(p.teamId) === String(t.id));
            const avgPower = teamPlayers.length > 0 
                ? Math.round((teamPlayers.reduce((sum, p) => sum + (p.overall || 75), 0) / teamPlayers.length) * 10) / 10
                : t.power;
            const avgPotential = teamPlayers.length > 0
                ? Math.round((teamPlayers.reduce((sum, p) => sum + (p.potential || 80), 0) / teamPlayers.length) * 10) / 10
                : t.potential;
            
            // Add a small random variance (±3) for variety in each new save
            const variance = (Math.random() * 6) - 3;
            
            return {
                ...t,
                currentPower: avgPower,
                currentPotential: avgPotential,
                strength: Math.round((((avgPower + avgPotential) / 2) + variance) * 10) / 10
            };
        });
    } else {
        teamStats = teams.map(t => ({
            ...t,
            currentPower: t.power,
            currentPotential: t.potential,
            strength: Math.round((((t.power + t.potential) / 2) + ((Math.random() * 6) - 3)) * 10) / 10
        }));
    }

    const contenders = teamStats.sort((a, b) => b.strength - a.strength).slice(0, 5);
    
    let htmlBody = `
        <div class="contenders-report">
            <p style="margin-bottom: 25px; color: rgba(236, 232, 225, 0.8); line-height: 1.6;">
                As we approach the new season, the analysts at the League News have compiled the definitive list of championship contenders. These five organizations have demonstrated the raw talent and tactical depth required to lift the trophy.
            </p>
            <div class="contenders-list" style="display: flex; flex-direction: column; gap: 20px;">
    `;

    const reasonPools = {
        elite: [
            "A global powerhouse with a roster that defines the current meta. Their mechanical ceiling is unmatched.",
            "The undisputed giants of the league. Every player on this roster is a legitimate superstar in their own right.",
            "A terrifying combination of raw aim and flawless utility usage. They are currently the benchmark for excellence.",
            "A dynasty in the making. Their tactical depth is only rivaled by their individual fragging power."
        ],
        veteran: [
            "A veteran-heavy squad whose experience and discipline make them a nightmare to play against in high-stakes matches.",
            "Masters of the late-game. This team's composure under pressure is their greatest weapon against less experienced rivals.",
            "A battle-hardened core that knows exactly how to exploit the smallest mistakes in their opponents' setups.",
            "They play the 'boring' but perfect Valorant. Their fundamental execution is so clean it leaves no room for counter-play."
        ],
        rising: [
            "The league's most dangerous young core. Their rapid improvement suggests they will be unstoppable by the time playoffs arrive.",
            "A high-octane roster of rising stars. What they lack in experience, they more than make up for in sheer mechanical audacity.",
            "An explosive group of newcomers who are currently re-writing the tactical playbook with their aggressive style.",
            "Fearless and unpredictable. This young squad thrives in chaos and can out-aim almost anyone on their day."
        ],
        balanced: [
            "A perfectly balanced organization with deep strategic layers and a consistent track record of excellence.",
            "Renowned for their structural integrity. They play a disciplined style of Valorant that is incredibly difficult to break down.",
            "A well-rounded squad where every player understands their role perfectly, creating a whole that is greater than the sum of its parts.",
            "Masters of adaptation. This team can switch between aggressive and defensive styles mid-map without missing a beat."
        ]
    };

    const usedReasons = new Set();
    
    contenders.forEach((team, index) => {
        let reason = "";
        const avgStrength = team.strength;
        const logoUrl = teamLogos[team.name] || 'assets/team_logos/default.png';

        let pool;
        if (avgStrength >= 85) {
            pool = reasonPools.elite;
        } else if (team.currentPower > team.currentPotential + 2) {
            pool = reasonPools.veteran;
        } else if (team.currentPotential > team.currentPower + 2) {
            pool = reasonPools.rising;
        } else {
            pool = reasonPools.balanced;
        }
        
        // Find a reason that hasn't been used in this report
        let availableReasons = pool.filter(r => !usedReasons.has(r));
        
        // Fallback if somehow all in pool are used (unlikely with 4 per pool for 5 teams total)
        if (availableReasons.length === 0) {
            availableReasons = pool;
        }
        
        reason = availableReasons[Math.floor(Math.random() * availableReasons.length)];
        usedReasons.add(reason);

        htmlBody += `
            <div class="contender-item" style="display: flex; align-items: center; gap: 20px; background: rgba(255, 255, 255, 0.03); padding: 15px; border-left: 4px solid #ff4655;">
            <div class="contender-rank" style="font-family: 'Valorant', sans-serif; font-size: 24px; color: #ff4655; min-width: 30px;">#${index + 1}</div>
            <img src="${logoUrl}" alt="${team.name}" style="width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));" />
            <div class="contender-info" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                    <h4 style="margin: 0; font-family: 'Valorant', sans-serif; color: #ece8e1; font-size: 18px; text-transform: uppercase;">${team.name}</h4>
                    <span style="font-size: 10px; color: #00f6ff; background: rgba(0, 246, 255, 0.1); padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">${team.region}</span>
                </div>
                <div style="font-size: 11px; color: rgba(236, 232, 225, 0.5); margin-bottom: 8px; font-weight: bold;">
                    RATING: <span style="color: #00ff85;">${team.currentPower} PWR</span> / <span style="color: #ffb900;">${team.currentPotential} POT</span>
                </div>
                <div style="font-size: 13px; color: rgba(236, 232, 225, 0.7); font-style: italic; line-height: 1.4;">
                    "${reason}"
                </div>
            </div>
        </div>
    `;
    });

    htmlBody += `
            </div>
            <p style="margin-top: 30px; text-align: center; color: #ff4655; font-family: 'Valorant', sans-serif; letter-spacing: 1px; font-size: 14px;">
                KEEP A CLOSE EYE ON THESE TEAMS AS THE SEASON UNFOLDS.
            </p>
        </div>
    `;

    return {
        sender: "League News",
        subject: "S1 Report: Championship Contenders",
        body: htmlBody,
        contentType: 'html'
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