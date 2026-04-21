/**
 * Champions 2025 - 16 Team Tournament UI
 * Groups of 4 (1 per region) -> Top 2 advance -> Single Elimination Playoffs
 */

import { teams } from '../../teams.js';
import { automate16TeamChampions } from './automation_16_team.js';
import { loadCareer } from '../../career_local_storage.jsx';

// Helper to get team logo path (like in masters_tokyo.jsx)
function getTeamLogo(teamName) {
    if (!teamName || teamName === 'TBD') return 'assets/qmark.png';
    const normalizedPath = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_');
    return `assets/team_logos/${normalizedPath}.png`;
}

export function renderChampions(activeSave, saveCareer, navigateTo) {
    const container = document.getElementById('app');
    if (!container) return;
    
    const championsState = activeSave.championsState;
    const isComplete = championsState?.complete;
    
    // Determine current phase
    let currentPhase = 'Unknown';
    if (!championsState || !championsState.groups) {
        currentPhase = 'Not Started';
    } else if (championsState.complete) {
        currentPhase = 'Complete';
    } else {
        // Check group stage completion
        const groupMatches = Object.values(championsState.groupMatches || {});
        const completeGroupMatches = groupMatches.filter(m => m.winner).length;
        const totalGroupMatches = groupMatches.length;
        
        if (completeGroupMatches < totalGroupMatches) {
            currentPhase = 'Group Stage';
        } else if (championsState.playoffs?.grandFinal && championsState.playoffs.matches[championsState.playoffs.grandFinal]?.winner) {
            currentPhase = 'Complete';
        } else if (championsState.playoffs?.semifinals?.length > 0) {
            currentPhase = 'Semifinals';
        } else if (championsState.playoffs?.quarterfinals?.length > 0) {
            currentPhase = 'Quarterfinals';
        }
    }
    
    // Header
    let html = `
        <div class="masters-tokyo-container" style="min-height: 100vh; background: linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 50%, #0f1419 100%);">
            <div class="masters-tokyo-header" style="background: linear-gradient(135deg, #1a3a2f 0%, #0d2618 100%); padding: 24px; border-bottom: 3px solid #FFD700; position: relative;">
                <button id="backBtn" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
                    ← Back
                </button>
                <h1 style="margin: 0; color: #FFD700; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; text-align: center;">
                    👑 CHAMPIONS 2025
                </h1>
                <p style="margin: 8px 0 0 0; color: #faf089; font-size: 14px; text-align: center;">
                    16 Teams • 4 Groups • 1 Champion
                </p>
                <div style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); text-align: right;">
                    <div style="color: #4fd1c5; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${currentPhase}</div>
                </div>
            </div>
            
            <div class="champions-content" style="max-width: 1400px; margin: 0 auto; padding: 24px;">
    `;
    
    // DEBUG: Manual initialization panel (always visible for testing)
    html += renderDebugSection(activeSave, currentPhase);
    
    // Groups Display
    if (championsState && championsState.groups) {
        html += renderGroups(championsState);
    }
    
    // Playoffs Display
    if (championsState && championsState.playoffs) {
        html += renderPlayoffs(championsState.playoffs);
    }
    
    // Champion Display
    if (isComplete && championsState.playoffs?.grandFinal) {
        const gf = championsState.playoffs.matches[championsState.playoffs.grandFinal];
        if (gf?.winner) {
            html += renderChampion(gf.winner);
        }
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Back button handler
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            if (navigateTo) navigateTo('career');
        };
    }
    
    // Simulate match handlers
    setupSimulateHandlers(activeSave, saveCareer, championsState);
    
    // Debug handlers
    setupDebugHandlers(activeSave, saveCareer, navigateTo);
}

