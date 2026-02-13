import { teams } from './teams.js';
import { loadCareer, startCareer, renderSaves, deleteSave, backToMenu } from './career_local_storage.jsx';

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

function showNewGame() {
  console.log('showNewGame called');
  showSection('new-game');
  const teamPicker = document.getElementById("teamPicker");
  teamPicker.innerHTML = ""; // Clear previous options
  
  // Add a default, disabled option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select a Team";
  defaultOpt.disabled = true;
  defaultOpt.selected = true;
  teamPicker.appendChild(defaultOpt);

  teams.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team.name;
    opt.textContent = team.name;
    teamPicker.appendChild(opt);
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
    const teamName = document.getElementById('teamPicker').value;
    const selectedTeam = teams.find(t => t.name === teamName);
    const region = selectedTeam ? selectedTeam.region : 'Unknown';
    startCareer(managerName, teamName, region);
  });

  renderSaves();
});