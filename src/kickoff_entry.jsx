import { renderKickoff } from './kickoff.jsx';
import { getKickoffState } from './career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Kickoff entry point loaded');
    const storedState = localStorage.getItem("valorantKickoffState");
    const st = storedState ? JSON.parse(storedState) : getKickoffState();
    renderKickoff(st);
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    if (event.data === 'rerenderKickoff') {
        console.log('Received rerenderKickoff message');
        const storedState = localStorage.getItem("valorantKickoffState");
        const st = storedState ? JSON.parse(storedState) : getKickoffState();
        renderKickoff(st);
    }
});
