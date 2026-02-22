// Initialize learner
const learner = new RchessLearner();

// After each game ends
function gameOver(winner) {
  // Record all positions from the game
  for(let i=0; i<moveHistory.length; i++) {
    let position = recreatePositionAt(i); // You'd need this function
    let move = moveHistory[i];
    learner.recordMove(position, move, winner);
  }
  
  // Check for inconsistencies
  let inconsistencies = learner.findInconsistencies();
  if(inconsistencies.length > 0) {
    console.log("Found interesting positions:", inconsistencies);
    // Could highlight these in UI
  }
}

// For AI move selection with learning
function computerMoveWithLearning() {
  let suggestion = learner.suggestMove(board, aiColor);
  
  if(suggestion && Math.random() < 0.7) { // 70% follow learned moves
    // Execute suggested move
    executeMove(suggestion.move);
  } else {
    // Fall back to regular AI logic
    computerMove();
  }
}
