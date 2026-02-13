import React, { useState, useEffect } from 'react'
import CareerContent from './components/CareerContent.jsx'
import CareerSidebar from './components/CareerSidebar.jsx'
import TutorialOverlay from './components/TutorialOverlay.jsx'
import { loadCareerAsync, saveCareer } from './career_local_storage.jsx'

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
  }, []);

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

  const handleTutorialNext = () => {
    if (!activeSave) return;
    const nextStep = (activeSave.tutorialStep || 0) + 1;
    if (nextStep >= 5) { // Assuming 5 steps for now
      setActiveSave({
        ...activeSave,
        tutorialStep: nextStep,
        tutorialCompleted: true
      });
    } else {
      setActiveSave({
        ...activeSave,
        tutorialStep: nextStep
      });
    }
  };

  const handleTutorialSkip = () => {
    if (!activeSave) return;
    setActiveSave({
      ...activeSave,
      tutorialCompleted: true
    });
  };

  return (
    <div className="career-container">
      <CareerSidebar activeSave={activeSave} handleNavClick={handleNavClick} />
      <div className="main-container">
        <CareerContent activeSave={activeSave} setActiveSave={setActiveSave} activeSection={activeSection} />
      </div>
      {activeSave && !activeSave.tutorialCompleted && (
        <TutorialOverlay 
          step={activeSave.tutorialStep || 0} 
          onNext={handleTutorialNext} 
          onSkip={handleTutorialSkip} 
        />
      )}
    </div>
  )
}

export default App


