// constants
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZE = 8;
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1], [1, 0], [1, 1]
];

// game state
let board = [];
let previousBoard = null; // for animation
let currentPlayer;
let gameMode = 'human-vs-ai';
let isAIThinking = false;

// DOM elements
const boardElement = document.getElementById('board');
const currentTurnElement = document.getElementById('current-turn');
const turnIndicatorPieceElement = document.getElementById('turn-indicator-piece');
const blackScoreElement = document.getElementById('black-score');
const whiteScoreElement = document.getElementById('white-score');
const blackBarElement = document.getElementById('black-bar');
const whiteBarElement = document.getElementById('white-bar');
const gameResultElement = document.getElementById('game-result');
const resetButton = document.getElementById('reset-button');
const gameModeSelect = document.getElementById('gameMode');
const gameLogElement = document.getElementById('game-log');
const aiSelectorBlackContainer = document.getElementById('ai-selector-black-container');
const aiSelectorWhiteContainer = document.getElementById('ai-selector-white-container');
const aiSelectorBlack = document.getElementById('ai-selector-black');
const aiSelectorWhite = document.getElementById('ai-selector-white');

// --- AI Management ---
const AI_MODELS = {
    'classic': { type: 'classic', path: null, name: '古典的探索AI' },
    'cnn_v1': { type: 'nn', path: './models/cnn_model.onnx', name: 'CNNモデル' },
 //   'fc_v1': { type: 'nn', path: './models/fc_model.onnx', name: '全結合NNモデル' }
};

let aiPlayers = {}; 

const gameHelpers = {
    BLACK, WHITE, BOARD_SIZE,
    getValidMoves, getResultingBoard, getFlippablePieces
};

function initializeAISelectors() {
    [aiSelectorBlack, aiSelectorWhite].forEach(selector => {
        selector.innerHTML = ''; 
        for (const key in AI_MODELS) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = AI_MODELS[key].name;
            selector.appendChild(option);
        }
    });
}

async function loadAIPlayer(key) {
    if (aiPlayers[key] && aiPlayers[key].isReady()) return;

    console.log(`Loading AI: ${key}...`);
    const model = AI_MODELS[key];
    
    try {
        if (model.type === 'classic') {
            aiPlayers[key] = createClassicAI(gameHelpers);
        } else if (model.type === 'nn') {
            aiPlayers[key] = await createNNAI(model.path, gameHelpers);
        }

        if (!aiPlayers[key] || !aiPlayers[key].isReady()) {
            throw new Error(`${model.name} のAIインスタンスの作成に失敗しました。`);
        }
        console.log(`AI ${key} is ready.`);

    } catch(err) {
        console.error(err);
        const errorMsg = `${model.name} の読み込みに失敗しました。`;
        const detailMsg = "モデルファイルが見つからないかCORSポリシー違反の可能性があります。ローカルサーバーの設定を確認してください。";
        gameResultElement.innerHTML = `<span class="text-red-600">${errorMsg}</span><br><span class="text-sm text-gray-600">${detailMsg}</span>`;
        delete aiPlayers[key];
    }
}

// --- Game Initialization and Flow ---

function initGame() {
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = WHITE;
    board[4][4] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    previousBoard = null; // Reset previous board state
    currentPlayer = BLACK;
    isAIThinking = false;
    gameResultElement.textContent = '';
    gameResultElement.className = 'mt-6 text-xl font-bold text-center h-12 flex items-center justify-center';
    gameLogElement.innerHTML = '';
    aiPlayers = {};
    
    updateModeUI();
    drawBoard();
    updateInfo();

    checkAndTriggerAIMove();
}

function updateModeUI() {
    gameMode = gameModeSelect.value;
    aiSelectorBlackContainer.style.display = gameMode === 'ai-vs-ai' ? 'block' : 'none';
    aiSelectorWhiteContainer.style.display = (gameMode === 'human-vs-ai' || gameMode === 'ai-vs-ai') ? 'block' : 'none';
}

