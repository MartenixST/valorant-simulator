import { renderKickoff } from './kickoff.jsx';
import { getKickoffState } from './career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Kickoff entry point loaded');
    const activeSaveId = localStorage.getItem('activeSaveId');
    
    // If no active profile, reset the global kickoff state so it starts fresh every time
    if (!activeSaveId) {
        console.log('No active profile found, resetting global kickoff state');
        localStorage.removeItem("valorantKickoffState");
    }
    
    const st = getKickoffState(activeSaveId);
    renderKickoff(st);
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    // Only accept messages from the same origin
    if (event.origin !== window.location.origin) return;
    
    if (event.data === 'rerenderKickoff') {
        console.log('Received rerenderKickoff message');
        const activeSaveId = localStorage.getItem('activeSaveId');
        const st = getKickoffState(activeSaveId);
        renderKickoff(st);
    }
});
