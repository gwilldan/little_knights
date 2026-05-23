// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title LittleKnights Escrow Storage
 * @notice Holds house funds for bot games
 * @dev    Only EscrowManager can pull funds for bot games
 *         Only admin can deposit or withdraw house funds
 */
contract LittleKnightsStorage {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────

    address public admin;
    address public manager; // EscrowManager contract
    IERC20 public immutable stablecoin;

    // ─────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────

    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event BotGameFunded(bytes32 indexed gameId, uint256 amount);
    event BotWinReceived(bytes32 indexed gameId, uint256 amount);
    event ManagerChanged(
        address indexed oldManager,
        address indexed newManager
    );
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // ─────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────

    error NotAdmin();
    error NotManager();
    error InvalidAddress();
    error InsufficientBalance();
    error ZeroAmount();

    // ─────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    // ─────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────

    constructor(address _stablecoin, address _manager) {
        if (_stablecoin == address(0)) revert InvalidAddress();
        if (_manager == address(0)) revert InvalidAddress();

        stablecoin = IERC20(_stablecoin);
        manager = _manager;
        admin = msg.sender;
    }

    // ─────────────────────────────────────────
    // ADMIN — fund and withdraw house balance
    // ─────────────────────────────────────────

    /**
     * @notice Admin deposits stablecoin into the house fund
     * @dev    Admin must approve this contract first
     */
    function fundStorage(uint256 amount) external onlyAdmin {
        if (amount == 0) revert ZeroAmount();
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /**
     * @notice Admin withdraws stablecoin from the house fund
     */
    function withdrawStorage(uint256 amount) external onlyAdmin {
        if (amount == 0) revert ZeroAmount();
        if (stablecoin.balanceOf(address(this)) < amount)
            revert InsufficientBalance();
        stablecoin.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ─────────────────────────────────────────
    // MANAGER ONLY — called by EscrowManager
    // ─────────────────────────────────────────

    /**
     * @notice Manager pulls house match for a bot game
     * @dev    Only EscrowManager can call this
     *         Sends betAmount directly to manager contract
     */
    function fundBotGame(bytes32 gameId, uint256 amount) external onlyManager {
        if (amount == 0) revert ZeroAmount();
        if (stablecoin.balanceOf(address(this)) < amount)
            revert InsufficientBalance();

        stablecoin.safeTransfer(manager, amount);
        emit BotGameFunded(gameId, amount);
    }

    /**
     * @notice Manager sends bot game winnings back to storage
     * @dev    Called when house wins a bot game
     */
    function receiveBotWin(
        bytes32 gameId,
        uint256 amount
    ) external onlyManager {
        if (amount == 0) revert ZeroAmount();
        // funds are already in storage — manager transfers to this contract
        stablecoin.safeTransferFrom(manager, address(this), amount);
        emit BotWinReceived(gameId, amount);
    }

    // ─────────────────────────────────────────
    // ADMIN MANAGEMENT
    // ─────────────────────────────────────────

    function setManager(address newManager) external onlyAdmin {
        if (newManager == address(0)) revert InvalidAddress();
        emit ManagerChanged(manager, newManager);
        manager = newManager;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    // ─────────────────────────────────────────
    // VIEWS
    // ─────────────────────────────────────────

    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }

    // ─────────────────────────────────────────
    // SAFETY
    // ─────────────────────────────────────────

    receive() external payable {
        revert("Stablecoin only");
    }
}
