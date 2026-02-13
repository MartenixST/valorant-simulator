import { renderKickoff } from './kickoff.jsx';
import { getKickoffState, loadCareer } from '../../career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Kickoff entry point loaded');
    const activeSaveId = localStorage.getItem('activeSaveId');
    
    // If no active profile, reset the global kickoff state so it starts fresh every time
    if (!activeSaveId) {
        console.log('No active profile found, resetting global kickoff state');
        localStorage.removeItem("valorantKickoffState");
    }
    
    const activeSave = loadCareer();
    const defaultRegion = activeSave ? activeSave.region : "Americas";
    
    // Set initial active region button
    const buttons = document.querySelectorAll('.region-btn');
    buttons.forEach(btn => {
        if (btn.dataset.region === defaultRegion) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
            const region = btn.dataset.region;
            console.log(`Switching to region: ${region}`);
            
            // Update active state of buttons
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load and render kickoff for selected region
            const activeSaveId = localStorage.getItem('activeSaveId');
            const st = getKickoffState(region, activeSaveId);
            renderKickoff(st);
        });
    });

    const st = getKickoffState(defaultRegion, activeSaveId);
    renderKickoff(st);
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    // Only accept messages from the same origin
    if (event.origin !== window.location.origin) return;
    
    if (event.data && event.data.type === 'rerenderKickoff') {
        console.log('Received rerenderKickoff message for region:', event.data.region);
        const activeSaveId = localStorage.getItem('activeSaveId');
        const region = event.data.region || "Americas";
        const st = getKickoffState(region, activeSaveId);
        renderKickoff(st);
    }
});
