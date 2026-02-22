class RchessLearner {
  constructor() {
    this.db = this.loadDatabase();
    this.patterns = new Map();
  }
  
  // Generate position hash (simplified FEN)
  hashPosition(board) {
    let str = '';
    for(let r=0; r<8; r++) {
      let empty = 0;
      for(let c=0; c<8; c++) {
        let piece = board[r][c];
        if(piece) {
          if(empty > 0) str += empty;
          str += piece.color[0] + piece.pieceType[0];
          empty = 0;
        } else {
          empty++;
        }
      }
      if(empty > 0) str += empty;
      if(r<7) str += '/';
    }
    return btoa(str).slice(0,8); // Simple hash
  }
  
  // Record a played move
  recordMove(position, move, result) {
    let hash = this.hashPosition(position);
    let pos = this.db.positions.find(p => p.hash === hash);
    
    if(!pos) {
      pos = {
        hash: hash,
        fen: this.toFEN(position),
        evaluations: {white:0, black:0, draw:0},
        moves: {},
        patterns: this.detectPatterns(position),
        last_seen: new Date().toISOString().split('T')[0]
      };
      this.db.positions.push(pos);
    }
    
    if(!pos.moves[move]) {
      pos.moves[move] = {played:0, wins:0, losses:0, draws:0};
    }
    
    pos.moves[move].played++;
    if(result === 'white') pos.moves[move].wins++;
    else if(result === 'black') pos.moves[move].losses++;
    else pos.moves[move].draws++;
    
    this.saveDatabase();
  }
  
  // Detect patterns in position
  detectPatterns(position) {
    let patterns = [];
    
    // King safety
    if(this.isKingSafe(position, 'white')) patterns.push('white_king_safe');
    if(this.isKingSafe(position, 'black')) patterns.push('black_king_safe');
    
    // Center control
    if(this.controlsCenter(position, 'white')) patterns.push('white_center');
    if(this.controlsCenter(position, 'black')) patterns.push('black_center');
    
    // Pawn structure
    if(this.hasDoubledPawns(position, 'white')) patterns.push('white_doubled_pawns');
    
    // Bishop pair
    if(this.hasBishopPair(position, 'white')) patterns.push('white_bishop_pair');
    
    return patterns;
  }
  
  // Find inconsistencies in expected vs actual
  findInconsistencies() {
    let inconsistencies = [];
    
    for(let pos of this.db.positions) {
      if(pos.games_played < 5) continue; // Need enough data
      
      // Calculate expected win rate from similar positions
      let expected = this.expectedWinRate(pos);
      let actual = pos.wins / pos.games_played;
      
      if(Math.abs(expected - actual) > 0.2) { // 20% deviation
        inconsistencies.push({
          position: pos.hash,
          expected: expected,
          actual: actual,
          games: pos.games_played
        });
      }
    }
    
    return inconsistencies;
  }
  
  // Suggest move based on learned data
  suggestMove(position, color) {
    let hash = this.hashPosition(position);
    let pos = this.db.positions.find(p => p.hash === hash);
    
    if(!pos || Object.keys(pos.moves).length === 0) {
      return null; // No data yet
    }
    
    let moves = Object.entries(pos.moves);
    
    // Calculate win rate for each move
    let scored = moves.map(([move, stats]) => {
      let winRate = stats.wins / stats.played;
      if(color === 'black') winRate = stats.losses / stats.played;
      
      // Add exploration bonus for less-played moves
      let exploration = 0.1 * (1 - stats.played / 20);
      
      return {
        move: move,
        score: winRate + exploration,
        played: stats.played
      };
    });
    
    // Sort by score
    scored.sort((a,b) => b.score - a.score);
    
    return scored[0];
  }
  
  saveDatabase() {
    localStorage.setItem('rchess_db', JSON.stringify(this.db));
  }
  
  loadDatabase() {
    let data = localStorage.getItem('rchess_db');
    return data ? JSON.parse(data) : {positions: [], games: [], inconsistencies: []};
  }
}
