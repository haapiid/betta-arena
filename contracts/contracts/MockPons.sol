// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// LOCAL TESTING ONLY. A stand-in for Pons on Robinhood Chain with the same calls the engine makes:
// the token knows its curve, the curve takes ETH and a creator fee, and the fee escrow pays the
// creator on claim(). Prices and fees are made up; the real Pons contracts are not used here.

contract MockPonsEscrow {
    mapping(address => uint256) public balanceOf;

    function deposit(address creator) external payable {
        balanceOf[creator] += msg.value;
    }

    function claim() external {
        uint256 amt = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "send failed");
    }
}

contract MockPonsCurve {
    ERC20 public token;
    MockPonsEscrow public immutable escrow;
    address public immutable creator;
    uint256 public tokensPerEth = 50_000_000; // whole tokens per ETH, falls as people buy
    uint256 public constant FEE_BPS = 100; // 1% of every trade to the creator
    bool public graduated;

    constructor(MockPonsEscrow escrow_, address creator_) {
        escrow = escrow_;
        creator = creator_;
    }

    function setToken(ERC20 t) external {
        require(address(token) == address(0), "set");
        token = t;
    }

    function graduate() external {
        graduated = true;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 out) {
        require(!graduated, "graduated");
        require(msg.value == quoteIn, "value");
        uint256 fee = (quoteIn * FEE_BPS) / 10_000;
        escrow.deposit{value: fee}(creator);
        out = ((quoteIn - fee) * tokensPerEth);
        require(out >= minTokensOut, "slippage");
        tokensPerEth = (tokensPerEth * 999) / 1000;
        token.transfer(recipient, out);
    }

    /// sell: pull tokens back into the curve and pay ETH, minus the creator fee
    function sell(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        uint256 eth = amount / tokensPerEth;
        uint256 fee = (eth * FEE_BPS) / 10_000;
        escrow.deposit{value: fee}(creator);
        (bool ok,) = msg.sender.call{value: eth - fee}("");
        require(ok, "send failed");
    }

    receive() external payable {}
}

contract MockPonsToken is ERC20 {
    address public immutable curve;

    constructor(address curve_) ERC20("Betta Arena", "BETTA") {
        curve = curve_;
        _mint(curve_, 1_000_000_000 ether);
    }
}
