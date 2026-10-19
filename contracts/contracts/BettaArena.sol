// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BettaFight} from "./BettaFight.sol";

/// @title Betta Arena tournaments
/// @notice Every `period` seconds a new round opens with one bracket per division (up to 16 fish).
/// Keepers pay a fixed entry fee that this contract holds in escrow. Registration closes
/// `lockDuration` before the bell; after that nobody can enter or withdraw.
///
/// Fish stats come from the game server (care happens off chain) as an EIP-712 snapshot signed
/// at entry time. Randomness is commit-reveal: the operator commits hash(secret) before the
/// round's registration opens and reveals the secret after it closes; the seed also mixes in
/// every entry. If the secret is not revealed in time, anyone can trigger a full refund.
///
/// Settlement is permissionless: the bracket and every fight run here, then the pot is paid out
/// (5% burned; 60% champion, 25% runner-up, 7.5% to each losing semifinalist). The owner can
/// change fees and keys and pause entries, but has no way to take escrowed funds.
contract BettaArena is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant DIVISIONS = 3;
    uint256 public constant BRACKET = 16;
    uint256 public constant MIN_FIELD = 4;
    uint256 public constant MAX_PER_PLAYER = 3;
    uint256 public constant FEE_BPS = 500;
    uint256 public constant CHAMPION_BPS = 6000;
    uint256 public constant RUNNER_UP_BPS = 2500;
    uint256 public constant SEMI_BPS = 750;

    bytes32 private constant SNAPSHOT = keccak256(
        "Snapshot(address owner,uint256 fishId,uint32 round,uint8 division,uint16 attack,uint16 defense,uint16 beauty,uint8 health,bool sick,uint8 traits,uint8 level,uint64 deadline)"
    );

    struct Snapshot {
        address owner;
        uint256 fishId;
        uint32 round;
        uint8 division;
        uint16 attack;
        uint16 defense;
        uint16 beauty;
        uint8 health;
        bool sick;
        uint8 traits;
        uint8 level;
        uint64 deadline;
    }

    struct Entry {
        address owner;
        uint64 fishId;
        uint16 attack;
        uint16 defense;
        uint16 beauty;
        uint8 health;
        bool sick;
        uint8 traits;
        uint8 level;
        uint128 fee;
    }

    enum Status {
        Open,
        Settled,
        Refunded
    }

    IERC20 public immutable token;
    IERC721 public immutable fish;
    uint64 public immutable anchor; // round 1 starts here
    uint64 public immutable period;
    uint64 public immutable lockDuration;
    uint64 public revealWindow = 1 days; // after the bell
    address public signer;
    address public operator;
    uint256[DIVISIONS] public fees;

    mapping(uint256 => mapping(uint256 => Entry[])) private entries_; // round => division => entries
    mapping(uint256 => mapping(uint256 => Status)) public status;
    mapping(uint256 => mapping(uint256 => bool)) public entered; // round => fishId
    mapping(uint256 => mapping(address => uint256)) public entriesOf; // round => keeper => count
    mapping(uint256 => bytes32) public commitment;
    mapping(uint256 => bytes32) public seedOf;
    mapping(uint256 => bytes32) public entropy;

    event Committed(uint256 indexed round, bytes32 commitment);
    event Entered(uint256 indexed round, uint8 indexed division, uint256 indexed fishId, address owner, uint256 fee);
    event Withdrawn(uint256 indexed round, uint8 indexed division, uint256 indexed fishId, address owner, uint256 fee);
    event Revealed(uint256 indexed round, bytes32 seed);
    event Settled(
        uint256 indexed round, uint8 indexed division, bytes32 seed, uint256 pot, uint256 burned, uint64[] fishIds, uint256[] prizes
    );
    event Refunded(uint256 indexed round, uint8 indexed division, uint256 total, string reason);
    event ConfigSet(address signer, address operator, uint256[3] fees, uint64 revealWindow);

    error NotOperator();
    error BadRound();
    error RegistrationClosed();
    error NotCommitted();
    error NotRevealed();
    error AlreadyCommitted();
    error BadSnapshot();
    error NotFishOwner();
    error AlreadyEntered();
    error TooManyEntries();
    error BracketFull();
    error NotEntered();
    error BadSecret();
    error TooEarly();
    error TooLate();
    error AlreadyDone();
    error FeeOnTransferToken();
    error BadConfig();

    constructor(
        address owner_,
        IERC20 token_,
        IERC721 fish_,
        uint64 anchor_,
        uint64 period_,
        uint64 lockDuration_,
        address signer_,
        address operator_,
        uint256[3] memory fees_
    ) Ownable(owner_) EIP712("BettaArena", "1") {
        if (period_ == 0 || lockDuration_ >= period_) revert BadConfig();
        token = token_;
        fish = fish_;
        anchor = anchor_;
        period = period_;
        lockDuration = lockDuration_;
        _setConfig(signer_, operator_, fees_, 1 days);
    }

    // ---------- schedule ----------

    function roundAt(uint256 t) public view returns (uint256) {
        return t < anchor ? 1 : (t - anchor) / period + 1;
    }

    function currentRound() public view returns (uint256) {
        return roundAt(block.timestamp);
    }

    function startOf(uint256 n) public view returns (uint256) {
        return anchor + (n - 1) * period;
    }

    function bellOf(uint256 n) public view returns (uint256) {
        return anchor + n * period;
    }

    function lockOf(uint256 n) public view returns (uint256) {
        return bellOf(n) - lockDuration;
    }

    function entriesOpen(uint256 n) public view returns (bool) {
        return block.timestamp >= startOf(n) && block.timestamp < lockOf(n);
    }

    function getEntries(uint256 n, uint256 division) external view returns (Entry[] memory) {
        return entries_[n][division];
    }

    // ---------- randomness ----------

    /// @notice Commit hash(secret) for a round. Must happen before its registration opens, so the
    /// operator cannot pick a secret after seeing who entered.
    function commit(uint256 n, bytes32 hash) external {
        if (msg.sender != operator) revert NotOperator();
        if (n == 0 || block.timestamp >= startOf(n)) revert TooLate();
        if (commitment[n] != bytes32(0)) revert AlreadyCommitted();
        commitment[n] = hash;
        emit Committed(n, hash);
    }

    /// @notice Reveal the secret once registration is closed. Anyone holding it may call.
    function reveal(uint256 n, bytes32 secret) external {
        if (commitment[n] == bytes32(0)) revert NotCommitted();
        if (seedOf[n] != bytes32(0)) revert AlreadyDone();
        if (keccak256(abi.encodePacked(secret)) != commitment[n]) revert BadSecret();
        if (block.timestamp < lockOf(n)) revert TooEarly();
        if (block.timestamp >= bellOf(n) + revealWindow) revert TooLate();
        bytes32 seed = keccak256(abi.encodePacked(secret, entropy[n]));
        seedOf[n] = seed;
        emit Revealed(n, seed);
    }

    // ---------- entering ----------

    function enter(Snapshot calldata s, bytes calldata sig) external nonReentrant whenNotPaused {
        uint256 n = currentRound();
        if (s.round != n) revert BadRound();
        if (!entriesOpen(n)) revert RegistrationClosed();
        if (commitment[n] == bytes32(0)) revert NotCommitted();
        if (s.owner != msg.sender || s.division >= DIVISIONS || block.timestamp > s.deadline || s.fishId > type(uint64).max) {
            revert BadSnapshot();
        }
        if (fish.ownerOf(s.fishId) != msg.sender) revert NotFishOwner();
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SNAPSHOT,
                    s.owner,
                    s.fishId,
                    s.round,
                    s.division,
                    s.attack,
                    s.defense,
                    s.beauty,
                    s.health,
                    s.sick,
                    s.traits,
                    s.level,
                    s.deadline
                )
            )
        );
        if (ECDSA.recover(digest, sig) != signer) revert BadSnapshot();
        if (entered[n][s.fishId]) revert AlreadyEntered();
        if (entriesOf[n][msg.sender] >= MAX_PER_PLAYER) revert TooManyEntries();
        Entry[] storage list = entries_[n][s.division];
        if (list.length >= BRACKET) revert BracketFull();

        uint256 fee = fees[s.division];
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), fee);
        if (token.balanceOf(address(this)) - before != fee) revert FeeOnTransferToken();

        entered[n][s.fishId] = true;
        entriesOf[n][msg.sender]++;
        list.push(
            Entry(msg.sender, uint64(s.fishId), s.attack, s.defense, s.beauty, s.health, s.sick, s.traits, s.level, uint128(fee))
        );
        entropy[n] = keccak256(abi.encodePacked(entropy[n], s.fishId, msg.sender));
        emit Entered(n, s.division, s.fishId, msg.sender, fee);
    }

    /// @notice Pull a fish out for a full refund while registration is still open.
    function withdraw(uint256 n, uint8 division, uint256 fishId) external nonReentrant {
        if (!entriesOpen(n)) revert RegistrationClosed();
        Entry[] storage list = entries_[n][division];
        uint256 len = list.length;
        uint256 i;
        while (i < len && (list[i].fishId != fishId || list[i].owner != msg.sender)) i++;
        if (i == len) revert NotEntered();
        uint256 fee = list[i].fee;
        // keep entry order (it is part of the draw)
        for (uint256 j = i; j + 1 < len; j++) list[j] = list[j + 1];
        list.pop();
        entered[n][fishId] = false;
        entriesOf[n][msg.sender]--;
        token.safeTransfer(msg.sender, fee);
        emit Withdrawn(n, division, fishId, msg.sender, fee);
    }

    // ---------- results ----------

    /// @notice Run a division's bracket and pay the prizes. Anyone can call once the bell has rung
    /// and the seed is revealed. A field under MIN_FIELD is refunded instead.
    function settle(uint256 n, uint8 division) external nonReentrant {
        if (division >= DIVISIONS) revert BadRound();
        if (status[n][division] != Status.Open) revert AlreadyDone();
        if (block.timestamp < bellOf(n)) revert TooEarly();
        Entry[] storage list = entries_[n][division];
        uint256 count = list.length;
        if (count < MIN_FIELD) {
            _refund(n, division, "field too small");
            return;
        }
        bytes32 seed = seedOf[n];
        if (seed == bytes32(0)) revert NotRevealed();
        bytes32 divSeed = keccak256(abi.encodePacked(seed, division));

        BettaFight.Fighter[] memory field = new BettaFight.Fighter[](count);
        uint64[] memory ids = new uint64[](count);
        uint256 pot;
        for (uint256 i; i < count; i++) {
            Entry memory e = list[i];
            field[i] = BettaFight.Fighter(e.attack, e.defense, e.beauty, e.health, e.sick, e.traits);
            ids[i] = e.fishId;
            pot += e.fee;
        }
        BettaFight.Placing memory p = BettaFight.bracket(field, divSeed);
        status[n][division] = Status.Settled;

        uint256 burned = (pot * FEE_BPS) / 10_000;
        uint256 payout = pot - burned;
        uint256[] memory prizes = new uint256[](count);
        uint256 paid;
        if (p.runnerUp != BettaFight.BYE) {
            prizes[p.runnerUp] = (payout * RUNNER_UP_BPS) / 10_000;
            paid += prizes[p.runnerUp];
        }
        for (uint256 k; k < 2; k++) {
            if (p.semis[k] != BettaFight.BYE) {
                prizes[p.semis[k]] = (payout * SEMI_BPS) / 10_000;
                paid += prizes[p.semis[k]];
            }
        }
        // champion takes 60% plus rounding and the shares of places nobody reached
        prizes[p.champion] = payout - paid;

        if (burned > 0) token.safeTransfer(DEAD, burned);
        for (uint256 i; i < count; i++) if (prizes[i] > 0) token.safeTransfer(list[i].owner, prizes[i]);
        emit Settled(n, division, divSeed, pot, burned, ids, prizes);
    }

    /// @notice The secret was never revealed: give every fee back.
    function refundUnrevealed(uint256 n, uint8 division) external nonReentrant {
        if (division >= DIVISIONS) revert BadRound();
        if (status[n][division] != Status.Open) revert AlreadyDone();
        if (seedOf[n] != bytes32(0)) revert AlreadyDone();
        if (block.timestamp < bellOf(n) + revealWindow) revert TooEarly();
        _refund(n, division, "seed not revealed");
    }

    function _refund(uint256 n, uint8 division, string memory reason) private {
        status[n][division] = Status.Refunded;
        Entry[] storage list = entries_[n][division];
        uint256 total;
        for (uint256 i; i < list.length; i++) {
            total += list[i].fee;
            token.safeTransfer(list[i].owner, list[i].fee);
        }
        emit Refunded(n, division, total, reason);
    }

    // ---------- admin ----------

    function setConfig(address signer_, address operator_, uint256[3] calldata fees_, uint64 revealWindow_) external onlyOwner {
        _setConfig(signer_, operator_, fees_, revealWindow_);
    }

    function _setConfig(address signer_, address operator_, uint256[3] memory fees_, uint64 revealWindow_) private {
        if (signer_ == address(0) || operator_ == address(0) || revealWindow_ < 1 hours) revert BadConfig();
        for (uint256 i; i < DIVISIONS; i++) if (fees_[i] == 0) revert BadConfig();
        signer = signer_;
        operator = operator_;
        fees = fees_;
        revealWindow = revealWindow_;
        emit ConfigSet(signer_, operator_, fees_, revealWindow_);
    }

    /// @notice Stops new entries only. Withdrawals, reveals, settlements and refunds keep working.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
