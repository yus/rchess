// rchess-distribution.js
// Chess 960-Style Random Distribution with opposite-square requirements

const RChessDistribution = (function() {
    // Piece symbols for display
    const symbols = {
        white: { rook:'♜', knight:'♞', bishop:'♝', queen:'♛', king:'♚', pawn:'♟' },
        black: { rook:'♖', knight:'♘', bishop:'♗', queen:'♕', king:'♔', pawn:'♙' }
    };

    // Get square color (light or dark)
    function getSquareColor(row, col) {
        return (row + col) % 2 === 0 ? 'light' : 'dark';
    }

    // Shuffle array utility
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Generate a valid random distribution for one side
     * @param {string} color - 'white' or 'black'
     * @param {Array} rows - rows to place pieces on (e.g., [0,1] for white, [6,7] for black)
     * @returns {Array} 2D array of piece objects for the specified rows
     */
    function generateSide(color, rows) {
        // Create 2D array for just these rows
        let sideBoard = Array(8).fill().map(() => Array(8).fill(null));
        
        // Separate light and dark squares in these rows
        let lightSquares = [];
        let darkSquares = [];
        
        for (let r of rows) {
            for (let c = 0; c < 8; c++) {
                if (getSquareColor(r, c) === 'light') {
                    lightSquares.push({row: r, col: c});
                } else {
                    darkSquares.push({row: r, col: c});
                }
            }
        }
        
        // Shuffle square lists
        shuffleArray(lightSquares);
        shuffleArray(darkSquares);
        
        // Define piece requirements
        const requirements = [
            { type: 'bishop', count: 2, needsBothColors: true },
            { type: 'rook', count: 2, needsBothColors: true },
            { type: 'knight', count: 2, needsBothColors: true },
            { type: 'queen', count: 1, needsBothColors: false },
            { type: 'king', count: 1, needsBothColors: false },
            { type: 'pawn', count: 8, needsBothColors: false }
        ];
        
        // Place pieces according to color requirements
        for (let req of requirements) {
            for (let i = 0; i < req.count; i++) {
                let piece = {
                    type: symbols[color][req.type],
                    pieceType: req.type,
                    color: color,
                    hasMoved: false,
                    id: `${color}_${req.type}_${Date.now()}_${Math.random()}`
                };
                
                let placed = false;
                
                if (req.needsBothColors) {
                    // Place one on light, one on dark
                    if (i === 0 && lightSquares.length > 0) {
                        let sq = lightSquares.shift();
                        sideBoard[sq.row][sq.col] = {...piece, startingRow: sq.row};
                        placed = true;
                    } else if (i === 1 && darkSquares.length > 0) {
                        let sq = darkSquares.shift();
                        sideBoard[sq.row][sq.col] = {...piece, startingRow: sq.row};
                        placed = true;
                    }
                } else {
                    // Place on any available square
                    if (lightSquares.length > 0) {
                        let sq = lightSquares.shift();
                        sideBoard[sq.row][sq.col] = {...piece, startingRow: sq.row};
                        placed = true;
                    } else if (darkSquares.length > 0) {
                        let sq = darkSquares.shift();
                        sideBoard[sq.row][sq.col] = {...piece, startingRow: sq.row};
                        placed = true;
                    }
                }
                
                if (!placed) {
                    console.error(`Failed to place ${color} ${req.type}`);
                }
            }
        }
        
        return sideBoard;
    }

    /**
     * Generate a complete random chess board with valid distribution
     * @returns {Array} 8x8 board array with piece objects
     */
    function generateBoard() {
        let board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Generate white side (rows 0-1)
        let whiteBoard = generateSide('white', [0, 1]);
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 8; c++) {
                if (whiteBoard[r][c]) {
                    board[r][c] = whiteBoard[r][c];
                }
            }
        }
        
        // Generate black side (rows 6-7)
        let blackBoard = generateSide('black', [6, 7]);
        for (let r = 6; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (blackBoard[r][c]) {
                    board[r][c] = blackBoard[r][c];
                }
            }
        }
        
        return board;
    }

    /**
     * Verify if a board position satisfies all color rules
     * @param {Array} board - 8x8 board array
     * @returns {Object} Verification results
     */
    function verifyBoard(board) {
        let result = {
            white: { bishops: { light: false, dark: false }, rooks: [], knights: [], kingQueen: { king: null, queen: null } },
            black: { bishops: { light: false, dark: false }, rooks: [], knights: [], kingQueen: { king: null, queen: null } }
        };
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (!piece) continue;
                
                let color = piece.color;
                let squareColor = getSquareColor(r, c);
                
                if (piece.pieceType === 'bishop') {
                    result[color].bishops[squareColor] = true;
                } else if (piece.pieceType === 'rook') {
                    result[color].rooks.push(squareColor);
                } else if (piece.pieceType === 'knight') {
                    result[color].knights.push(squareColor);
                } else if (piece.pieceType === 'king') {
                    result[color].kingQueen.king = squareColor;
                } else if (piece.pieceType === 'queen') {
                    result[color].kingQueen.queen = squareColor;
                }
            }
        }
        
        // Validate
        result.valid = {
            white: {
                bishops: result.white.bishops.light && result.white.bishops.dark,
                rooks: result.white.rooks.length === 2 && result.white.rooks[0] !== result.white.rooks[1],
                knights: result.white.knights.length === 2 && result.white.knights[0] !== result.white.knights[1],
                kingQueen: result.white.kingQueen.king !== result.white.kingQueen.queen
            },
            black: {
                bishops: result.black.bishops.light && result.black.bishops.dark,
                rooks: result.black.rooks.length === 2 && result.black.rooks[0] !== result.black.rooks[1],
                knights: result.black.knights.length === 2 && result.black.knights[0] !== result.black.knights[1],
                kingQueen: result.black.kingQueen.king !== result.black.kingQueen.queen
            }
        };
        
        return result;
    }

    // Public API
    return {
        generateBoard,
        verifyBoard,
        symbols,
        getSquareColor
    };
})();

// For use as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RChessDistribution;
}
