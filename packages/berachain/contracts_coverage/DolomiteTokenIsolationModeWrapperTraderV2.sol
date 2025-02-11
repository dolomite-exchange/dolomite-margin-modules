// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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

import { IsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeWrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteERC4626.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMarginInternalTrader } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginInternalTrader.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { ProxyContractHelpers } from "@dolomite-exchange/modules-base/contracts/helpers/ProxyContractHelpers.sol";
import { IBerachainRewardsRegistry } from "./interfaces/IBerachainRewardsRegistry.sol";


/**
 * @title   DolomiteTokenIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping normal markets into iso mode dolomite tokens. Upon settlement, the dToken
 *          is sent to the user's vault and the factory token is minted to `DolomiteMargin`.
 */
contract DolomiteTokenIsolationModeWrapperTraderV2 is ProxyContractHelpers, IsolationModeWrapperTraderV2, IDolomiteMarginInternalTrader {
    using SafeERC20 for IERC20;
    using TypesLib for IDolomiteStructs.Par;

    // ============ Constants ============

    // @todo See if we can add a fee on the unwrapper
    // @todo For tests, up the interest rate a lot so par and wei have a bigger difference
    // @todo Adjust so we can use one for all POL dToken markets
    // @todo make upgradeable
    bytes32 private constant _FILE = "DTokenIsolationModeWrapperV2";
    bytes32 private constant _INPUT_AMOUNT_PAR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputAmountPar")) - 1);

    IBerachainRewardsRegistry public immutable BERACHAIN_REWARDS_REGISTRY;

    // ============ Constructor ============

    constructor(
        address _berachainRewardsRegistry,
        address _dTokenFactory,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeWrapperTraderV2(
        _dTokenFactory,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        BERACHAIN_REWARDS_REGISTRY = IBerachainRewardsRegistry(_berachainRewardsRegistry);
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
        if (VAULT_FACTORY.getAccountByVault(_tradeOriginator) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            VAULT_FACTORY.getAccountByVault(_tradeOriginator) != address(0),
            _FILE,
            "Invalid trade originator",
            _tradeOriginator
        );
        if (isValidInputToken(_inputToken)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidInputToken(_inputToken),
            _FILE,
            "Invalid input token",
            _inputToken
        );
        if (_outputToken == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _outputToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid output token",
            _outputToken
        );
        if (_inputAmount == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputAmount == 0,
            _FILE,
            "Invalid input amount"
        );

        (uint256 minOutputAmount, bytes memory _extraOrderData) = abi.decode(_orderData, (uint256, bytes));

        uint256 outputAmount = _exchangeIntoUnderlyingToken(
            _tradeOriginator,
            _receiver,
            VAULT_FACTORY.UNDERLYING_TOKEN(),
            minOutputAmount,
            _inputToken,
            _inputAmount,
            _extraOrderData
        );
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

    // @audit Add checks that I can't maliciously invoke this function
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
        // @todo probably add some market id checks too
        if (VAULT_FACTORY.getAccountByVault(takerAccount.owner) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            VAULT_FACTORY.getAccountByVault(takerAccount.owner) != address(0),
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

    // ============ External Functions ============

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return IDolomiteERC4626(VAULT_FACTORY.UNDERLYING_TOKEN()).asset() == _inputToken;
    }

    function createActionsForWrapping(
        CreateActionsForWrappingParams calldata _params
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        if (isValidInputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_params.inputMarket))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidInputToken(DOLOMITE_MARGIN().getMarketTokenAddress(_params.inputMarket)),
            _FILE,
            "Invalid input market",
            _params.inputMarket
        );
        if (DOLOMITE_MARGIN().getMarketTokenAddress(_params.outputMarket) == address(VAULT_FACTORY)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            DOLOMITE_MARGIN().getMarketTokenAddress(_params.outputMarket) == address(VAULT_FACTORY),
            _FILE,
            "Invalid output market",
            _params.outputMarket
        );

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

    function actionsLength() public override pure returns (uint256) {
        return _ACTIONS_LENGTH + 1;
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address,
        address,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        uint256 outputAmount = _getUint256FromMap(_INPUT_AMOUNT_PAR_SLOT, _tradeOriginator);
        _setUint256InMap(_INPUT_AMOUNT_PAR_SLOT, _tradeOriginator, 0);
        return outputAmount;
    }

    function _getExchangeCost(
        address,
        address,
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
