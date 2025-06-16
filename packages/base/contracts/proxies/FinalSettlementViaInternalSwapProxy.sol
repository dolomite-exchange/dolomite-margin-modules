// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   FinalSettlementViaInternalSwapProxy
 * @author  Dolomite
 *
 * Contract for closing borrow positions for a market that is fully closing down. Users who hold a positive balance for
 * a given market give their positive balance to borrowers in exchange for a `replacementMarket` + a reward.
 */
contract FinalSettlementViaInternalSwapProxy is OnlyDolomiteMargin {
    using DecimalLib for uint256;

    // ============ Constants ============

    bytes32 private constant _FILE = "FinalSettlementViaInternalSwap";

    // ============ Constructor ============

    constructor (address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {}

    // ============ External Functions ============

    function ownerForceWithdraw(
        IDolomiteStructs.AccountInfo[] calldata _accounts,
        uint256 _marketId
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _accounts.length > 0,
            _FILE,
            "Invalid accounts"
        );

        IDolomiteStructs.AssetAmount memory amount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Target,
            value: 0
        });
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](_accounts.length);
        for (uint256 i; i < _accounts.length; ++i) {
            actions[i] = AccountActionLib.encodeWithdrawalAction(
                /* _accountId = */ i,
                _marketId,
                amount,
                _accounts[i].owner
            );
        }

        DOLOMITE_MARGIN().operate(_accounts, actions);
    }

    function ownerSettle(
        IDolomiteStructs.AccountInfo[] calldata _borrowAccounts,
        IDolomiteStructs.AccountInfo[] calldata _supplyAccounts,
        uint256 _owedMarket,
        uint256 _rewardMarket,
        IDolomiteStructs.Decimal calldata _reward
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _borrowAccounts.length == _supplyAccounts.length && _borrowAccounts.length > 0,
            _FILE,
            "Invalid accounts"
        );
        Require.that(
            _owedMarket != _rewardMarket,
            _FILE,
            "Invalid markets"
        );
        Require.that(
            _reward.value > 0 && _reward.value <= DOLOMITE_MARGIN().getLiquidationSpread().value,
            _FILE,
            "Invalid reward"
        );

        uint256 owedPrice = DOLOMITE_MARGIN().getMarketPrice(_owedMarket).value;
        uint256 owedPriceAdj = owedPrice.mul(DecimalLib.onePlus(_reward));
        uint256 rewardPrice = DOLOMITE_MARGIN().getMarketPrice(_rewardMarket).value;

        for (uint256 i; i < _borrowAccounts.length; ++i) {
            _settleAccount(
                _borrowAccounts[i],
                _supplyAccounts[i],
                _owedMarket,
                _rewardMarket,
                owedPriceAdj,
                rewardPrice
            );
        }
    }

    function _settleAccount(
        IDolomiteStructs.AccountInfo memory _borrowAccount,
        IDolomiteStructs.AccountInfo memory _supplyAccount,
        uint256 _owedMarket,
        uint256 _rewardMarket,
        uint256 _owedPriceAdj,
        uint256 _rewardPrice
    ) internal {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
        accounts[0] = _borrowAccount;
        accounts[1] = _supplyAccount;

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](2);

        IDolomiteStructs.Wei memory owedBalance = DOLOMITE_MARGIN().getAccountWei(_borrowAccount, _owedMarket);
        IDolomiteStructs.Wei memory heldBalance = DOLOMITE_MARGIN().getAccountWei(_supplyAccount, _owedMarket);
        Require.that(
            !owedBalance.sign && owedBalance.value != 0,
            _FILE,
            "Invalid owed amount",
            _borrowAccount.owner,
            _borrowAccount.number
        );
        Require.that(
            heldBalance.sign && heldBalance.value != 0,
            _FILE,
            "Invalid held amount",
            _supplyAccount.owner,
            _supplyAccount.number
        );

        bool isSwapped = false;
        if (owedBalance.value > heldBalance.value) {
            // The supply account can't fully cover the debt
            isSwapped = true;
            owedBalance.value = heldBalance.value;
        }

        actions[0] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Transfer,
            accountId: !isSwapped ? 0 : 1,
            amount: IDolomiteStructs.AssetAmount({
                sign: !isSwapped ? true : false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: owedBalance.value
            }),
            primaryMarketId: _owedMarket,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: !isSwapped ? 1 : 0,
            data: bytes("")
        });

        uint256 rewardAmountAdj = owedBalance.value * _owedPriceAdj / _rewardPrice;
        actions[1] = AccountActionLib.encodeTransferAction(
            /* _fromAccountId = */ 0,
            /* _toAccountId = */ 1,
            _rewardMarket,
            IDolomiteStructs.AssetDenomination.Wei,
            rewardAmountAdj
        );

        DOLOMITE_MARGIN().operate(accounts, actions);
    }
}
