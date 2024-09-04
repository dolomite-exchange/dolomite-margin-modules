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

import { IAccountTransferReceiver } from "./interfaces/IAccountTransferReceiver.sol";
import { IGmxRewardRouterV2 } from "./interfaces/IGmxRewardRouterV2.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title   AccountTransferReceiver
 * @author  Dolomite
 *
 * @notice  AccountTransferReceiver
 */
contract AccountTransferReceiver is IAccountTransferReceiver {

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "AccountTransferReceiver";

    address public immutable owner;
    address public immutable vault;
    IGmxRewardRouterV2 public immutable rewardsRouter;
    address public immutable gmx;
    address public immutable sGmx;
    address public immutable sbfGmx;

    // ==================================================================
    // =========================== State Variables ======================
    // ==================================================================

    bool public canAcceptTransfer;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyOwner() {
        Require.that(
            msg.sender == owner,
            _FILE,
            "Caller must be owner"
        );
        _;
    }

    modifier onlyVault() {
        Require.that(
            msg.sender == vault,
            _FILE,
            "Caller must be vault"
        );
        _;
    }

    // ==================================================================
    // =========================== Constructor ==========================
    // ==================================================================

    constructor(
        address _vault,
        address _owner,
        address _rewardsRouter,
        address _gmx,
        address _sGmx,
        address _sbfGmx
    ) {
        owner = _owner;
        vault = _vault;
        rewardsRouter = IGmxRewardRouterV2(_rewardsRouter);
        canAcceptTransfer = true;
        gmx = _gmx;
        sGmx = _sGmx;
        sbfGmx = _sbfGmx;
    }

    // ==================================================================
    // =========================== Public Functions =====================
    // ==================================================================

    function acceptAccountTransfer() external onlyOwner {
        Require.that(
            canAcceptTransfer,
            _FILE,
            "Cannot accept transfer"
        );
        rewardsRouter.acceptTransfer(vault);
        canAcceptTransfer = false;
    }

    function signalAccountTransfer(address _receiver) external onlyOwner {
        IERC20(gmx).approve(address(sGmx), type(uint256).max);
        IERC20(sbfGmx).approve(_receiver, type(uint256).max);
        rewardsRouter.signalTransfer(_receiver);
    }

    function transferTokensOut(address _token, address _receiver) external onlyOwner {
        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(_receiver, bal);
    }

    function setCanAcceptTransfer(bool _canAcceptTransfer) external onlyVault {
        canAcceptTransfer = _canAcceptTransfer;
    }
}
