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

import { IERC4626 } from "@dolomite-exchange/modules-base/contracts/interfaces/IERC4626.sol";
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   USDMRouter
 * @author  Dolomite
 *
 * @notice  Router contract to wrap USDM into wUSDM and deposit or withdraw into Dolomite
 */
contract USDMRouter {
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC4626;

    // ================================================
    // =================== State Variables ============
    // ================================================

    IDolomiteMargin public immutable DOLOMITE_MARGIN;
    IERC20 public immutable USDM;
    IERC4626 public immutable W_USDM;
    uint256 immutable public W_USDM_MARKET_ID;

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(address _dolomiteMargin, address _usdm, address _wUSDM) {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        USDM = IERC20(_usdm);
        W_USDM = IERC4626(_wUSDM);
        W_USDM_MARKET_ID = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_wUSDM);
    }

    // ================================================
    // =================== Functions ==================
    // ================================================

    function depositUSDM(
        uint256 _toAccountNumber,
        uint256 _amount
    ) external {
        uint256 shares = _wrapUSDM(_amount);
        W_USDM.safeApprove(address(DOLOMITE_MARGIN), shares);
        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            W_USDM_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: shares
            })
        );
    }

    function withdrawUSDM(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external {
        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            _fromAccountNumber,
            /* _toAccount = */ address(this), // solium-disable-line indentation
            W_USDM_MARKET_ID,
            IDolomiteStructs.AssetAmount({
                sign: false,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _amountWei == type(uint256).max
                    ? IDolomiteStructs.AssetReference.Target
                    : IDolomiteStructs.AssetReference.Delta,
                value: _amountWei == type(uint256).max ? 0 : _amountWei
            }),
            _balanceCheckFlag
        );
        _unwrapUSDM(_amountWei == type(uint256).max ? W_USDM.balanceOf(address(this)) : _amountWei, msg.sender);
    }

    // ================================================
    // ================ Internal Functions ============
    // ================================================

    function _wrapUSDM(uint256 _amount) internal returns (uint256) {
        USDM.safeTransferFrom(msg.sender, address(this), _amount);
        USDM.safeApprove(address(W_USDM), _amount);
        return W_USDM.deposit(_amount, address(this));
    }

    function _unwrapUSDM(uint256 _amount, address _receiver) internal returns (uint256) {
        return W_USDM.redeem(_amount, _receiver, address(this));
    }
}
