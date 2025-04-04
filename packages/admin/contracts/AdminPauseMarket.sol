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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { IDepositWithdrawalRouter } from "@dolomite-exchange/modules-base/contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomitePriceOracle } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   AdminPauseMarket
 * @author  Dolomite
 *
 * @notice  Contract that enables an admin to completely pause a market
 */
contract AdminPauseMarket is Ownable, OnlyDolomiteMargin, IDolomitePriceOracle {
    using SafeERC20 for IERC20;

    bytes32 private constant _FILE = "AdminPauseMarket";
    IDolomitePriceOracle public immutable ORACLE_AGGREGATOR;

    mapping(address => bool) public tokenToPaused;


    constructor(
        address _gnosisSafe,
        address _oracleAggregator,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _transferOwnership(_gnosisSafe);

        ORACLE_AGGREGATOR = IDolomitePriceOracle(_oracleAggregator);
    }

    function pauseMarket(uint256 _marketId) external onlyOwner {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetPriceOracle.selector,
                _marketId,
                address(this)
            )
        );

        tokenToPaused[token] = true;
    }

    function unpauseMarket(uint256 _marketId, address _priceOracle) external onlyOwner {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        Require.that(
            _priceOracle != address(0) && tokenToPaused[token],
            _FILE,
            "Invalid parameters"
        );
        tokenToPaused[token] = false;

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerSetPriceOracle.selector,
                _marketId,
                _priceOracle
            )
        );
    }

    function getPrice(
        address _token
    ) onlyDolomiteMargin(msg.sender) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        if (tokenToPaused[_token]) {
            return IDolomiteStructs.MonetaryPrice({
                value: 0
            });
        }

        return ORACLE_AGGREGATOR.getPrice(_token);
    }
}