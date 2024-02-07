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

import { Require } from "../protocol/lib/Require.sol";


/**
 * @title   TestRequire
 * @author  dYdX and Dolomite
 *
 * @notice  Contract for testing pure library functions
 */
contract TestRequire {

    // ============ Constants ============

    bytes32 internal constant _FILE = "TestRequire";

    // ============ Require Functions ============

    function RequireThat0(
        bytes32 reason
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason
        );
    }

    function RequireThat1(
        bytes32 reason,
        uint256 payloadA
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA
        );
    }

    function RequireThat2(
        bytes32 reason,
        uint256 payloadA,
        uint256 payloadB
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThat2IsTrue(
        bytes32 reason,
        uint256 payloadA,
        uint256 payloadB
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThatA0(
        bytes32 reason,
        address payloadA
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA
        );
    }

    function RequireThatA0IsTrue(
        bytes32 reason,
        address payloadA
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA
        );
    }

    function RequireThatA1(
        bytes32 reason,
        address payloadA,
        uint256 payloadB
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThatA1IsTrue(
        bytes32 reason,
        address payloadA,
        uint256 payloadB
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThatA2(
        bytes32 reason,
        address payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    function RequireThatA2IsTrue(
        bytes32 reason,
        address payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    function RequireThatB0(
        bytes32 reason,
        bytes32 payloadA
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA
        );
    }

    function RequireThatB0IsTrue(
        bytes32 reason,
        bytes32 payloadA
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA
        );
    }

    function RequireThatB2(
        bytes32 reason,
        bytes32 payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
    external
    pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(
            false,
            _FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    function RequireNotThatB2(
        bytes32 reason,
        bytes32 payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
    external
    pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(
            true,
            _FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }
}
