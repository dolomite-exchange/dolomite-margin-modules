pragma solidity ^0.8.9;

import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";

contract TestContractAccount {

    error Foo(uint256 a, uint256 b, uint256 c);

    function onLiquidate(
        uint256 /* _accountNumber */,
        uint256 /* _heldMarketId */,
        IDolomiteStructs.Wei calldata /* _heldDeltaWei */,
        uint256 /* _owedMarketId */,
        IDolomiteStructs.Wei calldata /* _owedDeltaWei */
    ) external {
        revert Foo(type(uint256).max, type(uint256).max, type(uint256).max);
    }

    function onInternalBalanceChange(
        uint256 /* _primaryAccountNumber */,
        IDolomiteStructs.AccountInfo calldata /* _secondaryAccount */,
        uint256 /* _primaryMarketId */,
        IDolomiteStructs.Wei calldata /* _primaryDeltaWei */,
        uint256 /* _secondaryMarketId */,
        IDolomiteStructs.Wei calldata /* _secondaryDeltaWei */
    ) external {
        revert Foo(type(uint256).max, type(uint256).max, type(uint256).max);
    }
}