function drawBoard() {
    boardElement.innerHTML = '';
    const validMoves = getValidMoves(board, currentPlayer);

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const currentPiece = board[r][c];
            const previousPiece = previousBoard ? previousBoard[r][c] : EMPTY;

            if (currentPiece !== EMPTY) {
                const pieceElement = document.createElement('div');
                const pieceInner = document.createElement('div');
                pieceInner.className = 'piece-inner';
                const pieceFront = document.createElement('div');
                pieceFront.className = 'piece-front';
                const pieceBack = document.createElement('div');
                pieceBack.className = 'piece-back';
                
                pieceInner.appendChild(pieceFront);
                pieceInner.appendChild(pieceBack);
                pieceElement.appendChild(pieceInner);
                
                // Animate pieces based on state change
                if (previousPiece === EMPTY) { // Newly placed piece
                    pieceElement.className = `piece ${currentPiece === BLACK ? 'black' : 'white'} placed`;
                } else if (currentPiece !== previousPiece) { // Flipped piece
                    // Start with the old color class
                    pieceElement.className = `piece ${previousPiece === BLACK ? 'black' : 'white'}`;
                    // Flip to the new color after a tiny delay to trigger CSS transition
                    setTimeout(() => {
                       pieceElement.className = `piece ${currentPiece === BLACK ? 'black' : 'white'}`;
                    }, 20);
                } else { // Unchanged piece
                    pieceElement.className = `piece ${currentPiece === BLACK ? 'black' : 'white'}`;
                }
                
                cell.appendChild(pieceElement);
            } else {
                const isLegalMove = validMoves.some(move => move.row === r && move.col === c);
                if (isCurrentPlayerHuman() && isLegalMove) {
                    const hint = document.createElement('div');
                    hint.className = 'legal-move-hint';
                    cell.appendChild(hint);
                    cell.addEventListener('click', () => handleCellClick(r, c));
                }
            }
            boardElement.appendChild(cell);
        }
    }
}

function isCurrentPlayerHuman() {
    if (isAIThinking) return false;
    if (gameMode === 'human-vs-human') return true;
    if (gameMode === 'human-vs-ai' && currentPlayer === BLACK) return true;
    return false;
}

function handleCellClick(row, col) {
    if (!isCurrentPlayerHuman()) return;
    if (isValidMove(board, currentPlayer, row, col)) {
        placePieceAndSwitchPlayer(row, col);
    }
}

function placePieceAndSwitchPlayer(row, col) {
     previousBoard = JSON.parse(JSON.stringify(board)); // Store state before move
     const newBoard = getResultingBoard(board, currentPlayer, row, col);
     if (newBoard) {
        board = newBoard;
        logMove(row, col);
        switchPlayer();
     }
}

function logMove(row, col) {
    const colStr = String.fromCharCode('a'.charCodeAt(0) + col);
    const rowStr = (row + 1).toString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `${gameLogElement.children.length + 1}: ${currentPlayer === BLACK ? '黒' : '白'} -> ${colStr}${rowStr}`;
    gameLogElement.appendChild(logEntry);
    gameLogElement.scrollTop = gameLogElement.scrollHeight;
}

function switchPlayer() {
    const opponent = currentPlayer === BLACK ? WHITE : BLACK;

    if (getValidMoves(board, opponent).length > 0) {
        currentPlayer = opponent;
    } else if (getValidMoves(board, currentPlayer).length > 0) {
        // Player must pass, current player plays again
        const logEntry = document.createElement('div');
        logEntry.textContent = `${opponent === BLACK ? '黒' : '白'}はパスしました`;
        logEntry.className = 'italic text-gray-500';
        gameLogElement.appendChild(logEntry);
    } else {
        endGame();
        return;
    }
    
    drawBoard();
    updateInfo();
    
    checkAndTriggerAIMove();
}

function checkAndTriggerAIMove() {
    if (!isCurrentPlayerHuman()) {
         aiMove();
    }
}

async function aiMove() {
    if (isCurrentPlayerHuman() || isAIThinking) return;
    
    isAIThinking = true;
    
    gameResultElement.innerHTML = '';
    const loaderContainer = document.createElement('div');
    loaderContainer.className = 'flex items-center justify-center';
    const loader = document.createElement('div');
    loader.className = 'loader';
    const thinkingText = document.createElement('span');
    thinkingText.textContent = 'AI思考中...';
    thinkingText.className = 'ml-2 text-gray-600';
    loaderContainer.appendChild(loader);
    loaderContainer.appendChild(thinkingText);
    gameResultElement.appendChild(loaderContainer);
    
    drawBoard();

    await new Promise(resolve => setTimeout(resolve, 100));

    const aiKey = currentPlayer === BLACK ? aiSelectorBlack.value : aiSelectorWhite.value;
    
    await loadAIPlayer(aiKey);
    const currentAI = aiPlayers[aiKey];

    let move = null;
    if (currentAI && currentAI.isReady()) {
        move = await currentAI.findBestMove(JSON.parse(JSON.stringify(board)), currentPlayer);
    } else {
        console.error(`AI with key "${aiKey}" is not ready or failed to load.`);
    }

    gameResultElement.innerHTML = '';
    isAIThinking = false;
    
    if (move) {
        placePieceAndSwitchPlayer(move.row, move.col);
    } else {
        console.log(`AI (${aiKey}) returned no move. Passing turn.`);
        switchPlayer();
    }
}

