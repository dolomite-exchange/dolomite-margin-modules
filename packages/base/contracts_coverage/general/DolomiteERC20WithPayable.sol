// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { DolomiteERC20 } from "./DolomiteERC20.sol";
import { IDolomiteERC20WithPayable } from "../interfaces/IDolomiteERC20WithPayable.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { InterestIndexLib } from "../lib/InterestIndexLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../protocol/interfaces/IWETH.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";


/**
 * @title   DolomiteERC20WithPayable
 * @author  Dolomite
 *
 * @dev Implementation of the {IERC20} interface that wraps around a user's Dolomite Balance.
 */
contract DolomiteERC20WithPayable is
    IDolomiteERC20WithPayable,
    DolomiteERC20
{
    using AccountActionLib for IDolomiteMargin;
    using Address for address payable;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "DolomiteERC20WithPayable";

    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    IWETH private immutable _WETH;

    constructor(address _weth) {
        _WETH = IWETH(_weth);
    }

    function mintFromPayable() external nonReentrant payable returns (uint256) {
        if (msg.value > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.value > 0,
            _FILE,
            "Invalid amount"
        );

        _WETH.deposit{ value: msg.value }();
        _WETH.approve(address(DOLOMITE_MARGIN()), msg.value);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: msg.sender,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Par memory balanceBefore = dolomiteMargin.getAccountPar(account, marketId());

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: true,
            value: msg.value,
            ref: IDolomiteStructs.AssetReference.Delta,
            denomination: IDolomiteStructs.AssetDenomination.Wei
        });
        dolomiteMargin.deposit(
            account.owner,
            /* _fromAccount = */ address(this),
            account.number,
            marketId(),
            assetAmount
        );

        IDolomiteStructs.Par memory delta = dolomiteMargin.getAccountPar(account, marketId()).sub(balanceBefore);
        /*assert(delta.sign);*/

        emit Transfer(address(0), msg.sender, delta.value);

        return delta.value;
    }

    function redeemToPayable(uint256 _dAmount) external nonReentrant returns (uint256) {
        if (_dAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dAmount > 0,
            _FILE,
            "Invalid amount"
        );

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
            /* _toAccount = */ address(this),
            marketId(),
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );

        IDolomiteStructs.Wei memory delta = balanceBefore.sub(dolomiteMargin.getAccountWei(account, marketId()));
        /*assert(delta.sign);*/

        _WETH.withdraw(delta.value);
        payable(msg.sender).sendValue(delta.value);

        emit Transfer(msg.sender, address(0), _dAmount);

        return delta.value;
    }
}
