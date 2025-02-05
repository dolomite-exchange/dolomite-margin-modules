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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IChainlinkDataStreamsPriceOracle } from "./interfaces/IChainlinkDataStreamsPriceOracle.sol";
import { IOracleAggregatorV2 } from "./interfaces/IOracleAggregatorV2.sol";
import { IVerifierProxy } from "./interfaces/IVerifierProxy.sol";


/**
 * @title   ChainlinkDataStreamsPriceOracle
 * @author  Dolomite
 *
 * An implementation of the IDolomitePriceOracle interface that makes Chainlink datastream
 * prices compatible with the protocol.
 */
contract ChainlinkDataStreamsPriceOracle is IChainlinkDataStreamsPriceOracle, OnlyDolomiteMargin {
    using SafeERC20 for IERC20;

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChainlinkDataStreamsPriceOracle";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;
    uint8 private constant _DATA_STREAM_PRICE_DECIMALS = 18;

    // ========================= Storage =========================

    mapping(address => bytes32) private _tokenToFeedIdMap;
    mapping(bytes32 => address) private _feedIdToTokenMap;
    mapping(address => mapping(uint256 => uint256)) private _tokenToTimestampToPriceMap;

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
    IERC20 public immutable LINK;
    IVerifierProxy public immutable VERIFIER_PROXY;

    uint256 public stalenessThreshold;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param  _tokens                  The tokens that are supported by this adapter.
     * @param  _feedIds                 The Chainlink data stream IDs
     * @param  _dolomiteRegistry        The address of the DolomiteRegistry contract.
     * @param  _dolomiteMargin          The address of the DolomiteMargin contract.
     */
    constructor(
        address _link,
        address _verifierProxy,
        address[] memory _tokens,
        bytes32[] memory _feedIds,
        address _dolomiteRegistry,
        address _dolomiteMargin
    )
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        if (_tokens.length == _feedIds.length) { /* FOR COVERAGE TESTING */ }
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

        _ownerSetStalenessThreshold(10 seconds); // @follow-up Consider what time to use
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
        LINK = IERC20(_link);
        VERIFIER_PROXY = IVerifierProxy(_verifierProxy);

        address rewardManager = address(VERIFIER_PROXY.s_feeManager().i_rewardManager());
        LINK.approve(rewardManager, type(uint256).max);
    }

    // ========================= Admin Functions =========================

    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetStalenessThreshold(_stalenessThreshold);
    }

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

    // @todo Add whitelisted callers
    function postPrices(
        bytes[] memory _reports
    ) external {
        _validateReports(_reports);
        bytes[] memory verifierResponses = VERIFIER_PROXY.verifyBulk(
            _reports,
            abi.encode(address(LINK))
        );

        IOracleAggregatorV2 oracleAggregator = IOracleAggregatorV2(address(DOLOMITE_REGISTRY.oracleAggregator()));
        for (uint256 i; i < verifierResponses.length; i++) {
            ReportDataV3 memory reportData = abi.decode(verifierResponses[i], (ReportDataV3));

            address token = _feedIdToTokenMap[reportData.feedId];
            uint8 decimals = oracleAggregator.getDecimalsByToken(token);
            uint256 standardizedPrice = standardizeNumberOfDecimals(
                decimals,
                SafeCast.toUint256(int256(reportData.benchmarkPrice)),
                _DATA_STREAM_PRICE_DECIMALS
            );
            _tokenToTimestampToPriceMap[token][block.timestamp] = standardizedPrice;
        }
    }

    function getPrice(
        address _token
    ) public view returns (IDolomiteStructs.MonetaryPrice memory) {
        uint256 price = _tokenToTimestampToPriceMap[_token][block.timestamp];
        if (price != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(
            price != 0,
            _FILE,
            "Price not found",
            _token
        );

        return IDolomiteStructs.MonetaryPrice({
            value: price
        });
    }

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

    /**
     * Standardizes `value` to have `ONE_DOLLAR.decimals` - `tokenDecimals` number of decimals.
     */
    function standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _value,
        uint8 _valueDecimals
    )
        public
        pure
        returns (uint)
    {
        uint256 tokenDecimalsFactor = 10 ** uint256(_tokenDecimals);
        uint256 priceFactor = _ONE_DOLLAR / tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }

    // ========================= Internal Functions =========================

    function _validateReports(bytes[] memory _reports) internal view {
        for (uint256 i; i < _reports.length; i++) {
            (, bytes memory reportBlob,,,) = abi.decode(
                _reports[i],
                (bytes32[3], bytes, bytes32[], bytes32[], bytes32)
            );
            ReportDataV3 memory reportData = abi.decode(reportBlob, (ReportDataV3));

            address token = _feedIdToTokenMap[reportData.feedId];
            if (token != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(
                token != address(0),
                _FILE,
                "Invalid feed ID"
            );
            // @audit Need to make sure it isn't too old and think who can send what through. What to do if price already exists?
            if (_tokenToTimestampToPriceMap[token][block.timestamp] == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(
                _tokenToTimestampToPriceMap[token][block.timestamp] == 0,
                _FILE,
                "Price already set"
            );
            if (block.timestamp < reportData.observationsTimestamp + stalenessThreshold) { /* FOR COVERAGE TESTING */ }
            Require.that(
                block.timestamp < reportData.observationsTimestamp + stalenessThreshold,
                _FILE,
                "Report is too old"
            );
        }
    }

    function _ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
    internal
    {
        // @todo Add in checks for min and max
        stalenessThreshold = _stalenessThreshold;
        emit StalenessDurationUpdated(_stalenessThreshold);
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _feedId
    ) internal {
        _tokenToFeedIdMap[_token] = _feedId;
        _feedIdToTokenMap[_feedId] = _token;
        emit TokenInsertedOrUpdated(_token, _feedId);
    }
}
