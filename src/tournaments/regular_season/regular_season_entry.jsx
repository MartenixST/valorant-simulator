import { renderRegularSeason } from './regular_season.jsx';
import { loadCareer } from '../../career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Regular Season entry point loaded');
    const activeSave = loadCareer();
    
    if (activeSave) {
        renderRegularSeason(activeSave);
    } else {
        console.error('No active career save found for Regular Season');
    }
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data === 'rerenderRegularSeason') {
        console.log('Received rerenderRegularSeason message');
        const activeSave = loadCareer();
        if (activeSave) renderRegularSeason(activeSave);
    }
});