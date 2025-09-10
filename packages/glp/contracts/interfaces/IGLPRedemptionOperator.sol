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
        address indexed user,
        uint256 indexed accountNumber,
        uint256 usdcRedemptionAmount
    );

    /**
     * Sets the USDC redemption amount for a given address and account number
     * 
     * @param  _users           The addresses of the GLP vaults
     * @param  _accountNumbers  The account numbers of the users
     * @param  _amounts         The USDC redemption amounts
     */
    function handlerSetUsdcRedemptionAmounts(
        address[] memory _users,
        uint256[] memory _accountNumbers,
        uint256[] memory _amounts
    ) external;

    /**
     * Redeems GLP for a given address and account number and claims USDC redemption
     * 
     * @dev If account is a borrow account, it will leave the USDC and output token in the borrow account
     * @dev If account is a default account, it will transfer USDC and output token to the vault owner's default account
     * 
     * @param  _vault               The address of the GLP vault
     * @param  _accountNumber       The account number of the glp vault
     * @param  _outputMarketId      The market id of the output token
     * @param  _minOutputAmountWei  The minimum amount of output token to receive
     */
    function handlerRedeemGLP(
        address _vault,
        uint256 _accountNumber,
        uint256 _outputMarketId,
        uint256 _minOutputAmountWei
    ) external;
}
