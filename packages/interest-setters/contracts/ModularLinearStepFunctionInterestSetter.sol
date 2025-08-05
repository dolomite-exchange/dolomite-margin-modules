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

import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IModularLinearStepFunctionInterestSetter } from "./interfaces/IModularLinearStepFunctionInterestSetter.sol";
import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";


/**
 * @title   ModularLinearStepFunctionInterestSetter
 * @author  Dolomite
 *
 * @notice  Applies a linear utilization model to reach the optimal utilization until interest rates reach 90%
 *          utilization. Then interest rates scale linearly to 100% APR.
 */
contract ModularLinearStepFunctionInterestSetter is IModularLinearStepFunctionInterestSetter, OnlyDolomiteMargin {

    // =============== Constants ===============

    bytes32 private constant _FILE = "ModularLinearStepInterestSetter";
    uint256 public constant ONE_HUNDRED_PERCENT = 1 ether;
    uint256 public constant SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365;

    // =============== Field Variables ===============

    mapping (address => Settings) internal _tokenToSettingsMap;

    constructor(address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {}

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
}
