import React, { useState, useEffect } from 'react';
import { teams } from '../teams.js';
import { ROLES, Player, PlayerRating } from '../simulation.js';
import { generatePlayer } from '../players.js';

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

    useEffect(() => {
        if (activeSave && activeSave.players) {
            const currentFreeAgents = activeSave.players.filter(player => player.teamId === null);
            const currentOtherPlayers = activeSave.players.filter(player => player.teamId !== null && player.teamId !== activeSave.teamId);
            
            let filteredFreeAgents = currentFreeAgents;
            let filteredOtherPlayers = currentOtherPlayers;

            if (selectedRegion !== 'All') {
                filteredFreeAgents = filteredFreeAgents.filter(player => player.nationality === selectedRegion);
                filteredOtherPlayers = filteredOtherPlayers.filter(player => player.nationality === selectedRegion);
            }

            if (selectedRole !== 'All') {
                filteredFreeAgents = filteredFreeAgents.filter(player => player.role === selectedRole);
                filteredOtherPlayers = filteredOtherPlayers.filter(player => player.role === selectedRole);
            }

            setFreeAgents(filteredFreeAgents);
            setOtherPlayers(filteredOtherPlayers);
        }
    }, [activeSave, selectedRegion, selectedRole]);

    const handleSignPlayer = (player) => {
        if (!activeSave) return;

        const cost = player.marketValue || 5000;
        const currentBudget = activeSave.budget || 0;

        if (currentBudget < cost) {
            alert(`Not enough budget! You need $${cost.toLocaleString()} but only have $${currentBudget.toLocaleString()}.`);
            return;
        }

        if (confirm(`Sign ${player.name} for $${cost.toLocaleString()}?`)) {
            const updatedPlayers = activeSave.players.map(p => {
                if (p.id === player.id) {
                    return { ...p, teamId: activeSave.teamId };
                }
                return p;
            });

            const updatedSave = {
                ...activeSave,
                budget: currentBudget - cost,
                players: updatedPlayers
            };

            // Add notification/message to inbox
            const newMessage = {
                id: Date.now(),
                sender: "Management",
                subject: "New Player Signed",
                content: `We have successfully signed ${player.name} to the roster. The acquisition cost of $${cost.toLocaleString()} has been deducted from our budget.`,
                date: "Just now",
                read: false
            };
            
            updatedSave.inbox = [newMessage, ...(updatedSave.inbox || [])];
            setActiveSave(updatedSave);
        }
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

    const allNationalities = activeSave ? [...new Set(activeSave.players.map(player => player.nationality))] : [];

    const StatBar = ({ label, value }) => (
        <div className="stat-bar-container">
            <div className="stat-label">
                <span>{label}</span>
                <span>{value}</span>
            </div>
            <div className="stat-bar-bg">
                <div className="stat-bar-fill" style={{ width: `${value}%`, backgroundColor: value > 80 ? '#ff4655' : value > 60 ? '#00f6ff' : '#ece8e1' }}></div>
            </div>
        </div>
    );

    const PlayerCard = ({ player, isAcquirable = true }) => {
        const ratings = player.rating || player.ratings;
        const overall = player.overall || (ratings ? Math.round((ratings.aim + ratings.movement + ratings.gameSense + ratings.clutch + ratings.aggression + (ratings.utility || 50) + (ratings.mental || 50) + (ratings.teamwork || 50) + (ratings.consistency || 50)) / 9) : 0);
        const cost = player.marketValue || 5000;

        return (
            <div className="player-card" key={player.id || player.name}>
                <div className="player-card-header">
                    <div className="player-main-info">
                        <h4>{player.name}</h4>
                        <span className="player-role-tag">{player.role}</span>
                    </div>
                    <div className="player-overall-circle">
                        {overall}
                    </div>
                </div>
                
                <div className="player-meta">
                    <span>{player.nationality}</span>
                    <span>•</span>
                    <span>Age: {player.age}</span>
                </div>

                <div className="player-stats-grid">
                    <StatBar label="Aim" value={ratings?.aim || 0} />
                    <StatBar label="Movement" value={ratings?.movement || 0} />
                    <StatBar label="Game Sense" value={ratings?.gameSense || 0} />
                    <StatBar label="Utility" value={ratings?.utility || 50} />
                </div>

                <div className="player-card-footer">
                    <div className="player-cost">
                        <span className="cost-label">Value:</span>
                        <span className="cost-amount">${cost.toLocaleString()}</span>
                    </div>
                    {isAcquirable && (
                        <button 
                            className="sign-player-btn"
                            onClick={() => handleSignPlayer(player)}
                            disabled={activeSave.budget < cost}
                        >
                            Sign Player
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
                    <div className="budget-display">
                        Budget: <span>${(activeSave.budget || 0).toLocaleString()}</span>
                    </div>
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
                <div className="filter-group">
                    <label>Nationality:</label>
                    <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                        <option key="all-nat" value="All">All</option>
                        {allNationalities.map(nat => <option key={nat || 'unknown'} value={nat}>{nat}</option>)}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Role:</label>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                        <option key="all-roles" value="All">All</option>
                        {Object.values(ROLES).map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                </div>
            </div>

            <section className="hub-section">
                <h3>Available Free Agents</h3>
                <div className="player-cards-grid">
                    {freeAgents.length > 0 ? (
                        freeAgents.map(player => <PlayerCard key={player.id} player={player} />)
                    ) : (
                        <p className="no-data">No free agents found.</p>
                    )}
                </div>
            </section>

            <section className="hub-section">
                <h3>Players from Other Teams</h3>
                <div className="player-cards-grid">
                    {otherPlayers.length > 0 ? (
                        otherPlayers.map(player => <PlayerCard key={player.id} player={player} />)
                    ) : (
                        <p className="no-data">No other players found.</p>
                    )}
                </div>
            </section>
        </div>
    );
};

export default PlayersHub;