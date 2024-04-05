// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteERC20 } from "../interfaces/IDolomiteERC20.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";


/**
 * @title   DolomiteERC20
 * @author  Dolomite
 *
 * @dev Implementation of the {IERC20} interface that wraps around a user's Dolomite Balance.
 */
contract DolomiteERC20 is IDolomiteERC20, OnlyDolomiteMargin {
    using AccountActionLib for IDolomiteMargin;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;

    mapping(address => mapping(address => uint256)) private _allowances;

    /// @dev mapping containing users that may receive token transfers
    mapping(address => bool) private _validReceivers;

    // strings cannot be immutable
    string private _NAME; // solhint-disable-line var-name-mixedcase
    string private _SYMBOL; // solhint-disable-line var-name-mixedcase
    uint8 private immutable _DECIMALS; // strings cannot be immutable

    uint256 public immutable MARKET_ID; // strings cannot be immutable
    address public immutable UNDERLYING_TOKEN; // strings cannot be immutable

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _marketId,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        _NAME = _name;
        _SYMBOL = _symbol;
        _DECIMALS = _decimals;

        MARKET_ID = _marketId;
        UNDERLYING_TOKEN = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
    }

    function ownerSetIsReceiver(address _receiver, bool _isEnabled) external onlyDolomiteMarginOwner(msg.sender) {
        _enableReceiver(_receiver, _isEnabled);
    }

    function enableIsReceiver() external {
        _enableReceiver(msg.sender, true);
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
        _enableReceiver(msg.sender, /* _isEnabled = */ true);
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
        return _NAME;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view override returns (string memory) {
        return _SYMBOL;
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
        return _DECIMALS;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return DOLOMITE_MARGIN().getMarketTotalPar(MARKET_ID).supply;
    }

    function unscaledTotalSupply() public view returns (uint256) {
        IDolomiteStructs.Par memory totalSupplyPar = IDolomiteStructs.Par({
            sign: true,
            value: totalSupply().to128()
        });
        return DOLOMITE_MARGIN().parToWei(MARKET_ID, totalSupplyPar).value;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address _account) public view override returns (uint256) {
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: _account,
            number: 0
        });
        IDolomiteStructs.Par memory balancePar = DOLOMITE_MARGIN().getAccountPar(accountInfo, MARKET_ID);
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
        return DOLOMITE_MARGIN().parToWei(MARKET_ID, balancePar).value;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return _allowances[_owner][_spender];
    }

    /**
     * @dev Sets the following `_receiver` is enabled or not.
     */
    function _enableReceiver(address _receiver, bool _isEnabled) internal {
        _validReceivers[_receiver] = _isEnabled;
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
            _validReceivers[_to],
            "ERC20: Transfers can only be made to valid receivers"
        );

        DOLOMITE_MARGIN().transfer(
            _from,
            /* _fromAccountNumber = */ 0,
            _to,
            /* _toAccountNumber = */ 0,
            MARKET_ID,
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

        _allowances[_owner][_spender] = _amount;
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
}
