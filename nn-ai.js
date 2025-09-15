/**
 * Creates an Othello AI powered by an ONNX neural network model.
 * [UPDATE] This function is now adapted to use the onnxruntime-web library.
 * @param {string} modelPath - The path to the .onnx model file.
 * @param {object} game - An object with game constants and helper functions.
 * @returns {Promise<object>} A promise that resolves to an AI object with a findBestMove method.
 */
async function createNNAI(modelPath, game) {
    const { BLACK, WHITE, BOARD_SIZE, getValidMoves } = game;
    let session;

    // --- Model Loading with Detailed Error Logging ---
    try {
        console.log(`[AI Loader] Attempting to load model with onnxruntime-web from: ${modelPath}`);
        
        // [FIX] Use the correct API for onnxruntime-web. It creates a global 'ort' object.
        // `ort.InferenceSession.create` is the new, correct way to load a model.
        session = await ort.InferenceSession.create(modelPath);
        
        console.log(`[AI Loader] ONNX Runtime session created successfully.`);
        console.log('[AI Loader] Model Input Names:', session.inputNames);
        console.log('[AI Loader] Model Output Names:', session.outputNames);

    } catch (e) {
        console.error(`[AI Loader] Failed to create ONNX Runtime session from ${modelPath}.`);
        console.error('[AI Loader] Full error object:', e);
        throw e; // Re-throw the error to be caught by the calling function.
    }

    /**
     * Prepares the board data into the tensor format required by the NN model.
     * @param {Array<Array<number>>} board - The game board.
     * @param {number} player - The current player's color.
     * @returns {ort.Tensor} The input tensor for the model.
     */
    function boardToTensor(board, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        const channels = 2;
        const height = BOARD_SIZE;
        const width = BOARD_SIZE;
        const tensorData = new Float32Array(channels * height * width);

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const index = r * width + c;
                if (board[r][c] === player) {
                    tensorData[index] = 1.0;
                } else if (board[r][c] === opponent) {
                    tensorData[height * width + index] = 1.0;
                }
            }
        }
        // [FIX] Use `ort.Tensor` which is the correct constructor for onnxruntime-web
        return new ort.Tensor('float32', tensorData, [1, channels, height, width]);
    }

    // --- Public AI Interface ---
    return {
        /**
         * Finds the best move for the given board state using the loaded NN model.
         * @param {Array<Array<number>>} board - The current game board.
         * @param {number} player - The current player.
         * @returns {Promise<{row: number, col: number}|null>} The best move or null if no valid moves.
         */
        findBestMove: async function(board, player) {
            if (!session) {
                console.error("ONNX Runtime session is not ready.");
                return null;
            }

            const validMoves = getValidMoves(board, player);
            if (validMoves.length === 0) {
                return null;
            }

            try {
                const inputTensor = boardToTensor(board, player);
                const inputName = session.inputNames[0];
                const outputName = session.outputNames[0];

                const feeds = { [inputName]: inputTensor };
                const results = await session.run(feeds);

                // [FIX] onnxruntime-web returns a plain object, not a Map.
                // Access the output tensor directly by its name as a key.
                const outputTensor = results[outputName];

                if (!outputTensor) {
                    throw new Error(`Output tensor '${outputName}' not found in model results.`);
                }

                const outputData = outputTensor.data;

                let bestMove = null;
                let maxScore = -Infinity;

                for (const move of validMoves) {
                    const moveIndex = move.row * BOARD_SIZE + move.col;
                    const score = outputData[moveIndex];
                    if (score > maxScore) {
                        maxScore = score;
                        bestMove = move;
                    }
                }
                
                return bestMove;

            } catch (e) {
                console.error("Error during model inference:", e);
                return null;
            }
        },
        isReady: () => !!session
    };
}

