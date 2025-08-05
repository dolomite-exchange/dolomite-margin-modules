pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import { DepositWithdrawalRouter } from "../../../contracts/routers/DepositWithdrawalRouter.sol";
import { IDepositWithdrawalRouter } from "../../../contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { IDolomiteMargin } from "../../../contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteRegistry } from "../../../contracts/interfaces/IDolomiteRegistry.sol";
import { IWETH } from "../../../contracts/protocol/interfaces/IWETH.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDolomiteStructs } from "../../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../contracts/protocol/lib/Require.sol";
import { InterestIndexLib } from "../../../contracts/lib/InterestIndexLib.sol";
import { AccountBalanceLib } from "../../../contracts/lib/AccountBalanceLib.sol";

import { SimpleIsolationModeTokenVaultV1 } from "../../../contracts/isolation-mode/SimpleIsolationModeTokenVaultV1.sol";

contract DepositWithdrawalRouterStandardTest is Test {

    bytes32 private constant _FILE = "DepositWithdrawalRouterTest";

    IDolomiteMargin public dolomiteMargin = IDolomiteMargin(0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072);
    IDolomiteRegistry public dolomiteRegistry = IDolomiteRegistry(0x2A059D6d682e5fB1226eB8bC2977b512698C2404);
    address public dolomiteOwner;

    IWETH public weth = IWETH(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
    IERC20 public usdc = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);

    DepositWithdrawalRouter public router;

    address public alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("ARBITRUM_ONE_WEB3_PROVIDER_URL"), 344263500);
        dolomiteOwner = dolomiteMargin.owner();

        router = new DepositWithdrawalRouter(address(dolomiteRegistry), address(dolomiteMargin));

        vm.startPrank(dolomiteOwner);
        router.ownerLazyInitialize(address(weth));
        dolomiteMargin.ownerSetGlobalOperator(address(router), true);
    }

    // =============================================
    // =============== Deposit Tests ===============
    // =============================================

    function test_depositWei_normalToken(uint128 _amountWei) public {
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
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _amountWei,
            true,
            /* _marginOfErrorWei */ 1
        );
    }

    function test_depositPar_normalToken(uint64 _amountPar) public {
        vm.assume(_amountPar > 0);

        IDolomiteStructs.Par memory parStruct = IDolomiteStructs.Par({
            sign: true,
            value: _amountPar
        });
        uint256 weiAmount = InterestIndexLib.parToWei(dolomiteMargin, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), parStruct).value;

        deal(address(usdc), alice, weiAmount);

        vm.startPrank(alice);
        usdc.approve(address(router), weiAmount);
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
            uint256 weiAmount = InterestIndexLib.parToWei(
                dolomiteMargin,
                dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
                parStruct
            ).value;

            deal(address(usdc), alice, weiAmount + 1);
            usdc.approve(address(router), weiAmount + 1);

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
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            _amountWei,
            true,
            /* _marginOfErrorWei */ 1
        );
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
        uint256 weiAmount = InterestIndexLib.parToWei(dolomiteMargin, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), parStruct).value;

        deal(address(usdc), alice, weiAmount);

        vm.startPrank(alice);
        usdc.approve(address(router), weiAmount);
        router.depositPar(
            /* _isolationModeMarketId */ 0,
            /* _toAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ _amountPar,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );

        _withdrawAmount = bound(_withdrawAmount, 1, _amountPar);
        router.withdrawPar(
            /* _fromAccountNumber */ 0,
            /* _marketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _amountPar */ _withdrawAmount,
            /* _eventFlag */ AccountBalanceLib.BalanceCheckFlag.From
        );

        assertProtocolBalancePar(
            alice,
            0,
            dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            _amountPar - _withdrawAmount,
            true
        );
    }

    // =============================================
    // ============ Dolomite Assertions ============
    // =============================================

    function assertProtocolBalanceWei(
        address _account,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _expectedAmount,
        bool _expectedSign
    ) public view {
        assertProtocolBalanceWei(
            _account,
            _accountNumber,
            _marketId,
            _expectedAmount,
            _expectedSign,
            /* _marginOfErrorWei */ 0
        );
    }

    function assertProtocolBalancePar(
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
        IDolomiteStructs.Par memory balance = dolomiteMargin.getAccountPar(
            accountStruct,
            _marketId
        );

        assertEq(_expectedAmount, balance.value, "balance value incorrect");
        if (_expectedAmount != 0) {
            assertEq(_expectedSign, balance.sign, "balance sign incorrect");
        }
    }

    function assertProtocolBalanceWei(
        address _account,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _expectedAmount,
        bool _expectedSign,
        uint256 _marginOfErrorWei
    ) public view {
        IDolomiteStructs.AccountInfo memory accountStruct = IDolomiteStructs.AccountInfo({
            owner: _account,
            number: _accountNumber
        });
        IDolomiteStructs.Wei memory balance = dolomiteMargin.getAccountWei(
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
    }
}