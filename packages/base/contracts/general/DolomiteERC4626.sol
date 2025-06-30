// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { IDolomiteOwner } from "@dolomite-exchange/modules-admin/contracts/interfaces/IDolomiteOwner.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { ReentrancyGuardUpgradeable } from "../helpers/ReentrancyGuardUpgradeable.sol";
import { IDolomiteERC4626 } from "../interfaces/IDolomiteERC4626.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteMarginAdmin } from "../protocol/interfaces/IDolomiteMarginAdmin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";


/**
 * @title   DolomiteERC4626
 * @author  Dolomite
 *
 * @dev Implementation of the {IERC4626} interface that wraps around a user's Dolomite Balance.
 */
contract DolomiteERC4626 is
    IDolomiteERC4626,
    Initializable,
    ProxyContractHelpers,
    ReentrancyGuardUpgradeable,
    OnlyDolomiteMargin
{
    using AccountActionLib for IDolomiteMargin;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;
    using DolomiteMarginVersionWrapperLib for IDolomiteMargin;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "DolomiteERC4626";

    bytes32 private constant _ASSET_SLOT = bytes32(uint256(keccak256("eip1967.proxy.asset")) - 1);
    bytes32 private constant _ALLOWANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.allowances")) - 1);
    /// @dev mapping containing users that may receive token transfers
    bytes32 private constant _MARKET_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.marketId")) - 1);
    bytes32 private constant _METADATA_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metadata")) - 1);

    uint256 public immutable CHAIN_ID; // solhint-disable-line var-name-mixedcase
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase
    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    uint256 private constant _FROM_ACCOUNT_ID = 0;
    uint256 private constant _THIS_ACCOUNT_ID = 1;
    uint256 private constant _TO_ACCOUNT_ID = 2;
    uint256 private constant _DOLOMITE_MARGIN_OWNER_ACCOUNT_ID = 3;

    // ==================================================================
    // ========================== Initializer ===========================
    // ==================================================================

    constructor (
        uint256 _chainId,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        CHAIN_ID = _chainId;
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    function initialize(
        string calldata _name,
        string calldata _symbol,
        uint8 _decimals,
        uint256 _marketId
    ) external initializer {
        MetadataStruct memory metadata = MetadataStruct({
            name: _name,
            symbol: _symbol,
            decimals: _decimals
        });
        _setMetadataStruct(metadata);

        _setUint256(_MARKET_ID_SLOT, _marketId);
        _setAddress(_ASSET_SLOT, DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));

        __ReentrancyGuardUpgradeable__init();
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function deposit(uint256 _assets, address _receiver) external nonReentrant returns (uint256) {
        Require.that(
            _assets > 0,
            _FILE,
            "Invalid amount"
        );
        Require.that(
            isValidReceiver(_receiver),
            _FILE,
            "Invalid receiver",
            _receiver
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _receiver,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Par memory balanceBeforePar = dolomiteMargin.getAccountPar(account, marketId());
        Require.that(
            balanceBeforePar.value == 0 || balanceBeforePar.sign,
            _FILE,
            "Balance cannot be negative"
        );

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            value: _assets,
            ref: IDolomiteStructs.AssetReference.Delta,
            denomination: IDolomiteStructs.AssetDenomination.Wei
        });
        _depositIntoDolomite(account, assetAmount, _assets, dolomiteMargin);

        IDolomiteStructs.Par memory deltaPar = dolomiteMargin.getAccountPar(account, marketId()).sub(balanceBeforePar);
        assert(deltaPar.sign);
        assert(deltaPar.value != 0);

        emit Transfer(address(0), _receiver, deltaPar.value);
        emit Deposit(msg.sender, _receiver, _assets, deltaPar.value);

        return deltaPar.value;
    }

    function mint(uint256 _shares, address _receiver) external nonReentrant returns (uint256) {
        Require.that(
            _shares > 0,
            _FILE,
            "Invalid amount"
        );
        Require.that(
            isValidReceiver(_receiver),
            _FILE,
            "Invalid receiver",
            _receiver
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        uint256 _marketId = marketId();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _receiver,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Wei memory balanceBeforeWei;
        uint256 assets;
        {
            // For avoiding "stack too deep" errors
            IDolomiteStructs.Par memory balanceBeforePar = dolomiteMargin.getAccountPar(account, _marketId);
            IDolomiteStructs.Par memory deltaPar = _toPar(/* _sign */ true, _shares);
            IDolomiteStructs.Par memory balanceAfterPar = balanceBeforePar.add(deltaPar);
            balanceBeforeWei = dolomiteMargin.parToWei(_marketId, balanceBeforePar);

            IDolomiteStructs.Wei memory balanceAfterWei = DOLOMITE_MARGIN().parToWei(_marketId, balanceAfterPar);
            assert(balanceAfterWei.sub(balanceBeforeWei).sign);
            assets = balanceAfterWei.sub(balanceBeforeWei).value;
        }

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            value: _shares,
            ref: IDolomiteStructs.AssetReference.Delta,
            denomination: IDolomiteStructs.AssetDenomination.Par
        });
        _depositIntoDolomite(account, assetAmount, assets, dolomiteMargin);

        IDolomiteStructs.Wei memory deltaWei = dolomiteMargin.getAccountWei(account, _marketId).sub(balanceBeforeWei);
        assert(deltaWei.sign);
        assert(deltaWei.value != 0);

        emit Transfer(address(0), _receiver, _shares);
        emit Deposit(msg.sender, _receiver, assets, _shares);

        return deltaWei.value;
    }

    function withdraw(uint256 _assets, address _receiver, address _owner) external nonReentrant returns (uint256) {
        Require.that(
            _assets > 0,
            _FILE,
            "Invalid amount"
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _owner,
            number: _DEFAULT_ACCOUNT_NUMBER
        });

        IDolomiteStructs.Par memory balanceBeforePar = dolomiteMargin.getAccountPar(account, marketId());

        if (_owner != msg.sender) {
            Require.that(
                balanceBeforePar.sign,
                _FILE,
                "Balance cannot be negative"
            );

            _spendAllowance(_owner, msg.sender, convertToShares(_assets));
        }

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _assets
        });
        dolomiteMargin.withdraw(
            account.owner,
            account.number,
            _receiver,
            marketId(),
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );

        IDolomiteStructs.Par memory deltaPar = balanceBeforePar.sub(dolomiteMargin.getAccountPar(account, marketId()));
        assert(deltaPar.sign);
        assert(deltaPar.value != 0);

        emit Transfer(_owner, address(0), deltaPar.value);
        emit Withdraw(msg.sender, _receiver, _owner, _assets, deltaPar.value);

        return deltaPar.value;
    }

    function redeem(uint256 _shares, address _receiver, address _owner) external nonReentrant returns (uint256) {
        Require.that(
            _shares > 0,
            _FILE,
            "Invalid amount"
        );
        if (msg.sender != _owner) {
            _spendAllowance(_owner, msg.sender, _shares);
        }

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _owner,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Wei memory balanceBeforeWei = dolomiteMargin.getAccountWei(account, marketId());

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _shares
        });
        dolomiteMargin.withdraw(
            account.owner,
            account.number,
            _receiver,
            marketId(),
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );

        IDolomiteStructs.Wei memory deltaWei = balanceBeforeWei.sub(dolomiteMargin.getAccountWei(account, marketId()));
        assert(deltaWei.sign);

        emit Transfer(_owner, address(0), _shares);
        emit Withdraw(msg.sender, _receiver, _owner, deltaWei.value, _shares);

        return deltaWei.value;
    }

    // ==================================================================
    // ======================== Public Functions ========================
    // ==================================================================

    function previewDeposit(uint256 _assets) external view returns (uint256) {
        return convertToShares(_assets);
    }

    function previewMint(uint256 _shares) external view returns (uint256) {
        return convertToAssets(_shares);
    }

    function previewWithdraw(uint256 _assets) external view returns (uint256) {
        return convertToShares(_assets);
    }

    function previewRedeem(uint256 _shares) external view returns (uint256) {
        return convertToAssets(_shares);
    }

    function maxDeposit(address /* _receiver */) external view returns (uint256) {
        uint256 maxWei = DOLOMITE_MARGIN().getMarketMaxWei(marketId()).value;
        if (maxWei == 0) {
            return type(uint256).max;
        }

        uint256 assets = totalAssets();
        return maxWei < assets ? 0 : maxWei - assets;
    }

    function maxMint(address /* _receiver */) external view returns (uint256) {
        IDolomiteStructs.Wei memory maxWei = DOLOMITE_MARGIN().getMarketMaxWei(marketId());
        if (maxWei.value == 0) {
            return type(uint256).max;
        }

        uint256 maxPar = DOLOMITE_MARGIN().weiToPar(marketId(), maxWei).value;
        uint256 supply = totalSupply();
        return maxPar < supply ? 0 : maxPar - supply;
    }

    function maxWithdraw(address _owner) external view returns (uint256) {
        IDolomiteStructs.Par memory balancePar = _toPar(/* _sign */ true, balanceOf(_owner));
        return DOLOMITE_MARGIN().parToWei(marketId(), balancePar).value;
    }

    function maxRedeem(address _owner) external view returns (uint256) {
        return balanceOf(_owner);
    }

    function convertToShares(uint256 _assets) public view returns (uint256) {
        IDolomiteStructs.Wei memory amountWei = IDolomiteStructs.Wei({
            sign: true,
            value: _assets
        });
        return DOLOMITE_MARGIN().weiToPar(marketId(), amountWei).value;
    }

    function convertToAssets(uint256 _shares) public view returns (uint256) {
        IDolomiteStructs.Par memory amountPar = _toPar(/* _sign */ true, _shares);
        return DOLOMITE_MARGIN().parToWei(marketId(), amountPar).value;
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `_amount`.
     */
    function transfer(address _to, uint256 _amount) public override returns (bool) {
        address owner = msg.sender;
        _transfer(owner, _to, _amount);
        return true;
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `_amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `_spender` cannot be the zero address.
     */
    function approve(address _spender, uint256 _amount) public override returns (bool) {
        address owner = msg.sender;
        _approve(owner, _spender, _amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `_amount`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `_amount`.
     */
    function transferFrom(
        address from,
        address to,
        uint256 _amount
    ) public override returns (bool) {
        address _spender = msg.sender;
        _spendAllowance(from, _spender, _amount);
        _transfer(from, to, _amount);
        return true;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view override returns (string memory) {
        return _getMetadataSlot().name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view override returns (string memory) {
        return _getMetadataSlot().symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless this function is
     * overridden;
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view override returns (uint8) {
        return _getMetadataSlot().decimals;
    }

    function isValidReceiver(address _receiver) public view returns (bool) {
        return !DOLOMITE_REGISTRY.dolomiteAccountRegistry().isAccountInRegistry(_receiver);
    }

    function marketId() public view returns (uint256) {
        return _getUint256(_MARKET_ID_SLOT);
    }

    function asset() public view returns (address) {
        return _getAddress(_ASSET_SLOT);
    }

    function totalAssets() public view returns (uint256) {
        IDolomiteStructs.Par memory totalSupplyPar = _toPar(/* _sign = */ true, totalSupply());
        return DOLOMITE_MARGIN().parToWei(marketId(), totalSupplyPar).value;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return DOLOMITE_MARGIN().getMarketTotalPar(marketId()).supply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address _account) public view override returns (uint256) {
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: _account,
            number: 0
        });
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(accountInfo, marketId());
        if (!balancePar.sign) {
            return 0;
        }

        return balancePar.value;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return _getUint256InNestedMap(_ALLOWANCES_SLOT, _owner, _spender);
    }

    /**
     * @dev Moves `_amount` of tokens from `_from` to `_to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `_from` cannot be the zero address.
     * - `_to` cannot be the zero address.
     * - `_from` must have a balance of at least `_amount`.
     * - `_to` must be a valid receiver.
     */
    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        Require.that(
            _from != address(0),
            _FILE,
            "Transfer from the zero address"
        );
        Require.that(
            _to != address(0),
            _FILE,
            "Transfer to the zero address"
        );
        Require.that(
            _to != address(this),
            _FILE,
            "Transfer to this contract"
        );
        Require.that(
            balanceOf(_from) >= _amount,
            _FILE,
            "Transfer amount exceeds balance"
        );
        Require.that(
            isValidReceiver(_to),
            _FILE,
            "Invalid receiver",
            _to
        );

        uint256 actionsCursor = 0;
        uint256 _marketId = marketId();
        bool isLossy = _getIsLossy(_from, _to, _amount);
        bool dolomiteOwnerZeroBalance = _isOwnerBalanceZeroOrNegative();

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(_from, _to, isLossy);

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](
            _getActionsLength(isLossy, dolomiteOwnerZeroBalance)
        );
        actionsCursor = _appendTransferActions(actions, actionsCursor, _amount);

        uint256 maxSupplyWeiBefore = _handleIsLossy(
            actions,
            actionsCursor,
            isLossy,
            dolomiteOwnerZeroBalance
        );

        DOLOMITE_MARGIN().operate(accounts, actions);

        AccountBalanceLib.verifyBalanceIsNonNegative(
            DOLOMITE_MARGIN(),
            accounts[_FROM_ACCOUNT_ID].owner,
            accounts[_FROM_ACCOUNT_ID].number,
            _marketId
        );
        AccountBalanceLib.verifyBalanceIsNonNegative(
            DOLOMITE_MARGIN(),
            accounts[_TO_ACCOUNT_ID].owner,
            accounts[_TO_ACCOUNT_ID].number,
            _marketId
        );

        if (isLossy) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                DOLOMITE_MARGIN(),
                accounts[_DOLOMITE_MARGIN_OWNER_ACCOUNT_ID].owner,
                accounts[_DOLOMITE_MARGIN_OWNER_ACCOUNT_ID].number,
                _marketId
            );
        }

        assert(IERC20(asset()).allowance(address(this), address(DOLOMITE_MARGIN())) == 0);

        if (maxSupplyWeiBefore != 0) {
            _ownerSetMaxSupplyWei(maxSupplyWeiBefore, _marketId);
        }

        emit Transfer(_from, _to, _amount);
    }

    /**
     * @dev Sets `_amount` as the allowance of `_spender` over the `_owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `_owner` cannot be the zero address.
     * - `_spender` cannot be the zero address.
     */
    function _approve(
        address _owner,
        address _spender,
        uint256 _amount
    ) internal {
        Require.that(
            _owner != address(0),
            _FILE,
            "Approve from the zero address"
        );
        Require.that(
            _spender != address(0),
            _FILE,
            "Approve to the zero address"
        );

        _setUint256InNestedMap(_ALLOWANCES_SLOT, _owner, _spender, _amount);
        emit Approval(_owner, _spender, _amount);
    }

    /**
     * @dev Updates `_owner` s allowance for `_spender` based on spent `_amount`.
     *
     * Does not update the allowance amount in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Might emit an {Approval} event.
     */
    function _spendAllowance(
        address _owner,
        address _spender,
        uint256 _amount
    ) internal {
        assert(_amount > 0);
        uint256 currentAllowance = allowance(_owner, _spender);
        if (currentAllowance != type(uint256).max) {
            Require.that(
                currentAllowance >= _amount,
                _FILE,
                "Insufficient allowance"
            );
            unchecked {
                _approve(_owner, _spender, currentAllowance - _amount);
            }
        }
    }

    function _depositIntoDolomite(
        IDolomiteStructs.AccountInfo memory _account,
        IDolomiteStructs.AssetAmount memory _assetAmount,
        uint256 _assets,
        IDolomiteMargin _dolomiteMargin
    ) internal {
        IERC20 underlyingToken = IERC20(asset());
        underlyingToken.safeTransferFrom(msg.sender, address(this), _assets);
        underlyingToken.safeApprove(address(_dolomiteMargin), _assets);
        _dolomiteMargin.deposit(
            _account.owner,
            address(this),
            _account.number,
            marketId(),
            _assetAmount
        );
        assert(underlyingToken.allowance(address(this), address(_dolomiteMargin)) == 0);
    }

    function _ownerWithdrawExcessTokens() internal {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            abi.encodeWithSelector(
                IDolomiteMarginAdmin.ownerWithdrawExcessTokens.selector,
                marketId(),
                address(this)
            )
        );
    }

    function _ownerSetMaxSupplyWei(uint256 _maxSupplyWei, uint256 _marketId) internal {
        IDolomiteOwner(DOLOMITE_MARGIN_OWNER()).submitTransactionAndExecute(
            address(DOLOMITE_MARGIN()),
            DolomiteMarginVersionWrapperLib.encodeVersionedOwnerSetMaxSupplyWei(
                CHAIN_ID,
                _marketId,
                _maxSupplyWei
            )
        );
    }

    function _getAccounts(
        address _from,
        address _to,
        bool _isLossy
    ) internal view returns (IDolomiteStructs.AccountInfo[] memory) {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](_isLossy ? 4 : 3);

        accounts[_FROM_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _from,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        accounts[_THIS_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: address(this),
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        accounts[_TO_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: _to,
            number: _DEFAULT_ACCOUNT_NUMBER
        });

        if (_isLossy) {
            accounts[_DOLOMITE_MARGIN_OWNER_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
                owner: DOLOMITE_MARGIN_OWNER(),
                number: _DEFAULT_ACCOUNT_NUMBER
            });
        }

        return accounts;
    }

    function _getActionsLength(bool _isLossy, bool _dolomiteOwnerZeroBalance) internal pure returns (uint256) {
        if (_isLossy && _dolomiteOwnerZeroBalance) {
            return 4;
        } else if (_isLossy) {
            return 3;
        } else {
            return 2;
        }
    }

    /**
     * @return  The max supply wei before the update occurred. 0 if it was unchanged or was "unlimited" beforehand.
     */
    function _handleIsLossy(
        IDolomiteStructs.ActionArgs[] memory _actions,
        uint256 _actionsCursor,
        bool _isLossy,
        bool _dolomiteOwnerZeroBalance
    ) internal returns (uint256) {
        if (!_isLossy) {
            return 0;
        }

        // transfer from dolomite margin owner to dToken. primaryAccount is dToken
        // if dolomite margin owner does not have enough funds, do a withdrawExcessTokens and deposit
        uint256 _marketId = marketId();
        IDolomiteStructs.AssetAmount memory transferAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: 1
        });
        _actions[_actionsCursor++] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Transfer,
            accountId: _THIS_ACCOUNT_ID,
            amount: transferAmount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: _DOLOMITE_MARGIN_OWNER_ACCOUNT_ID,
            data: bytes("")
        });

        if (!_dolomiteOwnerZeroBalance) {
            return 0;
        }

        uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
        _ownerWithdrawExcessTokens();
        uint256 excessTokens = IERC20(asset()).balanceOf(address(this)) - balanceBefore;

        IDolomiteStructs.AssetAmount memory depositAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: excessTokens
        });
        _actions[_actionsCursor++] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Deposit,
            accountId: _DOLOMITE_MARGIN_OWNER_ACCOUNT_ID,
            amount: depositAmount,
            primaryMarketId: _marketId,
            secondaryMarketId: _marketId,
            otherAddress: address(this),
            otherAccountId: 0,
            data: bytes("")
        });

        IERC20(asset()).safeApprove(address(DOLOMITE_MARGIN()), excessTokens);

        IDolomiteStructs.Wei memory maxSupplyWei = DOLOMITE_MARGIN().getVersionedMaxSupplyWei(CHAIN_ID, _marketId);
        if (!maxSupplyWei.isZero()) {
            uint256 remainingSupplyAvailable = _getRemainingSupplyAvailable(maxSupplyWei, _marketId);

            if (excessTokens > remainingSupplyAvailable) {
                // Increase the supply cap temporarily so the admin can deposit
                _ownerSetMaxSupplyWei(0, _marketId);
                return maxSupplyWei.value;
            }
        }

        return 0;
    }

    function _appendTransferActions(
        IDolomiteStructs.ActionArgs[] memory _actions,
        uint256 _actionsCursor,
        uint256 _amount
    ) internal view returns (uint256) {
        uint256 _marketId = marketId();

        IDolomiteStructs.AssetAmount memory assetAmount0 = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _amount
        });
        _actions[_actionsCursor++] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Transfer,
            accountId: _FROM_ACCOUNT_ID,
            amount: assetAmount0,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: _THIS_ACCOUNT_ID,
            data: bytes("")
        });

        IDolomiteStructs.AssetAmount memory assetAmount1 = IDolomiteStructs.AssetAmount({
            sign: true,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _amount
        });
        _actions[_actionsCursor++] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Transfer,
            accountId: _TO_ACCOUNT_ID,
            amount: assetAmount1,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: _THIS_ACCOUNT_ID,
            data: bytes("")
        });

        return _actionsCursor;
    }

    function _isOwnerBalanceZeroOrNegative() internal view returns (bool) {
        IDolomiteStructs.Par memory dolomiteOwnerPar = DOLOMITE_MARGIN().getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: DOLOMITE_MARGIN_OWNER(),
                number: _DEFAULT_ACCOUNT_NUMBER
            }),
            marketId()
        );

        return dolomiteOwnerPar.isZero() || !dolomiteOwnerPar.sign;
    }

    function _getRemainingSupplyAvailable(
        IDolomiteStructs.Wei memory _maxSupplyWei,
        uint256 _marketId
    ) internal view returns (uint256) {
        assert(_maxSupplyWei.isPositive());

        IDolomiteStructs.Par memory supplyPar = DOLOMITE_MARGIN().getVersionedSupplyPar(CHAIN_ID, _marketId);

        return _maxSupplyWei.sub(DOLOMITE_MARGIN().parToWei(_marketId, supplyPar)).value;
    }

    /**
     * @return  True if the transfer will make `address(this)` go negative due to a rounding error
     */
    function _getIsLossy(address _from, address _to, uint256 _amount) internal view returns (bool) {
        // Step 1:  we transfer par from 0 to 1. account[1] their par balance is set using `setParFromDeltaWei`
        // Step 2:  we need to calculate account[1] new balance using `setParFromDeltaWei` after we get the delta wei
        //          from doing the second transfer
        // Step 3:  needsVaporize = `!account[1].par.sign && account[1].par.value != 0` then we know we need to vaporize
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.Par memory deltaPar = _toPar(/* _sign = */ true, _amount);

        // @dev Calculate the first delta wei
        IDolomiteStructs.Par memory fromPar = dolomiteMargin.getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _from,
                number: _DEFAULT_ACCOUNT_NUMBER
            }),
            marketId()
        );
        IDolomiteStructs.Wei memory fromWei = dolomiteMargin.parToWei(marketId(), fromPar);
        IDolomiteStructs.Wei memory deltaWei1 = fromWei.sub(dolomiteMargin.parToWei(marketId(), fromPar.sub(deltaPar)));

        // @dev Calculate the second delta wei
        IDolomiteStructs.Par memory toPar = dolomiteMargin.getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: _to,
                number: _DEFAULT_ACCOUNT_NUMBER
            }),
            marketId()
        );
        IDolomiteStructs.Wei memory toWei = dolomiteMargin.parToWei(marketId(), toPar);
        IDolomiteStructs.Wei memory deltaWei2 = dolomiteMargin.parToWei(marketId(), toPar.add(deltaPar)).sub(toWei);

        IDolomiteStructs.Par memory finalPar = dolomiteMargin.weiToPar(marketId(), deltaWei1.sub(deltaWei2));

        return finalPar.value != 0;
    }

    function _setMetadataStruct(MetadataStruct memory _metadata) internal {
        MetadataStruct storage metadata = _getMetadataSlot();
        metadata.name = _metadata.name;
        metadata.symbol = _metadata.symbol;
        metadata.decimals = _metadata.decimals;
    }

    function _toPar(bool _sign, uint256 _value) internal pure returns (IDolomiteStructs.Par memory) {
        return IDolomiteStructs.Par({
            sign: _sign,
            value: _value.to128()
        });
    }

    function _getMetadataSlot() internal pure returns (MetadataStruct storage metadata) {
        bytes32 slot = _METADATA_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            metadata.slot := slot
        }
    }
}
