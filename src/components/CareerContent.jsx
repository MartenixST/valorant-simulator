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
import PlayerEditModal from './PlayerEditModal.jsx';

const CareerContent = ({ activeSection, activeSave, setActiveSave }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [activeLeagueTab, setActiveLeagueTab] = useState('news');
  const [leagueTickerItems, setLeagueTickerItems] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('All');

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
      const playerStats = match.playerStats || match.details?.playerStats;

      // Even if no logs/stats, show the modal if the match was played
      // This allows showing a "No stats available" message instead of nothing
      setSelectedMatchLogs({ 
        id: match.id || Math.random(), 
        logs: logs || [],
        playerStats: playerStats, 
        title: match.text || "Match Details"
      });
    }
  };

  const [calendarCategory, setCalendarCategory] = useState('my-matches');

  const calendarMatches = useMemo(() => {
      if (!activeSave) return [];
      const matches = [];
      
      // Helper to add match if unique
      const addMatch = (m) => {
          if (!matches.some(existing => existing.id === m.id)) {
              matches.push(m);
          }
      };
  
      // 1. Kickoff Matches
      if (activeSave.kickoffResults) {
          Object.entries(activeSave.kickoffResults).forEach(([region, state]) => {
              if (state.series) {
                  Object.values(state.series).forEach(s => {
                      addMatch({
                          id: s.id || `k-${region}-${s.team1Name}-${s.team2Name}`,
                          week: 4,
                          tournament: 'Kickoff',
                          stage: region,
                          team1: s.team1Name || s.team1,
                          team2: s.team2Name || s.team2,
                          score: s.score,
                          winner: s.winner,
                          played: !!s.winner,
                          logs: s.logs, // if available
                          playerStats: s.playerStats
                      });
                  });
              }
          });
      }
  
      // 2. Masters Matches
    if (activeSave.mastersState) {
        // Swiss
        if (activeSave.mastersState.swiss?.matches) {
            Object.values(activeSave.mastersState.swiss.matches).forEach(m => {
                 addMatch({
                    id: m.id,
                    week: 7, // Swiss stage usually starts week 7
                    tournament: 'Masters Bangkok',
                    stage: 'Swiss Stage',
                    team1: m.team1,
                    team2: m.team2,
                    score: m.score,
                    winner: m.winner,
                    played: !!m.winner,
                    logs: m.logs,
                    playerStats: m.playerStats
                });
            });
        }
        // Playoffs
        if (activeSave.mastersState.playoffs?.matches) {
            Object.values(activeSave.mastersState.playoffs.matches).forEach(m => {
                 addMatch({
                    id: m.id,
                    week: 11, // Playoffs usually week 11
                    tournament: 'Masters Bangkok',
                    stage: 'Playoffs',
                    team1: m.team1,
                    team2: m.team2,
                    score: m.score,
                    winner: m.winner,
                    played: !!m.winner,
                    logs: m.logs,
                    playerStats: m.playerStats
                });
            });
        }
    }
  
      // 3. Regular Season (History + Schedule)
      if (activeSave.regularSeason) {
          // Matches (History)
          if (activeSave.regularSeason.matches) {
              activeSave.regularSeason.matches.forEach(m => {
                  addMatch({
                      id: m.id,
                      week: m.week,
                      tournament: 'Regular Season',
                      stage: 'Group Stage',
                      team1: m.t1Name,
                      team2: m.t2Name,
                      score: m.score,
                      winner: m.winner,
                      played: true,
                    logs: m.logs,
                    playerStats: m.playerStats
                });
              });
          }
          // Schedule (Future)
          if (activeSave.regularSeason.schedule) {
              Object.entries(activeSave.regularSeason.schedule).forEach(([weekStr, weekMatches]) => {
                  const week = parseInt(weekStr);
                   weekMatches.forEach(m => {
                      if (!m.played) {
                           const t1 = teams.find(t => t.id === m.team1Id);
                           const t2 = teams.find(t => t.id === m.team2Id);
                           if (t1 && t2) {
                               addMatch({
                                   id: m.matchId || `rs-${week}-${m.team1Id}`,
                                   week: week,
                                   tournament: 'Regular Season',
                                   stage: 'Group Stage',
                                   team1: t1.name,
                                   team2: t2.name,
                                   score: '- -',
                                   winner: null,
                                   played: false
                               });
                           }
                      }
                  });
              });
          }
      }
  
      return matches.sort((a, b) => b.week - a.week);
  }, [activeSave]);
  
  const displayedCalendarMatches = useMemo(() => {
      let matches = calendarMatches;

      if (calendarCategory === 'my-matches') {
          matches = matches.filter(m => m.team1 === activeSave?.team || m.team2 === activeSave?.team);
      } else if (calendarCategory === 'all-matches') {
          if (selectedRegion !== 'All') {
             matches = matches.filter(m => {
                 const t1 = teams.find(t => t.name === m.team1);
                 const t2 = teams.find(t => t.name === m.team2);
                 return (t1 && t1.region === selectedRegion) || (t2 && t2.region === selectedRegion);
             });
          }
      }
      return matches;
  }, [calendarMatches, calendarCategory, activeSave?.team, selectedRegion]);

  const groupedCalendarMatches = useMemo(() => {
    const groups = [];
    const groupMap = {}; // Key -> Group object

    displayedCalendarMatches.forEach(match => {
        const tournament = match.tournament || 'Regular Season';
        const stage = match.stage || 'Group Stage';
        const key = `${tournament}::${stage}`;

        if (!groupMap[key]) {
            const newGroup = {
                key,
                tournament,
                stage,
                matches: []
            };
            groups.push(newGroup);
            groupMap[key] = newGroup;
        }
        groupMap[key].matches.push(match);
    });
    
    return groups;
  }, [displayedCalendarMatches]);

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
  
  // Determine upcoming match for My Office
  const upcomingMatch = useMemo(() => {
    if (!activeSave) return null;
    const teamId = String(activeSave.teamId);
    const teamName = activeSave.team;
    
    // 1. Regular Season
    if (activeSave.week >= 12 && activeSave.regularSeason?.schedule) {
       const weekMatches = activeSave.regularSeason.schedule[activeSave.week] || [];
       const match = weekMatches.find(m => String(m.team1Id) === teamId || String(m.team2Id) === teamId);
       if (match && !match.played) {
           const opponentId = String(match.team1Id) === teamId ? match.team2Id : match.team1Id;
           const opponent = teams.find(t => String(t.id) === String(opponentId));
           return {
               tournament: 'Regular Season',
               opponent: opponent || { name: 'Unknown', id: opponentId },
               stage: `Week ${activeSave.week}`
           };
       }
    }
    
    // 2. Masters Bangkok
    if (activeSave.mastersState && !activeSave.mastersState.complete) {
        // Search Swiss
        if (activeSave.mastersState.swiss?.matches) {
             const match = Object.values(activeSave.mastersState.swiss.matches).find(m => 
                !m.winner && (m.team1 === teamName || m.team2 === teamName)
             );
             if (match) {
                 const oppName = match.team1 === teamName ? match.team2 : match.team1;
                 const opponent = teams.find(t => t.name === oppName);
                 return {
                     tournament: 'Masters Bangkok',
                     opponent: opponent || { name: oppName },
                     stage: 'Swiss Stage'
                 };
             }
        }
        // Search Playoffs
        if (activeSave.mastersState.playoffs?.matches) {
             const match = Object.values(activeSave.mastersState.playoffs.matches).find(m => 
                !m.winner && (m.team1 === teamName || m.team2 === teamName)
             );
             if (match) {
                 const oppName = match.team1 === teamName ? match.team2 : match.team1;
                 const opponent = teams.find(t => t.name === oppName);
                 return {
                     tournament: 'Masters Bangkok',
                     opponent: opponent || { name: oppName },
                     stage: 'Playoffs'
                 };
             }
        }
    }
    
    // 3. Kickoff (Week 4)
    if (activeSave.week === 4 && activeSave.kickoffState) {
        // Kickoff structure is usually in 'series'
        if (activeSave.kickoffState.series) {
            const match = Object.values(activeSave.kickoffState.series).find(m => 
                !m.winner && (m.team1 === teamName || m.team2 === teamName)
            );
            if (match) {
                 const oppName = match.team1 === teamName ? match.team2 : match.team1;
                 const opponent = teams.find(t => t.name === oppName);
                 return {
                     tournament: 'Kickoff',
                     opponent: opponent || { name: oppName },
                     stage: 'Tournament'
                 };
            }
        }
    }

    return null;
  }, [activeSave]);

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

    if (activeSection === 'regular-season') {
      const iframe = document.getElementById('regular-season-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('rerenderRegularSeason', window.location.origin);
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
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : 'Regular Season'} / Season {activeSave?.season || 1}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
                
                {/* DEBUG / TIME TRAVEL BUTTON - ADDED FOR USER REQUEST */}
                <button 
                  style={{
                    fontSize: '10px', 
                    padding: '2px 5px', 
                    background: '#333', 
                    color: '#888', 
                    border: '1px solid #555',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (window.confirm("Are you sure you want to travel back to Week 6? This will reset Masters progress.")) {
                      const updatedSave = { ...activeSave };
                      updatedSave.week = 6;
                      
                      // Reset Masters state so it can be regenerated fresh
                      if (updatedSave.mastersState) {
                          updatedSave.mastersState = null;
                      }
                      
                      setActiveSave(updatedSave);
                      saveCareer(updatedSave);
                      window.location.reload(); // Reload to ensure all states refresh correctly
                    }
                  }}
                >
                  Reset to Week 6
                </button>
              </div>

            </div>
          </div>
          <div className="office-layout-wrapper">
            <div className="office-layout">
              <div className="office-left">
                {activeSave && <div className="inbox-container"><Inbox inbox={activeSave.inbox} onMessageClick={handleMessageClick} selectedMessage={selectedMessage} /></div>}
              </div>
              <div className="office-center">
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
              </div>
              <div className="office-right">
                <div className="box" id="week-matches">
                  <h3>Week {activeSave?.week} Matchup</h3>
                  {upcomingMatch ? (
                      <div className="upcoming-match-display">
                          <div className="match-context">
                              <span className="tournament-name">{upcomingMatch.tournament}</span>
                              {upcomingMatch.stage && !upcomingMatch.stage.includes('Week') && (
                                <span className="match-stage">{upcomingMatch.stage}</span>
                              )}
                          </div>
                          <div className="match-teams">
                              <div className="match-team">
                                <div className="team-logo-small">
                                  <img src={teamLogos[activeSave.team]} alt={activeSave.team} onError={(e) => e.target.src='assets/qmark.png'} />
                                </div>
                                <span className="team-name">{activeSave.team.substring(0, 3).toUpperCase()}</span>
                            </div>
                            <div className="match-vs">VS</div>
                            <div className="match-team">
                                {upcomingMatch.opponent && (
                                    <>
                                    <div className="team-logo-small">
                                      <img 
                                          src={`assets/team_logos/${upcomingMatch.opponent.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_')}.png`} 
                                          alt={upcomingMatch.opponent.name}
                                          onError={(e) => e.target.src='assets/qmark.png'}
                                      />
                                    </div>
                                    <span className="team-name">{upcomingMatch.opponent.name.substring(0, 3).toUpperCase()}</span>
                                    </>
                                )}
                            </div>
                          </div>
                          <div className="match-info-footer">
                              Prepare your strategy in the Team Hub!
                          </div>
                      </div>
                  ) : (
                      <div className="no-matches">No pending matches for this week.</div>
                  )}
                </div>
                <div className="box" id="career-history">
                  <h3>Career History</h3>
                  <div className="history-list">
                    {activeSave?.seasonResults && activeSave.seasonResults.length > 0 ? (
                      activeSave.seasonResults.slice().reverse().map((season, idx) => (
                        <div key={idx} className="history-item">
                          <span className="history-week">S{season.year}</span>
                          <span className="history-text">{season.result}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-history">
                          <div className="current-season-indicator">Season {activeSave?.season || 1} (Current)</div>
                          <div className="history-placeholder">Complete a season to see results here.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div id="championship-points" className="box full-width-bottom">
              <h3>Championship Points</h3>
              <div className="points-list horizontal-scroll">
                {activeSave?.championshipPoints && Object.keys(activeSave.championshipPoints).length > 0 ? (
                  Object.entries(activeSave.championshipPoints)
                    .filter(([teamName]) => {
                      // Only show teams from the player's region
                      const team = teams.find(t => t.name === teamName);
                      return team && team.region === teamInfo.region;
                    })
                    .sort(([, a], [, b]) => b - a)
                    .map(([teamName, points]) => (
                      <div key={teamName} className="point-item vertical-card">
                        <span className="point-team">{teamName}</span>
                        <span className="point-value">{points} pts</span>
                      </div>
                    ))
                ) : (
                  <div className="no-points">No points awarded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'career-calendar' && (
        <div id="career-calendar" className="content-section">
          <div className="section-header">
            <h2>Calendar</h2>
            <div className="calendar-controls" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div className="section-tabs league-tabs">
                    <button 
                      className={`tab-btn ${calendarCategory === 'my-matches' ? 'active' : ''}`}
                      onClick={() => setCalendarCategory('my-matches')}
                    >
                      My Matches
                    </button>
                    <button 
                      className={`tab-btn ${calendarCategory === 'all-matches' ? 'active' : ''}`}
                      onClick={() => setCalendarCategory('all-matches')}
                    >
                      All Matches
                    </button>
                </div>
                {calendarCategory === 'all-matches' && (
                  <select 
                    className="region-select"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="All" style={{ background: '#1c2734' }}>All Regions</option>
                    <option value="Americas" style={{ background: '#1c2734' }}>Americas</option>
                    <option value="EMEA" style={{ background: '#1c2734' }}>EMEA</option>
                    <option value="Pacific" style={{ background: '#1c2734' }}>Pacific</option>
                    <option value="China" style={{ background: '#1c2734' }}>China</option>
                  </select>
                )}
            </div>
          </div>
          <div className="calendar-container">
            {groupedCalendarMatches.length > 0 ? (
                <div className="schedule-wrapper grid-container">
                    {groupedCalendarMatches.map((group) => (
                        <div key={group.key} className="tournament-section">
                            <h3 className="tournament-header">
                                {group.tournament} <span className="stage-name">// {group.stage}</span>
                            </h3>
                            <div className="schedule-list wrapped-grid">
                                {group.matches.map((match, idx) => {
                                    const scores = match.played && match.score ? match.score.split('-') : ['-', '-'];
                                    const t1Score = scores[0];
                                    const t2Score = scores[1];
                                    
                                    return (
                                        <div key={match.id || idx} className={`schedule-item ${match.played ? 'completed' : 'upcoming'} ${match.played ? 'clickable' : ''}`} onClick={() => match.played && handleMatchClick({...match, text: `${match.team1} vs ${match.team2}`})}>
                                            {/* Team 1 Row */}
                                            <div className={`match-team-row ${match.winner === match.team1 ? 'winner' : ''}`}>
                                                <div className="team-info">
                                                    <img 
                                                        src={teamLogos[match.team1] || `assets/team_logos/${match.team1.toLowerCase().replace(/ /g, '_')}.png`} 
                                                        alt={match.team1} 
                                                        className="team-logo-mini"
                                                        onError={(e) => e.target.src='assets/qmark.png'}
                                                    />
                                                    <span className="team-name">{match.team1}</span>
                                                </div>
                                                <span className="team-score">{t1Score}</span>
                                            </div>

                                            {/* Middle Info Row */}
                                            <div className="match-center-info">
                                                <span className="match-week">Week #{match.week}</span>
                                                {match.played && (
                                                    <div className="match-stats-btn">
                                                        <span className="stats-icon">📄</span> Match Stats
                                                    </div>
                                                )}
                                                {!match.played && (
                                                    <span className="match-vs-badge">VS</span>
                                                )}
                                            </div>

                                            {/* Team 2 Row */}
                                            <div className={`match-team-row ${match.winner === match.team2 ? 'winner' : ''}`}>
                                                <div className="team-info">
                                                    <img 
                                                        src={teamLogos[match.team2] || `assets/team_logos/${match.team2.toLowerCase().replace(/ /g, '_')}.png`} 
                                                        alt={match.team2} 
                                                        className="team-logo-mini"
                                                        onError={(e) => e.target.src='assets/qmark.png'}
                                                    />
                                                    <span className="team-name">{match.team2}</span>
                                                </div>
                                                <span className="team-score">{t2Score}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-data" style={{padding: '40px', textAlign: 'center', color: '#8b9bb4'}}>
                    <p>No matches found for this category.</p>
                </div>
            )}
          </div>
          
          {selectedMatchLogs && (
            <div className="modal" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={(e) => {
                if(e.target.className === 'modal') setSelectedMatchLogs(null);
            }}>
                <div className="modal-content" style={{maxHeight: '80vh', overflowY: 'auto'}}>
                    <span className="close-button" onClick={() => setSelectedMatchLogs(null)}>&times;</span>
                    <div className="box match-logs-box" style={{border: 'none', background: 'transparent', padding: 0, boxShadow: 'none'}}>
                        <h3>Match Analysis</h3>
                        <div className="logs-container">
                            <h4>{selectedMatchLogs.title}</h4>
                            {selectedMatchLogs.playerStats && (
                                <div className="match-scoreboard" style={{marginBottom: '20px'}}>
                                    <h5 style={{color: '#00f6ff', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '10px'}}>Player Statistics</h5>
                                    {(() => {
                                        const stats = Object.values(selectedMatchLogs.playerStats);
                                        // Get unique team names, filtering out any undefined/null
                                        const teams = [...new Set(stats.map(s => s.teamName).filter(Boolean))];
                                        
                                        // If no team names found (legacy data), fall back to single table
                                        if (teams.length === 0) {
                                            return (
                                                <table className="stats-table" style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                                                    <thead>
                                                        <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left'}}>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>Player</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>Team</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>K</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>D</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>A</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>KD</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stats.sort((a,b) => (b.kills || 0) - (a.kills || 0)).map((stat, sIdx) => (
                                                            <tr key={sIdx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                                                <td style={{padding: '8px', color: 'white'}}>{stat.name}</td>
                                                                <td style={{padding: '8px', color: 'rgba(255,255,255,0.7)'}}>{stat.teamName}</td>
                                                                <td style={{padding: '8px', color: '#00f6ff'}}>{stat.kills}</td>
                                                                <td style={{padding: '8px', color: '#ff4655'}}>{stat.deaths}</td>
                                                                <td style={{padding: '8px', color: 'white'}}>{stat.assists}</td>
                                                                <td style={{padding: '8px', color: (stat.kills / (stat.deaths || 1)) >= 1 ? '#00f6ff' : '#ff4655'}}>
                                                                    {(stat.kills / (stat.deaths || 1)).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            );
                                        }

                                        return teams.map(teamName => (
                                            <div key={teamName} style={{marginBottom: '20px'}}>
                                                <h6 style={{color: 'rgba(255,255,255,0.8)', margin: '0 0 10px 0', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px'}}>{teamName}</h6>
                                                <table className="stats-table" style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                                                    <thead>
                                                        <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left'}}>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>Player</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>K</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>D</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>A</th>
                                                            <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>KD</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stats
                                                            .filter(s => s.teamName === teamName)
                                                            .sort((a,b) => (b.kills || 0) - (a.kills || 0))
                                                            .map((stat, sIdx) => (
                                                            <tr key={sIdx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                                                <td style={{padding: '8px', color: 'white'}}>{stat.name}</td>
                                                                <td style={{padding: '8px', color: '#00f6ff'}}>{stat.kills}</td>
                                                                <td style={{padding: '8px', color: '#ff4655'}}>{stat.deaths}</td>
                                                                <td style={{padding: '8px', color: 'white'}}>{stat.assists}</td>
                                                                <td style={{padding: '8px', color: (stat.kills / (stat.deaths || 1)) >= 1 ? '#00f6ff' : '#ff4655'}}>
                                                                    {(stat.kills / (stat.deaths || 1)).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                            <div className="logs-list">
                                {selectedMatchLogs.logs && selectedMatchLogs.logs.length > 0 ? (
                                    selectedMatchLogs.logs.map((mapLog, mIdx) => (
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
                                    ))
                                ) : (
                                    !selectedMatchLogs.playerStats && (
                                        <div style={{padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic'}}>
                                            <p>No detailed statistics or logs available for this match.</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
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
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : 'Regular Season'} / Season {activeSave?.season || 1}
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
                            {selectedMatchLogs.playerStats && (
                                <div className="match-scoreboard" style={{marginBottom: '20px'}}>
                                    <h5 style={{color: '#00f6ff', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '10px'}}>Player Statistics</h5>
                                    <table className="stats-table" style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                                        <thead>
                                            <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left'}}>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>Player</th>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>Team</th>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>K</th>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>D</th>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>A</th>
                                                <th style={{padding: '8px', color: 'rgba(255,255,255,0.5)'}}>KD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.values(selectedMatchLogs.playerStats)
                                                .sort((a,b) => (b.kills || 0) - (a.kills || 0))
                                                .map((stat, sIdx) => (
                                                <tr key={sIdx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                                    <td style={{padding: '8px', color: 'white'}}>{stat.name}</td>
                                                    <td style={{padding: '8px', color: 'rgba(255,255,255,0.7)'}}>{stat.teamName}</td>
                                                    <td style={{padding: '8px', color: '#00f6ff'}}>{stat.kills}</td>
                                                    <td style={{padding: '8px', color: '#ff4655'}}>{stat.deaths}</td>
                                                    <td style={{padding: '8px', color: 'white'}}>{stat.assists}</td>
                                                    <td style={{padding: '8px', color: (stat.kills / (stat.deaths || 1)) >= 1 ? '#00f6ff' : '#ff4655'}}>
                                                        {(stat.kills / (stat.deaths || 1)).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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
          <iframe id="standings-iframe" src="standings.html?embed=1" style={{ width: '100%', height: '800px', border: 'none' }} title="VCT Standings"></iframe>
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
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Kickoff Tournament</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : 'Regular Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <iframe 
            key={activeSave?.week || 'kickoff-default'}
            id="kickoff-iframe" 
            src="kickoff.html" 
            style={{ 
              width: '100%', 
              flex: 1,
              minHeight: '0',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Kickoff Bracket"
          ></iframe>
        </div>
      )}

      {activeSection === 'masters-bangkok' && (
        <div id="masters-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Masters Bangkok</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : 'Regular Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <iframe 
            key={activeSave?.week || 'masters-default'}
            id="masters-iframe" 
            src="masters_bangkok.html" 
            style={{ 
              width: '100%', 
              flex: 1,
              minHeight: '0',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Masters Bangkok Bracket"
          ></iframe>
        </div>
      )}

      {activeSection === 'regular-season' && (
        <div id="regular-season-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Regular Season</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : 'Regular Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <iframe 
            key={activeSave?.week || 'regular-season-default'}
            id="regular-season-iframe" 
            src="regular_season.html" 
            style={{ 
              width: '100%', 
              flex: 1,
              minHeight: '0',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Regular Season"
          ></iframe>
        </div>
      )}

      <PlayerEditModal />
    </div>
  );
};

export default CareerContent;
