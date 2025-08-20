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

import { IsolationModeUnwrapperTraderV2 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeUnwrapperTraderV2.sol"; // solhint-disable-line max-line-length
import { GLPMathLib } from "./GLPMathLib.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxVault } from "./interfaces/IGmxVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IGLPRedemptionUnwrapperTraderV2 } from "./interfaces/IGLPRedemptionUnwrapperTraderV2.sol";


/**
 * @title   GLPIsolationModeUnwrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for unwrapping GLP (via burning via the GLPRewardsRouter) into any supported token. Upon settlement,
 *          the burned GLP is sent from the user's vault to this contract and dfsGLP is burned from `DolomiteMargin`.
 */
contract GLPRedemptionUnwrapperTraderV2 is IGLPRedemptionUnwrapperTraderV2, IsolationModeUnwrapperTraderV2 {
    using GLPMathLib for IGmxVault;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPRedemptionUnwrapperTraderV2";

    // ============ Immutable State Variables ============

    IGmxRegistryV1 public immutable GMX_REGISTRY; // solhint-disable-line var-name-mixedcase
    address public immutable HANDLER;
    IERC20 public immutable USDC;

    mapping(address => mapping(uint256 => uint256)) public usdcRedemptionAmount;

    // ============ Constructor ============

    constructor(
        address _gmxRegistry,
        address _handler,
        address _usdc,
        address _dfsGlp,
        address _dolomiteMargin
    )
    IsolationModeUnwrapperTraderV2(
        _dfsGlp,
        _dolomiteMargin,
        address(IGmxRegistryV1(_gmxRegistry).dolomiteRegistry())
    ) {
        GMX_REGISTRY = IGmxRegistryV1(_gmxRegistry);
        HANDLER = _handler;
        USDC = IERC20(_usdc);
    }

    // ==========================================
    // ============= Admin Functions ============
    // ==========================================

    function handlerSetUsdcRedemptionAmounts(
        address[] memory _users,
        uint256[] memory _accountNumbers,
        uint256[] memory _usdcRedemptionAmounts
    ) external {
        Require.that(
            msg.sender == HANDLER,
            _FILE,
            "Only handler can call"
        );
        Require.that(
            _users.length == _accountNumbers.length && _users.length == _usdcRedemptionAmounts.length,
            _FILE,
            "Invalid input lengths"
        );

        for (uint256 i = 0; i < _users.length; ++i) {
            usdcRedemptionAmount[_users[i]][_accountNumbers[i]] = _usdcRedemptionAmounts[i];
            emit UsdcRedemptionAmountSet(_users[i], _accountNumbers[i], _usdcRedemptionAmounts[i]);
        }
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function isValidOutputToken(address _outputToken) public override view returns (bool) {
        return _outputToken == address(USDC);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeUnderlyingTokenToOutputToken(
        address /* _tradeOriginator */,
        address /* _receiver */,
        address _outputToken,
        uint256 _minOutputAmount,
        address /* _inputToken */,
        uint256 _inputAmount,
        bytes memory _extraOrderData
    )
    internal
    override
    returns (uint256) {
        (address user, uint256 accountNumber) = abi.decode(_extraOrderData, (address, uint256));

        uint256 amountOut = GMX_REGISTRY.glpRewardsRouter().unstakeAndRedeemGlp(
            /* _tokenOut = */ _outputToken,
            /* _glpAmount = */ _inputAmount,
            _minOutputAmount,
            /* _receiver = */ address(this)
        );
        uint256 amount = usdcRedemptionAmount[user][accountNumber];
        usdcRedemptionAmount[user][accountNumber] = 0;

        return amountOut + amount;
    }

    function _getExchangeCost(
        address,
        address _outputToken,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    view
    returns (uint256) {
        uint256 usdgAmount = GLPMathLib.getUsdgAmountForSell(GMX_REGISTRY, _desiredInputAmount);
        return GMX_REGISTRY.gmxVault().getGlpRedemptionAmount(_outputToken, usdgAmount);
    }
}
