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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteAddressRegistry } from "../interfaces/IDolomiteAddressRegistry.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   DolomiteAddressRegistry
 * @author  Dolomite
 *
 * @notice  Registry contract for storing isolation-mode vaults and restricted accounts
 */
contract DolomiteAddressRegistry is
    IDolomiteAddressRegistry,
    ProxyContractHelpers,
    OnlyDolomiteMarginForUpgradeable,
    Initializable
{
    using EnumerableSet for EnumerableSet.AddressSet;

    // ===================== Constants =====================

    bytes32 private constant _FILE = "DolomiteAddressRegistry";
    bytes32 private constant _ACCOUNT_INFORMATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.accountInformation")) - 1); // solhint-disable-line max-line-length

    bytes32 internal constant GLP_ISOLATION_MODE_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    bytes32 internal constant ISOLATION_MODE_PREFIX_HASH = keccak256(bytes("Dolomite Isolation:"));
    uint256 internal constant DOLOMITE_ISOLATION_LENGTH = 19;

    // ==================== Initializer ====================

    function initialize(address[] memory _factories) external initializer {
        AccountInformation storage storageStruct = _getAccountInformation();
        storageStruct.factories = _factories;
    }

    // ===================== Functions =====================

    function registerVault(
        address _account,
        address _vault
    ) external onlyDolomiteMarginGlobalOperator(msg.sender) {
        _addVault(_vault, _account);
        _addVaultToAccount(_account, _vault);
    }

    function ownerSetRestrictedAccount(
        address _account,
        bool _isRestricted
    )
    external
    onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetRestrictedAccount(_account, _isRestricted);
    }

    // ========================== View Functions =========================

    function isIsolationModeVault(address _vault) external view returns (bool) {
        AccountInformation storage storageStruct = _getAccountInformation();
        if (storageStruct.vaultToAccount[_vault] != address(0)) {
            return true;
        }

        address[] memory factories = storageStruct.factories;
        uint256 len = factories.length;
        for (uint256 i = 0; i < len;) {
            IIsolationModeVaultFactory factory = IIsolationModeVaultFactory(factories[i]);
            if (factory.getAccountByVault(_vault) != address(0)) {
                return true;
            }

            unchecked {
                ++i;
            }
        }

        return false;
    }

    function isRestrictedAccount(address _account) external view returns (bool) {
        AccountInformation storage storageStruct = _getAccountInformation();
        return storageStruct.restrictedAccounts[_account];
    }

    function getAccountByVault(address _vault) external view returns (address) {
        AccountInformation storage storageStruct = _getAccountInformation();
        return storageStruct.vaultToAccount[_vault];
    }

    function getVaultsByAccount(address _account) external view returns (address[] memory) {
        AccountInformation storage storageStruct = _getAccountInformation();
        return storageStruct.accountToVaults[_account].values();
    }

    function getFactories() external view returns (address[] memory) {
        return _getAccountInformation().factories;
    }

    function isMarketIdIsolationMode(uint256 _marketId) public view returns (bool) {
        return isTokenIsolationMode(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));
    }

    function isTokenIsolationMode(address _token) public view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _token,
            IERC20Metadata.name.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }
        string memory name = abi.decode(returnData, (string));
        return (
            (bytes(name).length >= DOLOMITE_ISOLATION_LENGTH
                && _hashSubstring(
                    name,
                    /* _startIndex = */ 0,
                    /* _endIndex = */ DOLOMITE_ISOLATION_LENGTH
                ) == ISOLATION_MODE_PREFIX_HASH
            )
            || keccak256(bytes(name)) == GLP_ISOLATION_MODE_HASH
        );
    }

    // ===================== Internal Functions =====================

    function _addVault(
        address _vault,
        address _account
    ) internal {
        AccountInformation storage storageStruct = _getAccountInformation();
        storageStruct.vaultToAccount[_vault] = _account;
    }

    function _addVaultToAccount(
        address _account,
        address _vault
    ) internal {
        AccountInformation storage storageStruct = _getAccountInformation();
        storageStruct.accountToVaults[_account].add(_vault);
        emit VaultAddedToAccount(_account, _vault);
    }

    function _ownerSetRestrictedAccount(
        address _account,
        bool _isRestricted
    ) internal {
        Require.that(
            _account != address(0),
            _FILE,
            "Invalid account"
        );

        AccountInformation storage storageStruct = _getAccountInformation();
        storageStruct.restrictedAccounts[_account] = _isRestricted;
        emit RestrictedAccountSet(_account, _isRestricted);
    }

    function _getAccountInformation() internal pure returns (AccountInformation storage accountInformation) {
        bytes32 slot = _ACCOUNT_INFORMATION_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            accountInformation.slot := slot
        }
    }

     function _hashSubstring(
        string memory _value,
        uint256 _startIndex,
        uint256 _endIndex
    )
        private
        pure
        returns (bytes32)
    {
        bytes memory strBytes = bytes(_value);
        bytes memory result = new bytes(_endIndex - _startIndex);
        for (uint256 i = _startIndex; i < _endIndex; i++) {
            result[i - _startIndex] = strBytes[i];
        }
        return keccak256(result);
    }
}