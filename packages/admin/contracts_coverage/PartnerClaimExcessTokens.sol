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
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IPartnerClaimExcessTokens } from "./interfaces/IPartnerClaimExcessTokens.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";


/**
 * @title   PartnerClaimExcessTokens
 * @author  Dolomite
 *
 * @notice  PartnerClaimExcessTokens contract that enables a partner to claim excess tokens from the protocol
 */
contract PartnerClaimExcessTokens is OnlyDolomiteMargin, IPartnerClaimExcessTokens {
    using SafeERC20 for IERC20;
    using DecimalLib for uint256;

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 private constant _FILE = "PartnerClaimExcessTokens";
    uint256 private constant _ONE = 1 ether;

    // ===================================================================
    // ====================== Immutable Variables ========================
    // ===================================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
    mapping(uint256 => ParnterInfo) public partnerInfo;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetPartnerInfo(
        uint256 _marketId,
        address _partner,
        uint256 _feeSplit
    ) external onlyDolomiteMarginOwner(msg.sender) {
        if (_partner != address(0) && _feeSplit < _ONE) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _partner != address(0) && _feeSplit < _ONE,
            _FILE,
            "Invalid partner or fee split"
        );
        partnerInfo[_marketId] = ParnterInfo({
            marketId: _marketId,
            partner: _partner,
            feeSplit: _feeSplit
        });
        emit PartnerInfoSet(_marketId, _partner, _feeSplit);
    }

    function ownerRemovePartnerInfo(uint256 _marketId) external onlyDolomiteMarginOwner(msg.sender) {
        delete partnerInfo[_marketId];
        emit PartnerInfoRemoved(_marketId);
    }

    // ===================================================================
    // ========================= Public Functions ========================
    // ===================================================================

    function claimExcessTokens(address _token, bool _depositIntoDolomite) external {
        address treasury = DOLOMITE_REGISTRY.treasury();
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
        /*assert(treasury != address(0));*/

        ParnterInfo memory info = partnerInfo[marketId];
        if (info.partner != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            info.partner != address(0),
            _FILE,
            "Partner not set"
        );
        if (msg.sender == info.partner || msg.sender == treasury) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == info.partner || msg.sender == treasury,
            _FILE,
            "Invalid sender"
        );

        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerWithdrawExcessTokens.selector,
                marketId,
                address(this)
            )
        );
        uint256 balance = IERC20(_token).balanceOf(address(this));

        uint256 partnerAmount = balance.mul(IDolomiteStructs.Decimal({ value: info.feeSplit }));
        if (partnerAmount > 0) {
            IERC20(_token).safeTransfer(info.partner, partnerAmount);
        }

        uint256 treasuryAmount = balance - partnerAmount;
        if (treasuryAmount > 0 && _depositIntoDolomite) {
            IERC20(_token).safeApprove(address(DOLOMITE_MARGIN()), treasuryAmount);
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                /* accountOwner = */ treasury,
                /* fromAccount = */ address(this),
                /* toAccountNumber = */ 0,
                marketId,
                IDolomiteStructs.AssetAmount({
                    sign: true,
                    denomination: IDolomiteStructs.AssetDenomination.Wei,
                    ref: IDolomiteStructs.AssetReference.Delta,
                    value: treasuryAmount
                })
            );
        } else if (treasuryAmount > 0) {
            IERC20(_token).safeTransfer(treasury, treasuryAmount);
        }
    }

    // ===================================================================
    // ========================= View Functions ==========================
    // ===================================================================

    function getPartnerInfo(uint256 _marketId) external view returns (ParnterInfo memory) {
        return partnerInfo[_marketId];
    }
}
