pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../../foundry/DolomiteForkTest.sol";
import { LiquidatorProxyV6 } from "../../../contracts/proxies/LiquidatorProxyV6.sol";
import { RegistryProxy } from "../../../contracts/general/RegistryProxy.sol";
import { IDolomiteStructs } from "../../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IDepositWithdrawalRouter } from "../../../contracts/routers/interfaces/IDepositWithdrawalRouter.sol";
import { AccountBalanceLib } from "../../../contracts/lib/AccountBalanceLib.sol";
import { TestDolomiteMarginExchangeWrapper } from "../../../contracts/test/TestDolomiteMarginExchangeWrapper.sol";
import { IGenericTraderBase } from "../../../contracts/interfaces/IGenericTraderBase.sol";
import { ILiquidatorProxyV6 } from "../../../contracts/proxies/interfaces/ILiquidatorProxyV6.sol";

import "forge-std/console2.sol";


contract LiquidatorProxyV6Test is DolomiteForkTest {

    bytes32 private constant _FILE = "LiquidatorProxyV6Test";

    LiquidatorProxyV6 public liquidatorProxy;

    TestDolomiteMarginExchangeWrapper public dolomiteExchangeWrapper;

    uint256 public daiMarketId;
    uint256 public wethMarketId;

    uint256 public constant BORROW_ACCOUNT_NUMBER = 123;
    uint256 public constant DEFAULT_ACCOUNT_NUMBER = 0;

    function setUp() public override {
        super.setUp();

        dolomiteExchangeWrapper = new TestDolomiteMarginExchangeWrapper(address(dolomiteMargin));
        deal(address(weth), address(dolomiteExchangeWrapper), 5 ether);

        liquidatorProxy = new LiquidatorProxyV6(
            42161,
            expiry,
            address(dolomiteMargin),
            address(dolomiteRegistry),
            liquidatorAssetRegistry
        );
        daiMarketId = dolomiteMargin.getMarketIdByTokenAddress(address(dai));
        wethMarketId = dolomiteMargin.getMarketIdByTokenAddress(address(weth));

        vm.startPrank(dolomiteOwner);

        constantPriceOracle.setPrice(address(dai), 1 ether); // $1
        constantPriceOracle.setPrice(address(weth), 500 ether); // $500

        dolomiteMargin.ownerSetPriceOracle(daiMarketId, constantPriceOracle);
        dolomiteMargin.ownerSetPriceOracle(wethMarketId, constantPriceOracle);

        liquidatorProxy.initialize();
        dolomiteMargin.ownerSetGlobalOperator(address(liquidatorProxy), true);
        dolomiteRegistry.ownerSetFeeAgent(charlie);

        liquidatorProxy.ownerSetDolomiteRake(IDolomiteStructs.Decimal({
            value: .1 ether
        }));

        vm.stopPrank();
    }

    // =============================================
    // =============== Liquidate Tests ===============
    // =============================================

    function test_liquidate_lossy_10_percent_rake() public {
        uint256 amountWei = 1000 ether;
        deal(address(dai), alice, amountWei);

        vm.startPrank(alice);
        dai.approve(address(depositWithdrawalRouter), amountWei);
        depositWithdrawalRouter.depositWei(
            0,
            BORROW_ACCOUNT_NUMBER,
            daiMarketId,
            amountWei,
            IDepositWithdrawalRouter.EventFlag.None
        );
        assertProtocolBalanceWei(dolomiteMargin, alice, BORROW_ACCOUNT_NUMBER, daiMarketId, amountWei, true);
        console2.log("succesfully did alice deposit");

        borrowPositionProxy.transferBetweenAccounts(
            BORROW_ACCOUNT_NUMBER,
            DEFAULT_ACCOUNT_NUMBER,
            wethMarketId,
            1 ether,
            AccountBalanceLib.BalanceCheckFlag.None
        );

        vm.stopPrank();

        constantPriceOracle.setPrice(address(weth), 900 ether); // $900

        uint256 minOutputAmountWei = 1.1 ether;
        IGenericTraderBase.TraderParam[] memory tradersPath = new IGenericTraderBase.TraderParam[](1);
        tradersPath[0] = IGenericTraderBase.TraderParam({
            traderType: IGenericTraderBase.TraderType.ExternalLiquidity,
            makerAccountIndex: 0,
            trader: address(dolomiteExchangeWrapper),
            tradeData: abi.encode(minOutputAmountWei, abi.encode(minOutputAmountWei))
        });
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = daiMarketId;
        marketIdsPath[1] = wethMarketId;

        vm.prank(bob);
        liquidatorProxy.liquidate(ILiquidatorProxyV6.LiquidateParams({
            solidAccount: IDolomiteStructs.AccountInfo({
                owner: bob,
                number: DEFAULT_ACCOUNT_NUMBER
            }),
            liquidAccount: IDolomiteStructs.AccountInfo({
                owner: alice,
                number: BORROW_ACCOUNT_NUMBER
            }),
            marketIdsPath: marketIdsPath,
            inputAmountWei: type(uint256).max,
            minOutputAmountWei: type(uint256).max,
            tradersPath: tradersPath,
            makerAccounts: new IDolomiteStructs.AccountInfo[](0),
            expirationTimestamp: 0,
            withdrawAllReward: false
        }));

        /*
        * held = 1000 DAI
        * owed = 1 WETH
        * heldPrice = $1
        * owedPrice = $900
        * owedPriceAdj = 900 + .05(900) = $945
        *
        * After liquidation action:
        *     liquid account dai = 1000 - 945 = 55
        *     liquid account weth = 1 - 1 = 0
        *     solid account dai = 940.5
        *     solid account weth = -1
        *     dolomite rake account dai = 4.5
        *
        * After trade action where solid account swaps 940.5 dai for 1.1 weth:
        *     solid account dai = 0
        *     solid account weth = .1
        */
        assertProtocolBalanceWei(dolomiteMargin, alice, BORROW_ACCOUNT_NUMBER, wethMarketId, 0, true);
        console2.log("here1");
        assertProtocolBalanceWei(dolomiteMargin, alice, BORROW_ACCOUNT_NUMBER, daiMarketId, 55 ether, true);
        console2.log("here2");
        assertProtocolBalanceWei(dolomiteMargin, bob, DEFAULT_ACCOUNT_NUMBER, wethMarketId, .1 ether, true);
        console2.log("here3");
        assertProtocolBalanceWei(dolomiteMargin, bob, DEFAULT_ACCOUNT_NUMBER, daiMarketId, 0, false);
        console2.log("here4");
        assertProtocolBalanceWei(dolomiteMargin, charlie, DEFAULT_ACCOUNT_NUMBER, daiMarketId, 4.5 ether, true);
        console2.log("here5");
        assertEq(dai.balanceOf(address(dolomiteExchangeWrapper)), 940.5 ether);
        console2.log("here6");
    }
}