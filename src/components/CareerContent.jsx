import React, { useEffect, useState, useMemo } from 'react';
import Inbox from './Inbox.jsx';
import SimWeekButton from './SimWeekButton.jsx'; // Import SimWeekButton
import PlayersHub from './PlayersHub.jsx';
import StatsHub from './StatsHub.jsx';
import ScriptsHub from './ScriptsHub.jsx';
import { teams, teamLogos } from '../teams.js';
import { Player, Team, MatchSimulator, ROLES } from '../simulation.js';
import { saveCareer, loadCareer, loadChampionshipPoints } from '../career_local_storage.jsx';
import { renderTeamRoster } from '../career.js';
import PlayerEditModal from './PlayerEditModal.jsx';

// Utility function to format numbers as currency
const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const BackButton = () => (
  <button 
    onClick={() => window.dispatchEvent(new CustomEvent('navigate-back'))}
    className="group relative flex items-center gap-4 pl-4 pr-8 py-2 overflow-hidden transition-all duration-300"
  >
    {/* Slanted Background */}
    <div className="absolute inset-0 bg-white/5 skew-x-[-15deg] group-hover:bg-[#ff4655]/10 transition-colors border border-white/10 group-hover:border-[#ff4655]/50"></div>
    
    <div className="relative z-10 flex items-center gap-3">
      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-white/10 group-hover:border-[#ff4655] transition-all group-hover:rotate-[-15deg]">
        <i className="fa-solid fa-chevron-left text-gray-400 group-hover:text-[#ff4655] text-xs transition-colors"></i>
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-black text-gray-500 group-hover:text-white uppercase tracking-[0.2em] transition-colors">Return</span>
        <span className="text-[12px] font-black text-white uppercase tracking-widest mt-0.5">Back</span>
      </div>
    </div>

    {/* Decorative Dots */}
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
      <div className="w-1 h-1 bg-white rounded-full"></div>
      <div className="w-1 h-1 bg-[#ff4655] rounded-full"></div>
    </div>
  </button>
);

const TeamDetailsView = ({ team, players, activeSave }) => {
  const [activeTab, setActiveTab] = useState('roster');

  // Trophies for team - computed before conditional return with null check inside
  const trophies = useMemo(() => {
    if (!team) return [];
    
    const teamTrophies = [];
    
    // Get kickoff trophies from players who won with this team
    players.forEach(player => {
      if (player.trophies && player.trophies.length > 0) {
        player.trophies.forEach(trophy => {
          if (trophy.team === team.name) {
            // Check if we already added this trophy
            const exists = teamTrophies.find(t => 
              t.tournament === `${trophy.region} ${trophy.type}` && 
              t.season === trophy.season
            );
            if (!exists) {
              teamTrophies.push({
                season: trophy.season,
                tournament: `${trophy.region} ${trophy.type}`,
                icon: trophy.type.includes('MVP') ? '🎖️' : '🏆',
                color: trophy.type.includes('MVP') ? 'text-[#ff4655]' : 'text-yellow-400'
              });
            }
          }
        });
      }
    });
    
    // Check season results for Champions wins
    if (activeSave?.seasonResults) {
      activeSave.seasonResults.forEach(season => {
        if (season.winner === team.name) {
          teamTrophies.push({
            season: season.season,
            tournament: 'VCT Champions',
            icon: '🏆',
            color: 'text-yellow-400'
          });
        }
      });
    }
    
    // Sort by season
    return teamTrophies.sort((a, b) => b.season - a.season);
  }, [activeSave, team?.name, players]);

  if (!team) return null;

  const getOverall = (p) => {
    if (p.overall) return Math.round(p.overall);
    if (p.rating) {
      const r = p.rating;
      const stats = [r.aim, r.movement, r.gameSense, r.clutch, r.aggression, r.utility, r.mental, r.teamwork, r.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      return Math.round(sum / 9);
    }
    return Math.round(p.skill || 0);
  };

  const getRatingColorClass = (val) => {
    if (val >= 90) return 'text-[#ff4655]';
    if (val >= 80) return 'text-purple-400';
    if (val >= 70) return 'text-blue-400';
    if (val >= 60) return 'text-green-400';
    return 'text-gray-400';
  };

  const sortedPlayers = [...players].sort((a, b) => getOverall(b) - getOverall(a));
  const starters = sortedPlayers.filter(p => p.isStarter || p.status === 'active').slice(0, 5);
  const subs = sortedPlayers.filter(p => !starters.find(s => s.id === p.id));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b1219] animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
      {/* Background Decor - Slanted lines/shapes typical of Valorant */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[120%] bg-[#ff4655]/5 skew-x-[-15deg]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[120%] bg-white/5 skew-x-[-15deg]"></div>
      </div>

      {/* Header */}
      <div className="p-10 border-b border-white/10 bg-black/40 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-12">
            <BackButton />
            
            <div className="relative group">
              <div className="absolute inset-0 bg-[#ff4655]/20 skew-x-[-15deg] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="w-32 h-32 bg-black/60 rounded border border-white/10 p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center relative skew-x-[-5deg]">
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#ff4655]/30 transition-colors skew-x-[0deg]"></div>
                <img 
                  src={teamLogos[team.name] || `assets/team_logos/${team.name.toLowerCase().replace(/ /g, '_')}.png`} 
                  alt={team.name} 
                  className="w-full h-full object-contain skew-x-[5deg]"
                  onError={(e) => e.target.src='assets/qmark.png'}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <div className="bg-[#ff4655] h-1 w-8"></div>
                  <div className="bg-white/20 h-1 w-4"></div>
                </div>
                <span className="text-gray-500 text-[11px] font-black tracking-[0.4em] uppercase opacity-80">{team.region} Professional League</span>
              </div>
              
              <div className="relative">
                <h2 className="text-7xl font-black text-white font-valorant tracking-widest uppercase leading-none mb-4 text-shadow">{team.name}</h2>
                <div className="absolute -bottom-2 left-0 w-full h-px bg-gradient-to-r from-[#ff4655] via-white/10 to-transparent"></div>
              </div>

              <div className="flex items-center gap-10 mt-6">
                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em]">Regional Power</span>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white font-mono leading-none">{team.power}</span>
                    <div className="h-1.5 w-12 bg-white/5 rounded-full overflow-hidden mb-1 border border-white/5">
                      <div className="h-full bg-white/40" style={{ width: `${team.power}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="w-px h-8 bg-white/10 skew-x-[-15deg]"></div>

                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em]">Active Roster</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[#ff4655] font-mono">{starters.length}</span>
                    <span className="text-gray-600 text-lg font-black">/ 5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-black/20 border-b border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex gap-8 px-10">
          <button 
            onClick={() => setActiveTab('roster')}
            className={`py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 ${activeTab === 'roster' ? 'text-[#ff4655] border-[#ff4655]' : 'text-gray-500 border-transparent hover:text-white'}`}
          >
            Tactical Roster
          </button>
          <button 
            onClick={() => setActiveTab('trophies')}
            className={`py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 ${activeTab === 'trophies' ? 'text-[#ff4655] border-[#ff4655]' : 'text-gray-500 border-transparent hover:text-white'}`}
          >
            Trophy Room ({trophies.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'roster' && (
            <>
              {/* Starting Lineup */}
              <section className="mb-16">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-5">
                    <h3 className="text-2xl font-black text-white font-valorant tracking-[0.2em] uppercase">Starting Lineup</h3>
                    <div className="h-[2px] w-20 bg-[#ff4655]"></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                  {starters.map((player, idx) => (
                    <div 
                      key={player.id} 
                      className="bg-white/[0.03] border border-white/5 hover:border-[#ff4655]/50 transition-all group cursor-pointer relative flex flex-col h-80 overflow-hidden"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: player.id } }))}
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      {/* Card Background Patterns */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4655]/5 skew-x-[45deg] translate-x-16 translate-y-[-16px] group-hover:bg-[#ff4655]/10 transition-colors"></div>
                      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="p-6 flex flex-col h-full relative z-10">
                        <div className="flex justify-between items-start mb-auto">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3 bg-[#ff4655]"></div>
                              <span className="text-[10px] font-black text-[#ff4655] uppercase tracking-[0.2em]">{player.role}</span>
                            </div>
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest opacity-60">{player.nationality}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-4xl font-black font-mono leading-none tracking-tighter ${getRatingColorClass(getOverall(player))}`}>{getOverall(player)}</span>
                            <div className="h-0.5 w-8 bg-white/10 mt-1"></div>
                          </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-white/5 group-hover:border-[#ff4655]/30 transition-colors">
                          <h4 className="text-2xl font-black text-white group-hover:text-[#ff4655] transition-all mb-1 uppercase tracking-tight leading-none group-hover:translate-x-1 duration-300">{player.name}</h4>
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] opacity-40 mt-2">Active Protocol</p>
                        </div>
                      </div>

                      {/* Corner Accent */}
                      <div className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                        <div className="w-12 h-12 bg-[#ff4655] rotate-45 translate-x-6 translate-y-6"></div>
                        <i className="fa-solid fa-arrow-right text-black text-[10px] relative z-10 translate-x-1 translate-y-1"></i>
                      </div>

                      {/* Hover Border Animation */}
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ff4655] scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reserves */}
              {subs.length > 0 && (
                <section className="pb-10">
                  <div className="flex items-center gap-5 mb-10 opacity-60">
                    <h3 className="text-xl font-black text-white font-valorant tracking-[0.2em] uppercase">Reserve Pool</h3>
                    <div className="h-[1px] flex-1 bg-white/10"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {subs.map((player, idx) => (
                      <div 
                        key={player.id} 
                        className="bg-white/[0.02] border border-white/5 p-5 hover:border-white/20 transition-all group cursor-pointer flex flex-col gap-4"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: player.id } }))}
                        style={{ animationDelay: `${(idx + 5) * 0.1}s` }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{player.role}</span>
                          <span className="text-xl font-black font-mono text-gray-500 group-hover:text-white transition-colors">{getOverall(player)}</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-400 group-hover:text-white transition-colors truncate uppercase">{player.name}</h4>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'trophies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {trophies.length > 0 ? trophies.map((trophy, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 p-8 flex flex-col items-center text-center group hover:border-yellow-500/30 transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 skew-x-[45deg] translate-x-8 translate-y-[-8px]"></div>
                  <span className={`text-6xl mb-6 group-hover:scale-110 transition-transform duration-500 ${trophy.color}`}>{trophy.icon}</span>
                  <h4 className="text-xl font-black text-white uppercase tracking-widest mb-2">{trophy.tournament}</h4>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Season {trophy.season}</p>
                </div>
              )) : (
                <div className="col-span-full py-20 flex flex-col items-center opacity-30">
                  <i className="fa-solid fa-trophy text-6xl mb-6"></i>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Major Trophies Collected</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlayerDetailsView = ({ player, activeSave, setActiveSave }) => {
  const [activeTab, setActiveTab] = useState('attributes');

  // Player trophies - computed before conditional return with null check inside
  const trophies = useMemo(() => {
    if (!player) return [];
    
    const playerTrophies = [];
    
    // Add kickoff trophies from player.trophies array
    if (player.trophies && player.trophies.length > 0) {
      player.trophies.forEach(trophy => {
        const isMVP = trophy.type.includes('MVP');
        const isRegional = trophy.type.includes('Regional');
        playerTrophies.push({
          season: trophy.season,
          tournament: isRegional ? `${trophy.region} ${trophy.type}` : `${trophy.region} ${trophy.type}`,
          team: trophy.team,
          icon: isMVP ? '🎖️' : '🏆',
          color: isMVP ? 'text-[#ff4655]' : 'text-yellow-400',
          isMVP: isMVP,
          isRegional: isRegional,
          stats: trophy.stats
        });
      });
    }
    
    // Add season results trophies if available
    if (activeSave?.seasonResults) {
      activeSave.seasonResults.forEach(season => {
        // If team won, player won
        if (season.winner === player.team) {
          playerTrophies.push({
            season: season.season,
            tournament: 'VCT Champions',
            icon: '🏆',
            color: 'text-yellow-400'
          });
        }
        // Check individual awards
        if (season.awards?.mvp === player.id) {
          playerTrophies.push({
            season: season.season,
            tournament: 'Season MVP',
            icon: '🎖️',
            color: 'text-[#ff4655]'
          });
        }
      });
    }
    return playerTrophies;
  }, [activeSave, player?.id, player?.team, player?.trophies]);

  if (!player) return null;

  const ratings = player.rating || {};
  const statsList = [
    { key: 'aim', label: 'Aim', icon: '🎯', desc: 'Precision and accuracy in gunfights. Higher aim = more headshots and better spray control.' },
    { key: 'movement', label: 'Movement', icon: '👟', desc: 'Jiggle peeking, counter-strafing, and positioning. Affects ability to dodge shots and get advantageous angles.' },
    { key: 'gameSense', label: 'Game Sense', icon: '🧠', desc: 'Strategic understanding of the game. Higher value means better rotations, timing, and reading enemy plays.' },
    { key: 'clutch', label: 'Clutch', icon: '🔥', desc: 'Performance in 1vX situations. High clutch players stay calm under pressure and win impossible rounds.' },
    { key: 'aggression', label: 'Aggression', icon: '💢', desc: 'Tendency to take duels and push forward. Higher = more entry fragging and proactive plays.' },
    { key: 'utility', label: 'Utility', icon: '⚡', desc: 'Effective use of agent abilities, smokes, flashes, and mollies. Higher = better setups and support plays.' },
    { key: 'mental', label: 'Mental', icon: '🧘', desc: 'Tilt resistance and focus during long matches. High mental = consistent performance even when losing.' },
    { key: 'teamwork', label: 'Teamwork', icon: '🤝', desc: 'Communication and coordination with teammates. Higher = better trades, info sharing, and team plays.' },
    { key: 'consistency', label: 'Consistency', icon: '📈', desc: 'Reliability match-to-match. High consistency means fewer performance drops and steady output.' },
    { key: 'potential', label: 'Potential', icon: '💎', desc: 'Room for growth and development. Younger players with high potential can improve faster with training.' }
  ];

  const getOverall = () => {
    if (player.overall) return Math.round(player.overall);
    const stats = [ratings.aim, ratings.movement, ratings.gameSense, ratings.clutch, ratings.aggression, ratings.utility, ratings.mental, ratings.teamwork, ratings.consistency];
    const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
    return Math.round(sum / 9);
  };

  const getRatingColor = (val) => {
    if (val >= 90) return '#ff4655';
    if (val >= 80) return '#c084fc';
    if (val >= 70) return '#60a5fa';
    if (val >= 60) return '#4ade80';
    return '#9ca3af';
  };

  const overall = getOverall();
  const isAttributeEditorEnabled = activeSave?.scripts?.['attribute-editor'];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b1219] animate-in fade-in zoom-in-95 duration-500 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#ff4655]/5 to-transparent pointer-events-none"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[140%] border border-white/5 skew-x-[-20deg] pointer-events-none"></div>
      
      {/* Header */}
      <div className="p-10 border-b border-white/10 z-10 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-12">
            <BackButton />
            
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <div className="bg-[#ff4655] h-1 w-8"></div>
                  <div className="bg-white/20 h-1 w-4"></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#ff4655] text-[11px] font-black tracking-[0.4em] uppercase">{player.role} Protocol</span>
                  <span className="text-gray-500 text-[11px] font-black tracking-[0.4em] uppercase opacity-40">// {player.nationality}</span>
                </div>
              </div>
              
              <div className="relative">
                <h2 className="text-5xl font-black text-white font-valorant tracking-wide uppercase leading-none text-shadow truncate max-w-3xl">{player.name}</h2>
                <div className="absolute -bottom-2 left-0 w-full h-px bg-gradient-to-r from-[#ff4655] via-white/10 to-transparent"></div>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-8">
            <div className="relative">
              <p className="text-gray-500 text-[10px] font-black tracking-[0.4em] uppercase mb-2 opacity-60 text-right">Performance Index</p>
              <div className="flex items-center gap-6 justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <div className="h-1 w-12 bg-white/10"></div>
                  <div className="h-1 w-8 bg-white/5"></div>
                </div>
                <span className="text-9xl font-black font-mono leading-none tracking-tighter text-shadow" style={{ color: getRatingColor(overall) }}>{overall}</span>
              </div>
            </div>
            
            {isAttributeEditorEnabled && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-player-edit-modal', { detail: { playerId: player.id } }))}
                className="group relative flex items-center gap-4 px-8 py-3 overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-[#ff4655] skew-x-[-15deg] group-hover:bg-white transition-colors shadow-[0_0_30px_rgba(255,70,85,0.3)]"></div>
                <div className="relative z-10 flex items-center gap-3 text-black">
                  <i className="fa-solid fa-pen-nib group-hover:rotate-12 transition-transform"></i>
                  <span className="font-black uppercase tracking-[0.2em] text-xs">Modify Attributes</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-black/20 border-b border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex gap-8 px-10">
          <button 
            onClick={() => setActiveTab('attributes')}
            className={`py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 ${activeTab === 'attributes' ? 'text-[#ff4655] border-[#ff4655]' : 'text-gray-500 border-transparent hover:text-white'}`}
          >
            Technical Performance
          </button>
          <button 
            onClick={() => setActiveTab('trophies')}
            className={`py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 ${activeTab === 'trophies' ? 'text-[#ff4655] border-[#ff4655]' : 'text-gray-500 border-transparent hover:text-white'}`}
          >
            Honors & Trophies ({trophies.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar z-10">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'attributes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
              <>
                {/* Left Column: Stats */}
                <div className="lg:col-span-2">
                <div className="flex items-center gap-5 mb-2">
                  <h3 className="text-2xl font-black text-white font-valorant tracking-[0.2em] uppercase">Technical Performance</h3>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-[#ff4655] to-transparent"></div>
                </div>
                <p className="text-[11px] text-gray-500 mb-10 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#ff4655]"></span>
                  Hover over attribute names to see what they affect
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {statsList.map(({ key, label, icon, desc }) => {
                    const value = ratings[key] || 50;
                    return (
                      <div key={key} className="group relative">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg group-hover:bg-[#ff4655]/20 transition-colors cursor-help">
                            {icon}
                          </div>
                          <div className="flex-1 cursor-help">
                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Attribute</p>
                            <p className="text-[11px] font-black text-white uppercase tracking-wide group-hover:text-[#ff4655] transition-colors">{label}</p>
                            {/* Tooltip */}
                            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-[#1a2332] border border-[#ff4655]/30 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-lg">
                              <div className="text-[11px] text-gray-300 leading-relaxed">{desc}</div>
                              <div className="absolute -top-1 left-6 w-2 h-2 bg-[#1a2332] border-t border-l border-[#ff4655]/30 rotate-45"></div>
                            </div>
                          </div>
                          <span className="text-xl font-black font-mono" style={{ color: getRatingColor(value) }}>{value}</span>
                        </div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden p-[1.5px] border border-white/5 relative">
                          <div 
                            className="h-full transition-all duration-1000 ease-out relative rounded-full"
                            style={{ 
                              width: `${value}%`,
                              backgroundColor: getRatingColor(value),
                              boxShadow: `0 0 15px ${getRatingColor(value)}40`
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                          </div>
                          <div className="h-0.5 w-4 bg-white/10 mt-1"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Bio & Info */}
              <div className="space-y-10">
                <div className="bg-black/40 border border-white/10 rounded p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 skew-x-[45deg] translate-x-10 translate-y-[-10px]"></div>
                  <h3 className="text-lg font-black text-[#ff4655] font-valorant tracking-[0.2em] uppercase mb-8">Personnel Data</h3>
                  <div className="space-y-8">
                    <div className="flex flex-col gap-1">
                  <p className="text-gray-500 text-[9px] font-black tracking-[0.2em] uppercase">Tactical Role</p>
                  <p className="text-2xl font-black text-white uppercase tracking-wide">{player.role}</p>
                  {player.secondaryRole && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">
                      Secondary: <span className="text-[#ff4655]">{player.secondaryRole}</span>
                      <br />
                      <span className="opacity-40 italic font-normal">* Operates at lower proficiency level</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-gray-500 text-[9px] font-black tracking-[0.2em] uppercase">Market Valuation</p>
                      <p className="text-2xl font-black text-green-400 font-mono">${(player.marketValue || 50000).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                  <p className="text-gray-500 text-[9px] font-black tracking-[0.2em] uppercase">Age Protocol</p>
                  <p className="text-2xl font-black text-white font-mono">{player.age || 18}Y</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-gray-500 text-[9px] font-black tracking-[0.2em] uppercase">Role Proficiencies</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {player.roleProficiencies?.map(role => (
                      <span key={role} className="text-[8px] font-black text-[#ff4655] border border-[#ff4655]/30 px-2 py-0.5 rounded uppercase tracking-tighter bg-[#ff4655]/5">
                        {role}
                      </span>
                    )) || <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter">Initial Training</span>}
                  </div>
                </div>
              </div>
            </div>

                <div className="border border-white/5 p-8 relative group bg-white/[0.02]">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4655]"></div>
                  <h3 className="text-lg font-black text-white font-valorant tracking-[0.2em] uppercase mb-5">Analyst Report</h3>
                  <p className="text-gray-400 text-xs leading-relaxed font-medium uppercase tracking-wider">
                    {player.name} is currently assigned as a {player.role}. 
                    Core metrics indicate a focus on {Object.entries(ratings).sort((a,b) => b[1]-a[1])[0][0]} mechanics.
                    Projected to be a {overall >= 80 ? "franchise cornerstone" : overall >= 70 ? "valuable starter" : "developing asset"} for the upcoming season.
                  </p>
                </div>
              </div>
            </>
            </div>
          )}

          {activeTab === 'trophies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {trophies.length > 0 ? trophies.map((trophy, idx) => (
                <div key={idx} className={`bg-white/[0.03] border ${trophy.isMVP ? 'border-[#ff4655]/30 hover:border-[#ff4655]/60' : 'border-white/5 hover:border-yellow-500/30'} p-8 flex flex-col items-center text-center group transition-all relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-16 h-16 skew-x-[45deg] translate-x-8 translate-y-[-8px] ${trophy.isMVP ? 'bg-[#ff4655]/10' : 'bg-yellow-500/5'}`}></div>
                  <span className={`text-6xl mb-6 group-hover:scale-110 transition-transform duration-500 ${trophy.color}`}>{trophy.icon}</span>
                  <h4 className="text-xl font-black text-white uppercase tracking-widest mb-2">{trophy.tournament}</h4>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Season {trophy.season}</p>
                  {trophy.team && (
                    <p className="text-[#ff4655] text-[9px] font-bold uppercase tracking-wider mt-2">with {trophy.team}</p>
                  )}
                  {trophy.isMVP && trophy.stats && (
                    <div className="mt-4 pt-4 border-t border-white/10 w-full">
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-wider mb-2">Tournament Stats</p>
                      <div className="flex justify-center gap-3 text-[10px]">
                        <span className="text-white font-mono">{trophy.stats.kills}<span className="text-gray-600 text-[7px]">K</span></span>
                        <span className="text-gray-600">/</span>
                        <span className="text-white font-mono">{trophy.stats.deaths}<span className="text-gray-600 text-[7px]">D</span></span>
                        <span className="text-gray-600">/</span>
                        <span className="text-white font-mono">{trophy.stats.kd}<span className="text-gray-600 text-[7px]">K/D</span></span>
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="col-span-full py-20 flex flex-col items-center opacity-30">
                  <i className="fa-solid fa-trophy text-6xl mb-6"></i>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Individual or Team Honors</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MyTeamManagement = ({ activeSave, setActiveSave }) => {
  if (!activeSave) return null;

  const getOverall = (p) => {
    if (p.overall) return Math.round(p.overall);
    if (p.rating) {
      const r = p.rating;
      const stats = [r.aim, r.movement, r.gameSense, r.clutch, r.aggression, r.utility, r.mental, r.teamwork, r.consistency];
      const sum = stats.reduce((acc, val) => acc + (val || 50), 0);
      return Math.round(sum / 9);
    }
    return Math.round(p.skill || 0);
  };

  const getRatingColorClass = (val) => {
    if (val >= 90) return 'text-[#ff4655]';
    if (val >= 80) return 'text-purple-400';
    if (val >= 70) return 'text-blue-400';
    if (val >= 60) return 'text-green-400';
    return 'text-gray-400';
  };

  const myPlayers = activeSave.players.filter(p => {
    const activeTeamId = activeSave.teamId ? String(activeSave.teamId) : null;
    const playerTeamId = p.teamId ? String(p.teamId) : null;
    return activeTeamId === playerTeamId || p.team === activeSave.team;
  });

  const sortedPlayers = [...myPlayers].sort((a, b) => getOverall(b) - getOverall(a));
  const starters = sortedPlayers.filter(p => p.isStarter === true).slice(0, 5);
  const subs = sortedPlayers.filter(p => !starters.find(s => s.id === p.id));

  const isAttributeEditorEnabled = activeSave?.scripts?.['attribute-editor'];

  const handleToggleStatus = (playerId) => {
    const updatedSave = { ...activeSave };
    const player = updatedSave.players.find(p => String(p.id) === String(playerId));
    if (!player) return;

    if (!player.isStarter && starters.length >= 5) {
      alert("Active roster is full (5/5). Bench a starter first.");
      return;
    }

    player.isStarter = !player.isStarter;
    player.status = player.isStarter ? 'active' : 'bench';
    
    setActiveSave(updatedSave);
    saveCareer(updatedSave);
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
  };

  const handleSetIGL = (playerId) => {
    const updatedSave = { ...activeSave };
    updatedSave.players.forEach(p => {
      if (String(p.teamId) === String(activeSave.teamId) || p.team === activeSave.team) {
        p.isIGL = (String(p.id) === String(playerId));
      }
    });
    
    setActiveSave(updatedSave);
    saveCareer(updatedSave);
    window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
  };

  const handleRelease = (playerId) => {
    if (window.confirm("Are you sure you want to release this player? They will become a Free Agent.")) {
      const updatedSave = { ...activeSave };
      const player = updatedSave.players.find(p => String(p.id) === String(playerId));
      if (player) {
        player.teamId = null;
        player.team = null;
        player.isStarter = false;
        player.status = 'free_agent';
        player.isIGL = false;
        
        setActiveSave(updatedSave);
        saveCareer(updatedSave);
        window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Player Released' } }));
        window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      }
    }
  };

  const handleChangeRole = (playerId, newRole) => {
    const updatedSave = { ...activeSave };
    const player = updatedSave.players.find(p => String(p.id) === String(playerId));
    if (player && player.role !== newRole) {
      const isProficient = player.roleProficiencies?.includes(newRole);
      const isSecondaryRole = player.secondaryRole === newRole;
      
      if (isProficient || isSecondaryRole) {
        // No penalty for proficient roles or secondary role
        player.role = newRole;
        setActiveSave(updatedSave);
        saveCareer(updatedSave);
        window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Role Updated' } }));
        window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
      } else {
        if (window.confirm(`${player.name} is not proficient as a ${newRole}. Changing roles will apply a -5 rating penalty due to role unfamiliarity. However, they will gain proficiency after playing this role for 4-6 weeks. Proceed?`)) {
          player.role = newRole;
          if (player.rating) {
            const stats = ['aim', 'movement', 'gameSense', 'clutch', 'aggression', 'utility', 'mental', 'teamwork', 'consistency'];
            stats.forEach(stat => {
              if (player.rating[stat]) player.rating[stat] = Math.max(0, player.rating[stat] - 5);
            });
            player.skill = Math.max(0, (player.skill || 50) - 5);
          }
          
          setActiveSave(updatedSave);
          saveCareer(updatedSave);
          window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Role Updated' } }));
          window.dispatchEvent(new CustomEvent('careerUpdate', { detail: updatedSave }));
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b1219] animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#ff4655]/5 skew-x-[-15deg]"></div>
      </div>

      {/* Header */}
      <div className="p-10 border-b border-white/10 bg-black/40 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="w-24 h-24 bg-black/60 rounded border border-white/10 p-4 shadow-2xl flex items-center justify-center relative skew-x-[-5deg]">
              {(() => {
                const logoPath = teamLogos[activeSave.team] || `assets/team_logos/${activeSave.team?.toLowerCase().replace(/ /g, '_')}.png`;
                console.log('Team logo debug:', { team: activeSave.team, logoPath, teamLogosKey: teamLogos[activeSave.team] });
                return (
                  <img 
                    src={logoPath} 
                    alt={activeSave.team} 
                    className="w-full h-full object-contain skew-x-[5deg]"
                    onError={(e) => {
                      console.error('Logo failed to load:', e.target.src);
                      e.target.src='assets/qmark.png';
                    }}
                  />
                );
              })()}
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-[#ff4655] h-5 w-1 shadow-[0_0_10px_#ff4655]"></div>
                <span className="text-gray-500 text-[10px] font-black tracking-[0.4em] uppercase">Organization Command</span>
              </div>
              <h2 className="text-6xl font-black text-white font-valorant tracking-wider uppercase leading-none mb-2 text-shadow">{activeSave.team}</h2>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Budget:</span>
                  <span className="text-green-400 font-mono font-black">${(activeSave?.budget || 0).toLocaleString()}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Roster Size:</span>
                  <span className="text-white font-mono font-black">{myPlayers.length}/7</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Week {activeSave.week} // Season {activeSave.season}
            </div>
          </div>
        </div>
      </div>

      {/* Roster Sections */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Main Roster */}
          <section>
            <div className="flex items-center gap-6 mb-10">
              <h3 className="text-2xl font-black text-white font-valorant tracking-[0.2em] uppercase">Tactical Lineup</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-[#ff4655] to-transparent opacity-30"></div>
              <span className="text-[10px] font-black text-[#ff4655] uppercase tracking-widest">{starters.length}/5 Active</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {starters.map((player, idx) => (
                <div 
                  key={player.id} 
                  className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/15 hover:border-[#ff4655]/60 hover:shadow-[0_0_20px_rgba(255,70,85,0.2)] transition-all group relative flex flex-col p-2.5 min-h-[220px] rounded"
                >
                  <div className="absolute top-0 right-0 w-10 h-10 bg-[#ff4655]/15 skew-x-[45deg] translate-x-5 translate-y-[-5px]"></div>
                  
                  <div className="flex justify-between items-start gap-2 mb-2 relative z-10">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <select 
                          value={player.role} 
                          onChange={(e) => handleChangeRole(player.id, e.target.value)}
                          className="bg-black/60 border border-white/20 text-[10px] font-black text-[#ff4655] uppercase tracking-wide px-1.5 py-1 rounded focus:outline-none focus:border-[#ff4655] transition-all cursor-pointer w-full truncate shadow-inner"
                        >
                          {['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'].map(role => (
                            <option key={role} value={role}>{role}{player.roleProficiencies?.includes(role) ? ' (P)' : ''}</option>
                          ))}
                        </select>
                        
                        {/* Role Mastery Progress */}
                        {!player.roleProficiencies?.includes(player.role) && (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[7px] font-black text-gray-400 uppercase tracking-wider">Learning</span>
                              <span className="text-[7px] font-bold font-mono text-gray-300">{player.roleExperience?.[player.role] || 0}%</span>
                            </div>
                            <div className="h-1 bg-white/15 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#ff4655] to-[#ff6b7a]" 
                                style={{ width: `${player.roleExperience?.[player.role] || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {player.isIGL && (
                            <div className="flex items-center gap-1 bg-yellow-500/20 px-1.5 py-0.5 rounded">
                              <div className="w-1 h-1 rounded-full bg-yellow-400"></div>
                              <span className="text-[7px] font-black text-yellow-400 uppercase">IGL</span>
                            </div>
                          )}
                          {player.secondaryRole && (
                            <div className="flex items-center gap-1 bg-blue-400/20 px-1.5 py-0.5 rounded">
                              <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                              <span className="text-[7px] font-black text-blue-400 uppercase">{player.secondaryRole}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right relative">
                        <span className={`text-lg font-black font-mono leading-none block ${getRatingColorClass(getOverall(player))}`}>{getOverall(player)}</span>
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider cursor-help peer">OVR</span>
                        {/* OVR Tooltip - only appears when hovering over OVR text */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-[#1a2332] border border-[#ff4655]/30 rounded-lg opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-300 z-20 shadow-lg pointer-events-none">
                          <div className="text-[10px] text-gray-300 leading-relaxed">Overall rating based on all attributes (Aim, Movement, Game Sense, etc.). Higher = better player performance.</div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a2332] border-b border-r border-[#ff4655]/30 rotate-45"></div>
                        </div>
                      </div>
                  </div>

                  <div className="mb-2 relative z-10">
                    <h4 
                      className="text-base font-black text-white group-hover:text-[#ff6b7a] transition-colors cursor-pointer uppercase tracking-tight truncate drop-shadow-sm"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: player.id } }))}
                    >
                      {player.name}
                    </h4>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{player.nationality}</span>
                  </div>

                  <div className="flex flex-col gap-1 mt-auto relative z-10">
                    <div className="grid grid-cols-2 gap-1">
                      <button 
                        onClick={() => handleToggleStatus(player.id)}
                        className="py-1 px-1 bg-white/10 hover:bg-white/20 border border-white/15 text-[8px] font-bold text-gray-300 hover:text-white uppercase tracking-wider transition-all rounded"
                      >
                        Bench
                      </button>
                      <button 
                        onClick={() => handleSetIGL(player.id)}
                        className={`py-1 px-1 border text-[8px] font-bold uppercase tracking-wider transition-all rounded ${player.isIGL ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-white/10 border-white/15 text-gray-400 hover:text-white'}`}
                      >
                        {player.isIGL ? 'Leader' : 'Set IGL'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-player-edit-modal', { detail: { playerId: player.id } }))}
                        className={`py-1 px-1 border text-[8px] font-bold uppercase tracking-wider transition-all rounded ${isAttributeEditorEnabled ? 'bg-[#ff4655]/20 border-[#ff4655]/50 text-[#ff6b7a] hover:bg-[#ff4655] hover:text-black' : 'bg-white/10 border-white/15 text-gray-500'}`}
                        title={!isAttributeEditorEnabled ? "Requires Advanced Attribute Editor Script" : ""}
                      >
                        {isAttributeEditorEnabled ? 'Override' : 'Locked'}
                      </button>
                      <button 
                        onClick={() => handleRelease(player.id)}
                        className="py-1 px-1 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-[8px] font-bold text-red-400 uppercase tracking-wider transition-all rounded"
                      >
                        Release
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Substitutes */}
          {subs.length > 0 && (
            <section className="pb-10">
              <div className="flex items-center gap-6 mb-10 opacity-50">
                <h3 className="text-xl font-black text-white font-valorant tracking-[0.2em] uppercase">Reserve Pool</h3>
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{subs.length} Inactive</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {subs.map((player, idx) => (
                  <div 
                    key={player.id} 
                    className="bg-white/[0.01] border border-white/5 hover:border-white/20 transition-all group relative flex flex-col p-4 min-h-[200px]"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider">{player.role}</span>
                      <span className="text-lg font-black font-mono text-gray-500 group-hover:text-white transition-colors">{getOverall(player)}</span>
                    </div>
                    <h4 
                      className="text-base font-black text-gray-400 group-hover:text-white transition-colors cursor-pointer uppercase truncate mb-3"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: player.id } }))}
                    >
                      {player.name}
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 mt-auto">
                      <button 
                        onClick={() => handleToggleStatus(player.id)}
                        className="py-1.5 px-2 bg-white/5 hover:bg-[#ff4655] border border-white/5 hover:border-[#ff4655] text-[8px] font-black text-gray-500 hover:text-black uppercase tracking-wider transition-all rounded"
                      >
                        Promote
                      </button>
                      <button 
                        onClick={() => handleRelease(player.id)}
                        className="py-1.5 px-2 bg-red-500/5 hover:bg-red-500 border border-red-500/10 hover:border-red-500 text-[8px] font-black text-red-400 hover:text-white uppercase tracking-wider transition-all rounded"
                      >
                        Release
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const CareerContent = ({ activeSection, activeSave, setActiveSave, selectedTeamName, selectedPlayerId: propSelectedPlayerId, onChangeSection }) => {
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [activeLeagueTab, setActiveLeagueTab] = useState('news');
  const [leagueTickerItems, setLeagueTickerItems] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [saveIndicator, setSaveIndicator] = useState({ show: false, message: '' });

  // Save indicator handler
  const showSaveIndicator = (message = 'Game Saved') => {
    setSaveIndicator({ show: true, message });
    setTimeout(() => {
      setSaveIndicator({ show: false, message: '' });
    }, 2000);
  };
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
      const playerTeamId = String(activeSave.teamId);
      if (activeSave.strategies[playerTeamId]) {
        setTeamStrategy(activeSave.strategies[playerTeamId]);
      } else if (activeSave.strategies.playstyle) {
        // Fallback for old saves
        setTeamStrategy(activeSave.strategies);
      }
    }
  }, [activeSave?.id, activeSave?.teamId]);

  const updateStrategy = (key, value) => {
    const newStrategy = { ...teamStrategy, [key]: value };
    setTeamStrategy(newStrategy);
    
    // Persist to activeSave
    const playerTeamId = String(activeSave.teamId);
    const updatedStrategies = (activeSave.strategies && !activeSave.strategies.playstyle) 
      ? { ...activeSave.strategies, [playerTeamId]: newStrategy }
      : { [playerTeamId]: newStrategy }; // If old format, convert to new format
    
    const updatedSave = {
      ...activeSave,
      strategies: updatedStrategies
    };
    setActiveSave(updatedSave);
    saveCareer(updatedSave);
    
    // Trigger save indicator
    window.dispatchEvent(new CustomEvent('showSaveIndicator', { detail: { message: 'Strategy Saved' } }));
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

    const handleSaveIndicator = (event) => {
      const message = event.detail?.message || 'Game Saved';
      showSaveIndicator(message);
    };

    window.addEventListener('careerUpdate', handleCareerUpdate);
    window.addEventListener('message', handleCareerUpdate);
    window.addEventListener('showSaveIndicator', handleSaveIndicator);
    
    return () => {
      window.removeEventListener('careerUpdate', handleCareerUpdate);
      window.removeEventListener('message', handleCareerUpdate);
      window.removeEventListener('showSaveIndicator', handleSaveIndicator);
    };
  }, [setActiveSave]);

  useEffect(() => {
    if (activeSave && activeSave.inbox && activeSave.inbox.length > 0) {
      setSelectedMessage(activeSave.inbox[0]);
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

    if (activeSection === 'masters-tokyo') {
      const iframe = document.getElementById('masters-tokyo-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('rerenderMastersTokyo', window.location.origin);
      }
    }

    if (activeSection === 'champions') {
      const iframe = document.getElementById('champions-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('rerenderChampions', window.location.origin);
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
      {/* Save Indicator Overlay */}
      {saveIndicator.show && (
        <div 
          className="fixed top-4 right-4 z-[9999] animate-in fade-in slide-in-from-right duration-300"
          style={{
            background: 'linear-gradient(135deg, #00c853 0%, #00e676 100%)',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 200, 83, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#000',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{saveIndicator.message}</span>
        </div>
      )}
      
      {activeSection === 'career-dashboard' && (
        <div id="career-dashboard" className="content-section">
          <div className="office-header">
            <h2>My Office</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 27 ? 'Tokyo Swiss' : activeSave?.week <= 32 ? 'Masters Tokyo' : activeSave?.week === 33 ? 'Break Week' : activeSave?.week <= 35 ? 'Champions Prep' : activeSave?.week <= 43 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
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
                
                {/* DEBUG / TIME TRAVEL BUTTON - Jump to Week 19 (before Masters Tokyo) */}
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
                    if (window.confirm("Jump to Week 19? This will reset Masters Tokyo and later progress.")) {
                      const updatedSave = { ...activeSave };
                      updatedSave.week = 19;
                      
                      // Reset Masters Tokyo and Champions state so they can be regenerated fresh
                      if (updatedSave.mastersTokyoState) {
                          updatedSave.mastersTokyoState = null;
                      }
                      if (updatedSave.championsState) {
                          updatedSave.championsState = null;
                      }
                      // Also reset regional playoffs state if needed
                      if (updatedSave.regularSeason) {
                          updatedSave.regularSeason = null;
                      }
                      
                      setActiveSave(updatedSave);
                      saveCareer(updatedSave);
                      window.location.reload(); // Reload to ensure all states refresh correctly
                    }
                  }}
                >
                  Jump to Week 19
                </button>
                
                {/* DEBUG / TIME TRAVEL BUTTON - Jump to Week 23 (Grand Finals of Regionals) */}
                <button 
                  style={{
                    fontSize: '10px', 
                    padding: '2px 5px', 
                    background: '#553c15', 
                    color: '#faf089', 
                    border: '1px solid #FFD700',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (window.confirm("Jump to Week 23? This is Regional Playoffs Grand Finals week. Masters Tokyo will start next week.")) {
                      const updatedSave = { ...activeSave };
                      updatedSave.week = 23;
                      
                      // Reset Masters Tokyo and Champions state so they can be regenerated fresh
                      if (updatedSave.mastersTokyoState) {
                          updatedSave.mastersTokyoState = null;
                      }
                      if (updatedSave.championsState) {
                          updatedSave.championsState = null;
                      }
                      
                      setActiveSave(updatedSave);
                      saveCareer(updatedSave);
                      window.location.reload();
                    }
                  }}
                >
                  Jump to Week 23 (Grand Finals)
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
                      {selectedMessage.subject?.includes('NEW PLAYER SIGNED') ? (
                        // Enhanced Player Signing Display
                        <div className="signing-container">
                          {/* Confetti */}
                          <div className="signing-confetti">
                            {[...Array(20)].map((_, i) => (
                              <div key={i} className="sc-confetti-piece" style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                backgroundColor: ['#ff4655', '#ffd700', '#00d4ff', '#ff6b7a'][Math.floor(Math.random() * 4)]
                              }} />
                            ))}
                          </div>

                          {/* Main Card */}
                          <div className="signing-card">
                            {/* Header */}
                            <div className="sc-header">
                              <div className="sc-header-icon">🎉</div>
                              <h2 className="sc-title">NEW RECRUIT</h2>
                              <div className="sc-header-line"></div>
                            </div>

                            {/* Avatar */}
                            <div className="sc-avatar-wrap">
                              <div className="sc-avatar">
                                {selectedMessage.playerData?.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="sc-role">
                                {selectedMessage.playerData?.role || 'FLEX'}
                              </div>
                            </div>

                            {/* Player Name */}
                            <h3 className="sc-player-name">
                              {selectedMessage.playerData?.name || 'Unknown Player'}
                            </h3>
                            <p className="sc-handle">
                              @{selectedMessage.playerData?.nickname || selectedMessage.playerData?.name?.toLowerCase().replace(/\s/g, '') || 'player'}
                            </p>

                            {/* Stats */}
                            <div className="sc-stats">
                              <div className="sc-stat">
                                <span className="sc-stat-num">{selectedMessage.playerData?.overall || '??'}</span>
                                <span className="sc-stat-label">OVR</span>
                              </div>
                              <div className="sc-stat-divider"></div>
                              <div className="sc-stat">
                                <span className="sc-stat-num">{selectedMessage.playerData?.acs || '??'}</span>
                                <span className="sc-stat-label">ACS</span>
                              </div>
                              <div className="sc-stat-divider"></div>
                              <div className="sc-stat">
                                <span className="sc-stat-num">${(selectedMessage.playerData?.salary || selectedMessage.playerData?.marketValue || 0).toLocaleString()}</span>
                                <span className="sc-stat-label">SALARY</span>
                              </div>
                            </div>

                            {/* Message */}
                            <p className="sc-message">
                              Welcome to the team! {selectedMessage.playerData?.name} joins as a {selectedMessage.body?.includes('substitute') ? 'substitute' : 'starter'}.
                            </p>

                            {/* Button */}
                            <div className="sc-buttons">
                              <button
                                className="sc-btn-primary"
                                onClick={() => onChangeSection && onChangeSection('career-manage-team')}
                              >
                                View Team
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Standard Message Display
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
                      )}
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
                                    <div 
                                      className="cursor-pointer group flex flex-col items-center"
                                      onClick={() => window.dispatchEvent(new CustomEvent('open-team-modal', { detail: { teamName: upcomingMatch.opponent.name } }))}
                                    >
                                      <div className="team-logo-small group-hover:scale-110 transition-transform">
                                        <img 
                                            src={`assets/team_logos/${upcomingMatch.opponent.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_')}.png`} 
                                            alt={upcomingMatch.opponent.name}
                                            onError={(e) => e.target.src='assets/qmark.png'}
                                        />
                                      </div>
                                      <span className="team-name group-hover:text-[#ff4655] transition-colors">{upcomingMatch.opponent.name.substring(0, 3).toUpperCase()}</span>
                                    </div>
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
                {(() => {
                  // Load points from separate storage (avoids quota issues)
                  const points = loadChampionshipPoints(activeSave?.id);
                  const allPoints = { ...activeSave?.championshipPoints, ...points };
                  return Object.keys(allPoints).length > 0 ? (
                    Object.entries(allPoints)
                      .filter(([teamName]) => {
                        // Only show teams from the player's region
                        const team = teams.find(t => t.name === teamName);
                        return team && team.region === teamInfo.region;
                      })
                      .sort(([, a], [, b]) => b - a)
                      .map(([teamName, pts]) => (
                        <div key={teamName} className="point-item vertical-card">
                          <span className="point-team">{teamName}</span>
                          <span className="point-value">{pts} pts</span>
                        </div>
                      ))
                  ) : (
                    <div className="no-points">No points awarded yet.</div>
                  );
                })()}
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
        <MyTeamManagement activeSave={activeSave} setActiveSave={setActiveSave} />
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
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 27 ? 'Tokyo Swiss' : activeSave?.week <= 32 ? 'Masters Tokyo' : activeSave?.week === 33 ? 'Break Week' : activeSave?.week <= 35 ? 'Champions Prep' : activeSave?.week <= 43 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
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
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 29 ? 'Masters Tokyo' : activeSave?.week === 30 ? 'Break Week' : activeSave?.week === 31 ? 'Champions Prep' : activeSave?.week <= 39 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          {activeSave?.week === 6 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', maxWidth: '800px', width: '100%' }}>
              <div style={{ background: 'linear-gradient(135deg, #744210 0%, #553c15 100%)', borderRadius: '16px', padding: '40px', textAlign: 'center', width: '100%', border: '2px solid rgba(255, 215, 0, 0.3)' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🌏</div>
                <h2 style={{ color: '#FFD700', margin: '0 0 16px 0', fontSize: '32px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px' }}>Masters Bangkok</h2>
                <p style={{ color: '#faf089', fontSize: '18px', marginBottom: '30px' }}>Season 2025 • The first international tournament of the year</p>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: '800' }}>8</div>
                      <div style={{ color: '#faf089', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Teams</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: '800' }}>5</div>
                      <div style={{ color: '#faf089', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Weeks</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '32px' }}>
                        <svg width="32" height="24" viewBox="0 0 32 24" style={{ borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          <rect width="32" height="24" fill="#A51931"/>
                          <rect y="4" width="32" height="16" fill="#F4F5F8"/>
                          <rect y="8" width="32" height="8" fill="#2D2A4A"/>
                        </svg>
                      </div>
                      <div style={{ color: '#faf089', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Bangkok</div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,215,0,0.2)', paddingTop: '20px' }}>
                    <div style={{ color: '#9ae6b4', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>📅 Tournament Begins Next Week</div>
                    <div style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                      Swiss Stage (2 weeks) • Playoffs (3 weeks)<br/>
                      Top teams from Kickoff will battle for the first Masters title of the season
                    </div>
                  </div>
                </div>
                <div style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.2) 0%, rgba(246,224,94,0.2) 100%)', borderRadius: '8px', padding: '12px 20px' }}>
                  <span style={{ color: '#f6e05e', fontSize: '14px', fontWeight: '600' }}>🏆 Prepare your team for the international stage!</span>
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {activeSection === 'masters-tokyo' && (
        <div id="masters-tokyo-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Masters Tokyo</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 27 ? 'Tokyo Swiss' : activeSave?.week <= 32 ? 'Masters Tokyo' : activeSave?.week === 33 ? 'Break Week' : activeSave?.week <= 35 ? 'Champions Prep' : activeSave?.week <= 43 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <iframe 
            key={activeSave?.week || 'masters-tokyo-default'}
            id="masters-tokyo-iframe" 
            src="masters_tokyo.html" 
            style={{ 
              width: '100%', 
              flex: 1,
              minHeight: '0',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Masters Tokyo Bracket"
          ></iframe>
        </div>
      )}

      {activeSection === 'champions' && (
        <div id="champions-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Champions 2025</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 27 ? 'Tokyo Swiss' : activeSave?.week <= 32 ? 'Masters Tokyo' : activeSave?.week === 33 ? 'Break Week' : activeSave?.week <= 35 ? 'Champions Prep' : activeSave?.week <= 43 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
              </div>
              <SimWeekButton activeSave={activeSave} setActiveSave={setActiveSave} />
            </div>
          </div>
          <iframe 
            key={activeSave?.week || 'champions-default'}
            id="champions-iframe" 
            src={`champions.html?saveId=${activeSave?.id || 'career_1'}`}
            style={{ 
              width: '100%', 
              flex: 1,
              minHeight: '0',
              border: 'none',
              overflow: 'hidden'
            }} 
            title="Champions Bracket"
          ></iframe>
        </div>
      )}
      {activeSection === 'regular-season' && (
        <div id="regular-season-section" className="content-section" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="office-header" style={{ width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            <h2>Regular Season</h2>
            <div className="season-info-and-button">
              <div className="season-info">
                Week {activeSave?.week || 1} / {activeSave?.week <= 3 ? 'Pre-Season' : activeSave?.week === 4 ? 'Kickoff' : activeSave?.week <= 6 ? 'Masters Prep' : activeSave?.week <= 11 ? 'Masters Bangkok' : activeSave?.week === 12 ? 'Break Week' : activeSave?.week <= 17 ? 'Regular Season' : activeSave?.week <= 23 ? 'Regional Playoffs' : activeSave?.week === 24 ? 'Masters Tokyo Prep' : activeSave?.week <= 27 ? 'Tokyo Swiss' : activeSave?.week <= 32 ? 'Masters Tokyo' : activeSave?.week === 33 ? 'Break Week' : activeSave?.week <= 35 ? 'Champions Prep' : activeSave?.week <= 43 ? 'Champions' : 'Off-Season'} / Season {activeSave?.season || 1}
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

      {activeSection === 'team-details' && (
        <TeamDetailsView 
          team={teams.find(t => t.name === selectedTeamName)} 
          players={activeSave?.players?.filter(p => p.team === selectedTeamName || String(p.teamId) === String(teams.find(t => t.name === selectedTeamName)?.id)) || []} 
          activeSave={activeSave}
        />
      )}

      {activeSection === 'player-details' && (
        <PlayerDetailsView 
          player={activeSave?.players?.find(p => String(p.id) === String(propSelectedPlayerId))} 
          activeSave={activeSave}
          setActiveSave={setActiveSave}
        />
      )}

      <PlayerEditModal />
    </div>
  );
};

export default CareerContent;
