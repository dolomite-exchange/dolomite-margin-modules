// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { OnlyDolomiteMarginForUpgradeable } from "../helpers/OnlyDolomiteMarginForUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "../helpers/ReentrancyGuardUpgradeable.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteERC20 } from "../interfaces/IDolomiteERC20.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   DolomiteERC20
 * @author  Dolomite
 *
 * @dev Implementation of the {IERC20} interface that wraps around a user's Dolomite Balance.
 */
contract DolomiteERC20 is
    IDolomiteERC20,
    Initializable,
    ProxyContractHelpers,
    ReentrancyGuardUpgradeable,
    OnlyDolomiteMarginForUpgradeable
{
    using AccountActionLib for IDolomiteMargin;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "DolomiteERC20";

    bytes32 private constant _METADATA_SLOT = bytes32(uint256(keccak256("eip1967.proxy.metadata")) - 1);
    bytes32 private constant _ALLOWANCES_SLOT = bytes32(uint256(keccak256("eip1967.proxy.allowances")) - 1);
    /// @dev mapping containing users that may receive token transfers
    bytes32 private constant _VALID_RECEIVERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.validReceivers")) - 1);
    bytes32 private constant _MARKET_ID_SLOT = bytes32(uint256(keccak256("eip1967.proxy.marketId")) - 1);
    bytes32 private constant _UNDERLYING_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.underlyingToken")) - 1);

    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

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
        _setAddress(_UNDERLYING_TOKEN_SLOT, DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));
    }

    function initializeVersion2() external reinitializer(2) {
        __ReentrancyGuardUpgradeable__init();
    }

    function ownerSetIsReceiver(address _receiver, bool _isEnabled) external onlyDolomiteMarginOwner(msg.sender) {
        _enableReceiver(_receiver, _isEnabled);
    }

    function enableIsReceiver() external {
        _enableReceiver(msg.sender, /* _isEnabled = */ true);
    }

    function mint(uint256 _amount) external nonReentrant returns (uint256) {
        if (_amount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _amount > 0,
            _FILE,
            "Invalid amount"
        );

        _enableReceiver(msg.sender, /* _isEnabled = */ true);
        _enableReceiver(tx.origin, /* _isEnabled = */ true);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Par memory balanceBefore = dolomiteMargin.getAccountPar(account, marketId());

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            value: _amount,
            ref: IDolomiteStructs.AssetReference.Delta,
            denomination: IDolomiteStructs.AssetDenomination.Wei
        });
        dolomiteMargin.deposit(
            account.owner,
            account.owner,
            account.number,
            marketId(),
            assetAmount
        );

        IDolomiteStructs.Par memory delta = dolomiteMargin.getAccountPar(account, marketId()).sub(balanceBefore);
        /*assert(delta.sign);*/

        emit Transfer(address(0), msg.sender, delta.value);

        return delta.value;
    }

    function redeem(uint256 _dAmount) external nonReentrant returns (uint256) {
        if (_dAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dAmount > 0,
            _FILE,
            "Invalid amount"
        );

        _enableReceiver(msg.sender, /* _isEnabled = */ true);
        _enableReceiver(tx.origin, /* _isEnabled = */ true);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Wei memory balanceBefore = dolomiteMargin.getAccountWei(account, marketId());

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Par,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _dAmount
        });
        dolomiteMargin.withdraw(
            account.owner,
            account.number,
            account.owner,
            marketId(),
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );

        IDolomiteStructs.Wei memory delta = balanceBefore.sub(dolomiteMargin.getAccountWei(account, marketId()));
        /*assert(delta.sign);*/

        emit Transfer(msg.sender, address(0), _dAmount);

        return delta.value;
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
        _enableReceiver(msg.sender, /* _isEnabled = */ true);
        _enableReceiver(tx.origin, /* _isEnabled = */ true);
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
        _enableReceiver(msg.sender, /* _isEnabled = */ true);
        _enableReceiver(tx.origin, /* _isEnabled = */ true);
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
        _enableReceiver(msg.sender, /* _isEnabled = */ true);
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
        return _getUint256FromMap(_VALID_RECEIVERS_SLOT, _receiver) == 1;
    }

    function marketId() public view returns (uint256) {
        return _getUint256(_MARKET_ID_SLOT);
    }

    function underlyingToken() public view returns (address) {
        return _getAddress(_UNDERLYING_TOKEN_SLOT);
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return DOLOMITE_MARGIN().getMarketTotalPar(marketId()).supply;
    }

    function unscaledTotalSupply() public view returns (uint256) {
        IDolomiteStructs.Par memory totalSupplyPar = IDolomiteStructs.Par({
            sign: true,
            value: totalSupply().to128()
        });
        return DOLOMITE_MARGIN().parToWei(marketId(), totalSupplyPar).value;
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
     * @notice Same thing as `balanceOf` but returns the user's balance with interest accrued
     */
    function unscaledBalanceOf(address _account) public view override returns (uint256) {
        IDolomiteStructs.Par memory balancePar = IDolomiteStructs.Par({
            sign: true,
            value: balanceOf(_account).to128()
        });
        return DOLOMITE_MARGIN().parToWei(marketId(), balancePar).value;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return _getUint256InNestedMap(_ALLOWANCES_SLOT, _owner, _spender);
    }

    /**
     * @dev Sets the following `_receiver` is enabled or not.
     */
    function _enableReceiver(address _receiver, bool _isEnabled) internal {
        bool previousValue = _getUint256FromMap(_VALID_RECEIVERS_SLOT, _receiver) == 1;
        if (previousValue == _isEnabled) {
            // No need to redundantly set storage and emit an event
            return;
        }
        _setUint256InMap(_VALID_RECEIVERS_SLOT, _receiver, _isEnabled ? 1 : 0);
        emit LogSetReceiver(_receiver, _isEnabled);
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
        require(
            _from != address(0),
            "ERC20: Transfer from the zero address"
        );
        require(
            _to != address(0),
            "ERC20: Transfer to the zero address"
        );
        require(
            balanceOf(_from) >= _amount,
            "ERC20: Transfer amount exceeds balance"
        );
        require(
            isValidReceiver(_to),
            "ERC20: Transfers can only be made to valid receivers"
        );

        DOLOMITE_MARGIN().transfer(
            _from,
            _DEFAULT_ACCOUNT_NUMBER,
            _to,
            _DEFAULT_ACCOUNT_NUMBER,
            marketId(),
            IDolomiteStructs.AssetDenomination.Par,
            _amount,
            AccountBalanceLib.BalanceCheckFlag.From
        );

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
        require(
            _owner != address(0),
            "ERC20: Approve from the zero address"
        );
        require(
            _spender != address(0),
            "ERC20: Approve to the zero address"
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
        uint256 currentAllowance = allowance(_owner, _spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= _amount,
                "ERC20: Insufficient allowance"
            );
            unchecked {
                _approve(_owner, _spender, currentAllowance - _amount);
            }
        }
    }

    function _setMetadataStruct(MetadataStruct memory _metadata) internal {
        MetadataStruct storage metadata = _getMetadataSlot();
        metadata.name = _metadata.name;
        metadata.symbol = _metadata.symbol;
        metadata.decimals = _metadata.decimals;
    }

    function _getMetadataSlot() internal pure returns (MetadataStruct storage metadata) {
        bytes32 slot = _METADATA_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            metadata.slot := slot
        }
    }
}
