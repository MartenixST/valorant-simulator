export function startCustomMatch(bestOf) {
  let playerScore = 0;
  let aiScore = 0;
  let log = "";

  for (let game = 1; game <= bestOf; game++) {
    let playerRound = 0;
    let aiRound = 0;

    for (let round = 1; round <= 13; round++) {
      const playerChance = Math.random() * 10;
      const aiChance = Math.random() * 10;

      if (playerChance + Math.random() > aiChance) {
        playerRound++;
      } else {
        aiRound++;
      }

      if (playerRound >= 13 || aiRound >= 13) break;
    }

    if (playerRound > aiRound) {
      playerScore++;
      log += `<p>Game ${game}: You won (${playerRound} - ${aiRound})</p>`;
    } else {
      aiScore++;
      log += `<p>Game ${game}: AI won (${aiRound} - ${playerRound})</p>`;
    }

    if (playerScore > bestOf / 2 || aiScore > bestOf / 2) break;
  }

  document.getElementById("match-log").innerHTML =
    `<h3>Match Result</h3>${log}<p>Final Score: You ${playerScore} - ${aiScore} AI</p>`;
}

// Attach to window for legacy HTML access
window.startCustomMatch = startCustomMatch;
