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
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


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

    uint256 internal constant _ACTIONS_LENGTH = 2;

    IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY;

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(
        address _berachainRewardsRegistry,
        address _dolomiteMargin
    ) POLIsolationModeTraderBaseV2(
        _dolomiteMargin,
        address(IBerachainRewardsRegistry(_berachainRewardsRegistry).dolomiteRegistry())
    ) {
        BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

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

        _validateInputAndOutputToken(_inputToken, _outputToken);
        if (factory.getAccountByVault(_tradeOriginator) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            factory.getAccountByVault(_tradeOriginator) != address(0),
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

        uint256 outputAmount = _getUint256FromMap(_INPUT_AMOUNT_PAR_SLOT, _tradeOriginator);
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, _tradeOriginator, 0);
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

    // @audit Ensure that I can't maliciously invoke this function
    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo calldata makerAccount,
        IDolomiteStructs.AccountInfo calldata takerAccount,
        IDolomiteStructs.Par calldata oldInputPar,
        IDolomiteStructs.Par calldata newInputPar,
        IDolomiteStructs.Wei calldata inputDeltaWei,
        bytes calldata data
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (IDolomiteStructs.AssetAmount memory) {
        _validateInputAndOutputMarketId(inputMarketId, outputMarketId);
        if (vaultFactory().getAccountByVault(takerAccount.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            vaultFactory().getAccountByVault(takerAccount.owner) != address(0),
            _FILE,
            "Invalid taker account"
        );
        if (makerAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(takerAccount.owner) && makerAccount.number == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            makerAccount.owner == BERACHAIN_REWARDS_REGISTRY.getMetaVaultByVault(takerAccount.owner)
                && makerAccount.number == 0,
            _FILE,
            "Invalid maker account"
        );

        IDolomiteStructs.Par memory deltaPar = newInputPar.sub(oldInputPar);
        if (deltaPar.sign && deltaPar.value > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            deltaPar.sign && deltaPar.value > 0,
            _FILE,
            "Invalid delta par"
        );
        // @audit Have to make sure a user can't maliciously set this
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, takerAccount.owner, deltaPar.value);

        return IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: 0
        });
    }

    // ==================================================================
    // ========================== View Functions ========================
    // ==================================================================

    function createActionsForWrapping(
        CreateActionsForWrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        _validateInputAndOutputMarketId(_params.inputMarket, _params.outputMarket);

        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](actionsLength());
        uint256 makerAccountId = abi.decode(_params.orderData, (uint256));

        // @dev Encode internal transfer from vault to metavault which sends input token to the metavault
        // and returns 0 POL tokens. getTradeCost is responsible for input validation
        actions[0] = AccountActionLib.encodeInternalTradeActionForWrap(
            _params.primaryAccountId,
            makerAccountId,
            _params.inputMarket,
            _params.outputMarket,
            /* _trader = */ address(this),
            /* _amountInPar = */ _params.inputAmount,
            /* _chainId = */ block.chainid,
            /* _calculateAmountWithMakerAccount = */ false,
            ''
        );

        // @dev Encode sell action where the user will spend 0 input tokens and receive the original
        // internal transfer amount
        actions[1] = AccountActionLib.encodeExternalSellAction(
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
