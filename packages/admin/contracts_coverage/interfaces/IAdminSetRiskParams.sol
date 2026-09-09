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

import { IDolomiteAccountRiskOverrideSetter } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteAccountRiskOverrideSetter.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";


/**
 * @title   IAdminSetRiskParams
 * @author  Dolomite
 *
 * @notice  Interface for the AdminSetRiskParams contract
 */
interface IAdminSetRiskParams {

    event DolomiteAccountRiskOverrideSet(address dolomiteAccountRiskOverride);

    // ========================================================
    // ==================== Public Functions ==================
    // ========================================================

    function ownerSetDolomiteAccountRiskOverride(address _dolomiteAccountRiskOverride) external;

    function setMarketMaxSupplyWei(uint256 _marketId, uint256 _maxSupplyWei) external;

    function setMarketMaxSupplyWeis(uint256[] calldata _marketIds, uint256[] calldata _maxSupplyWeis) external;

    function setMarketMaxBorrowWei(uint256 _marketId, uint256 _maxBorrowWei) external;

    function setMarketMaxBorrowWeis(uint256[] calldata _marketIds, uint256[] calldata _maxBorrowWeis) external;

    function setMarketMarginPremium(
        uint256 _marketId,
        IDolomiteStructs.Decimal calldata _marginPremium
    ) external;

    function setMarketMarginPremiums(
        uint256[] calldata _marketIds,
        IDolomiteStructs.Decimal[] calldata _marginPremiums
    ) external;

    function setMarketLiquidationPremium(
        uint256 _marketId,
        IDolomiteStructs.Decimal calldata _liquidationSpreadPremium
    ) external;

    function setMarketLiquidationPremiums(
        uint256[] calldata _marketIds,
        IDolomiteStructs.Decimal[] calldata _liquidationSpreadPremiums
    ) external;

    function setCategoriesByMarketIds(
        uint256[] memory _marketIds,
        IDolomiteAccountRiskOverrideSetter.Category[] memory _categories
    ) external;

    function setCategoryByMarketId(
        uint256 _marketId,
        IDolomiteAccountRiskOverrideSetter.Category _category
    ) external;

    function setCategoryParam(
        IDolomiteAccountRiskOverrideSetter.Category _category,
        IDolomiteStructs.Decimal calldata _marginRatioOverride,
        IDolomiteStructs.Decimal calldata _liquidationRewardOverride
    ) external;

    function setRiskFeatureByMarketId(
        uint256 _marketId,
        IDolomiteAccountRiskOverrideSetter.RiskFeature _riskFeature,
        bytes calldata _extraData
    ) external;
}
