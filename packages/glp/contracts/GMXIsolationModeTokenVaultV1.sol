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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol"; // solhint-disable-line max-line-length
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGMXIsolationModeTokenVaultV1 } from "./interfaces/IGMXIsolationModeTokenVaultV1.sol";
import { IGMXIsolationModeVaultFactory } from "./interfaces/IGMXIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IAccountTransferReceiver } from "./interfaces/IAccountTransferReceiver.sol";


/**
 * @title   GMXIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the GMX token that can be used to
 *          to credit a user's Dolomite balance. GMX held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GMXIsolationModeTokenVaultV1 is
    IGMXIsolationModeTokenVaultV1,
    IsolationModeTokenVaultV1WithFreezable
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GMXIsolationModeTokenVaultV1";
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_DEPOSIT_SOURCE_GLP_VAULT = bytes32(uint256(keccak256("eip1967.proxy.isDepositSourceGLPVault")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _RECIPIENT_SLOT = bytes32(uint256(keccak256("eip1967.proxy.recipient")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _TEMP_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.tempBalance")) - 1); // solhint-disable-line max-line-length
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    modifier onlyHandler(address _handler) {
        Require.that(
            registry().isHandler(_handler),
            _FILE,
            "Invalid handler",
            _handler
        );
        _;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function stakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        _stakeGmx(_amount);
    }

    function unstakeGmx(uint256 _amount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(_amount);
    }

    function vestGmx(uint256 _esGmxAmount) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).vestGmx(_esGmxAmount);
    }

    function unvestGmx(bool _shouldStakeGmx) external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(msg.sender);
        assert(glpVault != address(0));

        IGLPIsolationModeTokenVaultV2(glpVault).unvestGmx(_shouldStakeGmx, /* _addDepositIntoDolomite = */ true);
    }

    function requestAccountTransfer() external onlyVaultOwner(msg.sender) {
        Require.that(
            !isVaultFrozen(),
            _FILE,
            "Transfer already in progress"
        );

        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        address recipient = IGLPIsolationModeTokenVaultV2(glpVault).getAccountTransferOutReceiverAddress();
        _setAddress(_RECIPIENT_SLOT, recipient);
        _setUint256(_TEMP_BALANCE_SLOT, 0);
        emit AccountTransferRequested(recipient);
    }

    function signalAccountTransfer(
        uint256 _gmxVirtualBalance,
        uint256 _glpVirtualBalance
    ) external onlyHandler(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        assert(glpVault != address(0));
        IDolomiteStructs.AccountInfo memory gmxAccountInfo = IDolomiteStructs.AccountInfo(
            address(this),
            _DEFAULT_ACCOUNT_NUMBER
        );
        IDolomiteStructs.AccountInfo memory glpAccountInfo = IDolomiteStructs.AccountInfo(
            glpVault,
            _DEFAULT_ACCOUNT_NUMBER
        );

        uint256 gmxAccountWei = DOLOMITE_MARGIN().getAccountWei(
            gmxAccountInfo,
            marketId()
        ).value;
        uint256 glpAccountWei = DOLOMITE_MARGIN().getAccountWei(
            glpAccountInfo,
            registry().glpVaultFactory().marketId()
        ).value;

        if (_gmxVirtualBalance == gmxAccountWei && _glpVirtualBalance == glpAccountWei) {
            _confirmAccountTransfer(glpVault, gmxAccountWei, glpAccountWei);
        } else {
            _cancelAccountTransfer(glpVault);
        }
    }

    function cancelAccountTransfer() external onlyVaultOwner(msg.sender) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        assert(glpVault != address(0));
        _cancelAccountTransfer(glpVault);
    }

    function setShouldSkipTransfer(bool _shouldSkipTransfer) external onlyVaultFactory(msg.sender) {
        _setShouldSkipTransfer(_shouldSkipTransfer);
    }

    function setIsDepositSourceGLPVault(bool _isDepositSourceGLPVault) external onlyVaultFactory(msg.sender) {
        _setIsDepositSourceGLPVault(_isDepositSourceGLPVault);
    }

    function executeDepositIntoVault(
        address _from,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (shouldSkipTransfer()) {
            _setShouldSkipTransfer(false);
        } else if (isDepositSourceGLPVault()) {
            address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());

            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(glpVault, address(this), _amount);
            _setIsDepositSourceGLPVault(false);
            _stakeGmx(_amount);
        } else {
            IERC20(UNDERLYING_TOKEN()).safeTransferFrom(_from, address(this), _amount);
            _stakeGmx(_amount);
        }
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    override
    onlyVaultFactory(msg.sender) {
        if (shouldSkipTransfer()) {
            _setShouldSkipTransfer(false);
            return;
        }
        uint256 underlyingBalance = super.underlyingBalanceOf();
        if (underlyingBalance < _amount) {
            address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
            assert(glpVault != address(0));

            uint256 maxUnstakeAmount = IGLPIsolationModeTokenVaultV2(glpVault).maxGmxUnstakeAmount();
            uint256 diff = _amount - underlyingBalance;
            if (diff <= maxUnstakeAmount) {
                IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(diff);
            } else {
                IGLPIsolationModeTokenVaultV2(glpVault).unvestGmx(
                    /* _shouldStakeGmx = */ false,
                    /* _addDepositIntoDolomite = */ false
                );
                IGLPIsolationModeTokenVaultV2(glpVault).unstakeGmx(diff);
            }
        }

        assert(_recipient != address(this));
        IERC20(UNDERLYING_TOKEN()).safeTransfer(_recipient, _amount);
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        return IGLPIsolationModeTokenVaultV2(glpVault).gmxBalanceOf() + super.underlyingBalanceOf();
    }

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function isDepositSourceGLPVault() public view returns (bool) {
        return _getUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT) == 1;
    }

    function isVaultFrozen()
    public
    view
    override(IIsolationModeTokenVaultV1WithFreezable, IsolationModeTokenVaultV1WithFreezable)
    returns (bool) {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        IAccountTransferReceiver receiver = IGLPIsolationModeTokenVaultV2(glpVault).accountTransferReceiver();

        if (address(receiver) == address(0)) {
            return _getAddress(_RECIPIENT_SLOT) != address(0);
        } else {
            return _getAddress(_RECIPIENT_SLOT) != address(0)
                || receiver.canAcceptTransfer();
        }
    }

    function registry() public view returns (IGmxRegistryV1) {
        return IGMXIsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistry();
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
    // ======================== Internal Functions ======================
    // ==================================================================

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei
    ) internal override {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);

        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        IGLPIsolationModeTokenVaultV2(glpVault).sweepGmxTokensIntoGmxVault();
    }

    function _swapExactInputForOutput(
        SwapExactInputForOutputParams memory _params
    ) internal override {
        super._swapExactInputForOutput(_params);

        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        IGLPIsolationModeTokenVaultV2(glpVault).sweepGmxTokensIntoGmxVault();
    }

    // ==================================================================
    // ======================== Private Functions =======================
    // ==================================================================

    function _stakeGmx(uint256 _amount) private {
        address glpVault = registry().glpVaultFactory().getVaultByAccount(OWNER());
        assert(glpVault != address(0));

        IERC20 gmx = IERC20(registry().gmx());
        gmx.safeApprove(glpVault, _amount);
        IGLPIsolationModeTokenVaultV2(glpVault).stakeGmx(_amount);
    }

    function _confirmAccountTransfer(address _glpVault, uint256 _gmxValue, uint256 _glpValue) private {
        Require.that(
            isVaultFrozen(),
            _FILE,
            "Transfer not in progress"
        );

        address recipient = _getAddress(_RECIPIENT_SLOT);
        // Set the recipient to 0x0 here, so we can call `_stakeGmx`
        _setAddress(_RECIPIENT_SLOT, address(0));

        uint256 balance = super.underlyingBalanceOf();
        if (balance > 0) {
            _stakeGmx(balance);
        }

        if (_gmxValue > 0) {
            _setShouldSkipTransfer(true);
            _setUint256(_TEMP_BALANCE_SLOT, _gmxValue);
            _withdrawFromVaultForDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, _gmxValue);
            assert(!shouldSkipTransfer());
        }

        IGLPIsolationModeTokenVaultV2(_glpVault).signalAccountTransfer(_glpValue);
        emit AccountTransferSignaled(recipient);
    }

    function _cancelAccountTransfer(address _glpVault) private {
        Require.that(
            isVaultFrozen(),
            _FILE,
            "Transfer not in progress"
        );
        _setAddress(_RECIPIENT_SLOT, address(0));

        IGLPIsolationModeTokenVaultV2(_glpVault).cancelAccountTransfer();

        uint256 tempBalance = _getUint256(_TEMP_BALANCE_SLOT);
        if (tempBalance > 0) {
            Require.that(
                underlyingBalanceOf() >= tempBalance,
                _FILE,
                "Invalid underlying balance of"
            );
            _setShouldSkipTransfer(true);
            _setUint256(_TEMP_BALANCE_SLOT, 0);
            _depositIntoVaultForDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, tempBalance);
            assert(!shouldSkipTransfer());
        }
        emit AccountTransferCanceled();
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) private {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }

    function _setIsDepositSourceGLPVault(bool _isDepositSourceGLPVault) private {
        _setUint256(_IS_DEPOSIT_SOURCE_GLP_VAULT, _isDepositSourceGLPVault ? 1 : 0);
    }
}
