import React, { useState, useEffect } from 'react';
import { loadCareer, saveCareer } from '../career_local_storage.jsx';

const PlayerEditModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [player, setPlayer] = useState(null);
  const [formData, setFormData] = useState({
    gamertag: '',
    role: 'Duelist',
    nationality: '',
    age: '',
    salary: '',
    ratings: {
      aim: 50,
      movement: 50,
      gameSense: 50,
      clutch: 50,
      aggression: 50,
      utility: 50,
      mental: 50,
      teamwork: 50,
      consistency: 50,
      potential: 70
    }
  });

  useEffect(() => {
    const handleOpen = (event) => {
      const playerId = event.detail?.playerId;
      if (!playerId) {
        // Fallback for legacy calls that might rely on hidden input (not recommended but safe)
        setIsOpen(true);
        return;
      }
      
      const activeSave = loadCareer();
      if (!activeSave) return;

      const foundPlayer = activeSave.players.find(p => String(p.id) === String(playerId));
      if (foundPlayer) {
        setPlayer(foundPlayer);
        
        // Initialize form data
        const ratings = foundPlayer.rating || {};
        // Handle legacy skill fallback
        const defaultSkill = foundPlayer.skill || 50;
        
        setFormData({
          gamertag: foundPlayer.gamertag || foundPlayer.name || '',
          role: foundPlayer.role || 'Duelist',
          nationality: foundPlayer.nationality || '',
          age: foundPlayer.age || '',
          salary: foundPlayer.marketValue || 50000,
          ratings: {
            aim: ratings.aim || defaultSkill,
            movement: ratings.movement || defaultSkill,
            gameSense: ratings.gameSense || ratings.gamesense || defaultSkill,
            clutch: ratings.clutch || defaultSkill,
            aggression: ratings.aggression || defaultSkill,
            utility: ratings.utility || defaultSkill,
            mental: ratings.mental || defaultSkill,
            teamwork: ratings.teamwork || defaultSkill,
            consistency: ratings.consistency || defaultSkill,
            potential: ratings.potential || foundPlayer.potential || 70
          }
        });
        
        setIsOpen(true);
      }
    };

    const handleClose = () => setIsOpen(false);

    window.addEventListener('open-player-edit-modal', handleOpen);
    window.addEventListener('close-player-edit-modal', handleClose);

    return () => {
      window.removeEventListener('open-player-edit-modal', handleOpen);
      window.removeEventListener('close-player-edit-modal', handleClose);
    };
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('close-player-edit-modal'));
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    // Map IDs to state keys
    if (id === 'edit-player-gamertag') setFormData(prev => ({ ...prev, gamertag: value }));
    else if (id === 'edit-player-role') setFormData(prev => ({ ...prev, role: value }));
    else if (id === 'edit-player-nationality') setFormData(prev => ({ ...prev, nationality: value }));
    else if (id === 'edit-player-age') setFormData(prev => ({ ...prev, age: value })); // keep as string for input
    else if (id === 'edit-player-salary') setFormData(prev => ({ ...prev, salary: value }));
  };

  const handleRatingChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      ratings: {
        ...prev.ratings,
        [key]: parseInt(value) || 0
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!player) return;

    const activeSave = loadCareer();
    if (!activeSave) return;

    const playerIndex = activeSave.players.findIndex(p => String(p.id) === String(player.id));
    if (playerIndex === -1) return;

    // Create updated player object
    const updatedPlayer = { ...activeSave.players[playerIndex] };
    
    updatedPlayer.gamertag = formData.gamertag;
    updatedPlayer.name = formData.gamertag; // Keep name synced
    updatedPlayer.role = formData.role;
    updatedPlayer.nationality = formData.nationality;
    updatedPlayer.age = parseInt(formData.age) || 0;
    updatedPlayer.marketValue = parseInt(formData.salary) || 0;
    
    // Update ratings
    updatedPlayer.rating = {
      aim: formData.ratings.aim,
      movement: formData.ratings.movement,
      gameSense: formData.ratings.gameSense,
      clutch: formData.ratings.clutch,
      aggression: formData.ratings.aggression,
      utility: formData.ratings.utility,
      mental: formData.ratings.mental,
      teamwork: formData.ratings.teamwork,
      consistency: formData.ratings.consistency,
      potential: formData.ratings.potential
    };
    
    // Legacy skill compatibility
    updatedPlayer.skill = formData.ratings.aim;

    // Save back to array
    activeSave.players[playerIndex] = updatedPlayer;

    await saveCareer(activeSave);
    
    // Notify system of update
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
    
    closeModal();
    
    // Trigger roster re-render if function exists
    if (typeof window.renderTeamRoster === 'function') {
      window.renderTeamRoster(activeSave);
    }
  };

  const statsList = [
    { key: 'aim', label: 'Aim' },
    { key: 'movement', label: 'Movement' },
    { key: 'gameSense', label: 'Game Sense' },
    { key: 'clutch', label: 'Clutch' },
    { key: 'aggression', label: 'Aggression' },
    { key: 'utility', label: 'Utility' },
    { key: 'mental', label: 'Mental' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'potential', label: 'Potential' }
  ];

  return (
    <div 
      id="player-edit-modal" 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto ${isOpen ? '' : 'hidden'}`}
    >
      <div className="bg-val-dark-grey border border-val-red rounded-xl max-w-2xl w-full shadow-[0_0_30px_rgba(255,70,85,0.2)] relative flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-2xl font-bold text-white font-valorant tracking-wide">Edit Player Attributes</h3>
          <span 
            className="close-button text-gray-400 hover:text-white cursor-pointer text-3xl leading-none"
            onClick={closeModal}
          >&times;</span>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="player-edit-form" className="space-y-6" onSubmit={handleSubmit}>
            <input type="hidden" id="edit-player-id" value={player?.id || ''} readOnly />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="edit-player-name" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Name</label>
                <input 
                  type="text" 
                  id="edit-player-name" 
                  disabled 
                  value={player?.name || ''}
                  readOnly
                  className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-player-gamertag" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Gamertag</label>
                <input 
                  type="text" 
                  id="edit-player-gamertag" 
                  value={formData.gamertag}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-val-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="edit-player-role" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Role</label>
                <select 
                  id="edit-player-role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-val-red focus:outline-none transition-colors appearance-none"
                >
                  <option value="Duelist">Duelist</option>
                  <option value="Initiator">Initiator</option>
                  <option value="Controller">Controller</option>
                  <option value="Sentinel">Sentinel</option>
                  <option value="Flex">Flex</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-player-nationality" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Nationality</label>
                <input 
                  type="text" 
                  id="edit-player-nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-val-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="edit-player-age" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Age</label>
                <input 
                  type="number" 
                  id="edit-player-age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-val-red focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-player-salary" className="block text-xs uppercase tracking-wider text-gray-400 font-bold">Salary ($)</label>
                <input 
                  type="number" 
                  id="edit-player-salary"
                  value={formData.salary}
                  onChange={handleInputChange}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-val-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h4 className="text-lg font-bold text-white mb-4 font-valorant tracking-wide">Ratings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {statsList.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center text-xs uppercase tracking-wider font-bold text-gray-400">
                      <label htmlFor={`edit-player-${key === 'gameSense' ? 'gamesense' : key}`}>{label}</label>
                      <span id={`edit-player-${key === 'gameSense' ? 'gamesense' : key}-value`} className="text-val-red">{formData.ratings[key]}</span>
                    </div>
                    <input 
                      type="range" 
                      id={`edit-player-${key === 'gameSense' ? 'gamesense' : key}`} 
                      min="0" 
                      max="100" 
                      value={formData.ratings[key]}
                      onChange={(e) => handleRatingChange(key, e.target.value)}
                      className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-val-red"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-white/10 mt-6">
              <button 
                type="button" 
                className="px-6 py-2 rounded bg-black/40 hover:bg-black/60 text-white transition-colors border border-white/10 font-bold tracking-wide uppercase text-sm"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 rounded bg-val-red hover:bg-red-600 text-white transition-colors font-bold tracking-wide uppercase text-sm shadow-[0_0_15px_rgba(255,70,85,0.4)]"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlayerEditModal;
