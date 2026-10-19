// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BettaFight} from "../BettaFight.sol";

/// @notice Stand-in for $BETTA on local chains and testnet only. Anyone can mint.
contract MockBetta is ERC20 {
    constructor() ERC20("Betta Test Token", "tBETTA") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice A token that skims 1% on every transfer, to prove the game rejects such tokens.
contract TaxedToken is ERC20 {
    constructor() ERC20("Taxed", "TAX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 tax = value / 100;
            super._update(from, address(0xdead), tax);
            value -= tax;
        }
        super._update(from, to, value);
    }
}

/// @notice Exposes the fight library so tests can compare it with the TypeScript twin.
contract FightHarness {
    function fight(BettaFight.Fighter memory a, BettaFight.Fighter memory b, bytes32 seed) external pure returns (uint8) {
        return BettaFight.fight(a, b, seed);
    }

    function bracket(BettaFight.Fighter[] memory field, bytes32 seed) external pure returns (BettaFight.Placing memory) {
        return BettaFight.bracket(field, seed);
    }
}
