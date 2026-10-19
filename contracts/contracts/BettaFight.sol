// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Betta fights and brackets
/// @notice Twin of src/game/battle.ts and runTournament in src/game/tournament.ts. Integer maths and
/// keccak draws only, so the browser replays exactly the fight the contract decided.
library BettaFight {
    uint8 internal constant THICK = 1;
    uint8 internal constant RIPPER = 2;
    uint8 internal constant IRON = 4;
    uint8 internal constant QUICK = 8;
    uint8 internal constant JAW = 16;
    uint8 internal constant WIND = 32;
    uint8 internal constant INTIM = 64;
    uint8 internal constant CROWD = 128;
    uint8 internal constant BYE = type(uint8).max;

    struct Fighter {
        uint256 attack;
        uint256 defense;
        uint256 beauty;
        uint256 health; // 0..100
        bool sick;
        uint8 traits; // bit mask, see constants
    }

    struct Rng {
        bytes32 seed;
        uint32 i;
    }

    /// @dev keccak256(seed ‖ uint32 counter) mod n
    function next(Rng memory r, uint256 n) internal pure returns (uint256 v) {
        v = uint256(keccak256(abi.encodePacked(r.seed, r.i))) % n;
        unchecked {
            r.i++;
        }
    }

    function maxHp(Fighter memory f) internal pure returns (uint256 m) {
        m = (700 + f.defense * 6) / 10;
        if (f.traits & IRON != 0) m = (m * 110) / 100;
    }

    /// @return winner 0 or 1
    function fight(Fighter memory a, Fighter memory b, bytes32 seed) internal pure returns (uint8 winner) {
        Rng memory rng = Rng(seed, 0);
        Fighter[2] memory F = [a, b];
        uint256[2] memory max = [maxHp(a), maxHp(b)];
        uint256[2] memory hp = [(max[0] * (100 + a.health)) / 200, (max[1] * (100 + b.health)) / 200];
        uint256[2] memory atk;
        for (uint256 i; i < 2; i++) {
            Fighter memory f = F[i];
            atk[i] = (f.attack * (f.sick ? 750 : 1000) * (800 + 2 * f.health) * (F[1 - i].traits & INTIM != 0 ? 930 : 1000)) / 1_000_000;
        }
        uint256 init0 = atk[0] + a.beauty * 300 + next(rng, 25_000) + (a.traits & QUICK != 0 ? 18_000 : 0);
        uint256 init1 = atk[1] + b.beauty * 300 + next(rng, 25_000) + (b.traits & QUICK != 0 ? 18_000 : 0);
        uint256 turn = init0 >= init1 ? 0 : 1;
        bool[2] memory winded;

        for (uint256 round; round < 40 && hp[0] > 0 && hp[1] > 0; round++) {
            uint256 t = turn;
            uint256 o = 1 - turn;
            Fighter memory me = F[t];
            Fighter memory foe = F[o];
            int256 ev = 500 + (int256(foe.defense) - int256(me.attack)) * 30 + int256(foe.beauty) * 6 + (foe.traits & QUICK != 0 ? int256(500) : int256(0));
            if (ev < 300) ev = 300;
            if (ev > 2800) ev = 2800;
            uint256 crit = 500 + me.beauty * 13 + (me.traits & RIPPER != 0 ? 600 : 0);
            if (crit > 2800) crit = 2800;
            if (next(rng, 10_000) >= uint256(ev)) {
                bool isCrit = next(rng, 10_000) < crit;
                uint256 d = (atk[t] * (500 + next(rng, 450))) / 1000;
                d = (d * 100_000) / (100_000 + foe.defense * 1200);
                d = (d * 85) / 100;
                if (isCrit) d = (d * 16) / 10;
                if (me.traits & JAW != 0) d = (d * 108) / 100;
                if (foe.traits & THICK != 0) d = (d * 90) / 100;
                uint256 dmg = (d + 500) / 1000;
                if (dmg < 2) dmg = 2;
                hp[o] = hp[o] > dmg ? hp[o] - dmg : 0;
                if (hp[o] > 0 && hp[o] * 4 < max[o] && !winded[o] && foe.traits & WIND != 0) {
                    winded[o] = true;
                    uint256 heal = (max[o] * 18 + 50) / 100;
                    hp[o] = hp[o] + heal > max[o] ? max[o] : hp[o] + heal;
                }
            }
            turn = o;
        }

        if (hp[0] == 0) return 1;
        if (hp[1] == 0) return 0;
        uint256 s0 = (hp[0] * 10_000) / max[0] + (a.traits & CROWD != 0 ? 1000 : 0);
        uint256 s1 = (hp[1] * 10_000) / max[1] + (b.traits & CROWD != 0 ? 1000 : 0);
        return s0 >= s1 ? 0 : 1;
    }

    function matchSeed(bytes32 seed, uint256 r, uint256 k) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(seed, uint8(r), uint8(k)));
    }

    struct Placing {
        uint8 champion;
        uint8 runnerUp; // BYE if the final was a walkover
        uint8[2] semis; // losing semifinalists, BYE where a semifinal was a walkover
    }

    /// @notice Shuffle, give byes their own first-round pairs, shuffle the pairs, play every round.
    function bracket(Fighter[] memory field, bytes32 seed) internal pure returns (Placing memory p) {
        uint256 n = field.length;
        Rng memory rng = Rng(seed, 0);
        uint256 size = 2;
        while (size < n) size *= 2;

        uint8[] memory order = new uint8[](n);
        for (uint256 i; i < n; i++) order[i] = uint8(i);
        for (uint256 i = n - 1; i > 0; i--) {
            uint256 j = next(rng, i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }
        uint256 byes = size - n;
        uint256 pairs = size / 2;
        uint8[2][] memory pr = new uint8[2][](pairs);
        uint256 k;
        for (uint256 i; i < byes; i++) pr[k++] = [order[i], BYE];
        for (uint256 i = byes; i < n; i += 2) pr[k++] = [order[i], order[i + 1]];
        for (uint256 i = pairs - 1; i > 0; i--) {
            uint256 j = next(rng, i + 1);
            (pr[i], pr[j]) = (pr[j], pr[i]);
        }

        uint8[] memory alive = new uint8[](size);
        for (uint256 i; i < pairs; i++) {
            alive[2 * i] = pr[i][0];
            alive[2 * i + 1] = pr[i][1];
        }
        uint256 len = size;
        uint256 rounds;
        for (uint256 s = size; s > 1; s /= 2) rounds++;
        p.runnerUp = BYE;
        p.semis = [BYE, BYE];

        for (uint256 r; len > 1; r++) {
            uint256 m;
            for (uint256 i; i < len; i += 2) {
                uint8 a = alive[i];
                uint8 b = alive[i + 1];
                uint8 w = a;
                if (b != BYE) w = fight(field[a], field[b], matchSeed(seed, r, i / 2)) == 0 ? a : b;
                if (b != BYE) {
                    uint8 loser = w == a ? b : a;
                    if (r == rounds - 1) p.runnerUp = loser;
                    else if (r == rounds - 2) p.semis[i / 2] = loser;
                }
                alive[m++] = w;
            }
            len = m;
        }
        p.champion = alive[0];
    }
}
