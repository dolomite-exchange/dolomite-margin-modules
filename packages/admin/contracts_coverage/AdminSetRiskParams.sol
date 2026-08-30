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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteAccountRiskOverrideSetter } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteAccountRiskOverrideSetter.sol"; // solhint-disable-line max-line-length
import { IDolomiteMarginV2Admin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginV2Admin.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IAdminSetRiskParams } from "./interfaces/IAdminSetRiskParams.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";


/**
 * @title   AdminSetRiskParams
 * @author  Dolomite
 *
 * @notice  AdminSetRiskParams contract that enables an admin to set risk parameters for a market
 */
contract AdminSetRiskParams is OnlyDolomiteMargin, AdminRegistryHelper, IAdminSetRiskParams {

    bytes32 private constant _FILE = "AdminSetRiskParams";
    bytes32 public constant ADMIN_SET_RISK_PARAMS_ROLE = keccak256("ADMIN_SET_RISK_PARAMS_ROLE");

    address public dolomiteAccountRiskOverride;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _dolomiteAccountRiskOverride,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        _ownerSetDolomiteAccountRiskOverride(_dolomiteAccountRiskOverride);
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetDolomiteAccountRiskOverride(
        address _dolomiteAccountRiskOverride
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetDolomiteAccountRiskOverride(_dolomiteAccountRiskOverride);
    }

    // ===================================================================
    // ========================= Public Functions ========================
    // ===================================================================

    function setMarketMaxSupplyWei(
        uint256 _marketId,
        uint256 _maxSupplyWei
    )
    external
    checkPermission(this.setMarketMaxSupplyWei.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginV2Admin.ownerSetMaxSupplyWei.selector,
                _marketId,
                _maxSupplyWei
            )
        );
    }

    function setMarketMaxSupplyWeis(
        uint256[] calldata _marketIds,
        uint256[] calldata _maxSupplyWeis
    )
    external
    checkPermission(this.setMarketMaxSupplyWeis.selector, msg.sender) {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                address(DOLOMITE_MARGIN()),
                abi.encodeWithSelector(
                    IDolomiteMarginV2Admin.ownerSetMaxSupplyWei.selector,
                    _marketIds[i],
                    _maxSupplyWeis[i]
                )
            );
        }
    }

    function setMarketMaxBorrowWei(
        uint256 _marketId,
        uint256 _maxBorrowWei
    )
    external
    checkPermission(this.setMarketMaxBorrowWei.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginV2Admin.ownerSetMaxBorrowWei.selector,
                _marketId,
                _maxBorrowWei
            )
        );
    }

    function setMarketMaxBorrowWeis(
        uint256[] calldata _marketIds,
        uint256[] calldata _maxBorrowWeis
    )
    external
    checkPermission(this.setMarketMaxBorrowWeis.selector, msg.sender) {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                address(DOLOMITE_MARGIN()),
                abi.encodeWithSelector(
                    IDolomiteMarginV2Admin.ownerSetMaxBorrowWei.selector,
                    _marketIds[i],
                    _maxBorrowWeis[i]
                )
            );
        }
    }

    function setMarketMarginPremium(
        uint256 _marketId,
        IDolomiteStructs.Decimal calldata _marginPremium
    )
    external
    checkPermission(this.setMarketMarginPremium.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginV2Admin.ownerSetMarginPremium.selector,
                _marketId,
                _marginPremium
            )
        );
    }

    function setMarketMarginPremiums(
        uint256[] calldata _marketIds,
        IDolomiteStructs.Decimal[] calldata _marginPremiums
    )
    external
    checkPermission(this.setMarketMarginPremiums.selector, msg.sender) {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                address(DOLOMITE_MARGIN()),
                abi.encodeWithSelector(
                    IDolomiteMarginV2Admin.ownerSetMarginPremium.selector,
                    _marketIds[i],
                    _marginPremiums[i]
                )
            );
        }
    }

    function setMarketLiquidationPremium(
        uint256 _marketId,
        IDolomiteStructs.Decimal calldata _liquidationSpreadPremium
    )
    external
    checkPermission(this.setMarketLiquidationPremium.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginV2Admin.ownerSetLiquidationSpreadPremium.selector,
                _marketId,
                _liquidationSpreadPremium
            )
        );
    }

    function setMarketLiquidationPremiums(
        uint256[] calldata _marketIds,
        IDolomiteStructs.Decimal[] calldata _liquidationSpreadPremiums
    )
    external
    checkPermission(this.setMarketLiquidationPremiums.selector, msg.sender) {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
                address(DOLOMITE_MARGIN()),
                abi.encodeWithSelector(
                    IDolomiteMarginV2Admin.ownerSetLiquidationSpreadPremium.selector,
                    _marketIds[i],
                    _liquidationSpreadPremiums[i]
                )
            );
        }
    }

    function setCategoriesByMarketIds(
        uint256[] memory _marketIds,
        IDolomiteAccountRiskOverrideSetter.Category[] memory _categories
    )
    external
    checkPermission(this.setCategoriesByMarketIds.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            dolomiteAccountRiskOverride,
            abi.encodeWithSelector(
                IDolomiteAccountRiskOverrideSetter.ownerSetCategoriesByMarketIds.selector,
                _marketIds,
                _categories
            )
        );
    }

    function setCategoryByMarketId(
        uint256 _marketId,
        IDolomiteAccountRiskOverrideSetter.Category _category
    )
    external
    checkPermission(this.setCategoryByMarketId.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            dolomiteAccountRiskOverride,
            abi.encodeWithSelector(
                IDolomiteAccountRiskOverrideSetter.ownerSetCategoryByMarketId.selector,
                _marketId,
                _category
            )
        );
    }

    function setCategoryParam(
        IDolomiteAccountRiskOverrideSetter.Category _category,
        IDolomiteStructs.Decimal calldata _marginRatioOverride,
        IDolomiteStructs.Decimal calldata _liquidationRewardOverride
    )
    external
    checkPermission(this.setCategoryParam.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            dolomiteAccountRiskOverride,
            abi.encodeWithSelector(
                IDolomiteAccountRiskOverrideSetter.ownerSetCategoryParam.selector,
                _category,
                _marginRatioOverride,
                _liquidationRewardOverride
            )
        );
    }

    function setRiskFeatureByMarketId(
        uint256 _marketId,
        IDolomiteAccountRiskOverrideSetter.RiskFeature _riskFeature,
        bytes calldata _extraData
    )
    external
    checkPermission(this.setRiskFeatureByMarketId.selector, msg.sender) {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            dolomiteAccountRiskOverride,
            abi.encodeWithSelector(
                IDolomiteAccountRiskOverrideSetter.ownerSetRiskFeatureByMarketId.selector,
                _marketId,
                _riskFeature,
                _extraData
            )
        );
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _ownerSetDolomiteAccountRiskOverride(address _dolomiteAccountRiskOverride) internal {
        if (_dolomiteAccountRiskOverride != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dolomiteAccountRiskOverride != address(0),
            _FILE,
            "Invalid risk override setter"
        );
        dolomiteAccountRiskOverride = _dolomiteAccountRiskOverride;
        emit DolomiteAccountRiskOverrideSet(_dolomiteAccountRiskOverride);
    }
}
