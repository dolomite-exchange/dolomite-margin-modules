pragma solidity ^0.8.13;

import { DolomiteForkTest } from "../../foundry/DolomiteForkTest.sol";

import { DolomiteERC4626NoLossy } from "../../../contracts/general/DolomiteERC4626NoLossy.sol";
import { RegistryProxy } from "../../../contracts/general/RegistryProxy.sol";
import { AccountActionLib } from "../../../contracts/lib/AccountActionLib.sol";
import { IDolomiteStructs } from "../../../contracts/protocol/interfaces/IDolomiteStructs.sol";

contract DolomiteERC4626NoLossyTest is DolomiteForkTest {

    bytes32 private constant _FILE = "DolomiteERC4626NoLossyTest";

    DolomiteERC4626NoLossy public dTokenImplementation;
    RegistryProxy public dTokenProxy;

    DolomiteERC4626NoLossy public dToken;

    uint256 marketId;

    function setUp() public override {
        super.setUp();

        marketId = dolomiteMargin.getMarketIdByTokenAddress(address(usdc));

        dTokenImplementation = new DolomiteERC4626NoLossy(42161, address(dolomiteRegistry), address(dolomiteMargin));
        bytes memory data = abi.encodeWithSelector(DolomiteERC4626NoLossy.initialize.selector, "USDC", "USDC", 6, marketId);
        dTokenProxy = new RegistryProxy(address(dTokenImplementation), address(dolomiteMargin), data);

        dToken = DolomiteERC4626NoLossy(address(dTokenProxy));

        vm.prank(dolomiteOwner);
        dolomiteMargin.ownerSetGlobalOperator(address(dToken), true);
    }

    function test_transfer_whenOwnerHasFunds(uint96 _amountWei, uint96 _amountPar, uint16 _timeElapsed) public {
        vm.assume(_amountWei > 0);
        deal(address(usdc), alice, _amountWei);

        IDolomiteStructs.AccountInfo memory aliceInfo = IDolomiteStructs.AccountInfo({
            owner: alice,
            number: 0
        });
        IDolomiteStructs.AccountInfo memory bobInfo = IDolomiteStructs.AccountInfo({
            owner: bob,
            number: 0
        });
        IDolomiteStructs.AccountInfo memory ownerInfo = IDolomiteStructs.AccountInfo({
            owner: dolomiteOwner,
            number: 0
        });

        vm.startPrank(alice);
        usdc.approve(address(dolomiteMargin), _amountWei);
        AccountActionLib.deposit(
            dolomiteMargin,
            alice,
            alice,
            0,
            marketId,
            IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: IDolomiteStructs.AssetReference.Delta,
                value: _amountWei
            })
        );

        IDolomiteStructs.Par memory ownerPreBal = dolomiteMargin.getAccountPar(ownerInfo, marketId);
        IDolomiteStructs.Par memory alicePreBal = dolomiteMargin.getAccountPar(aliceInfo, marketId);

        _amountPar = uint96(bound(_amountPar, 1, alicePreBal.value));
        vm.warp(block.timestamp + _timeElapsed);
        dToken.transfer(bob, _amountPar);

        IDolomiteStructs.Par memory ownerPostBal = dolomiteMargin.getAccountPar(ownerInfo, marketId);
        IDolomiteStructs.Par memory alicePostBal = dolomiteMargin.getAccountPar(aliceInfo, marketId);
        IDolomiteStructs.Par memory bobPostBal = dolomiteMargin.getAccountPar(bobInfo, marketId);

        assertEq(alicePostBal.value, alicePreBal.value - _amountPar, "Invalid alice par value");
        assertEq(bobPostBal.value, _amountPar, "Invalid bob par value");
        // assertEq(ownerPreBal.value, ownerPostBal.value, "Owner pre and post bal not equal"); Uncomment this to confirm some lossy ones take place
    }
}