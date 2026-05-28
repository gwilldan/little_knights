// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// NOTE: REMEMBER TO SET A LIMIT FOR THE AMOUNT SOMEONE CAN PLAY PER GAME!

import "./Storage.sol";

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @title LittleKnights Escrow Manager
 * @notice Manages all game logic — multiplayer open, single player admin only
 * @dev    Calls EscrowStorage to fund/receive bot game proceeds
 */
contract LittleKnightsEscrowManager {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────

    enum GameMode {
        SINGLE,
        MULTI
    }
    enum GameStatus {
        PENDING,
        ACTIVE,
        FINISHED,
        CANCELLED
    }
    enum GameResult {
        NONE,
        WIN,
        DRAW
    }

    struct Game {
        bytes32 gameId;
        GameMode mode;
        GameStatus status;
        address player1;
        address player2; // address(0) for bot
        uint256 betAmount; // per player
        uint256 totalPot; // betAmount * 2
        uint256 createdAt;
        uint256 startedAt;
        address winner;
        GameResult result;
    }

    // ─────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────

    address public admin;
    address public feeRecipient;
    IERC20 public immutable stablecoin;
    LittleKnightsStorage public immutable escrowStorage;

    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS = 10_000;

    mapping(bytes32 => Game) public games;
    bytes32[] public gameIds;

    // ─────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────

    event GameCreated(
        bytes32 indexed gameId,
        address indexed player1,
        uint256 betAmount,
        GameMode mode
    );
    event GameJoined(bytes32 indexed gameId, address indexed player2);
    event GameStarted(bytes32 indexed gameId);
    event GameFinished(
        bytes32 indexed gameId,
        GameResult result,
        address winner,
        uint256 payout
    );
    event GameCancelled(bytes32 indexed gameId, address indexed refundedTo);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event FeeRecipientChanged(
        address indexed old,
        address indexed newRecipient
    );

    // ─────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────

    error NotAdmin();
    error GameNotFound();
    error GameNotPending();
    error GameNotActive();
    error GameAlreadyExists();
    error InvalidAddress();
    error SamePlayer();
    error ZeroBet();
    error InvalidWinner();
    error NotMultiPlayer();
    error NotSinglePlayer();
    error InsufficientStorageBalance();

    // ─────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier gameExists(bytes32 gameId) {
        if (games[gameId].createdAt == 0) revert GameNotFound();
        _;
    }

    modifier isPending(bytes32 gameId) {
        if (games[gameId].status != GameStatus.PENDING) revert GameNotPending();
        _;
    }

    modifier isActive(bytes32 gameId) {
        if (games[gameId].status != GameStatus.ACTIVE) revert GameNotActive();
        _;
    }

    // ─────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────

    constructor(
        address _stablecoin,
        address _escrowStorage,
        address _feeRecipient
    ) {
        if (_stablecoin == address(0)) revert InvalidAddress();
        if (_escrowStorage == address(0)) revert InvalidAddress();
        if (_feeRecipient == address(0)) revert InvalidAddress();

        stablecoin = IERC20(_stablecoin);
        escrowStorage = LittleKnightsStorage(payable(_escrowStorage));
        feeRecipient = _feeRecipient;
        admin = msg.sender;
    }

    // ─────────────────────────────────────────
    // ADMIN MANAGEMENT
    // ─────────────────────────────────────────

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    function setFeeRecipient(address newRecipient) external onlyAdmin {
        if (newRecipient == address(0)) revert InvalidAddress();
        emit FeeRecipientChanged(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    // ─────────────────────────────────────────
    // MULTIPLAYER — open to anyone
    // ─────────────────────────────────────────

    /**
     * @notice Player1 creates a multiplayer game
     * @dev    Pulls betAmount from msg.sender — must approve first
     */
    function createMultiGame(bytes32 gameId, uint256 betAmount) external {
        if (betAmount == 0) revert ZeroBet();
        if (games[gameId].createdAt != 0) revert GameAlreadyExists();

        stablecoin.safeTransferFrom(msg.sender, address(this), betAmount);

        games[gameId] = Game({
            gameId: gameId,
            mode: GameMode.MULTI,
            status: GameStatus.PENDING,
            player1: msg.sender,
            player2: address(0),
            betAmount: betAmount,
            totalPot: betAmount,
            createdAt: block.timestamp,
            startedAt: 0,
            winner: address(0),
            result: GameResult.NONE
        });

        gameIds.push(gameId);
        emit GameCreated(gameId, msg.sender, betAmount, GameMode.MULTI);
    }

    /**
     * @notice Player2 joins — game starts immediately
     * @dev    Pulls exact betAmount from msg.sender — must approve first
     */
    function joinMultiGame(
        bytes32 gameId
    ) external gameExists(gameId) isPending(gameId) {
        Game storage game = games[gameId];

        if (game.mode != GameMode.MULTI) revert NotMultiPlayer();
        if (msg.sender == game.player1) revert SamePlayer();

        stablecoin.safeTransferFrom(msg.sender, address(this), game.betAmount);

        game.player2 = msg.sender;
        game.totalPot = game.betAmount * 2;
        game.status = GameStatus.ACTIVE;
        game.startedAt = block.timestamp;

        emit GameJoined(gameId, msg.sender);
        emit GameStarted(gameId);
    }

    // ─────────────────────────────────────────
    // SINGLE PLAYER — admin only
    // ─────────────────────────────────────────

    /**
     * @notice Admin creates a bot game on behalf of player
     * @dev    Pulls betAmount from player
     *         Calls storage to match the bet — storage must have sufficient balance
     *         totalPot = betAmount * 2
     */
    function createSingleGame(
        bytes32 gameId,
        address player1,
        uint256 betAmount
    ) external {
        if (player1 == address(0)) revert InvalidAddress();
        if (betAmount == 0) revert ZeroBet();
        if (games[gameId].createdAt != 0) revert GameAlreadyExists();

        // check storage has enough to match
        if (escrowStorage.getBalance() < betAmount)
            revert InsufficientStorageBalance();

        // pull bet from player
        stablecoin.safeTransferFrom(player1, address(this), betAmount);

        // pull house match from storage into this contract
        escrowStorage.fundBotGame(gameId, betAmount);

        games[gameId] = Game({
            gameId: gameId,
            mode: GameMode.SINGLE,
            status: GameStatus.ACTIVE,
            player1: player1,
            player2: address(0),
            betAmount: betAmount,
            totalPot: betAmount * 2,
            createdAt: block.timestamp,
            startedAt: block.timestamp,
            winner: address(0),
            result: GameResult.NONE
        });

        gameIds.push(gameId);
        emit GameCreated(gameId, player1, betAmount, GameMode.SINGLE);
        emit GameStarted(gameId);
    }

    // ─────────────────────────────────────────
    // RESOLVE — admin only
    // ─────────────────────────────────────────

    /**
     * @notice Admin resolves any game
     * @dev    winner = address(0) → draw
     *         Single player loss → winner = address(0) is ambiguous
     *         Pass feeRecipient as winner to signal house win on single player
     *         On house win proceeds go back to storage minus fee
     */
    function resolveGame(
        bytes32 gameId,
        address winner
    ) external onlyAdmin gameExists(gameId) isActive(gameId) {
        Game storage game = games[gameId];

        uint256 fee = (game.totalPot * FEE_BPS) / BPS;
        uint256 payout = game.totalPot - fee;

        // state update before transfers
        game.status = GameStatus.FINISHED;

        // fee always to feeRecipient
        stablecoin.safeTransfer(feeRecipient, fee);

        if (winner != address(0)) {
            // ── WIN ──
            if (game.mode == GameMode.MULTI) {
                // winner must be one of the two players
                if (winner != game.player1 && winner != game.player2)
                    revert InvalidWinner();
                game.winner = winner;
                game.result = GameResult.WIN;
                stablecoin.safeTransfer(winner, payout);
            } else {
                // single player
                if (winner == game.player1) {
                    // player beats bot — player gets full payout
                    game.winner = winner;
                    game.result = GameResult.WIN;
                    stablecoin.safeTransfer(winner, payout);
                } else {
                    // house wins — send payout back to storage
                    game.result = GameResult.WIN;
                    game.winner = address(escrowStorage);
                    stablecoin.safeTransfer(address(escrowStorage), payout);
                }
            }

            emit GameFinished(gameId, GameResult.WIN, game.winner, payout);
        } else {
            // ── DRAW ──
            game.result = GameResult.DRAW;
            uint256 split = payout / 2;

            if (game.mode == GameMode.MULTI) {
                stablecoin.safeTransfer(game.player1, split);
                stablecoin.safeTransfer(game.player2, split);
            } else {
                // single player draw — player gets their half back
                // house half goes back to storage
                stablecoin.safeTransfer(game.player1, split);
                stablecoin.safeTransfer(address(escrowStorage), split);
            }

            emit GameFinished(gameId, GameResult.DRAW, address(0), payout);
        }
    }

    /**
     * @notice Admin cancels a PENDING game — only multiplayer can be pending
     * @dev    Single games are immediately ACTIVE so can't be cancelled this way
     *         Refunds player1 their betAmount
     */
    function cancelGame(
        bytes32 gameId
    ) external onlyAdmin gameExists(gameId) isPending(gameId) {
        Game storage game = games[gameId];
        game.status = GameStatus.CANCELLED;

        stablecoin.safeTransfer(game.player1, game.betAmount);
        emit GameCancelled(gameId, game.player1);
    }

    // ─────────────────────────────────────────
    // VIEWS
    // ─────────────────────────────────────────

    function getGame(bytes32 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getAllGameIds() external view returns (bytes32[] memory) {
        return gameIds;
    }

    function getContractBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }

    // ─────────────────────────────────────────
    // SAFETY
    // ─────────────────────────────────────────

    receive() external payable {
        revert("Stablecoin only");
    }
}
