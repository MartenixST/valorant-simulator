import React, { useState, useEffect } from 'react';
import { teams, teamLogos } from '../teams.js';
import { ROLES, Player, PlayerRating } from '../simulation.js';
import { generatePlayer } from '../players.js';
import { saveCareer } from '../career_local_storage.jsx';

const PlayersHub = ({ activeSave, setActiveSave }) => {
    const [freeAgents, setFreeAgents] = useState([]);
    const [otherPlayers, setOtherPlayers] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedRole, setSelectedRole] = useState('All');
    const [showCreateForm, setShowCreateForm] = useState(false);
    
    const [newPlayer, setNewPlayer] = useState({
        name: '',
        role: 'Duelist',
        nationality: 'USA',
        age: 18,
        region: 'North America'
    });

    const [searchTerm, setSearchTerm] = useState('');
    
    // Contract Offer State
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [selectedPlayerForOffer, setSelectedPlayerForOffer] = useState(null);
    const [offerSalary, setOfferSalary] = useState(50000);
    
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

                const isPlayerTeamId = playerTeamId && pTeamId === playerTeamId;
                const isPlayerTeamName = playerTeamName && pTeamName === playerTeamName;
                
                // If they belong to the player's team, they aren't an "other player"
                return !(isPlayerTeamId || isPlayerTeamName);
            });
            
            console.log("PlayersHub Filtered:", {
                freeAgentsCount: currentFreeAgents.length,
                otherPlayersCount: currentOtherPlayers.length
            });

            let filteredFreeAgents = [...currentFreeAgents];
            let filteredOtherPlayers = [...currentOtherPlayers];

            if (selectedRegion !== 'All') {
                filteredFreeAgents = filteredFreeAgents.filter(player => player && player.nationality === selectedRegion);
                filteredOtherPlayers = filteredOtherPlayers.filter(player => player && player.nationality === selectedRegion);
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
    }, [activeSave, selectedRegion, selectedRole, searchTerm]);

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
                return activeTeamId && pTeamId && pTeamId === activeTeamId;
            });

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
                return p;
            });

            const updatedSave = {
                ...activeSave,
                players: updatedPlayers
            };

            // Add notification/message to inbox
            const newMessage = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                sender: "Management",
                subject: "New Player Signed",
                body: `We have successfully signed ${player.name} to the roster as a ${myTeamPlayers.length >= 5 ? 'substitute' : 'starter'}.`,
                date: "Just now",
                read: false
            };
            
            updatedSave.inbox = [newMessage, ...(updatedSave.inbox || [])];
            
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

    const StatBar = ({ label, value }) => {
        const ratingClass = getRatingClass(value);
        return (
            <div className="stat-bar-container">
                <div className="stat-label">
                    <span>{label}</span>
                    <span className={`text-${ratingClass}`}>{Math.round(value)}</span>
                </div>
                <div className="stat-bar-bg">
                    <div className={`stat-bar-fill ${ratingClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
                </div>
            </div>
        );
    };

    const PlayerCard = ({ player, isAcquirable = true }) => {
        const ratings = player.rating || player.ratings;
        
        // Use the getter if available, otherwise calculate
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

        return (
            <div className={`player-card-hub ${ratingClass}`} key={player.id || player.name}>
                <div className="player-card-header">
                    <div className="player-main-info">
                        <h4>{player.name || player.gamertag}</h4>
                        <div className="player-tags">
                            <span className="player-role-tag">{player.role}</span>
                            {team && <span className="player-team-tag">{team.name}</span>}
                        </div>
                    </div>
                    <div className={`player-overall-circle border-${ratingClass} text-${ratingClass}`}>
                        {overall}
                    </div>
                </div>
                
                <div className="player-meta">
                    <div className="meta-item">
                        <span className="meta-label">Nationality:</span>
                        <span className="meta-value">{player.nationality || "Unknown"}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Age:</span>
                        <span className="meta-value">{player.age || 18}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Salary:</span>
                        <span className="meta-value">${(player.marketValue || 50000).toLocaleString()}</span>
                    </div>
                </div>

                <div className="player-stats-grid">
                    <StatBar label="Aim" value={ratings?.aim || 50} />
                    <StatBar label="Movement" value={ratings?.movement || 50} />
                    <StatBar label="Game Sense" value={ratings?.gameSense || 50} />
                    <StatBar label="Utility" value={ratings?.utility || 50} />
                    <StatBar label="Clutch" value={ratings?.clutch || 50} />
                    <StatBar label="Aggression" value={ratings?.aggression || 50} />
                    <StatBar label="Mental" value={ratings?.mental || 50} />
                    <StatBar label="Teamwork" value={ratings?.teamwork || 50} />
                </div>

                <div className="player-card-footer">
                    {isAcquirable && (
                        <button 
                            className={`sign-player-btn ${activeSave.pendingOffers?.some(o => o.playerId === player.id) ? 'pending' : ''}`}
                            onClick={() => handleSignPlayer(player)}
                            disabled={activeSave.pendingOffers?.some(o => o.playerId === player.id)}
                        >
                            {activeSave.pendingOffers?.some(o => o.playerId === player.id) 
                                ? 'Offer Pending' 
                                : (player.teamId && player.teamId !== 'null' ? 'Contract Offer' : 'Sign Player')}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="players-container">
            <div className="hub-header">
                <div className="hub-title-section">
                    <h2>Players Hub</h2>
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
                                    <option key="North America" value="North America">North America</option>
                                    <option key="EMEA" value="EMEA">EMEA</option>
                                    <option key="Pacific" value="Pacific">Pacific</option>
                                    <option key="Americas" value="Americas">Americas</option>
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
                    <label>Nationality:</label>
                    <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                        <option key="all-nat" value="All">All Regions</option>
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

            <section className="hub-section">
                <h3>Available Free Agents ({freeAgents.length})</h3>
                <div className="player-cards-grid">
                    {freeAgents.length > 0 ? (
                        freeAgents.map((player, idx) => <PlayerCard key={player.id || `fa-${idx}`} player={player} />)
                    ) : (
                        <p className="no-data">No free agents found. (Total players in save: {activeSave?.players?.length || 0})</p>
                    )}
                </div>
            </section>

            <section className="hub-section">
                <h3>Players from Other Teams ({otherPlayers.length})</h3>
                {(() => {
                    const grouped = otherPlayers.reduce((acc, player) => {
                        const tId = String(player.teamId);
                        if (!acc[tId]) acc[tId] = [];
                        acc[tId].push(player);
                        return acc;
                    }, {});

                    const teamIds = Object.keys(grouped).sort((a, b) => {
                        const teamA = teams.find(t => String(t.id) === a);
                        const teamB = teams.find(t => String(t.id) === b);
                        return (teamA?.name || '').localeCompare(teamB?.name || '');
                    });

                    if (teamIds.length === 0) {
                        return <p className="no-data">No other players found.</p>;
                    }

                    return teamIds.map(tId => {
                        const team = teams.find(t => String(t.id) === tId);
                        const teamPlayers = grouped[tId];
                        const logo = teamLogos[team?.name] || 'assets/team_logos/default.png';

                        return (
                            <div key={tId} className="team-group-section">
                                <div className="team-group-header">
                                    <img src={logo} alt={team?.name} className="team-group-logo" />
                                    <h4>{team?.name || 'Unknown Team'}</h4>
                                    <span className="team-player-count">{teamPlayers.length} Players</span>
                                </div>
                                <div className="player-cards-grid">
                                    {teamPlayers.map((player, idx) => (
                                        <PlayerCard key={player.id || `other-${tId}-${idx}`} player={player} />
                                    ))}
                                </div>
                            </div>
                        );
                    });
                })()}
            </section>

            {/* Contract Offer Modal */}
            {showOfferModal && selectedPlayerForOffer && (
                <div className="modal-overlay">
                    <div className="modal-content contract-modal">
                        <h3>Offer Contract to {selectedPlayerForOffer.name}</h3>
                        <p className="modal-subtitle">Currently playing for {selectedPlayerForOffer.team}</p>
                        
                        <div className="offer-details">
                            <div className="detail-item">
                                <span>Market Value:</span>
                                <strong>${(selectedPlayerForOffer.marketValue || 50000).toLocaleString()}</strong>
                            </div>
                            
                            <div className="form-group">
                                <label>Salary Offer ($):</label>
                                <input 
                                    type="number" 
                                    value={offerSalary} 
                                    onChange={(e) => setOfferSalary(e.target.value)}
                                    min="50000"
                                    step="1000"
                                />
                                <small>Players are more likely to accept higher offers than their current value.</small>
                            </div>
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