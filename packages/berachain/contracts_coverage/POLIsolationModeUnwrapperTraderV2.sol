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

    uint256 internal constant _ACTIONS_LENGTH = 3;

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(
        address _berachainRewardsRegistry,
        address _dolomiteMargin
    )
    POLIsolationModeTraderBaseV2(
        _dolomiteMargin,
        _berachainRewardsRegistry
    ) {}

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function initialize(
        address _vaultFactory
    )
    external
    initializer {
        _POLIsolationModeTraderBaseV2__initialize(_vaultFactory);
    }

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

    /**
     * @dev The `_makerAccount` could be the liquidator OR the isolation mode vault, so it's not really usable
     */
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo calldata /* _makerAccount */,
        IDolomiteStructs.AccountInfo calldata _metaVaultAccount,
        IDolomiteStructs.Par calldata /* oldInputPar */,
        IDolomiteStructs.Par calldata /* newInputPar */,
        IDolomiteStructs.Wei calldata inputDeltaWei,
        bytes calldata /* data */
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (IDolomiteStructs.AssetAmount memory) {
        IIsolationModeVaultFactory factory = vaultFactory();
        address vault = _getVaultForInternalTrade();
        /*assert(factory.getAccountByVault(vault) != address(0));*/

        _validateInputAndOutputMarketId(
            _inputMarketId,
            _outputMarketId
        );
        if (_metaVaultAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(vault) && _metaVaultAccount.number == _DEFAULT_ACCOUNT_NUMBER) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _metaVaultAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(vault)
                && _metaVaultAccount.number == _DEFAULT_ACCOUNT_NUMBER,
            _FILE,
            "Invalid taker account",
            _metaVaultAccount.owner
        );

        if (inputDeltaWei.value == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            inputDeltaWei.value == 0,
            _FILE,
            "Invalid input wei"
        );

        uint256 returnAmount = _getInputAmountParInternalTrade();

        _setTransientValues(/* _isolationModeVault = */ address(0), /* _inputAmountPar = */ 0);

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

    function exchange(
        address _tradeOriginator,
        address /* _receiver */,
        address _outputToken,
        address _inputToken,
        uint256 _inputAmount,
        bytes calldata /* _orderData */
    )
    external
    view
    override
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        IIsolationModeVaultFactory factory = vaultFactory();
        address vault = _getVaultForInternalTrade();
        /*assert(factory.getAccountByVault(vault) != address(0));*/

        _validateInputAndOutputToken(
            _inputToken,
            _outputToken
        );
        if (_inputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount > 0,
            _FILE,
            "Invalid input amount"
        );

        // @dev Always 0 because we are "selling" POL tokens for 0 tokens
        return 0;
    }

    function createActionsForUnwrapping(
        CreateActionsForUnwrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        _validateInputAndOutputMarketId(_params.inputMarket, _params.outputMarket);

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength());
        uint256 metaVaultAccountId = abi.decode(_params.orderData, (uint256));

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

        // "Sell" POL tokens for 0 tokens. This triggers a burn for the POL tokens and lowers the total supply of
        // POL tokens on Dolomite. We cannot transfer dTokens using an external sell action though, since it would
        // trigger reentrancy into `DolomiteMargin.operate`.
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
            metaVaultAccountId,
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _chainId = */ block.chainid,
            /* _calculateAmountWithMakerAccount = */ false,
            /* _orderData = */ ''
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
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
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

        if (factory.getAccountByVault(vault) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            factory.getAccountByVault(vault) != address(0),
            _FILE,
            "Account owner is not a vault",
            vault
        );

        if (transferAmount == type(uint256).max) {
            uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(factory));
            // We can safely get the _accountInfo's balance (the Zap account for ordinary unwraps or Solid account for
            // liquidations) here without worrying about read-only reentrancy
            IDolomiteStructs.Wei memory balanceWei = DOLOMITE_MARGIN().getAccountWei(_accountInfo, marketId);

            // Account wei cannot be negative for Isolation Mode assets
            /*assert(balanceWei.sign || balanceWei.value == 0);*/

            transferAmount = balanceWei.value;
        }
        if (transferAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );
        uint256 underlyingBalanceOf = IIsolationModeTokenVaultV1(vault).underlyingBalanceOf();
        if (underlyingBalanceOf >= transferAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            underlyingBalanceOf >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingBalanceOf,
            transferAmount
        );

        _setTransientValues(vault, transferAmount);

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
        if (_inputToken == address(vaultFactory())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputToken == address(vaultFactory()),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (isValidOutputToken(_outputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token",
            _outputToken
        );
    }
}
