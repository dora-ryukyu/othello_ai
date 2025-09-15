/**
 * Creates a classic Othello AI using Alpha-Beta search.
 * @param {object} game - An object with game constants and helper functions.
 * @returns {object} An AI object with a findBestMove method.
 */
function createClassicAI(game) {
    const { BLACK, WHITE, getValidMoves, getResultingBoard } = game;

    const boardValueTable = [
        [ 30, -12,  0, -1, -1,  0, -12,  30],
        [-12, -15, -3, -3, -3, -3, -15, -12],
        [  0,  -3,  0, -1, -1,  0,  -3,   0],
        [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
        [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
        [  0,  -3,  0, -1, -1,  0,  -3,   0],
        [-12, -15, -3, -3, -3, -3, -15, -12],
        [ 30, -12,  0, -1, -1,  0, -12,  30]
    ];

    function evaluateBoard(targetBoard, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        let boardPositionScore = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (targetBoard[r][c] === player) {
                    boardPositionScore += boardValueTable[r][c];
                } else if (targetBoard[r][c] === opponent) {
                    boardPositionScore -= boardValueTable[r][c];
                }
            }
        }
        const playerMoves = getValidMoves(targetBoard, player).length;
        const opponentMoves = getValidMoves(targetBoard, opponent).length;
        const mobilityScore = playerMoves - opponentMoves;
        
        return (boardPositionScore * 1) + (mobilityScore * 5);
    }
    
    /**
     * The Alpha-Beta search algorithm.
     * [BUG FIX] The evaluation at leaf nodes was incorrect. It now consistently
     * evaluates from the perspective of the root player to ensure correct move selection.
     */
    function alphaBetaSearch(targetBoard, player, depth, alpha, beta, isMaximizingPlayer, rootPlayer) {
        const opponent = player === BLACK ? WHITE : BLACK;
        const validMoves = getValidMoves(targetBoard, player);

        // Base case: depth limit reached or game over
        if (depth === 0 || (validMoves.length === 0 && getValidMoves(targetBoard, opponent).length === 0)) {
            // CRITICAL FIX: Evaluate from the root player's perspective.
            return { score: evaluateBoard(targetBoard, rootPlayer) };
        }
        
        // If current player has no moves, opponent plays.
        if (validMoves.length === 0) {
             return alphaBetaSearch(targetBoard, opponent, depth, alpha, beta, !isMaximizingPlayer, rootPlayer);
        }

        let bestMove = validMoves[0];

        if (isMaximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of validMoves) {
                const newBoard = getResultingBoard(targetBoard, player, move.row, move.col);
                const result = alphaBetaSearch(newBoard, opponent, depth - 1, alpha, beta, false, rootPlayer);
                if (result.score > maxEval) {
                    maxEval = result.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, result.score);
                if (beta <= alpha) break; // Beta cut-off
            }
            return { score: maxEval, move: bestMove };
        } else { // Minimizing player
            let minEval = Infinity;
            for (const move of validMoves) {
                const newBoard = getResultingBoard(targetBoard, player, move.row, move.col);
                const result = alphaBetaSearch(newBoard, opponent, depth - 1, alpha, beta, true, rootPlayer);
                if (result.score < minEval) {
                    minEval = result.score;
                    bestMove = move;
                }
                beta = Math.min(beta, result.score);
                if (beta <= alpha) break; // Alpha cut-off
            }
            return { score: minEval, move: bestMove };
        }
    }
    
    return {
        findBestMove: function(board, player) {
            return new Promise(resolve => {
                const depth = 4; // AI strength
                // Pass the current player as the 'rootPlayer' for consistent evaluation
                const result = alphaBetaSearch(board, player, depth, -Infinity, Infinity, true, player);
                resolve(result.move);
            });
        },
        isReady: () => true
    };
}

