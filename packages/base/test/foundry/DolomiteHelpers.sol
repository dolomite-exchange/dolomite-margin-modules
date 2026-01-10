pragma solidity ^0.8.13;

import { IDolomiteMargin } from "../../contracts/protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../../contracts/protocol/interfaces/IDolomiteStructs.sol";
import { IDolomitePriceOracle } from "../../contracts/protocol/interfaces/IDolomitePriceOracle.sol";

import { TypesLib } from "../../contracts/protocol/lib/TypesLib.sol";
import { InterestIndexLib } from "../../contracts/lib/InterestIndexLib.sol";
import { CustomTestToken } from "../../contracts/test/CustomTestToken.sol";
import { TestIsolationModeTokenVaultV1 } from "../../contracts/test/TestIsolationModeTokenVaultV1.sol";
import { TestIsolationModeVaultFactory } from "../../contracts/test/TestIsolationModeVaultFactory.sol";

struct IsolationModeMarket {
    uint256 marketId;
    CustomTestToken underlyingToken;
    TestIsolationModeTokenVaultV1 userVaultImplementation;
    TestIsolationModeVaultFactory factory;
    IDolomitePriceOracle priceOracle;
}


abstract contract DolomiteHelpers {
    using TypesLib for IDolomiteStructs.Par;
    using TypesLib for IDolomiteStructs.Wei;
    using InterestIndexLib for IDolomiteMargin;

    /**
     * Converts the par amount to wei
     */
    function convertParToWei(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId,
        IDolomiteStructs.Par memory _amountPar
    ) public view returns (IDolomiteStructs.Wei memory) {
        IDolomiteStructs.AccountInfo memory accountInfo = IDolomiteStructs.AccountInfo({
            owner: _accountOwner,
            number: _accountNumber
        });
        IDolomiteStructs.Par memory parBalance = _dolomiteMargin.getAccountPar(accountInfo, _marketId);
        parBalance = parBalance.add(_amountPar);

        IDolomiteStructs.Wei memory weiBalanceBefore = _dolomiteMargin.getAccountWei(accountInfo, _marketId);
        IDolomiteStructs.Wei memory weiBalanceAfter = _dolomiteMargin.parToWei(_marketId, parBalance);
        return weiBalanceAfter.sub(weiBalanceBefore);
    }

    function convertParToWei(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        uint256 _accountNumber,
        uint256 _marketId,
        uint256 _amountPar
    ) public view returns (IDolomiteStructs.Wei memory) {
        assert(_amountPar < type(uint128).max);

        IDolomiteStructs.Par memory parStruct = IDolomiteStructs.Par({
            sign: true,
            value: uint128(_amountPar)
        });
        return convertParToWei(_dolomiteMargin, _accountOwner, _accountNumber, _marketId, parStruct);
    }
}