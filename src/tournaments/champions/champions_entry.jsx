/**
 * Champions 2025 - Entry Point
 */

import { renderChampions } from './champions.jsx';
import { loadCareer, saveCareer } from '../../career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Champions 2025: Loading...');
    
    // Always use loadCareer() which properly loads complete save with all properties
    let activeSave = loadCareer();
    
    console.log('Champions 2025 - loaded save:', activeSave ? 'Found save' : 'No save');
    console.log('Champions 2025 - championsState:', activeSave?.championsState ? 'Found state' : 'No state');
    console.log('Champions 2025 - week:', activeSave?.week);
    
    if (activeSave) {
        // NOTE: Auto-initialization removed - tournament should be initialized via SimWeekButton
        // at Week 36 through the normal career flow, not here on page load
        // This page is now display-only for the Champions tournament state
        
        renderChampions(activeSave, saveCareer, (page) => {
            window.location.href = `${page}.html`;
        });
    } else {
        console.error('No active career save found for Champions 2025');
        document.getElementById('app').innerHTML = `
            <div style="text-align: center; padding: 50px; color: #8b9dc3;">
                <p>No save data found.</p>
                <p style="font-size: 12px; margin-top: 10px;">Start a career to view the tournament.</p>
            </div>
        `;
    }
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data === 'rerenderChampions') {
        console.log('Received rerenderChampions message');
        const activeSave = loadCareer();
        if (activeSave) {
            renderChampions(activeSave, saveCareer, (page) => {
                window.location.href = `${page}.html`;
            });
        }
    }
});

// Export for debugging
window.championsDebug = {
    get state() { return loadCareer()?.championsState; },
    get save() { return loadCareer(); }
};
