import React, { useState, useMemo } from 'react';
import { teams } from '../teams.js';

const StatsHub = ({ activeSave }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'kills', direction: 'desc' });
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterTournament, setFilterTournament] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { aggregatedStats, tournaments } = useMemo(() => {
    const playerMap = new Map();
    const tournamentSet = new Set();

    if (!activeSave) return { aggregatedStats: [], tournaments: [] };

    // 1. Process Kickoff Stats
    if (activeSave.kickoffState && activeSave.kickoffState.series) {
      const series = activeSave.kickoffState.series;
      Object.values(series).forEach(match => {
        if (!match.playerStats) return;

        const tournamentName = match.tournamentName || "Kickoff 2025";
        tournamentSet.add(tournamentName);

        if (filterTournament !== 'all' && tournamentName !== filterTournament) return;

        processMatchStats(match, playerMap);
      });
    }

    // 2. Process Regular Season Stats
    if (activeSave.regularSeasonMatches) {
      activeSave.regularSeasonMatches.forEach(match => {
        if (!match.playerStats) return;

        const tournamentName = match.tournamentName || "Regular Season";
        tournamentSet.add(tournamentName);

        if (filterTournament !== 'all' && tournamentName !== filterTournament) return;

        processMatchStats(match, playerMap);
      });
    }

    function processMatchStats(match, pMap) {
      // Calculate total rounds in this match
      let matchRounds = 0;
      if (match.mapResults) {
        match.mapResults.forEach(m => {
          const scores = m.score.split('-');
          matchRounds += parseInt(scores[0]) + parseInt(scores[1]);
        });
      } else {
        matchRounds = 24; // Fallback
      }

      Object.entries(match.playerStats).forEach(([playerId, stats]) => {
        if (!pMap.has(playerId)) {
          pMap.set(playerId, {
            id: playerId,
            name: stats.name,
            teamName: stats.teamName,
            teamId: stats.teamId,
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            hs: 0,
            rounds: 0,
            maps: 0,
          });
        }

        const p = pMap.get(playerId);
        p.kills += stats.kills || 0;
        p.deaths += stats.deaths || 0;
        p.assists += stats.assists || 0;
        p.damage += stats.damage || stats.damageDealt || 0;
        p.hs += stats.hs || 0;
        p.rounds += matchRounds;
        p.maps += (match.mapResults ? match.mapResults.length : 1);
      });
    }

    return {
      aggregatedStats: Array.from(playerMap.values()).map(p => ({
        ...p,
        kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2),
        adr: p.rounds > 0 ? Math.round(p.damage / p.rounds) : 0,
        hsPercent: p.kills > 0 ? Math.round((p.hs / p.kills) * 100) : 0,
      })),
      tournaments: Array.from(tournamentSet).sort()
    };
  }, [activeSave, filterTournament]);

  const filteredStats = useMemo(() => {
    return aggregatedStats
      .filter(p => {
        const matchesTeam = filterTeam === 'all' || String(p.teamId) === String(filterTeam) || p.teamName === filterTeam;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTeam && matchesSearch;
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [aggregatedStats, filterTeam, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="fa-solid fa-sort sort-icon-muted"></i>;
    return sortConfig.direction === 'asc' ? 
      <i className="fa-solid fa-sort-up sort-icon-active"></i> : 
      <i className="fa-solid fa-sort-down sort-icon-active"></i>;
  };

  if (!activeSave) return <div className="stats-hub-empty">Loading save data...</div>;

  return (
    <div className="stats-hub">
      <div className="stats-header">
        <h2>Tournament Statistics</h2>
        <p className="stats-subtitle">Aggregated performance from all played matches</p>
      </div>
      <div className="stats-controls">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Search player..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <select value={filterTournament} onChange={(e) => setFilterTournament(e.target.value)}>
            <option value="all">All Tournaments</option>
            {tournaments.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="filter-box">
          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="all">All Teams</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('name')}>Player {getSortIcon('name')}</th>
              <th onClick={() => requestSort('teamName')}>Team {getSortIcon('teamName')}</th>
              <th className="text-center" onClick={() => requestSort('maps')}>Maps {getSortIcon('maps')}</th>
              <th className="text-center" onClick={() => requestSort('kills')}>K {getSortIcon('kills')}</th>
              <th className="text-center" onClick={() => requestSort('deaths')}>D {getSortIcon('deaths')}</th>
              <th className="text-center" onClick={() => requestSort('kd')}>K/D {getSortIcon('kd')}</th>
              <th className="text-center" onClick={() => requestSort('adr')}>ADR {getSortIcon('adr')}</th>
              <th className="text-center" onClick={() => requestSort('hsPercent')}>HS% {getSortIcon('hsPercent')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.length > 0 ? (
              filteredStats.map(p => (
                <tr key={p.id}>
                  <td className="player-name-cell">{p.name}</td>
                  <td>{p.teamName}</td>
                  <td className="text-center">{p.maps}</td>
                  <td className="text-center stat-k">{p.kills}</td>
                  <td className="text-center stat-d">{p.deaths}</td>
                  <td className="text-center">{p.kd}</td>
                  <td className="text-center stat-adr">{p.adr}</td>
                  <td className="text-center stat-hs">{p.hsPercent}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center">No stats recorded yet. Play some matches!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatsHub;
