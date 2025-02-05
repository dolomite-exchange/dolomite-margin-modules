// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2024 Dolomite

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

pragma solidity ^0.8.9;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IChainlinkDataStreamsPriceOracle } from "../interfaces/IChainlinkDataStreamsPriceOracle.sol";
import { IVerifierFeeManager } from "../interfaces/IVerifierFeeManager.sol";
import { IVerifierProxy } from "../interfaces/IVerifierProxy.sol";


/**
 * @title   TestVerifierProxy
 * @author  Dolomite
 *
 * @notice  Test contract for Chainlink VerifierProxy
 */
contract TestVerifierProxy is IVerifierProxy {

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    bytes32 private constant _FILE = "TestVerifierProxy";

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    constructor () {
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    function verifyBulk(
        bytes[] calldata payloads,
        bytes calldata parameterPayloads
    ) external payable returns (bytes[] memory) {
        bytes[] memory verifiedReports = new bytes[](payloads.length);

        for (uint256 i; i < payloads.length; i++) {
            (, bytes memory reportBlob,,,) = abi.decode(
                payloads[i],
                (bytes32[3], bytes, bytes32[], bytes32[], bytes32)
            );

            verifiedReports[i] = reportBlob;
        }

        return verifiedReports;
    }

    function verify(
        bytes calldata payload,
        bytes calldata parameterPayload
    ) external payable returns (bytes memory) {
        (bytes32 feedId, uint256 price) = abi.decode(payload, (bytes32, uint256));

        IChainlinkDataStreamsPriceOracle.ReportDataV3 memory reportData = 
            IChainlinkDataStreamsPriceOracle.ReportDataV3({
                feedId: feedId,
                validFromTimestamp: uint32(block.timestamp),
                observationsTimestamp: uint32(block.timestamp),
                nativeFee: 0,
                linkFee: 0,
                expiresAt: uint32(block.timestamp + 1 days),
                benchmarkPrice: SafeCast.toInt192(SafeCast.toInt256(price)),
                bid: SafeCast.toInt192(SafeCast.toInt256(price)),
                ask: SafeCast.toInt192(SafeCast.toInt256(price))
        });
        return abi.encode(reportData);
    }

    function s_feeManager() external view returns (IVerifierFeeManager) {
        return IVerifierFeeManager(0x5ad1d6Ad0140243a7F924e7071bAe4949F1ad5f8);
    }
}
