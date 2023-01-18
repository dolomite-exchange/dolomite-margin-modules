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

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { IGLPManager } from "../interfaces/IGLPManager.sol";
import { IGLPRewardRouterV2 } from "../interfaces/IGLPRewardRouterV2.sol";
import { IGMXVault } from "../interfaces/IGMXVault.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { ILiquidityTokenUnwrapperForLiquidation } from "../interfaces/ILiquidityTokenUnwrapperForLiquidation.sol";


/**
 * @title GLPUnwrapperProxy
 * @author Dolomite
 *
 * @notice  Contract for unwrapping GLP via a "redemption" to USDC
 */
contract GLPUnwrapperProxyV1 is ILiquidityTokenUnwrapperForLiquidation, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GLPUnwrapperProxyV1";
    uint256 private constant _ACTIONS_LENGTH = 2;
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    // ============ Immutable State Variables ============

    address public immutable USDC; // solhint-disable-line var-name-mixedcase
    uint256 public immutable USDC_MARKET_ID; // solhint-disable-line var-name-mixedcase
    IGLPManager public immutable GLP_MANAGER; // solhint-disable-line var-name-mixedcase
    IGLPRewardRouterV2 public immutable GLP_REWARD_ROUTER; // solhint-disable-line var-name-mixedcase
    IGMXVault public immutable GMX_VAULT; // solhint-disable-line var-name-mixedcase
    IERC20 public immutable GLP; // solhint-disable-line var-name-mixedcase
    IWrappedTokenUserVaultFactory public immutable DS_GLP; // solhint-disable-line var-name-mixedcase

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _glpManager,
        address _glpRewardRouter,
        address _gmxVault,
        address _glp,
        address _dsGlp,
        address _dolomiteMargin
    )
    OnlyDolomiteMargin(_dolomiteMargin) {
        USDC = _usdc;
        GLP_MANAGER = IGLPManager(_glpManager);
        GLP_REWARD_ROUTER = IGLPRewardRouterV2(_glpRewardRouter);
        GMX_VAULT = IGMXVault(_gmxVault);
        GLP = IERC20(_glp);
        DS_GLP = IWrappedTokenUserVaultFactory(_dsGlp);

        USDC_MARKET_ID = IDolomiteMargin(_dolomiteMargin).getMarketIdByTokenAddress(_usdc);
        IERC20(_usdc).safeApprove(_dolomiteMargin, type(uint256).max);
    }

    // ============================================
    // ============ External Functions ============
    // ============================================

    function exchange(
        address,
        address,
        address _makerToken,
        address _takerToken,
        uint256 _requestedFillAmount,
        bytes calldata _orderData
    )
    external
    override
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _takerToken == address(DS_GLP),
            _FILE,
            "Taker token must be DS_GLP",
            _takerToken
        );
        Require.that(
            _makerToken == USDC,
            _FILE,
            "Maker token must be USDC",
            _makerToken
        );

        // solium-disable indentation
        {
            uint256 balance = IERC20(DS_GLP.UNDERLYING_TOKEN()).balanceOf(address(this));
            Require.that(
                balance >= _requestedFillAmount,
                _FILE,
                "Insufficient GLP for trade",
                balance
            );
        }
        // solium-enable indentation
        (uint256 minAmountOut) = abi.decode(_orderData, (uint256));

        uint256 amountOut = GLP_REWARD_ROUTER.unstakeAndRedeemGlp(
        /* _tokenOut = */ _makerToken, // solium-disable-line indentation
        /* _glpAmount = */ _requestedFillAmount, // solium-disable-line indentation
            minAmountOut,
        /* _receiver = */ address(this) // solium-disable-line indentation
        );

        return amountOut;
    }

    function token() external override view returns (address) {
        return address(DS_GLP);
    }

    function outputMarketId() external override view returns (uint256) {
        return USDC_MARKET_ID;
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address,
        address _liquidAccountOwner,
        uint256,
        uint256 _heldMarket,
        uint256,
        uint256 _heldAmountWithReward
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);
        // Transfer the liquidated GLP tokens to this contract
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            _liquidAccountOwner,
            /* _receiver[encoded] = */ abi.encode(address(this)) // solium-disable-line indentation
        );

        uint256 outputMarket = USDC_MARKET_ID;
        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN.getMarketTokenAddress(_heldMarket),
            DOLOMITE_MARGIN.getMarketTokenAddress(outputMarket),
            _heldAmountWithReward,
            /* _orderData = */ bytes("") // solium-disable-line indentation
        );

        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _heldMarket,
            outputMarket,
            /* _trader = */ address(this), // solium-disable-line indentation
            /* _amountInWei = */ _heldAmountWithReward, // solium-disable-line indentation
            /* _amountOutMinWei = */ amountOut, // solium-disable-line indentation
            bytes("")
        );

        return actions;
    }

    function actionsLength() external override pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    // ==========================================
    // ============ Public Functions ============
    // ==========================================

    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes memory
    )
    public
    override
    view
    returns (uint256) {
        Require.that(
            _makerToken == address(DS_GLP),
            _FILE,
            "Maker token must be DS_GLP",
            _makerToken
        );
        Require.that(
            _takerToken == USDC,
            _FILE,
            "Taker token must be USDC",
            _takerToken
        );
        IGMXVault gmxVault = GMX_VAULT;

        uint256 aumInUsdg = GLP_MANAGER.getAumInUsdg(false);
        uint256 glpSupply = GLP.totalSupply();
        uint256 usdgAmount = _desiredMakerToken * aumInUsdg / glpSupply;
        uint256 redemptionAmount = gmxVault.getRedemptionAmount(_takerToken, usdgAmount);
        uint256 feeBasisPoints = gmxVault.getFeeBasisPoints(
            _makerToken,
            usdgAmount,
            gmxVault.mintBurnFeeBasisPoints(),
            gmxVault.taxBasisPoints(),
            /* _increment = */ false // solium-disable-line indentation
        );
        return _applyFees(redemptionAmount, feeBasisPoints);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _applyFees(
        uint256 _amount,
        uint256 _feeBasisPoints
    ) internal pure returns (uint256) {
        return _amount * (BASIS_POINTS_DIVISOR - _feeBasisPoints) / BASIS_POINTS_DIVISOR;
    }
}
