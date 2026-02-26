import React, { useState, useEffect } from 'react'
import CareerContent from './components/CareerContent.jsx'
import CareerSidebar from './components/CareerSidebar.jsx'
import { loadCareerAsync, saveCareer } from './career_local_storage.jsx'
import { showTutorialPrompt, startInteractiveTour } from './tutorial.js'

function App() {
  const [activeSave, setActiveSave] = useState(null);
  const [activeSection, setActiveSection] = useState('career-dashboard');

  useEffect(() => {
    const fetchCareer = async () => {
      console.log("App.jsx: localStorage activeSaveId at init:", localStorage.getItem('activeSaveId'));
      try {
        const career = await loadCareerAsync();
        if (career) {
          console.log("Loaded activeSave:", career);
          setActiveSave(career);
        }
      } catch (error) {
        console.error("App.jsx: Error in fetchCareer:", error);
      }
    };
    fetchCareer();

    // Listen for career updates from other components/global functions
    const handleCareerUpdate = (event) => {
      if (event.detail) {
        console.log("App.jsx: Received careerUpdate event", event.detail);
        setActiveSave(event.detail);
      }
    };

    window.addEventListener('careerUpdate', handleCareerUpdate);
    return () => {
      window.removeEventListener('careerUpdate', handleCareerUpdate);
    };
  }, []);

  // Tutorial Prompt Effect
  useEffect(() => {
    if (activeSave && activeSave.tutorialPending) {
      showTutorialPrompt(
        // On Accept
        () => {
          startInteractiveTour(() => {
            // On Tour Complete
            setActiveSave(prev => ({ ...prev, tutorialPending: false }));
          });
        },
        // On Decline
        () => {
          setActiveSave(prev => ({ ...prev, tutorialPending: false }));
        }
      );
    }
  }, [activeSave]);

  // Persist activeSave changes to storage
  useEffect(() => {
    if (activeSave) {
      console.log("App.jsx: Auto-saving activeSave changes...");
      saveCareer(activeSave);
    }
  }, [activeSave]);

  // Final safety save on window unload/reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeSave) {
        // We can't use await here, but saveCareer already does 
        // synchronous localStorage.setItem before the fetch
        saveCareer(activeSave);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeSave]);

  const handleNavClick = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="career-container">
      <CareerSidebar activeSave={activeSave} handleNavClick={handleNavClick} />
      <div className="main-container">
        <CareerContent activeSave={activeSave} setActiveSave={setActiveSave} activeSection={activeSection} />
      </div>
    </div>
  )
}

export default App