function updateInfo() {
    let blackScore = 0;
    let whiteScore = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) blackScore++;
            if (board[r][c] === WHITE) whiteScore++;
        }
    }
    
    // Update score text inside bars
    blackScoreElement.textContent = blackScore;
    whiteScoreElement.textContent = whiteScore;

    // Update score bar width
    const totalPieces = blackScore + whiteScore;
    if (totalPieces > 0) {
        blackBarElement.style.width = `${(blackScore / totalPieces) * 100}%`;
        whiteBarElement.style.width = `${(whiteScore / totalPieces) * 100}%`;
    } else {
        blackBarElement.style.width = '50%';
        whiteBarElement.style.width = '50%';
    }

    // Update turn indicator
    const turnText = currentPlayer === BLACK ? '黒' : '白';
    currentTurnElement.textContent = turnText;
    turnIndicatorPieceElement.style.backgroundColor = currentPlayer === BLACK ? 'black' : 'white';
    turnIndicatorPieceElement.style.border = currentPlayer === WHITE ? '1px solid #777' : 'none';
}

function endGame() {
    let blackScore = 0;
    let whiteScore = 0;
    board.forEach(row => row.forEach(cell => {
        if (cell === BLACK) blackScore++;
        if (cell === WHITE) whiteScore++;
    }));

    let resultMessage;
    let winnerColorClass;
    if (blackScore > whiteScore) {
        resultMessage = `黒の勝ちです！ (${blackScore} - ${whiteScore})`;
        winnerColorClass = 'text-green-600';
    } else if (whiteScore > blackScore) {
        resultMessage = `白の勝ちです！ (${whiteScore} - ${blackScore})`;
        winnerColorClass = 'text-green-600';
    } else {
        resultMessage = `引き分けです！ (${blackScore} - ${whiteScore})`;
        winnerColorClass = 'text-blue-600';
    }
    gameResultElement.textContent = resultMessage;
    gameResultElement.className = `mt-6 text-xl font-bold text-center h-12 flex items-center justify-center ${winnerColorClass}`;
    isAIThinking = true; // Prevent further moves
}

// --- Utility Functions ---
function isValidMove(targetBoard, player, row, col) {
    return getValidMoves(targetBoard, player).some(move => move.row === row && move.col === col);
}

function getValidMoves(targetBoard, player) {
    const validMoves = [];
    if (!player) return validMoves;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (targetBoard[r][c] === EMPTY) {
                if (getFlippablePieces(targetBoard, player, r, c).length > 0) {
                    validMoves.push({ row: r, col: c });
                }
            }
        }
    }
    return validMoves;
}

function getFlippablePieces(targetBoard, player, row, col) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let piecesToFlip = [];
    DIRECTIONS.forEach(([dr, dc]) => {
        let currentLine = [];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            if (targetBoard[r][c] === opponent) {
                currentLine.push({ row: r, col: c });
            } else if (targetBoard[r][c] === player) {
                piecesToFlip = piecesToFlip.concat(currentLine);
                break;
            } else {
                break;
            }
            r += dr;
            c += dc;
        }
    });
    return piecesToFlip;
}

function getResultingBoard(originalBoard, player, row, col) {
    const piecesToFlip = getFlippablePieces(originalBoard, player, row, col);
    if (piecesToFlip.length === 0 && originalBoard[row][col] === EMPTY) {
        return null;
    }
    const newBoard = JSON.parse(JSON.stringify(originalBoard));
    newBoard[row][col] = player;
    piecesToFlip.forEach(p => {
        newBoard[p.row][p.col] = player;
    });
    return newBoard;
}

// Event Listeners
resetButton.addEventListener('click', initGame);
gameModeSelect.addEventListener('change', initGame);
aiSelectorBlack.addEventListener('change', initGame);
aiSelectorWhite.addEventListener('change', initGame);


// --- Initial Setup on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAISelectors();
    initGame();
});
