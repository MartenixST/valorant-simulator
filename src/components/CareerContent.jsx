import React, { useEffect, useState } from 'react';
import Inbox from './Inbox.jsx';
import SimWeekButton from './SimWeekButton.jsx'; // Import SimWeekButton
import PlayersHub from './PlayersHub.jsx';
import { teams, teamLogos } from '../teams.js';
import { Player, Team, MatchSimulator, ROLES } from '../simulation.js';
import { saveCareer, loadCareer } from '../career_local_storage.jsx';
import { renderTeamRoster } from '../career.js';

const CareerContent = ({ activeSection, activeSave, setActiveSave }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Get current team info
  const teamInfo = activeSave ? (teams.find(t => String(t.id) === String(activeSave.teamId)) || { power: 0, potential: 0 }) : { power: 0, potential: 0 };

  const myPlayers = activeSave?.players?.filter(p => {
    const normalize = (n) => String(n || '').toLowerCase().trim();
    
    const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
    const activeTeamNameNorm = normalize(activeSave.team);
    
    const playerTeamId = p.teamId ? String(p.teamId) : null;
    const playerTeamNameNorm = normalize(p.team);

    const matchesId = activeTeamId && playerTeamId && playerTeamId === activeTeamId;
    const matchesName = activeTeamNameNorm && playerTeamNameNorm && playerTeamNameNorm === activeTeamNameNorm;
    
    return matchesId || matchesName;
  }) || [];
  
  if (activeSave) {
    console.log("CareerContent: activeSave.teamId:", activeSave.teamId, "name:", activeSave.team);
    console.log("CareerContent: myPlayers count:", myPlayers.length, "Total players:", activeSave.players?.length);
    if (myPlayers.length === 0 && activeSave.players?.length > 0) {
        const p0 = activeSave.players[0];
        console.warn("No players matched! Sample player:", {
            name: p0.name,
            teamId: p0.teamId,
            team: p0.team,
            teamIdType: typeof p0.teamId,
            activeTeamId: activeSave.teamId,
            activeTeamName: activeSave.team
        });
        
        // Count players per team for debugging
         const teamCounts = {};
         activeSave.players.forEach(p => {
             const tid = (p.teamId && p.teamId !== 'null' && p.teamId !== 'undefined') ? p.teamId : 'Free Agent';
             teamCounts[tid] = (teamCounts[tid] || 0) + 1;
         });
         console.log("Team distribution in save:", teamCounts);
    }
  }
  const playerCount = myPlayers.length;

  useEffect(() => {
    if (activeSave && activeSave.inbox && activeSave.inbox.length > 0) {
      setSelectedMessage(activeSave.inbox[0]);
    }

    if (activeSection === 'career-manage-team' && activeSave) {
      // Use a small timeout to ensure the DOM element is rendered
      setTimeout(() => {
        renderTeamRoster(activeSave);
      }, 0);
    }

    // Send message to iframe to re-render kickoff bracket when activeSave changes
    if (activeSection === 'kickoff') {
      const iframe = document.getElementById('kickoff-iframe');
      if (iframe && iframe.contentWindow) {
        // Use window.location.origin instead of '*' for better security and to potentially 
        // avoid triggering some extension listeners that ignore specific-origin messages
        iframe.contentWindow.postMessage('rerenderKickoff', window.location.origin);
      }
    }
  }, [activeSave, activeSection]);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  return (
    <div className="content">
      {activeSection === 'career-dashboard' && (
        <div id="career-dashboard" className="content-section">
          <div className="office-header">
            <h2>My Office</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.offseason?.phase === 'offseason' ? 'Offseason' : 'Kickoff'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <div className="office-layout">
            <div className="office-left">
              {activeSave && <div className="inbox-container"><Inbox inbox={activeSave.inbox} onMessageClick={handleMessageClick} selectedMessage={selectedMessage} /></div>}
            </div>
            <div className="office-right">
              <div className="box" id="email-content">
                {selectedMessage ? (
                  <>
                    <h3>{selectedMessage.subject || 'New Message'}</h3>
                    <div className="email-body">
                      {selectedMessage.body ? selectedMessage.body.split('\n').map((line, index) => (
                        <p key={index}>{line}</p>
                      )) : ''}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>No Message Selected</h3>
                    <div className="email-body">
                      Select a message from the inbox to view its content.
                    </div>
                  </>
                )}
              </div>
              <div className="office-bottom">
                <div className="box" id="week-matches">
                  <h3>Week Matches</h3>
                  <div className="no-matches">No matches.</div>
                </div>
                <div className="box" id="career-history">
                  <h3>Career History</h3>
                  <ul id="historyList"></ul>
                </div>
              </div>
            </div>
          </div>
          <div id="championship-points" className="box">
            <h3>Championship Points</h3>
            <ul>
              <li>EMEA</li>
            </ul>
          </div>
        </div>
      )}

      {activeSection === 'career-calendar' && (
        <div id="career-calendar" className="content-section">
          <h2>Calendar</h2>
          <div className="calendar-container">
            <p>Calendar view coming soon</p>
          </div>
        </div>
      )}

      {activeSection === 'career-manage-team' && (
        <div id="career-manage-team" className="content-section full-width">
          <div className="team-management-header">
            <div className="team-branding">
              {activeSave && teamLogos[activeSave.team] && (
                <img src={teamLogos[activeSave.team]} alt={activeSave.team} className="team-header-logo" />
              )}
              <div className="team-name-info">
                <h2>Manage Team</h2>
                <div className="team-name-tag">{activeSave?.team || 'No Team Selected'}</div>
              </div>
            </div>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.offseason?.phase === 'offseason' ? 'Offseason' : 'Kickoff'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          
          <div className="team-management-layout">
            <div className="management-main">
              <div className="box roster-box">
                <div className="box-header">
                  <h3>Team Roster</h3>
                  <div className="roster-actions">
                    <span className={`roster-count ${playerCount > 7 ? 'over-limit' : ''}`}>
                      {playerCount} / 7 Players 
                      <span className="count-detail"> (5 Primary + {Math.max(0, playerCount - 5)} Subs)</span>
                    </span>
                  </div>
                </div>
                <div id="team-roster">
                  {activeSave ? (
                    <div className="team-roster-container">
                      {/* renderTeamRoster will populate this div via useEffect */}
                    </div>
                  ) : (
                    <div className="roster-placeholder">Please start a career to view your team roster</div>
                  )}
                </div>
              </div>
            </div>

            <div className="management-sidebar">
              <div className="box performance-box">
                <h3>Team Performance</h3>
                <div id="team-performance">
                  {activeSave ? (
                    <div className="team-performance-container">
                      <div className="team-stats-grid">
                        <div className="stat-card">
                          <div className="stat-title">Overall Power</div>
                          <div className="stat-value">{teamInfo.power}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-title">Team Potential</div>
                          <div className="stat-value">{teamInfo.potential}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-title">Region</div>
                          <div className="stat-value">{activeSave?.region || 'Unknown'}</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-title">Budget</div>
                          <div className="stat-value budget-value">${(activeSave?.budget || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="performance-placeholder">Please start a career to view team performance</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'career-players' && (
        <div id="career-players" className="content-section">
          <PlayersHub activeSave={activeSave} setActiveSave={setActiveSave} />
        </div>
      )}

      {activeSection === 'career-league' && (
        <div id="career-league" className="content-section">
          <h2>League</h2>
          <div className="league-container">
            <p>League content coming soon</p>
          </div>
        </div>
      )}

      {activeSection === 'career-strategy' && (
        <div id="career-strategy" className="content-section">
          <h2>Team Strategy & Tactics</h2>
          
          <div className="strategy-grid">
            <div className="box">
              <h3>General Strategy</h3>
              <div className="setting-group">
                <h4>Playstyle</h4>
                <div className="setting-options vertical">
                  <button className="strategy-btn active">Balanced</button>
                  <button className="strategy-btn">Aggressive (Fast Executes)</button>
                  <button className="strategy-btn">Defensive (Map Control)</button>
                  <button className="strategy-btn">Contact (Quiet Entry)</button>
                </div>
              </div>
              
              <div className="setting-group">
                <h4>Practice Focus</h4>
                <div className="setting-options grid">
                  <button className="practice-btn active">All-Around</button>
                  <button className="practice-btn">Aim Training</button>
                  <button className="practice-btn">Strategy</button>
                  <button className="practice-btn">Team Chemistry</button>
                  <button className="practice-btn">Utility Usage</button>
                  <button className="practice-btn">Clutch Situations</button>
                </div>
              </div>
            </div>

            <div className="box">
              <h3>Tactical Settings</h3>
              <div className="setting-group">
                <h4>Economy Management</h4>
                <div className="setting-options vertical">
                  <button className="strategy-btn active">Standard (Save at 2k)</button>
                  <button className="strategy-btn">Aggressive (Force Buy Often)</button>
                  <button className="strategy-btn">Conservative (Full Save for Ops)</button>
                </div>
              </div>

              <div className="setting-group">
                <h4>Map Priority</h4>
                <div className="setting-options grid">
                  <button className="strategy-btn active">Balanced</button>
                  <button className="strategy-btn">Site Retakes</button>
                  <button className="strategy-btn">Mid Control</button>
                  <button className="strategy-btn">Entry Fragging</button>
                </div>
              </div>
            </div>

            <div className="box full-row">
              <h3>Agent Composition Strategy</h3>
              <div className="agent-strategy-info">
                <p>Customize how your team prioritizes agent picks and utility combinations during matches.</p>
                <div className="coming-soon-tag">Advanced Tactics Coming Soon</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'career-stats' && (
        <div id="career-stats" className="content-section">
          <h2>Stats</h2>
          <div className="stats-container">
            <p>Stats content coming soon</p>
          </div>
        </div>
      )}

      {activeSection === 'career-scripts' && (
        <div id="career-scripts" className="content-section">
          <h2>Scripts</h2>
          <div className="scripts-container">
            <p>Scripts content coming soon</p>
          </div>
        </div>
      )}

      {activeSection === 'career-standings' && (
        <div id="career-standings" className="content-section">
          <h2>VCT Standings</h2>
          <iframe id="standings-iframe" src="standings.html" style={{ width: '100%', height: '800px', border: 'none' }} title="VCT Standings"></iframe>
        </div>
      )}

      {activeSection === 'career-offseason' && (
        <div id="career-offseason" className="content-section">
          <h2>Offseason</h2>
          <div className="offseason-container">
            <p>Offseason content coming soon</p>
          </div>
        </div>
      )}

      {activeSection === 'career-events' && (
        <div id="career-events" className="content-section">
          <h2>Regional Event Bracket</h2>
          <div className="events-container">
            <div id="kickoffUpperBracket">
              <div id="kickoffUpperBracketWinner"></div>
            </div>
            <div id="kickoffLowerBracket"></div>
          </div>
        </div>
      )}

      {activeSection === 'kickoff' && (
        <div id="kickoff-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <iframe 
            id="kickoff-iframe" 
            src="kickoff.html" 
            style={{ 
              width: '100%', 
              height: '100%', 
              minHeight: '800px',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Kickoff Bracket"
          ></iframe>
        </div>
      )}
    </div>
  );
};

export default CareerContent;