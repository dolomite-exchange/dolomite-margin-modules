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

contract StewardsLedgerViewFunction {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "StewardsLedgerTest";

    struct Merchant {
        uint256 verifiedWeeklyRevenue;
        uint256 maxSpecifiedPercentage;
        uint256 factorForNewSwipes;
        uint256 principalOutstanding;
        uint256 totalRepaidAmount;
    }

    struct Swipe {
        uint256 amount;
        uint256 factorRate;
        uint256 swipePercentage;
        bool isClosed;
    }

    struct OpenSwipe {
        uint256 index;
        uint256 principalOutstanding;
        uint256 factorRate;
        uint256 swipePercentage;
    }

    uint256 merchantCounter;
    mapping(uint256 => Merchant) idToMerchant;
    mapping(uint256 => Swipe[]) merchantToSwipes;

    // ========================================================
    // ===================== Admin Functions ==================
    // ========================================================

    function ownerAddMerchant(
        uint256 _verifiedWeeklyRevenue,
        uint256 _maxSpecifiedPercentage,
        uint256 _factorForNewSwipes
    ) external {
        Merchant storage merchant = idToMerchant[merchantCounter++];

        merchant.verifiedWeeklyRevenue = _verifiedWeeklyRevenue;
        merchant.maxSpecifiedPercentage = _maxSpecifiedPercentage;
        merchant.factorForNewSwipes = _factorForNewSwipes;
    }

    function ownerSetVerifiedWeeklyRevenue(
        uint256 _merchantId,
        uint256 _verifiedWeeklyRevenue
    ) external {
        // require that merchantId is active
        Merchant storage merchant = idToMerchant[_merchantId];
        merchant.verifiedWeeklyRevenue = _verifiedWeeklyRevenue;
        // emit event
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
        merchant.principalOutstanding += _amount;

        // store swipe
        uint256 newSwipePercentage = calculateSwipePercentage(_amount, merchant.factorForNewSwipes, merchant.verifiedWeeklyRevenue);

        Swipe storage swipe = merchantToSwipes[_merchantId].push();
        swipe.amount = _amount;
        swipe.factorRate = merchant.factorForNewSwipes;
        swipe.swipePercentage = newSwipePercentage;
        swipe.isClosed = false;
    }

    function executeRepayment(
        uint256 _merchantId,
        uint256 _repayAmount,
        uint256 _principalReduction,
        uint256[] memory _swipesToClose
    ) external /* requireSenderIsStewards */ {
        // amount to reduce merchant principal by and what swipes to close
        Merchant storage merchant = idToMerchant[_merchantId];

        merchant.principalOutstanding -= _principalReduction;
        merchant.totalRepaidAmount += _repayAmount;

        Swipe[] storage merchantSwipes = merchantToSwipes[_merchantId];
        for (uint256 i; i < _swipesToClose.length; ++i) {
            merchantSwipes[_swipesToClose[i]].isClosed = true;
        }
    }

    // @todo need to add a way to partially do this
    function getRepaymentInputs(
        uint256 _merchantId,
        OpenSwipe[] memory _openSwipes,
        uint256 _repayAmount
    ) external view returns (uint256, OpenSwipe[] memory) {
        Merchant storage merchant = idToMerchant[_merchantId];
        uint256 totalPrincipalRemaining; // just for validating the openSwipes array
        uint256 principalReduction;

        // do standard repayments
        for (uint256 i; i < _openSwipes.length; ++i) {
            uint256 expectedPaymentAmount = merchant.verifiedWeeklyRevenue * _openSwipes[i].swipePercentage / 1e18;
            uint256 principalPortion = expectedPaymentAmount * 1e18 / _openSwipes[i].factorRate;

            if (_repayAmount >= expectedPaymentAmount && _openSwipes[i].principalOutstanding >= principalPortion) {
                _openSwipes[i].principalOutstanding -= principalPortion;
                _repayAmount -= expectedPaymentAmount;
                principalReduction += principalPortion;
            } else if (_repayAmount >= expectedPaymentAmount && _openSwipes[i].principalOutstanding < principalPortion) {
                uint256 paymentAmount = _openSwipes[i].principalOutstanding * _openSwipes[i].factorRate / 1e18;

                principalReduction += _openSwipes[i].principalOutstanding;
                _openSwipes[i].principalOutstanding = 0;
                _repayAmount -= paymentAmount;
            } else {
                assert(_repayAmount < expectedPaymentAmount);

                // @audit there is an edge case where the repay amount is less than the expected payment amount but still covers remaining principal
                uint256 principalAmount = _repayAmount * 1e18 / _openSwipes[i].factorRate;
                principalReduction += principalAmount;
                _openSwipes[i].principalOutstanding -= principalAmount;
                _repayAmount = 0;
                break;
            }
        }

        // do overpayments
        uint256 cursor;
        while (_repayAmount > 0) {
            uint256 paymentToClose = _openSwipes[cursor].principalOutstanding * _openSwipes[cursor].factorRate / 1e18;

            if (_repayAmount >= paymentToClose) {
                principalReduction += _openSwipes[cursor].principalOutstanding;
                _openSwipes[cursor].principalOutstanding = 0;
                _repayAmount -= paymentToClose;
            } else {
                uint256 principalAmount = _repayAmount * 1e18 / _openSwipes[cursor].factorRate;
                principalReduction += principalAmount;
                _openSwipes[cursor].principalOutstanding -= principalAmount;
                _repayAmount = 0;
            }

            cursor++;
        }

        // Do some validations for the openSwipes array
        Require.that(
            totalPrincipalRemaining == merchant.principalOutstanding,
            _FILE,
            "Invalid open swipes principal"
        );
        // @todo Maybe add validation for swipePercentage, factor rate, and amount

        return (principalReduction, _openSwipes);
    }

    // @todo need to add a way to partially do this
    function getExpectedRepaymentAmount(
        uint256 _merchantId,
        OpenSwipe[] memory _openSwipes
    ) external view returns (uint256) {
        Merchant storage merchant = idToMerchant[_merchantId];

        uint256 totalPrincipalRemaining;
        uint256 totalExpectedPaymentAmount;
        for (uint256 i; i < _openSwipes.length; ++i) {
            totalPrincipalRemaining += _openSwipes[i].principalOutstanding;

            uint256 expectedPaymentAmount = merchant.verifiedWeeklyRevenue * _openSwipes[i].swipePercentage / 1e18;

            // if less remaining than a standard repayment
            if (expectedPaymentAmount * 1e18 / _openSwipes[i].factorRate > _openSwipes[i].principalOutstanding) {
                expectedPaymentAmount = _openSwipes[i].principalOutstanding * _openSwipes[i].factorRate / 1e18;
            }

            totalExpectedPaymentAmount += expectedPaymentAmount;
        }

        Require.that(
            totalPrincipalRemaining == merchant.principalOutstanding,
            _FILE,
            "Invalid open swipes principal"
        );
        // @todo Maybe add validation for swipePercentage, factor rate, and amount

        return totalExpectedPaymentAmount;
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
