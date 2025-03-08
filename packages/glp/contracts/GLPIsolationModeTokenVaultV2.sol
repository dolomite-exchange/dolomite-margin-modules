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
import { IsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezable.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";
import { IGMXIsolationModeTokenVaultV1 } from "./interfaces/IGMXIsolationModeTokenVaultV1.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "./interfaces/IGmxRewardRouterV2.sol";
import { IGmxRewardTracker } from "./interfaces/IGmxRewardTracker.sol";
import { IGmxVester } from "./interfaces/IGmxVester.sol";
import { ISGMX } from "./interfaces/ISGMX.sol";
// solhint-enable max-line-length


/**
 * @title   GLPIsolationModeTokenVaultV2
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that holds the sGLP token that can be used to
 *          to credit a user's Dolomite balance. sGLP held in the vault is considered to be in isolation mode - that is
 *          it cannot be borrowed by other users, may only be seized via liquidation, and cannot be held in the same
 *          position as other "isolated" tokens.
 */
contract GLPIsolationModeTokenVaultV2 is
    IGLPIsolationModeTokenVaultV2,
    IsolationModeTokenVaultV1WithFreezable
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

        _stakeGmx(_gmx, _amount);
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
        address _receiver,
        uint256 _glpBalance
    ) external onlyGmxVault(msg.sender) {
        if (_glpBalance > 0) {
            _setShouldSkipTransfer(true);
            _setUint256(_TEMP_BALANCE_SLOT, _glpBalance);
            _withdrawFromVaultForDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, _glpBalance);
            assert(!shouldSkipTransfer());
        } else {
            _setUint256(_TEMP_BALANCE_SLOT, 0);
        }

        gmx().approve(address(sGmx()), type(uint256).max);
        gmxRewardsRouter().signalTransfer(_receiver);
    }

    function cancelAccountTransfer() external onlyGmxVault(msg.sender) {
        if (IGMXIsolationModeTokenVaultV1(msg.sender).isVaultFrozen()) {
            gmx().approve(address(sGmx()), 0);
            gmxRewardsRouter().signalTransfer(address(0));

            uint256 tempBal = _getUint256(_TEMP_BALANCE_SLOT);
            if (tempBal > 0) {
                Require.that(
                    underlyingBalanceOf() >= tempBal,
                    _FILE,
                    "Invalid underlying balance of"
                );

                _setShouldSkipTransfer(true);
                _setUint256(_TEMP_BALANCE_SLOT, 0);
                _depositIntoVaultForDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, tempBal);
                assert(!shouldSkipTransfer());
            }
        }
    }

    function acceptFullAccountTransfer(
        address _sender
    )
    external
    override
    nonReentrant
    requireNotFrozen
    onlyVaultOwnerOrVaultFactory(msg.sender) {
        Require.that(
            _sender != address(0),
            _FILE,
            "Invalid sender"
        );
        Require.that(
            !hasAcceptedFullAccountTransfer() && underlyingBalanceOf() == 0 && gmxBalanceOf() == 0,
            _FILE,
            "Cannot transfer more than once"
        );

        gmxRewardsRouter().acceptTransfer(_sender);

        // set this flag so we don't materialize the transfer. This is needed because the assets are spot settled in
        // this vault via the call to #acceptTransfer
        _setIsAcceptingFullAccountTransfer(true);

        // the amount of fsGLP being deposited is the current balance of fsGLP, since we should have started at 0.
        uint256 amountWei = underlyingBalanceOf();
        IIsolationModeVaultFactory(VAULT_FACTORY()).depositIntoDolomiteMargin(_DEFAULT_ACCOUNT_NUMBER, amountWei);

        if (hasSynced()) {
            uint256 amountGmx = gmxBalanceOf();
            address gmxVault = registry().gmxVaultFactory().getVaultByAccount(OWNER());
            assert(gmxVault != address(0));

            _depositIntoGMXVault(gmxVault, _DEFAULT_ACCOUNT_NUMBER, amountGmx, /* shouldSkipTransfer = */ true);
        } else {
            // This will automatically sync the balances
            getGmxVaultOrCreate();
        }

        // reset the flag back to false
        _setIsAcceptingFullAccountTransfer(false);

        // set this flag so we don't allow full account transfers again
        _setHasAcceptedFullAccountTransfer(true);
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
        _depositIntoGMXVault(
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
        address gmxVault = getGmxVaultOrCreate();
        Require.that(
            (!_shouldClaimWeth && !_shouldDepositWethIntoDolomite) || _shouldClaimWeth,
            _FILE,
            "Can only deposit ETH if claiming"
        );
        Require.that(
            !(!_shouldClaimGmx && _shouldStakeGmx),
            _FILE,
            "Can only stake GMX if claiming"
        );

        IERC20 _gmx = gmx();
        if (_shouldStakeGmx) {
            // we don't know how much GMX will be staked, so we have to approve all
            _approveGmxForStaking(_gmx, type(uint256).max);
        }

        uint256 stakedGmxBalanceBefore = gmxBalanceOf();
        gmxRewardsRouter().handleRewards(
            _shouldClaimGmx,
            _shouldStakeGmx,
            _shouldClaimEsGmx,
            _shouldStakeEsGmx,
            _shouldStakeMultiplierPoints,
            _shouldClaimWeth,
            /* _shouldConvertWethToEth = */ false
        );
        uint256 stakedGmxBalanceDelta = gmxBalanceOf() - stakedGmxBalanceBefore;

        if (_shouldStakeGmx) {
            // we can reset the allowance back to 0 here
            _approveGmxForStaking(_gmx, /* _amount = */ 0);
        }

        if (_shouldClaimGmx) {
            uint256 unstakedGmxBalance = _gmx.balanceOf(address(this));
            _gmx.safeApprove(address(DOLOMITE_MARGIN()), unstakedGmxBalance);
            IGLPIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                _DEFAULT_ACCOUNT_NUMBER,
                DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_gmx)),
                unstakedGmxBalance
            );
            _depositIntoGMXVault(
                gmxVault,
                _DEFAULT_ACCOUNT_NUMBER,
                stakedGmxBalanceDelta,
                /* shouldSkipTransfer = */ true
            );
        }

        if (_shouldClaimWeth) {
            address factory = VAULT_FACTORY();
            address weth = IGLPIsolationModeVaultFactory(factory).WETH();
            uint256 wethAmountWei = IERC20(weth).balanceOf(address(this));
            if (_shouldDepositWethIntoDolomite) {
                IERC20(weth).safeApprove(address(DOLOMITE_MARGIN()), wethAmountWei);
                IIsolationModeVaultFactory(factory).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                    _depositAccountNumberForWeth,
                    IGLPIsolationModeVaultFactory(factory).WETH_MARKET_ID(),
                    wethAmountWei
                );
            } else {
                IERC20(weth).safeTransfer(msg.sender, wethAmountWei);
            }
        }
    }

    function _stakeGmx(IERC20 _gmx, uint256 _amount) internal {
        _approveGmxForStaking(_gmx, _amount);
        gmxRewardsRouter().stakeGmx(_amount);
    }

    function _vestEsGmx(IGmxVester _vester, uint256 _esGmxAmount) internal {
        _vester.deposit(_esGmxAmount);
    }

    function _unvestEsGmx(IGmxVester _vester, bool _shouldStakeGmx, bool _addDepositIntoDolomite) internal {
        address gmxVault = getGmxVaultOrCreate();

        _vester.withdraw();
        IERC20 _gmx = gmx();
        uint256 balance = _gmx.balanceOf(address(this));

        if (_addDepositIntoDolomite && balance > 0) {
            if (_shouldStakeGmx) {
                _depositIntoGMXVault(gmxVault, _DEFAULT_ACCOUNT_NUMBER, balance, /* shouldSkipTransfer = */ true);
                _stakeGmx(_gmx, balance);
            } else {
                _gmx.safeApprove(address(DOLOMITE_MARGIN()), balance);
                IGLPIsolationModeVaultFactory(VAULT_FACTORY()).depositOtherTokenIntoDolomiteMarginForVaultOwner(
                    _DEFAULT_ACCOUNT_NUMBER,
                    DOLOMITE_MARGIN().getMarketIdByTokenAddress(address(_gmx)),
                    balance
                );
            }
        }
    }

    function _approveGmxForStaking(IERC20 _gmx, uint256 _amount) internal {
        address _sGmx = address(sGmx());
        uint256 allowance = _gmx.allowance(address(this), _sGmx);
        if (_amount > 0 && allowance > 0) {
            // reset the allowance to 0 if the approval is greater than zero and there is a non-zero allowance
            _gmx.safeApprove(_sGmx, 0);
        }

        _gmx.safeApprove(_sGmx, _amount);
    }

    function _sync(address _gmxVault) internal {
        Require.that(
            _getUint256(_HAS_SYNCED) == 0,
            _FILE,
            "Already synced"
        );
        _setUint256(_HAS_SYNCED, 1);

        // Skip the transfer since we're depositing staked GMX tokens
        _depositIntoGMXVault(_gmxVault, _DEFAULT_ACCOUNT_NUMBER, gmxBalanceOf(), /* shouldSkipTransfer = */ true);
    }

    function _depositIntoGMXVault(
        address _gmxVault,
        uint256 _accountNumber,
        uint256 _amountWei,
        bool _shouldSkipTransfer
    ) internal {
        if (_amountWei == 0) {
            return;
        }

        if (!_shouldSkipTransfer) {
            gmx().safeApprove(_gmxVault, _amountWei);
        }
        registry().gmxVaultFactory().executeDepositIntoVaultFromGLPVault(
            _gmxVault,
            _accountNumber,
            _amountWei,
            _shouldSkipTransfer
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
        uint256 _amountWei
    ) internal override {
        super._withdrawFromVaultForDolomiteMargin(_fromAccountNumber, _amountWei);

        // Sweep any GMX tokens that are sent to this vault from unvesting GLP
        _depositIntoGMXVault(
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
