pragma solidity ^0.8.13;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { DolomiteAssertions } from "./DolomiteAssertions.sol";
import { DolomiteHelpers, IsolationModeMarket } from "./DolomiteHelpers.sol";

import { IDolomiteInterestSetter } from "../../contracts/protocol/interfaces/IDolomiteInterestSetter.sol";
import { IDolomiteMargin } from "../../contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomitePriceOracle } from "../../contracts/protocol/interfaces/IDolomitePriceOracle.sol";
import { IDolomiteRegistry } from "../../contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomiteStructs } from "../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IWETH } from "../../contracts/protocol/interfaces/IWETH.sol";

import { CustomTestToken } from "../../contracts/test/CustomTestToken.sol";
import { DolomiteRegistryImplementation } from "../../contracts/general/DolomiteRegistryImplementation.sol";
import { RegistryProxy } from "../../contracts/general/RegistryProxy.sol";
import { TestPriceOracle } from "../../contracts/test/TestPriceOracle.sol";
import { TestIsolationModeTokenVaultV1 } from "../../contracts/test/TestIsolationModeTokenVaultV1.sol";
import { TestIsolationModeVaultFactory } from "../../contracts/test/TestIsolationModeVaultFactory.sol";


abstract contract DolomiteForkTest is DolomiteAssertions, DolomiteHelpers {

    bytes32 private constant _FILE = "DolomiteForkTest";

    IDolomiteMargin public dolomiteMargin = IDolomiteMargin(0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072);
    IDolomiteRegistry public dolomiteRegistry = IDolomiteRegistry(0x2A059D6d682e5fB1226eB8bC2977b512698C2404);
    address public dolomiteOwner;

    IDolomiteInterestSetter public alwaysZeroInterestSetter = IDolomiteInterestSetter(0x37b6fF70654EDfBdAA3c9a723fdAdF5844De2168);
    address public borrowPositionProxy = 0x38E49A617305101216eC6306e3a18065D14Bf3a7;
    TestPriceOracle public testPriceOracle;

    IWETH public weth = IWETH(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
    IERC20 public usdc = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public virtual {
        vm.createSelectFork(vm.envString("ARBITRUM_ONE_WEB3_PROVIDER_URL"), 344263500);
        dolomiteOwner = dolomiteMargin.owner();

        testPriceOracle = new TestPriceOracle();
    }

    function createTestIsolationModeMarket() public returns (IsolationModeMarket memory) {
        CustomTestToken underlyingToken = new CustomTestToken("Test", "TEST", 18);
        TestIsolationModeTokenVaultV1 userVaultImplementation = new TestIsolationModeTokenVaultV1();
        TestIsolationModeVaultFactory factory = new TestIsolationModeVaultFactory(
            address(underlyingToken),
            borrowPositionProxy,
            address(userVaultImplementation),
            address(dolomiteRegistry),
            address(dolomiteMargin)
        );

        testPriceOracle.setPrice(address(factory), 1e18);

        uint256 marketId = dolomiteMargin.getNumMarkets();
        vm.startPrank(dolomiteOwner);
        dolomiteMargin.ownerAddMarket(
            address(factory),
            IDolomitePriceOracle(address(testPriceOracle)),
            alwaysZeroInterestSetter,
            /* marginPremium */ IDolomiteStructs.Decimal({ value: 0 }),
            /* spreadPremium */ IDolomiteStructs.Decimal({ value: 0 }),
            /* maxSupplyWei */ 0,
            /* isClosing */ true,
            /* isRecyclable */ false
        );
        dolomiteMargin.ownerSetGlobalOperator(address(factory), true);
        factory.ownerInitialize(new address[](0));
        vm.stopPrank();

        return IsolationModeMarket({
            marketId: marketId,
            underlyingToken: underlyingToken,
            userVaultImplementation: userVaultImplementation,
            factory: factory,
            priceOracle: testPriceOracle
        });
    }

    function upgradeDolomiteRegistry() public {
        DolomiteRegistryImplementation implementation = new DolomiteRegistryImplementation();

        RegistryProxy registry = RegistryProxy(payable(address(dolomiteRegistry)));
        vm.prank(dolomiteOwner);
        registry.upgradeTo(address(implementation));
    }
}