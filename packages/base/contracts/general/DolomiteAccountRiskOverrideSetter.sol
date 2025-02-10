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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteAccountRiskOverrideSetter } from "../protocol/interfaces/IDolomiteAccountRiskOverrideSetter.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginV2 } from "../protocol/interfaces/IDolomiteMarginV2.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   DolomiteAccountRiskOverrideSetter
 * @author  Dolomite
 *
 * @notice  Default implementation of the risk override setter for enabling automatic e-mode
 */
contract DolomiteAccountRiskOverrideSetter is
    IDolomiteAccountRiskOverrideSetter,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{

    // ===================== Constants =====================

    bytes32 private constant _FILE = "AccountRiskOverrideSetter";
    bytes32 private constant _MARKET_TO_CATEGORY_MAP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.marketToCategoryMap")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _CATEGORY_TO_CATEGORY_PARAM_MAP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.categoryToCategoryParamMap")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _MARKET_TO_RISK_FEATURE_MAP_SLOT = bytes32(uint256(keccak256("eip1967.proxy.marketToRiskFeatureMap")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _DOLOMITE_BALANCE_CUTOFF_ACCOUNT_NUMBER = 100;

    uint256 private constant _MASK_CATEGORY_BERA = 0x000F;
    uint256 private constant _MASK_CATEGORY_BTC = 0x00F0;
    uint256 private constant _MASK_CATEGORY_ETH = 0x0F00;
    uint256 private constant _MASK_CATEGORY_STABLE = 0xF000;

    // ===================== External Functions =====================

    function ownerSetCategoryByMarketId(
        uint256 _marketId,
        Category _category
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _setUint256InMap(_MARKET_TO_CATEGORY_MAP_SLOT, address(uint160(_marketId)), uint256(_category));
        emit CategorySet(_marketId, _category);
    }

    function ownerSetCategoryParam(
        Category _category,
        IDolomiteStructs.Decimal calldata _marginRatioOverride,
        IDolomiteStructs.Decimal calldata _liquidationRewardOverride
    ) external onlyDolomiteMarginOwner(msg.sender) {
        CategoryParam storage categoryParam = _getCategoryParamByCategory(_category);
        categoryParam.category = _category;
        categoryParam.marginRatioOverride = _marginRatioOverride;
        categoryParam.liquidationRewardOverride = _liquidationRewardOverride;

        emit CategoryParamSet(_category, _marginRatioOverride, _liquidationRewardOverride);
    }

    function ownerSetRiskFeatureByMarketId(
        uint256 _marketId,
        RiskFeature _riskFeature,
        bytes calldata _extraData
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_riskFeature == RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT) {
            (SingleCollateralWithStrictDebtRiskParam[] memory params) =
                                abi.decode(_extraData, (SingleCollateralWithStrictDebtRiskParam[]));
            Require.that(
                params.length != 0,
                _FILE,
                "Invalid risk params"
            );
            for (uint256 i; i < params.length; ++i) {
                SingleCollateralWithStrictDebtRiskParam memory singleCollateralRiskParam = params[i];
                Require.that(
                    singleCollateralRiskParam.debtMarketIds.length != 0,
                    _FILE,
                    "Invalid debt market IDs"
                );
                Require.that(
                    singleCollateralRiskParam.marginRatioOverride.value != 0,
                    _FILE,
                    "Invalid margin ratio"
                );
                Require.that(
                    singleCollateralRiskParam.liquidationRewardOverride.value != 0,
                    _FILE,
                    "Invalid liquidation reward"
                );

                IDolomiteMarginV2 dolomiteMarginV2 = IDolomiteMarginV2(address(DOLOMITE_MARGIN()));
                IDolomiteStructs.RiskLimitsV2 memory riskLimits = dolomiteMarginV2.getRiskLimits();
                Require.that(
                    singleCollateralRiskParam.marginRatioOverride.value <= riskLimits.marginRatioMax,
                    _FILE,
                    "Margin ratio too high"
                );
                Require.that(
                    singleCollateralRiskParam.liquidationRewardOverride.value <= riskLimits.liquidationSpreadMax,
                    _FILE,
                    "Liquidation reward too high"
                );
            }
            _validateNoDebtMarketIdOverlap(params);
        } else {
            assert(_riskFeature == RiskFeature.NONE || _riskFeature == RiskFeature.BORROW_ONLY);
            Require.that(
                _extraData.length == 0,
                _FILE,
                "Invalid data for risk feature",
                uint256(_riskFeature)
            );
        }

        RiskFeatureParam storage riskParam;
        bytes32 slot = _getMarketToRiskFeatureSlot(_marketId);
        assembly {
            riskParam.slot := slot
        }
        riskParam.riskFeature = _riskFeature;
        riskParam.extraData = _extraData;

        emit RiskFeatureSet(_marketId, _riskFeature, _extraData);
    }

    function getAccountRiskOverride(
        IDolomiteStructs.AccountInfo calldata _account
    )
    external
    view
    returns
    (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        uint256[] memory marketIds = dolomiteMargin.getAccountMarketsWithBalances(_account);
        uint256 marketIdsLength = marketIds.length;

        // Since this function is always called at the end of an operate call when a user has debt, these two invariants
        // will always hold.
        assert(marketIdsLength != 0);
        assert(dolomiteMargin.getAccountNumberOfMarketsWithDebt(_account) != 0);

        Require.that(
            _account.number >= _DOLOMITE_BALANCE_CUTOFF_ACCOUNT_NUMBER,
            _FILE,
            "Invalid account for debt",
            _account.owner,
            _account.number
        );

        {
            (
                IDolomiteStructs.Decimal memory marginRatioOverride,
                IDolomiteStructs.Decimal memory liquidationRewardOverride
            ) = _validateRiskFeatures(dolomiteMargin, _account, marketIds, marketIdsLength);
            if (marginRatioOverride.value != 0) {
                return (marginRatioOverride, liquidationRewardOverride);
            }
        }

        uint256 exclusiveCategoryMask = _getCategoryMaskByMarketIds(marketIds, marketIdsLength);
        if (exclusiveCategoryMask == 0) {
            return _getDefaultValuesForOverride();
        } else if (exclusiveCategoryMask == _MASK_CATEGORY_BERA) {
            return _getValuesForOverride(Category.BERA);
        } else if (exclusiveCategoryMask == _MASK_CATEGORY_BTC) {
            return _getValuesForOverride(Category.BTC);
        } else if (exclusiveCategoryMask == _MASK_CATEGORY_ETH) {
            return _getValuesForOverride(Category.ETH);
        } else {
            assert(exclusiveCategoryMask == _MASK_CATEGORY_STABLE);
            return _getValuesForOverride(Category.STABLE);
        }
    }

    // ===================== Public Functions =====================

    function getCategoryMaskByMarketIds(
        uint256[] memory _marketIds
    ) public view returns (uint256) {
        Require.that(
            _marketIds.length != 0,
            _FILE,
            "Invalid market IDs length"
        );

        return _getCategoryMaskByMarketIds(_marketIds, _marketIds.length);
    }

    function getCategoryByMarketId(uint256 _marketId) public view returns (Category) {
        return Category(_getUint256FromMap(_MARKET_TO_CATEGORY_MAP_SLOT, address(uint160(_marketId))));
    }

    function getRiskFeatureByMarketId(uint256 _marketId) public view returns (RiskFeature) {
        RiskFeatureParam storage param;
        bytes32 slot = _getMarketToRiskFeatureSlot(_marketId);
        assembly {
            param.slot := slot
        }
        return param.riskFeature;
    }

    function getRiskFeatureForSingleCollateralByMarketId(
        uint256 _marketId
    ) public view returns (SingleCollateralWithStrictDebtRiskParam[] memory params) {
        RiskFeatureParam storage riskParam = _getRiskFeatureParamByMarketId(_marketId);
        Require.that(
            riskParam.riskFeature == RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
            _FILE,
            "Invalid risk feature",
            uint256(riskParam.riskFeature)
        );

        (params) = abi.decode(riskParam.extraData, (SingleCollateralWithStrictDebtRiskParam[]));
    }

    function getCategoryParamByCategory(Category _category) public pure returns (CategoryParam memory) {
        CategoryParam storage categoryParam;
        bytes32 slot = keccak256(abi.encode(_CATEGORY_TO_CATEGORY_PARAM_MAP_SLOT, _category));
        assembly {
            categoryParam.slot := slot
        }

        return categoryParam;
    }

    // ===================== Internal Functions =====================

    function _validateRiskFeatures(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        uint256 _marketIdsLength
    ) internal view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        for (uint256 i; i < _marketIdsLength; ++i) {
            uint256 marketId = _marketIds[i];

            RiskFeatureParam storage riskParam = _getRiskFeatureParamByMarketId(marketId);
            RiskFeature riskFeature = riskParam.riskFeature;
            if (riskFeature == RiskFeature.BORROW_ONLY) {
                // Ensure the user is not using it as collateral
                _validateBorrowOnly(_dolomiteMargin, _account, marketId);
            } else if (riskFeature == RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT) {
                _validateCollateralOnly(_dolomiteMargin, _account, marketId);

                (SingleCollateralWithStrictDebtRiskParam[] memory singleCollateralParams) =
                                    abi.decode(riskParam.extraData, (SingleCollateralWithStrictDebtRiskParam[]));

                // We can return here because we guaranteed there is only one collateral asset. Thus, no other
                // `BORROW_ONLY` market could be a collateral asset at this point
                return _getRiskOverridesForSingleCollateralRiskParamsByMarketId(
                    singleCollateralParams,
                    _marketIds,
                    _marketIdsLength
                );
            } else {
                assert(riskFeature == RiskFeature.NONE);
            }
        }

        return _getDefaultValuesForOverride();
    }

    function _validateBorrowOnly(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _account,
        uint256 _marketId
    ) internal view {
        Require.that(
            !_dolomiteMargin.getAccountPar(_account, _marketId).sign,
            _FILE,
            "Market is borrow only",
            _marketId
        );
    }

    function _validateCollateralOnly(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _account,
        uint256 _marketId
    ) internal view {
        Require.that(
            _dolomiteMargin.getAccountPar(_account, _marketId).sign,
            _FILE,
            "Market is collateral only",
            _marketId
        );
    }

    function _getCategoryMaskByMarketIds(
        uint256[] memory _marketIds,
        uint256 _marketIdsLength
    ) internal view returns (uint256) {
        uint256 exclusiveCategory = _MASK_CATEGORY_BERA
            | _MASK_CATEGORY_BTC
            | _MASK_CATEGORY_ETH
            | _MASK_CATEGORY_STABLE;

        for (uint256 i; i < _marketIdsLength; ++i) {
            uint256 marketId = _marketIds[i];
            Category category = getCategoryByMarketId(marketId);
            if (category == Category.NONE) {
                exclusiveCategory = 0;
                break;
            } else if (category == Category.BERA) {
                exclusiveCategory &= _MASK_CATEGORY_BERA;
            } else if (category == Category.BTC) {
                exclusiveCategory &= _MASK_CATEGORY_BTC;
            } else if (category == Category.ETH) {
                exclusiveCategory &= _MASK_CATEGORY_ETH;
            } else {
                assert(category == Category.STABLE);
                exclusiveCategory &= _MASK_CATEGORY_STABLE;
            }
        }

        return exclusiveCategory;
    }

    function _getRiskOverridesForSingleCollateralRiskParamsByMarketId(
        SingleCollateralWithStrictDebtRiskParam[] memory _params,
        uint256[] memory _marketIds,
        uint256 _marketIdsLength
    ) internal pure returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        for (uint256 i; i < _params.length; ++i) {
            SingleCollateralWithStrictDebtRiskParam memory riskParam = _params[i];
            for (uint256 j; j < _marketIdsLength; ++j) {
                if (_binarySearch(_marketIds[j], riskParam.debtMarketIds) != type(uint256).max) {
                    // We got a match for this risk param
                    return (riskParam.marginRatioOverride, riskParam.liquidationRewardOverride);
                }
            }
        }

        revert("AccountRiskOverrideSetter: Could not find risk param");
    }

    function _getCategoryParamByCategory(Category _category) internal pure returns (CategoryParam storage) {
        bytes32 slot = keccak256(abi.encode(_MARKET_TO_CATEGORY_MAP_SLOT, _category));
        CategoryParam storage categoryParam;
        assembly {
            categoryParam.slot := slot
        }
        return categoryParam;
    }

    function _getRiskFeatureParamByMarketId(uint256 _marketId) internal pure returns (RiskFeatureParam storage) {
        RiskFeatureParam storage param;
        bytes32 slot = _getMarketToRiskFeatureSlot(_marketId);
        assembly {
            param.slot := slot
        }
        return param;
    }

    function _getMarketToRiskFeatureSlot(uint256 _marketId) internal pure returns (bytes32) {
        return keccak256(abi.encode(_MARKET_TO_RISK_FEATURE_MAP_SLOT, _marketId));
    }

    function _validateNoDebtMarketIdOverlap(SingleCollateralWithStrictDebtRiskParam[] memory _params) internal pure {
        for (uint256 i; i < _params.length; ++i) {
            SingleCollateralWithStrictDebtRiskParam memory riskParam = _params[i];
            for (uint256 j = 1; j < riskParam.debtMarketIds.length; ++j) {
                Require.that(
                    riskParam.debtMarketIds[j - 1] < riskParam.debtMarketIds[j],
                    _FILE,
                    "Markets must be in asc order"
                );
            }
        }

        for (uint256 i; i < _params.length; ++i) {
            SingleCollateralWithStrictDebtRiskParam memory param1 = _params[i];
            for (uint256 j = i + 1; j < _params.length; ++j) {
                SingleCollateralWithStrictDebtRiskParam memory param2 = _params[j];

                for (uint256 k; k < param1.debtMarketIds.length; ++k) {
                    uint256 marketId = param1.debtMarketIds[k];
                    Require.that(
                        _binarySearch(marketId, param2.debtMarketIds) == type(uint256).max,
                        _FILE,
                        "Found duplicate debt market ID"
                    );
                }
            }
        }
    }

    function _binarySearch(uint256 _find, uint256[] memory _marketIds) internal pure returns (uint256) {
        uint256 left = 0;
        uint256 right = _marketIds.length - 1;

        while (left <= right) {
            uint256 mid = left + (right - left) / 2;

            if (_marketIds[mid] == _find) {
                return mid;
            }

            if (_marketIds[mid] < _find) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        // Target is not present in the array
        return type(uint256).max;
    }

    function _getDefaultValuesForOverride() internal pure returns (
        IDolomiteStructs.Decimal memory,
        IDolomiteStructs.Decimal memory
    ) {
        return (IDolomiteStructs.Decimal({ value: 0 }), IDolomiteStructs.Decimal({ value: 0 }));
    }

    function _getValuesForOverride(Category _category) internal view returns (
        IDolomiteStructs.Decimal memory,
        IDolomiteStructs.Decimal memory
    ) {
        CategoryParam storage categoryParam = _getCategoryParamByCategory(_category);
        return (categoryParam.marginRatioOverride, categoryParam.liquidationRewardOverride);
    }
}
