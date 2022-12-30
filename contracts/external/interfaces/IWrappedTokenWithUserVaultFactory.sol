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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";


interface IWrappedTokenWithUserVaultFactory {

    function UNDERLYING_TOKEN() external view returns (address);

    function MARKET_ID() external view returns (uint256);

    function DOLOMITE_MARGIN() external view returns (IDolomiteMargin);

    function createVault(address _account) external returns (address);

    /**
     * @return The address of the current vault implementation contract
     */
    function userVaultImplementation() external view returns (address);

    function setUserVaultImplementation(address _userVaultImplementation) external;

    function getVaultByUser(address _user) external view returns (address _vault);

    function getUserByVault(address _vault) external view returns (address _user);

    /**
     * @param _toAccountNumber  The account number of the account to which the tokens will be deposited
     * @param _amountWei        The amount of tokens to deposit
     */
    function depositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external;

    /**
     * @param _fromAccountNumber    The account number of the account from which the tokens will be withdrawn
     * @param _amountWei            The amount of tokens to withdraw
     */
    function withdrawFromDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external;

    /**
     * @param _recipient    The address to which the underlying tokens will be transferred. Used for performing the
     *                      unwrapping, therefore `_recipient` should be an instance of
     *                      `ILiquidityTokenUnwrapperForLiquidation`
     * @param _amountWei    The amount of tokens to transfer to the recipient
     */
    function liquidateWithinDolomiteMargin(
        address _recipient,
        uint256 _amountWei
    )
    external;
}
