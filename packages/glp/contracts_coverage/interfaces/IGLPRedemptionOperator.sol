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


/**
 * @title   IGLPRedemptionOperator
 * @author  Dolomite
 *
 * @notice  Interface for the GLPRedemptionOperator contract
 */
interface IGLPRedemptionOperator {
    event UsdcRedemptionAmountSet(
        address indexed vault,
        uint256[] accountNumbers,
        uint256[] usdcRedemptionAmounts
    );

    struct SetRedemptionAmountsParams {
        address vault;
        uint256[] accountNumbers;
        uint256[] usdcRedemptionAmounts;
    }

    struct RedemptionParams {
        uint256 accountNumber;
        uint256 outputMarketId;
        uint256 minOutputAmountWei;
    }

    /**
     * Sets the USDC redemption amount all vault accounts
     *
     * @param  _params          The parameters for the redemption amounts
     */
    function handlerSetRedemptionAmounts(
        SetRedemptionAmountsParams[] memory _params
    ) external;

    /**
     * Executes redemptions and unwraps for a vault accounts
     *
     * @dev If account is a borrow account, it will leave the USDC and output token in the borrow account
     * @dev If account is a default account, it will transfer USDC and output token to the vault owner's default account
     *
     * @param  _vault               The address of the GLP vault
     * @param  _redemptionParams    The parameters for the redemption
     */
    function handlerExecuteVault(
        address _vault,
        RedemptionParams[] memory _redemptionParams
    ) external;
}
