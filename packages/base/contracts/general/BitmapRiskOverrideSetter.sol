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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IBitmapRiskOverrideSetter } from "../interfaces/IBitmapRiskOverrideSetter.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { BitLib } from "../lib/BitLib.sol";


/**
 * @title   BitmapRiskOverrideSetter
 * @author  Dolomite
 *
 * @notice  Bitmap implementation of the risk override setter for enabling automatic e-mode
 */
contract BitmapRiskOverrideSetter is
    IBitmapRiskOverrideSetter,
    OnlyDolomiteMargin,
    Initializable
{
    struct Storage {
        uint256 borrowOnlyBitmap;

        mapping(Category => CategoryStruct) categories;
        Category[] activeCategories;

        mapping(uint256 => SingleCollateralStrictDebtStruct) singleCollateralStrictDebt;
        uint256 singleCollateralStrictDebtMarketIds;

        mapping(uint256 => uint256) debtMarketIdToStrictCollateralBitmap;
        uint256 debtWithStrictCollateralMarketIds;

        // IMPORTANT - ONLY ADD TO THE BOTTOM OF THE STRUCT TO PREVENT STORAGE COLLISIONS
    }

    // ===========================================================
    // ======================= Constants =========================
    // ===========================================================

    bytes32 private constant _FILE = "BitmapRiskOverrideSetter";
    bytes32 private constant _STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.storage")) - 1); // solhint-disable-line max-line-length
    
    // ===========================================================
    // ===================== Constructor =========================
    // ===========================================================

    constructor(address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {}

    function initialize() external initializer {
    }

    // ===========================================================
    // ===================== Admin Functions =====================
    // ===========================================================

    function ownerSetBorrowOnlyBitmap(
        uint256 _bitmap
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.borrowOnlyBitmap = _bitmap;
        emit BorrowOnlyBitmapSet(_bitmap);
    }

    function ownerSetSingleCollateralStrictDebt(
        uint256 _collateralMarketId,
        SingleCollateralStrictDebtStruct calldata _singleCollateralStrictDebt
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.singleCollateralStrictDebt[_collateralMarketId] = _singleCollateralStrictDebt;
        s.singleCollateralStrictDebtMarketIds |= 1 << _collateralMarketId;

        emit SingleCollateralStrictDebtSet(_collateralMarketId, _singleCollateralStrictDebt);
    }

    function ownerSetDebtMarketWithStrictCollateral(
        uint256 _debtMarketId,
        uint256 _collateralBitmap
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.debtWithStrictCollateralMarketIds |= 1 << _debtMarketId;
        s.debtMarketIdToStrictCollateralBitmap[_debtMarketId] = _collateralBitmap;

        emit DebtMarketWithStrictCollateralSet(_debtMarketId, _collateralBitmap);
    }

    function ownerRemoveSingleCollateralStrictDebt(
        uint256 _collateralMarketId
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.singleCollateralStrictDebtMarketIds &= ~(1 << _collateralMarketId);
        delete s.singleCollateralStrictDebt[_collateralMarketId];
    }

    function ownerRemoveDebtMarketWithStrictCollateral(
        uint256 _debtMarketId
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.debtWithStrictCollateralMarketIds &= ~(1 << _debtMarketId);
        delete s.debtMarketIdToStrictCollateralBitmap[_debtMarketId];
    }

    function ownerSetCategoryStruct(
        Category _category,
        uint256 _bitmap,
        IDolomiteStructs.Decimal memory _marginRatioOverride,
        IDolomiteStructs.Decimal memory _liquidationRewardOverride
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.categories[_category] = CategoryStruct({
            category: _category,
            bitmap: _bitmap,
            marginRatioOverride: _marginRatioOverride,
            liquidationRewardOverride: _liquidationRewardOverride
        });

        emit CategorySet(_category, _bitmap, _marginRatioOverride, _liquidationRewardOverride);
    }

    function ownerSetActiveCategories(
        Category[] memory _categories
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Storage storage s = _getStorage();

        s.activeCategories = _categories;
        emit ActiveCategoriesSet(_categories);
    }

    // ===========================================================
    // =================== External Functions ====================
    // ===========================================================

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

        if (marketIdsLength == 0 || dolomiteMargin.getAccountNumberOfMarketsWithDebt(_account) == 0) {
            // The Dolomite Margin call this contract for various readers
            return _getDefaultValuesForOverride();
        }

        (uint256 collateralBitmap, uint256 debtBitmap) = _getBitmaps(marketIds, _account);

        return getRiskOverride(collateralBitmap, debtBitmap);
    }

    function getActiveCategories() external view returns (Category[] memory) {
        Storage storage s = _getStorage();
        return s.activeCategories;
    }

    function getBorrowOnlyBitmap() external view returns (uint256) {
        Storage storage s = _getStorage();
        return s.borrowOnlyBitmap;
    }
    
    function getSingleCollateralStrictDebtBitmap() external view returns (uint256) {
        Storage storage s = _getStorage();
        return s.singleCollateralStrictDebtMarketIds;
    }

    function getDebtWithStrictCollateralBitmap() external view returns (uint256) {
        Storage storage s = _getStorage();
        return s.debtWithStrictCollateralMarketIds;
    }

    function getSingleCollateralStrictDebtSettings(uint256 _marketId) external view returns (SingleCollateralStrictDebtStruct memory) {
        Storage storage s = _getStorage();
        return s.singleCollateralStrictDebt[_marketId];
    }

    function getDebtMarketIdToStrictCollateralBitmap(uint256 _marketId) external view returns (uint256) {
        Storage storage s = _getStorage();
        return s.debtMarketIdToStrictCollateralBitmap[_marketId];
    }

    function getCategory(Category _category) external view returns (CategoryStruct memory) {
        Storage storage s = _getStorage();
        return s.categories[_category];
    }

    // ==============================================================
    // ===================== Public Functions =======================
    // ==============================================================

    function getRiskOverride(
        uint256 _collateralBitmap,
        uint256 _debtBitmap
    ) public view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        Storage storage s = _getStorage();

        // check singleCollateralStrictDebt
        uint256 singleCollateralBitmap = _collateralBitmap & s.singleCollateralStrictDebtMarketIds;
        if (singleCollateralBitmap > 0) {
            Require.that(
                singleCollateralBitmap & (singleCollateralBitmap - 1) == 0,
                _FILE,
                "Multiple strict markets"
            );

            uint256 singleCollateralMarketId = BitLib.fls(singleCollateralBitmap);
            SingleCollateralStrictDebtStruct memory strictDebt = s.singleCollateralStrictDebt[singleCollateralMarketId];
            Require.that(
                strictDebt.debtBitmap | _debtBitmap == strictDebt.debtBitmap,
                _FILE,
                "Invalid debt markets"
            );

            return (strictDebt.marginRatioOverride, strictDebt.liquidationRewardOverride);
        }

        // check borrow only
        Require.that(
            s.borrowOnlyBitmap & _collateralBitmap == 0,
            _FILE,
            "Using borrow only collateral"
        );

        // check borrow market with strict debt
        uint256 strictBorrowMarkets = _debtBitmap & s.debtWithStrictCollateralMarketIds;
        while (strictBorrowMarkets != 0) {
            uint256 marketId = BitLib.fls(strictBorrowMarkets);
            uint256 allowedCollateral = s.debtMarketIdToStrictCollateralBitmap[marketId];

            Require.that(
                _collateralBitmap | allowedCollateral == allowedCollateral,
                _FILE,
                "Invalid collateral markets",
                marketId
            );

            strictBorrowMarkets &= ~(1 << marketId);
        }

        // loop through categories
        Category[] memory activeCategories = s.activeCategories;
        for (uint256 i; i < activeCategories.length; ++i) {
            CategoryStruct memory category = s.categories[activeCategories[i]];

            if (category.bitmap | _collateralBitmap | _debtBitmap == category.bitmap) {
                return (category.marginRatioOverride, category.liquidationRewardOverride);
            }
        }

        return _getDefaultValuesForOverride();
    }

    // ==============================================================
    // ===================== Internal Functions =====================
    // ==============================================================

    function _getBitmaps(
        uint256[] memory _marketIds,
        IDolomiteStructs.AccountInfo calldata _account
    ) internal view returns (uint256 collateralBitmap, uint256 debtBitmap) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();

        for (uint256 i; i < _marketIds.length; ++i) {
            IDolomiteStructs.Par memory par = dolomiteMargin.getAccountPar(_account, _marketIds[i]);

            if (par.sign) {
                collateralBitmap |= 1 << _marketIds[i];
            } else {
                debtBitmap |= 1 << _marketIds[i];
            }
        }
        
        return (collateralBitmap, debtBitmap);
    }

    function _getDefaultValuesForOverride() internal pure returns (
        IDolomiteStructs.Decimal memory,
        IDolomiteStructs.Decimal memory
    ) {
        return (IDolomiteStructs.Decimal({ value: 0 }), IDolomiteStructs.Decimal({ value: 0 }));
    }

    function _getStorage() internal pure returns (Storage storage s) {
        bytes32 slot = _STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := slot
        }
    }
}