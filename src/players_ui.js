import { teams } from './teams.js';
import { loadCareer } from './career_local_storage.jsx';
import { getFlagUrl } from './utils/countryCodes.js';

let currentPlayers = [];
let filteredPlayers = [];

document.addEventListener('DOMContentLoaded', () => {
    initializePlayersHub();
});

function initializePlayersHub() {
    console.log("Initializing Players Hub...");
    
    // DOM Elements
    const regionFilter = document.getElementById('region-filter');
    const teamFilter = document.getElementById('team-filter');
    const yearFilter = document.getElementById('year-filter');
    const typeFilter = document.getElementById('player-type-filter');
    const searchInput = document.getElementById('player-search');
    const playersContainer = document.getElementById('players-container');
    
    if (!playersContainer) {
        console.error("Players container not found!");
        return;
    }

    // Load Data
    const activeSave = loadCareer();
    if (!activeSave) {
        playersContainer.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">Please start a career to view players.</div>';
        return;
    }

    currentPlayers = activeSave.players || [];
    
    // Populate Team Filter
    populateTeamFilter();

    // Initial Filter
    filterPlayers();

    // Event Listeners
    if (regionFilter) regionFilter.addEventListener('change', filterPlayers);
    if (teamFilter) teamFilter.addEventListener('change', filterPlayers);
    if (yearFilter) yearFilter.addEventListener('change', filterPlayers);
    if (typeFilter) typeFilter.addEventListener('change', filterPlayers);
    if (searchInput) searchInput.addEventListener('input', filterPlayers);

    // Modal Close Listeners
    const modal = document.getElementById('player-details-modal');
    const closeBtn = document.querySelector('.close-button');

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'player-details-modal') {
                closePlayerModal();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closePlayerModal);
    }
}

function populateTeamFilter() {
    const teamFilter = document.getElementById('team-filter');
    if (!teamFilter) return;

    // Sort teams alphabetically
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    
    // Clear existing options except the first one
    while (teamFilter.options.length > 1) {
        teamFilter.remove(1);
    }
    
    sortedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        teamFilter.appendChild(option);
    });
}

function filterPlayers() {
    const regionFilter = document.getElementById('region-filter')?.value || 'all';
    const teamFilter = document.getElementById('team-filter')?.value || 'all';
    const yearFilter = document.getElementById('year-filter')?.value || 'all';
    const typeFilter = document.getElementById('player-type-filter')?.value || 'all';
    const searchInput = document.getElementById('player-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    filteredPlayers = currentPlayers.filter(player => {
        // Region Filter
        if (regionFilter !== 'all') {
            const playerTeam = teams.find(t => t.name === player.team || String(t.id) === String(player.teamId));
            const playerRegion = playerTeam ? playerTeam.region : null;
            
            if (playerRegion !== regionFilter) return false;
        }

        // Team Filter
        if (teamFilter !== 'all') {
            if (player.team !== teamFilter) return false;
        }

        // Year Filter (Placeholder)
        if (yearFilter !== 'all') {
            if (yearFilter !== '2025') return false; 
        }

        // Player Type Filter
        if (typeFilter !== 'all') {
            const isStarter = player.isStarter || false;
            if (typeFilter === 'starters' && !isStarter) return false;
            if (typeFilter === 'substitutes' && isStarter) return false;
        }

        // Search Filter
        if (searchTerm) {
            const name = (player.name || '').toLowerCase();
            const gamertag = (player.gamertag || '').toLowerCase();
            const teamName = (player.team || '').toLowerCase();
            if (!name.includes(searchTerm) && !gamertag.includes(searchTerm) && !teamName.includes(searchTerm)) return false;
        }

        return true;
    });

    // Limit to first 100 to avoid performance issues
    renderPlayers(filteredPlayers.slice(0, 100));
}

