pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import { DynamiteRouter } from "../../../contracts/routers/DynamiteRouter.sol";
import { IDynamiteRouter } from "../../../contracts/routers/interfaces/IDynamiteRouter.sol";
import { IDolomiteMargin } from "../../../contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteRegistry } from "../../../contracts/interfaces/IDolomiteRegistry.sol";
import { IWETH } from "../../../contracts/protocol/interfaces/IWETH.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDolomiteStructs } from "../../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../../../contracts/protocol/lib/Require.sol";
import { InterestIndexLib } from "../../../contracts/lib/InterestIndexLib.sol";
import { AccountBalanceLib } from "../../../contracts/lib/AccountBalanceLib.sol";

contract DynamiteRouterTest is Test {

    bytes32 private constant _FILE = "DynamiteRouterTest";

    IDolomiteMargin public dolomiteMargin = IDolomiteMargin(0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072);
    IDolomiteRegistry public dolomiteRegistry = IDolomiteRegistry(0x2A059D6d682e5fB1226eB8bC2977b512698C2404);
    address public dolomiteOwner;

    IWETH public weth = IWETH(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
    IERC20 public usdc = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);

    DynamiteRouter public router;

    address public alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("ARBITRUM_ONE_WEB3_PROVIDER_URL"), 344263500);
        dolomiteOwner = dolomiteMargin.owner();

        router = new DynamiteRouter(address(dolomiteMargin), address(dolomiteRegistry));

        vm.startPrank(dolomiteOwner);
        dolomiteMargin.ownerSetGlobalOperator(address(router), true);
    }

    // =============================================
    // ============ Deposit and Borrow Tests =======
    // =============================================

    function test_depositAndBorrowWei(uint256 _collateralAmountWei, uint256 _debtAmountWei) public {
        _collateralAmountWei = bound(_collateralAmountWei, 1 ether, 100 ether);
        _debtAmountWei = bound(_debtAmountWei, 100e6, 1000e6);

        deal(address(weth), alice, _collateralAmountWei);

        vm.startPrank(alice);
        weth.approve(address(router), _collateralAmountWei);
        router.depositAndBorrowWei(
            /* _accountNumber */ 123,
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _debtMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralAmountWei */ _collateralAmountWei,
            /* _debtAmountWei */ _debtAmountWei,
            /* _eventFlag */ IDynamiteRouter.EventFlag.Borrow
        );

        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _collateralAmountWei, true, 2);
        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), _debtAmountWei, false, 2);
        assertEq(weth.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), _debtAmountWei);
        assertEq(weth.allowance(alice, address(router)), 0);
        assertEq(weth.allowance(address(router), address(dolomiteMargin)), 0);
    }

    // =============================================
    // ============ Repay and Withdraw Tests =======
    // =============================================

    function test_repayAndWithdrawWei_repaysPartial(
        uint256 _collateralAmountWei,
        uint256 _debtAmountWei,
        uint256 _repayAmountWei,
        uint256 _withdrawAmountWei,
        uint16 _timeElapsed
    ) public {
        _collateralAmountWei = bound(_collateralAmountWei, 1 ether, 100 ether);
        _debtAmountWei = bound(_debtAmountWei, 100e6, 1000e6);

        deal(address(weth), alice, _collateralAmountWei);

        vm.startPrank(alice);
        weth.approve(address(router), _collateralAmountWei);
        router.depositAndBorrowWei(
            /* _accountNumber */ 123,
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _debtMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralAmountWei */ _collateralAmountWei,
            /* _debtAmountWei */ _debtAmountWei,
            /* _eventFlag */ IDynamiteRouter.EventFlag.Borrow
        );

        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _collateralAmountWei, true, 2);
        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), _debtAmountWei, false, 2);
        assertEq(weth.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), _debtAmountWei);

        _repayAmountWei = bound(_repayAmountWei, 1, _debtAmountWei);
        _withdrawAmountWei = bound(_withdrawAmountWei, 1, _collateralAmountWei / 2);

        vm.warp(block.timestamp + _timeElapsed);
        usdc.approve(address(router), _repayAmountWei);
        router.repayAndWithdrawWei(
            /* _accountNumber */ 123,
            /* _repayMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _repayAmountWei */ _repayAmountWei,
            /* _withdrawAmountWei */ _withdrawAmountWei
        );
        
        assertEq(usdc.balanceOf(alice), _debtAmountWei - _repayAmountWei);
        assertEq(weth.balanceOf(alice), _withdrawAmountWei);
        assertEq(usdc.allowance(address(router), address(dolomiteMargin)), 0);
    }

    function test_repayAndWithdrawWei_repaysAll(uint256 _collateralAmountWei, uint256 _debtAmountWei, uint16 _timeElapsed) public {
        _collateralAmountWei = bound(_collateralAmountWei, 1 ether, 100 ether);
        _debtAmountWei = bound(_debtAmountWei, 100e6, 1000e6);

        deal(address(weth), alice, _collateralAmountWei);

        vm.startPrank(alice);
        weth.approve(address(router), _collateralAmountWei);
        router.depositAndBorrowWei(
            /* _accountNumber */ 123,
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _debtMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralAmountWei */ _collateralAmountWei,
            /* _debtAmountWei */ _debtAmountWei,
            /* _eventFlag */ IDynamiteRouter.EventFlag.Borrow
        );

        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _collateralAmountWei, true, 2);
        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), _debtAmountWei, false, 2);
        assertEq(weth.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), _debtAmountWei);

        deal(address(usdc), alice, _debtAmountWei + 100e6);

        vm.warp(block.timestamp + _timeElapsed);
        usdc.approve(address(router), _debtAmountWei + 100e6);
        router.repayAndWithdrawWei(
            /* _accountNumber */ 123,
            /* _repayMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _repayAmountWei */ type(uint256).max,
            /* _withdrawAmountWei */ type(uint256).max
        );
        
        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), 0, false);
        assertProtocolBalanceWei(alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), 0, false);
        assertEq(usdc.allowance(address(router), address(dolomiteMargin)), 0);
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