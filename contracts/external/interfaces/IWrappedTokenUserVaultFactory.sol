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

import { IBorrowPositionProxyV2 } from "./IBorrowPositionProxyV2.sol";
import { IOnlyDolomiteMargin } from "./IOnlyDolomiteMargin.sol";


interface IWrappedTokenUserVaultFactory is IOnlyDolomiteMargin {

    // ================================================
    // ==================== Events ====================
    // ================================================

    event UserVaultImplementationSet(
        address indexed previousUserVaultImplementation,
        address indexed newUserVaultImplementation
    );

    event TokenUnwrapperSet(
        address indexed tokenUnwrapper,
        bool isTrusted
    );

    event Initialized();

    // ================================================
    // ================== Functions ===================
    // ================================================

    /**
     * @notice  Initializes this contract's variables that are dependent on this token being added to DolomiteMargin.
     */
    function initialize(address[] calldata _tokenUnwrappers) external;

    /**
     * @notice  Creates the vault for `_account`
     *
     * @param _account  The account owner to create the vault for
     */
    function createVault(address _account) external returns (address);

    /**
     * @notice  Creates the vault for `msg.sender`
     *
     * @param _toAccountNumber  The account number of the account to which the tokens will be deposited
     * @param _amountWei        The amount of tokens to deposit
     */
    function createVaultAndDepositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    ) external returns (address);

    /**
     * @param _userVaultImplementation  The address of the new vault implementation contract
     */
    function setUserVaultImplementation(address _userVaultImplementation) external;

    /**
     * @param _tokenUnwrapper   The address of the token unwrapper contract to set whether or not it's trusted for
     *                          executing transfers
     * @param _isTrusted        True if the token unwrapper is trusted, false otherwise
     */
    function setIsTokenUnwrapperTrusted(address _tokenUnwrapper, bool _isTrusted) external;

    /**
     * @notice  This function should only be called by a user's vault contract
     *
     * @param _toAccountNumber  The account number of the account to which the tokens will be deposited
     * @param _amountWei        The amount of tokens to deposit
     */
    function depositIntoDolomiteMargin(
        uint256 _toAccountNumber,
        uint256 _amountWei
    )
    external;

    /**
     * @notice  This function should only be called by a user's vault contract
     *
     * @param _fromAccountNumber    The account number of the account from which the tokens will be withdrawn
     * @param _amountWei            The amount of tokens to withdraw
     */
    function withdrawFromDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    )
    external;

    /**
     * @notice  This function should only be called by a user's vault contract
     *
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


    // ============================================
    // ================= Constants ================
    // ============================================

    /**
     * @return The address of the token that this vault wraps around
     */
    function UNDERLYING_TOKEN() external view returns (address);

    /**
     * @return  The address of the BorrowPositionProxyV2 contract
     */
    function BORROW_POSITION_PROXY() external view returns (IBorrowPositionProxyV2);

    // =================================================
    // ================= View Functions ================
    // =================================================

    /**
     * @return  The market ID of this token contract according to DolomiteMargin. This value is initializes in the
     *          #initialize function
     */
    function marketId() external view returns (uint256);

    /**
     * @return  This function should always return `true`. It's used by The Graph to index this contract as a Wrapper.
     */
    function isIsolationAsset() external view returns (bool);

    /**
     * @return  The market IDs of the assets that can be used in a position with this wrapped asset. An empty array
     *          indicates that any non-isolation mode asset can be borrowed against it.
     */
    function allowablePositionMarketIds() external view returns (uint256[] memory);

    /**
     * @return  The address of the current vault implementation contract
     */
    function userVaultImplementation() external view returns (address);

    /**
     * @param _account  The account owner to get the vault for
     * @return _vault   The address of the vault created for `_account`. Returns address(0) if no vault has been created
     *                  yet for this account.
     */
    function getVaultByAccount(address _account) external view returns (address _vault);

    /**
     * @notice  Same as `getVaultByAccount`, but always returns the user's non-zero vault address.
     */
    function calculateVaultByAccount(address _account) external view returns (address _vault);

    /**
     * @param _vault    The vault that's used by an account for depositing/withdrawing
     * @return _account The address of the account that owns the `_vault`
     */
    function getAccountByVault(address _vault) external view returns (address _account);

    /**
     * @return  True if the token unwrapper is currently in-use by this contract.
     */
    function isTokenUnwrapperTrusted(address _tokenUnwrapper) external view returns (bool);
}
