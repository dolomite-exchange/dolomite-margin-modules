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

    struct UnderpaymentInfo {
        uint256 partialPrincipalPaymentAmount;
        uint256 swipesLengthSnapshot;
    }

    struct Merchant {
        uint256 verifiedWeeklyRevenue;
        uint256 maxSpecifiedPercentage;
        uint256 factorForNewSwipes;
        uint256 headSwipeIndex;

        uint256 numRepayments;
        uint256 totalRepaidAmount;
        uint256 principalOutstanding;
        uint256 firstOutstandingMCAIndex;
    }

    struct Swipe {
        uint256 amount;
        uint256 swipePrincipalOutstanding; // only updated once the swipe becomes the head swipe
        uint256 factorRate;
        bool isClosed;

        uint256 swipePercentage;
        uint256 cumulativeSwipePercentage;
        uint256 cumulativeWeightedFactorRate;
        uint256 cumulativeAmountTotal; // for calculating the weighted factor rate
        uint256 paymentsAlreadyMade;
        UnderpaymentInfo[] underpayments;
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
            headSwipeIndex: 0,
            totalRepaidAmount: 0,
            principalOutstanding: 0,
            firstOutstandingMCAIndex: 0,
            numRepayments: 0
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
        merchant.principalOutstanding += _amount;

        // store swipe
        uint256 newSwipePercentage = calculateSwipePercentage(_amount, merchant.factorForNewSwipes, merchant.verifiedWeeklyRevenue);
        Swipe[] storage merchantSwipes = merchantIdToSwipes[_merchantId];

        uint256 cumulativeSwipePercentage;
        uint256 cumulativeWeightedFactorRate;
        uint256 cumulativeAmountTotal;
        if (merchantSwipes.length == 0) {
            cumulativeSwipePercentage = newSwipePercentage;
            cumulativeWeightedFactorRate = _amount * merchant.factorForNewSwipes;
            cumulativeAmountTotal = _amount;
        } else {
            cumulativeSwipePercentage = merchantSwipes[merchantSwipes.length - 1].cumulativeSwipePercentage + newSwipePercentage;
            cumulativeWeightedFactorRate = merchantSwipes[merchantSwipes.length - 1].cumulativeWeightedFactorRate + _amount * merchant.factorForNewSwipes;
            cumulativeAmountTotal = merchantSwipes[merchantSwipes.length - 1].cumulativeAmountTotal + _amount;
        }

        Swipe storage swipe = merchantIdToSwipes[_merchantId].push();
        swipe.amount = _amount;
        swipe.factorRate = merchant.factorForNewSwipes;
        swipe.swipePrincipalOutstanding = _amount;
        swipe.isClosed = false;
        swipe.swipePercentage = newSwipePercentage;
        swipe.cumulativeSwipePercentage = cumulativeSwipePercentage;
        swipe.cumulativeWeightedFactorRate = cumulativeWeightedFactorRate;
        swipe.cumulativeAmountTotal = cumulativeAmountTotal;
        swipe.paymentsAlreadyMade = merchant.numRepayments;
    }

    // @audit does the weighted factor rate formula work as repayments start happening
    // @audit we'd need to handle if head swipe has less payment remaining than the swipe percentage
    // @audit we need to handle changes to the verified monthly revenue
    function executeRepayment(
        uint256 _merchantId,
        uint256 _repayAmount,
        uint256 _underpaymentHelperIndex
    ) external /* requireSenderIsStewards */ {
        Merchant storage merchant = idToMerchant[_merchantId];
        Swipe[] storage merchantSwipes = merchantIdToSwipes[_merchantId];

        // calculate total swipe percentage & expected payment
        uint256 totalSwipePercentage = merchantSwipes[merchantSwipes.length - 1].cumulativeSwipePercentage - merchantSwipes[merchant.headSwipeIndex - 1].cumulativeSwipePercentage;
        uint256 expectedPayment = merchant.verifiedWeeklyRevenue * totalSwipePercentage / 1e18;

        Swipe storage headSwipe = merchantSwipes[merchant.headSwipeIndex];
        Swipe storage latestSwipe = merchantSwipes[merchantSwipes.length];

        if (_repayAmount == expectedPayment) {
            uint256 weightedFactorRateNumerator = merchant.headSwipeIndex == 0 ? latestSwipe.cumulativeWeightedFactorRate : latestSwipe.cumulativeWeightedFactorRate - headSwipe.cumulativeWeightedFactorRate;
            uint256 weightedFactorRateDenominator = merchant.headSwipeIndex == 0 ? latestSwipe.cumulativeAmountTotal : latestSwipe.cumulativeAmountTotal - headSwipe.cumulativeAmountTotal;

            // decrease total principal by the weighted factor rate
            uint256 principalAmount = _repayAmount * weightedFactorRateNumerator / weightedFactorRateDenominator;
            merchant.principalOutstanding -= principalAmount;

            // decrease head swipe principal
            // @audit This has to be prior to the other stuff. Can fix later
            headSwipe.swipePrincipalOutstanding -= _repayAmount * headSwipe.swipePercentage / headSwipe.factorRate;
        } else if (_repayAmount > expectedPayment) {
            uint256 weightedFactorRateNumerator = merchant.headSwipeIndex == 0 ? latestSwipe.cumulativeWeightedFactorRate : latestSwipe.cumulativeWeightedFactorRate - headSwipe.cumulativeWeightedFactorRate;
            uint256 weightedFactorRateDenominator = merchant.headSwipeIndex == 0 ? latestSwipe.cumulativeAmountTotal : latestSwipe.cumulativeAmountTotal - headSwipe.cumulativeAmountTotal;

            uint256 principalAmount = _repayAmount * weightedFactorRateNumerator / weightedFactorRateDenominator;
            merchant.principalOutstanding -= principalAmount;

            // start at head swipe and loop through
            uint256 overpayAmount = _repayAmount - expectedPayment;
            while (overpayAmount > 0) {
                if (overpayAmount > headSwipe.swipePrincipalOutstanding) {
                    merchant.principalOutstanding -= headSwipe.swipePrincipalOutstanding;
                    overpayAmount -= headSwipe.swipePrincipalOutstanding;
                    headSwipe.swipePrincipalOutstanding = 0;
                    _updateHead();
                } else if (overpayAmount < headSwipe.swipePrincipalOutstanding) {
                    headSwipe.swipePrincipalOutstanding -= overpayAmount;
                    merchant.principalOutstanding -= overpayAmount;
                    overpayAmount = 0;
                } else {
                    headSwipe.swipePrincipalOutstanding = 0;
                    merchant.principalOutstanding -= overpayAmount;
                    overpayAmount = 0;
                    _updateHead();
                }
            }
        } else {
            Swipe storage partialSwipe = merchantSwipes[_underpaymentHelperIndex];

            // check underpaymentHelperIndex is correct
            // @audit need to handle edge case where it perfectly fills this swipe
            // uint256 percentagePaid = _repayAmount * 1e18 / merchant.verifiedWeeklyRevenue; REMOVED CAUSE STACK TOO DEEP
            uint256 leftIndex = merchantSwipes[_underpaymentHelperIndex - 1].cumulativeSwipePercentage - merchantSwipes[merchant.headSwipeIndex - 1].cumulativeSwipePercentage;
            Require.that(
                _repayAmount * 1e18 / merchant.verifiedWeeklyRevenue < leftIndex + partialSwipe.swipePercentage,
                _FILE,
                "Invalid helper index"
            );

            // decrease total principal by weighted factor rate under the index
            uint256 weightedFactorRateNumerator = merchant.headSwipeIndex == 0 ? partialSwipe.cumulativeWeightedFactorRate : partialSwipe.cumulativeWeightedFactorRate - headSwipe.cumulativeWeightedFactorRate;
            uint256 weightedFactorRateDenominator = merchant.headSwipeIndex == 0 ? partialSwipe.cumulativeAmountTotal : partialSwipe.cumulativeAmountTotal - headSwipe.cumulativeAmountTotal;

            uint256 fullSwipesPayment = merchant.verifiedWeeklyRevenue * leftIndex / 1e18;
            merchant.principalOutstanding -= fullSwipesPayment * weightedFactorRateNumerator / weightedFactorRateDenominator;

            // decrease total principal by leftover amount at the index
            uint256 partialPrincipalAmount = (_repayAmount - fullSwipesPayment) / partialSwipe.factorRate * 1e18;
            merchant.principalOutstanding -= partialPrincipalAmount;

            // push to the swipes underpayments
            partialSwipe.underpayments.push(UnderpaymentInfo({ partialPrincipalPaymentAmount: partialPrincipalAmount, swipesLengthSnapshot: merchantSwipes.length }));
        }
    }

    // @audit one thing I'd like to add is potentially confirming the new principal amount fits with total principal outstanding
    function _updateHead() internal {
        // check that current head has principal of 0

        // move head to next index

        // calculate number of full repayments made (will need to figure out changes to verified weekly revenue)

        // loop through underpayments to add to repayment number, and if need be, move underpayments to next swipe

        // calculate principal paid amount using factor rate and update principal owed on this swipe
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
