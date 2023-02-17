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
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { IGLPRewardsRouterV2 } from "../interfaces/IGLPRewardsRouterV2.sol";
import { IGmxRegistryV1 } from "../interfaces/IGmxRegistryV1.sol";
import { WrappedTokenUserVaultWrapper } from "../proxies/WrappedTokenUserVaultWrapper.sol";


/**
 * @title GLPWrapperProxyV1
 * @author Dolomite
 *
 * @notice  Contract for wrapping GLP via minting from USDC
 */
contract GLPWrapperProxyV1 is WrappedTokenUserVaultWrapper {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPWrapperProxyV1";

    // ============ Constructor ============

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _vaultFactory,
        address _dolomiteMargin
    ) WrappedTokenUserVaultWrapper(
        _vaultFactory,
        _dolomiteMargin
    ) {
    }

    // ============ Internal Functions ============

    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address _receiver,
        address _makerTokenUnderlying,
        address _takerToken,
        uint256 _amountTakerToken,
        address _vault,
        bytes calldata _orderData
    ) internal virtual returns (uint256) {

    }
}
