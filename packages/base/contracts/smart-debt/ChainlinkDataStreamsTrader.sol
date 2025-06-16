// SPDX-License-Identifier: Apache-2.0
/*

    Copyright 2025 Dolomite.

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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IVerifierProxy } from "./interfaces/IVerifierProxy.sol";
import { Require } from "../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IChainlinkDataStreamsHandler } from "./interfaces/IChainlinkDataStreamsHandler.sol";
import { InternalAutoTraderBase } from "../traders/InternalAutoTraderBase.sol";


/**
 * @title   ChainlinkDataStreamsHandler
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink datastream
 */
abstract contract ChainlinkDataStreamsTrader is InternalAutoTraderBase, IChainlinkDataStreamsHandler {
    using SafeERC20 for IERC20;

    struct LatestReport {
        uint64 timestamp;
        bytes report;
    }

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChainlinkDataStreamsTrader";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _DATA_STREAM_PRICE_DECIMALS = 18;

    // ========================= Storage =========================

    IERC20 public immutable LINK;
    IVerifierProxy public immutable VERIFIER_PROXY;

    mapping(address => bytes32) private _tokenToFeedIdMap;
    mapping(bytes32 => address) private _feedIdToTokenMap;
    mapping(address => LatestReport) private _tokenToLatestReport;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _feedIds                 The Chainlink data stream IDs
     */
    constructor(
        address _link,
        address _verifierProxy,
        address[] memory _tokens,
        bytes32[] memory _feedIds,
        uint256 _chainId,
        address _dolomiteRegistry
    ) InternalAutoTraderBase(_chainId, _dolomiteRegistry) {
        Require.that(
            _tokens.length == _feedIds.length,
            _FILE,
            "Invalid tokens length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracleToken(
                _tokens[i],
                _feedIds[i]
            );
        }

        LINK = IERC20(_link);
        VERIFIER_PROXY = IVerifierProxy(_verifierProxy);

        address rewardManager = address(VERIFIER_PROXY.s_feeManager().i_rewardManager());
        LINK.approve(rewardManager, type(uint256).max);
    }

    // ========================= Admin Functions =========================

    function ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _feedId
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerInsertOrUpdateOracleToken(
            _token,
            _feedId
        );
    }

    function ownerApproveLink(
        address _spender,
        uint256 _amount
    ) external onlyDolomiteMarginOwner(msg.sender) {
        LINK.safeApprove(_spender, _amount);
    }

    function ownerWithdrawLink(
        address _recipient,
        uint256 _amount
    ) external onlyDolomiteMarginOwner(msg.sender) {
        LINK.safeTransfer(_recipient, _amount);
    }

    // ========================= Public Functions =========================

    function tokenToFeedId(
        address _token
    ) public view returns (bytes32) {
        return _tokenToFeedIdMap[_token];
    }

    function feedIdToToken(
        bytes32 _feedId
    ) public view returns (address) {
        return _feedIdToTokenMap[_feedId];
    }

    function _postPrices(
        bytes[] memory _reports
    ) internal {
        _validateReports(_reports);
        bytes[] memory verifierResponses = VERIFIER_PROXY.verifyBulk(
            _reports,
            abi.encode(address(LINK))
        );

        for (uint256 i; i < verifierResponses.length; i++) {
            ReportDataV3 memory reportData = abi.decode(verifierResponses[i], (ReportDataV3));

            address token = _feedIdToTokenMap[reportData.feedId];
            if (reportData.observationsTimestamp > _tokenToLatestReport[token].timestamp) {
                _tokenToLatestReport[token] = LatestReport({
                    timestamp: reportData.observationsTimestamp,
                    report: verifierResponses[i]
                });
            }
        }
    }

    // ======================================================================
    // ========================= Internal Functions =========================
    // ======================================================================

    /**
     * Standardizes `value` to have `ONE_DOLLAR.decimals` - `tokenDecimals` number of decimals.
     */
    function _standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _value,
        uint8 _valueDecimals
    ) private pure returns (uint) {
        uint256 tokenDecimalsFactor = 10 ** uint256(_tokenDecimals);
        uint256 priceFactor = _ONE_DOLLAR / tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }

    function _validateReports(bytes[] memory _reports) internal view {
        for (uint256 i; i < _reports.length; i++) {
            (, bytes memory reportBlob,,,) = abi.decode(
                _reports[i],
                (bytes32[3], bytes, bytes32[], bytes32[], bytes32)
            );
            ReportDataV3 memory reportData = abi.decode(reportBlob, (ReportDataV3));

            address token = _feedIdToTokenMap[reportData.feedId];
            Require.that(
                token != address(0),
                _FILE,
                "Invalid feed ID"
            );
        }
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _feedId
    ) internal {
        _tokenToFeedIdMap[_token] = _feedId;
        _feedIdToTokenMap[_feedId] = _token;
        // emit TokenInsertedOrUpdated(_token, _feedId);
    }
}
