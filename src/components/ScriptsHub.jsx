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
        id: 'training-camp',
        title: 'Intensive Training Camp',
        description: 'Boost all your players\' Aim and Movement by 3.',
        icon: 'fa-dumbbell',
        color: '#ff8c00',
        action: () => {
          const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
          const playerTeamName = activeSave.team ? String(activeSave.team) : null;
  
          const updatedPlayers = activeSave.players.map(p => {
            const pTeamId = p.teamId !== undefined && p.teamId !== null ? String(p.teamId) : null;
            const pTeamName = p.team !== undefined && p.team !== null ? String(p.team) : null;
  
            if ((playerTeamId && pTeamId === playerTeamId) || (playerTeamName && pTeamName === playerTeamName)) {
              if (p.rating) {
                const r = PlayerRating.fromJSON(p.rating);
                r.aim = Math.min(99, (r.aim || 50) + 3);
                r.movement = Math.min(99, (r.movement || 50) + 3);
                p.rating = r;
              }
            }
            return p;
          });
  
          const updatedSave = { ...activeSave, players: updatedPlayers };
          setActiveSave(updatedSave);
          saveCareer(updatedSave);
          showNotification('Training camp finished! Your players look sharper.', 'success');
        }
    }
  ];

  return (
    <div className="scripts-hub">
      <div className="scripts-header">
        <h2>Game Scripts & Scenarios</h2>
        <p>Trigger unique events to influence your career simulation and test different scenarios.</p>
      </div>

      {notification && (
        <div className={`script-notification ${notification.type} animated fadeInDown`}>
          <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}`}></i>
          {notification.message}
        </div>
      )}

      <div className="scripts-grid">
        {scripts.map(script => (
          <div key={script.id} className="script-card">
            <div className="script-icon" style={{ color: script.color, borderColor: script.color + '44' }}>
              <i className={`fa-solid ${script.icon}`}></i>
            </div>
            <div className="script-info">
              <h4>{script.title}</h4>
              <p>{script.description}</p>
              <button 
                className="execute-button"
                onClick={script.action}
              >
                <i className="fa-solid fa-bolt"></i> Execute
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScriptsHub;
