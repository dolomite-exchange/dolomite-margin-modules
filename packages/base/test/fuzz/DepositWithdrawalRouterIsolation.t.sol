pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../foundry/DolomiteForkTest.sol";
import { IsolationModeMarket } from "../foundry/DolomiteHelpers.sol";

import { CustomTestToken } from "../../contracts/test/CustomTestToken.sol";
import { DepositWithdrawalRouter } from "../../contracts/routers/DepositWithdrawalRouter.sol";
import { IDepositWithdrawalRouter } from "../../contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { IDolomiteStructs } from "../../contracts/protocol/interfaces/IDolomiteStructs.sol";



contract DepositWithdrawalRouterIsolationTest is DolomiteForkTest {

    bytes32 private constant _FILE = "DepositWithdrawalRouterIsolation";

    DepositWithdrawalRouter public router;
    IsolationModeMarket public testMarket;

    address public vault;

    function setUp() public override {
        super.setUp();

        upgradeDolomiteRegistry();
        router = new DepositWithdrawalRouter(address(dolomiteRegistry), address(dolomiteMargin));

        testMarket = createTestIsolationModeMarket();

        vm.startPrank(dolomiteOwner);

        router.ownerLazyInitialize(address(weth));
        dolomiteRegistry.ownerSetDepositWithdrawalRouter(address(router));
        dolomiteMargin.ownerSetGlobalOperator(address(router), true);

        testMarket.factory.ownerSetIsTokenConverterTrusted(address(router), true);

        vm.stopPrank();

        vault = testMarket.factory.calculateVaultByAccount(alice);
    }

    // =============================================
    // =============== Deposit Tests ===============
    // =============================================

    function test_depositWei_underlyingTokenDefaultAccount(uint128 _amountWei) public {
        vm.assume(_amountWei > 0);

        CustomTestToken token = testMarket.underlyingToken;
        deal(address(token), alice, _amountWei);

        vm.startPrank(alice);
        token.approve(address(router), _amountWei);
        router.depositWei(
            /* _isolationModeMarketId */ testMarket.marketId,
            /* _toAccountNumber */ 0,
            /* _marketId */ testMarket.marketId,
            /* _amountWei */ _amountWei,
            /* _eventFlag */ IDepositWithdrawalRouter.EventFlag.None
        );
        
        assertEq(token.allowance(alice, address(router)), 0);
        assertEq(token.allowance(address(router), address(dolomiteMargin)), 0);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(address(router)), 0);
        assertProtocolBalanceWei(
            dolomiteMargin,
            alice,
            0,
            testMarket.marketId,
            0,
            true
        );
        assertProtocolBalanceWei(
            dolomiteMargin,
            vault,
            0,
            testMarket.marketId,
            _amountWei,
            true
        );
    }

}