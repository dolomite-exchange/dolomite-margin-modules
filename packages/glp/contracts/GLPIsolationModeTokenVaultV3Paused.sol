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
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { GLPActionsLib } from "./GLPActionsLib.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "./interfaces/IGmxRewardRouterV2.sol";
import { IGmxRewardTracker } from "./interfaces/IGmxRewardTracker.sol";
import { IGmxVester } from "./interfaces/IGmxVester.sol";
import { ISGMX } from "./interfaces/ISGMX.sol";
// solhint-enable max-line-length


/**
 * @title   GLPIsolationModeTokenVaultV3Paused
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPIsolationModeTokenVaultV3Paused is
    IGLPIsolationModeTokenVaultV2,
    IsolationModeTokenVaultV1WithFreezableAndPausable
{
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GLPIsolationModeTokenVaultV2";
    bytes32 private constant _TEMP_BALANCE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.tempBalance")) - 1);
    bytes32 private constant _SHOULD_SKIP_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.shouldSkipTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.isAcceptingFullAccountTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.hasAcceptedFullAccountTransfer")) - 1); // solhint-disable-line max-line-length
    bytes32 private constant _HAS_SYNCED = bytes32(uint256(keccak256("eip1967.proxy.hasSynced")) - 1);
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    modifier onlyGmxVault(address _sender) {
        Require.that(
            OWNER() == registry().gmxVaultFactory().getAccountByVault(_sender),
            _FILE,
            "Invalid GMX vault"
        );
        _;
    }

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite
    )
    external
    override
    nonReentrant
    requireNotFrozen
    onlyVaultOwner(msg.sender) {
        _handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldDepositWethIntoDolomite,
            /* _depositAccountNumberForWeth = */ _DEFAULT_ACCOUNT_NUMBER
        );
    }

    function handleRewardsWithSpecificDepositAccountNumber(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    )
    external
    override
    nonReentrant
    requireNotFrozen
    onlyVaultOwner(msg.sender) {
        _handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldDepositWethIntoDolomite,
            _depositAccountNumberForWeth
        );
    }

    function stakeGmx(uint256 _amount) external override requireNotFrozen onlyGmxVault(msg.sender) {
        IERC20 _gmx = gmx();
        _gmx.safeTransferFrom(msg.sender, address(this), _amount);

        GLPActionsLib.stakeGmx(/* _vault */ this, _gmx, address(sGmx()), _amount);
    }

    function unstakeGmx(uint256 _amount) external override requireNotFrozen onlyGmxVault(msg.sender) {
        gmxRewardsRouter().unstakeGmx(_amount);

        gmx().safeTransfer(msg.sender, _amount);
    }

    function stakeEsGmx(uint256 _amount) external override requireNotFrozen onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().stakeEsGmx(_amount);
    }

    function unstakeEsGmx(uint256 _amount) external override requireNotFrozen onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeEsGmx(_amount);
    }

    function signalAccountTransfer(
        address /* _receiver */,
        uint256 /* _glpBalance */
    ) external view onlyGmxVault(msg.sender) {
        revert("Paused");
    }

    function cancelAccountTransfer() external view onlyGmxVault(msg.sender) {
        revert("Paused");
    }

    function acceptFullAccountTransfer(
        address /* _sender */
    )
    external
    override
    nonReentrant
    requireNotFrozen
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        revert("Paused");
    }

    function vestGlp(uint256 _esGmxAmount) external override requireNotFrozen onlyVaultOwner(msg.sender) {
        _vestEsGmx(vGlp(), _esGmxAmount);
    }

    function unvestGlp(bool _shouldStakeGmx) external override requireNotFrozen onlyVaultOwner(msg.sender) {
        _unvestEsGmx(vGlp(), _shouldStakeGmx, true);
    }

    function vestGmx(uint256 _esGmxAmount) external override requireNotFrozen onlyGmxVault(msg.sender) {
        _vestEsGmx(vGmx(), _esGmxAmount);
    }

    function unvestGmx(
        bool _shouldStakeGmx,
        bool _addDepositIntoDolomite
    ) external override requireNotFrozen onlyGmxVault(msg.sender) {
        _unvestEsGmx(vGmx(), _shouldStakeGmx, _addDepositIntoDolomite);
    }

    function sweepGmxTokensIntoGmxVault() external requireNotFrozen onlyGmxVault(msg.sender) {
        GLPActionsLib.depositIntoGMXVault(
            /* _vault = */ this,
            /* _gmxVault = */ msg.sender,
            /* _accountNumber = */ _DEFAULT_ACCOUNT_NUMBER,
            /* _amountWei = */ gmx().balanceOf(address(this)),
            /* _shouldSkipTransfer = */ false
        );
    }

    function sync(address _gmxVault) external requireNotFrozen {
        Require.that(
            msg.sender == address(registry().gmxVaultFactory()),
            _FILE,
            "Only GMX factory can sync",
            msg.sender
        );
        _sync(_gmxVault);
    }

    function maxGmxUnstakeAmount() external requireNotFrozen onlyGmxVault(msg.sender) returns (uint256) {
        uint256 bnGmxAmount = _claimAndStakeBnGmx();
        uint256 sbfGmxBalance = IERC20(sbfGmx()).balanceOf(address(this));
        uint256 totalStakedBalance = sGmx().stakedAmounts(address(this)); // staked-GMX + staked-esGMX total balance
        uint256 stakedGmxBalance = gmxBalanceOf(); // staked-GMX balance

        uint256 calculatedMaxAmount = totalStakedBalance * sbfGmxBalance / (totalStakedBalance + bnGmxAmount);
        return Math.min(stakedGmxBalance, calculatedMaxAmount);
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function getGmxVaultOrCreate() public returns (address) {
        address account = OWNER();
        address gmxVault = registry().gmxVaultFactory().getVaultByAccount(account);
        if (gmxVault == address(0)) {
            gmxVault = registry().gmxVaultFactory().createVault(account);
        }
        return gmxVault;
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
            return;
        }

        if (isAcceptingFullAccountTransfer()) {
            // The fsGLP is already in this vault, so don't materialize a transfer from the vault owner
            assert(_amount == underlyingBalanceOf());
        } else {
            sGlp().safeTransferFrom(_from, address(this), _amount);
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

        if (super.underlyingBalanceOf() < _amount) {
            // There's not enough value in the vault to cover the withdrawal, so we need to withdraw from vGLP
            vGlp().withdraw();
        }

        assert(_recipient != address(this));
        // we can't use the fsGLP because it's not transferable. sGLP contains the authorization and logic for
        // transferring fsGLP tokens.
        sGlp().safeTransfer(_recipient, _amount);
    }

    function isExternalRedemptionPaused() public override pure returns (bool) {
        // Always return true for now while GLP/GMX is exploited
        return true;
    }

    function isVaultFrozen() public view override returns (bool) {
        address gmxVault = registry().gmxVaultFactory().getVaultByAccount(OWNER());
        return gmxVault == address(0) ? false : IIsolationModeTokenVaultV1WithFreezable(gmxVault).isVaultFrozen();
    }

    function esGmx() public view returns (IERC20) {
        return IERC20(registry().esGmx());
    }

    function gmxRewardsRouter() public view returns (IGmxRewardRouterV2) {
        return registry().gmxRewardsRouter();
    }

    function shouldSkipTransfer() public view returns (bool) {
        return _getUint256(_SHOULD_SKIP_TRANSFER_SLOT) == 1;
    }

    function underlyingBalanceOf() public view override returns (uint256) {
        return vGlp().pairAmounts(address(this)) + super.underlyingBalanceOf();
    }

    function gmxBalanceOf() public view returns (uint256) {
        address account = address(this);
        // sGmx reflects the amount of GMX tokens the user owns. The `depositBalances` mapping isn't updated when the
        // sbfGMX tokens are transferred to the vGMX vesting contract, so this seems reliable. Moreover, this contract
        // only holds staked-GMX tokens, which is why we only check the sGMX contract. sGMX reflects any sbfGMX that is
        // moved into vGMX vesting too.
        return sGmx().depositBalances(account, address(gmx()));
    }

    function esGmxBalanceOf() public view returns (uint256) {
        IERC20 _esGmx = esGmx();
        address account = address(this);
        // We need to pull the esGMX being held here, in the vesting contracts for GMX and GLP, and being staked in the
        // sGMX contract
        return _esGmx.balanceOf(account)
            + vGmx().balanceOf(account)
            + vGlp().balanceOf(account)
            + sGmx().depositBalances(account, address(_esGmx));
    }

    function getGlpAmountNeededForEsGmxVesting(uint256 _esGmxAmount) public view returns (uint256) {
        return _getPairAmountNeededForEsGmxVesting(vGlp(), _esGmxAmount);
    }

    function getGmxAmountNeededForEsGmxVesting(uint256 _esGmxAmount) public view returns (uint256) {
        return _getPairAmountNeededForEsGmxVesting(vGmx(), _esGmxAmount);
    }

    function gmx() public view returns (IERC20) {
        return IERC20(registry().gmx());
    }

    function sGlp() public view returns (IERC20) {
        return IERC20(registry().sGlp());
    }

    function sGmx() public view returns (ISGMX) {
        return ISGMX(registry().sGmx());
    }

    function sbfGmx() public view returns (address) {
        return registry().sbfGmx();
    }

    function vGlp() public view returns (IGmxVester) {
        return IGmxVester(registry().vGlp());
    }

    function vGmx() public view returns (IGmxVester) {
        return IGmxVester(registry().vGmx());
    }

    function isAcceptingFullAccountTransfer() public view returns (bool) {
        return _getUint256(_IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT) == 1;
    }

    function hasAcceptedFullAccountTransfer() public view returns (bool) {
        return _getUint256(_HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT) == 1;
    }

    function hasSynced() public view returns (bool) {
        return _getUint256(_HAS_SYNCED) == 1;
    }

    function registry() public view returns (IGmxRegistryV1) {
        return IGLPIsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistry();
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
    // ======================= Internal Functions =======================
    // ==================================================================

    function _claimAndStakeBnGmx() internal virtual returns (uint256) {
        _handleRewards(
            /* _shouldClaimGmx = */ false,
            /* _shouldStakeGmx = */ false,
            /* _shouldClaimEsGmx = */ false,
            /* _shouldStakeEsGmx = */ false,
            /* _shouldStakeMultiplierPoints = */ true,
            /* _shouldClaimWeth = */ false,
            /* _shouldDepositWethIntoDolomite = */ false,
            _DEFAULT_ACCOUNT_NUMBER
        );

        address bnGmx = registry().bnGmx();
        return IGmxRewardTracker(registry().sbfGmx()).depositBalances(address(this), bnGmx);
    }

    function _handleRewards(
        bool _shouldClaimGmx,
        bool _shouldStakeGmx,
        bool _shouldClaimEsGmx,
        bool _shouldStakeEsGmx,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldDepositWethIntoDolomite,
        uint256 _depositAccountNumberForWeth
    ) internal {
        GLPActionsLib.handleRewards(
            /* _vault = */ this,
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            _shouldDepositWethIntoDolomite,
            _depositAccountNumberForWeth
        );
    }

    function _vestEsGmx(IGmxVester _vester, uint256 _esGmxAmount) internal {
        _vester.deposit(_esGmxAmount);
    }

    function _unvestEsGmx(IGmxVester _vester, bool _shouldStakeGmx, bool _addDepositIntoDolomite) internal {
        GLPActionsLib.unvestEsGmx(
            /* _vault = */ this,
            _vester,
            _shouldStakeGmx,
            _addDepositIntoDolomite
        );
    }

    function _sync(address _gmxVault) internal {
        Require.that(
            _getUint256(_HAS_SYNCED) == 0,
            _FILE,
            "Already synced"
        );
        _setUint256(_HAS_SYNCED, 1);

        // Skip the transfer since we're depositing staked GMX tokens
        GLPActionsLib.depositIntoGMXVault(
            /* _vault = */ this,
            _gmxVault,
            _DEFAULT_ACCOUNT_NUMBER,
            gmxBalanceOf(),
            /* shouldSkipTransfer = */ true
        );
    }

    function _setIsAcceptingFullAccountTransfer(bool _isAcceptingFullAccountTransfer) internal {
        _setUint256(_IS_ACCEPTING_FULL_ACCOUNT_TRANSFER_SLOT, _isAcceptingFullAccountTransfer ? 1 : 0);
    }

    function _setHasAcceptedFullAccountTransfer(bool _hasAcceptingFullAccountTransfer) internal {
        _setUint256(_HAS_ACCEPTED_FULL_ACCOUNT_TRANSFER_SLOT, _hasAcceptingFullAccountTransfer ? 1 : 0);
    }

    function _withdrawFromVaultForDolomiteMargin(
        uint256 _fromAccountNumber,
        uint256 _amountWei,
        bool _isViaRouter
    ) internal override {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei, _isViaRouter);

        // Sweep any GMX tokens that are sent to this vault from unvesting GLP
        GLPActionsLib.depositIntoGMXVault(
            /* _vault = */ this,
            getGmxVaultOrCreate(),
            _DEFAULT_ACCOUNT_NUMBER,
            gmx().balanceOf(address(this)),
            /* shouldSkipTransfer = */ false
        );
    }

    // ==================================================================
    // ======================== Private Functions =======================
    // ==================================================================

    function _getPairAmountNeededForEsGmxVesting(
        IGmxVester _vester,
        uint256 _esGmxAmount
    ) private view returns (uint256) {
        address account = address(this);
        uint256 pairAmount = _vester.pairAmounts(account);
        uint256 nextPairAmount = _vester.getPairAmount(account, _esGmxAmount + _vester.balanceOf(account));
        if (nextPairAmount > pairAmount) {
            return nextPairAmount - pairAmount;
        } else {
            return 0;
        }
    }

    function _setShouldSkipTransfer(bool _shouldSkipTransfer) private {
        _setUint256(_SHOULD_SKIP_TRANSFER_SLOT, _shouldSkipTransfer ? 1 : 0);
    }
}
