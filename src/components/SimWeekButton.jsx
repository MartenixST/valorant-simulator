import React, { useState } from 'react';
import { handleAiRosterChanges } from '../ai_manager.js';
import { saveCareer, getKickoffState } from '../career_local_storage.jsx';
import { Player, Team, MatchSimulator } from '../simulation.js';
import { teams, teamLogos } from '../teams.js';
import CareerLoadingOverlay from './CareerLoadingOverlay.jsx';

const SimWeekButton = ({ activeSave, setActiveSave }) => {
  const [isSimulating, setIsSimulating] = useState(false);

  // Helper to simulate a match and return player stats
  const simulateAiMatch = (team1Data, team2Data, savePlayers) => {
    // 1. Prepare Team objects
    const t1 = new Team(team1Data.name, team1Data.id);
    const t2 = new Team(team2Data.name, team2Data.id);

    // 2. Assign players to teams
    const t1Players = savePlayers.filter(p => String(p.teamId) === String(team1Data.id));
    const t2Players = savePlayers.filter(p => String(p.teamId) === String(team2Data.id));

    // Convert to Player instances
    t1.players = t1Players.map(p => Player.fromJSON(p));
    t2.players = t2Players.map(p => Player.fromJSON(p));

    // 3. Simulate match (BO3)
    let t1Maps = 0;
    let t2Maps = 0;
    const mapResults = [];
    const allPlayerStats = {};

    // Initialize stats tracking
    [...t1.players, ...t2.players].forEach(p => {
      allPlayerStats[p.id] = {
        name: p.name,
        teamId: p.teamId,
        teamName: p.teamId === String(team1Data.id) ? team1Data.name : team2Data.name,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        hs: 0,
        rounds: 0
      };
    });

    while (t1Maps < 2 && t2Maps < 2) {
      t1.score = 0;
      t2.score = 0;
      t1.side = 'attack';
      t2.side = 'defense';
      
      const matchSim = new MatchSimulator(t1, t2);
      matchSim.simulateMatch();

      const mapScore = `${t1.score}-${t2.score}`;
      mapResults.push({ score: mapScore });

      if (t1.score >= 13) t1Maps++;
      else t2Maps++;

      // Update aggregated stats from this map
      [...t1.players, ...t2.players].forEach(p => {
        if (allPlayerStats[p.id]) {
          allPlayerStats[p.id].kills += p.stats.kills;
          allPlayerStats[p.id].deaths += p.stats.deaths;
          allPlayerStats[p.id].assists += p.stats.assists;
          allPlayerStats[p.id].damage += p.stats.damageDealt;
          allPlayerStats[p.id].hs += p.stats.hs;
          allPlayerStats[p.id].rounds += (t1.score + t2.score);
        }
      });
    }

    return {
      winner: t1Maps > t2Maps ? team1Data.name : team2Data.name,
      loser: t1Maps > t2Maps ? team2Data.name : team1Data.name,
      score: `${t1Maps}-${t2Maps}`,
      playerStats: allPlayerStats,
      mapResults: mapResults
    };
  };

  const generateContendersMessage = (players) => {
    // Calculate current power/potential for ALL teams based on players in the save
    const teamStats = teams.map(t => {
        const teamPlayers = players.filter(p => String(p.teamId) === String(t.id));
        const avgPower = teamPlayers.length > 0 
            ? Math.round((teamPlayers.reduce((sum, p) => sum + (p.overall || 75), 0) / teamPlayers.length) * 10) / 10
            : Math.round((t.power || 75) * 10) / 10;
        const avgPotential = teamPlayers.length > 0
            ? Math.round((teamPlayers.reduce((sum, p) => sum + (p.potential || 80), 0) / teamPlayers.length) * 10) / 10
            : Math.round((t.potential || 80) * 10) / 10;
            
        return {
            ...t,
            currentPower: avgPower,
            currentPotential: avgPotential,
            strength: Math.round(((avgPower + avgPotential) / 2) * 10) / 10
        };
    });

    const contenders = teamStats.sort((a, b) => b.strength - a.strength).slice(0, 5);
    
    let htmlBody = `
        <div class="contenders-report">
            <p style="margin-bottom: 25px; color: rgba(236, 232, 225, 0.8); line-height: 1.6;">
                The analysts at the League News have updated the definitive list of championship contenders based on recent performance and roster development. These five organizations currently represent the absolute peak of the league.
            </p>
            <div class="contenders-list" style="display: flex; flex-direction: column; gap: 20px;">
    `;

    const reasonPools = {
        elite: [
            "A global powerhouse with a roster that defines the current meta. Their mechanical ceiling is unmatched.",
            "The undisputed giants of the league. Every player on this roster is a legitimate superstar in their own right.",
            "A terrifying combination of raw aim and flawless utility usage. They are currently the benchmark for excellence.",
            "A dynasty in the making. Their tactical depth is only rivaled by their individual fragging power."
        ],
        veteran: [
            "A veteran-heavy squad whose experience and discipline make them a nightmare to play against in high-stakes matches.",
            "Masters of the late-game. This team's composure under pressure is their greatest weapon against less experienced rivals.",
            "A battle-hardened core that knows exactly how to exploit the smallest mistakes in their opponents' setups.",
            "They play the 'boring' but perfect Valorant. Their fundamental execution is so clean it leaves no room for counter-play."
        ],
        rising: [
            "The league's most dangerous young core. Their rapid improvement suggests they will be unstoppable soon.",
            "A high-octane roster of rising stars. What they lack in experience, they more than make up for in sheer mechanical audacity.",
            "An explosive group of newcomers who are currently re-writing the tactical playbook with their aggressive style.",
            "Fearless and unpredictable. This young squad thrives in chaos and can out-aim almost anyone on their day."
        ],
        balanced: [
            "A perfectly balanced organization with deep strategic layers and a consistent track record of excellence.",
            "Renowned for their structural integrity. They play a disciplined style of Valorant that is incredibly difficult to break down.",
            "A well-rounded squad where every player understands their role perfectly, creating a whole that is greater than the sum of its parts.",
            "Masters of adaptation. This team can switch between aggressive and defensive styles mid-map without missing a beat."
        ]
    };

    const usedReasons = new Set();

    contenders.forEach((team, index) => {
        let reason = "";
        const avgStrength = team.strength;
        const logoUrl = teamLogos[team.name] || 'assets/team_logos/default.png';

        let pool;
        if (avgStrength >= 85) {
            pool = reasonPools.elite;
        } else if (team.currentPower > team.currentPotential + 2) {
            pool = reasonPools.veteran;
        } else if (team.currentPotential > team.currentPower + 2) {
            pool = reasonPools.rising;
        } else {
            pool = reasonPools.balanced;
        }

        // Find a reason that hasn't been used in this report
        let availableReasons = pool.filter(r => !usedReasons.has(r));

        // Fallback if somehow all in pool are used
        if (availableReasons.length === 0) {
            availableReasons = pool;
        }

        reason = availableReasons[Math.floor(Math.random() * availableReasons.length)];
        usedReasons.add(reason);

        htmlBody += `
            <div class="contender-item" style="display: flex; align-items: center; gap: 20px; background: rgba(255, 255, 255, 0.03); padding: 15px; border-left: 4px solid #ff4655;">
            <div class="contender-rank" style="font-family: 'Valorant', sans-serif; font-size: 24px; color: #ff4655; min-width: 30px;">#${index + 1}</div>
            <img src="${logoUrl}" alt="${team.name}" style="width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));" />
            <div class="contender-info" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                    <h4 style="margin: 0; font-family: 'Valorant', sans-serif; color: #ece8e1; font-size: 18px; text-transform: uppercase;">${team.name}</h4>
                    <span style="font-size: 10px; color: #00f6ff; background: rgba(0, 246, 255, 0.1); padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">${team.region}</span>
                </div>
                <div style="font-size: 11px; color: rgba(236, 232, 225, 0.5); margin-bottom: 8px; font-weight: bold;">
                    RATING: <span style="color: #00ff85;">${team.currentPower} PWR</span> / <span style="color: #ffb900;">${team.currentPotential} POT</span>
                </div>
                <div style="font-size: 13px; color: rgba(236, 232, 225, 0.7); font-style: italic; line-height: 1.4;">
                    "${reason}"
                </div>
            </div>
        </div>
    `;
    });

    htmlBody += `</div></div>`;

    return {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: "League News",
        subject: "Top 5 Championship Contenders Updated",
        body: htmlBody,
        date: new Date().toLocaleDateString(),
        read: false,
        contentType: 'html'
    };
  };

  const handleSimulateWeek = () => {
    if (!activeSave) return;

    setIsSimulating(true);

    // Add a small delay for the animation effect
    setTimeout(() => {
      // 1. Increment week
      let nextWeek = (activeSave.week || 1) + 1;
      let nextSeason = activeSave.season || 1;
      
      // 2. AI Roster Changes
      const { updatedSave: aiUpdatedSave, changes: rosterChanges } = handleAiRosterChanges(activeSave);

      // 2.5 Simulate AI Team Matches
      const simulatedMatches = [];
      const aiTeams = teams.filter(t => String(t.id) !== String(activeSave.teamId));
      
      // Group teams by region and simulate some intra-regional matches
      const regions = ["Americas", "EMEA", "Pacific", "China"];
      regions.forEach(region => {
        const regionalTeams = aiTeams.filter(t => t.region === region);
        // Shuffle and pair up teams for some matches this week
        const shuffled = [...regionalTeams].sort(() => 0.5 - Math.random());
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          const t1 = shuffled[i];
          const t2 = shuffled[i+1];
          
          // 30% chance of a match happening between these two this week
          if (Math.random() < 0.3) {
            const matchResult = simulateAiMatch(t1, t2, aiUpdatedSave.players);
            simulatedMatches.push({
              winner: matchResult.winner,
              loser: matchResult.loser,
              score: matchResult.score,
              region: region,
              playerStats: matchResult.playerStats,
              mapResults: matchResult.mapResults,
              tournamentName: "Regular Season"
            });
          }
        }
      });

      // 3. Player Development
      // Apply weekly stat fluctuations to all players
      const developedPlayers = aiUpdatedSave.players.map(pData => {
        const player = Player.fromJSON(pData);
        player.rating.develop();
        
        // Return updated data object
        return {
          ...pData,
          rating: { ...player.rating },
          overall: player.overall,
          potential: player.potential
        };
      });

      // 4. Process Pending Contract Offers
      const processedOffers = [];
      let updatedPlayersForOffers = [...developedPlayers];
      const newInboxMessages = [];

      if (activeSave.pendingOffers && activeSave.pendingOffers.length > 0) {
        activeSave.pendingOffers.forEach(offer => {
          const playerObj = updatedPlayersForOffers.find(p => p.id === offer.playerId);
          if (!playerObj) return;

          const player = Player.fromJSON(playerObj);
          const marketValue = player.marketValue || 50000;
          const offeredSalary = offer.offeredSalary;
          
          // Logic for accepting/declining
          // 1. Salary comparison (primary factor)
          const salaryRatio = offeredSalary / marketValue;
          let acceptChance = 0.5; // Base 50% chance

          if (salaryRatio >= 1.5) acceptChance = 0.9;
          else if (salaryRatio >= 1.2) acceptChance = 0.75;
          else if (salaryRatio >= 1.0) acceptChance = 0.5;
          else if (salaryRatio >= 0.8) acceptChance = 0.2;
          else acceptChance = 0.05;

          const accepted = Math.random() < acceptChance;
          let reason = "";

          if (accepted) {
            const acceptReasons = [
                `The salary offer of $${offeredSalary.toLocaleString()} is very competitive and I believe in the vision of your organization.`,
                `I'm looking for a new challenge and your team seems like the perfect fit. The financial terms are also great.`,
                `After discussing with my agent, we've decided that joining your squad is the best move for my career right now.`,
                `The opportunity to play for your team is too good to pass up, especially with the contract you've put on the table.`
            ];
            reason = acceptReasons[Math.floor(Math.random() * acceptReasons.length)];
            
            // Update player team and salary
            updatedPlayersForOffers = updatedPlayersForOffers.map(p => {
              if (p.id === player.id) {
                const updatedP = Player.fromJSON(p);
                updatedP.teamId = String(activeSave.teamId);
                updatedP.team = activeSave.team;
                updatedP.marketValue = offeredSalary; // New contract salary
                return {
                    ...p,
                    teamId: updatedP.teamId,
                    team: updatedP.team,
                    marketValue: updatedP.marketValue
                };
              }
              return p;
            });
          } else {
            const declineReasons = [
                `The salary offer of $${offeredSalary.toLocaleString()} doesn't quite match my expectations given my current market value.`,
                `I've decided to stay with my current team for now. We have unfinished business here.`,
                `While I appreciate the interest, I don't feel that your team's current project aligns with my career goals.`,
                `I'm currently happy where I am and the offer wasn't convincing enough to make me consider a move.`
            ];
            reason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
          }

          newInboxMessages.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: player.name || player.gamertag,
            subject: accepted ? "Contract Offer Accepted" : "Contract Offer Declined",
            body: `Hi Management,\n\n${reason}\n\nBest regards,\n${player.name || player.gamertag}`,
            date: new Date().toLocaleDateString(),
            read: false
          });
        });
      }

      // 5. Update basic info and sync kickoff state
      let updatedSave = {
        ...aiUpdatedSave,
        players: updatedPlayersForOffers,
        pendingOffers: [], // Clear pending offers
        week: nextWeek,
        season: nextSeason,
        history: [...(aiUpdatedSave.history || []), ...simulatedMatches.map(m => ({
          type: 'match',
          week: activeSave.week,
          text: `${m.winner} def. ${m.loser} (${m.score})`,
          details: m
        }))],
        kickoffState: getKickoffState(activeSave.id),
        regularSeasonMatches: [...(aiUpdatedSave.regularSeasonMatches || []), ...simulatedMatches]
      };

      // 6. Periodic Updates (Top 5 Contenders)
      if (nextWeek % 4 === 0) {
        const contendersMessage = generateContendersMessage(updatedPlayersForOffers);
        newInboxMessages.push(contendersMessage);
      }

      // 7. Create a descriptive inbox message
      let messageContent = `Welcome to Week ${nextWeek} of Season ${nextSeason}.\n\n`;
      
      if (simulatedMatches.length > 0) {
        messageContent += "Recent League Results:\n";
        simulatedMatches.forEach(m => {
          messageContent += `- ${m.winner} defeated ${m.loser} (${m.score})\n`;
        });
        messageContent += "\n";
      }

      if (rosterChanges.length > 0) {
        messageContent += "League News & Roster Changes:\n";
        rosterChanges.forEach(change => {
          messageContent += `- ${change}\n`;
        });
      } else {
        messageContent += "It was a relatively quiet week in the league with no major roster moves.";
      }

      const reportMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: "League Office",
        subject: `Week ${nextWeek} Report`,
        body: messageContent,
        date: new Date().toLocaleDateString(),
        read: false
      };
      
      updatedSave.inbox = [...newInboxMessages, reportMessage, ...(updatedSave.inbox || [])];
      console.log("SimWeekButton: Updated inbox count:", updatedSave.inbox.length);
      console.log("SimWeekButton: New message subject:", reportMessage.subject);

      // 8. Save and update state
      setActiveSave(updatedSave);
      
      setIsSimulating(false);
      console.log("Week simulated:", nextWeek);
    }, 1500);
  };

  return (
    <>
      {isSimulating && <CareerLoadingOverlay />}
      <button 
        className="sim-week-btn" 
        onClick={handleSimulateWeek}
        disabled={isSimulating}
      >
        {isSimulating ? 'Simulating...' : 'Simulate Week'}
      </button>
    </>
  );
};

export default SimWeekButton;