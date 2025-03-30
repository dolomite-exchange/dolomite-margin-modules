// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.8.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.9;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { DolomiteERC4626 } from "./DolomiteERC4626.sol";
import { IDolomiteERC4626WithPayable } from "../interfaces/IDolomiteERC4626WithPayable.sol";
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
 * @title   DolomiteERC4626WithPayable
 * @author  Dolomite
 *
 * @dev Implementation of the {IERC20} interface that wraps around a user's Dolomite Balance.
 */
contract DolomiteERC4626WithPayable is
    IDolomiteERC4626WithPayable,
    DolomiteERC4626
{
    using AccountActionLib for IDolomiteMargin;
    using Address for address payable;
    using DolomiteMarginMath for uint256;
    using InterestIndexLib for IDolomiteMargin;
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "DolomiteERC4626WithPayable";

    uint256 private constant _DEFAULT_ACCOUNT_NUMBER = 0;

    constructor (
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) DolomiteERC4626(_dolomiteRegistry, _dolomiteMargin) {}

    function depositFromPayable(address _receiver) external nonReentrant payable returns (uint256) {
        if (msg.value > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.value > 0,
            _FILE,
            "Invalid amount"
        );
        if (isValidReceiver(_receiver)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidReceiver(_receiver),
            _FILE,
            "Invalid receiver",
            _receiver
        );

        IWETH(asset()).deposit{ value: msg.value }();
        IWETH(asset()).approve(address(DOLOMITE_MARGIN()), msg.value);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _receiver,
            number: _DEFAULT_ACCOUNT_NUMBER
        });
        IDolomiteStructs.Par memory balanceBeforePar = dolomiteMargin.getAccountPar(account, marketId());

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

        IDolomiteStructs.Par memory deltaPar = dolomiteMargin.getAccountPar(account, marketId()).sub(balanceBeforePar);
        /*assert(deltaPar.sign);*/
        /*assert(deltaPar.value != 0);*/

        emit Transfer(address(0), _receiver, deltaPar.value);
        emit Deposit(msg.sender, _receiver, msg.value, deltaPar.value);

        return deltaPar.value;
    }

    function withdrawToPayable(
        uint256 _amount,
        address _receiver,
        address _owner
    ) external nonReentrant returns (uint256) {
        if (_amount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _amount > 0,
            _FILE,
            "Invalid amount"
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN();
        IDolomiteStructs.AccountInfo memory account = IDolomiteStructs.AccountInfo({
            owner: _owner,
            number: _DEFAULT_ACCOUNT_NUMBER
        });

        IDolomiteStructs.Par memory balanceBeforePar = dolomiteMargin.getAccountPar(account, marketId());

        if (msg.sender != _owner) {
            if (balanceBeforePar.sign) { /* FOR COVERAGE TESTING */ }
            Require.that(
                balanceBeforePar.sign,
                _FILE,
                "Balance cannot be negative"
            );

            _spendAllowance(_owner, msg.sender, convertToShares(_amount));
        }

        IDolomiteStructs.AssetAmount memory assetAmount = IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: _amount
        });
        dolomiteMargin.withdraw(
            account.owner,
            account.number,
            /* _toAccount = */ address(this),
            marketId(),
            assetAmount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );

        IDolomiteStructs.Par memory deltaPar = balanceBeforePar.sub(dolomiteMargin.getAccountPar(account, marketId()));
        /*assert(deltaPar.sign);*/

        IWETH(asset()).withdraw(_amount);
        payable(_receiver).sendValue(_amount);

        emit Transfer(_owner, address(0), deltaPar.value);
        emit Withdraw(msg.sender, _receiver, _owner, _amount, deltaPar.value);

        return deltaPar.value;
    }

    function redeemToPayable(
        uint256 _dAmount,
        address _receiver,
        address _owner
    ) external nonReentrant returns (uint256) {
        if (_dAmount > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _dAmount > 0,
            _FILE,
            "Invalid amount"
        );
        if (isValidReceiver(_receiver)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            isValidReceiver(_receiver),
            _FILE,
            "Invalid receiver",
            _receiver
        );

        if (msg.sender != _owner) {
            _spendAllowance(_owner, msg.sender, _dAmount);
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

        IDolomiteStructs.Wei memory deltaWei = balanceBeforeWei.sub(dolomiteMargin.getAccountWei(account, marketId()));
        /*assert(deltaWei.sign);*/

        IWETH(asset()).withdraw(deltaWei.value);
        payable(_receiver).sendValue(deltaWei.value);

        emit Transfer(_owner, address(0), _dAmount);
        emit Withdraw(msg.sender, _receiver, _owner, deltaWei.value, _dAmount);

        return deltaWei.value;
    }
}
