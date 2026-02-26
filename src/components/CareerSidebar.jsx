import React from 'react';
import { teams, teamLogos } from '../teams.js'; // Import teams and teamLogos
import SimWeekButton from './SimWeekButton.jsx';
import { startTutorialFlow } from '../tutorial.js';

const CareerSidebar = ({ activeSection, handleNavClick, activeSave, setActiveSave }) => {
  const handleExport = (e) => {
    e.preventDefault();
    try {
      const activeSaveId = localStorage.getItem('activeSaveId');
      if (!activeSaveId) {
        alert('No active save found to export.');
        return;
      }
      const localSave = localStorage.getItem(`save_${activeSaveId}`);
      if (!localSave) {
        alert('Could not find save data in storage.');
        return;
      }
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(localSave);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `valorant_sim_save_${activeSaveId}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export save file.');
    }
  };

  return (
    <div className="sidebar">
      <div id="careerInfo" className="career-info">
        {activeSave && activeSave.team && (
          <img src={teamLogos[activeSave.team]} alt={`${activeSave.team} Logo`} className="team-logo" />
        )}
        {activeSave && (
          <p className="team-name">{activeSave.team}</p>
        )}
        {activeSave && (
          <p className="manager-name">{activeSave.manager}</p>
        )}
      </div>
      <nav id="main-nav">
        {activeSave && activeSave.week === 4 && (
          <a href="#" onClick={() => handleNavClick('kickoff')} data-tour="kickoff" className={`nav-item kickoff-button ${activeSection === 'kickoff' ? 'active' : ''}`}><i className="fa-solid fa-play icon" style={{ marginRight: '8px' }}></i>Kickoff</a>
        )}
        {activeSave && activeSave.week >= 5 && activeSave.week <= 11 && (
          <a href="#" onClick={() => handleNavClick('masters-bangkok')} data-tour="masters-bangkok" className={`nav-item masters-button ${activeSection === 'masters-bangkok' ? 'active' : ''}`}><i className="fa-solid fa-earth-asia icon" style={{ marginRight: '8px' }}></i>Masters Bangkok</a>
        )}
        {activeSave && activeSave.week >= 12 && activeSave.week <= 16 && (
          <a href="#" onClick={() => handleNavClick('regular-season')} data-tour="regular-season" className={`nav-item regular-season-button ${activeSection === 'regular-season' ? 'active' : ''}`}><i className="fa-solid fa-calendar-week icon" style={{ marginRight: '8px' }}></i>Regional Groups</a>
        )}
        {activeSave && activeSave.week >= 17 && (
          <a href="#" onClick={() => handleNavClick('regular-season')} data-tour="regular-season-playoffs" className={`nav-item regular-season-button ${activeSection === 'regular-season' ? 'active' : ''}`}><i className="fa-solid fa-trophy icon" style={{ marginRight: '8px' }}></i>Regional Playoffs</a>
        )}
        <a href="#" onClick={() => handleNavClick('career-dashboard')} data-tour="dashboard" className={`nav-item ${activeSection === 'career-dashboard' ? 'active' : ''}`}><i className="fa-solid fa-house icon" style={{ marginRight: '8px' }}></i>My Office</a>
        <a href="#" onClick={() => handleNavClick('career-calendar')} data-tour="calendar" className={`nav-item ${activeSection === 'career-calendar' ? 'active' : ''}`}><i className="fa-solid fa-calendar-days icon" style={{ marginRight: '8px' }}></i>Calendar</a>
        <a href="#" onClick={() => handleNavClick('career-standings')} data-tour="standings" className={`nav-item ${activeSection === 'career-standings' ? 'active' : ''}`}><i className="fa-solid fa-trophy icon" style={{ marginRight: '8px' }}></i>Standings</a>
        <a href="#" onClick={() => handleNavClick('career-manage-team')} data-tour="manage-team" className={`nav-item ${activeSection === 'career-manage-team' ? 'active' : ''}`}><i className="fa-solid fa-users icon" style={{ marginRight: '8px' }}></i>Manage Team</a>
        <a href="#" onClick={() => handleNavClick('career-players')} data-tour="players" className={`nav-item ${activeSection === 'career-players' ? 'active' : ''}`}><i className="fa-solid fa-user-group icon" style={{ marginRight: '8px' }}></i>Players Hub</a>
        <a href="#" onClick={() => handleNavClick('career-league')} data-tour="league" className={`nav-item ${activeSection === 'career-league' ? 'active' : ''}`}><i className="fa-solid fa-medal icon" style={{ marginRight: '8px' }}></i>League</a>
        <a href="#" onClick={() => handleNavClick('career-strategy')} data-tour="strategy" className={`nav-item ${activeSection === 'career-strategy' ? 'active' : ''}`}><i className="fa-solid fa-brain icon" style={{ marginRight: '8px' }}></i>Strategy</a>
        <a href="#" onClick={() => handleNavClick('career-stats')} data-tour="stats" className={`nav-item ${activeSection === 'career-stats' ? 'active' : ''}`}><i className="fa-solid fa-chart-simple icon" style={{ marginRight: '8px' }}></i>Stats</a>
        <a href="#" onClick={() => handleNavClick('career-goat-meter')} data-tour="goat-meter" className={`nav-item ${activeSection === 'career-goat-meter' ? 'active' : ''}`}><i className="fa-solid fa-ranking-star icon" style={{ marginRight: '8px' }}></i>GOAT Meter</a>
        <a href="#" onClick={() => handleNavClick('career-scripts')} data-tour="scripts" className={`nav-item ${activeSection === 'career-scripts' ? 'active' : ''}`}><i className="fa-solid fa-file-code icon" style={{ marginRight: '8px' }}></i>Scripts</a>
      </nav>
      <div className="sidebar-footer">
        <a href="#" className="nav-item" data-tour="tutorial" onClick={(e) => { e.preventDefault(); startTutorialFlow(); }}><i className="fa-solid fa-graduation-cap icon" style={{ marginRight: '8px' }}></i>Tutorial</a>
        <a href="#" className="nav-item" data-tour="export" onClick={handleExport}><i className="fa-solid fa-file-export icon" style={{ marginRight: '8px' }}></i>Export File</a>
        <a href="#" className="nav-item" onClick={() => window.location.href = 'career_entry.html'}><i className="fa-solid fa-arrow-left icon" style={{ marginRight: '8px' }}></i>Back</a>
      </div>
    </div>
  );
};

export default CareerSidebar;