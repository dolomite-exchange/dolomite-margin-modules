// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IDolomiteMarginInternalTrader } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginInternalTrader.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   DolomiteTokenIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping unwrapping iso mode dolomite tokens into normal markets. Upon settlement,
 *          the burned dToken is sent from the user's vault to this contract and the factory token is burned from `DolomiteMargin`.
 */
contract DolomiteTokenIsolationModeUnwrapperTraderV2 is ProxyContractHelpers, IsolationModeUnwrapperTraderV2, IDolomiteMarginInternalTrader {
    using TypesLib for IDolomiteStructs.Par;

    // ============ Constants ============

    bytes32 private constant _FILE = "DTokenIsolationModeUnwrapperV2";
    bytes32 private constant _INPUT_AMOUNT_PAR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputAmountPar")) - 1);

    IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY;

    // ============ Constructor ============

    // @todo See if we can add a fee on the unwrapper
    constructor(
        address _berachainRewardsRegistry,
        address _dTokenFactory,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeUnwrapperTraderV2(
        _dTokenFactory,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    override
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _inputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory extraOrderData) = abi.decode(_orderData, (uint256, bytes));
        // @audit Have to make sure a user can't maliciously set this
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, _tradeOriginator, _inputAmount);

        // @dev Always 0
        return _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _outputToken,
            minOutputAmount,
            address(VAULT_FACTORY),
            _inputAmount,
            extraOrderData
        );
    }

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo calldata makerAccount,
        IDolomiteStructs.AccountInfo calldata takerAccount, // @audit Add checks that I can't call for a different isolation mode vault
        IDolomiteStructs.Par calldata oldInputPar,
        IDolomiteStructs.Par calldata newInputPar,
        IDolomiteStructs.Wei calldata inputDeltaWei,
        bytes calldata data
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (IDolomiteStructs.AssetAmount memory) {
        // @todo Add checks that also work with liquidations
        Require.that(
            VAULT_FACTORY.getAccountByVault(makerAccount.owner) != address(0),
            _FILE,
            "Invalid maker account"
        );
        Require.that(
            takerAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(makerAccount.owner)
                && takerAccount.number == 0,
            _FILE,
            "Invalid taker account"
        );
        Require.that(
            inputDeltaWei.value == 0,
            _FILE,
            "Invalid input wei"
        );

        uint256 returnAmount = _getUint256FromMap(_INPUT_AMOUNT_PAR_SLOT, makerAccount.owner);
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, makerAccount.owner, 0);
        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: returnAmount
        });
    }

    function createActionsForUnwrapping(
        CreateActionsForUnwrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        Require.that(
            DOLOMITE_MARGIN().getMarketTokenAddress(_params.inputMarket) == address(VAULT_FACTORY),
            _FILE,
            "Invalid input market",
            _params.inputMarket
        );
        Require.that(
            isValidOutputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_params.outputMarket)),
            _FILE,
            "Invalid output market",
            _params.outputMarket
        );

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength());
        uint256 makerAccountId = abi.decode(_params.orderData, (uint256));

        // Transfer the IsolationMode tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _params.primaryAccountId,
            /* _callee */ address(this),
            /* _callData = */ abi.encode(
                _params.inputAmount,
                _params.otherAccountOwner,
                _params.otherAccountNumber
            )
        );

        // "Sell" POL tokens for 0 tokens
        actions[1] = AccountActionLib.encodeExternalSellAction(
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ _params.inputAmount,
            /* _amountOutMinWei = */ _params.minOutputAmount,
            _params.orderData
        );

        // transfer from metavault to vault
        actions[2] = AccountActionLib.encodeInternalTradeActionForWrap(
            makerAccountId,
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _amountInPar = */ 0,
            block.chainid,
            false,
            ''
        );

        return actions;
    }

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return true;
    }

    function actionsLength() public override pure returns (uint256) {
        return _ACTIONS_LENGTH + 1;
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        (uint256 transferAmount, address vaultOwner, /* uint256 vaultSubAccount */) = abi.decode(
            _data,
            (uint256, address, uint256)
        );

        Require.that(
            VAULT_FACTORY.getAccountByVault(vaultOwner) != address(0),
            _FILE,
            "Account owner is not a vault",
            vaultOwner
        );

        if (transferAmount == type(uint256).max) {
            uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(VAULT_FACTORY));
            /// @note   Account wei cannot be negative for Isolation Mode assets
            /// @note   We can safely get the _accountInfo's (the Zap account for ordinary unwraps or Solid account for
            ///         liquidations) balance here without worrying about read-only reentrancy
            IDolomiteStructs.Wei memory balanceWei = DOLOMITE_MARGIN().getAccountWei(_accountInfo, marketId);
            assert(balanceWei.sign || balanceWei.value == 0);

            transferAmount = balanceWei.value;
        }
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );

        VAULT_FACTORY.enqueueTransferFromDolomiteMargin(vaultOwner, transferAmount);
    }

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address _outputToken,
        uint256 _minOutputAmount,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        return 0;
    }

    function _getExchangeCost(
        address,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        return _desiredInputAmount;
    }
}
