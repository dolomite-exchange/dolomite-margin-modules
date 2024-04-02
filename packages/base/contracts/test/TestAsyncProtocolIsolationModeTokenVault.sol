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

 // solhint-disable max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ITestAsyncProtocol } from "./ITestAsyncProtocol.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "../interfaces/IGenericTraderBase.sol";
import { IHandlerRegistry } from "../interfaces/IHandlerRegistry.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol";
import { IsolationModeTokenVaultV1WithPausable } from "../isolation-mode/abstract/IsolationModeTokenVaultV1WithPausable.sol";
import { IFreezableIsolationModeVaultFactory } from "../isolation-mode/interfaces/IFreezableIsolationModeVaultFactory.sol";
import { IIsolationModeVaultFactory } from "../isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { IUpgradeableAsyncIsolationModeUnwrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeUnwrapperTrader.sol";
import { IUpgradeableAsyncIsolationModeWrapperTrader } from "../isolation-mode/interfaces/IUpgradeableAsyncIsolationModeWrapperTrader.sol";
import { Require } from "../protocol/lib/Require.sol";
 // solhint-enable max-line-length


/**
 * @title   TestAsyncProtocolIsolationModeTokenVault
 * @author  Dolomite
 *
 * @dev     Test contract for AsyncProtocolIsolationModeTokenVault
 */
contract TestAsyncProtocolIsolationModeTokenVault is
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "TestAsyncIsolationModeVaultV1";
    ITestAsyncProtocol public immutable TEST_ASYNC_PROTOCOL;
    uint256 public revertFlag;

    // ==================================================================
    // ========================== Constructors ==========================
    // ==================================================================

    constructor(
        address _testAsyncProtocol,
        address _weth,
        uint256 _chainId
    )
        IsolationModeTokenVaultV1WithFreezable(_weth, _chainId)
    {
        TEST_ASYNC_PROTOCOL = ITestAsyncProtocol(_testAsyncProtocol);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    /**
     *
     * @param  _key Deposit key
     * @dev    This calls the wrapper trader which will revert if given an invalid _key
     */
    function cancelDeposit(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeWrapperTrader wrapper =
                                registry().getWrapperByToken(IFreezableIsolationModeVaultFactory(VAULT_FACTORY()));
        _validateVaultOwnerForStruct(wrapper.getDepositInfo(_key).vault);
        wrapper.initiateCancelDeposit(_key);
    }

    /**
     *
     * @param  _key Withdrawal key
     */
    function cancelWithdrawal(bytes32 _key) external onlyVaultOwner(msg.sender) {
        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IFreezableIsolationModeVaultFactory(VAULT_FACTORY()));
        IUpgradeableAsyncIsolationModeUnwrapperTrader.WithdrawalInfo memory withdrawalInfo
            = unwrapper.getWithdrawalInfo(_key);
        _validateVaultOwnerForStruct(withdrawalInfo.vault);
        Require.that(
            !withdrawalInfo.isLiquidation,
            _FILE,
            "Withdrawal from liquidation"
        );
        unwrapper.initiateCancelWithdrawal(_key);
    }

    function setRevertFlag(uint256 _flag) external {
        revertFlag = _flag;
    }

    function isExternalRedemptionPaused()
        public
        override
        pure
        returns (bool)
    {
        return false;
    }

    function registry() public view returns (IHandlerRegistry) {
        return IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).handlerRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    // ==================================================================
    // ======================== Internal Functions ========================
    // ==================================================================

    /**
     *
     *  @dev  _minOutputAmountWei MUST BE greater than 0 or call will revert
     */
    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    )
    internal
    virtual
    override {
        uint256 len = _params.tradersPath.length;
        if (_params.tradersPath[len - 1].traderType == IGenericTraderBase.TraderType.IsolationModeWrapper) {
            _params.tradersPath[len - 1].tradeData = abi.encode(_params.tradeAccountNumber, abi.encode(msg.value));
        } else {
            Require.that(
                msg.value == 0,
                _FILE,
                "Cannot send ETH for non-wrapper"
            );
        }

        super._swapExactInputForOutput(_params);

        if (revertFlag == 1) {
            revert("Reverting");
        } else if (revertFlag == 2) {
            revert();
        } else {
            assert(revertFlag == 0);
        }
    }

    function _initiateUnwrapping(
        uint256 _tradeAccountNumber,
        uint256 _inputAmount,
        address _outputToken,
        uint256 _minOutputAmount,
        bool _isLiquidation,
        bytes calldata _extraData
    ) internal override {
        IFreezableIsolationModeVaultFactory factory = IFreezableIsolationModeVaultFactory(VAULT_FACTORY());
        Require.that(
            registry().getUnwrapperByToken(factory).isValidOutputToken(_outputToken),
            _FILE,
            "Invalid output token"
        );

        Require.that(
            msg.value <= IFreezableIsolationModeVaultFactory(VAULT_FACTORY()).maxExecutionFee(),
            _FILE,
            "Invalid execution fee"
        );
        uint256 ethExecutionFee = msg.value;
        if (_isLiquidation) {
            ethExecutionFee += getExecutionFeeForAccountNumber(_tradeAccountNumber);
            _setExecutionFeeForAccountNumber(_tradeAccountNumber, /* _executionFee = */ 0); // reset it to 0
        }

        IUpgradeableAsyncIsolationModeUnwrapperTrader unwrapper =
                                registry().getUnwrapperByToken(IIsolationModeVaultFactory(VAULT_FACTORY()));
        IERC20(UNDERLYING_TOKEN()).safeApprove(address(unwrapper), _inputAmount);
        unwrapper.vaultInitiateUnwrapping{ value: ethExecutionFee }(
            _tradeAccountNumber,
            _inputAmount,
            _outputToken,
            _minOutputAmount,
            _isLiquidation,
            _extraData
        );
    }

    function _validateVaultOwnerForStruct(address _vault) internal view {
        Require.that(
            _vault == address(this),
            _FILE,
            "Invalid vault owner",
            _vault
        );
    }

    function _checkMsgValue() internal override view {
        // solhint-disable-previous-line no-empty-blocks
        // Don't do any validation here. We check the msg.value conditionally in the `swapExactInputForOutput`
        // implementation
    }
}
