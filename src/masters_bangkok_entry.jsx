import { renderMasters } from './masters_bangkok.jsx';
import { loadCareer } from './career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Masters Bangkok entry point loaded');
    const activeSave = loadCareer();
    
    if (activeSave) {
        renderMasters(activeSave);
    } else {
        console.error('No active career save found for Masters Bangkok');
    }
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data === 'rerenderMasters') {
        console.log('Received rerenderMasters message');
        const activeSave = loadCareer();
        if (activeSave) renderMasters(activeSave);
    }
});
