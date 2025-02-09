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
                SingleCollateralWithStrictDebtRiskParam memory param = params[i];
                Require.that(
                    param.debtMarketIds.length != 0,
                    _FILE,
                    "Invalid debt market IDs"
                );
                Require.that(
                    param.marginRatioOverride.value != 0,
                    _FILE,
                    "Invalid margin ratio"
                );
                Require.that(
                    param.liquidationSpreadOverride.value != 0,
                    _FILE,
                    "Invalid liquidation reward ratio"
                );
            }
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
            return _getValuesForOverride(
                /* _marginRatio */ 0.1 ether,
                /* _liquidationReward */ 0.03 ether
            );
        } else if (exclusiveCategoryMask == _MASK_CATEGORY_BTC) {
            return _getValuesForOverride(
                /* _marginRatio */ 0.1 ether,
                /* _liquidationReward */ 0.03 ether
            );
        } else if (exclusiveCategoryMask == _MASK_CATEGORY_ETH) {
            return _getValuesForOverride(
                /* _marginRatio */ 0.1 ether,
                /* _liquidationReward */ 0.03 ether
            );
        } else {
            assert(exclusiveCategoryMask == _MASK_CATEGORY_STABLE);

            return _getValuesForOverride(
                /* _marginRatio */ 0.1 ether,
                /* _liquidationReward */ 0.03 ether
            );
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

    function getRiskFeatureForSingleCollateral(
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

    // ===================== Internal Functions =====================

    function _validateRiskFeatures(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _account,
        uint256[] memory _marketIds,
        uint256 _marketIdsLength
    ) internal view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        for (uint256 i; i < _marketIdsLength; ++i) {
            uint256 marketId = _marketIds[i];

            RiskFeatureParam storage param = _getRiskFeatureParamByMarketId(marketId);
            RiskFeature riskFeature = param.riskFeature;
            if (riskFeature == RiskFeature.BORROW_ONLY) {
                // Ensure the user is not using it as collateral
                _validateBorrowOnly(_dolomiteMargin, _account, marketId);
            } else if (riskFeature == RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT) {
                (SingleCollateralWithStrictDebtRiskParam[] memory singleCollateralParams) =
                                    abi.decode(param.extraData, (SingleCollateralWithStrictDebtRiskParam[]));
                _validateSingleCollateralWithStrictDebt(
                    _dolomiteMargin,
                    _account,
                    singleCollateralParams,
                    marketId, _marketIds,
                    _marketIdsLength
                );
                // We can break here because we guaranteed there is only one collateral asset. Thus, no other
                // `BORROW_ONLY` market could be a collateral asset at this point
                break;
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

    function _validateSingleCollateralWithStrictDebt(
        IDolomiteMargin _dolomiteMargin,
        IDolomiteStructs.AccountInfo memory _account,
        SingleCollateralWithStrictDebtRiskParam[] memory _params,
        uint256 _singleCollateralMarketId,
        uint256[] memory _marketIds,
        uint256 _marketIdsLength
    ) internal view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        // TODO
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

    function _getDefaultValuesForOverride() internal pure returns (
        IDolomiteStructs.Decimal memory,
        IDolomiteStructs.Decimal memory
    ) {
        return (IDolomiteStructs.Decimal({ value: 0 }), IDolomiteStructs.Decimal({ value: 0 }));
    }

    function _getValuesForOverride(uint256 _marginRatio, uint256 _liquidationReward) internal pure returns (
        IDolomiteStructs.Decimal memory,
        IDolomiteStructs.Decimal memory
    ) {
        return (
            IDolomiteStructs.Decimal({ value: _marginRatio }),
            IDolomiteStructs.Decimal({ value: _liquidationReward })
        );
    }
}
