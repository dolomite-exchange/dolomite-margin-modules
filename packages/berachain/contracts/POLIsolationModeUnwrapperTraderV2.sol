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

import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { IDolomiteERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteERC4626.sol";
import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { IIsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginInternalTrader } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginInternalTrader.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { POLIsolationModeTraderBaseV2 } from "./POLIsolationModeTraderBaseV2.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   POLIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping unwrapping POL tokens into normal markets. Upon settlement,
 *          the burned dToken is sent from the user's vault to this contract and the factory
 *          token is burned from `DolomiteMargin`.
 */
contract POLIsolationModeUnwrapperTraderV2 is 
    ProxyContractHelpers,
    POLIsolationModeTraderBaseV2,
    IIsolationModeUnwrapperTraderV2,
    IDolomiteMarginInternalTrader 
{
    using TypesLib for IDolomiteStructs.Par;

    // ============ Constants ============

    bytes32 private constant _FILE = "POLIsolationModeUnwrapperV2";
    bytes32 private constant _INPUT_AMOUNT_PAR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputAmountPar")) - 1);
    bytes32 private constant _LIQUIDATION_ADDRESS_OVERRIDE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.liquidationAddressOverride")) - 1); // solhint-disable-line max-line-length

    uint256 internal constant _ACTIONS_LENGTH = 3;

    IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY;

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    // @todo may want to still check underlying balance somewhere
    // @todo Add fee on unwrapping
    constructor(
        address _berachainRewardsRegistry,
        address _dolomiteMargin
    )
    POLIsolationModeTraderBaseV2(
        _dolomiteMargin,
        address(IBerachainRewardsRegistry(_berachainRewardsRegistry).dolomiteRegistry())
    ) {
        BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    onlyDolomiteMargin(msg.sender)
    onlyGenericTraderOrTrustedLiquidator(_sender) {
        _callFunction(_sender, _accountInfo, _data);
    }

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
        IIsolationModeVaultFactory factory = vaultFactory();
        address vaultOwner = _getLiquidationAddressOverride(_tradeOriginator);

        _validateInputAndOutputToken(
            _inputToken,
            _outputToken
        );
        Require.that(
            factory.getAccountByVault(vaultOwner) != address(0),
            _FILE,
            "Invalid trade originator",
            _tradeOriginator
        );
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // @dev Always 0 because we are "selling" POL tokens for 0 tokens
        return 0;
    }

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo calldata makerAccount,
        IDolomiteStructs.AccountInfo calldata takerAccount,
        IDolomiteStructs.Par calldata /* oldInputPar */,
        IDolomiteStructs.Par calldata /* newInputPar */,
        IDolomiteStructs.Wei calldata inputDeltaWei,
        bytes calldata /* data */
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (IDolomiteStructs.AssetAmount memory) {
        // @audit Ensure that I can't call for a different isolation mode vault
        IIsolationModeVaultFactory factory = vaultFactory();
        address vault = _getLiquidationAddressOverride(makerAccount.owner);

        _validateInputAndOutputMarketId(
            inputMarketId,
            outputMarketId
        );
        Require.that(
            factory.getAccountByVault(vault) != address(0),
            _FILE,
            "Invalid maker account",
            vault
        );
        Require.that(
            takerAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(vault)
                && takerAccount.number == 0,
            _FILE,
            "Invalid taker account",
            takerAccount.owner
        );

        Require.that(
            inputDeltaWei.value == 0,
            _FILE,
            "Invalid input wei"
        );

        uint256 returnAmount = _getUint256FromMap(_INPUT_AMOUNT_PAR_SLOT, makerAccount.owner);
        Require.that(
            returnAmount > 0,
            _FILE,
            "Invalid return amount"
        );

        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, makerAccount.owner, 0);
        _setAddressInMap(_LIQUIDATION_ADDRESS_OVERRIDE_SLOT, makerAccount.owner, address(0));
        return IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: returnAmount
        });
    }

    // ==================================================================
    // ========================== View Functions ========================
    // ==================================================================

    function createActionsForUnwrapping(
        CreateActionsForUnwrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        _validateInputAndOutputMarketId(_params.inputMarket, _params.outputMarket);

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
        actions[2] = AccountActionLib.encodeInternalTradeActionForUnwrap(
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

    function getExchangeCost(
        address _inputToken,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory /* _orderData */
    )
    public
    override
    view
    returns (uint256) {
        _validateInputAndOutputToken(
            _inputToken,
            _outputToken
        );
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        return _desiredInputAmount;
    }

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return IDolomiteERC4626(vaultFactory().UNDERLYING_TOKEN()).asset() == _outputToken;
    }

    function token() external view returns (address) {
        return address(vaultFactory());
    }

    function actionsLength() public override pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    // ==================================================================
    // ======================== Internal Functions ======================
    // ==================================================================

    function _callFunction(
        address /* _sender */,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    ) internal {
        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        (uint256 transferAmount, address vault, /* uint256 vaultSubAccount */) = abi.decode(
            _data,
            (uint256, address, uint256)
        );
        IIsolationModeVaultFactory factory = vaultFactory();

        Require.that(
            factory.getAccountByVault(vault) != address(0),
            _FILE,
            "Account owner is not a vault",
            vault
        );

        if (transferAmount == type(uint256).max) {
            uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(factory));
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
        uint256 underlyingBalanceOf = IIsolationModeTokenVaultV1(vault).underlyingBalanceOf();
        Require.that(
            underlyingBalanceOf >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingBalanceOf,
            transferAmount
        );

        // @audit Have to make sure a user can't maliciously set this
        if (_accountInfo.owner != vault) {
            _setAddressInMap(_LIQUIDATION_ADDRESS_OVERRIDE_SLOT, _accountInfo.owner, vault);
        }
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, _accountInfo.owner, transferAmount);

        factory.enqueueTransferFromDolomiteMargin(vault, transferAmount);
    }

    function _validateInputAndOutputMarketId(
        uint256 _inputMarketId,
        uint256 _outputMarketId
    ) internal view {
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);
        _validateInputAndOutputToken(inputToken, outputToken);
    }

    function _validateInputAndOutputToken(
        address _inputToken,
        address _outputToken
    ) internal view {
        Require.that(
            _inputToken == address(vaultFactory()),
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
    }

    function _getLiquidationAddressOverride(
        address _tradeOriginator
    ) internal view returns (address) {
        address liquidationAddressOverride = _getAddressFromMap(_LIQUIDATION_ADDRESS_OVERRIDE_SLOT, _tradeOriginator);
        return liquidationAddressOverride == address(0) ? _tradeOriginator : liquidationAddressOverride;
    }
}
