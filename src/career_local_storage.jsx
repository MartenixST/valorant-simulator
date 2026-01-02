import { teams } from './teams.js';
import { Player, PlayerRating } from "./simulation.js";
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

    // Also generate players for other teams in the same region
    const otherTeams = teams.filter(t => t.region === region && t.name !== teamName);
    const otherTeamsPlayers = otherTeams.flatMap(t => generatePlayersForTeam(t.name, region, t.id, t.power));

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
        budget: 50000, // Starting budget
        players: [...teamPlayers, ...freeAgents, ...otherTeamsPlayers],
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
function finalizeLoad(foundSave, actualId) {
    // getKickoffState now returns the object directly and handles parsing
    const kickoffState = getKickoffState(actualId);
    foundSave.kickoffState = kickoffState;
    
    // Also ensure this save is in localStorage for future sync loads
    localStorage.setItem(`save_${actualId}`, JSON.stringify(foundSave));
    
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
    // Get the current kickoff state from localStorage before saving
    if (updatedSave.kickoffState) {
        saveKickoffState(updatedSave.id, updatedSave.kickoffState);
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
    // Placeholder for player names and best player, contracts expiring
    // const players = ["Boaster", "kaajak", "Chronicle", "Alfajer", "Leo"];
    const playerNames = players.map(p => `${p.name} (${p.rating})`);
    const bestPlayer = players.reduce((prev, current) => (prev.rating > current.rating) ? prev : current);
    const expiringContractPlayer = players[Math.floor(Math.random() * players.length)]; // Randomly select one for now

    return {
        sender: `${team} Board`,
        subject: `Welcome to the ${team} family!`, 
        body: `Hello !\n\nWelcome to the ${team} family! You will play a crucial role in our esports organization, and we're confident that your leadership and expertise will take us to Champions.\n\nThese are the players that will be representing our team in the upcoming season:\n${playerNames.join(", ")}\n\nOur best current player is ${bestPlayer.name} (${bestPlayer.rating}).\n\nThe following players have contracts expiring at the end of the season: ${expiringContractPlayer.name}\nYou'll be responsible for overseeing our team's operations, strategy, and performance.\n\nLet's show the world what we're capable of—welcome to the squad!\n\n-${team} Board of Directors`
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