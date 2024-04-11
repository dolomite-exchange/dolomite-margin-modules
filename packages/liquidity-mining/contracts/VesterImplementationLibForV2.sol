// SPDX-License-Identifier: Apache-2.0
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
import { VesterImplementationV2 } from "./VesterImplementationV2.sol";


/**
 * @title   VesterImplementationLibForV2
 * @author  Dolomite
 *
 * A library contract for reducing code size of the VesterImplementationV2 contract.
 */
library VesterImplementationLibForV2 {

    // ===================================================
    // ==================== Constants ====================
    // ===================================================

    bytes32 private constant _FILE = "VesterImplementationLibForV2";
    uint256 private constant _MIN_VESTING_DURATION = 1 weeks;
    uint256 private constant _MAX_VESTING_DURATION = 40 weeks;
    uint256 private constant _OLD_MAX_VESTING_DURATION = 4 weeks;

    // ======================================================
    // ======================= Events =======================
    // ======================================================

    event PositionDurationExtended(uint256 indexed vestingId, uint256 newDuration);

    // ==================================================================
    // ======================= External Functions =======================
    // ==================================================================

    function extendDurationForPosition(
        VesterImplementationV2 _implementation,
        VesterImplementationV2.VestingPosition storage _vestingPosition,
        uint256 _nftId,
        uint256 _duration
    )
        public
    {
        address positionOwner = _implementation.ownerOf(_nftId);
        Require.that(
            positionOwner == msg.sender,
            _FILE,
            "Invalid position owner"
        );
        Require.that(
            _duration <= _MAX_VESTING_DURATION && _duration % _MIN_VESTING_DURATION == 0,
            _FILE,
            "Invalid duration"
        );
        Require.that(
            _vestingPosition.duration < _duration,
            _FILE,
            "Duration must be extended"
        );

        _vestingPosition.duration = _duration;
        emit PositionDurationExtended(_nftId, _duration);
    }

    function calculateEffectiveRate(
        VesterImplementationV2 _implementation,
        uint256 _duration,
        uint256 _nftId
    ) public view returns (uint256) {
        uint256 numberOfWeeks = _duration / _MIN_VESTING_DURATION;
        return 10_000 - (250 * numberOfWeeks);
    }

    function minVestingDuration() public pure returns (uint256) {
        return _MIN_VESTING_DURATION;
    }

    function maxVestingDuration() public pure returns (uint256) {
        return _MAX_VESTING_DURATION;
    }
}
