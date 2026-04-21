import { renderMastersTokyo } from './masters_tokyo.jsx';
import { loadCareer } from '../../../career_local_storage.jsx';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Masters Tokyo entry point loaded');
    const activeSave = loadCareer();
    
    console.log('Masters Tokyo - loaded save:', activeSave ? 'Found save' : 'No save');
    console.log('Masters Tokyo - mastersTokyoState:', activeSave?.mastersTokyoState ? 'Found state' : 'No state');
    console.log('Masters Tokyo - week:', activeSave?.week);
    
    if (activeSave) {
        renderMastersTokyo(activeSave);
    } else {
        console.error('No active career save found for Masters Tokyo');
    }
});

// Listen for messages from other parts of the app
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data === 'rerenderMastersTokyo') {
        console.log('Received rerenderMastersTokyo message');
        const activeSave = loadCareer();
        if (activeSave) renderMastersTokyo(activeSave);
    }
});
