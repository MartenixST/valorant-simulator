import React, { useState } from 'react';
import { handleAiRosterChanges } from '../ai_manager.js';
import { saveCareer, getKickoffState } from '../career_local_storage.jsx';
import { Player } from '../simulation.js';
import CareerLoadingOverlay from './CareerLoadingOverlay.jsx';

const SimWeekButton = ({ activeSave, setActiveSave }) => {
  const [isSimulating, setIsSimulating] = useState(false);

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

      // 3. Process Pending Contract Offers
      const processedOffers = [];
      let updatedPlayersForOffers = [...aiUpdatedSave.players];
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
                return updatedP;
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

      // 4. Update basic info and sync kickoff state
      let updatedSave = {
        ...aiUpdatedSave,
        players: updatedPlayersForOffers,
        pendingOffers: [], // Clear pending offers
        week: nextWeek,
        season: nextSeason,
        kickoffState: getKickoffState(activeSave.id)
      };

      // 5. Create a descriptive inbox message
      let messageContent = `Welcome to Week ${nextWeek} of Season ${nextSeason}.\n\n`;
      
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

      // 5. Save and update state
      // We only call setActiveSave here because App.jsx has a useEffect 
      // that automatically calls saveCareer(activeSave) whenever it changes.
      // Calling both can cause race conditions.
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