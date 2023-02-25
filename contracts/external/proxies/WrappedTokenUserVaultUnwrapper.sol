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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginExchangeWrapper } from "../../protocol/interfaces/IDolomiteMarginExchangeWrapper.sol";
import { IDolomiteStructs } from "../../protocol/interfaces/IDolomiteStructs.sol";

import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IWrappedTokenUserVaultUnwrapper } from "../interfaces/IWrappedTokenUserVaultUnwrapper.sol";
import { IWrappedTokenUserVaultFactory } from "../interfaces/IWrappedTokenUserVaultFactory.sol";
import { IWrappedTokenUserVaultV1 } from "../interfaces/IWrappedTokenUserVaultV1.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   WrappedTokenUserVaultUnwrapper
 * @author  Dolomite
 *
 * @notice  Abstract contract for unwrapping a VaultWrapper token into the underlying token. Must be set as a token
 *          converter for the VaultWrapperFactory token.
 */
abstract contract WrappedTokenUserVaultUnwrapper is IWrappedTokenUserVaultUnwrapper, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ======================== Constants ========================

    bytes32 private constant _FILE = "WrappedTokenUserVaultUnwrapper";

    // ======================== Field Variables ========================

    IWrappedTokenUserVaultFactory public immutable VAULT_FACTORY; // solhint-disable-line var-name-mixedcase
    uint256 private immutable _ACTIONS_LENGTH = 2; // solhint-disable-line var-name-mixedcase

    // ======================== Constructor ========================

    constructor(
        address _vaultFactory,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        VAULT_FACTORY = IWrappedTokenUserVaultFactory(_vaultFactory);
    }

    // ======================== External Functions ========================

    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo calldata _accountInfo,
        bytes calldata _data
    )
    external
    onlyDolomiteMargin(msg.sender)
    onlyDolomiteMarginGlobalOperator(_sender) {
        Require.that(
            VAULT_FACTORY.getAccountByVault(_accountInfo.owner) != address(0),
            _FILE,
            "Account owner is not a vault",
            _accountInfo.owner
        );

        // This is called after a liquidation has occurred. We need to transfer excess tokens to the liquidator's
        // designated recipient
        (uint256 transferAmount) = abi.decode(_data, (uint256));
        Require.that(
            transferAmount > 0,
            _FILE,
            "Invalid transfer amount"
        );

        uint256 underlyingBalanceOf = IWrappedTokenUserVaultV1(_accountInfo.owner).underlyingBalanceOf();
        Require.that(
            underlyingBalanceOf >= transferAmount,
            _FILE,
            "Insufficient balance",
            underlyingBalanceOf,
            transferAmount
        );

        VAULT_FACTORY.enqueueTransferFromDolomiteMargin(_accountInfo.owner, transferAmount);
    }

    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        Require.that(
            _takerToken == address(VAULT_FACTORY),
            _FILE,
            "Invalid taker token",
            _takerToken
        );

        (uint256 minMakerAmount) = abi.decode(_orderData, (uint256));

        {
            uint256 balance = IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).balanceOf(address(this));
            Require.that(
                balance >= _amountTakerToken,
                _FILE,
                "Insufficient taker token",
                balance,
                _amountTakerToken
            );
        }

        uint256 outputAmount = _exchangeUnderlyingTokenToOutputToken(
            _tradeOriginator,
            _receiver,
            _makerToken,
            minMakerAmount,
            address(VAULT_FACTORY),
            _amountTakerToken,
            _orderData
        );
        Require.that(
            outputAmount >= minMakerAmount,
            _FILE,
            "Insufficient output amount",
            outputAmount,
            minMakerAmount
        );

        IERC20(_makerToken).safeApprove(_receiver, outputAmount);

        return outputAmount;
    }

    function token() external view returns (address) {
        return address(VAULT_FACTORY);
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address,
        address,
        uint256,
        uint256 _heldMarket,
        uint256,
        uint256 _heldAmount
    )
    external
    override
    view
    returns (IDolomiteMargin.ActionArgs[] memory) {
        IDolomiteMargin.ActionArgs[] memory actions = new IDolomiteMargin.ActionArgs[](_ACTIONS_LENGTH);
        // Transfer the Wrapped Tokens to this contract. Do this by enqueuing a transfer via the call to
        // `enqueueTransferFromDolomiteMargin` in `callFunction` on this contract.
        actions[0] = AccountActionLib.encodeCallAction(
            _liquidAccountId,
            address(this),
            /* _transferAmount[encoded] = */ abi.encode(_heldAmount)
        );

        uint256 _outputMarketId = outputMarketId();
        uint256 amountOut = getExchangeCost(
            DOLOMITE_MARGIN.getMarketTokenAddress(_heldMarket),
            DOLOMITE_MARGIN.getMarketTokenAddress(_outputMarketId),
            _heldAmount,
            /* _orderData = */ bytes("")
        );

        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _heldMarket,
            _outputMarketId,
            /* _trader = */ address(this),
            /* _amountInWei = */ _heldAmount,
            /* _amountOutMinWei = */ amountOut,
            bytes("")
        );

        return actions;
    }

    function actionsLength() external virtual pure returns (uint256) {
        return _ACTIONS_LENGTH;
    }

    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes memory _orderData
    )
    public
    override
    virtual
    view
    returns (uint256);

    function outputMarketId() public override virtual view returns (uint256);

    // ============ Internal Functions ============

    /**
     * @notice Performs the exchange from the factory's underlying token to `_makerToken` (could be anything).
     */
    function _exchangeUnderlyingTokenToOutputToken(
        address _tradeOriginator,
        address _receiver,
        address _makerToken,
        uint256 _minMakerAmount,
        address _takerToken,
        uint256 _amountTakerToken,
        bytes memory _orderData
    ) internal virtual returns (uint256);
}
