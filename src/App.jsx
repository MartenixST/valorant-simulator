import React, { useState, useEffect } from 'react'
import CareerContent from './components/CareerContent.jsx'
import CareerSidebar from './components/CareerSidebar.jsx'
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


