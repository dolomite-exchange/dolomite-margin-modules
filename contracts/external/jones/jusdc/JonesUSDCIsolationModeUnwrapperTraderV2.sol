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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { JonesUSDCMathLib } from "./JonesUSDCMathLib.sol";
import { IDolomiteStructs } from "../../../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../protocol/lib/Require.sol";
import { ILiquidatorAssetRegistry } from "../../interfaces/ILiquidatorAssetRegistry.sol";
import { IJonesUSDCRegistry } from "../../interfaces/jones/IJonesUSDCRegistry.sol";
import { IsolationModeUnwrapperTraderV2 } from "../../proxies/abstract/IsolationModeUnwrapperTraderV2.sol";


/**
 * @title   JonesUSDCIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping jUSDC into USDC. During settlement, the redeemed jUSDC is sent from the user's vault to
 *          this contract to process the unwrapping.
 */
contract JonesUSDCIsolationModeUnwrapperTraderV2 is IsolationModeUnwrapperTraderV2 {
    using JonesUSDCMathLib for IJonesUSDCRegistry;

    // ============ Constants ============

    bytes32 private constant _FILE = "JonesUSDCUnwrapperV2";

    // ============ Immutable State Variables ============

    ILiquidatorAssetRegistry public immutable LIQUIDATOR_ASSET_REGISTRY; // solhint-disable-line var-name-mixedcase
    IERC20 public immutable USDC; // solhint-disable-line var-name-mixedcase
    IJonesUSDCRegistry public immutable JONES_USDC_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _liquidatorAssetRegistry,
        address _usdc,
        address _jonesUSDCRegistry,
        address _djUSDC,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _djUSDC,
        _dolomiteMargin
    ) {
        LIQUIDATOR_ASSET_REGISTRY = ILiquidatorAssetRegistry(_liquidatorAssetRegistry);
        USDC = IERC20(_usdc);
        JONES_USDC_REGISTRY = IJonesUSDCRegistry(_jonesUSDCRegistry);
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(USDC);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================


    function _callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    internal
    override {
        uint256 marketId = VAULT_FACTORY.marketId();
        Require.that(
            LIQUIDATOR_ASSET_REGISTRY.isAssetWhitelistedForLiquidation(marketId, _sender)
                && LIQUIDATOR_ASSET_REGISTRY.getLiquidatorsForAsset(marketId).length > 0,
            _FILE,
            "Sender must be a liquidator",
            _sender
        );
        super._callFunction(_sender, _accountInfo, _data);
    }

    function _exchangeUnderlyingTokenToOutputToken(
        address,
        address,
        address,
        uint256,
        address,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        return JONES_USDC_REGISTRY.glpVaultRouter().stableWithdrawalSignal(_inputAmount, /* _compound = */ true);
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
        (uint256 retentionFee, uint256 retentionFeeBase) = JONES_USDC_REGISTRY.getRetentionFee();
        uint256 receiptTokenAmount = JONES_USDC_REGISTRY.jUSDC().previewRedeem(_desiredInputAmount);
        uint256 usdcAmount = JONES_USDC_REGISTRY.usdcReceiptToken().previewRedeem(receiptTokenAmount);
        return usdcAmount - (usdcAmount * retentionFee / retentionFeeBase);
    }
}
