// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";


/**
 * @title TokenWrapperLib
 * @author Dolomite
 *
 * Library contract that makes wrapping tokens in a wrapper contract easy
 */
library TokenWrapperLib {
    using SafeERC20 for IERC20;

    function approveWrappedTokenForTransfer(
        address _wrappedTokenFactory,
        address _vault,
        address _dolomiteMargin,
        uint256 _amount
    ) internal {
        IWrappedTokenUserVaultFactory(_wrappedTokenFactory).enqueueTransferIntoDolomiteMargin(_vault, _amount);

        address underlyingToken = IWrappedTokenUserVaultFactory(_wrappedTokenFactory).UNDERLYING_TOKEN();
        IERC20(underlyingToken).safeApprove(_vault, _amount);
        IERC20(_wrappedTokenFactory).safeApprove(_dolomiteMargin, _amount);
    }
}
