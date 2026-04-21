import React, { useState, useEffect } from 'react';
import { loadCareer, saveCareer } from '../career_local_storage.jsx';

const PlayerEditModal = ({ isOpen: propIsOpen, onClose: propOnClose, playerId: propPlayerId, activeSave: propActiveSave, setActiveSave }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [player, setPlayer] = useState(null);

  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

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
    if (propIsOpen && propPlayerId) {
      const activeSave = propActiveSave || loadCareer();
      const foundPlayer = activeSave?.players?.find(p => String(p.id) === String(propPlayerId));
      if (foundPlayer) {
        setPlayer(foundPlayer);
        const ratings = foundPlayer.rating || {};
        const defaultSkill = foundPlayer.skill || 50;
        setFormData({
          gamertag: foundPlayer.gamertag || foundPlayer.name || '',
          role: foundPlayer.role || 'Duelist',
          secondaryRole: foundPlayer.secondaryRole || null,
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
      }
    }
  }, [propIsOpen, propPlayerId, propActiveSave]);

  useEffect(() => {
    const handleOpen = (event) => {
      const playerId = event.detail?.playerId;
      if (!playerId) {
        setInternalIsOpen(true);
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
          secondaryRole: foundPlayer.secondaryRole || null,
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
        
        setInternalIsOpen(true);
      }
    };

    const handleClose = () => setInternalIsOpen(false);

    window.addEventListener('open-player-edit-modal', handleOpen);
    window.addEventListener('close-player-edit-modal', handleClose);

    return () => {
      window.removeEventListener('open-player-edit-modal', handleOpen);
      window.removeEventListener('close-player-edit-modal', handleClose);
    };
  }, []);

  const closeModal = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      setInternalIsOpen(false);
      window.dispatchEvent(new CustomEvent('close-player-edit-modal'));
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    // Map IDs to state keys
    if (id === 'edit-player-gamertag') setFormData(prev => ({ ...prev, gamertag: value }));
    else if (id === 'edit-player-role') setFormData(prev => ({ ...prev, role: value }));
    else if (id === 'edit-player-secondary-role') setFormData(prev => ({ ...prev, secondaryRole: value }));
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

    const activeSave = propActiveSave || loadCareer();
    if (!activeSave) return;

    const playerIndex = activeSave.players.findIndex(p => String(p.id) === String(player.id));
    if (playerIndex === -1) return;

    // Create updated player object
    const updatedPlayer = { ...activeSave.players[playerIndex] };
    
    updatedPlayer.gamertag = formData.gamertag;
    updatedPlayer.name = formData.gamertag; // Keep name synced
    updatedPlayer.role = formData.role;
    updatedPlayer.secondaryRole = formData.secondaryRole || null;
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

    if (setActiveSave) {
        setActiveSave({ ...activeSave });
    }
    
    await saveCareer(activeSave);
    
    // Notify system of update
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: activeSave }));
    
    closeModal();
    
    // Trigger roster re-render if function exists
    if (typeof window.renderTeamRoster === 'function') {
      window.renderTeamRoster(activeSave);
    }
  };

  const isAttributeEditorEnabled = (propActiveSave || loadCareer())?.scripts?.['attribute-editor'];

  const statsList = [
    { key: 'aim', label: 'Aim', desc: 'Precision and accuracy in gunfights. Higher aim = more headshots and better spray control.' },
    { key: 'movement', label: 'Movement', desc: 'Jiggle peeking, counter-strafing, and positioning. Affects ability to dodge shots and get advantageous angles.' },
    { key: 'gameSense', label: 'Game Sense', desc: 'Strategic understanding of the game. Higher value means better rotations, timing, and reading enemy plays.' },
    { key: 'clutch', label: 'Clutch', desc: 'Performance in 1vX situations. High clutch players stay calm under pressure and win impossible rounds.' },
    { key: 'aggression', label: 'Aggression', desc: 'Tendency to take duels and push forward. Higher = more entry fragging and proactive plays.' },
    { key: 'utility', label: 'Utility', desc: 'Effective use of agent abilities, smokes, flashes, and mollies. Higher = better setups and support plays.' },
    { key: 'mental', label: 'Mental', desc: 'Tilt resistance and focus during long matches. High mental = consistent performance even when losing.' },
    { key: 'teamwork', label: 'Teamwork', desc: 'Communication and coordination with teammates. Higher = better trades, info sharing, and team plays.' },
    { key: 'consistency', label: 'Consistency', desc: 'Reliability match-to-match. High consistency means fewer performance drops and steady output.' },
    { key: 'potential', label: 'Potential', desc: 'Room for growth and development. Younger players with high potential can improve faster with training.' }
  ];

  const getRatingColor = (val) => {
    if (val >= 90) return '#ff4655';
    if (val >= 80) return '#c084fc';
    if (val >= 70) return '#60a5fa';
    if (val >= 60) return '#4ade80';
    return '#9ca3af';
  };

  return (
    <div 
      id="player-edit-modal" 
      className={`fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto transition-all duration-300 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
    >
      <div className="bg-[#0f1923] border border-[#ff4655]/30 rounded-xl max-w-4xl w-full shadow-[0_0_50px_rgba(255,70,85,0.2)] relative flex flex-col max-h-[90vh] overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff4655]/5 skew-x-[45deg] translate-x-32 translate-y-[-32px] pointer-events-none"></div>
        
        <div className="flex items-center justify-between p-8 border-b border-white/10 bg-black/40 relative z-10">
          <div className="flex items-center gap-6">
            <div className="bg-[#ff4655] w-1.5 h-10 shadow-[0_0_15px_rgba(255,70,85,0.5)]"></div>
            <div>
              <h3 className="text-3xl font-black text-white font-valorant tracking-[0.2em] uppercase">
                {isAttributeEditorEnabled ? 'Protocol Override' : 'Personnel Profile'}
              </h3>
              <p className="text-gray-500 text-[10px] font-black tracking-[0.3em] uppercase mt-1 opacity-60">
                {player?.name} // {player?.role}
              </p>
            </div>
          </div>
          <button 
            onClick={closeModal} 
            className="w-10 h-10 flex items-center justify-center rounded border border-white/10 text-gray-500 hover:text-white hover:border-[#ff4655] transition-all"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {!isAttributeEditorEnabled && (
          <div className="bg-[#ff4655]/10 border-b border-[#ff4655]/20 p-3 flex items-center justify-center gap-3 relative z-10">
            <i className="fa-solid fa-lock text-[#ff4655] animate-pulse"></i>
            <span className="text-[10px] font-black text-[#ff4655] uppercase tracking-[0.3em]">Read-Only Mode: Advanced Attribute Editor Script Required</span>
          </div>
        )}

        <div className="p-10 overflow-y-auto custom-scrollbar relative z-10">
          <form id="player-edit-form" className="space-y-12" onSubmit={handleSubmit}>
            <input type="hidden" id="edit-player-id" value={player?.id || ''} readOnly />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <div className="space-y-2">
                <label htmlFor="edit-player-gamertag" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Gamer Protocol</label>
                <input 
                  type="text" 
                  id="edit-player-gamertag" 
                  value={formData.gamertag}
                  onChange={handleInputChange}
                  disabled={!isAttributeEditorEnabled}
                  className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed font-black uppercase tracking-wider"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="edit-player-role" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Assigned Role</label>
                <div className="relative">
                  <select 
                    id="edit-player-role"
                    value={formData.role}
                    onChange={handleInputChange}
                    disabled={!isAttributeEditorEnabled}
                    className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed appearance-none font-black uppercase tracking-wider"
                  >
                    <option value="Duelist">Duelist</option>
                    <option value="Initiator">Initiator</option>
                    <option value="Controller">Controller</option>
                    <option value="Sentinel">Sentinel</option>
                    <option value="Flex">Flex</option>
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none text-xs"></i>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-player-secondary-role" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Secondary Role</label>
                <div className="relative">
                  <select 
                    id="edit-player-secondary-role"
                    value={formData.secondaryRole || ''}
                    onChange={handleInputChange}
                    disabled={!isAttributeEditorEnabled}
                    className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed appearance-none font-black uppercase tracking-wider"
                  >
                    <option value="">None</option>
                    <option value="Duelist">Duelist</option>
                    <option value="Initiator">Initiator</option>
                    <option value="Controller">Controller</option>
                    <option value="Sentinel">Sentinel</option>
                    <option value="Flex">Flex</option>
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none text-xs"></i>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-player-nationality" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Region Code</label>
                <input 
                  type="text" 
                  id="edit-player-nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  disabled={!isAttributeEditorEnabled}
                  className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed font-black uppercase tracking-wider"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-player-age" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Chronological Age</label>
                <input 
                  type="number" 
                  id="edit-player-age"
                  value={formData.age}
                  onChange={handleInputChange}
                  disabled={!isAttributeEditorEnabled}
                  className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed font-mono font-black"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-player-salary" className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Market Valuation ($)</label>
                <input 
                  type="number" 
                  id="edit-player-salary"
                  value={formData.salary}
                  onChange={handleInputChange}
                  disabled={!isAttributeEditorEnabled}
                  className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-green-400 focus:border-[#ff4655] focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed font-mono font-black"
                />
              </div>
            </div>

            <div className="border-t border-white/5 pt-12">
              <div className="flex items-center gap-5 mb-2">
                <h4 className="text-xl font-black text-white font-valorant tracking-[0.2em] uppercase">Attribute Tuning</h4>
                <div className="h-px flex-1 bg-gradient-to-r from-[#ff4655] to-transparent opacity-30"></div>
              </div>
              <p className="text-[11px] text-gray-500 mb-8 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff4655]"></span>
                Hover over attribute names to see what they affect
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
                {statsList.map(({ key, label, desc }) => (
                  <div key={key} className="space-y-4 group relative">
                    <div className="flex justify-between items-end">
                      <div className="relative">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] group-hover:text-white transition-colors cursor-help">{label}</label>
                        <div className="absolute left-0 -bottom-2 w-3 h-3 rounded-full bg-gray-600 group-hover:bg-[#ff4655] transition-colors"></div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#1a2332] border border-[#ff4655]/30 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-lg">
                          <div className="text-[11px] text-gray-300 leading-relaxed">{desc}</div>
                          <div className="absolute bottom-0 left-4 translate-y-1/2 w-2 h-2 bg-[#1a2332] border-r border-b border-[#ff4655]/30 rotate-45"></div>
                        </div>
                      </div>
                      <span className="text-2xl font-black font-mono leading-none" style={{ color: getRatingColor(formData.ratings[key]) }}>{formData.ratings[key]}</span>
                    </div>
                    <div className="relative flex items-center h-4">
                      <div className="absolute inset-0 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-500"
                          style={{ width: `${formData.ratings[key]}%`, backgroundColor: getRatingColor(formData.ratings[key]) }}
                        ></div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.ratings[key]}
                        onChange={(e) => handleStatChange(key, parseInt(e.target.value))}
                        disabled={!isAttributeEditorEnabled}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-6 pt-12 border-t border-white/5 mt-12">
              <button 
                type="button" 
                className="px-8 py-3 rounded border border-white/10 text-gray-400 font-black uppercase tracking-widest text-xs hover:bg-white/5 hover:text-white transition-all"
                onClick={closeModal}
              >
                Exit Protocol
              </button>
              
              {isAttributeEditorEnabled && (
                <button 
                  type="submit" 
                  className="px-10 py-3 bg-[#ff4655] text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-white transition-all shadow-[0_0_30px_rgba(255,70,85,0.4)]"
                >
                  Save Override
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlayerEditModal;
