pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../../foundry/DolomiteForkTest.sol";

import { DolomiteERC4626NoLossy } from "../../../contracts/general/DolomiteERC4626NoLossy.sol";
import { RegistryProxy } from "../../../contracts/general/RegistryProxy.sol";

contract DolomiteERC4626NoLossyTest is DolomiteForkTest {

    bytes32 private constant _FILE = "DolomiteERC4626NoLossyTest";

    DolomiteERC4626NoLossy public dTokenImplementation;
    RegistyProxy public dTokenProxy;

    uint256 marketId;

    function setUp() public override {
        super.setUp();

        marketId = dolomiteMargin.getMarketIdByTokenAddress(address(usdc));

        dTokenImplementation = new DolomiteERC4626NoLossy(42161, address(dolomiteRegistry), address(dolomiteMargin));
        bytes memory data = abi.encodeWithSignature(DolomiteERC4626NoLossy.initialize.selector, "USDC", "USDC", 6, marketId);
        dTokenProxy = new RegistryProxy(address(dTokenImplementation), address(dolomiteMargin), data);
    }
}