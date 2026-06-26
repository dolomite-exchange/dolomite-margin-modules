// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite.

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { TypesLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/TypesLib.sol";
import { IOracleAggregatorV2 } from "@dolomite-exchange/modules-oracles/contracts/interfaces/IOracleAggregatorV2.sol";
import { IModularLinearStepFunctionInterestSetter } from "./interfaces/IModularLinearStepFunctionInterestSetter.sol";


/**
 * @title   ModularLinearStepFunctionInterestSetterBerachain
 * @author  Dolomite
 *
 * @notice  Applies a linear utilization model to reach the optimal utilization until interest rates reach 90%
 *          utilization. Then interest rates scale linearly to 100% APR.
 */
contract ModularLinearStepFunctionInterestSetterBerachain is
    IModularLinearStepFunctionInterestSetter,
    OnlyDolomiteMargin
{
    using TypesLib for IDolomiteStructs.Wei;

    // =============== Constants ===============

    bytes32 private constant _FILE = "ModularLinearStepInterestSetterB";
    uint256 public constant ONE_HUNDRED_PERCENT = 1 ether;
    uint256 public constant SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365;
    uint256 private constant _WBERA_MARKET_ID = 1;
    uint256 private constant _ONE_BERA = 1 ether;
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    // ========================= Structs =========================

    struct Snapshot {
        bool sign;
        uint128 value;
        uint64 timestamp;
    }

    // ========================= Events =========================

    event GasLimitUpdated(uint256 gasLimit);
    event MarketExcessBalanceSnapshot(uint256 marketId, IDolomiteStructs.Wei excessBalance);

    // =============== Field Variables ===============

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
    uint256 public gasLimit;
    mapping (address => Snapshot) private _tokenToExcessBalanceSnapshot;
    mapping (address => Settings) internal _tokenToSettingsMap;

    // =============== Constructor ===============

    constructor(
        address _dolomiteMargin,
        address _dolomiteRegistry,
        uint256 _gasLimit
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        assert(block.chainid == 80094);

        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        gasLimit = _gasLimit;
        emit GasLimitUpdated(_gasLimit);
    }

    // =============== Owner Functions ===============

    function ownerSetSettingsByToken(
        address _token,
        uint256 _lowerOptimalPercent,
        uint256 _upperOptimalPercent,
        uint256 _optimalUtilization
    ) external onlyDolomiteMarginOwner(msg.sender) {
        Require.that(
            _lowerOptimalPercent <= _upperOptimalPercent,
            _FILE,
            "Lower optimal percent too high"
        );
        Require.that(
            _optimalUtilization < ONE_HUNDRED_PERCENT && _optimalUtilization != 0,
            _FILE,
            "Invalid optimal utilization"
        );

        _tokenToSettingsMap[_token] = Settings({
            lowerOptimalPercent: _lowerOptimalPercent,
            upperOptimalPercent: _upperOptimalPercent,
            optimalUtilization: _optimalUtilization
        });
        emit SettingsChanged(_token, _lowerOptimalPercent, _upperOptimalPercent, _optimalUtilization);
    }

    function ownerSetGasLimit(uint256 _gasLimit) external onlyDolomiteMarginOwner(msg.sender) {
        gasLimit = _gasLimit;
        emit GasLimitUpdated(_gasLimit);
    }

    // =============== Public Functions ===============

    function snapshotExcessEarnings(uint256[] calldata _marketIds) external {
        uint256 marketIdsLength = _marketIds.length;
        for (uint256 i; i < marketIdsLength; ++i) {
            _snapshotExcessEarningsByMarketId(_marketIds[i]);
        }
    }

    function getSettingsByToken(address _token) external view returns (Settings memory) {
        return _getSettingsIfValid(_token);
    }

    function getLowerOptimalPercentByToken(address _token) external view returns (uint256) {
        return _getSettingsIfValid(_token).lowerOptimalPercent;
    }

    function getUpperOptimalPercentByToken(address _token) external view returns (uint256) {
        return _getSettingsIfValid(_token).upperOptimalPercent;
    }

    function getOptimalUtilizationByToken(address _token) external view returns (uint256) {
        return _getSettingsIfValid(_token).optimalUtilization;
    }

    function getSnapshotByToken(address _token) external view returns (IDolomiteStructs.Wei memory) {
        Snapshot memory snapshot = _tokenToExcessBalanceSnapshot[_token];
        return IDolomiteStructs.Wei({
            sign: snapshot.sign,
            value: snapshot.value
        });
    }

    function getInterestRate(
        address _token,
        uint256 _borrowWei,
        uint256 _supplyWei
    )
        external
        override
        view
        returns (InterestRate memory)
    {
        Settings memory settings = _getSettingsIfValid(_token);

        _validateTokenForBerachain(_token);

        if (_borrowWei == 0) {
            return InterestRate({
                value: 0
            });
        } else if (_supplyWei == 0) {
            return InterestRate({
                value: (settings.lowerOptimalPercent + settings.upperOptimalPercent) / SECONDS_IN_A_YEAR
            });
        }

        uint256 remainingOptimalUtilization = ONE_HUNDRED_PERCENT - settings.optimalUtilization;
        uint256 utilization = _borrowWei * ONE_HUNDRED_PERCENT / _supplyWei;
        if (utilization >= ONE_HUNDRED_PERCENT) {
            return InterestRate({
                value: (settings.lowerOptimalPercent + settings.upperOptimalPercent) / SECONDS_IN_A_YEAR
            });
        } else if (utilization > settings.optimalUtilization) {
            // interest is equal to lowerOptimalPercent + linear progress to upperOptimalPercent APR
            uint256 utilizationDiff = utilization - settings.optimalUtilization;
            uint256 interestToAdd = settings.upperOptimalPercent * utilizationDiff / remainingOptimalUtilization;
            return InterestRate({
                value: (interestToAdd + settings.lowerOptimalPercent) / SECONDS_IN_A_YEAR
            });
        } else {
            return InterestRate({
                value: settings.lowerOptimalPercent * utilization / settings.optimalUtilization / SECONDS_IN_A_YEAR
            });
        }
    }

    function interestSetterType() external override pure returns (InterestSetterType) {
        return InterestSetterType.LinearWithStorage;
    }

    // ========================= Internal Functions =========================

    function _snapshotExcessEarningsByMarketId(uint256 _marketId) internal {
        address token = DOLOMITE_MARGIN().getMarketTokenAddress(_marketId);
        Require.that(
            _tokenToExcessBalanceSnapshot[token].timestamp + 10 seconds <= block.timestamp,
            _FILE,
            "Already snapshot",
            _marketId
        );

        IDolomiteStructs.Wei memory excess = DOLOMITE_MARGIN().getNumExcessTokens(_marketId);
        _tokenToExcessBalanceSnapshot[token] = Snapshot({
            sign: excess.sign,
            value: uint128(excess.value), // safe cast
            timestamp: uint64(block.timestamp) // safe cast
        });
        emit MarketExcessBalanceSnapshot(_marketId, excess);
    }

    function _validateTokenForBerachain(address _token) internal view {
        uint256 marketId = DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token);
        uint8 tokenDecimals = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()))
            .getDecimalsByToken(_token);
        uint256 gasPrice = tx.gasprice;
        if (tokenDecimals < 18) {
            Snapshot memory snapshot = _tokenToExcessBalanceSnapshot[_token];
            IDolomiteStructs.Wei memory oldExcess = IDolomiteStructs.Wei({
                sign: snapshot.sign,
                value: snapshot.value
            });
            IDolomiteStructs.Wei memory diff = DOLOMITE_MARGIN().getNumExcessTokens(marketId).sub(oldExcess);

            if (!_isAcceptableDiff(diff) && gasPrice != 0) {
                uint256 tokenPrice = DOLOMITE_MARGIN().getMarketPrice(marketId).value;
                uint256 beraPrice = DOLOMITE_MARGIN().getMarketPrice(_WBERA_MARKET_ID).value;
                Require.that(
                    gasPrice * gasLimit * beraPrice / _ONE_BERA >= tokenPrice * _ONE_BERA / _ONE_DOLLAR,
                    _FILE,
                    "Gas price too low",
                    _token,
                    gasPrice
                );
            }
        }
    }

    function _getSettingsIfValid(address _token) internal view returns (Settings memory) {
        Settings memory settings = _tokenToSettingsMap[_token];
        Require.that(
            settings.optimalUtilization != 0,
            _FILE,
            "Invalid token",
            _token
        );

        return settings;
    }

    function _isAcceptableDiff(IDolomiteStructs.Wei memory _diff) internal pure returns (bool) {
        // _diff >= -1
        return _diff.sign || _diff.value <= 1;
    }
}
