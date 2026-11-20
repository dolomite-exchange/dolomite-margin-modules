// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Require } from "../protocol/lib/Require.sol";

import "hardhat/console.sol";

contract StewardsLedgerTest {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "StewardsLedgerTest";

    struct Merchant {
        uint256 verifiedWeeklyRevenue;
        uint256 maxSpecifiedPercentage;
        uint256 factorForNewSwipes;

        uint256 totalRepaidAmount;
        uint256 principalOutstanding;
        uint256 firstOutstandingMCAIndex;
    }

    struct Swipe {
        uint256 amount;
        uint256 factorRate;
        uint256 swipePercentage;
        bool isClosed;
        // maybe store verified weekly revenue at the time
    }

    uint256 merchantCounter;
    mapping(uint256 => Merchant) idToMerchant;
    mapping(uint256 => Swipe[]) merchantIdToSwipes;

    // ========================================================
    // ===================== Admin Functions ==================
    // ========================================================

    function addMerchant(
        uint256 _verifiedWeeklyRevenue,
        uint256 _maxSpecifiedPercentage,
        uint256 _factorForNewSwipes
    ) external {
        idToMerchant[merchantCounter++] = Merchant({
            verifiedWeeklyRevenue: _verifiedWeeklyRevenue,
            maxSpecifiedPercentage: _maxSpecifiedPercentage,
            factorForNewSwipes: _factorForNewSwipes,
            totalRepaidAmount: 0,
            principalOutstanding: 0,
            firstOutstandingMCAIndex: 0
        });
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function authorizeSwipe(uint256 _merchantId, uint256 _amount) external {
        Merchant storage merchant = idToMerchant[_merchantId];

        // check outstanding principal + amount < credit limit
        Require.that(
            merchant.principalOutstanding + _amount <= calculateCreditLimit(_merchantId),
            _FILE,
            "Insufficient credit limit"
        );

        // store swipe
        uint256 newSwipePercentage = calculateSwipePercentage(_amount, merchant.factorForNewSwipes, merchant.verifiedWeeklyRevenue);
        Swipe memory swipe = Swipe({
            amount: _amount,
            factorRate: merchant.factorForNewSwipes,
            swipePercentage: newSwipePercentage,
            isClosed: false
        });
        merchant.principalOutstanding += _amount;

        merchantIdToSwipes[_merchantId].push(swipe);
    }

    function executeRepayment(
        uint256 _merchantId,
        uint256 _repayAmount,
        uint256 _principalRepaid,
        uint256[] memory _swipesToClose
    ) external {
        // require sender is dolomite

        // 
        Merchant storage merchant = idToMerchant[_merchantId];

        merchant.principalOutstanding -= _principalRepaid;
        merchant.totalRepaidAmount += _repayAmount;

        Swipe[] storage merchantSwipes = merchantIdToSwipes[_merchantId];
        for (uint256 i; i < _swipesToClose.length; ++i) {
            merchantSwipes[_swipesToClose[i]].isClosed = true;
        }
    }

    // ========================================================
    // ===================== View Functions ===================
    // ========================================================

    function calculateCreditLimit(uint256 _merchantId) public returns (uint256) {
        Merchant storage merchant = idToMerchant[_merchantId];

        return merchant.verifiedWeeklyRevenue * merchant.maxSpecifiedPercentage * 52 / merchant.factorForNewSwipes;
    }

    function calculateSwipePercentage(
        uint256 _amount,
        uint256 _factorRate,
        uint256 _verifiedWeeklyRevenue
    ) public returns (uint256) {
        return _amount * _factorRate * 52 / _verifiedWeeklyRevenue;
    }
}
