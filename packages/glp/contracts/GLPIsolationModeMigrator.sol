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

// solhint-disable max-line-length
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol";
import { IsolationModeTokenVaultV1WithFreezableAndPausable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1WithFreezableAndPausable.sol";
import { IIsolationModeTokenVaultV1WithFreezable } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeTokenVaultV1WithFreezable.sol";
import { IIsolationModeVaultFactory } from "@dolomite-exchange/modules-base/contracts/isolation-mode/interfaces/IIsolationModeVaultFactory.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { GLPActionsLib } from "./GLPActionsLib.sol";
import { IGLPIsolationModeTokenVaultV2 } from "./interfaces/IGLPIsolationModeTokenVaultV2.sol";
import { IGLPIsolationModeVaultFactory } from "./interfaces/IGLPIsolationModeVaultFactory.sol";
import { IGMXIsolationModeTokenVaultV1 } from "./interfaces/IGMXIsolationModeTokenVaultV1.sol";
import { IGmxRegistryV1 } from "./interfaces/IGmxRegistryV1.sol";
import { IGmxRewardRouterV2 } from "./interfaces/IGmxRewardRouterV2.sol";
import { IGmxRewardTracker } from "./interfaces/IGmxRewardTracker.sol";
import { IGmxVester } from "./interfaces/IGmxVester.sol";
import { ISGMX } from "./interfaces/ISGMX.sol";
import { ReentrancyGuardUpgradeable } from "@dolomite-exchange/modules-base/contracts/helpers/ReentrancyGuardUpgradeable.sol";
import { IDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IGenericTraderProxyV2 } from "@dolomite-exchange/modules-base/contracts/proxies/interfaces/IGenericTraderProxyV2.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IBorrowPositionProxyV2 } from "@dolomite-exchange/modules-base/contracts/interfaces/IBorrowPositionProxyV2.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
// solhint-enable max-line-length


/**
 * @title   GLPIsolationModeMigrator
 * @author  Dolomite
 *
 * @notice  Implementation (for an upgradeable proxy) for a per-user vault that allows a handler to exit GLP by selling
 *          the current GLP position. The unwrapper trader will sell GLP and claim the USDC redemption. This implementation
 *          is designed to not brick the existing GMX token vaults
 */
contract GLPIsolationModeMigrator is ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "GLPIsolationModeMigrator";
    bytes32 private constant _OWNER_SLOT = bytes32(uint256(keccak256("eip1967.proxy.owner")) - 1);
    bytes32 private constant _VAULT_FACTORY_SLOT = bytes32(uint256(keccak256("eip1967.proxy.vaultFactory")) - 1);
    bytes32 private constant _HAS_SYNCED = bytes32(uint256(keccak256("eip1967.proxy.hasSynced")) - 1);
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    address public immutable HANDLER;
    address public immutable USDC;

    // ==================================================================
    // =========================== Modifiers ============================
    // ==================================================================

    modifier onlyGmxVault(address _sender) {
        Require.that(
            OWNER() == registry().gmxVaultFactory().getAccountByVault(_sender),
            _FILE,
            "Invalid GMX vault"
        );
        _;
    }
    
    modifier requireNotFrozen() {
        Require.that(
            !isVaultFrozen(),
            _FILE,
            "Vault is frozen"
        );
        _;
    }

    modifier onlyVaultOwner(address _sender) {
        Require.that(
            OWNER() == _sender,
            _FILE,
            "Only vault owner can call"
        );
        _;
    }

    modifier onlyVaultFactory(address _sender) {
        Require.that(
            VAULT_FACTORY() == _sender,
            _FILE,
            "Only vault factory can call"
        );
        _;
    }

    modifier onlyHandler(address _sender) {
        Require.that(
            _sender == HANDLER,
            _FILE,
            "Only handler can call"
        );
        _;
    }

    // ==================================================================
    // ========================== Constructor ===========================
    // ==================================================================

    constructor(address _handler, address _usdc) {
        HANDLER = _handler;
        USDC = _usdc;
    }

    // ==================================================================
    // ======================== Handler Functions =======================
    // ==================================================================

    /**
     * Handler function to unwind a GLP position
     * 
     * @param   _tradeAccountNumber  The account number to use for the trade
     * @param   _marketIdsPath       The market IDs to use for the trade
     * @param   _inputAmountWei      The amount of GLP to unwrap
     * @param   _minOutputAmountWei  The minimum amount of USDC to receive
     * @param   _tradersPath         The traders to use for the trade
     * @param   _makerAccounts       The maker accounts to use for the trade
     * @param   _userConfig          The user config to use for the trade
     */
    function handlerUnwrapGLP(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyV2.TraderParam[] memory _tradersPath,
        IDolomiteMargin.AccountInfo[] memory _makerAccounts,
        IGenericTraderProxyV2.UserConfig memory _userConfig
    ) external onlyHandler(msg.sender) {
        Require.that(
            _marketIdsPath.length == 2,
            _FILE,
            "Invalid marketIdsPath"
        );
        Require.that(
            _marketIdsPath[0] == DOLOMITE_MARGIN().getMarketIdByTokenAddress(VAULT_FACTORY()),
            _FILE,
            "Invalid marketIdsPath"
        );
        Require.that(
            _marketIdsPath[1] == DOLOMITE_MARGIN().getMarketIdByTokenAddress(USDC),
            _FILE,
            "Invalid marketIdsPath"
        );
        
        _tradersPath[0].tradeData = abi.encode(address(this), _tradeAccountNumber);
        dolomiteRegistry().genericTraderProxy().swapExactInputForOutput(
            IGenericTraderProxyV2.SwapExactInputForOutputParams({
                accountNumber: _tradeAccountNumber,
                marketIdsPath: _marketIdsPath,
                inputAmountWei: _inputAmountWei,
                minOutputAmountWei: _minOutputAmountWei,
                tradersPath: _tradersPath,
                makerAccounts: _makerAccounts,
                userConfig: _userConfig
            })
        );

        if (_tradeAccountNumber == _DEFAULT_ACCOUNT_NUMBER) {
            IDolomiteStructs.Wei memory usdcBalance = DOLOMITE_MARGIN().getAccountWei(
                IDolomiteStructs.AccountInfo({
                    owner: address(this),
                    number: _tradeAccountNumber
                }),
                _marketIdsPath[1]
            );
            BORROW_POSITION_PROXY().transferBetweenAccountsWithDifferentAccounts(
                address(this),
                _tradeAccountNumber,
                OWNER(),
                _DEFAULT_ACCOUNT_NUMBER,
                _marketIdsPath[1],
                usdcBalance.value,
                AccountBalanceLib.BalanceCheckFlag.From
            );
        }
    }

    // ==================================================================
    // ========================= Owner Functions ========================
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

    function stakeEsGmx(uint256 _amount) external requireNotFrozen onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().stakeEsGmx(_amount);
    }

    function unstakeEsGmx(uint256 _amount) external requireNotFrozen onlyVaultOwner(msg.sender) {
        gmxRewardsRouter().unstakeEsGmx(_amount);
    }

    function unvestGlp(bool _shouldStakeGmx) external requireNotFrozen onlyVaultOwner(msg.sender) {
        _unvestEsGmx(vGlp(), _shouldStakeGmx, true);
    }

    // ==================================================================
    // ======================= GMX Vault Functions ======================
    // ==================================================================

    function stakeGmx(uint256 _amount) external requireNotFrozen onlyGmxVault(msg.sender) {
        IERC20 _gmx = gmx();
        _gmx.safeTransferFrom(msg.sender, address(this), _amount);

        _stakeGmx(_gmx, _amount);
    }

    function unstakeGmx(uint256 _amount) external requireNotFrozen onlyGmxVault(msg.sender) {
        gmxRewardsRouter().unstakeGmx(_amount);

        gmx().safeTransfer(msg.sender, _amount);
    }

    function vestGmx(uint256 _esGmxAmount) external requireNotFrozen onlyGmxVault(msg.sender) {
        _vestEsGmx(vGmx(), _esGmxAmount);
    }

    function unvestGmx(
        bool _shouldStakeGmx,
        bool _addDepositIntoDolomite
    ) external requireNotFrozen onlyGmxVault(msg.sender) {
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

    function sync(address _gmxVault) external requireNotFrozen {
        Require.that(
            msg.sender == address(registry().gmxVaultFactory()),
            _FILE,
            "Only GMX factory can sync",
            msg.sender
        );
        _sync(_gmxVault);
    }

    function executeWithdrawalFromVault(
        address _recipient,
        uint256 _amount
    )
    public
    onlyVaultFactory(msg.sender) {
        if (IERC20(UNDERLYING_TOKEN()).balanceOf(address(this)) < _amount) {
            // There's not enough value in the vault to cover the withdrawal, so we need to withdraw from vGLP
            vGlp().withdraw();
        }

        assert(_recipient != address(this));
        // we can't use the fsGLP because it's not transferable. sGLP contains the authorization and logic for
        // transferring fsGLP tokens.
        sGlp().safeTransfer(_recipient, _amount);
    }

    // ==================================================================
    // ========================= View Functions =========================
    // ==================================================================

    function isVaultFrozen() public view returns (bool) {
        address gmxVault = registry().gmxVaultFactory().getVaultByAccount(OWNER());
        return gmxVault == address(0) ? false : IIsolationModeTokenVaultV1WithFreezable(gmxVault).isVaultFrozen();
    }

    function esGmx() public view returns (IERC20) {
        return IERC20(registry().esGmx());
    }

    function gmxRewardsRouter() public view returns (IGmxRewardRouterV2) {
        return registry().gmxRewardsRouter();
    }

    function underlyingBalanceOf() public view returns (uint256) {
        return vGlp().pairAmounts(address(this)) + IERC20(UNDERLYING_TOKEN()).balanceOf(address(this));
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

    function hasSynced() public view returns (bool) {
        return _getUint256(_HAS_SYNCED) == 1;
    }

    function registry() public view returns (IGmxRegistryV1) {
        return IGLPIsolationModeVaultFactory(VAULT_FACTORY()).gmxRegistry();
    }

    function dolomiteRegistry()
        public
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function DOLOMITE_MARGIN() public view returns (IDolomiteMargin) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).DOLOMITE_MARGIN();
    }

    function BORROW_POSITION_PROXY() public view returns (IBorrowPositionProxyV2) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).BORROW_POSITION_PROXY();
    }

    function VAULT_FACTORY() public view returns (address) {
        return _getAddress(_VAULT_FACTORY_SLOT);
    }

    function OWNER() public view returns (address) {
        return _getAddress(_OWNER_SLOT);
    }

    function UNDERLYING_TOKEN() public view returns (address) {
        return IIsolationModeVaultFactory(VAULT_FACTORY()).UNDERLYING_TOKEN();
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
            /* _vault = */ IGLPIsolationModeTokenVaultV2(address(this)),
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

    function _stakeGmx(IERC20 _gmx, uint256 _amount) internal {
        GLPActionsLib.approveGmxForStaking(_gmx, address(sGmx()), _amount);
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
}
