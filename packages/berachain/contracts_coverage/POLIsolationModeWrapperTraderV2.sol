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
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol"; // solhint-disable-line max-line-length
import { IIsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeWrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginInternalTrader } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginInternalTrader.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { POLIsolationModeTraderBaseV2 } from "./POLIsolationModeTraderBaseV2.sol";


/**
 * @title   POLIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping normal markets into iso mode dolomite tokens. Upon settlement, the dToken
 *          is sent to the user's vault and the factory token is minted to `DolomiteMargin`.
 */
contract POLIsolationModeWrapperTraderV2 is
    ProxyContractHelpers,
    POLIsolationModeTraderBaseV2,
    IIsolationModeWrapperTraderV2,
    IDolomiteMarginInternalTrader
{
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteStructs.Par;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "POLIsolationModeWrapperV2";
    bytes32 private constant _INPUT_AMOUNT_PAR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputAmountPar")) - 1);

    uint256 internal constant _ACTIONS_LENGTH = 3;

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(
        address _berachainRewardsRegistry,
        address _dolomiteMargin
    ) POLIsolationModeTraderBaseV2(
        _dolomiteMargin,
        _berachainRewardsRegistry
    ) {}

    // ==================================================================
    // ======================== Public Functions ========================
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
        _validateInputAndOutputToken(_inputToken, _outputToken);
        if (_tradeOriginator == _getVaultForInternalTrade()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _tradeOriginator == _getVaultForInternalTrade(),
            _FILE,
            "Invalid trade originator",
            _tradeOriginator
        );
        if (_inputAmount == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount == 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, ) = abi.decode(_orderData, (uint256, bytes));

        uint256 outputAmount = _getInputAmountParInternalTrade();
        _setTransientValues(/* _isolationModeVault = */ address(0), /* _inputAmountPar = */ 0);

        if (outputAmount >= minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minOutputAmount
        );

        _approveIsolationModeTokenForTransfer(_tradeOriginator, _receiver, outputAmount);

        return outputAmount;
    }

    // ==================================================================
    // ========================== View Functions ========================
    // ==================================================================

    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo calldata _metaVaultAccount,
        IDolomiteStructs.AccountInfo calldata _isolationModeVaultAccount,
        IDolomiteStructs.Par calldata _oldInputPar,
        IDolomiteStructs.Par calldata _newInputPar,
        IDolomiteStructs.Wei calldata /* _inputDeltaWei */,
        bytes calldata /* _data */
    )
    external
    view
    onlyDolomiteMargin(msg.sender)
    returns (IDolomiteStructs.AssetAmount memory) {
        _validateInputAndOutputMarketId(_inputMarketId, _outputMarketId);
        if (_isolationModeVaultAccount.owner == _getVaultForInternalTrade()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isolationModeVaultAccount.owner == _getVaultForInternalTrade(),
            _FILE,
            "Invalid taker account"
        );
        if (_metaVaultAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(_isolationModeVaultAccount.owner) && _metaVaultAccount.number == _DEFAULT_ACCOUNT_NUMBER) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _metaVaultAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(_isolationModeVaultAccount.owner)
            && _metaVaultAccount.number == _DEFAULT_ACCOUNT_NUMBER,
            _FILE,
            "Invalid maker account"
        );

        IDolomiteStructs.Par memory deltaPar = _newInputPar.sub(_oldInputPar);
        if (deltaPar.sign && deltaPar.value == _getInputAmountParInternalTrade()) { /* FOR COVERAGE TESTING */ }
        Require.that(
            deltaPar.sign && deltaPar.value == _getInputAmountParInternalTrade(),
            _FILE,
            "Invalid delta par"
        );

        return IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: 0
        });
    }

    function createActionsForWrapping(
        CreateActionsForWrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        _validateInputAndOutputMarketId(_params.inputMarket, _params.outputMarket);

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength());
        uint256 metaVaultAccountId = abi.decode(_params.orderData, (uint256));

        actions[0] = AccountActionLib.encodeCallAction(
            _params.primaryAccountId,
            /* _callee = */ address(this),
            /* _callData = */ abi.encode(
                _params.inputAmount,
                _params.primaryAccountId,
                _params.primaryAccountNumber
            )
        );

        // @dev Encode internal transfer from vault to metavault which sends input token to the metavault
        // and returns 0 POL tokens. getTradeCost is responsible for input validation
        actions[1] = AccountActionLib.encodeInternalTradeActionForWrap(
            _params.primaryAccountId,
            metaVaultAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _chainId = */ block.chainid,
            /* _calculateAmountWithMakerAccount = */ false,
            /* _orderData = */ bytes("")
        );

        // @dev Encode sell action where the user will spend 0 input tokens and receive the original
        // internal transfer amount
        actions[2] = AccountActionLib.encodeExternalSellAction(
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _amountInWei = */ 0,
            /* _amountOutMinWei = */ _params.minOutputAmount,
            _params.orderData
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
        _validateInputAndOutputToken(_inputToken, _outputToken);
        if (_desiredInputAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _desiredInputAmount > 0,
            _FILE,
            "Invalid desired input amount"
        );

        return _desiredInputAmount;
    }

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return IDolomiteERC4626(vaultFactory().UNDERLYING_TOKEN()).asset() == _inputToken;
    }

    function token() public override view returns (address) {
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
        (uint256 transferAmount, /* address vault */, /* uint256 vaultSubAccount */) = abi.decode(
            _data,
            (uint256, address, uint256)
        );
        IIsolationModeVaultFactory factory = vaultFactory();

        if (factory.getAccountByVault(_accountInfo.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            factory.getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        /// @dev This is set by the GenericTraderProxyV2 and is always set to the max value
        /*assert(transferAmount == type(uint256).max);*/
        address assetToken = IDolomiteERC4626(vaultFactory().UNDERLYING_TOKEN()).asset();
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(assetToken);
        // We can safely get the zap account's balance here without worrying about read-only reentrancy
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(_accountInfo, marketId);

        // Account par will always be positive for the zap account
        /*assert(balancePar.sign || balancePar.value == 0);*/

        transferAmount = balancePar.value;

        if (transferAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );
        _setTransientValues(_accountInfo.owner, transferAmount);
    }

    function _approveIsolationModeTokenForTransfer(
        address _vault,
        address _receiver,
        uint256 _amount
    )
    internal
    virtual {
        IIsolationModeVaultFactory factory = vaultFactory();
        factory.enqueueTransferIntoDolomiteMargin(_vault, _amount);

        IERC20(address(factory)).safeApprove(_receiver, _amount);
    }

    function _validateInputAndOutputMarketId(
        uint256 _inputMarketId,
        uint256 _outputMarketId
    )
    internal
    view {
        address inputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_inputMarketId);
        address outputToken = DOLOMITE_MARGIN().getMarketTokenAddress(_outputMarketId);
        _validateInputAndOutputToken(inputToken, outputToken);
    }

    function _validateInputAndOutputToken(
        address _inputToken,
        address _outputToken
    )
    internal
    view {
        if (isValidInputToken(_inputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidInputToken(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(vaultFactory())) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == address(vaultFactory()),
            _FILE,
            "Invalid output token",
            _outputToken
        );
    }
}
