pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../foundry/DolomiteForkTest.sol";

import { DynamiteRouter } from "../../contracts/routers/DynamiteRouter.sol";
import { IDynamiteRouter } from "../../contracts/routers/interfaces/IDynamiteRouter.sol";

contract DynamiteRouterStandardTest is DolomiteForkTest {

    bytes32 private constant _FILE = "DynamiteRouterTest";

    DynamiteRouter public router;

    function setUp() public override {
        super.setUp();

        router = new DynamiteRouter(address(dolomiteMargin), address(dolomiteRegistry));

        vm.prank(dolomiteOwner);
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

        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _collateralAmountWei, true, 2);
        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), _debtAmountWei, false, 2);
        assertEq(weth.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), _debtAmountWei);
        assertEq(weth.allowance(alice, address(router)), 0);
        assertEq(weth.allowance(address(router), address(dolomiteMargin)), 0);
    }

    // =============================================
    // ============ Repay and Withdraw Tests =======
    // =============================================

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

        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), _collateralAmountWei, true, 2);
        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), _debtAmountWei, false, 2);
        assertEq(weth.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), _debtAmountWei);

        deal(address(usdc), alice, _debtAmountWei + 100e6);
        usdc.approve(address(router), _debtAmountWei + 100e6);

        vm.warp(block.timestamp + _timeElapsed);
        router.repayAndWithdrawWei(
            /* _accountNumber */ 123,
            /* _repayMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(usdc)),
            /* _collateralMarketId */ dolomiteMargin.getMarketIdByTokenAddress(address(weth)),
            /* _repayAmountWei */ type(uint256).max,
            /* _withdrawAmountWei */ type(uint256).max
        );
        
        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(usdc)), 0, false);
        assertProtocolBalanceWei(dolomiteMargin, alice, 123, dolomiteMargin.getMarketIdByTokenAddress(address(weth)), 0, false);
        assertEq(usdc.allowance(address(router), address(dolomiteMargin)), 0);
    }
}