function getPlayerOverall(p) {
    if (p.overall) return Math.round(p.overall);
    if (p.rating) {
      const r = p.rating;
      const stats = [r.aim, r.movement, r.gameSense, r.clutch, r.aggression, r.utility, r.mental, r.teamwork, r.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      return Math.round(sum / 9);
    }
    return Math.round(p.skill || 0);
}

function renderPlayers(players) {
    const container = document.getElementById('players-container');
    if (!container) return;
    
    container.innerHTML = '';

    if (players.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">No players found matching your criteria.</div>';
        return;
    }

    players.forEach(player => {
        const card = createPlayerCard(player);
        container.appendChild(card);
    });
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    const overall = getPlayerOverall(player);
    
    let ratingClass = 'text-gray-400';
    let borderColor = 'border-white/10';
    let bgGradient = '';
    
    if (overall >= 90) { 
        ratingClass = 'text-val-red'; 
        borderColor = 'border-val-red/50';
        bgGradient = 'from-val-red/5 to-transparent';
    } else if (overall >= 80) { 
        ratingClass = 'text-purple-400'; 
        borderColor = 'border-purple-500/30'; 
        bgGradient = 'from-purple-500/5 to-transparent';
    } else if (overall >= 70) { 
        ratingClass = 'text-blue-400'; 
        borderColor = 'border-blue-500/30'; 
        bgGradient = 'from-blue-500/5 to-transparent';
    } else if (overall >= 60) { 
        ratingClass = 'text-green-400'; 
        borderColor = 'border-green-500/30'; 
        bgGradient = 'from-green-500/5 to-transparent';
    }

    card.className = `bg-val-dark-grey/80 backdrop-blur-sm rounded-xl p-4 border ${borderColor} hover:scale-[1.02] hover:border-white/30 transition-all duration-300 relative group overflow-hidden shadow-lg cursor-pointer bg-gradient-to-br ${bgGradient}`;
    
    const flagUrl = getFlagUrl(player.nationality);
    const flagImg = flagUrl ? `<img src="${flagUrl}" class="w-5 h-3.5 object-cover rounded shadow-sm opacity-80 group-hover:opacity-100 transition-opacity" alt="${player.nationality}">` : '';

    // Add click event to open details
    card.onclick = () => showPlayerDetails(player);

    card.innerHTML = `
        <div class="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 pointer-events-none"></div>
        
        <div class="flex justify-between items-start mb-3 relative z-10">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-500 shadow-inner">
                   ${player.role ? player.role.substring(0, 2).toUpperCase() : 'FL'}
                </div>
                <div class="flex flex-col">
                    <h3 class="font-bold text-lg leading-tight text-white font-valorant tracking-wide group-hover:text-val-red transition-colors">${player.name}</h3>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        ${flagImg}
                        <span class="text-xs text-gray-400 font-mono uppercase">${player.nationality || 'Unknown'}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center w-10 h-10 rounded bg-black/40 border border-white/10 shadow-inner">
                <span class="text-[8px] uppercase tracking-wider text-gray-500 font-bold">OVR</span>
                <span class="text-lg font-bold ${ratingClass}">${overall}</span>
            </div>
        </div>
        
        <div class="space-y-2 mb-4 relative z-10">
            <div class="flex justify-between text-xs py-1 border-b border-white/5">
                <span class="text-gray-500 uppercase tracking-wider font-bold">Team</span>
                <span class="text-gray-300 truncate max-w-[120px]" title="${player.team || 'Free Agent'}">${player.team || 'Free Agent'}</span>
            </div>
            <div class="flex justify-between text-xs py-1 border-b border-white/5">
                <span class="text-gray-500 uppercase tracking-wider font-bold">Age</span>
                <span class="text-gray-300 font-mono">${player.age || 'N/A'}</span>
            </div>
             <div class="flex justify-between text-xs py-1">
                <span class="text-gray-500 uppercase tracking-wider font-bold">Role</span>
                <span class="text-gray-300">${player.role || 'Flex'}</span>
            </div>
        </div>

        <div class="mt-3 pt-3 border-t border-white/10 flex justify-between items-center relative z-10">
            <span class="text-xs text-green-400 font-mono">$${(player.marketValue || 0).toLocaleString()}</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">View Details &rarr;</span>
        </div>
    `;

    return card;
}

function showPlayerDetails(player) {
    const modal = document.getElementById('player-details-modal');
    const detailsContainer = document.getElementById('player-details');
    
    if (!modal || !detailsContainer) return;

    const overall = getPlayerOverall(player);
    const flagUrl = getFlagUrl(player.nationality);
    
    // Calculate rating color
    let ratingClass = 'text-gray-400';
    if (overall >= 90) ratingClass = 'text-val-red';
    else if (overall >= 80) ratingClass = 'text-purple-400';
    else if (overall >= 70) ratingClass = 'text-blue-400';
    else if (overall >= 60) ratingClass = 'text-green-400';

    const getRatingColor = (val) => {
        if (val >= 90) return 'text-val-red';
        if (val >= 80) return 'text-purple-400';
        if (val >= 70) return 'text-blue-400';
        if (val >= 60) return 'text-green-400';
        return 'text-gray-400';
    };

    const stats = player.rating || {
        aim: player.skill || 50,
        gameSense: player.skill || 50,
        utility: player.skill || 50,
        movement: player.skill || 50,
        mental: player.skill || 50,
        teamwork: player.skill || 50,
        clutch: player.skill || 50,
        aggression: player.skill || 50,
        consistency: player.skill || 50
    };

    detailsContainer.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="flex-1 space-y-6">
                <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center shadow-inner">
                         <span class="text-3xl font-bold ${ratingClass}">${overall}</span>
                    </div>
                    <div>
                        <h2 class="text-3xl font-bold text-white font-valorant tracking-wide">${player.name}</h2>
                        <div class="flex items-center gap-2 text-gray-400 mt-1">
                            ${flagUrl ? `<img src="${flagUrl}" class="w-5 h-3.5 object-cover rounded shadow-sm" alt="">` : ''}
                            <span class="text-sm font-mono uppercase">${player.nationality || 'Unknown'}</span>
                            <span class="w-1 h-1 bg-gray-600 rounded-full"></span>
                            <span class="text-sm text-val-red font-bold">${player.team || 'Free Agent'}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-lg border border-white/5">
                    <div class="space-y-1">
                        <span class="text-xs text-gray-500 uppercase tracking-wider font-bold block">Role</span>
                        <span class="text-white text-lg">${player.role || 'Flex'}</span>
                    </div>
                    <div class="space-y-1">
                        <span class="text-xs text-gray-500 uppercase tracking-wider font-bold block">Age</span>
                        <span class="text-white text-lg font-mono">${player.age || 'N/A'}</span>
                    </div>
                    <div class="space-y-1">
                        <span class="text-xs text-gray-500 uppercase tracking-wider font-bold block">Gamertag</span>
                        <span class="text-white text-lg">${player.gamertag || player.name}</span>
                    </div>
                     <div class="space-y-1">
                        <span class="text-xs text-gray-500 uppercase tracking-wider font-bold block">Market Value</span>
                        <span class="text-green-400 text-lg font-mono">$${(player.marketValue || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="flex-1">
                <h3 class="text-lg font-bold text-white mb-4 font-valorant border-b border-white/10 pb-2">Attributes</h3>
                <div class="grid grid-cols-2 gap-x-6 gap-y-3">
                    ${Object.entries(stats).map(([key, val]) => `
                        <div class="flex justify-between items-center group hover:bg-white/5 p-1 rounded transition-colors">
                            <span class="text-gray-400 capitalize text-sm">${key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span class="font-mono font-bold ${getRatingColor(val)}">${Math.round(val)}</span>
                        </div>
                    `).join('')}
                    <div class="flex justify-between items-center group hover:bg-white/5 p-1 rounded transition-colors mt-2 border-t border-white/10 pt-2 col-span-2">
                        <span class="text-gray-400 capitalize text-sm">Potential</span>
                        <span class="font-mono font-bold ${getRatingColor(player.potential || 70)}">${Math.round(player.potential || 70)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    // Animate in
    modal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0');
    modal.querySelector('.modal-content').classList.add('scale-100', 'opacity-100');
}

function closePlayerModal() {
    const modal = document.getElementById('player-details-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Make close function global for HTML access if needed
window.closePlayerModal = closePlayerModal;