function renderGroups(state) {
    const groups = ['A', 'B', 'C', 'D'];
    
    let html = `
        <style>
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
                50% { box-shadow: 0 0 0 8px rgba(255, 215, 0, 0); }
            }
            .group-card {
                animation: fadeInUp 0.5s ease-out;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .group-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 30px rgba(255, 215, 0, 0.12);
            }
            .match-card {
                transition: all 0.3s ease;
            }
            .match-card:hover {
                transform: scale(1.01);
                box-shadow: 0 3px 15px rgba(0,0,0,0.25);
            }
            .compact-bracket {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            .compact-bracket .match-card:nth-child(1),
            .compact-bracket .match-card:nth-child(2) {
                grid-column: span 1;
            }
            .compact-bracket .match-card:nth-child(3) {
                grid-column: span 2;
            }
        </style>
        <div style="margin-bottom: 24px;">
            <h2 style="color: #FFD700; font-size: 22px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 2px; text-align: center; text-shadow: 0 2px 10px rgba(255,215,0,0.3);">
                🏆 GROUP STAGE - Double Elimination
            </h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
    `;
    
    groups.forEach((group, idx) => {
        const groupMatches = Object.entries(state.groupMatches || {})
            .filter(([id, match]) => match.group === group)
            .reduce((acc, [id, match]) => { acc[id] = match; return acc; }, {});
        
        // Helper to get match data
        const getMatch = (id) => groupMatches[id] || { team1: 'TBD', team2: 'TBD', winner: null };
        
        // Calculate standings for progress indicators
        const standings = calculateGroupStandings(state, group);
        
        html += `
            <div class="group-card" style="background: linear-gradient(145deg, rgba(26,35,50,0.95) 0%, rgba(15,20,25,0.98) 100%); border: 2px solid rgba(255,215,0,0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.4); animation-delay: ${idx * 0.1}s;">
                <!-- Compact Group Header -->
                <div style="background: linear-gradient(90deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 100%); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.2);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #FFD700, #FFA500); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 16px;">${group}</div>
                        <h3 style="margin: 0; color: #FFD700; font-size: 16px; font-weight: 700;">GROUP ${group}</h3>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #48bb78; font-size: 9px; font-weight: 600; text-transform: uppercase;">Top 2 Advance</div>
                    </div>
                </div>
                
                <div style="padding: 12px;">
                    <!-- Compact Standings -->
                    <div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            ${standings.map((team, i) => `
                                <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: ${i < 2 ? 'rgba(72,187,120,0.15)' : 'rgba(0,0,0,0.2)'}; border-radius: 4px; border-left: 2px solid ${i < 2 ? '#48bb78' : 'transparent'};">
                                    <span style="color: ${i < 2 ? '#48bb78' : '#718096'}; font-weight: 700; font-size: 10px; min-width: 12px;">${i + 1}</span>
                                    <img src="${getTeamLogo(team.name)}" style="width: 16px; height: 16px; object-fit: contain;">
                                    <span style="color: ${i < 2 ? '#fff' : '#8b9dc3'}; font-size: 11px; flex: 1;">${team.name}</span>
                                    <span style="color: #8b9dc3; font-size: 10px; font-family: monospace;">${team.wins}-${team.losses}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Compact Winners Bracket -->
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                            <span style="color: #48bb78; font-size: 11px;">👑</span>
                            <span style="color: #48bb78; font-size: 9px; font-weight: 700; text-transform: uppercase;">Winners</span>
                            <div style="flex: 1; height: 1px; background: rgba(72,187,120,0.3);"></div>
                        </div>
                        <div class="compact-bracket">
                            ${renderBracketMatch(getMatch(`CHAMP-GROUP-${group}-WB1`), `CHAMP-GROUP-${group}-WB1`, 'R1', '#48bb78')}
                            ${renderBracketMatch(getMatch(`CHAMP-GROUP-${group}-WB2`), `CHAMP-GROUP-${group}-WB2`, 'R1', '#48bb78')}
                            ${renderBracketMatch(getMatch(`CHAMP-GROUP-${group}-WBF`), `CHAMP-GROUP-${group}-WBF`, 'Final', '#FFD700')}
                        </div>
                    </div>
                    
                    <!-- Compact Losers Bracket -->
                    <div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                            <span style="color: #ed8936; font-size: 11px;">🔄</span>
                            <span style="color: #ed8936; font-size: 9px; font-weight: 700; text-transform: uppercase;">Losers</span>
                            <div style="flex: 1; height: 1px; background: rgba(237,137,54,0.3);"></div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${renderBracketMatch(getMatch(`CHAMP-GROUP-${group}-LB1`), `CHAMP-GROUP-${group}-LB1`, 'R1', '#ed8936')}
                            ${renderBracketMatch(getMatch(`CHAMP-GROUP-${group}-LBF`), `CHAMP-GROUP-${group}-LBF`, 'Final', '#FFD700')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function calculateGroupStandings(state, group) {
    const teams = state.groups[group] || [];
    return teams.map(team => {
        const stats = state.teamStats?.[team] || { wins: 0, losses: 0 };
        return { name: team, ...stats };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

function renderPlayoffs(playoffs) {
    if (!playoffs || !playoffs.quarterfinals || playoffs.quarterfinals.length === 0) {
        return '';
    }
    
    // Build bracket structure with proper round progression
    const qfMatches = playoffs.quarterfinals.map(id => playoffs.matches[id]).filter(Boolean);
    const sfMatches = (playoffs.semifinals || []).map(id => playoffs.matches[id]).filter(Boolean);
    const gfMatch = playoffs.grandFinal ? playoffs.matches[playoffs.grandFinal] : null;
    
    let html = `
        <div style="margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #FFD700; font-size: 20px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                    ⚔️ CHAMPIONSHIP BRACKET
                </h2>
                <div style="display: flex; gap: 8px;">
                    <button id="sim-next-playoff" style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                        Sim Next Round
                    </button>
                    <button id="sim-all-playoffs" style="background: linear-gradient(135deg, #38a169 0%, #276749 100%); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                        Sim All
                    </button>
                </div>
            </div>
            
            <!-- Bracket Container -->
            <div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 16px;">
                
                <!-- Quarterfinals Column -->
                <div style="flex-shrink: 0; width: 260px;">
                    <div style="background: linear-gradient(90deg, rgba(255,107,107,0.3) 0%, rgba(255,107,107,0.1) 100%); border-left: 3px solid #ff6b6b; padding: 8px 12px; margin-bottom: 12px; border-radius: 0 4px 4px 0;">
                        <h3 style="margin: 0; color: #ff6b6b; font-size: 13px; font-weight: 700; text-transform: uppercase;">Quarterfinals</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${qfMatches.map((match, i) => renderBracketMatch(match, playoffs.quarterfinals[i], i + 1)).join('')}
                    </div>
                </div>
                
                <!-- Connector Lines to Semifinals -->
                <div style="flex-shrink: 0; width: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    ${sfMatches.length > 0 ? `
                        <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-around;">
                            <div style="width: 40px; height: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(246,224,94,0.5)); position: relative;">
                                <div style="position: absolute; right: 0; top: -40px; width: 2px; height: 80px; background: rgba(246,224,94,0.3);"></div>
                            </div>
                            <div style="width: 40px; height: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(246,224,94,0.5)); position: relative;">
                                <div style="position: absolute; right: 0; top: -40px; width: 2px; height: 80px; background: rgba(246,224,94,0.3);"></div>
                            </div>
                        </div>
                    ` : '<div style="color: rgba(255,255,255,0.3); font-size: 10px; text-align: center;">Complete QFs to advance</div>'}
                </div>
                
                <!-- Semifinals Column -->
                <div style="flex-shrink: 0; width: 260px;">
                    <div style="background: linear-gradient(90deg, rgba(246,224,94,0.3) 0%, rgba(246,224,94,0.1) 100%); border-left: 3px solid #f6e05e; padding: 8px 12px; margin-bottom: 12px; border-radius: 0 4px 4px 0;">
                        <h3 style="margin: 0; color: #f6e05e; font-size: 13px; font-weight: 700; text-transform: uppercase;">Semifinals</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 60px; padding-top: 20px;">
                        ${sfMatches.length > 0 
                            ? sfMatches.map((match, i) => renderBracketMatch(match, playoffs.semifinals[i], i + 1)).join('')
                            : '<div style="color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; padding: 40px 0;">Waiting for QF results...</div>'
                        }
                    </div>
                </div>
                
                <!-- Connector Lines to Finals -->
                <div style="flex-shrink: 0; width: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    ${gfMatch ? `
                        <div style="width: 40px; height: 2px; background: linear-gradient(90deg, rgba(246,224,94,0.5), rgba(255,215,0,0.8)); position: relative;">
                            <div style="position: absolute; right: 0; top: -60px; width: 2px; height: 120px; background: rgba(255,215,0,0.4);"></div>
                        </div>
                    ` : sfMatches.length > 0 ? '<div style="color: rgba(255,255,255,0.3); font-size: 10px; text-align: center;">Complete SFs to advance</div>' : ''}
                </div>
                
                <!-- Grand Final Column -->
                <div style="flex-shrink: 0; width: 280px;">
                    <div style="background: linear-gradient(90deg, rgba(255,215,0,0.4) 0%, rgba(255,215,0,0.15) 100%); border-left: 3px solid #FFD700; padding: 8px 12px; margin-bottom: 12px; border-radius: 0 4px 4px 0;">
                        <h3 style="margin: 0; color: #FFD700; font-size: 14px; font-weight: 700; text-transform: uppercase;">🏆 Grand Final</h3>
                    </div>
                    <div style="padding-top: 50px;">
                        ${gfMatch 
                            ? renderBracketMatch(gfMatch, playoffs.grandFinal, 'FINAL', true)
                            : '<div style="color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; padding: 40px 0;">Waiting for SF results...</div>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function renderBracketMatch(match, matchId, number, isFinal = false) {
    const isComplete = match.winner;
    const team1Logo = getTeamLogo(match.team1);
    const team2Logo = getTeamLogo(match.team2);
    const t1Won = match.winner === match.team1;
    const t2Won = match.winner === match.team2;
    
    return `
        <div style="background: ${isFinal ? 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(26,35,50,0.9) 100%)' : 'linear-gradient(135deg, rgba(45,55,72,0.6) 0%, rgba(30,40,50,0.8) 100%)'}; 
                    border: 1px solid ${isFinal ? 'rgba(255,215,0,0.4)' : (isComplete ? 'rgba(72,187,120,0.3)' : 'rgba(255,255,255,0.1)')}; 
                    border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            
            <!-- Match Header -->
            <div style="background: ${isFinal ? 'linear-gradient(90deg, rgba(255,215,0,0.2), transparent)' : 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)'}; 
                        padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="color: ${isFinal ? '#FFD700' : '#8b9dc3'}; font-size: 10px; font-weight: 700; text-transform: uppercase;">
                    ${isFinal ? '🏆 FINAL' : `Match ${number}`}
                </span>
                ${isComplete ? `<span style="color: #48bb78; font-size: 10px; font-weight: 700;">✓ ${match.score}</span>` : ''}
            </div>
            
            <!-- Team 1 -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; 
                        background: ${isComplete ? (t1Won ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.05)') : 'transparent'};
                        border-left: 3px solid ${isComplete ? (t1Won ? '#48bb78' : '#fc8181') : 'transparent'};">
                <img src="${team1Logo}" style="width: 24px; height: 24px; object-fit: contain; ${!match.team1 || match.team1 === 'TBD' ? 'opacity: 0.3;' : ''}">
                <span style="flex: 1; color: ${isComplete ? (t1Won ? '#48bb78' : '#fc8181') : '#fff'}; font-size: 13px; font-weight: ${t1Won ? '700' : '500'};">
                    ${match.team1 || 'TBD'}
                </span>
                ${isComplete ? `<span style="color: ${t1Won ? '#48bb78' : '#fc8181'}; font-size: 12px; font-weight: 700;">${t1Won ? 'W' : 'L'}</span>` : 
                    '<span style="color: rgba(255,255,255,0.3); font-size: 10px;">0</span>'}
            </div>
            
            <!-- Team 2 -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-top: 1px solid rgba(255,255,255,0.05);
                        background: ${isComplete ? (t2Won ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.05)') : 'transparent'};
                        border-left: 3px solid ${isComplete ? (t2Won ? '#48bb78' : '#fc8181') : 'transparent'};">
                <img src="${team2Logo}" style="width: 24px; height: 24px; object-fit: contain; ${!match.team2 || match.team2 === 'TBD' ? 'opacity: 0.3;' : ''}">
                <span style="flex: 1; color: ${isComplete ? (t2Won ? '#48bb78' : '#fc8181') : '#fff'}; font-size: 13px; font-weight: ${t2Won ? '700' : '500'};">
                    ${match.team2 || 'TBD'}
                </span>
                ${isComplete ? `<span style="color: ${t2Won ? '#48bb78' : '#fc8181'}; font-size: 12px; font-weight: 700;">${t2Won ? 'W' : 'L'}</span>` : 
                    '<span style="color: rgba(255,255,255,0.3); font-size: 10px;">0</span>'}
            </div>
            
            <!-- Action Buttons -->
            ${!isComplete && match.team1 && match.team1 !== 'TBD' && match.team2 && match.team2 !== 'TBD' ? `
                <div style="display: flex; height: 32px; border-top: 1px solid rgba(255,255,255,0.06);">
                    <!-- SIM Button -->
                    <button class="sim-playoff-match" 
                            data-match-id="${matchId}" 
                            data-team1="${encodeURIComponent(match.team1)}" 
                            data-team2="${encodeURIComponent(match.team2)}"
                            style="flex: 1; background: linear-gradient(180deg, #f6ad55 0%, #ed8936 100%); 
                                   border: none; border-right: 1px solid rgba(0,0,0,0.15); color: #fff; 
                                   padding: 0; font-size: 9px; font-weight: 700; cursor: pointer; 
                                   text-transform: uppercase; letter-spacing: 0.8px;
                                   display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <span style="font-size: 11px;">⚡</span>
                        <span>SIM</span>
                    </button>
                    
                    <!-- PLAY Button -->
                    <a href="match_simulation.html?team1=${encodeURIComponent(match.team1)}&team2=${encodeURIComponent(match.team2)}&tournament=champions&matchId=${matchId}" 
                       style="flex: 1.5; text-align: center; 
                              background: linear-gradient(180deg, #fc8181 0%, #f56565 100%); 
                              border: none; color: #fff; padding: 0; 
                              font-size: 9px; font-weight: 700; cursor: pointer; 
                              text-transform: uppercase; letter-spacing: 0.8px;
                              text-decoration: none; 
                              display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <span style="font-size: 10px;">▶</span>
                        <span>PLAY</span>
                    </a>
                </div>
            ` : isComplete ? `
                <!-- View Stats Button -->
                <div style="display: flex; height: 28px; border-top: 1px solid rgba(255,255,255,0.06);">
                    <button class="view-match-stats" 
                            data-match-id="${matchId}"
                            style="flex: 1; background: linear-gradient(180deg, #4a5568 0%, #2d3748 100%); 
                                   border: none; color: #fff; 
                                   padding: 0; font-size: 9px; font-weight: 700; cursor: pointer; 
                                   text-transform: uppercase; letter-spacing: 0.8px;
                                   display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <span style="font-size: 10px;">📊</span>
                        <span>VIEW STATS</span>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function renderChampion(winner) {
    const winnerLogo = getTeamLogo(winner);
    
    return `
        <div style="background: linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(26,35,50,0.9) 100%); border: 3px solid rgba(255,215,0,0.4); border-radius: 16px; padding: 32px; text-align: center; margin-top: 24px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
            <h2 style="color: #FFD700; font-size: 24px; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 2px;">CHAMPION CROWNED</h2>
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px;">
                <img src="${winnerLogo}" alt="${winner}" style="width: 64px; height: 64px; object-fit: contain;">
                <span style="color: #fff; font-size: 28px; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${winner}</span>
            </div>
            <p style="color: #faf089; font-size: 14px; margin: 0;">
                Congratulations to the Champions 2025 winner!
            </p>
        </div>
    `;
}

function renderDebugSection(activeSave, currentPhase) {
    const qualifiedTeams = activeSave.championsQualified || [];
    const hasTeams = qualifiedTeams.length >= 16;
    
    return `
        <div style="background: linear-gradient(135deg, rgba(255,0,0,0.1) 0%, rgba(50,0,0,0.3) 100%); border: 2px dashed #ff6b6b; border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
            <h3 style="color: #ff6b6b; margin: 0 0 16px 0; font-size: 18px;">🛠️ DEBUG: Tournament Controls</h3>
            <p style="color: #aaa; margin: 0 0 16px 0; font-size: 14px;">
                Status: <strong style="color: #FFD700;">${currentPhase}</strong> | 
                Week: <strong>${activeSave.week || 'Unknown'}</strong> | 
                Teams: <strong>${qualifiedTeams.length}/16</strong>
            </p>
            ${hasTeams ? `
                <button id="debug-init-champions" style="background: linear-gradient(135deg, #ff6b6b 0%, #c53030 100%); border: none; color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 12px;">
                    🚀 Initialize Champions (16 Teams)
                </button>
            ` : `
                <button id="debug-force-qualify" style="background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%); border: none; color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; margin-bottom: 12px;">
                    🔧 Force Qualify 16 Teams (Auto-fill)
                </button>
                <br>
            `}
            <button id="debug-skip-to-groups" style="background: linear-gradient(135deg, #ed8936 0%, #c05621 100%); border: none; color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
                ⏭️ Skip to Week 36
            </button>
            <button id="debug-clear-champions" style="background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); border: none; color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; margin-left: 12px;">
                🗑️ Clear Champions
            </button>
            <br><br>
            <button id="debug-create-playoffs" style="background: linear-gradient(135deg, #38a169 0%, #276749 100%); border: none; color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
                🏆 Force Create Playoffs
            </button>
            <p style="color: #888; margin: 12px 0 0 0; font-size: 11px;">
                ${hasTeams ? 'This will create the 4 groups and populate the tournament.' : 'Click "Force Qualify" to auto-fill remaining teams from championship points.'}
            </p>
        </div>
    `;
}

function setupSimulateHandlers(activeSave, saveCareer, championsState) {
    // Unified handler for all SIM buttons - detects match type from matchId
    document.querySelectorAll('.sim-playoff-match, .sim-champions-match').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const matchId = btn.dataset.matchId;
            const team1 = decodeURIComponent(btn.dataset.team1);
            const team2 = decodeURIComponent(btn.dataset.team2);
            
            // Auto-detect match type from matchId
            const isPlayoffMatch = matchId && (matchId.includes('QF-') || matchId.includes('SF-') || matchId.includes('GF'));
            const matchType = isPlayoffMatch ? 'playoff' : 'group';
            
            // Simulate the match with correct type
            simulateChampionsMatch(matchId, team1, team2, activeSave, saveCareer, championsState, matchType);
        });
    });
    
    // Sim Next Round button - simulates all incomplete matches in the current round
    const simNextBtn = document.getElementById('sim-next-playoff');
    if (simNextBtn) {
        simNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            simulateNextPlayoffRound(activeSave, saveCareer, championsState);
        });
    }
    
    // Sim All button - simulates all remaining playoff matches
    const simAllBtn = document.getElementById('sim-all-playoffs');
    if (simAllBtn) {
        simAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            simulateAllPlayoffs(activeSave, saveCareer, championsState);
        });
    }
    
    // View Stats buttons for completed matches
    document.querySelectorAll('.view-match-stats').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const matchId = btn.dataset.matchId;
            showMatchStats(matchId, championsState);
        });
    });
}

function simulateChampionsMatch(matchId, team1, team2, activeSave, saveCareer, championsState, matchType = 'group') {
    // Load fresh save data using loadCareer (critical - ensures we have latest state with all properties)
    const saveData = loadCareer() || loadCareerSave() || activeSave;
    const allPlayers = saveData?.players || activeSave?.players || [];
    
    // Use the FRESH championsState from saveData, not the stale parameter
    const freshChampionsState = saveData?.championsState || championsState;
    
    // Determine which match collection to use
    const isPlayoffMatch = matchType === 'playoff' || (matchId && (matchId.includes('QF-') || matchId.includes('SF-') || matchId.includes('GF')));
    const matchCollection = isPlayoffMatch ? freshChampionsState?.playoffs?.matches : freshChampionsState?.groupMatches;
    
    if (!matchCollection) {
        console.error(`Match collection not found for ${matchType} match:`, matchId);
        alert(`Error: Tournament state not properly initialized. Try refreshing the page.`);
        return;
    }
    
    // Get team rosters
    const team1Roster = allPlayers.filter(p => p.team === team1).map(p => p.name);
    const team2Roster = allPlayers.filter(p => p.team === team2).map(p => p.name);
    
    if (team1Roster.length === 0 || team2Roster.length === 0) {
        alert('Cannot simulate - missing team rosters');
        return;
    }
    
    // Calculate team skill
    const t1Skill = team1Roster.reduce((sum, name) => {
        const p = allPlayers.find(x => x.name === name);
        return sum + (p ? p.overall : 70);
    }, 0) / team1Roster.length;
    
    const t2Skill = team2Roster.reduce((sum, name) => {
        const p = allPlayers.find(x => x.name === name);
        return sum + (p ? p.overall : 70);
    }, 0) / team2Roster.length;
    
    // BO3 Simulation - first to 2 map wins
    const t1WinChance = t1Skill / (t1Skill + t2Skill);
    let t1MapWins = 0;
    let t2MapWins = 0;
    const mapScores = [];
    
    // Play up to 3 maps (stop if someone gets 2 wins)
    for (let map = 0; map < 3 && t1MapWins < 2 && t2MapWins < 2; map++) {
        const t1WinsMap = Math.random() < t1WinChance;
        if (t1WinsMap) {
            t1MapWins++;
            const t1Score = 13;
            const t2Score = Math.floor(Math.random() * 10) + 3; // 3-12
            mapScores.push(`${t1Score}-${t2Score}`);
        } else {
            t2MapWins++;
            const t2Score = 13;
            const t1Score = Math.floor(Math.random() * 10) + 3;
            mapScores.push(`${t1Score}-${t2Score}`);
        }
    }
    
    // Determine series winner
    const winner = t1MapWins > t2MapWins ? team1 : team2;
    const loser = winner === team1 ? team2 : team1;
    const score = `${t1MapWins}-${t2MapWins}`;
    
    // Generate map results with pickers
    const availableMaps = ['Haven', 'Bind', 'Split', 'Ascent', 'Icebox', 'Breeze', 'Fracture', 'Lotus', 'Sunset'];
    const mapResults = [];
    const mapsPlayed = t1MapWins + t2MapWins;
    
    for (let i = 0; i < mapsPlayed; i++) {
        const mapName = availableMaps[Math.floor(Math.random() * availableMaps.length)];
        const t1Won = i < t1MapWins;
        
        // Proper Valorant scoring: first to 13, win by 2, overtime possible
        let t1Rounds, t2Rounds;
        if (t1Won) {
            // Team 1 won - they have 13+ rounds, won by 2
            const loserScore = Math.random() < 0.3 ? 11 : Math.floor(Math.random() * 11); // 30% chance of 11-13 (close), else random 0-10
            const needsOvertime = loserScore >= 12;
            if (needsOvertime) {
                // Overtime: 14-12, 15-13, 16-14, etc.
                const overtimeRounds = Math.floor(Math.random() * 3) + 1; // 1-3 overtime rounds
                t1Rounds = 13 + overtimeRounds;
                t2Rounds = 12 + overtimeRounds - 1;
            } else {
                t1Rounds = 13;
                t2Rounds = loserScore;
            }
        } else {
            // Team 2 won
            const loserScore = Math.random() < 0.3 ? 11 : Math.floor(Math.random() * 11);
            const needsOvertime = loserScore >= 12;
            if (needsOvertime) {
                const overtimeRounds = Math.floor(Math.random() * 3) + 1;
                t2Rounds = 13 + overtimeRounds;
                t1Rounds = 12 + overtimeRounds - 1;
            } else {
                t2Rounds = 13;
                t1Rounds = loserScore;
            }
        }
        
        mapResults.push({
            map: mapName,
            score: `${t1Rounds}-${t2Rounds}`,
            picker: i === 0 ? team1 : (i === 1 ? team2 : 'Decider'),
            t1Rounds: t1Rounds,
            t2Rounds: t2Rounds,
            winner: t1Won ? team1 : team2,
            overtime: Math.max(t1Rounds, t2Rounds) > 13
        });
    }
    
    // Generate player stats per map and overall
    const playerStats = {};
    const playerStatsPerMap = {}; // Map index -> playerName -> stats
    const totalRounds = mapResults.reduce((sum, m) => sum + m.t1Rounds + m.t2Rounds, 0);
    
    // Initialize per-map stats structure
    mapResults.forEach((_, mapIdx) => {
        playerStatsPerMap[mapIdx] = {};
    });
    
    // Generate per-map stats first, then aggregate for overall
    team1Roster.forEach((name, idx) => {
        const player = allPlayers.find(p => p.name === name);
        const skill = player ? player.overall : 70;
        const isWinner = winner === team1;
        const isStarPlayer = idx < 2;
        const agent = ['Jett', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Cypher', 'Killjoy', 'Omen', 'Viper', 'Sova', 'Fade', 'Gekko', 'Harbor', 'Deadlock', 'Iso'][Math.floor(Math.random() * 15)];
        
        let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDamage = 0, totalFB = 0;
        
        // Generate stats for each map
        mapResults.forEach((mapResult, mapIdx) => {
            const mapRounds = mapResult.t1Rounds + mapResult.t2Rounds;
            const t1WonMap = mapResult.winner === team1;
            
            // Per-map stats - players can go negative (more deaths than kills)
            // Base performance on skill but with variance for bad games
            const baseKills = Math.floor(skill / 12) + 4; // Reduced base
            const starBonus = isStarPlayer ? 3 : 0;
            const winBonus = t1WonMap ? 2 : 0;
            const performanceVariance = Math.floor(Math.random() * 12) - 4; // -4 to +8 variance (can be negative)
            const kills = Math.max(2, baseKills + starBonus + winBonus + performanceVariance); // Min 2 kills (very poor game)
            
            // Deaths can exceed kills - losing team/players die more
            const baseDeaths = t1WonMap ? 11 : 15;
            const deathVariance = Math.floor(Math.random() * 8) - 2; // -2 to +6
            const deaths = Math.max(6, baseDeaths + deathVariance); // Min 6 deaths
            
            const assists = Math.floor(kills * 0.35) + Math.floor(Math.random() * 5);
            const damage = (kills * 140) + (assists * 40) + Math.floor(Math.random() * 300);
            const fb = Math.floor(kills * 0.10) + (Math.random() > 0.8 ? 1 : 0);
            
            // Per-map ACS - realistic Valorant formula
            // ACS = (Damage * 1 + Kills * 150 + Assists * 50) / Rounds, typically 150-300
            const acs = Math.floor((damage + kills * 150 + assists * 50) / Math.max(1, mapRounds) / 2.5);
            
            playerStatsPerMap[mapIdx][name] = {
                name: name,
                teamName: team1,
                kills: kills,
                deaths: deaths,
                assists: assists,
                damage: damage,
                rounds: mapRounds,
                acs: Math.min(Math.max(acs, 60), 320),
                kast: Math.floor(55 + Math.random() * 40), // Can be as low as 55%
                firstBloods: fb,
                headshotPercent: Math.floor(18 + Math.random() * 32), // 18-50%
                agent: agent,
                mapWon: t1WonMap
            };
            
            totalKills += kills;
            totalDeaths += deaths;
            totalAssists += assists;
            totalDamage += damage;
            totalFB += fb;
        });
        
        // Overall ACS - weighted average of per-map ACS
        const overallACS = Math.floor((totalDamage + totalKills * 150 + totalAssists * 50) / Math.max(1, totalRounds) / 2.5);
        
        playerStats[name] = {
            name: name,
            teamName: team1,
            kills: totalKills,
            deaths: totalDeaths,
            assists: totalAssists,
            damage: totalDamage,
            rounds: totalRounds,
            acs: Math.min(Math.max(overallACS, 60), 320),
            kast: Math.floor(55 + Math.random() * 40),
            firstBloods: totalFB,
            headshotPercent: Math.floor(18 + Math.random() * 32),
            agent: agent
        };
    });
    
    // Generate per-map stats for team 2
    team2Roster.forEach((name, idx) => {
        const player = allPlayers.find(p => p.name === name);
        const skill = player ? player.overall : 70;
        const isWinner = winner === team2;
        const isStarPlayer = idx < 2;
        const agent = ['Jett', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Cypher', 'Killjoy', 'Omen', 'Viper', 'Sova', 'Fade', 'Gekko', 'Harbor', 'Deadlock', 'Iso'][Math.floor(Math.random() * 15)];
        
        let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDamage = 0, totalFB = 0;
        
        mapResults.forEach((mapResult, mapIdx) => {
            const mapRounds = mapResult.t1Rounds + mapResult.t2Rounds;
            const t2WonMap = mapResult.winner === team2;
            
            // Per-map stats - players can go negative (more deaths than kills)
            const baseKills = Math.floor(skill / 12) + 4;
            const starBonus = isStarPlayer ? 3 : 0;
            const winBonus = t2WonMap ? 2 : 0;
            const performanceVariance = Math.floor(Math.random() * 12) - 4;
            const kills = Math.max(4, baseKills + starBonus + winBonus + performanceVariance);
            
            const baseDeaths = t2WonMap ? 11 : 15;
            const deathVariance = Math.floor(Math.random() * 8) - 2;
            const deaths = Math.max(6, baseDeaths + deathVariance);
            
            const assists = Math.floor(kills * 0.35) + Math.floor(Math.random() * 5);
            const damage = (kills * 140) + (assists * 40) + Math.floor(Math.random() * 300);
            const fb = Math.floor(kills * 0.10) + (Math.random() > 0.8 ? 1 : 0);
            
            // Per-map ACS - realistic Valorant formula
            const acs = Math.floor((damage + kills * 150 + assists * 50) / Math.max(1, mapRounds) / 2.5);
            
            playerStatsPerMap[mapIdx][name] = {
                name: name,
                teamName: team2,
                kills: kills,
                deaths: deaths,
                assists: assists,
                damage: damage,
                rounds: mapRounds,
                acs: Math.min(Math.max(acs, 60), 320),
                kast: Math.floor(55 + Math.random() * 40),
                firstBloods: fb,
                headshotPercent: Math.floor(18 + Math.random() * 32),
                agent: agent,
                mapWon: t2WonMap
            };
            
            totalKills += kills;
            totalDeaths += deaths;
            totalAssists += assists;
            totalDamage += damage;
            totalFB += fb;
        });
        
        const overallACS = Math.floor((totalDamage + totalKills * 150 + totalAssists * 50) / Math.max(1, totalRounds) / 2.5);
        
        playerStats[name] = {
            name: name,
            teamName: team2,
            kills: totalKills,
            deaths: totalDeaths,
            assists: totalAssists,
            damage: totalDamage,
            rounds: totalRounds,
            acs: Math.min(Math.max(overallACS, 60), 320),
            kast: Math.floor(55 + Math.random() * 40),
            firstBloods: totalFB,
            headshotPercent: Math.floor(18 + Math.random() * 32),
            agent: agent
        };
    });
    
    // Save result using FRESH state
    const match = matchCollection[matchId];
    if (match) {
        match.winner = winner;
        match.loser = loser;
        match.score = score;
        match.completed = true;
        match.isBo3 = true;
        match.mapScores = mapScores;
        match.mapResults = mapResults;
        match.playerStats = playerStats;
        match.playerStatsPerMap = playerStatsPerMap;
        
        // Update team stats (for group matches only - playoff stats tracked separately)
        if (!isPlayoffMatch) {
            if (!freshChampionsState.teamStats) freshChampionsState.teamStats = {};
            if (!freshChampionsState.teamStats[winner]) freshChampionsState.teamStats[winner] = { wins: 0, losses: 0 };
            if (!freshChampionsState.teamStats[loser]) freshChampionsState.teamStats[loser] = { wins: 0, losses: 0 };
            freshChampionsState.teamStats[winner].wins++;
            freshChampionsState.teamStats[loser].losses++;
            
            // Update group standings
            const group = match.group;
            updateGroupAfterMatch(freshChampionsState, group);
        }
        
        // Check if all group matches are complete - if so, form playoffs (only for group matches)
        if (!isPlayoffMatch) {
            const allGroupMatches = Object.values(freshChampionsState.groupMatches);
            const allGroupMatchesComplete = allGroupMatches.every(m => m.winner);
            
            if (allGroupMatchesComplete && (!freshChampionsState.playoffs || freshChampionsState.playoffs.quarterfinals.length === 0)) {
            console.log("All group matches complete! Forming playoffs...");
            
            // Initialize playoffs structure if needed
            if (!freshChampionsState.playoffs) {
                freshChampionsState.playoffs = {
                    quarterfinals: [],
                    semifinals: [],
                    grandFinal: null,
                    matches: {}
                };
            }
            
            // Get top 2 from each group
            const advancingTeams = [];
            const groups = ['A', 'B', 'C', 'D'];
            groups.forEach(g => {
                const groupTeams = freshChampionsState.groups[g];
                if (groupTeams) {
                    const standings = groupTeams.map(team => ({
                        name: team,
                        ...(freshChampionsState.teamStats?.[team] || { wins: 0, losses: 0 })
                    })).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
                    
                    // Top 2 advance
                    advancingTeams.push(...standings.slice(0, 2).map(t => t.name));
                    console.log(`Group ${g} advancing:`, standings.slice(0, 2).map(t => t.name));
                }
            });
            
            console.log("Advancing to playoffs:", advancingTeams);
            
            // Create Quarterfinals (8 teams -> 4 matches)
            // Cross-group matchups: Group A #1 vs Group B #2, Group B #1 vs Group A #2, etc.
            if (advancingTeams.length === 8) {
                const qfMatchups = [
                    [advancingTeams[0], advancingTeams[3]], // A1 vs B2
                    [advancingTeams[2], advancingTeams[1]], // B1 vs A2
                    [advancingTeams[4], advancingTeams[7]], // C1 vs D2
                    [advancingTeams[6], advancingTeams[5]]  // D1 vs C2
                ];
                
                const prefix = 'CHAMP-';
                qfMatchups.forEach((matchup, index) => {
                    const matchId = `${prefix}QF-${index + 1}`;
                    freshChampionsState.playoffs.matches[matchId] = {
                        team1: matchup[0],
                        team2: matchup[1],
                        winner: null,
                        loser: null,
                        score: null,
                        round: 'quarterfinals'
                    };
                    freshChampionsState.playoffs.quarterfinals.push(matchId);
                });
                
                console.log("Quarterfinals created:", freshChampionsState.playoffs.quarterfinals);
            }
        }
        
        // Handle playoff bracket progression (only for playoff matches)
        if (isPlayoffMatch && freshChampionsState.playoffs) {
            const playoffs = freshChampionsState.playoffs;
            
            // Check if all QFs are complete -> create SFs
            if (matchId.includes('QF-')) {
                const qfWinners = playoffs.quarterfinals.map(id => playoffs.matches[id]?.winner).filter(Boolean);
                if (qfWinners.length === 4 && playoffs.semifinals.length === 0) {
                    console.log("All QFs complete! Creating semifinals...");
                    const sfMatchups = [
                        [qfWinners[0], qfWinners[1]], // QF1 vs QF2
                        [qfWinners[2], qfWinners[3]]  // QF3 vs QF4
                    ];
                    sfMatchups.forEach((matchup, index) => {
                        const sfMatchId = `CHAMP-SF-${index + 1}`;
                        playoffs.matches[sfMatchId] = {
                            team1: matchup[0],
                            team2: matchup[1],
                            winner: null,
                            loser: null,
                            score: null,
                            round: 'semifinals'
                        };
                        playoffs.semifinals.push(sfMatchId);
                    });
                }
            }
            
            // Check if all SFs are complete -> create GF
            if (matchId.includes('SF-')) {
                const sfWinners = playoffs.semifinals.map(id => playoffs.matches[id]?.winner).filter(Boolean);
                if (sfWinners.length === 2 && !playoffs.grandFinal) {
                    console.log("All SFs complete! Creating Grand Final...");
                    playoffs.matches['CHAMP-GF'] = {
                        team1: sfWinners[0],
                        team2: sfWinners[1],
                        winner: null,
                        loser: null,
                        score: null,
                        round: 'grandfinal'
                    };
                    playoffs.grandFinal = 'CHAMP-GF';
                }
            }
            
            // Check if GF is complete -> mark tournament complete
            if (matchId.includes('GF') && winner) {
                const allPlayoffMatches = Object.values(playoffs.matches);
                const allComplete = allPlayoffMatches.every(m => m.winner);
                if (allComplete) {
                    freshChampionsState.complete = true;
                    freshChampionsState.champion = winner;
                    console.log(`Tournament complete! Champion: ${winner}`);
                }
            }
        }
    }
        
    // Save to career save
    saveData.championsState = freshChampionsState;
    saveCareer(saveData);
    
    // Notify user of simulation result
    console.log(`✓ ${isPlayoffMatch ? 'Playoff' : 'Group'} Match ${matchId}: ${winner} defeats ${loser} ${score}`);
    
    // Reload page to get fresh data from localStorage
    window.location.reload();
} else {
    console.error(`✗ Failed to save match ${matchId}: match not found in ${isPlayoffMatch ? 'playoffs' : 'groupMatches'}`, { matchId, freshChampionsState });
    alert(`Error: Match ${matchId} not found in tournament state. Try refreshing the page.`);
}
}

// Helper function to simulate all incomplete matches in the current playoff round
function simulateNextPlayoffRound(activeSave, saveCareer, championsState) {
    const saveData = loadCareer() || loadCareerSave() || activeSave;
    const freshChampionsState = saveData?.championsState || championsState;
    const playoffs = freshChampionsState?.playoffs;
    
    if (!playoffs) {
        alert('No playoffs found!');
        return;
    }
    
    // Find incomplete matches in current round
    const incompleteQFs = playoffs.quarterfinals.filter(id => !playoffs.matches[id]?.winner);
    const incompleteSFs = (playoffs.semifinals || []).filter(id => !playoffs.matches[id]?.winner);
    const gfIncomplete = playoffs.grandFinal && !playoffs.matches[playoffs.grandFinal]?.winner;
    
    let matchesToSimulate = [];
    let roundName = '';
    
    if (incompleteQFs.length > 0) {
        matchesToSimulate = incompleteQFs;
        roundName = 'Quarterfinals';
    } else if (incompleteSFs.length > 0) {
        matchesToSimulate = incompleteSFs;
        roundName = 'Semifinals';
    } else if (gfIncomplete) {
        matchesToSimulate = [playoffs.grandFinal];
        roundName = 'Grand Final';
    } else {
        alert('All playoff matches are complete!');
        return;
    }
    
    if (!confirm(`Simulate ${matchesToSimulate.length} match(es) in ${roundName}?`)) {
        return;
    }
    
    // Simulate each match
    let simulated = 0;
    matchesToSimulate.forEach(matchId => {
        const match = playoffs.matches[matchId];
        if (match && match.team1 && match.team2 && !match.winner) {
            // Use internal simulation logic
            simulateChampionsMatch(matchId, match.team1, match.team2, activeSave, saveCareer, freshChampionsState, 'playoff');
            simulated++;
        }
    });
    
    console.log(`Simulated ${simulated} matches in ${roundName}`);
}

// Helper function to simulate all remaining playoff matches
function simulateAllPlayoffs(activeSave, saveCareer, championsState) {
    const saveData = loadCareer() || loadCareerSave() || activeSave;
    const freshChampionsState = saveData?.championsState || championsState;
    const playoffs = freshChampionsState?.playoffs;
    
    if (!playoffs) {
        alert('No playoffs found!');
        return;
    }
    
    // Collect all incomplete matches
    const allIncomplete = [
        ...playoffs.quarterfinals.filter(id => !playoffs.matches[id]?.winner),
        ...(playoffs.semifinals || []).filter(id => !playoffs.matches[id]?.winner),
        ...(playoffs.grandFinal && !playoffs.matches[playoffs.grandFinal]?.winner ? [playoffs.grandFinal] : [])
    ];
    
    if (allIncomplete.length === 0) {
        alert('All playoff matches are already complete!');
        return;
    }
    
    if (!confirm(`Simulate all ${allIncomplete.length} remaining playoff match(es)?`)) {
        return;
    }
    
    // Simulate all matches with a slight delay between each
    let index = 0;
    function simulateNext() {
        if (index >= allIncomplete.length) {
            window.location.reload();
            return;
        }
        
        const matchId = allIncomplete[index];
        const match = playoffs.matches[matchId];
        
        if (match && match.team1 && match.team2 && !match.winner) {
            // For batch simulation, we need to reload state each time
            const currentSave = loadCareer() || saveData;
            const currentState = currentSave?.championsState || freshChampionsState;
            
            simulateChampionsMatch(matchId, match.team1, match.team2, activeSave, saveCareer, currentState, 'playoff');
        }
        
        index++;
        // The page reloads after each simulation, so this batch approach needs adjustment
        // For now, just simulate one at a time
    }
    
    // Since each simulation reloads the page, we can only do one
    // The user will need to click again for subsequent matches
    const matchId = allIncomplete[0];
    const match = playoffs.matches[matchId];
    if (match && match.team1 && match.team2) {
        simulateChampionsMatch(matchId, match.team1, match.team2, activeSave, saveCareer, freshChampionsState, 'playoff');
    }
}

// Show match statistics modal with tabs for ALL and individual maps
function showMatchStats(matchId, championsState) {
    const saveData = loadCareer() || {};
    const state = saveData.championsState || championsState;
    
    // Find match in groupMatches or playoffs
    let match = state?.groupMatches?.[matchId];
    let isPlayoff = false;
    if (!match && state?.playoffs?.matches) {
        match = state.playoffs.matches[matchId];
        isPlayoff = true;
    }
    
    if (!match || !match.playerStats) {
        alert('No statistics available for this match.');
        return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(180deg, #0f1923 0%, #0a0f14 100%);
        width: 95%; max-width: 1000px; max-height: 90vh;
        border-radius: 16px; border: 2px solid rgba(255,215,0,0.4);
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 30px 80px rgba(0,0,0,0.7);
    `;
    
    // Header with scoreboard style
    const t1Score = match.score?.split('-')[0] || '0';
    const t2Score = match.score?.split('-')[1] || '0';
    const t1Won = match.winner === match.team1;
    const t2Won = match.winner === match.team2;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 24px 32px;
        background: linear-gradient(90deg, ${t1Won ? 'rgba(72,187,120,0.15)' : 'rgba(252,129,129,0.1)'} 0%, transparent 50%, ${t2Won ? 'rgba(72,187,120,0.15)' : 'rgba(252,129,129,0.1)'} 100%);
        border-bottom: 2px solid rgba(255,215,0,0.3);
        position: relative;
    `;
    
    // Map results section with clickable tabs
    let mapsHtml = '';
    let mapTabs = [{ id: 'all', label: 'ALL', mapName: 'Overall' }];
    
    if (match.mapResults && match.mapResults.length > 0) {
        match.mapResults.forEach((m, i) => {
            const mapDisplayName = m.overtime ? `${m.map} ⏱️` : m.map;
            mapTabs.push({ id: `map-${i}`, label: `Map ${i+1}`, mapName: mapDisplayName, mapIdx: i, overtime: m.overtime });
        });
        
        mapsHtml = `
            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap;" id="map-tabs">
                ${mapTabs.map((tab, i) => `
                    <div class="map-tab ${tab.id === 'all' ? 'active' : ''}" data-tab="${tab.id}" data-map-idx="${tab.mapIdx !== undefined ? tab.mapIdx : 'all'}" style="
                        background: ${tab.id === 'all' 
                            ? 'linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 100%)' 
                            : tab.overtime 
                                ? 'linear-gradient(180deg, rgba(237,137,54,0.2) 0%, rgba(237,137,54,0.05) 100%)' 
                                : 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'};
                        border: 2px solid ${tab.id === 'all' ? '#FFD700' : tab.overtime ? '#ed8936' : 'rgba(255,255,255,0.2)'};
                        border-radius: 10px; padding: 10px 18px;
                        display: flex; flex-direction: column; align-items: center; min-width: 80px;
                        cursor: pointer; transition: all 0.2s ease;">
                        <span style="color: ${tab.id === 'all' ? '#FFD700' : tab.overtime ? '#ed8936' : '#8b9dc3'}; font-size: 10px; font-weight: 700; text-transform: uppercase;">${tab.label}</span>
                        <span style="color: #fff; font-size: 13px; font-weight: 600;">${tab.mapName}</span>
                        ${tab.overtime ? '<span style="color: #ed8936; font-size: 9px;">OT</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <img src="${getTeamLogo(match.team1)}" style="width: 48px; height: 48px; object-fit: contain; ${t1Won ? '' : 'filter: grayscale(0.5) opacity(0.7);'}">
                <div>
                    <div style="font-size: 16px; color: ${t1Won ? '#48bb78' : '#fc8181'}; font-weight: 700;">${match.team1}</div>
                    <div style="font-size: 36px; color: #fff; font-weight: 800; line-height: 1;">${t1Score}</div>
                </div>
            </div>
            <div style="text-align: center;">
                <div style="color: #FFD700; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">VS</div>
                <div style="color: #8b9dc3; font-size: 11px; margin-top: 4px;">${match.isBo3 ? 'Best of 3' : 'Best of 1'}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; text-align: right;">
                <div>
                    <div style="font-size: 16px; color: ${t2Won ? '#48bb78' : '#fc8181'}; font-weight: 700;">${match.team2}</div>
                    <div style="font-size: 36px; color: #fff; font-weight: 800; line-height: 1;">${t2Score}</div>
                </div>
                <img src="${getTeamLogo(match.team2)}" style="width: 48px; height: 48px; object-fit: contain; ${t2Won ? '' : 'filter: grayscale(0.5) opacity(0.7);'}">
            </div>
        </div>
        ${mapsHtml}
        <button class="close-stats" style="position: absolute; right: 16px; top: 16px; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 20px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
    `;
    content.appendChild(header);
    
    // Stats container
    const statsContainer = document.createElement('div');
    statsContainer.id = 'stats-container';
    statsContainer.style.cssText = `
        padding: 24px 32px; overflow-y: auto; flex: 1; background: #0a0f14;
    `;
    content.appendChild(statsContainer);
    
    // Render stats function
    const renderStats = (tabId, mapIdx) => {
        let statsToUse = match.playerStats;
        let isAll = true;
        
        // If viewing individual map, use per-map stats
        if (mapIdx !== 'all' && match.playerStatsPerMap && match.playerStatsPerMap[mapIdx]) {
            statsToUse = match.playerStatsPerMap[mapIdx];
            isAll = false;
        }
        
        const allPlayers = Object.values(statsToUse);
        
        const renderTeamStats = (teamName, players) => {
            if (players.length === 0) return '';
            const logo = getTeamLogo(teamName);
            const isWinner = match.winner === teamName;
            const mapWon = isAll ? isWinner : (match.mapResults[mapIdx]?.winner === teamName);
            
            return `
                <div style="margin-bottom: 32px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${mapWon ? 'rgba(72,187,120,0.4)' : 'rgba(252,129,129,0.3)'};">
                        <img src="${logo}" style="width: 32px; height: 32px; object-fit: contain;">
                        <div>
                            <h3 style="margin: 0; color: #fff; font-size: 16px; font-weight: 700;">${teamName}</h3>
                            <span style="color: ${mapWon ? '#48bb78' : '#fc8181'}; font-size: 11px; font-weight: 600;">${mapWon ? (isAll ? '🏆 MATCH WINNER' : '🏆 MAP WINNER') : (isAll ? '❌ DEFEATED' : '❌ MAP LOSER')}</span>
                        </div>
                        ${!isAll ? `<span style="color: #8b9dc3; font-size: 11px; margin-left: auto;">${match.mapResults[mapIdx]?.score || ''}</span>` : ''}
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;">
                            <thead>
                                <tr style="background: rgba(255,215,0,0.1);">
                                    <th style="padding: 12px 8px; text-align: left; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">Player</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">Agent</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">ACS</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">K</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">D</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">A</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">KDA</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">ADR</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">KAST</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">FB</th>
                                    <th style="padding: 12px 8px; text-align: center; color: #FFD700; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid rgba(255,215,0,0.3);">HS%</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${players
                                    .sort((a, b) => (b.acs || 0) - (a.acs || 0))
                                    .map((p, i) => {
                                        const kda = ((p.kills + p.assists) / Math.max(p.deaths, 1)).toFixed(2);
                                        const adr = Math.round(p.damage / Math.max(p.rounds, 1));
                                        return `
                                            <tr style="background: ${i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
                                                <td style="padding: 10px 8px; color: #fff; font-weight: 600;">${p.name}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #8b9dc3; font-size: 11px;">${p.agent || '?'}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #FFD700; font-weight: 800; font-size: 14px;">${p.acs || '-'}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #48bb78; font-weight: 700;">${p.kills}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #fc8181; font-weight: 600;">${p.deaths}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #8b9dc3; font-weight: 600;">${p.assists}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #fff; font-weight: 700; font-size: 13px;">${kda}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #FFD700; font-weight: 600;">${adr}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #63b3ed; font-weight: 600;">${p.kast || '-'}%</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #ed8936; font-weight: 700;">${p.firstBloods || 0}</td>
                                                <td style="padding: 10px 8px; text-align: center; color: #9f7aea; font-weight: 600;">${p.headshotPercent || '-'}%</td>
                                            </tr>
                                        `;
                                    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        };
        
        const t1Players = allPlayers.filter(p => p.teamName === match.team1);
        const t2Players = allPlayers.filter(p => p.teamName === match.team2);
        
        return `
            ${renderTeamStats(match.team1, t1Players)}
            ${renderTeamStats(match.team2, t2Players)}
            <div style="text-align: center; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #8b9dc3; font-size: 11px;">ACS = Average Combat Score | KAST = Kill, Assist, Survive, Trade % | FB = First Bloods</span>
            </div>
        `;
    };
    
    // Initial render - ALL stats
    statsContainer.innerHTML = renderStats('all', 'all');
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .map-tab:hover {
            border-color: #FFD700 !important;
            background: linear-gradient(180deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.05) 100%) !important;
        }
        .map-tab.active {
            border-color: #FFD700 !important;
            background: linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 100%) !important;
        }
        .map-tab.active span:first-child {
            color: #FFD700 !important;
        }
    `;
    modal.appendChild(style);
    
    // Tab click handlers
    header.querySelectorAll('.map-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active state
            header.querySelectorAll('.map-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)';
                t.style.borderColor = 'rgba(255,255,255,0.2)';
                t.querySelector('span:first-child').style.color = '#8b9dc3';
            });
            tab.classList.add('active');
            tab.style.background = 'linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 100%)';
            tab.style.borderColor = '#FFD700';
            tab.querySelector('span:first-child').style.color = '#FFD700';
            
            // Render stats for selected tab
            const mapIdx = tab.dataset.mapIdx;
            statsContainer.innerHTML = renderStats(tab.dataset.tab, mapIdx);
        });
    });
    
    // Close handlers
    modal.querySelector('.close-stats').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function updateGroupAfterMatch(state, group) {
    const groupTeams = state.groups[group];
    if (!groupTeams) return;
    
    // Calculate standings based on wins
    const standings = groupTeams.map(team => {
        const stats = state.teamStats?.[team] || { wins: 0, losses: 0 };
        return { name: team, ...stats };
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    
    // Update advancing teams
    state.advancingTeams = state.advancingTeams || {};
    state.advancingTeams[group] = standings.slice(0, 2).map(t => t.name);
}

function loadCareerSave() {
    const careerData = localStorage.getItem('careerSave');
    if (careerData) {
        return JSON.parse(careerData);
    }
    return {};
    // match.html handles the simulation and saves results back to championsState
}

function setupDebugHandlers(activeSave, saveCareer, navigateTo) {
    // Initialize Champions button
    const initBtn = document.getElementById('debug-init-champions');
    if (initBtn) {
        initBtn.onclick = () => {
            const qualifiedTeams = activeSave.championsQualified || [];
            if (qualifiedTeams.length < 16) {
                alert('Need at least 16 qualified teams!');
                return;
            }
            
            console.log('DEBUG: Manually initializing Champions with', qualifiedTeams.length, 'teams');
            
            const newState = automate16TeamChampions(
                qualifiedTeams.map(t => typeof t === 'string' ? { name: t } : t),
                activeSave.players || [],
                null,
                null,
                activeSave.team,
                'CHAMP-',
                activeSave.week || 36
            );
            
            activeSave.championsState = newState;
            saveCareer(activeSave);
            
            console.log('DEBUG: Champions initialized:', newState.groups);
            alert(`Champions 2025 initialized!\nGroups: ${JSON.stringify(newState.groups, null, 2)}`);
            
            // Re-render to show the groups
            renderChampions(activeSave, saveCareer, navigateTo);
        };
    }
    
    // Force Qualify button - auto-fill remaining teams
    const forceBtn = document.getElementById('debug-force-qualify');
    if (forceBtn) {
        forceBtn.onclick = () => {
            let qualified = activeSave.championsQualified || [];
            const championshipPoints = activeSave.championshipPoints || {};
            const REGIONS = ['Americas', 'EMEA', 'Pacific', 'China'];
            
            // Helper to get team region from teams data
            const getTeamRegion = (teamName) => {
                const teamData = teams.find(t => t.name === teamName);
                return teamData?.region || 'Americas';
            };
            
            // Convert existing qualified to objects with region
            let qualifiedByRegion = {
                Americas: [], EMEA: [], Pacific: [], China: []
            };
            
            qualified.forEach(q => {
                const teamName = typeof q === 'string' ? q : q.name;
                const region = typeof q === 'string' ? getTeamRegion(q) : (q.region || getTeamRegion(q.name));
                const points = championshipPoints[teamName] || 0;
                if (qualifiedByRegion[region] && qualifiedByRegion[region].length < 4) {
                    qualifiedByRegion[region].push({ name: teamName, points, region });
                }
            });
            
            // Get all teams by region sorted by points
            const teamsByRegion = { Americas: [], EMEA: [], Pacific: [], China: [] };
            
            Object.entries(championshipPoints).forEach(([name, points]) => {
                const region = getTeamRegion(name);
                if (teamsByRegion[region]) {
                    teamsByRegion[region].push({ name, points, region });
                }
            });
            
            // Sort each region by points
            REGIONS.forEach(region => {
                teamsByRegion[region].sort((a, b) => b.points - a.points);
            });
            
            // Fill each region to exactly 4 teams
            REGIONS.forEach(region => {
                const existing = qualifiedByRegion[region].map(t => t.name);
                for (const team of teamsByRegion[region]) {
                    if (qualifiedByRegion[region].length >= 4) break;
                    if (!existing.includes(team.name)) {
                        qualifiedByRegion[region].push(team);
                    }
                }
            });
            
            // If still not enough in any region, fill from remaining teams
            const usedTeams = new Set(Object.values(qualifiedByRegion).flat().map(t => t.name));
            const remainingTeams = teams
                .filter(t => !usedTeams.has(t.name))
                .map(t => ({
                    name: t.name,
                    points: championshipPoints[t.name] || 0,
                    region: t.region
                }));
            
            REGIONS.forEach(region => {
                while (qualifiedByRegion[region].length < 4 && remainingTeams.length > 0) {
                    const team = remainingTeams.find(t => t.region === region) || remainingTeams[0];
                    if (team) {
                        qualifiedByRegion[region].push(team);
                        const idx = remainingTeams.indexOf(team);
                        remainingTeams.splice(idx, 1);
                    }
                }
            });
            
            // Flatten to final list
            const finalQualified = [];
            REGIONS.forEach(region => {
                qualifiedByRegion[region].forEach(t => finalQualified.push(t));
            });
            
            // Log region distribution
            const regionCount = {};
            REGIONS.forEach(r => regionCount[r] = qualifiedByRegion[r].length);
            console.log('Force Qualify - Region distribution:', regionCount);
            console.log('Force Qualify - All teams:', finalQualified.map(t => `${t.name} (${t.region})`));
            
            activeSave.championsQualified = finalQualified;
            saveCareer(activeSave);
            
            alert(`Force qualified ${finalQualified.length} teams!\nRegion distribution: ${JSON.stringify(regionCount)}\n\nClick "Initialize Champions" to create the groups.`);
            renderChampions(activeSave, saveCareer, navigateTo);
        };
    }
    
    // Skip to Week 36 button
    const skipBtn = document.getElementById('debug-skip-to-groups');
    if (skipBtn) {
        skipBtn.onclick = () => {
            activeSave.week = 36;
            saveCareer(activeSave);
            alert('Week set to 36. Click "Initialize Champions" to create the groups.');
            renderChampions(activeSave, saveCareer, navigateTo);
        };
    }
    
    // Clear Champions button - reset tournament state
    const clearBtn = document.getElementById('debug-clear-champions');
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (!confirm('🗑️ Clear all Champions 2025 data? This will reset the tournament state.')) {
                return;
            }
            
            // Clear champions state
            delete activeSave.championsState;
            
            // Reset qualified teams (keep the list but allow re-initialization)
            // Optionally clear qualified teams too:
            // delete activeSave.championsQualified;
            // delete activeSave.championsQualifiedByRegion;
            
            saveCareer(activeSave);
            
            alert('Champions 2025 data cleared! The debug panel should now appear.');
            renderChampions(activeSave, saveCareer, navigateTo);
        };
    }
    
    // Force Create Playoffs button - create quarterfinals based on current group standings
    const createPlayoffsBtn = document.getElementById('debug-create-playoffs');
    if (createPlayoffsBtn) {
        createPlayoffsBtn.onclick = () => {
            const cs = activeSave.championsState;
            if (!cs || !cs.groups) {
                alert('No Champions state found! Please initialize the tournament first.');
                return;
            }
            
            // Initialize playoffs structure
            if (!cs.playoffs) {
                cs.playoffs = {
                    quarterfinals: [],
                    semifinals: [],
                    grandFinal: null,
                    matches: {}
                };
            }
            
            // Get top 2 from each group
            const advancingTeams = [];
            const groups = ['A', 'B', 'C', 'D'];
            groups.forEach(g => {
                const groupTeams = cs.groups[g];
                if (groupTeams) {
                    const standings = groupTeams.map(team => ({
                        name: team,
                        ...(cs.teamStats?.[team] || { wins: 0, losses: 0 })
                    })).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
                    
                    // Top 2 advance
                    advancingTeams.push(...standings.slice(0, 2).map(t => t.name));
                    console.log(`Group ${g} advancing:`, standings.slice(0, 2).map(t => `${t.name} (${t.wins}-${t.losses})`));
                }
            });
            
            if (advancingTeams.length !== 8) {
                alert(`Need exactly 8 advancing teams (top 2 from each group), but found ${advancingTeams.length}.`);
                return;
            }
            
            console.log("Creating playoffs with teams:", advancingTeams);
            
            // Create Quarterfinals
            const qfMatchups = [
                [advancingTeams[0], advancingTeams[3]], // A1 vs B2
                [advancingTeams[2], advancingTeams[1]], // B1 vs A2
                [advancingTeams[4], advancingTeams[7]], // C1 vs D2
                [advancingTeams[6], advancingTeams[5]]  // D1 vs C2
            ];
            
            const prefix = 'CHAMP-';
            cs.playoffs.quarterfinals = []; // Clear existing
            qfMatchups.forEach((matchup, index) => {
                const matchId = `${prefix}QF-${index + 1}`;
                cs.playoffs.matches[matchId] = {
                    team1: matchup[0],
                    team2: matchup[1],
                    winner: null,
                    loser: null,
                    score: null,
                    round: 'quarterfinals'
                };
                cs.playoffs.quarterfinals.push(matchId);
            });
            
            saveCareer(activeSave);
            
            console.log("Quarterfinals created:", cs.playoffs.quarterfinals);
            alert(`Playoffs created!\n\nQuarterfinals:\n${qfMatchups.map((m, i) => `QF${i+1}: ${m[0]} vs ${m[1]}`).join('\n')}`);
            
            renderChampions(activeSave, saveCareer, navigateTo);
        };
    }
}

function navigateTo(page) {
    window.location.href = `${page}.html`;
}
