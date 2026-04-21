import React, { useState, useEffect } from 'react';
import { teams, teamLogos } from '../teams.js';
import { ROLES, Player, PlayerRating } from '../simulation.js';
import { generatePlayer, nationalities } from '../players.js';
import { saveCareer } from '../career_local_storage.jsx';
import { hireFreeAgentForTeam } from '../ai_manager.js';
import { getFlagUrl } from '../utils/countryCodes.js';

const PlayersHub = ({ activeSave, setActiveSave }) => {
    const [freeAgents, setFreeAgents] = useState([]);
    const [otherPlayers, setOtherPlayers] = useState([]);
    const [selectedNationality, setSelectedNationality] = useState('All');
    const [selectedVctRegion, setSelectedVctRegion] = useState('All');
    const [selectedRole, setSelectedRole] = useState('All');
    const [showCreateForm, setShowCreateForm] = useState(false);
    
    const [newPlayer, setNewPlayer] = useState({
        name: '',
        role: 'Duelist',
        nationality: 'USA',
        age: 18,
        region: 'Americas'
    });

    const [searchTerm, setSearchTerm] = useState('');
    
    // Calculate total team salary
    const teamSalary = activeSave?.players?.reduce((acc, p) => {
        const pTeamId = p.teamId !== undefined && p.teamId !== null ? String(p.teamId) : null;
        const pTeamName = p.team !== undefined && p.team !== null ? String(p.team) : null;
        const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
        const playerTeamName = activeSave.team ? String(activeSave.team) : null;
        
        const isInvalid = (v) => !v || v === 'null' || v === 'undefined';
        const normalize = (n) => String(n || '').toLowerCase().trim();

        // Match by ID/Name/Gamertag for your team to avoid duplicates in budget calculation
        const isUserTeam = (!isInvalid(playerTeamId) && !isInvalid(pTeamId) && pTeamId === playerTeamId) || 
                          (!isInvalid(playerTeamName) && !isInvalid(pTeamName) && normalize(pTeamName) === normalize(playerTeamName));
        
        if (isUserTeam) {
            return acc + (p.marketValue || 50000);
        }
        return acc;
    }, 0) || 0;

    const remainingBudget = (activeSave?.budget || 0) - teamSalary;
    
    // Contract Offer State
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [selectedPlayerForOffer, setSelectedPlayerForOffer] = useState(null);
    const [offerSalary, setOfferSalary] = useState(50000);
    
    // Detailed View State
    const [expandedPlayerId, setExpandedPlayerId] = useState(null);
    
    useEffect(() => {
        if (activeSave && Array.isArray(activeSave.players)) {
            const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
            const playerTeamName = activeSave.team ? String(activeSave.team) : null;

            console.log("PlayersHub Debug:", {
                totalPlayers: activeSave.players.length,
                playerTeamId,
                playerTeamName,
                firstFewPlayers: activeSave.players.slice(0, 3).map(p => ({ name: p.name, teamId: p.teamId, team: p.team }))
            });

            const currentFreeAgents = activeSave.players.filter(player => {
                if (!player) return false;
                const pTeamId = player.teamId !== undefined && player.teamId !== null ? String(player.teamId) : null;
                const pTeamName = player.team !== undefined && player.team !== null ? String(player.team) : null;
                
                // A player is a free agent if they have NO team ID AND NO team name,
                // or if their team ID/name is explicitly 'null', 'undefined', or empty.
                const hasNoId = pTeamId === null || pTeamId === 'null' || pTeamId === 'undefined' || pTeamId === '';
                const hasNoName = pTeamName === null || pTeamName === 'null' || pTeamName === 'undefined' || pTeamName === '';
                
                return hasNoId && hasNoName;
            });

            const currentOtherPlayers = activeSave.players.filter(player => {
                if (!player) return false;
                const pTeamId = player.teamId !== undefined && player.teamId !== null ? String(player.teamId) : null;
                const pTeamName = player.team !== undefined && player.team !== null ? String(player.team) : null;

                const hasNoId = pTeamId === null || pTeamId === 'null' || pTeamId === 'undefined' || pTeamId === '';
                const hasNoName = pTeamName === null || pTeamName === 'null' || pTeamName === 'undefined' || pTeamName === '';
                
                // If they have NO team info at all, they are a free agent
                if (hasNoId && hasNoName) return false;

                // Check if they belong to the player's team
                const playerTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
                const playerTeamName = activeSave.team ? String(activeSave.team) : null;

                const isInvalid = (v) => !v || v === 'null' || v === 'undefined';
                const normalize = (n) => String(n || '').toLowerCase().trim();

                const isPlayerTeamId = !isInvalid(playerTeamId) && !isInvalid(pTeamId) && pTeamId === playerTeamId;
                const isPlayerTeamName = !isInvalid(playerTeamName) && !isInvalid(pTeamName) && normalize(pTeamName) === normalize(playerTeamName);
                
                // CRITICAL: Also check by name/gamertag for real players who might have duplicate entries
                const isUserTeamByIdentity = activeSave.players.some(p => {
                    const activeTId = activeSave.teamId ? String(activeSave.teamId) : null;
                    const pTId = p.teamId ? String(p.teamId) : null;
                    const isInvalid = (v) => !v || v === 'null' || v === 'undefined';
                    const isOwnTeam = !isInvalid(activeTId) && !isInvalid(pTId) && pTId === activeTId;
                    if (!isOwnTeam) return false;
                    
                    return p.id === player.id || 
                           (p.gamertag && p.gamertag === player.gamertag) || 
                           (p.name && p.name === player.name);
                });

                // If they belong to the player's team, they aren't an "other player"
                return !(isPlayerTeamId || isPlayerTeamName || isUserTeamByIdentity);
            });
            
            console.log("PlayersHub Filtered:", {
                freeAgentsCount: currentFreeAgents.length,
                otherPlayersCount: currentOtherPlayers.length
            });

            let filteredFreeAgents = [...currentFreeAgents];
            let filteredOtherPlayers = [...currentOtherPlayers];

            // Filter by VCT Region
            if (selectedVctRegion !== 'All') {
                const isPlayerInVctRegion = (player) => {
                    if (!player) return false;
                    
                    // If player is on a team, use team's region
                    if (player.teamId) {
                        const team = teams.find(t => String(t.id) === String(player.teamId));
                        if (team && team.region === selectedVctRegion) return true;
                    }
                    
                    // Otherwise check nationality mapping
                    for (const [region, nats] of Object.entries(nationalities)) {
                        if (region === selectedVctRegion && nats.includes(player.nationality)) {
                            return true;
                        }
                    }
                    return false;
                };

                filteredFreeAgents = filteredFreeAgents.filter(isPlayerInVctRegion);
                filteredOtherPlayers = filteredOtherPlayers.filter(isPlayerInVctRegion);
            }

            // Filter by Nationality
            if (selectedNationality !== 'All') {
                filteredFreeAgents = filteredFreeAgents.filter(player => player && player.nationality === selectedNationality);
                filteredOtherPlayers = filteredOtherPlayers.filter(player => player && player.nationality === selectedNationality);
            }

            if (selectedRole !== 'All') {
                filteredFreeAgents = filteredFreeAgents.filter(player => player && player.role === selectedRole);
                filteredOtherPlayers = filteredOtherPlayers.filter(player => player && player.role === selectedRole);
            }

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredFreeAgents = filteredFreeAgents.filter(player => 
                    player && (player.name || player.gamertag || '').toLowerCase().includes(term)
                );
                filteredOtherPlayers = filteredOtherPlayers.filter(player => 
                    player && (player.name || player.gamertag || '').toLowerCase().includes(term)
                );
            }

            setFreeAgents(filteredFreeAgents);
            setOtherPlayers(filteredOtherPlayers);
        }
    }, [activeSave, selectedNationality, selectedVctRegion, selectedRole, searchTerm]);

    const handleSignPlayer = (player) => {
        if (!activeSave || !player) return;

        // If player is on another team, show contract offer modal instead of immediate signing
        const playerTeamId = player.teamId ? String(player.teamId) : null;
        const playerTeamName = player.team ? String(player.team) : null;
        const hasTeam = (playerTeamId && playerTeamId !== 'null' && playerTeamId !== 'undefined') || 
                        (playerTeamName && playerTeamName !== 'null' && playerTeamName !== 'undefined');

        if (hasTeam) {
            setSelectedPlayerForOffer(player);
            setOfferSalary(player.marketValue || 50000);
            setShowOfferModal(true);
            return;
        }

        if (confirm(`Sign ${player.name || player.gamertag} to your roster?`)) {
            // Check current team size to determine if they should be a starter or bench
            const myTeamPlayers = activeSave.players.filter(p => {
                const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
                const pTeamId = p.teamId ? String(p.teamId) : null;
                const isInvalid = (v) => !v || v === 'null' || v === 'undefined';
                return !isInvalid(activeTeamId) && !isInvalid(pTeamId) && pTeamId === activeTeamId;
            });

            const newInboxMessages = [];
            const originalTeamId = player.teamId;

            const updatedPlayers = activeSave.players.map(p => {
                if (p && p.id === player.id) {
                    const updatedP = Player.fromJSON(p);
                    updatedP.teamId = String(activeSave.teamId);
                    updatedP.team = activeSave.team; 
                    
                    // If we already have 5+ players, sign as bench
                    if (myTeamPlayers.length >= 5) {
                        updatedP.status = "bench";
                    } else {
                        updatedP.status = "active";
                    }
                    return updatedP;
                }
                
                // REDUNDANCY CHECK: Ensure this player ID doesn't exist on any other team
                // We also check by name/gamertag for real players
                const isMatch = p && (p.id === player.id || 
                                     (p.gamertag && p.gamertag === player.gamertag) || 
                                     (p.name && p.name === player.name));

                if (isMatch) {
                    const updatedP = Player.fromJSON(p);
                    updatedP.teamId = String(activeSave.teamId);
                    updatedP.team = activeSave.team;
                    return updatedP;
                }
                return p;
            });

            // Handle replacement for AI team if a player was poached from free agents (who had a team)
            if (originalTeamId && String(originalTeamId) !== String(activeSave.teamId)) {
                const originalTeam = teams.find(t => String(t.id) === String(originalTeamId));
                if (originalTeam) {
                    const replacement = hireFreeAgentForTeam(originalTeam.id, originalTeam.name, originalTeam.region, updatedPlayers);
                    if (replacement) {
                        newInboxMessages.push({
                            id: Date.now() + Math.random().toString(36).substr(2, 9),
                            sender: "League News",
                            subject: "Roster Change: Player Poached",
                            body: `ALERT: ${originalTeam.name} has lost ${player.name || player.gamertag} to your team, ${activeSave.team}.\n\nTo fill the vacancy, ${originalTeam.name} has signed free agent ${replacement.name || replacement.gamertag} to their active roster.`,
                            date: new Date().toLocaleDateString(),
                            read: false
                        });
                    }
                }
            }

            const updatedSave = {
                ...activeSave,
                players: updatedPlayers
            };

            // Add notification/message to inbox
            const playerRole = player.role || 'Flex';
            const playerACS = player.acs || player.stats?.acs || Math.round((player.aim + player.gameSense + player.mechanics) / 3) || 200;
            const playerOverall = player.overall || Math.round((player.aim + player.gameSense + player.mechanics + player.leadership + player.communication) / 5) || 75;
            
            const newMessage = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                sender: "Management",
                subject: "✨ NEW PLAYER SIGNED",
                body: `We have successfully signed ${player.name} to the roster as a ${myTeamPlayers.length >= 5 ? 'substitute' : 'starter'}.\n\nWelcome to the team!`,
                date: "Just now",
                read: false,
                playerData: {
                    name: player.name,
                    nickname: player.gamertag || player.nickname || player.name?.toLowerCase().replace(/\s/g, ''),
                    role: playerRole,
                    overall: playerOverall,
                    acs: playerACS,
                    salary: player.salary || player.marketValue || 50000
                }
            };
            
            updatedSave.inbox = [newMessage, ...newInboxMessages, ...(updatedSave.inbox || [])];
            
            // Explicitly save to storage immediately to ensure it persists on reload
            saveCareer(updatedSave);
            
            setActiveSave(updatedSave);
        }
    };

    const submitContractOffer = () => {
        if (!selectedPlayerForOffer || !activeSave) return;

        const newOffer = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            playerId: selectedPlayerForOffer.id,
            playerName: selectedPlayerForOffer.name || selectedPlayerForOffer.gamertag,
            offeredSalary: Number(offerSalary),
            originalTeamId: selectedPlayerForOffer.teamId,
            originalTeamName: selectedPlayerForOffer.team,
            weekOffered: activeSave.week,
            seasonOffered: activeSave.season
        };

        const updatedSave = {
            ...activeSave,
            pendingOffers: [...(activeSave.pendingOffers || []), newOffer]
        };

        // Add confirmation message to inbox
        const newMessage = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: "Management",
            subject: "Contract Offer Sent",
            body: `We have sent a contract offer to ${selectedPlayerForOffer.name} ($${Number(offerSalary).toLocaleString()}). We should hear back from them after next week's matches.`,
            date: "Just now",
            read: false
        };
        
        updatedSave.inbox = [newMessage, ...(updatedSave.inbox || [])];
        
        saveCareer(updatedSave);
        setActiveSave(updatedSave);
        setShowOfferModal(false);
        setSelectedPlayerForOffer(null);
        
        alert(`Contract offer sent to ${selectedPlayerForOffer.name}!`);
    };

    const handleCreatePlayer = (e) => {
        e.preventDefault();
        
        // Generate a new player with random stats based on the form data
        const player = generatePlayer(newPlayer.region, newPlayer.role);
        player.name = newPlayer.name || player.name;
        player.nationality = newPlayer.nationality;
        player.age = parseInt(newPlayer.age);
        player.teamId = null; // New players are free agents by default

        // Update activeSave with the new player
        const updatedSave = {
            ...activeSave,
            players: [...activeSave.players, player]
        };
        
        setActiveSave(updatedSave);
        setShowCreateForm(false);
        setNewPlayer({
            name: '',
            role: 'Duelist',
            nationality: 'USA',
            age: 18,
            region: 'North America'
        });
    };

    if (!activeSave) {
        return <div className="players-container">Loading players...</div>;
    }

    const allNationalities = activeSave && Array.isArray(activeSave.players) 
        ? [...new Set(activeSave.players.filter(p => p && p.nationality).map(player => player.nationality))] 
        : [];

    const getRatingClass = (rating) => {
        if (rating >= 85) return 'rating-elite';
        if (rating >= 75) return 'rating-good';
        if (rating >= 65) return 'rating-average';
        return 'rating-poor';
    };

    const PlayerDetailsDropdown = ({ player }) => {
        if (!player) return null;

        const ratings = player.rating || player.ratings;

        // Check if player is on the user's team
        const isOnUserTeam = activeSave && String(player.teamId) === String(activeSave.teamId);

        const handleSetIGL = () => {
            if (!activeSave) return;
            
            const updatedPlayers = activeSave.players.map(p => {
                if (String(p.teamId) === String(activeSave.teamId)) {
                    return { ...p, isIGL: p.id === player.id };
                }
                return p;
            });
            
            const updatedSave = { ...activeSave, players: updatedPlayers };
            setActiveSave(updatedSave);
            saveCareer(updatedSave);
        };

        const stats = [
            { label: 'Aim', value: ratings?.aim || 50 },
            { label: 'Movement', value: ratings?.movement || 50 },
            { label: 'Game Sense', value: ratings?.gameSense || 50 },
            { label: 'Clutch', value: ratings?.clutch || 50 },
            { label: 'Aggression', value: ratings?.aggression || 50 },
            { label: 'Utility', value: ratings?.utility || 50 },
            { label: 'Mental', value: ratings?.mental || 50 },
            { label: 'Teamwork', value: ratings?.teamwork || 50 },
            { label: 'Consistency', value: ratings?.consistency || 50 },
        ];

        const overall = typeof player.overall === 'number' ? player.overall : (function() {
            if (!ratings) return 0;
            const values = stats.map(s => Number(s.value));
            const sum = values.reduce((acc, curr) => acc + curr, 0);
            return Math.round(sum / values.length);
        })();

        const team = player.teamId ? teams.find(t => String(t.id) === String(player.teamId)) : null;

        return (
            <div className="player-details-dropdown-content">
                <div className="dropdown-grid">
                    <div className="dropdown-section">
                        <h4>Performance Ratings</h4>
                        <div className="dropdown-stats-grid">
                            {stats.map(stat => (
                                <div key={stat.label} className="dropdown-stat-item">
                                    <span className="stat-label">{stat.label}</span>
                                    <div className="stat-bar-bg h-2 flex-1 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className={`stat-bar-fill ${getRatingClass(stat.value)} h-full transition-all duration-700`} 
                                            style={{ width: `${stat.value}%` }}
                                        ></div>
                                    </div>
                                    <span className={`stat-value text-${getRatingClass(stat.value)} w-8 text-right`}>{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="dropdown-section">
                        <h4>Player Profile</h4>
                        <div className="dropdown-profile-info">
                            <div className="profile-row">
                                <span>Status:</span>
                                <strong>{team ? team.name : 'Free Agent'}</strong>
                            </div>
                            <div className="profile-row">
                                <span>Experience:</span>
                                <strong>{player.experience || 'Rookie'}</strong>
                            </div>
                            
                            <div className="profile-row">
                                <span>Potential:</span>
                                <strong className={getRatingClass(player.potential)}>{player.potential || 'N/A'}</strong>
                            </div>
                            {isOnUserTeam && (
                                <div className="profile-row mt-4">
                                    <button 
                                        onClick={handleSetIGL}
                                        className={`w-full py-2 px-4 rounded font-bold transition-all ${
                                            player.isIGL 
                                            ? 'bg-yellow-500 text-black' 
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        {player.isIGL ? '★ Team Leader (IGL)' : 'Set as Team Leader'}
                                    </button>
                                </div>
                            )}
                            <div className="dropdown-description">
                                <div className="flex items-center gap-2 mb-2">
                                    {getFlagUrl(player.nationality) && (
                                        <img 
                                            src={getFlagUrl(player.nationality)} 
                                            alt="" 
                                            className="flag-icon flag-icon-large"
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                    )}
                                    <span className="text-gray-400 font-bold">{player.nationality}</span>
                                </div>
                                <p>
                                    {player.name} is a {player.role} from {player.nationality}. 
                                    {overall >= 80 ? " Top-tier talent." : 
                                     overall >= 70 ? " Solid professional." : 
                                     " Developing talent."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const PlayerRow = ({ player, isAcquirable = true }) => {
        const ratings = player.rating || player.ratings;
        const overall = typeof player.overall === 'number' ? player.overall : (function() {
            if (!ratings) return 0;
            const stats = [
                ratings.aim, ratings.movement, ratings.gameSense, 
                ratings.clutch, ratings.aggression, ratings.utility, 
                ratings.mental, ratings.teamwork, ratings.consistency
            ];
            const sum = stats.reduce((acc, curr) => acc + (Number(curr) || 50), 0);
            return Math.round(sum / 9);
        })();

        const ratingClass = getRatingClass(overall);
        const team = player.teamId ? teams.find(t => String(t.id) === String(player.teamId)) : null;
        const isPending = activeSave.pendingOffers?.some(o => o.playerId === player.id);
        const isExpanded = expandedPlayerId === player.id;

        return (
            <React.Fragment key={player.id || player.name}>
                <tr 
                    className={`player-list-row ${ratingClass} ${isExpanded ? 'is-expanded' : ''} cursor-pointer hover:bg-white/5 transition-colors`} 
                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                >
                    <td className="player-list-name">
                        <div className="flex items-center gap-2">
                            <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>▶</span>
                            <div 
                                className="cursor-pointer hover:text-[#ff4655] transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: player.id } }));
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <strong>{player.name || player.gamertag}</strong>
                                    {player.isIGL && (
                                        <span className="bg-yellow-500 text-black text-[10px] px-1 rounded font-black leading-tight">IGL</span>
                                    )}
                                </div>
                                <span className="player-list-role">{player.role}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div className="flex items-center gap-2">
                            {getFlagUrl(player.nationality) && (
                                <img 
                                    src={getFlagUrl(player.nationality)} 
                                    alt="" 
                                    className="flag-icon"
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                            )}
                            <span>{player.nationality || "Unknown"}</span>
                        </div>
                    </td>
                    <td>{player.age || 18}</td>
                    <td>
                          {team ? (
                               <div 
                                   className="flex items-center gap-2 cursor-pointer hover:text-[#ff4655] transition-colors group"
                                   onClick={(e) => {
                                       e.stopPropagation();
                                       window.dispatchEvent(new CustomEvent('open-team-modal', { detail: { teamName: team.name } }));
                                   }}
                               >
                                   <div className="flex-shrink-0 w-6 flex justify-center items-center">
                                       {teamLogos[team.name] && <img src={teamLogos[team.name]} alt="" className="table-team-logo group-hover:scale-110 transition-transform" />}
                                   </div>
                                   <span className="text-xs uppercase font-bold text-gray-400 tracking-wider leading-none group-hover:text-[#ff4655]">{team.name}</span>
                               </div>
                           ) : (
                              <span className="text-xs uppercase font-bold text-gray-600 italic">Free Agent</span>
                          )}
                      </td>
                    <td className="player-list-overall">
                        <div className="flex items-center gap-3">
                            <span className={`font-black text-lg w-6 text-center text-${ratingClass}`}>{overall}</span>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                                <div 
                                    className={`h-full transition-all duration-500 stat-bar-fill ${ratingClass}`} 
                                    style={{ width: `${overall}%` }}
                                ></div>
                            </div>
                        </div>
                    </td>
                    <td className="player-list-salary">
                        ${(player.marketValue || 50000).toLocaleString()}
                    </td>
                    <td className="player-list-action" onClick={e => e.stopPropagation()}>
                        {isAcquirable && (
                            <button 
                                className={`sign-player-btn ${isPending ? 'pending' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSignPlayer(player);
                                }}
                                disabled={isPending}
                            >
                                {isPending 
                                    ? 'Pending' 
                                    : (player.teamId && player.teamId !== 'null' ? 'Offer' : 'Sign')}
                            </button>
                        )}
                    </td>
                </tr>
                {isExpanded && (
                    <tr className="player-details-row">
                        <td colSpan="7">
                            <PlayerDetailsDropdown player={player} />
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    const PlayerTable = ({ players, title, isAcquirable = true }) => (
        <div className="hub-section">
            <h3>{title} <span className="text-sm opacity-50 ml-2">({players.length})</span></h3>
            <div className="player-list-container">
                <table className="player-list-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Nationality</th>
                            <th>Age</th>
                            <th>Team</th>
                            <th>OVR</th>
                            <th>Salary</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.length > 0 ? (
                            players.map(player => (
                                <PlayerRow key={player.id} player={player} isAcquirable={isAcquirable} />
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="no-data">No players found matching your filters.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="players-container">
            <div className="hub-header">
                <div className="hub-title-section">
                    <h2>Players Hub</h2>
                    {activeSave && (
                        <div className="budget-display">
                            Available Budget: <span className={remainingBudget < 0 ? 'budget-negative' : ''}>
                                ${remainingBudget.toLocaleString()}
                            </span>
                            <small className="budget-detail">
                                (After ${teamSalary.toLocaleString()} in Salaries)
                            </small>
                        </div>
                    )}
                </div>
                <button className="create-player-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
                    {showCreateForm ? 'Cancel' : 'Create New Player'}
                </button>
            </div>

            {showCreateForm && (
                <div className="create-player-form-container">
                    <form onSubmit={handleCreatePlayer} className="create-player-form">
                        <div className="form-group">
                            <label>Name / Gamertag</label>
                            <input 
                                type="text" 
                                value={newPlayer.name} 
                                onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})}
                                placeholder="Leave blank for random"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Role</label>
                                <select value={newPlayer.role} onChange={(e) => setNewPlayer({...newPlayer, role: e.target.value})}>
                                    {Object.values(ROLES).map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Region</label>
                                <select value={newPlayer.region} onChange={(e) => setNewPlayer({...newPlayer, region: e.target.value})}>
                                    <option key="Americas" value="Americas">Americas</option>
                                    <option key="EMEA" value="EMEA">EMEA</option>
                                    <option key="Pacific" value="Pacific">Pacific</option>
                                    <option key="China" value="China">China</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nationality</label>
                                <input 
                                    type="text" 
                                    value={newPlayer.nationality} 
                                    onChange={(e) => setNewPlayer({...newPlayer, nationality: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Age</label>
                                <input 
                                    type="number" 
                                    value={newPlayer.age} 
                                    onChange={(e) => setNewPlayer({...newPlayer, age: e.target.value})}
                                    min="16" max="40"
                                />
                            </div>
                        </div>
                        <button type="submit" className="submit-player-btn">Generate Player with Stats</button>
                    </form>
                </div>
            )}

            <div className="filter-controls">
                <div className="search-group">
                    <label>Search Players:</label>
                    <input 
                        type="text" 
                        placeholder="Search by name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-group">
                    <label>VCT Region:</label>
                    <select value={selectedVctRegion} onChange={(e) => setSelectedVctRegion(e.target.value)}>
                        <option key="all-vct" value="All">All Regions</option>
                        {Object.keys(nationalities).sort().map(region => (
                            <option key={region} value={region}>{region}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Nationality:</label>
                    <select value={selectedNationality} onChange={(e) => setSelectedNationality(e.target.value)}>
                        <option key="all-nat" value="All">All Countries</option>
                        {allNationalities.filter(nat => typeof nat === 'string').sort().map(nat => (
                            <option key={nat} value={nat}>{nat}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Role:</label>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                        <option key="all-roles" value="All">All Roles</option>
                        {Object.values(ROLES).map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                </div>
            </div>

            <PlayerTable 
                players={freeAgents} 
                title="Available Free Agents" 
            />

            <PlayerTable 
                players={otherPlayers} 
                title="Players from Other Teams" 
            />

            {/* Contract Offer Modal */}
            {showOfferModal && selectedPlayerForOffer && (
                <div className="modal-overlay" onClick={() => setShowOfferModal(false)}>
                    <div className="modal-content contract-modal" onClick={e => e.stopPropagation()}>
                        <h3>Offer Contract to {selectedPlayerForOffer.name}</h3>
                        <p className="modal-subtitle">Currently playing for {selectedPlayerForOffer.team}</p>
                        
                        <div className="offer-details">
                            <div className="detail-item">
                                <span>Market Value</span>
                                <strong>${(selectedPlayerForOffer.marketValue || 50000).toLocaleString()}</strong>
                            </div>
                            <div className="detail-item">
                                <span>Your Budget</span>
                                <strong>${remainingBudget.toLocaleString()}</strong>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Weekly Salary Offer</label>
                            <input 
                                type="number" 
                                value={offerSalary}
                                onChange={(e) => setOfferSalary(e.target.value)}
                                min="1000"
                                step="1000"
                            />
                            <small>Higher offers have a better chance of being accepted by players on other teams.</small>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowOfferModal(false)}>Cancel</button>
                            <button className="submit-offer-btn" onClick={submitContractOffer}>Send Offer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayersHub;