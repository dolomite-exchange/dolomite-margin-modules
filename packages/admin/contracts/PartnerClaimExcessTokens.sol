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
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { IDolomiteMarginAdmin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMarginAdmin.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { AdminRegistryHelper } from "./AdminRegistryHelper.sol";
import { IDolomiteOwner } from "./interfaces/IDolomiteOwner.sol";
import { IPartnerClaimExcessTokens } from "./interfaces/IPartnerClaimExcessTokens.sol";


/**
 * @title   PartnerClaimExcessTokens
 * @author  Dolomite
 *
 * @notice  PartnerClaimExcessTokens contract that enables a partner to claim excess tokens from the protocol
 */
contract PartnerClaimExcessTokens is OnlyDolomiteMargin, AdminRegistryHelper, IPartnerClaimExcessTokens {
    using SafeERC20 for IERC20;
    using DecimalLib for uint256;

    // ===================================================================
    // ============================ Constants ============================
    // ===================================================================

    bytes32 public constant ADMIN_CLAIM_EXCESS_TOKENS_ROLE = keccak256("ADMIN_CLAIM_EXCESS_TOKENS_ROLE");
    bytes32 private constant _FILE = "PartnerClaimExcessTokens";
    uint256 private constant _ONE = 1 ether;

    // ===================================================================
    // ======================== State Variables ==========================
    // ===================================================================

    mapping(uint256 => PartnerInfo) public partnerInfo;
    address public feeReceiver;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(
        address _feeReceiver,
        address _adminRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) AdminRegistryHelper(_adminRegistry) {
        _ownerSetFeeReceiver(_feeReceiver);
    }

    // ===================================================================
    // ========================= Admin Functions =========================
    // ===================================================================

    function ownerSetPartnerInfo(
        uint256 _marketId,
        address _partner,
        IDolomiteStructs.Decimal calldata _feeSplitToPartner
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _partner != address(0) && _feeSplitToPartner.value > 0 && _feeSplitToPartner.value < _ONE,
            _FILE,
            "Invalid partner or fee split"
        );
        partnerInfo[_marketId] = PartnerInfo({
            marketId: _marketId,
            partner: _partner,
            feeSplitToPartner: _feeSplitToPartner
        });
        emit PartnerInfoSet(_marketId, _partner, _feeSplitToPartner);
    }

    function ownerSetFeeReceiver(address _feeReceiver) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetFeeReceiver(_feeReceiver);
    }

    function ownerRemovePartnerInfo(uint256 _marketId) external onlyDolomiteMarginOwner(msg.sender) {
        delete partnerInfo[_marketId];
        emit PartnerInfoRemoved(_marketId);
    }

    // ===================================================================
    // ========================= Public Functions ========================
    // ===================================================================

    function claimExcessTokens(address _token, bool _depositIntoDolomite) external {
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);

        PartnerInfo memory info = partnerInfo[marketId];
        Require.that(
            info.partner != address(0),
            _FILE,
            "Partner not set"
        );

        Require.that(
            msg.sender == info.partner
                || ADMIN_REGISTRY.hasPermission(this.claimExcessTokens.selector, address(this), msg.sender),
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

        uint256 partnerAmount = balance.mul(info.feeSplitToPartner);
        if (partnerAmount > 0) {
            IERC20(_token).safeTransfer(info.partner, partnerAmount);
        }

        uint256 treasuryAmount = balance - partnerAmount;
        if (treasuryAmount > 0 && _depositIntoDolomite) {
            IERC20(_token).safeApprove(address(DOLOMITE_MARGIN()), treasuryAmount);
            AccountActionLib.deposit(
                DOLOMITE_MARGIN(),
                /* accountOwner = */ feeReceiver,
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
            IERC20(_token).safeTransfer(feeReceiver, treasuryAmount);
        }
    }

    function _ownerSetFeeReceiver(address _feeReceiver) internal {
        Require.that(
            _feeReceiver != address(0),
            _FILE,
            "Invalid fee receiver"
        );
        feeReceiver = _feeReceiver;
        emit FeeReceiverSet(_feeReceiver);
    }

    // ===================================================================
    // ========================= View Functions ==========================
    // ===================================================================

    function getPartnerInfo(uint256 _marketId) external view returns (PartnerInfo memory) {
        return partnerInfo[_marketId];
    }
}
