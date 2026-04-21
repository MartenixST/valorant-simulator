import { teams, teamLogos } from './teams.js';
import { loadCareer, startCareer, renderSaves, deleteSave } from './career_local_storage.jsx';

function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');
}

function showLoadGame() {
  console.log('showLoadGame called');
  showSection('load-game');
  renderSaves();
}

let selectedTeam = null;

function showNewGame() {
  console.log('showNewGame called');
  showSection('new-game');
  renderTeamPicker();
}

function renderTeamPicker(filterRegion = 'All') {
  const teamPickerContainer = document.getElementById("teamPickerContainer");
  if (!teamPickerContainer) return;
  
  teamPickerContainer.innerHTML = "";
  
  // Create region filter buttons
  const regionFilters = document.createElement('div');
  regionFilters.className = 'region-filters';
  
  const regions = ['All', 'Americas', 'EMEA', 'Pacific', 'China'];
  regions.forEach(region => {
    const btn = document.createElement('button');
    btn.className = `region-btn ${filterRegion === region ? 'active' : ''}`;
    btn.textContent = region;
    btn.onclick = () => renderTeamPicker(region);
    regionFilters.appendChild(btn);
  });
  
  teamPickerContainer.appendChild(regionFilters);
  
  // Create team grid
  const teamGrid = document.createElement('div');
  teamGrid.className = 'team-grid';
  
  const filteredTeams = filterRegion === 'All' 
    ? teams 
    : teams.filter(t => t.region === filterRegion);
  
  filteredTeams.forEach(team => {
    const teamCard = document.createElement('div');
    teamCard.className = `team-card ${selectedTeam?.id === team.id ? 'selected' : ''}`;
    teamCard.onclick = () => selectTeam(team);
    
    const logoPath = teamLogos[team.name] || `assets/team_logos/${team.name.toLowerCase().replace(/ /g, '_')}.png`;
    
    teamCard.innerHTML = `
      <img src="${logoPath}" alt="${team.name}" class="team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-region">${team.region}</div>
      </div>
    `;
    
    teamGrid.appendChild(teamCard);
  });
  
  teamPickerContainer.appendChild(teamGrid);
  
  // Update selected team display
  updateSelectedTeamDisplay();
}

function selectTeam(team) {
  selectedTeam = team;
  renderTeamPicker(document.querySelector('.region-btn.active')?.textContent || 'All');
}

function updateSelectedTeamDisplay() {
  let displayContainer = document.getElementById('selectedTeamDisplay');
  
  if (!displayContainer) {
    displayContainer = document.createElement('div');
    displayContainer.id = 'selectedTeamDisplay';
    const teamPickerContainer = document.getElementById('teamPickerContainer');
    if (teamPickerContainer) {
      teamPickerContainer.insertBefore(displayContainer, teamPickerContainer.firstChild);
    }
  }
  
  if (selectedTeam) {
    const logoPath = teamLogos[selectedTeam.name] || `assets/team_logos/${selectedTeam.name.toLowerCase().replace(/ /g, '_')}.png`;
    displayContainer.className = 'selected-team-display';
    displayContainer.innerHTML = `
      <img src="${logoPath}" alt="${selectedTeam.name}" class="selected-logo" onerror="this.style.display='none';">
      <div class="selected-info">
        <h3>${selectedTeam.name}</h3>
        <p>${selectedTeam.region} Region</p>
      </div>
    `;
    displayContainer.style.display = 'flex';
  } else {
    displayContainer.style.display = 'none';
  }
}

function backToMenu() {
  const elements = ['career-start', 'load-game', 'new-game'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'career-start') el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}

// Initial render of saves when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired in career_entry.js');
  // Ensure the initial view is the career-start section
  showSection('career-start');

  document.getElementById('newGameBtn').addEventListener('click', showNewGame);
  document.getElementById('loadGameBtn').addEventListener('click', showLoadGame);
  document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
  document.getElementById('backToMenuLoadBtn').addEventListener('click', () => showSection('career-start'));
  document.getElementById('backToMenuNewBtn').addEventListener('click', () => showSection('career-start'));

  document.getElementById('startGameBtn').addEventListener('click', () => {
    const managerName = document.getElementById('managerName').value;
    
    if (!managerName) {
      alert("Please enter your manager name.");
      return;
    }
    
    if (!selectedTeam) {
      alert("Please select a team.");
      return;
    }
    
    startCareer(managerName, selectedTeam.name, selectedTeam.region);
  });

  renderSaves();
});