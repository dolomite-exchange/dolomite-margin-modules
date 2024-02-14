// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity ^0.8.9;

import { IDolomiteMarginInternalTrader } from "../protocol/interfaces/IDolomiteMarginInternalTrader.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   TestDolomiteMarginInternalTrader
 * @author  Dolomite
 *
 * IDolomiteMarginInternalTrader for testing
 */
contract TestDolomiteMarginInternalTrader is IDolomiteMarginInternalTrader {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "TestDolomiteMarginInternalTrader";

    // =================================================
    // ==================== Storage ====================
    // =================================================

    // input => output
    mapping (uint256 => IDolomiteStructs.AssetAmount) public data;
    mapping (uint256 => bool) public valid;

    uint256 public requireInputMarketId;
    uint256 public requireOutputMarketId;
    IDolomiteStructs.AccountInfo public requireMakerAccount;
    IDolomiteStructs.AccountInfo public requireTakerAccount;
    IDolomiteStructs.Par public requireOldInputPar;
    IDolomiteStructs.Par public requireNewInputPar;
    IDolomiteStructs.Wei public requireInputWei;

    // ================================================
    // ==================== Events ====================
    // ================================================

    event DataSet(
        uint256 indexed input,
        IDolomiteStructs.AssetAmount output
    );

    event DataDeleted(
        uint256 indexed input
    );

    // =================================================
    // =============== External Functions ==============
    // =================================================

    function getTradeCost(
        uint256 inputMarketId,
        uint256 outputMarketId,
        IDolomiteStructs.AccountInfo calldata makerAccount,
        IDolomiteStructs.AccountInfo calldata takerAccount,
        IDolomiteStructs.Par calldata oldInputPar,
        IDolomiteStructs.Par calldata newInputPar,
        IDolomiteStructs.Wei calldata inputWei,
        bytes calldata tradeData
    )
    external
    returns (IDolomiteStructs.AssetAmount memory)
    {
        if (requireInputMarketId != 0) {
            Require.that(
                requireInputMarketId == inputMarketId,
                _FILE,
                "input market mismatch"
            );
        }
        if (requireOutputMarketId != 0) {
            Require.that(
                requireOutputMarketId == outputMarketId,
                _FILE,
                "output market mismatch"
            );
        }
        if (requireMakerAccount.owner != address(0)) {
            Require.that(
                requireMakerAccount.owner == makerAccount.owner,
                _FILE,
                "maker account owner mismatch"
            );
            Require.that(
                requireMakerAccount.number == makerAccount.number,
                _FILE,
                "maker account number mismatch"
            );
        }
        if (requireTakerAccount.owner != address(0)) {
            Require.that(
                requireTakerAccount.owner == takerAccount.owner,
                _FILE,
                "taker account owner mismatch"
            );
            Require.that(
                requireTakerAccount.number == takerAccount.number,
                _FILE,
                "taker account number mismatch"
            );
        }
        if (requireOldInputPar.value != 0) {
            Require.that(
                requireOldInputPar.sign == oldInputPar.sign,
                _FILE,
                "oldInputPar sign mismatch"
            );
            Require.that(
                requireOldInputPar.value == oldInputPar.value,
                _FILE,
                "oldInputPar value mismatch"
            );
        }
        if (requireNewInputPar.value != 0) {
            Require.that(
                requireNewInputPar.sign == newInputPar.sign,
                _FILE,
                "newInputPar sign mismatch"
            );
            Require.that(
                requireNewInputPar.value == newInputPar.value,
                _FILE,
                "newInputPar value mismatch"
            );
        }
        if (requireInputWei.value != 0) {
            Require.that(
                requireInputWei.sign == inputWei.sign,
                _FILE,
                "inputWei sign mismatch"
            );
            Require.that(
                requireInputWei.value == inputWei.value,
                _FILE,
                "inputWei value mismatch"
            );
        }

        uint256 input = _parseTradeData(tradeData);
        return _deleteDataInternal(input);
    }

    // =================================================
    // =============== Testing Functions ===============
    // =================================================

    function setData(
        uint256 input,
        IDolomiteStructs.AssetAmount memory output
    )
    public
    {
        _setDataInternal(input, output);
    }

    function setRequireInputMarketId(
        uint256 inputMarketId
    )
    public
    {
        requireInputMarketId = inputMarketId;
    }

    function setRequireOutputMarketId(
        uint256 outputMarketId
    )
    public
    {
        requireOutputMarketId = outputMarketId;
    }

    function setRequireMakerAccount(
        IDolomiteStructs.AccountInfo memory account
    )
    public
    {
        requireMakerAccount = account;
    }

    function setRequireTakerAccount(
        IDolomiteStructs.AccountInfo memory account
    )
    public
    {
        requireTakerAccount = account;
    }

    function setRequireOldInputPar(
        IDolomiteStructs.Par memory oldInputPar
    )
    public
    {
        requireOldInputPar = oldInputPar;
    }

    function setRequireNewInputPar(
        IDolomiteStructs.Par memory newInputPar
    )
    public
    {
        requireNewInputPar = newInputPar;
    }

    function setRequireInputWei(
        IDolomiteStructs.Wei memory inputWei
    )
    public
    {
        requireInputWei = inputWei;
    }

    // =================================================
    // =============== Private Functions ===============
    // =================================================

    function _setDataInternal(
        uint256 input,
        IDolomiteStructs.AssetAmount memory output
    ) private {
        data[input] = output;
        valid[input] = true;
        emit DataSet(input, output);
    }

    function _deleteDataInternal(
        uint256 input
    )
        private
        returns (IDolomiteStructs.AssetAmount memory)
    {
        Require.that(
            valid[input],
            _FILE,
            "Trade does not exist"
        );
        IDolomiteStructs.AssetAmount memory output = data[input];
        delete data[input];
        delete valid[input];
        emit DataDeleted(input);
        return output;
    }

    function _parseTradeData(
        bytes memory tradeData
    )
        private
        pure
        returns (uint256)
    {
        Require.that(
            tradeData.length == 32,
            _FILE,
            "Call data invalid length"
        );

        uint256 input;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            input := mload(add(tradeData, 32))
        }

        return input;
    }
}
