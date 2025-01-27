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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ReentrancyGuardUpgradeable } from "../helpers/ReentrancyGuardUpgradeable.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IIsolationModeTokenVaultV1 } from "../isolation-mode/interfaces/IIsolationModeTokenVaultV1.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IRouterBase } from "./interfaces/IRouterBase.sol";


/**
 * @title   RouterBase
 * @author  Dolomite
 *
 * @notice  Base contract for all routers
 */
abstract contract RouterBase is
    OnlyDolomiteMargin,
    ReentrancyGuardUpgradeable,
    Initializable,
    IRouterBase
{

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "RouterBase";
    uint256 private constant _DOLOMITE_BALANCE_ACCOUNT_NUMBER_CUTOFF = 100;
    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    string constant public DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";
    string constant public DOLOMITE_FS_GLP = "Dolomite: Fee + Staked GLP";

    // ========================================================
    // ================= Storage Variables ====================
    // ========================================================

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor (
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function initialize() external initializer virtual {
        // solhint-disable-previous-line no-empty-blocks
    }

    // ========================================================
    // ================== Public Functions ==================
    // ========================================================

    function isDolomiteBalance(uint256 _accountNumber) public pure returns (bool) {
        return _accountNumber < _DOLOMITE_BALANCE_ACCOUNT_NUMBER_CUTOFF;
    }

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _getMarketInfo(
        uint256 _marketId
    ) internal view returns (MarketInfo memory) {
        address marketToken = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        address transferToken = DOLOMITE_REGISTRY.dolomiteAccountRegistry().getTransferTokenOverride(marketToken);

        if (_isIsolationModeAsset(marketToken)) {
            address token = IIsolationModeVaultFactory(marketToken).UNDERLYING_TOKEN();
            return MarketInfo({
                marketId: _marketId,
                isIsolationModeAsset: true,
                marketToken: marketToken,
                token: IERC20(token),
                transferToken: transferToken == address(0) ? IERC20(token) : IERC20(transferToken),
                factory: IIsolationModeVaultFactory(marketToken)
            });
        } else {
            return MarketInfo({
                marketId: _marketId,
                isIsolationModeAsset: false,
                marketToken: marketToken,
                token: IERC20(marketToken),
                transferToken: transferToken == address(0) ? IERC20(marketToken) : IERC20(transferToken),
                factory: IIsolationModeVaultFactory(address(0))
            });
        }
    }

    function _validateIsolationModeMarketAndGetVault(
        MarketInfo memory _marketInfo,
        address _account
    ) internal returns (IIsolationModeTokenVaultV1) {
        Require.that(
            _marketInfo.isIsolationModeAsset,
            _FILE,
            "Market is not isolation mode"
        );
        address vault = _marketInfo.factory.getVaultByAccount(_account);
        if (vault == address(0)) {
            vault = _marketInfo.factory.createVault(_account);
        }

        return IIsolationModeTokenVaultV1(vault);
    }

    function _isIsolationModeMarket(uint256 _marketId) internal view returns (bool) {
        return _isIsolationModeAsset(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));
    }

    function _isIsolationModeAsset(address _token) internal view returns (bool) {
        string memory name = IERC20Metadata(_token).name();

        if (keccak256(bytes(name)) == keccak256(bytes(DOLOMITE_FS_GLP))) {
            return true;
        }
        return _startsWith(DOLOMITE_ISOLATION_PREFIX, name);
    }

    // ========================================================
    // ================== Private Functions ===================
    // ========================================================

    function _startsWith(string memory _start, string memory _str) private pure returns (bool) {
        if (bytes(_start).length > bytes(_str).length) {
            return false;
        }

        bytes32 hash;
        assembly {
            let size := mload(_start)
            hash := keccak256(add(_str, 32), size)
        }
        return hash == keccak256(bytes(_start));
    }
}
