pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../foundry/DolomiteForkTest.sol";

import { DepositWithdrawalRouter } from "../../contracts/routers/DepositWithdrawalRouter.sol";
import { IDepositWithdrawalRouter } from "../../contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { IDolomiteStructs } from "../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { AccountBalanceLib } from "../../contracts/lib/AccountBalanceLib.sol";


contract DepositWithdrawalRouterStandardTest is DolomiteForkTest {

    bytes32 private constant _FILE = "DepositWithdrawalRouterTest";

    DepositWithdrawalRouter public router;

    function setUp() public override {
        super.setUp();

        router = new DepositWithdrawalRouter(address(dolomiteRegistry), address(dolomiteMargin));

        vm.startPrank(dolomiteOwner);
        router.ownerLazyInitialize(address(weth));
        dolomiteMargin.ownerSetGlobalOperator(address(router), true);
    }

    // =============================================
    // =============== Deposit Tests ===============
    // =============================================

    function test_depositWei(uint128 _amountWei) public {
        vm.assume(_amountWei > 0);

        deal(address(usdc), alice, _amountWei);

        vm.startPrank(alice);
        usdc.approve(address(router), _amountWei);
        router.depositWei(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountWei */ _amountWei,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        assertEq(usdc.allowance(alice, address(router)), 0);
        assertEq(usdc.allowance(address(router), address(dolomiteMargin)), 0);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _amountWei,
            true,
            /* _marginOfErrorWei */ 1
        );
    }

    function test_depositPar(uint64 _amountPar) public {
        vm.assume(_amountPar > 0);

        IDolomiteStructs.Par memory parStruct = IDolomiteStructs.Par({
            sign: true,
            value: _amountPar
        });
        IDolomiteStructs.Wei memory weiAmount = convertParToWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            parStruct
        );

        deal(address(usdc), alice, weiAmount.value);

        vm.startPrank(alice);
        usdc.approve(address(router), weiAmount.value);
        router.depositPar(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ _amountPar,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        assertEq(usdc.allowance(alice, address(router)), 0);
        assertEq(usdc.allowance(address(router), address(dolomiteMargin)), 0);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _amountPar,
            true
        );
    }

    function test_depositPar_twoNormalDeposits_parProtocolBalanceIsSum(uint32[2] memory _amountPars) public {
        vm.startPrank(alice);
        for (uint256 i; i < 2; i++) {
            vm.assume(_amountPars[i] > 0);
            IDolomiteStructs.Par memory parStruct = IDolomiteStructs.Par({
                sign: true,
                value: _amountPars[i]
            });
            IDolomiteStructs.Wei memory weiAmount = convertParToWei(
                dolomiteMargin,
                alice,
                0,
                dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
                parStruct
            );

            deal(address(usdc), alice, weiAmount.value);
            usdc.approve(address(router), weiAmount.value);

            router.depositPar(
                /* _isolationModeMarketId */ 0,
                /* _toAccountNumber */ 0,
                /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
                /* _amountPar */ _amountPars[i],
                /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
            );
        }

        assertEq(usdc.balanceOf(address(router)), 0);
        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            uint256(_amountPars[0]) + uint256(_amountPars[1]),
            true
        );
    }

    function test_depositPar_repaysCorrectParAmount(uint32 _amountWei, uint16 _timeElapsed) public {
        vm.assume(_amountWei > 0);

        // Deposit ETH collateral and borrow USDC
        vm.startPrank(alice);
        deal(alice, 10 ether);
        router.depositPayable{value: 10 ether}(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 123,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );
        router.withdrawWei(
            /* _isolationModeMarketId */ 0,
            /* _fromAccountNumber */ 123,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountWei */ _amountWei,
            /* _eventFlag */ AccountBalanceLib.BalanceCheckFlag.None
        );

        IDolomiteStructs.Par memory parBalance = dolomiteMargin.getAccountPar(
            IDolomiteStructs.AccountInfo({
                owner: alice,
                number: 123
            }),
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc))
        );
        
        // Repay USDC
        deal(address(usdc), alice, uint256(_amountWei) * 2);
        usdc.approve(address(router), type(uint256).max);

        vm.warp(block.timestamp + _timeElapsed);
        router.depositPar(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 123,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ parBalance.value,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        // Confirm protocol balance is 0
        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            123,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            0,
            true
        );
    }

    function test_depositPayable(uint128 _amountWei) public {
        vm.assume(_amountWei > 0);
        deal(alice, _amountWei);

        vm.startPrank(alice);
        router.depositPayable{value: _amountWei}(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        assertEq(address(router).balance, 0);
        assertEq(alice.balance, 0);
        assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountWei,
            true,
            /* _marginOfErrorWei */ 1
        );
    }

    function test_depositParPayable(uint96 _amountPar) public {
        vm.assume(_amountPar > 0);
        IDolomiteStructs.Wei memory weiAmount = convertParToWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountPar
        );
        deal(alice, weiAmount.value);

        vm.startPrank(alice);
        router.depositParPayable{value: weiAmount.value}(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _amountPar */ _amountPar,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        assertEq(address(router).balance, 0);
        assertEq(alice.balance, 0);
        assertProtocolBalancePar(dolomiteMargin, alice, 0, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _amountPar, true);
    }

    // =============================================
    // =============== Withdraw Tests ==============
    // =============================================

    function test_withdrawWei_normalToken(uint128 _amountWei, uint256 _withdrawAmount) public {
        vm.assume(_amountWei > 0);

        deal(address(usdc), alice, _amountWei);

        vm.startPrank(alice);
        usdc.approve(address(router), _amountWei);
        router.depositWei(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountWei */ _amountWei,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        uint256 protocolBalance = dolomiteMargin.getAccountWei(
            IDolomiteStructs.AccountInfo({
                owner: alice,
                number: 0
            }),
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc))
        ).value;
        _withdrawAmount = bound(_withdrawAmount, 1, protocolBalance);
        router.withdrawWei(
            /* _isolationModeMarketId */ 0,
            /* _fromAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountWei */ _withdrawAmount,
            /* _eventFlag */ AccountBalanceLib.BalanceCheckFlag.From
        );

        assertEq(usdc.balanceOf(alice), _withdrawAmount);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _withdrawAmount >= _amountWei ? 0 : _amountWei - _withdrawAmount,
            true,
            /* _marginOfErrorWei */ 2
        );
    }

    function test_withdrawPar_normalToken(uint64 _amountPar, uint256 _withdrawAmount) public {
        vm.assume(_amountPar > 0);

        IDolomiteStructs.Par memory parStruct = IDolomiteStructs.Par({
            sign: true,
            value: _amountPar
        });
        IDolomiteStructs.Wei memory weiAmount = convertParToWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            parStruct
        );

        deal(address(usdc), alice, weiAmount.value);

        vm.startPrank(alice);
        usdc.approve(address(router), weiAmount.value);
        router.depositPar(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ _amountPar,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        _withdrawAmount = bound(_withdrawAmount, 1, _amountPar);
        router.withdrawPar(
            /* _isolationModeMarketId */ 0,
            /* _fromAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ _withdrawAmount,
            /* _eventFlag */ AccountBalanceLib.BalanceCheckFlag.From
        );

        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _amountPar - _withdrawAmount,
            true
        );
    }

    function test_withdrawPayable(uint128 _depositAmount, uint256 _withdrawAmount) public {
        vm.assume(_depositAmount > 0);
        vm.assume(_withdrawAmount > 0);

        deal(alice, _depositAmount);

        vm.startPrank(alice);
        router.depositPayable{value: _depositAmount}(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );
        uint256 protocolBalance = assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _depositAmount,
            true,
            /* _marginOfErrorWei */ 1
        );

        _withdrawAmount = bound(_withdrawAmount, 1, protocolBalance);
        router.withdrawPayable(
            /* _isolationModeMarketId */ 0,
            /* _fromAccountNumber */ 0,
            /* _amountWei */ _withdrawAmount,
            /* _balanceCheckFlag */ AccountBalanceLib.BalanceCheckFlag.From
        );
        assertEq(alice.balance, _withdrawAmount);
        assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            protocolBalance - _withdrawAmount,
            true,
            /* _marginOfErrorWei */ 2
        );
    }

    function test_withdrawParPayable(uint96 _amountPar, uint256 _withdrawAmount) public {
        vm.assume(_amountPar > 0);
        vm.assume(_withdrawAmount > 0);

        IDolomiteStructs.Wei memory weiAmount = convertParToWei(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountPar
        );
        deal(alice, weiAmount.value);

        vm.startPrank(alice);
        router.depositParPayable{value: weiAmount.value}(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _amountPar */ _amountPar,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );
        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountPar,
            true
        );

        _withdrawAmount = bound(_withdrawAmount, 1, _amountPar);
        router.withdrawParPayable(
            /* _isolationModeMarketId */ 0,
            /* _fromAccountNumber */ 0,
            /* _amountPar */ _withdrawAmount,
            /* _balanceCheckFlag */ AccountBalanceLib.BalanceCheckFlag.From
        );
        assertProtocolBalancePar(
            dolomiteMargin,
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountPar - _withdrawAmount,
            true
        );
    }
}