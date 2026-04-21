import React, { useState } from 'react';
import { saveCareer } from '../career_local_storage.jsx';
import { PlayerRating } from '../simulation.js';
import { generatePlayer } from '../players.js';

const ScriptsHub = ({ activeSave, setActiveSave }) => {
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const scripts = [
    {
      id: 'super-rookie',
      title: 'Super Rookie Generator',
      description: 'Generates 3 world-class free agents with 90+ potential.',
      icon: 'fa-star',
      color: '#ffcc00',
      action: () => {
        const newPlayers = Array.from({ length: 3 }, () => {
          const p = generatePlayer();
          p.rating = PlayerRating.generateRandom(80, 15);
          p.rating.potential = 90 + Math.floor(Math.random() * 10);
          p.teamId = null;
          p.team = null;
          return p;
        });

        const updatedSave = {
          ...activeSave,
          players: [...(activeSave.players || []), ...newPlayers]
        };
        setActiveSave(updatedSave);
        saveCareer(updatedSave);
        showNotification('3 Super Rookies have joined the Free Agent pool!', 'success');
      }
    },
    {
      id: 'team-chemistry',
      title: 'Team Chemistry Workshop',
      description: "Increases all your players' Teamwork and Mental stats by 5.",
      icon: 'fa-handshake',
      color: '#00ff9d',
      action: () => {
        const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
        const playerTeamName = activeSave.team ? String(activeSave.team) : null;

        const updatedPlayers = activeSave.players.map(p => {
          const pTeamId = p.teamId !== undefined && p.teamId !== null ? String(p.teamId) : null;
          const pTeamName = p.team !== undefined && p.team !== null ? String(p.team) : null;

          if ((playerTeamId && pTeamId === playerTeamId) || (playerTeamName && pTeamName === playerTeamName)) {
            if (p.rating) {
              const r = PlayerRating.fromJSON(p.rating);
              r.teamwork = Math.min(99, (r.teamwork || 50) + 5);
              r.mental = Math.min(99, (r.mental || 50) + 5);
              p.rating = r;
            }
          }
          return p;
        });

        const updatedSave = { ...activeSave, players: updatedPlayers };
        setActiveSave(updatedSave);
        saveCareer(updatedSave);
        showNotification('Team Chemistry boosted for all your players!', 'success');
      }
    },
    {
      id: 'economic-boost',
      title: 'New Sponsor Deal',
      description: 'Secure a major sponsorship deal. Gain $500,000 budget.',
      icon: 'fa-money-bill-trend-up',
      color: '#00f5ff',
      action: () => {
        const updatedSave = {
          ...activeSave,
          budget: (activeSave.budget || 0) + 500000
        };
        setActiveSave(updatedSave);
        saveCareer(updatedSave);
        showNotification('Sponsor deal signed! +$500,000 budget added.', 'success');
      }
    },
    {
        id: 'league-chaos',
        title: 'Roster Chaos',
        description: 'Randomly swaps 3 players between non-user teams.',
        icon: 'fa-shuffle',
        color: '#ff4655',
        action: () => {
            const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
            const playerTeamName = activeSave.team ? String(activeSave.team) : null;

            // Get players from other teams
            const otherPlayers = activeSave.players.filter(p => {
                const pTeamId = p.teamId !== undefined && p.teamId !== null ? String(p.teamId) : null;
                const pTeamName = p.team !== undefined && p.team !== null ? String(p.team) : null;
                const isUserTeam = (playerTeamId && pTeamId === playerTeamId) || (playerTeamName && pTeamName === playerTeamName);
                return !isUserTeam && (pTeamId || pTeamName);
            });

            if (otherPlayers.length < 6) {
                showNotification('Not enough players in other teams for chaos.', 'error');
                return;
            }

            // Shuffle and pick 3 pairs
            const shuffled = [...otherPlayers].sort(() => 0.5 - Math.random());
            const updatedPlayers = [...activeSave.players];

            for (let i = 0; i < 3; i++) {
                const p1 = shuffled[i*2];
                const p2 = shuffled[i*2 + 1];

                // Find indices in updatedPlayers
                const idx1 = updatedPlayers.findIndex(p => p.id === p1.id);
                const idx2 = updatedPlayers.findIndex(p => p.id === p2.id);

                if (idx1 !== -1 && idx2 !== -1) {
                    // Swap team data
                    const tempTeamId = updatedPlayers[idx1].teamId;
                    const tempTeamName = updatedPlayers[idx1].team;

                    updatedPlayers[idx1].teamId = updatedPlayers[idx2].teamId;
                    updatedPlayers[idx1].team = updatedPlayers[idx2].team;

                    updatedPlayers[idx2].teamId = tempTeamId;
                    updatedPlayers[idx2].team = tempTeamName;
                }
            }

            const updatedSave = { ...activeSave, players: updatedPlayers };
            setActiveSave(updatedSave);
            saveCareer(updatedSave);
            showNotification('Roster Chaos! 3 trades occurred in the league.', 'info');
        }
    },
    {
        id: 'global-shuffle',
        title: 'League Super-Shuffle',
        description: 'Randomly reassigns every player in the league to a new team (except yours).',
        icon: 'fa-earth-americas',
        color: '#a855f7',
        action: () => {
            const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
            const playerTeamName = activeSave.team ? String(activeSave.team) : null;

            // Find indices of players to shuffle
            const otherPlayerIndices = [];
            const teamAssignments = [];

            activeSave.players.forEach((p, idx) => {
                const pTeamId = p.teamId !== undefined && p.teamId !== null ? String(p.teamId) : null;
                const pTeamName = p.team !== undefined && p.team !== null ? String(p.team) : null;
                const isUserTeam = (playerTeamId && pTeamId === playerTeamId) || (playerTeamName && pTeamName === playerTeamName);
                
                if (!isUserTeam && (pTeamId || pTeamName)) {
                    otherPlayerIndices.push(idx);
                    teamAssignments.push({ teamId: p.teamId, team: p.team });
                }
            });

            if (otherPlayerIndices.length === 0) {
                showNotification('No other teams found to shuffle.', 'error');
                return;
            }

            // Shuffle assignments
            for (let i = teamAssignments.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [teamAssignments[i], teamAssignments[j]] = [teamAssignments[j], teamAssignments[i]];
            }

            // Apply shuffled assignments to a new players array
            const updatedPlayers = [...activeSave.players];
            otherPlayerIndices.forEach((playerIdx, i) => {
                updatedPlayers[playerIdx] = {
                    ...updatedPlayers[playerIdx],
                    teamId: teamAssignments[i].teamId,
                    team: teamAssignments[i].team
                };
            });

            const updatedSave = { ...activeSave, players: updatedPlayers };
            setActiveSave(updatedSave);
            saveCareer(updatedSave);
            showNotification('League-wide roster shuffle complete!', 'success');
        }
    },
    {
        id: 'attribute-editor',
        title: 'Advanced Attribute Editor',
        description: 'Enable the ability to manually edit any player\'s attributes in the league.',
        icon: 'fa-pen-to-square',
        color: '#ff4655',
        type: 'toggle',
        action: () => {
            const isEnabled = activeSave.scripts?.['attribute-editor'];
            const updatedSave = {
                ...activeSave,
                scripts: {
                    ...(activeSave.scripts || {}),
                    'attribute-editor': !isEnabled
                }
            };
            setActiveSave(updatedSave);
            saveCareer(updatedSave);
            showNotification(`Advanced Attribute Editor ${!isEnabled ? 'Enabled' : 'Disabled'}!`, 'info');
        }
    }
  ];

  return (
    <div className="scripts-hub">
      <div className="hub-header">
        <div className="header-info">
          <h2>Career Scripts & Cheats</h2>
          <p>Modify your career save with powerful league-wide scripts.</p>
        </div>
        {notification && (
          <div className={`hub-notification ${notification.type}`}>
            <i className={`fa-solid ${notification.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
            {notification.message}
          </div>
        )}
      </div>

      <div className="scripts-grid">
        {scripts.map(script => (
          <div key={script.id} className="script-card" style={{ borderColor: `${script.color}40` }}>
            <div className="script-icon" style={{ backgroundColor: `${script.color}20`, color: script.color }}>
              <i className={`fa-solid ${script.icon}`}></i>
            </div>
            <div className="script-info">
              <h3>{script.title}</h3>
              <p>{script.description}</p>
            </div>
            <div className="script-actions">
              <button 
                className={`execute-button ${script.type === 'toggle' ? (activeSave.scripts?.[script.id] ? 'active' : '') : ''}`}
                onClick={script.action}
                style={script.type === 'toggle' && activeSave.scripts?.[script.id] ? { backgroundColor: script.color, color: '#000' } : {}}
              >
                {script.type === 'toggle' ? (
                  activeSave.scripts?.[script.id] ? (
                    <><i className="fa-solid fa-toggle-on"></i> Enabled</>
                  ) : (
                    <><i className="fa-solid fa-toggle-off"></i> Disabled</>
                  )
                ) : (
                  <><i className="fa-solid fa-bolt"></i> Execute</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScriptsHub;
