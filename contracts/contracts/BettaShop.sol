// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {BettaFish} from "./BettaFish.sol";

/// @title Betta Arena shop
/// @notice Everything bought with $BETTA goes through here: fish, food, care, medicine, boosters,
/// training rushes and breeding fees. Part of every payment is burned, the rest goes to the treasury.
/// The shop never holds player funds.
///
/// Buying a fish needs a short-lived permit from the game server, which checks that the keeper has
/// a free jar (three at most). Fry from breeding are minted the same way, without payment (the
/// breeding fee was paid as an item).
contract BettaShop is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    bytes32 private constant FISH_PERMIT =
        keccak256("FishPermit(address buyer,uint16 species,bool female,uint256 nonce,uint64 deadline)");
    bytes32 private constant BRED_PERMIT =
        keccak256("BredPermit(address to,uint16 species,bool female,uint8 gen,uint32 seed,uint256 nonce,uint64 deadline)");

    IERC20 public immutable token;
    BettaFish public immutable fish;
    address public treasury;
    address public signer;
    uint16 public burnBps; // share of every payment that is burned
    uint16 public femaleBps = 6000; // a female costs 60% of a male

    mapping(uint16 => uint256) public fishPrice; // species => price of a male (0 = not for sale)
    mapping(uint16 => uint256) public itemPrice; // item => price per unit (0 = not for sale)
    mapping(uint256 => bool) public usedNonce;

    event FishBought(address indexed buyer, uint256 indexed fishId, uint16 species, bool female, uint256 paid);
    event FryClaimed(address indexed to, uint256 indexed fishId, uint16 species, bool female, uint8 gen, uint256 nonce);
    event ItemsBought(address indexed buyer, uint16 indexed item, uint32 qty, uint256 paid);
    event PriceSet(bool isFish, uint16 indexed id, uint256 price);
    event ConfigSet(address treasury, address signer, uint16 burnBps, uint16 femaleBps);

    error NotForSale();
    error PriceAboveMax();
    error BadPermit();
    error Expired();
    error NonceUsed();
    error FeeOnTransferToken();
    error BadConfig();

    constructor(address owner_, IERC20 token_, BettaFish fish_, address treasury_, address signer_, uint16 burnBps_)
        Ownable(owner_)
        EIP712("BettaShop", "1")
    {
        token = token_;
        fish = fish_;
        _setConfig(treasury_, signer_, burnBps_, 6000);
    }

    // ---------- buying ----------

    function priceOf(uint16 species, bool female) public view returns (uint256) {
        uint256 p = fishPrice[species];
        return female ? (p * femaleBps) / 10_000 : p;
    }

    function buyFish(uint16 species, bool female, uint256 maxPrice, uint256 nonce, uint64 deadline, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 id)
    {
        uint256 price = priceOf(species, female);
        if (price == 0) revert NotForSale();
        if (price > maxPrice) revert PriceAboveMax();
        _usePermit(keccak256(abi.encode(FISH_PERMIT, msg.sender, species, female, nonce, deadline)), nonce, deadline, sig);
        _collect(msg.sender, price);
        // starting stats roll; low stakes, so recent chain data is random enough here
        uint32 seed = uint32(uint256(keccak256(abi.encode(blockhash(block.number - 1), msg.sender, nonce, fish.nextId()))));
        id = fish.mint(msg.sender, species, female, 1, seed);
        emit FishBought(msg.sender, id, species, female, price);
    }

    function claimFry(uint16 species, bool female, uint8 gen, uint32 seed, uint256 nonce, uint64 deadline, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 id)
    {
        _usePermit(keccak256(abi.encode(BRED_PERMIT, msg.sender, species, female, gen, seed, nonce, deadline)), nonce, deadline, sig);
        id = fish.mint(msg.sender, species, female, gen, seed);
        emit FryClaimed(msg.sender, id, species, female, gen, nonce);
    }

    function buyItems(uint16 item, uint32 qty, uint256 maxTotal) external nonReentrant whenNotPaused {
        uint256 unit = itemPrice[item];
        if (unit == 0 || qty == 0) revert NotForSale();
        uint256 total = unit * qty;
        if (total > maxTotal) revert PriceAboveMax();
        _collect(msg.sender, total);
        emit ItemsBought(msg.sender, item, qty, total);
    }

    // ---------- internals ----------

    function _usePermit(bytes32 structHash, uint256 nonce, uint64 deadline, bytes calldata sig) private {
        if (block.timestamp > deadline) revert Expired();
        if (usedNonce[nonce]) revert NonceUsed();
        if (ECDSA.recover(_hashTypedDataV4(structHash), sig) != signer) revert BadPermit();
        usedNonce[nonce] = true;
    }

    function _collect(address from, uint256 amount) private {
        uint256 burned = (amount * burnBps) / 10_000;
        uint256 rest = amount - burned;
        if (burned > 0) token.safeTransferFrom(from, DEAD, burned);
        if (rest > 0) {
            uint256 before = token.balanceOf(treasury);
            token.safeTransferFrom(from, treasury, rest);
            if (token.balanceOf(treasury) - before != rest) revert FeeOnTransferToken();
        }
    }

    // ---------- admin ----------

    function setFishPrice(uint16 species, uint256 price) external onlyOwner {
        fishPrice[species] = price;
        emit PriceSet(true, species, price);
    }

    function setItemPrice(uint16 item, uint256 price) external onlyOwner {
        itemPrice[item] = price;
        emit PriceSet(false, item, price);
    }

    function setPrices(uint16[] calldata species, uint256[] calldata fishPrices, uint16[] calldata items, uint256[] calldata itemPrices)
        external
        onlyOwner
    {
        if (species.length != fishPrices.length || items.length != itemPrices.length) revert BadConfig();
        for (uint256 i; i < species.length; i++) {
            fishPrice[species[i]] = fishPrices[i];
            emit PriceSet(true, species[i], fishPrices[i]);
        }
        for (uint256 i; i < items.length; i++) {
            itemPrice[items[i]] = itemPrices[i];
            emit PriceSet(false, items[i], itemPrices[i]);
        }
    }

    function setConfig(address treasury_, address signer_, uint16 burnBps_, uint16 femaleBps_) external onlyOwner {
        _setConfig(treasury_, signer_, burnBps_, femaleBps_);
    }

    function _setConfig(address treasury_, address signer_, uint16 burnBps_, uint16 femaleBps_) private {
        if (treasury_ == address(0) || signer_ == address(0) || burnBps_ > 10_000 || femaleBps_ > 10_000) revert BadConfig();
        treasury = treasury_;
        signer = signer_;
        burnBps = burnBps_;
        femaleBps = femaleBps_;
        emit ConfigSet(treasury_, signer_, burnBps_, femaleBps_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
