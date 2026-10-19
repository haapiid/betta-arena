// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title Betta Arena fish
/// @notice Every betta is an NFT owned by its keeper's wallet. Day-to-day care (hunger, water, XP)
/// lives on the game server, keyed by token id. Transfers start locked so a fish cannot be sold
/// mid-tournament; the owner can open trading later.
contract BettaFish is ERC721, Ownable2Step {
    struct Origin {
        uint16 species; // index into the game's species list (bred fish: the father's species)
        bool female;
        uint8 gen; // 1 = from the shop, 2+ = bred
        uint32 seed; // rolls the starting stats and looks
        uint64 bornAt;
    }

    mapping(uint256 => Origin) public origin;
    mapping(address => bool) public minters;
    bool public transfersLocked = true;
    uint256 public nextId = 1;
    string private baseURI_;

    event MinterSet(address indexed minter, bool allowed);
    event TransfersLocked(bool locked);
    event Born(uint256 indexed id, address indexed to, uint16 species, bool female, uint8 gen, uint32 seed);

    error NotMinter();
    error TransfersAreLocked();

    constructor(address owner_, string memory baseURI) ERC721("Betta Arena Fish", "BETTAFISH") Ownable(owner_) {
        baseURI_ = baseURI;
    }

    function mint(address to, uint16 species, bool female, uint8 gen, uint32 seed) external returns (uint256 id) {
        if (!minters[msg.sender]) revert NotMinter();
        id = nextId++;
        origin[id] = Origin(species, female, gen, seed, uint64(block.timestamp));
        _safeMint(to, id);
        emit Born(id, to, species, female, gen, seed);
    }

    /// @notice Release a fish: the owner (or an approved address) burns it.
    function burn(uint256 id) external {
        _checkAuthorized(_ownerOf(id), msg.sender, id);
        _burn(id);
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function setTransfersLocked(bool locked) external onlyOwner {
        transfersLocked = locked;
        emit TransfersLocked(locked);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI_ = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI_;
    }

    // mint (from 0) and burn (to 0) always work; wallet-to-wallet moves only when unlocked
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (transfersLocked && from != address(0) && to != address(0)) revert TransfersAreLocked();
        return super._update(to, tokenId, auth);
    }
}
