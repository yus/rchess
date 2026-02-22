// Rchess Learner Module
class RchessLearner {
    constructor(storageKey = 'rchess_db') {
        this.storageKey = storageKey;
        this.db = this.loadDatabase();
        this.currentGame = null;
    }

    // ===== DATABASE MANAGEMENT =====
    
    loadDatabase() {
        try {
            let data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn("Error loading database:", e);
        }
        
        // Default empty database
        return {
            positions: {},      // Hash -> position data
            games: [],          // List of played games
            patterns: {},       // Pattern statistics
            metadata: {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                totalGames: 0
            }
        };
    }

    saveDatabase() {
        try {
            this.db.metadata.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(this.db));
            return true;
        } catch (e) {
            console.warn("Error saving database:", e);
            return false;
        }
    }

    exportDatabase() {
        let data = JSON.stringify(this.db, null, 2);
        let blob = new Blob([data], {type: 'application/json'});
        let url = URL.createObjectURL(blob);
        
        let a = document.createElement('a');
        a.href = url;
        a.download = `rchess_${new Date().toISOString().slice(0,10)}.db.json`;
        a.click();
        
        return data;
    }

    importDatabase(jsonData) {
        try {
            this.db = JSON.parse(jsonData);
            this.saveDatabase();
            return true;
        } catch (e) {
            console.warn("Error importing database:", e);
            return false;
        }
    }

    // ===== POSITION HASHING =====
    
    /**
     * Create a unique hash for a board position
     * Format: piece placement + side to move + castling rights + en passant
     * Simplified for Rchess: just piece placement and side to move
     */
    hashPosition(board, currentPlayer = 'white') {
        let str = '';
        
        // Add piece placement (FEN-like but simpler)
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece) {
                    if (empty > 0) {
                        str += empty;
                        empty = 0;
                    }
                    // Encode: color(1 char) + type(1 char)
                    str += piece.color === 'white' ? 'w' : 'b';
                    str += this.pieceToChar(piece.pieceType);
                } else {
                    empty++;
                }
            }
            if (empty > 0) str += empty;
            if (r < 7) str += '/';
        }
        
        // Add side to move
        str += currentPlayer === 'white' ? 'w' : 'b';
        
        // Create a short hash (first 8 chars of base64)
        return btoa(str).slice(0, 8).replace(/[+/=]/g, '');
    }

    pieceToChar(type) {
        const map = {
            'pawn': 'p',
            'knight': 'n',
            'bishop': 'b',
            'rook': 'r',
            'queen': 'q',
            'king': 'k'
        };
        return map[type] || '?';
    }

    // ===== GAME TRACKING =====
    
    /**
     * Start tracking a new game
     */
    startGame() {
        this.currentGame = {
            id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            startTime: new Date().toISOString(),
            positions: [],      // List of position hashes
            moves: [],          // List of moves played
            result: null,
            players: {
                white: 'human',
                black: 'computer'
            }
        };
        return this.currentGame;
    }

    /**
     * Record a position during the game
     */
    recordPosition(board, currentPlayer, move = null) {
        if (!this.currentGame) {
            this.startGame();
        }
        
        let hash = this.hashPosition(board, currentPlayer);
        
        this.currentGame.positions.push({
            hash: hash,
            move: move,
            player: currentPlayer,
            timestamp: Date.now()
        });
        
        if (move) {
            this.currentGame.moves.push(move);
        }
        
        // Update position statistics
        this.updatePositionStats(hash, board, currentPlayer);
        
        return hash;
    }

    /**
     * End game and record result
     */
    endGame(result) { // result: 'white', 'black', 'draw'
        if (!this.currentGame) return null;
        
        this.currentGame.result = result;
        this.currentGame.endTime = new Date().toISOString();
        
        // Add to games list
        this.db.games.push(this.currentGame);
        this.db.metadata.totalGames++;
        
        // Update all positions in this game with result
        this.updateGamePositions(this.currentGame, result);
        
        let gameData = this.currentGame;
        this.currentGame = null;
        
        this.saveDatabase();
        return gameData;
    }

    // ===== POSITION STATISTICS =====
    
    /**
     * Update statistics for a position
     */
    updatePositionStats(hash, board, currentPlayer) {
        if (!this.db.positions[hash]) {
            // New position
            this.db.positions[hash] = {
                hash: hash,
                fen: this.boardToFEN(board, currentPlayer),
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                totalGames: 0,
                outcomes: {
                    white: 0,
                    black: 0,
                    draw: 0
                },
                moves: {},      // Move -> statistics
                patterns: this.detectPatterns(board, currentPlayer),
                popularity: 0
            };
        }
        
        let pos = this.db.positions[hash];
        pos.lastSeen = new Date().toISOString();
        pos.popularity++;
    }

    /**
     * Update all positions in a game with the final result
     */
    updateGamePositions(game, result) {
        let seenHashes = new Set();
        
        game.positions.forEach((pos, index) => {
            if (seenHashes.has(pos.hash)) return;
            seenHashes.add(pos.hash);
            
            let position = this.db.positions[pos.hash];
            if (!position) return;
            
            // Update outcome counts
            if (result === 'white' || result === 'black' || result === 'draw') {
                position.outcomes[result]++;
            }
            position.totalGames++;
            
            // Update move statistics if this position has a move
            if (pos.move && position.moves[pos.move]) {
                let moveStats = position.moves[pos.move];
                if (!moveStats) {
                    moveStats = { played: 0, wins: 0, losses: 0, draws: 0 };
                    position.moves[pos.move] = moveStats;
                }
                
                moveStats.played++;
                
                // Determine if this move led to a win for the player who made it
                let player = pos.player;
                if (result === player) {
                    moveStats.wins++;
                } else if (result === 'draw') {
                    moveStats.draws++;
                } else {
                    moveStats.losses++;
                }
            }
        });
    }

    /**
     * Convert board to simple FEN-like string
     */
    boardToFEN(board, currentPlayer) {
        let fen = '';
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece) {
                    if (empty > 0) {
                        fen += empty;
                        empty = 0;
                    }
                    let symbol = piece.type;
                    fen += symbol;
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (r < 7) fen += '/';
        }
        fen += currentPlayer === 'white' ? ' w' : ' b';
        return fen;
    }

    // ===== PATTERN DETECTION =====
    
    detectPatterns(board, currentPlayer) {
        let patterns = [];
        
        // King safety (simplified)
        if (this.isKingSafe(board, 'white')) patterns.push('white_king_safe');
        if (this.isKingSafe(board, 'black')) patterns.push('black_king_safe');
        
        // Center control
        if (this.controlsCenter(board, 'white')) patterns.push('white_center');
        if (this.controlsCenter(board, 'black')) patterns.push('black_center');
        
        // Bishop pair
        if (this.hasBishopPair(board, 'white')) patterns.push('white_bishop_pair');
        if (this.hasBishopPair(board, 'black')) patterns.push('black_bishop_pair');
        
        // Doubled pawns
        if (this.hasDoubledPawns(board, 'white')) patterns.push('white_doubled_pawns');
        if (this.hasDoubledPawns(board, 'black')) patterns.push('black_doubled_pawns');
        
        return patterns;
    }

    isKingSafe(board, color) {
        // Find king
        let kingPos = null;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece?.pieceType === 'king' && piece?.color === color) {
                    kingPos = {r, c};
                    break;
                }
            }
        }
        if (!kingPos) return false;
        
        // Check if any enemy pieces attack king's square
        // Simplified - in real implementation, check all enemy moves
        return true;
    }

    controlsCenter(board, color) {
        // Check control of e4, d4, e5, d5
        let centerSquares = [[3,3], [3,4], [4,3], [4,4]];
        // Simplified - would need actual attack detection
        return true;
    }

    hasBishopPair(board, color) {
        let bishops = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece?.pieceType === 'bishop' && piece?.color === color) {
                    bishops.push({r, c});
                }
            }
        }
        return bishops.length >= 2;
    }

    hasDoubledPawns(board, color) {
        let pawnFiles = new Array(8).fill(0);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece?.pieceType === 'pawn' && piece?.color === color) {
                    pawnFiles[c]++;
                }
            }
        }
        return pawnFiles.some(count => count > 1);
    }

    // ===== ANALYSIS FUNCTIONS =====
    
    /**
     * Get statistics for a position
     */
    getPositionStats(hash) {
        return this.db.positions[hash] || null;
    }

    /**
     * Get suggested moves for a position
     */
    getMoveSuggestions(hash, color = null) {
        let pos = this.db.positions[hash];
        if (!pos) return [];
        
        let moves = Object.entries(pos.moves)
            .map(([move, stats]) => {
                let winRate = stats.wins / stats.played;
                if (color === 'black') {
                    winRate = stats.losses / stats.played;
                }
                return {
                    move: move,
                    winRate: winRate,
                    played: stats.played,
                    stats: stats
                };
            })
            .sort((a, b) => b.winRate - a.winRate);
        
        return moves;
    }

    /**
     * Find inconsistencies (positions where actual results differ from expected)
     */
    findInconsistencies(threshold = 0.2) {
        let inconsistencies = [];
        
        for (let hash in this.db.positions) {
            let pos = this.db.positions[hash];
            if (pos.totalGames < 5) continue; // Need enough data
            
            // Calculate expected win rate (simplified - 50% for now)
            let expected = 0.5;
            let actual = pos.outcomes.white / pos.totalGames;
            
            if (Math.abs(actual - expected) > threshold) {
                inconsistencies.push({
                    hash: hash,
                    fen: pos.fen,
                    expected: expected,
                    actual: actual,
                    games: pos.totalGames,
                    patterns: pos.patterns,
                    deviation: actual - expected
                });
            }
        }
        
        return inconsistencies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    }

    /**
     * Get opening tree data
     */
    getOpeningTree(depth = 3) {
        let openings = {};
        
        this.db.games.forEach(game => {
            if (game.moves.length < depth) return;
            
            let key = game.moves.slice(0, depth).join(' → ');
            if (!openings[key]) {
                openings[key] = {
                    moves: game.moves.slice(0, depth),
                    games: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0
                };
            }
            
            openings[key].games++;
            if (game.result === 'white') openings[key].wins++;
            else if (game.result === 'black') openings[key].losses++;
            else openings[key].draws++;
        });
        
        return Object.values(openings)
            .sort((a, b) => b.games - a.games)
            .slice(0, 20);
    }

    /**
     * Clear all data
     */
    reset() {
        this.db = {
            positions: {},
            games: [],
            patterns: {},
            metadata: {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                totalGames: 0
            }
        };
        this.saveDatabase();
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.RchessLearner = RchessLearner;
}

// Export for Node (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RchessLearner;
}
