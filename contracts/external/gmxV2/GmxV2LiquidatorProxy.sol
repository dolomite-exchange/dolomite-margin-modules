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
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { ILiquidatorProxyV4WithGenericTrader } from "../interfaces/ILiquidatorProxyV4WithGenericTrader.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";


/**
 * @title   GmxV2LiquidatorProxy
 * @author  Dolomite
 *
 * @notice  Liquidator for handling the GMX V2 (GM) tokens.
 */
contract GmxV2LiquidatorProxy {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "GmxV2LiquidatorProxy";

    // ============================ Public State Variables ============================

    IGmxRegistryV2 public immutable GMX_REGISTRY_V2; // solhint-disable-line var-name-mixedcase
    ILiquidatorProxyV4WithGenericTrader public immutable LIQUIDATOR_PROXY_V4; // solhint-disable-line var-name-mixedcase
    IDolomiteMargin public immutable DOLOMITE_MARGIN; // solhint-disable-line var-name-mixedcase

    // ============================ Modifiers ============================

    modifier onlyUnwrapper(address _sender) {
        Require.that(
            _sender == GMX_REGISTRY_V2.gmxV2UnwrapperTrader(),
            _FILE,
            "Only unwrapper can call",
            _sender
        );
        _;
    }

    // ============================ Constructor ============================

    constructor(
        address _gmxRegistryV2,
        address _liquidatorProxyV4,
        address _dolomiteMargin
    ) {
        GMX_REGISTRY_V2 = IGmxRegistryV2(_gmxRegistryV2);
        LIQUIDATOR_PROXY_V4 = ILiquidatorProxyV4WithGenericTrader(_liquidatorProxyV4);
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function prepareForLiquidation(
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        address _token,
        uint256 _amount
    ) external onlyUnwrapper(msg.sender) {

    }

    function liquidate(
        IDolomiteStructs.AccountInfo calldata _solidAccount,
        IDolomiteStructs.AccountInfo calldata _liquidAccount,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderBase.TraderParam[] calldata _tradersPath,
        IDolomiteStructs.AccountInfo[] calldata _makerAccounts,
        uint256 _expiry
    ) external {
        address inputToken = DOLOMITE_MARGIN.getMarketTokenAddress(_marketIdsPath[0]);

        LIQUIDATOR_PROXY_V4.liquidate(
            _solidAccount,
            _liquidAccount,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath,
            _makerAccounts,
            _expiry
        );
    }
}
