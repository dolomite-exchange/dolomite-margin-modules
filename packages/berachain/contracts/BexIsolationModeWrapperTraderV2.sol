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

import { IsolationModeWrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeWrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBexVault } from "./interfaces/IBexVault.sol";
import { IBexPool } from "./interfaces/IBexPool.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";

import "hardhat/console.sol";

/**
 * @title   BexIsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping into a BEX LP Pair. Upon settlement, the LP tokens are
 *          sent to the user's vault and the factory token is minted to `DolomiteMargin`.
 */
contract BexIsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2 {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct BexIsolationModeWrapperStorage {
        EnumerableSet.AddressSet poolTokens;
    }

    // ============ Constants ============

    bytes32 private constant _FILE = "BexIsolationModeWrapperV2";
    bytes32 private constant _STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.bexIsolationModeWrapperStorage")) - 1);

    IBexVault public immutable BEX_VAULT;
    bytes32 public immutable POOL_ID;

    // ============ Constructor ============

    constructor(
        address _bexVault,
        address _dBex,
        address _dolomiteMargin,
        address _dolomiteRegistry
    )
    IsolationModeWrapperTraderV2(
        _dBex,
        _dolomiteMargin,
        _dolomiteRegistry
    ) {
        BEX_VAULT = IBexVault(_bexVault);

        address underlyingToken = VAULT_FACTORY.UNDERLYING_TOKEN();
        POOL_ID = IBexPool(underlyingToken).getPoolId();
        (IERC20[] memory tokens, , ) = BEX_VAULT.getPoolTokens(POOL_ID);

        BexIsolationModeWrapperStorage storage bexIsolationModeWrapperStorage = _getStorage();
        for (uint256 i = 0; i < tokens.length; i++) {
            if (address(tokens[i]) == underlyingToken) {
                continue;
            }

            bexIsolationModeWrapperStorage.poolTokens.add(address(tokens[i]));
        }
    }

    // ============ External Functions ============

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _getStorage().poolTokens.contains(_inputToken);
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address,
        address,
        address,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory
    )
    internal
    override
    returns (uint256) {
        IERC20(_inputToken).safeApprove(address(BEX_VAULT), _inputAmount);

        (IERC20[] memory assets, , ) = BEX_VAULT.getPoolTokens(POOL_ID);
        uint256[] memory maxAmountsIn = new uint256[](assets.length);
        uint256[] memory amountsIn = new uint256[](assets.length - 1);
        uint256 cursor;
        IERC20 underlyingToken = IERC20(VAULT_FACTORY.UNDERLYING_TOKEN());
        for (uint256 i = 0; i < assets.length; i++) {
            if (address(assets[i]) == _inputToken) {
                maxAmountsIn[i] = _inputAmount;
            } else {
                maxAmountsIn[i] = 0;
            }

            if (address(assets[i]) == _inputToken) {
                amountsIn[cursor] = _inputAmount;
                cursor++;
            } else if (address(assets[i]) == address(underlyingToken)) {
                continue;
            } else {
                amountsIn[cursor] = 0;
                cursor++;
            }
        }

        uint256 preBal = underlyingToken.balanceOf(address(this));
        uint256 minOutputAmount = _minOutputAmount;
        BEX_VAULT.joinPool(
            POOL_ID,
            address(this),
            address(this),
            IBexVault.JoinPoolRequest({
                assets: assets,
                maxAmountsIn: maxAmountsIn,
                userData: abi.encode(
                    IBexVault.StablePoolJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
                    amountsIn,
                    minOutputAmount
                ),
                fromInternalBalance: false
            })
        );

        uint256 outputAmount = underlyingToken.balanceOf(address(this)) - preBal;
        Require.that(
            outputAmount >= minOutputAmount,
            _FILE,
            "Insufficient output amount"
        );
        console.log("outputAmount: ", outputAmount);
        return outputAmount;
    }

    function _getExchangeCost(
        address _inputToken,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        return 0;
    }

    function _getStorage() internal view returns (BexIsolationModeWrapperStorage storage bexIsolationModeWrapperStorage) {
        bytes32 slot = _STORAGE_SLOT;
        assembly {
            bexIsolationModeWrapperStorage.slot := slot
        }
    }
}
