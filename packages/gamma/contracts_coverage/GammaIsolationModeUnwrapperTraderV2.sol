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

import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IDolomiteMarginExchangeWrapper } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginExchangeWrapper.sol"; // solhint-disable-line max-line-length
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDeltaSwapPair } from "./interfaces/IDeltaSwapPair.sol";
import { IGammaIsolationModeVaultFactory } from "./interfaces/IGammaIsolationModeVaultFactory.sol";
import { IGammaPool } from "./interfaces/IGammaPool.sol";
import { IGammaPositionManager } from "./interfaces/IGammaPositionManager.sol";
import { IGammaRegistry } from "./interfaces/IGammaRegistry.sol";


/**
 * @title   GammaIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping gamma lp pool (via burning and then swapping)
 */
contract GammaIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GammaUnwrapperTraderV2";

    // ============ State Variables ============

    IGammaRegistry public immutable GAMMA_REGISTRY; // solhint-disable-line var-name-mixedcase
    IGammaPool public immutable GAMMA_POOL; // solhint-disable-line var-name-mixedcase
    IDeltaSwapPair public immutable DELTA_SWAP_PAIR; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gammaRegistry,
        address _dGammaPool,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dGammaPool,
        _dolomiteMargin,
        address(IGammaRegistry(_gammaRegistry).dolomiteRegistry())
    ) {
        GAMMA_REGISTRY = IGammaRegistry(_gammaRegistry);
        GAMMA_POOL = IGammaPool(IGammaIsolationModeVaultFactory(_dGammaPool).UNDERLYING_TOKEN());
        DELTA_SWAP_PAIR = IDeltaSwapPair(GAMMA_POOL.cfmm());
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == DELTA_SWAP_PAIR.token0() || _outputToken == DELTA_SWAP_PAIR.token1();
    }

    // ============================================
    // =========== Internal Functions =============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address _outputToken,
        uint256 /* _minOutputAmount */,
        address /* _inputToken */,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        (
            uint256[] memory amountsMin,
            address aggregator,
            bytes memory aggregatorData
        ) = abi.decode(_extraOrderData, (uint256[], address, bytes));

        {
            IGammaPositionManager positionManager = GAMMA_REGISTRY.gammaPositionManager();
            IERC20(address(GAMMA_POOL)).safeApprove(address(positionManager), _inputAmount);
            IGammaPositionManager.WithdrawReservesParams memory withdrawReservesParams =
                IGammaPositionManager.WithdrawReservesParams({
                    protocolId: GAMMA_POOL.protocolId(),
                    cfmm: GAMMA_POOL.cfmm(),
                    to: address(this),
                    amount: _inputAmount,
                    deadline: block.timestamp,
                    amountsMin: amountsMin
                });
            positionManager.withdrawReserves(withdrawReservesParams);
        }

        address token0 = DELTA_SWAP_PAIR.token0();
        address swapToken = _outputToken == token0 ? DELTA_SWAP_PAIR.token1() : token0;

        uint256 swapAmount = IERC20(swapToken).balanceOf(address(this));
        IERC20(swapToken).transfer(aggregator, swapAmount);
        IDolomiteMarginExchangeWrapper(aggregator).exchange(
            /* tradeOriginator = */ address(this),
            /* receiver = */ address(this),
            /* outputToken = */ _outputToken,
            /* inputToken = */ swapToken,
            /* inputAmount = */ swapAmount,
            /* minAmountOutAndOrderData = */ aggregatorData
        );
        
        return IERC20(_outputToken).balanceOf(address(this));
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }
}
