// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

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
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBuybackPool } from "./interfaces/IBuybackPool.sol";


/**
 * @title   BuybackPool
 * @author  Dolomite
 *
 * Simple buyback pool for users to buy exchange reward tokens with payment tokens
 */
contract BuybackPool is IBuybackPool, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;
    using DecimalLib for uint256;

    // ===================================================
    // ==================== Immutables ====================
    // ===================================================

    IERC20 public immutable EXCHANGE_TOKEN;
    IERC20 public immutable PAYMENT_TOKEN;

    // =========================================================
    // ==================== State Variables ====================
    // =========================================================

    // @dev 5%
    IDolomiteStructs.Decimal public exchangeRate = IDolomiteStructs.Decimal({ value: .05 ether });

    // ===========================================================
    // ======================= Constructor =======================
    // ===========================================================

    constructor(
        address _exchangeToken,
        address _paymentToken,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        EXCHANGE_TOKEN = IERC20(_exchangeToken);
        PAYMENT_TOKEN = IERC20(_paymentToken);
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function exchange(uint256 _paymentAmount) external {
        uint256 exchangeAmount = _paymentAmount.mul(exchangeRate);
        PAYMENT_TOKEN.safeTransferFrom(msg.sender, address(this), _paymentAmount);
        EXCHANGE_TOKEN.safeTransfer(msg.sender, exchangeAmount);
    }

    function ownerSetExchangeRate(
        uint256 _exchangeRate
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetExchangeRate(_exchangeRate);
    }

    function ownerWithdrawPaymentToken(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = PAYMENT_TOKEN.balanceOf(address(this));
        PAYMENT_TOKEN.safeTransfer(_receiver, bal);
    }

    // ==================================================================
    // ======================= Internal Functions =======================
    // ==================================================================

    function _ownerSetExchangeRate(
        uint256 _exchangeRate
    ) internal {
        exchangeRate = IDolomiteStructs.Decimal({ value: _exchangeRate });
        emit ExchangeRateSet(_exchangeRate);
    }
}
