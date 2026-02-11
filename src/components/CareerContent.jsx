import React, { useEffect, useState, useMemo } from 'react';
import Inbox from './Inbox.jsx';
import SimWeekButton from './SimWeekButton.jsx'; // Import SimWeekButton
import PlayersHub from './PlayersHub.jsx';
import StatsHub from './StatsHub.jsx';
import ScriptsHub from './ScriptsHub.jsx';
import { teams, teamLogos } from '../teams.js';
import { Player, Team, MatchSimulator, ROLES } from '../simulation.js';
import { saveCareer, loadCareer } from '../career_local_storage.jsx';
import { renderTeamRoster } from '../career.js';

const CareerContent = ({ activeSection, activeSave, setActiveSave }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [activeLeagueTab, setActiveLeagueTab] = useState('news');
  const [leagueTickerItems, setLeagueTickerItems] = useState([]);

  // Strategy State Management
  const [teamStrategy, setTeamStrategy] = useState({
    playstyle: 'balanced', // balanced, aggressive, defensive, tactical
    focus: 'standard', // standard, entry, trade, map-control, retake
    eco: 'standard', // standard, stingy, aggressive-buy
    activity: 'standard' // standard, scrim, practice, bonding
  });

  const [selectedMatchLogs, setSelectedMatchLogs] = useState(null);

  const handleMatchClick = (match) => {
    // If clicking same match, toggle off
    if (selectedMatchLogs?.id === match.id) {
      setSelectedMatchLogs(null);
    } else {
      // Find logs from either history item directly or its details
      const logs = match.logs || match.details?.logs;
      if (logs) {
        setSelectedMatchLogs({ 
          id: match.id || Math.random(), 
          logs: logs, 
          title: match.text 
        });
      }
    }
  };

  useEffect(() => {
    if (activeSave?.strategies) {
      setTeamStrategy(activeSave.strategies);
    }
  }, [activeSave?.id]);

  const updateStrategy = (key, value) => {
    const newStrategy = { ...teamStrategy, [key]: value };
    setTeamStrategy(newStrategy);
    
    // Persist to activeSave
    const updatedSave = {
      ...activeSave,
      strategies: newStrategy
    };
    setActiveSave(updatedSave);
    saveCareer(updatedSave);
  };

  // Calculate dynamic league records based on all match data
  const leagueRecords = React.useMemo(() => {
    if (!activeSave) return { maxKills: null, maxADR: null, maxHS: null, maxAssists: null };

    const records = {
      maxKills: { value: 0, player: '-', team: '-' },
      maxADR: { value: 0, player: '-', team: '-' },
      maxHS: { value: 0, player: '-', team: '-' },
      maxAssists: { value: 0, player: '-', team: '-' }
    };

    const processMatch = (match) => {
      if (!match.playerStats) return;

      // Calculate rounds for ADR
      let rounds = 0;
      if (match.mapResults) {
        match.mapResults.forEach(m => {
          const scores = m.score.split('-');
          rounds += parseInt(scores[0]) + parseInt(scores[1]);
        });
      } else {
        rounds = 24;
      }

      Object.entries(match.playerStats).forEach(([id, stats]) => {
        // Max Kills
        if (stats.kills > records.maxKills.value) {
          records.maxKills = { value: stats.kills, player: stats.name, team: stats.teamName };
        }
        // Max ADR
        const adr = rounds > 0 ? Math.round((stats.damage || stats.damageDealt || 0) / rounds) : 0;
        if (adr > records.maxADR.value) {
          records.maxADR = { value: adr, player: stats.name, team: stats.teamName };
        }
        // Max HS (count)
        if (stats.hs > records.maxHS.value) {
          records.maxHS = { value: stats.hs, player: stats.name, team: stats.teamName };
        }
        // Max Assists
        if (stats.assists > records.maxAssists.value) {
          records.maxAssists = { value: stats.assists, player: stats.name, team: stats.teamName };
        }
      });
    };

    // 1. Process Kickoff
    if (activeSave.kickoffState?.series) {
      Object.values(activeSave.kickoffState.series).forEach(processMatch);
    }
    // 2. Process Regular Season
    if (activeSave.regularSeasonMatches) {
      activeSave.regularSeasonMatches.forEach(processMatch);
    }

    return records;
  }, [activeSave]);

  // Calculate league leaders for awards
  const leagueLeaders = React.useMemo(() => {
    if (!activeSave) return { mvp: null, evp: null };

    const playerMap = new Map();

    const processMatch = (match) => {
      if (!match.playerStats) return;
      Object.entries(match.playerStats).forEach(([id, stats]) => {
        if (!playerMap.has(id)) {
          playerMap.set(id, { name: stats.name, team: stats.teamName, kills: 0, deaths: 0, maps: 0 });
        }
        const p = playerMap.get(id);
        p.kills += stats.kills || 0;
        p.deaths += stats.deaths || 0;
        p.maps += 1;
      });
    };

    if (activeSave.kickoffState?.series) {
      Object.values(activeSave.kickoffState.series).forEach(processMatch);
    }
    if (activeSave.regularSeasonMatches) {
      activeSave.regularSeasonMatches.forEach(processMatch);
    }

    const players = Array.from(playerMap.values())
      .map(p => ({
        ...p,
        kd: p.deaths > 0 ? p.kills / p.deaths : p.kills,
        score: (p.kills / p.maps) * (p.kills / (p.deaths || 1)) // Basic "performance score"
      }))
      .sort((a, b) => b.score - a.score);

    return {
      mvp: players[0] || null,
      evp: players[1] || null
    };
  }, [activeSave]);

  useEffect(() => {
    if (!activeSave || activeSection !== 'career-league') return;
    
    const items = [];
    
    // 1. Add latest inbox messages (top 5)
    if (activeSave.inbox && activeSave.inbox.length > 0) {
      activeSave.inbox
        .filter(m => m.subject.includes('League') || m.subject.includes('Report'))
        .slice(0, 5)
        .forEach(msg => {
          items.push({
            type: 'news',
            text: msg.subject,
            sender: msg.sender,
            body: msg.body,
            contentType: msg.contentType,
            week: msg.week || activeSave.week
          });
        });
    }
    
    // 2. Add roster changes from latest report
    const latestReport = activeSave.inbox?.find(m => m.subject.includes('Week') && m.subject.includes('Report'));
    if (latestReport && latestReport.body) {
        const lines = latestReport.body.split('\n');
        lines.forEach(line => {
            if (line.startsWith('- ')) {
                items.push({
                    type: 'roster',
                    text: line.substring(2),
                    week: latestReport.week || activeSave.week
                });
            }
        });
    }

    // 3. Add generic league news if items are low
    if (items.length < 3) {
        items.push({ type: 'news', text: 'VCT Season underway. All eyes on the trophy.', week: activeSave.week });
        items.push({ type: 'news', text: 'Scouts reporting high potential in recent free agent pool.', week: activeSave.week });
    }
    
    setLeagueTickerItems(items);
  }, [activeSave, activeSection]);

  // Get current team info
  const teamInfo = activeSave ? (teams.find(t => String(t.id) === String(activeSave.teamId)) || { power: 0, potential: 0 }) : { power: 0, potential: 0 };

  const myPlayers = activeSave?.players?.filter(p => {
    if (!p) return false;
    
    const normalize = (n) => String(n || '').toLowerCase().trim();
    const isInvalid = (v) => !v || v === 'null' || v === 'undefined';

    const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
    const activeTeamNameNorm = normalize(activeSave.team);
    
    const playerTeamId = p.teamId ? String(p.teamId) : null;
    const playerTeamNameNorm = normalize(p.team);

    const matchesId = !isInvalid(activeTeamId) && !isInvalid(playerTeamId) && playerTeamId === activeTeamId;
    const matchesName = !isInvalid(activeTeamNameNorm) && !isInvalid(playerTeamNameNorm) && playerTeamNameNorm === activeTeamNameNorm;
    
    return matchesId || matchesName;
  }) || [];

  // Calculate dynamic power and potential based on current roster
  const dynamicTeamStats = useMemo(() => {
    if (myPlayers.length === 0) return { power: teamInfo.power, potential: teamInfo.potential };

    // Sort players by rating to find the top 5 (starters)
    const sortedPlayers = [...myPlayers].sort((a, b) => (b.overall || 75) - (a.overall || 75));
    const starters = sortedPlayers.slice(0, 5);
    
    const avgPower = starters.reduce((sum, p) => sum + (p.overall || 75), 0) / starters.length;
    const avgPotential = starters.reduce((sum, p) => sum + (p.potential || 80), 0) / starters.length;

    return {
      power: Math.round(avgPower),
      potential: Math.round(avgPotential)
    };
  }, [myPlayers, teamInfo]);
  
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
    const handleCareerUpdate = (event) => {
      // Handle both CustomEvent (from direct dispatch) and MessageEvent (from postMessage)
      const data = event.detail || (event.data && event.data.type === 'careerUpdate' ? event.data.data : null);
      
      if (data) {
        console.log("CareerContent: careerUpdate event received", data);
        setActiveSave(data);
      }
    };

    window.addEventListener('careerUpdate', handleCareerUpdate);
    window.addEventListener('message', handleCareerUpdate);
    
    return () => {
      window.removeEventListener('careerUpdate', handleCareerUpdate);
      window.removeEventListener('message', handleCareerUpdate);
    };
  }, [setActiveSave]);

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

    // Send message to iframe to re-render brackets when activeSave changes
    if (activeSection === 'kickoff') {
      const iframe = document.getElementById('kickoff-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('rerenderKickoff', window.location.origin);
      }
    }
    
    if (activeSection === 'masters-bangkok') {
      const iframe = document.getElementById('masters-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('rerenderMasters', window.location.origin);
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
                Week {activeSave?.week || 1} / {activeSave?.week === 4 ? 'Kickoff' : activeSave?.week === 5 ? 'Break' : activeSave?.week >= 6 ? 'Masters Bangkok' : 'Pre-Season'} / Season {activeSave?.season || 1}
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
                      {selectedMessage.contentType === 'html' ? (
                        <div dangerouslySetInnerHTML={{ __html: selectedMessage.body }} />
                      ) : selectedMessage.body ? selectedMessage.body.split('\n').map((line, index) => (
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
                  <h3>League History</h3>
                  <div className="history-list">
                    {activeSave?.history?.length > 0 ? (
                      activeSave.history.slice().reverse().map((event, idx) => (
                        <div key={idx} className="history-item">
                          <span className="history-week">W{event.week}</span>
                          <span className="history-text">{event.text}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-history">No history recorded yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="dashboard-grid-bottom">
            <div id="championship-points" className="box">
              <h3>Championship Points</h3>
              <div className="points-list">
                {activeSave?.championshipPoints && Object.keys(activeSave.championshipPoints).length > 0 ? (
                  Object.entries(activeSave.championshipPoints)
                    .sort(([, a], [, b]) => b - a)
                    .map(([teamName, points]) => (
                      <div key={teamName} className="point-item">
                        <span className="point-team">{teamName}</span>
                        <span className="point-value">{points} pts</span>
                      </div>
                    ))
                ) : (
                  <div className="no-points">No points awarded yet.</div>
                )}
              </div>
            </div>

            <div id="masters-qualifications" className="box">
              <h3>Masters Bangkok Qualifications</h3>
              <div className="qual-list">
                {activeSave?.mastersQualifications && activeSave.mastersQualifications.length > 0 ? (
                  activeSave.mastersQualifications.map((teamName) => (
                    <div key={teamName} className="qual-item">
                      <span className="qual-team">{teamName}</span>
                      <span className="qual-status">Qualified</span>
                    </div>
                  ))
                ) : (
                  <div className="no-qual">No teams qualified yet.</div>
                )}
              </div>
            </div>
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
                Week {activeSave?.week || 1} / {activeSave?.week === 4 ? 'Kickoff' : activeSave?.week === 5 ? 'Break' : activeSave?.week >= 6 ? 'Masters Bangkok' : 'Pre-Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          
          <div className="team-management-dashboard">
            <div className="box performance-box horizontal">
              <div className="performance-stats-row">
                {activeSave ? (
                  <>
                    <div className="stat-card">
                      <div className="stat-title">Overall Power</div>
                      <div className="stat-value">{dynamicTeamStats.power}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Team Potential</div>
                      <div className="stat-value">{dynamicTeamStats.potential}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Region</div>
                      <div className="stat-value">{activeSave?.region || 'Unknown'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Budget</div>
                      <div className="stat-value budget-value">${(activeSave?.budget || 0).toLocaleString()}</div>
                    </div>
                  </>
                ) : (
                  <div className="performance-placeholder">Please start a career to view team performance</div>
                )}
              </div>
            </div>

            <div className="management-main-content">
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
          <div className="section-header">
            <h2>League</h2>
            <div className="section-tabs league-tabs">
                  <button 
                    className={`tab-btn ${activeLeagueTab === 'news' ? 'active' : ''}`}
                    onClick={() => setActiveLeagueTab('news')}
                  >
                    News
                  </button>
                  <button 
                    className={`tab-btn ${activeLeagueTab === 'awards' ? 'active' : ''}`}
                    onClick={() => setActiveLeagueTab('awards')}
                  >
                    Awards
                  </button>
              <button 
                className={`tab-btn ${activeLeagueTab === 'schedule' ? 'active' : ''}`}
                onClick={() => setActiveLeagueTab('schedule')}
              >
                Schedule
              </button>
              <button 
                className={`tab-btn ${activeLeagueTab === 'injuries' ? 'active' : ''}`}
                onClick={() => setActiveLeagueTab('injuries')}
              >
                Injuries
              </button>
              <button 
                className={`tab-btn ${activeLeagueTab === 'records' ? 'active' : ''}`}
                onClick={() => setActiveLeagueTab('records')}
              >
                Records
              </button>
              <button 
                className={`tab-btn ${activeLeagueTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveLeagueTab('history')}
              >
                History
              </button>
            </div>
          </div>

          <div className="league-content">
              {activeLeagueTab === 'news' && (
                <div className="tab-pane news-pane">
                  <div className="league-grid single-col">
                    <div className="box news-box">
                      <h3>League News Feed</h3>
                      <div className="news-feed">
                        {leagueTickerItems.length > 0 ? (
                          leagueTickerItems.map((item, idx) => (
                            <div key={idx} className={`feed-item ${item.type}`}>
                              <div className="feed-item-header">
                                <span className={`feed-item-type ${item.type}`}>{item.type.toUpperCase()}</span>
                                <span className="feed-item-date">Week {item.week}</span>
                              </div>
                              <h4>{item.sender ? `${item.sender}: ` : ''}{item.text}</h4>
                              {item.body && (
                                <div className="feed-item-content">
                                  {item.contentType === 'html' ? (
                                    <div 
                                      className="html-content-preview" 
                                      dangerouslySetInnerHTML={{ __html: item.body }} 
                                    />
                                  ) : (
                                    <p>{item.body?.substring(0, 200)}...</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="empty-feed">
                            <p className="no-data">No major league news at this time.</p>
                            <p className="hint-text">News updates will appear here as the season progresses.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeLeagueTab === 'awards' && (
              <div className="tab-pane awards-pane">
                <div className="league-grid single-col">
                  <div className="box awards-box">
                    <h3>Season Awards</h3>
                    <div className="awards-list">
                      <div className="award-item">
                        <div className="award-icon mvp">MVP</div>
                        <div className="award-info">
                          <h4>Most Valuable Player</h4>
                          <p className="award-winner">{leagueLeaders.mvp?.name || 'To be announced'}</p>
                          <p className="award-team">{leagueLeaders.mvp?.team || ''}</p>
                        </div>
                      </div>
                      <div className="award-item">
                        <div className="award-icon evp">EVP</div>
                        <div className="award-info">
                          <h4>Excellent Valuable Player</h4>
                          <p className="award-winner">{leagueLeaders.evp?.name || 'To be announced'}</p>
                          <p className="award-team">{leagueLeaders.evp?.team || ''}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeLeagueTab === 'schedule' && (
              <div className="tab-pane schedule-pane">
                <div className="league-grid">
                  <div className="box schedule-box">
                    <h3>Season Schedule</h3>
                    <div className="schedule-list">
                      {activeSave?.history?.filter(h => h.type === 'match' && h.week === activeSave.week).length > 0 ? (
                        activeSave.history
                          .filter(h => h.type === 'match' && h.week === activeSave.week)
                          .map((match, idx) => (
                            <div 
                              key={idx} 
                              className={`schedule-item clickable ${selectedMatchLogs?.id === (match.id || idx) ? 'active' : ''}`}
                              onClick={() => handleMatchClick(match)}
                            >
                              <span className="match-status">COMPLETED</span>
                              <span className="match-teams">{match.text}</span>
                              {(match.logs || match.details?.logs) && <span className="view-logs-hint">View Logs</span>}
                            </div>
                          ))
                      ) : (
                        <p className="no-data">No matches scheduled for the current week.</p>
                      )}
                      <div className="upcoming-matches">
                        <h4>Upcoming Matches</h4>
                        <p className="hint-text">Simulate week to see next results.</p>
                      </div>
                    </div>
                  </div>

                  <div className="box match-logs-box">
                    <h3>Match Analysis</h3>
                    {selectedMatchLogs ? (
                      <div className="logs-container">
                        <h4>{selectedMatchLogs.title}</h4>
                        <div className="logs-list">
                          {selectedMatchLogs.logs.map((mapLog, mIdx) => (
                            <div key={mIdx} className="map-log-section">
                              <h5 className="map-title">Map {mapLog.map + 1} ({mapLog.score})</h5>
                              {mapLog.events.map((event, eIdx) => (
                                <div key={eIdx} className={`log-event ${
                                  event.includes('pushing aggressively') || 
                                  event.includes('fast site hit') || 
                                  event.includes('bunkered down') || 
                                  event.includes('slow and methodical') ||
                                  event.includes('high-risk picks') ||
                                  event.includes('map info') ||
                                  event.includes('mid-round adjustments')
                                  ? 'strategy-event' : ''}`}>
                                  <span className="event-bullet">•</span>
                                  <span className="event-text">{event}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="no-logs-selected">
                        <p>Select a completed match to view strategy impact and round-by-round analysis.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeLeagueTab === 'injuries' && (
              <div className="tab-pane injuries-pane">
                <div className="league-grid single-col">
                  <div className="box injuries-box">
                    <h3>Medical Report</h3>
                    <div className="injuries-list">
                      {activeSave?.injuries && activeSave.injuries.length > 0 ? (
                        activeSave.injuries.map((injury, idx) => (
                          <div key={idx} className="injury-item">
                            <span className="injury-player">{injury.playerName}</span>
                            <span className="injury-type">{injury.type}</span>
                            <span className="injury-duration">{injury.duration} weeks left</span>
                          </div>
                        ))
                      ) : (
                        <p className="no-data">No active injuries in the league.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeLeagueTab === 'records' && (
              <div className="tab-pane records-pane">
                <div className="league-grid single-col">
                  <div className="box records-box">
                    <h3>League Records</h3>
                    <div className="records-grid">
                      <div className="record-card">
                        <span className="record-label">Most Kills (Match)</span>
                        <span className="record-value">{leagueRecords.maxKills.value}</span>
                        <span className="record-holder">{leagueRecords.maxKills.player}</span>
                        <span className="record-team">{leagueRecords.maxKills.team}</span>
                      </div>
                      <div className="record-card">
                        <span className="record-label">Highest ADR (Match)</span>
                        <span className="record-value">{leagueRecords.maxADR.value}</span>
                        <span className="record-holder">{leagueRecords.maxADR.player}</span>
                        <span className="record-team">{leagueRecords.maxADR.team}</span>
                      </div>
                      <div className="record-card">
                        <span className="record-label">Most Assists (Match)</span>
                        <span className="record-value">{leagueRecords.maxAssists.value}</span>
                        <span className="record-holder">{leagueRecords.maxAssists.player}</span>
                        <span className="record-team">{leagueRecords.maxAssists.team}</span>
                      </div>
                      <div className="record-card">
                        <span className="record-label">Most Headshots (Match)</span>
                        <span className="record-value">{leagueRecords.maxHS.value}</span>
                        <span className="record-holder">{leagueRecords.maxHS.player}</span>
                        <span className="record-team">{leagueRecords.maxHS.team}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeLeagueTab === 'history' && (
              <div className="tab-pane history-pane">
                <div className="league-grid single-col">
                  <div className="box history-box">
                    <h3>Hall of Fame / History</h3>
                    <div className="history-list">
                      {activeSave?.history && activeSave.history.length > 0 ? (
                        activeSave.history.slice().reverse().map((entry, idx) => (
                          <div key={idx} className="history-item">
                            <span className="history-week">W{entry.week}</span>
                            <span className="history-text">{entry.text}</span>
                          </div>
                        ))
                      ) : (
                        <p className="no-data">No league history found.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategies Section */}
      {activeSection === 'career-strategy' && (
        <div className="career-strategies content-section">
          <header className="section-header">
            <h2>Team Strategies</h2>
            <p>Define how your team plays during matches. These settings affect win probabilities and individual performance.</p>
          </header>

          <div className="strategies-grid">
            <div className="box strategy-box">
              <div className="strategy-header">
                <i className="strategy-icon">⚔️</i>
                <h3>General Playstyle</h3>
              </div>
              <p className="strategy-desc">Sets the overall tempo and risk level for your team.</p>
              <div className="strategy-options">
                {[
                  { id: 'balanced', label: 'Balanced', desc: 'No specific bonuses or penalties.' },
                  { id: 'aggressive', label: 'Aggressive', desc: '+5% Attack win chance, -5% Defense.' },
                  { id: 'defensive', label: 'Defensive', desc: '+5% Defense win chance, -5% Attack.' },
                  { id: 'tactical', label: 'Tactical', desc: 'Higher variance; rewards high Game Sense.' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    className={`strategy-btn ${teamStrategy.playstyle === opt.id ? 'active' : ''}`}
                    onClick={() => updateStrategy('playstyle', opt.id)}
                  >
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="box strategy-box">
              <div className="strategy-header">
                <i className="strategy-icon">🎯</i>
                <h3>Tactical Focus</h3>
              </div>
              <p className="strategy-desc">Determines which phase of the round your team prioritizes.</p>
              <div className="strategy-options">
                {[
                  { id: 'standard', label: 'Standard', desc: 'Default spread of focus.' },
                  { id: 'entry', label: 'Fast Entry', desc: 'Better at opening sites (+3% Atk).' },
                  { id: 'map-control', label: 'Map Control', desc: 'Better defensive info (+3% Def).' },
                  { id: 'tactical', label: 'Tactical Focus', desc: 'Higher variance matches.' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    className={`strategy-btn ${teamStrategy.focus === opt.id ? 'active' : ''}`}
                    onClick={() => updateStrategy('focus', opt.id)}
                  >
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="box strategy-box">
              <div className="strategy-header">
                <i className="strategy-icon">💰</i>
                <h3>Economic Policy</h3>
              </div>
              <p className="strategy-desc">Controls how aggressively your team spends credits.</p>
              <div className="strategy-options">
                {[
                  { id: 'standard', label: 'Standard', desc: 'Traditional buy/save cycles.' },
                  { id: 'stingy', label: 'Stingy', desc: 'Save more often to ensure full buys later.' },
                  { id: 'aggressive-buy', label: 'Aggressive Buy', desc: 'More frequent force buys and half-buys.' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    className={`strategy-btn ${teamStrategy.eco === opt.id ? 'active' : ''}`}
                    onClick={() => updateStrategy('eco', opt.id)}
                  >
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="box strategy-box">
              <div className="strategy-header">
                <i className="strategy-icon">🏃</i>
                <h3>Weekly Activity</h3>
              </div>
              <p className="strategy-desc">Choose what your team focuses on during the week.</p>
              <div className="strategy-options">
                {[
                  { id: 'standard', label: 'Standard Training', desc: 'Balanced improvement across all stats.' },
                  { id: 'scrim', label: 'Scrimmage', desc: 'Practice matches against other teams. High stat gains.' },
                  { id: 'practice', label: 'Individual Practice', desc: 'Focus on raw mechanics (Aim/Movement).' },
                  { id: 'bonding', label: 'Team Bonding', desc: 'Improves Teamwork and Mental stats.' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    className={`strategy-btn ${teamStrategy.activity === opt.id ? 'active' : ''}`}
                    onClick={() => updateStrategy('activity', opt.id)}
                  >
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'career-stats' && (
        <div id="career-stats" className="content-section">
          <StatsHub activeSave={activeSave} />
        </div>
      )}

      {activeSection === 'career-scripts' && (
        <div id="career-scripts" className="content-section">
          <ScriptsHub activeSave={activeSave} setActiveSave={setActiveSave} />
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

      {activeSection === 'masters-bangkok' && (
        <div id="masters-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <iframe 
            id="masters-iframe" 
            src="masters_bangkok.html" 
            style={{ 
              width: '100%', 
              height: '100%', 
              minHeight: '800px',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Masters Bangkok Bracket"
          ></iframe>
        </div>
      )}

      {/* Player Edit Modal - Essential for Manage Team section */}
      <div id="player-edit-modal" className="modal">
        <div className="modal-content">
          <span className="close-button">&times;</span>
          <h3>Edit Player Attributes</h3>
          <form id="player-edit-form">
            <input type="hidden" id="edit-player-id" />
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-player-name">Name:</label>
                <input type="text" id="edit-player-name" disabled />
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-gamertag">Gamertag:</label>
                <input type="text" id="edit-player-gamertag" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-player-role">Role:</label>
                <select id="edit-player-role">
                  <option value="Duelist">Duelist</option>
                  <option value="Initiator">Initiator</option>
                  <option value="Controller">Controller</option>
                  <option value="Sentinel">Sentinel</option>
                  <option value="Flex">Flex</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-nationality">Nationality:</label>
                <input type="text" id="edit-player-nationality" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-player-age">Age:</label>
                <input type="number" id="edit-player-age" min="16" max="30" />
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-salary">Salary ($):</label>
                <input type="number" id="edit-player-salary" min="0" step="1000" />
              </div>
            </div>
            
            <div className="edit-stats-grid">
              {[
                { id: 'aim', label: 'Aim' },
                { id: 'movement', label: 'Movement' },
                { id: 'gamesense', label: 'Game Sense' },
                { id: 'clutch', label: 'Clutch' },
                { id: 'aggression', label: 'Aggression' },
                { id: 'utility', label: 'Utility' },
                { id: 'mental', label: 'Mental' },
                { id: 'teamwork', label: 'Teamwork' },
                { id: 'consistency', label: 'Consistency' },
                { id: 'potential', label: 'Potential' }
              ].map(stat => (
                <div key={stat.id} className="edit-stat-item">
                  <label htmlFor={`edit-player-${stat.id}`}>{stat.label}:</label>
                  <input type="range" id={`edit-player-${stat.id}`} min="0" max="100" />
                  <span id={`edit-player-${stat.id}-value`}></span>
                </div>
              ))}
            </div>
            
            <button type="submit" className="btn-save">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CareerContent;