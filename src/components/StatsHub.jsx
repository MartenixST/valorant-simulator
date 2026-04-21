import React, { useState, useMemo } from 'react';
import { teams, teamLogos } from '../teams.js';

const StatsHub = ({ activeSave }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'kills', direction: 'desc' });
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterTournament, setFilterTournament] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [viewMode, setViewMode] = useState('aggregated'); // 'aggregated' or 'by-map'
  const [selectedMap, setSelectedMap] = useState('all');

  const getTeamLogo = (teamName) => {
    return teamLogos[teamName] || 'assets/logos/vct_logo.png';
  };

  const { aggregatedStats, tournaments, mapList } = useMemo(() => {
    const playerMap = new Map();
    const tournamentSet = new Set();
    const mapSet = new Set();

    if (!activeSave) return { aggregatedStats: [], tournaments: [], mapList: [] };

    const allMatches = [];
    if (activeSave.kickoffState?.series) {
      Object.values(activeSave.kickoffState.series).forEach(m => allMatches.push({ ...m, tournament: m.tournamentName || "Kickoff 2025" }));
    }
    if (activeSave.regularSeasonMatches) {
      activeSave.regularSeasonMatches.forEach(m => allMatches.push({ ...m, tournament: m.tournamentName || "Regular Season" }));
    }

    allMatches.forEach(match => {
      const tournamentName = match.tournament;
      tournamentSet.add(tournamentName);

      if (filterTournament !== 'all' && tournamentName !== filterTournament) return;

      if (viewMode === 'aggregated') {
        processAggregatedMatchStats(match, playerMap);
      } else {
        processByMapMatchStats(match, playerMap, mapSet);
      }
    });

    function processAggregatedMatchStats(match, pMap) {
      if (!match.playerStats) return;
      
      let matchRounds = 0;
      if (match.mapResults) {
        match.mapResults.forEach(m => {
          const scores = m.score.split('-');
          matchRounds += parseInt(scores[0]) + parseInt(scores[1]);
        });
      } else {
        matchRounds = 24;
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

    function processByMapMatchStats(match, pMap, mSet) {
      if (!match.mapResults) return;

      match.mapResults.forEach(mResult => {
        const mapName = mResult.mapName;
        mSet.add(mapName);

        if (selectedMap !== 'all' && mapName !== selectedMap) return;

        const scores = mResult.score.split('-');
        const mapRounds = parseInt(scores[0]) + parseInt(scores[1]);

        Object.entries(mResult.playerStats).forEach(([playerId, stats]) => {
          const key = `${playerId}-${mapName}`;
          if (!pMap.has(key)) {
            pMap.set(key, {
              id: key,
              playerId: playerId,
              name: stats.name,
              teamName: stats.teamName,
              teamId: stats.teamId,
              mapName: mapName,
              kills: 0,
              deaths: 0,
              assists: 0,
              damage: 0,
              hs: 0,
              rounds: 0,
              maps: 0,
            });
          }

          const p = pMap.get(key);
          p.kills += stats.kills || 0;
          p.deaths += stats.deaths || 0;
          p.assists += stats.assists || 0;
          p.damage += stats.damage || stats.damageDealt || 0;
          p.hs += stats.hs || 0;
          p.rounds += mapRounds;
          p.maps += 1;
        });
      });
    }

    return {
      aggregatedStats: Array.from(playerMap.values()).map(p => ({
        ...p,
        kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2),
        adr: p.rounds > 0 ? Math.round(p.damage / p.rounds) : 0,
        hsPercent: p.kills > 0 ? Math.round((p.hs / p.kills) * 100) : 0,
      })),
      tournaments: Array.from(tournamentSet).sort(),
      mapList: Array.from(mapSet).sort()
    };
  }, [activeSave, filterTournament, viewMode, selectedMap]);

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

  const getKDClass = (kd) => {
    const val = parseFloat(kd);
    if (val >= 1.2) return 'kd-high';
    if (val >= 0.9) return 'kd-mid';
    return 'kd-low';
  };

  if (!activeSave) return <div className="stats-hub-empty">Loading save data...</div>;

  return (
    <div className="stats-hub">
      <div className="stats-header">
        <h2>Tournament Statistics</h2>
        <div className="stats-view-toggle">
          <button 
            className={`view-toggle-btn ${viewMode === 'aggregated' ? 'active' : ''}`}
            onClick={() => setViewMode('aggregated')}
          >
            <i className="fa-solid fa-layer-group"></i> Aggregated
          </button>
          <button 
            className={`view-toggle-btn ${viewMode === 'by-map' ? 'active' : ''}`}
            onClick={() => setViewMode('by-map')}
          >
            <i className="fa-solid fa-map"></i> By Map
          </button>
        </div>
      </div>
      <div className="stats-controls">
        <div className="search-box">
          <i className="fa-solid fa-magnifying-glass search-icon"></i>
          <input 
            type="text" 
            placeholder="Search player or team..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <div className="filter-box">
            <label>Tournament</label>
            <select value={filterTournament} onChange={(e) => setFilterTournament(e.target.value)}>
              <option value="all">All Tournaments</option>
              {tournaments.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {viewMode === 'by-map' && (
            <div className="filter-box animated-in">
              <label>Map</label>
              <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)}>
                <option value="all">All Maps</option>
                {mapList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-box">
            <label>Team</label>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: '50px' }}>#</th>
              <th onClick={() => requestSort('name')}>Player {getSortIcon('name')}</th>
              <th onClick={() => requestSort('teamName')}>Team {getSortIcon('teamName')}</th>
              {viewMode === 'by-map' && <th onClick={() => requestSort('mapName')}>Map {getSortIcon('mapName')}</th>}
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
              filteredStats.map((p, index) => (
                <tr key={p.id} className="animated-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <td className="text-center" style={{ opacity: 0.5, fontSize: '12px' }}>{index + 1}</td>
                  <td 
                    className="player-name-cell cursor-pointer hover:text-[#ff4655] transition-colors"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-player-page', { detail: { playerId: p.id } }))}
                  >
                    {p.name}
                  </td>
                  <td 
                    className="team-cell cursor-pointer hover:text-[#ff4655] transition-colors group"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-team-modal', { detail: { teamName: p.teamName } }))}
                  >
                    <div className="team-info-mini">
                      <img src={getTeamLogo(p.teamName)} alt="" className="mini-logo group-hover:scale-110 transition-transform" />
                      <span>{p.teamName}</span>
                    </div>
                  </td>
                  {viewMode === 'by-map' && <td className="map-name-cell">{p.mapName}</td>}
                  <td className="text-center">{p.maps}</td>
                  <td className="text-center stat-k">{p.kills}</td>
                  <td className="text-center stat-d">{p.deaths}</td>
                  <td className={`text-center stat-kd ${getKDClass(p.kd)}`}>{p.kd}</td>
                  <td className="text-center stat-adr">{p.adr}</td>
                  <td className="text-center stat-hs">{p.hsPercent}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={viewMode === 'by-map' ? 10 : 9} className="text-center">No stats recorded yet. Play some matches!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatsHub;
