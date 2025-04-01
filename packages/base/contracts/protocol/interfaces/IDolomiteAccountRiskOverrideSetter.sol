// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IDolomiteStructs } from "./IDolomiteStructs.sol";

/**
 * @title   IDolomiteAccountRiskOverrideSetter
 * @author  Dolomite
 *
 * @notice  Interface that can be implemented by any contract that needs to implement risk overrides for an account.
 */
interface IDolomiteAccountRiskOverrideSetter {

    // ===================== Events =====================

    event CategorySet(uint256 indexed marketId, Category category);
    event CategoryParamSet(
        Category category,
        IDolomiteStructs.Decimal marginRatioOverride,
        IDolomiteStructs.Decimal liquidationRewardOverride
    );
    event RiskFeatureSet(uint256 indexed marketId, RiskFeature riskFeature, bytes extraData);
    event DefaultAccountCheckActivated();

    // ===================== Enums =====================

    enum Category {
        NONE,
        BERA,
        BTC,
        ETH,
        STABLE
    }

    enum RiskFeature {
        NONE,
        /// @dev The asset cannot be used as collateral in a position and can only be borrowed
        BORROW_ONLY,
        /// @dev The asset cannot have other collateral assets held in the position and can only borrow specific debt
        SINGLE_COLLATERAL_WITH_STRICT_DEBT
    }

    // ===================== Structs =====================

    struct CategoryStruct {
        Category category;
        IDolomiteStructs.Decimal marginRatioOverride;
        IDolomiteStructs.Decimal liquidationRewardOverride;
    }

    struct RiskFeatureStruct {
        RiskFeature riskFeature;
        bytes extraData;
    }

    struct SingleCollateralRiskStruct {
        uint256[] debtMarketIds;
        IDolomiteStructs.Decimal marginRatioOverride;
        IDolomiteStructs.Decimal liquidationRewardOverride;
    }

    // ===================== Functions =====================

    function ownerSetCategoriesByMarketIds(
        uint256[] memory _marketIds,
        Category[] memory _categories
    ) external;

    function ownerSetCategoryByMarketId(
        uint256 _marketId,
        Category _category
    ) external;

    function ownerSetCategoryParam(
        Category _category,
        IDolomiteStructs.Decimal calldata _marginRatioOverride,
        IDolomiteStructs.Decimal calldata _liquidationRewardOverride
    ) external;

    function ownerSetRiskFeatureByMarketId(
        uint256 _marketId,
        RiskFeature _riskFeature,
        bytes calldata _extraData
    ) external;

    /**
     * @notice  Gets the risk overrides for a given account owner. In the context of an operation, this function is
     *          called within `_verifyFinalState`, after all of the operation's actions have occurred. Thus, it is safe
     *          to read the account's state from Dolomite Margin's storage.
     *
     * @param  _account                     The account whose risk override should be retrieved.
     * @return _marginRatioOverride         The margin ratio override for this account.
     * @return _liquidationRewardOverride   The liquidation spread override for this account.
     */
    function getAccountRiskOverride(
        IDolomiteStructs.AccountInfo calldata _account
    )
    external
    view
    returns
    (
        IDolomiteStructs.Decimal memory _marginRatioOverride,
        IDolomiteStructs.Decimal memory _liquidationRewardOverride
    );

    function getCategoryMaskByMarketIds(uint256[] memory _marketIds) external view returns (uint256);

    function getCategoryByMarketId(uint256 _marketId) external view returns (Category);

    function getCategoryParamByCategory(Category _category) external view returns (CategoryStruct memory);

    function getCategoryParamByMarketId(uint256 _marketId) external view returns (CategoryStruct memory);

    function getRiskFeatureByMarketId(uint256 _marketId) external view returns (RiskFeature);

    function getRiskFeatureParamByMarketId(uint256 _marketId) external view returns (RiskFeatureStruct memory);

    function getRiskFeatureForSingleCollateralByMarketId(
        uint256 _marketId
    ) external view returns (SingleCollateralRiskStruct[] memory params);
}
