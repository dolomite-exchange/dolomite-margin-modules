pragma solidity ^0.8.13;

import { Test } from "forge-std/Test.sol";

import { IDolomiteStructs } from "../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IDolomiteMargin } from "../../contracts/protocol/interfaces/IDolomiteMargin.sol";

abstract contract DolomiteAssertions is Test {

    // =============================================
    // ============ Dolomite Assertions ============
    // =============================================

    function assertProtocolBalanceWei(
        IDolomiteMargin _dolomiteMargin,
        address _account,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _expectedAmount,
        bool _expectedSign
    ) public view returns (uint256) {
        return assertProtocolBalanceWei(
            _dolomiteMargin,
            _account,
            _accountNumber,
            _marketId,
            _expectedAmount,
            _expectedSign,
            /* _marginOfErrorWei */ 0
        );
    }

    function assertProtocolBalancePar(
        IDolomiteMargin _dolomiteMargin,
        address _account,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _expectedAmount,
        bool _expectedSign
    ) public view {
        IDolomiteStructs.AccountInfo memory accountStruct = IDolomiteStructs.AccountInfo({
            owner: _account,
            number: _accountNumber
        });
        IDolomiteStructs.Par memory balance = _dolomiteMargin.getAccountPar(
            accountStruct,
            _marketId
        );

        assertEq(_expectedAmount, balance.value, "balance value incorrect");
        if (_expectedAmount != 0) {
            assertEq(_expectedSign, balance.sign, "balance sign incorrect");
        }
    }

    function assertProtocolBalanceWei(
        IDolomiteMargin _dolomiteMargin,
        address _account,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _expectedAmount,
        bool _expectedSign,
        uint256 _marginOfErrorWei
    ) public view returns (uint256) {
        IDolomiteStructs.AccountInfo memory accountStruct = IDolomiteStructs.AccountInfo({
            owner: _account,
            number: _accountNumber
        });
        IDolomiteStructs.Wei memory balance = _dolomiteMargin.getAccountWei(
            accountStruct,
            _marketId
        );

        uint256 lowerBound = _expectedAmount > _marginOfErrorWei ? _expectedAmount - _marginOfErrorWei : 0;
        assertTrue(
            balance.value >= lowerBound
                && balance.value <= _expectedAmount + _marginOfErrorWei,
            "balance value incorrect"
        );
        if (_expectedAmount != 0) {
            assertEq(_expectedSign, balance.sign, "balance sign incorrect");
        }
        return balance.value;
    }
}