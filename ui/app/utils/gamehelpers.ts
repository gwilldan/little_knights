// import { Chess } from "chess.js";
// import { type Square } from "chess.js";
// import { type ChessboardOptions, type SquareHandlerArgs } from "react-chessboard";

// // create a chess game instance to manage the game state and logic
// const chessGame = new Chess();

// // make a random "CPU" move
// export function makeRandomMove() {
//     // get all possible moves`
//     const possibleMoves = chessGame.moves();

//     // exit if the game is over
//     if (chessGame.isGameOver()) {
//     return;
//     }

//     // pick a random move
//     const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

//     // make the move
//     chessGame.move(randomMove);

//     // update the position state
//     setChessPosition(chessGame.fen());
// }

// // get the move options for a square to show valid moves
// export function getMoveOptions(square: Square) {
//     // get the moves for the square
//     const moves = chessGame.moves({
//     square,
//     verbose: true
//     });

//     // if no moves, clear the option squares
//     if (moves.length === 0) {
//     setOptionSquares({});
//     return false;
//     }

//     // create a new object to store the option squares
//     const newSquares: Record<string, React.CSSProperties> = {};

//     // loop through the moves and set the option squares
//     for (const move of moves) {
//     newSquares[move.to] = {
//         background: chessGame.get(move.to) && chessGame.get(move.to)?.color !== chessGame.get(square)?.color ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' // larger circle for capturing
//         : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
//         // smaller circle for moving
//         borderRadius: '50%'
//     };
//     }

//     // set the square clicked to move from to yellow
//     newSquares[square] = {
//     background: 'rgba(255, 255, 0, 0.4)'
//     };

//     // set the option squares
//     setOptionSquares(newSquares);

//     // return true to indicate that there are move options
//     return true;
// }

// export function onSquareClick({
//     square,
//     piece
// }: SquareHandlerArgs) {
//     // piece clicked to move
//     if (!moveFrom && piece) {
//     // get the move options for the square
//     const hasMoveOptions = getMoveOptions(square as Square);

//     // if move options, set the moveFrom to the square
//     if (hasMoveOptions) {
//         setMoveFrom(square);
//     }

//     // return early
//     return;
//     }

//     // square clicked to move to, check if valid move
//     const moves = chessGame.moves({
//     square: moveFrom as Square,
//     verbose: true
//     });
//     const foundMove = moves.find(m => m.from === moveFrom && m.to === square);

//     // not a valid move
//     if (!foundMove) {
//     // check if clicked on new piece
//     const hasMoveOptions = getMoveOptions(square as Square);

//     // if new piece, setMoveFrom, otherwise clear moveFrom
//     setMoveFrom(hasMoveOptions ? square : '');

//     // return early
//     return;
//     }

//     // is normal move
//     try {
//     chessGame.move({
//         from: moveFrom,
//         to: square,
//         promotion: 'q'
//     });
//     } catch {
//     // if invalid, setMoveFrom and getMoveOptions
//     const hasMoveOptions = getMoveOptions(square as Square);

//     // if new piece, setMoveFrom, otherwise clear moveFrom
//     if (hasMoveOptions) {
//         setMoveFrom(square);
//     }

//     // return early
//     return;
//     }

//     // update the position state
//     setChessPosition(chessGame.fen());

//     // make random cpu move after a short delay
//     setTimeout(makeRandomMove, 300);

//     // clear moveFrom and optionSquares
//     setMoveFrom('');
//     setOptionSquares({});
// }