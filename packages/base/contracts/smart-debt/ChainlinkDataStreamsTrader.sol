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
import { InternalAutoTraderBase } from "./InternalAutoTraderBase.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IChainlinkDataStreamsTrader } from "./interfaces/IChainlinkDataStreamsTrader.sol";
import { IVerifierProxy } from "./interfaces/IVerifierProxy.sol";


/**
 * @title   ChainlinkDataStreamsTrader
 * @author  Dolomite
 *
 * 
 */
abstract contract ChainlinkDataStreamsTrader is InternalAutoTraderBase, IChainlinkDataStreamsTrader {
    using SafeERC20 for IERC20;

    // ========================= Constants =========================

    bytes32 private constant _FILE = "ChainlinkDataStreamsTrader";
    bytes32 private constant _CHAINLINK_DATA_STREAMS_TRADER_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.chainlinkDataStreamsTraderStorage")) - 1); // solhint-disable-line max-line-length

    uint256 internal constant _ONE_DOLLAR = 10 ** 36;
    uint8 internal constant _DATA_STREAM_PRICE_DECIMALS = 18;

    IERC20 public immutable LINK;
    IVerifierProxy public immutable VERIFIER_PROXY;

    // ========================= Constructor =========================

    constructor(
        address _link,
        address _verifierProxy,
        uint256 _chainId,
        address _dolomiteRegistry
    ) InternalAutoTraderBase(_chainId, _dolomiteRegistry) {
        LINK = IERC20(_link);
        VERIFIER_PROXY = IVerifierProxy(_verifierProxy);
    }

    function _ChainlinkDataStreamsTrader__initialize(
        address[] memory _tokens,
        bytes32[] memory _feedIds
    ) internal {
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
        return _getChainlinkDataStreamsTraderStorage().tokenToFeedIdMap[_token];
    }

    function feedIdToToken(
        bytes32 _feedId
    ) public view returns (address) {
        return _getChainlinkDataStreamsTraderStorage().feedIdToTokenMap[_feedId];
    }

    function getLatestReport(
        address _token
    ) public view returns (LatestReport memory) {
        return _getChainlinkDataStreamsTraderStorage().tokenToLatestReport[_token];
    }

    function _postPrices(
        bytes[] memory _reports
    ) internal {
        ChainlinkDataStreamsTraderStorage storage $ = _getChainlinkDataStreamsTraderStorage();

        bytes[] memory verifierResponses = VERIFIER_PROXY.verifyBulk(
            _reports,
            abi.encode(address(LINK))
        );

        for (uint256 i; i < verifierResponses.length; i++) {
            ReportDataV3 memory reportData = abi.decode(verifierResponses[i], (ReportDataV3));

            address token = $.feedIdToTokenMap[reportData.feedId];
            Require.that(
                token != address(0),
                _FILE,
                "Invalid feed ID"
            );

            if (reportData.observationsTimestamp > $.tokenToLatestReport[token].timestamp) {
                $.tokenToLatestReport[token] = LatestReport({
                    timestamp: reportData.observationsTimestamp,
                    bid: _safeInt192ToUint256(reportData.bid),
                    ask: _safeInt192ToUint256(reportData.ask),
                    benchmarkPrice: _safeInt192ToUint256(reportData.benchmarkPrice)
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
    ) internal pure returns (uint) {
        uint256 tokenDecimalsFactor = 10 ** uint256(_tokenDecimals);
        uint256 priceFactor = _ONE_DOLLAR / tokenDecimalsFactor;
        uint256 valueFactor = 10 ** uint256(_valueDecimals);
        return _value * priceFactor / valueFactor;
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        bytes32 _feedId
    ) internal {
        ChainlinkDataStreamsTraderStorage storage $ = _getChainlinkDataStreamsTraderStorage();
        $.tokenToFeedIdMap[_token] = _feedId;
        $.feedIdToTokenMap[_feedId] = _token;
        // emit TokenInsertedOrUpdated(_token, _feedId);
    }

    function _safeInt192ToUint256(
        int192 _value
    ) internal pure returns (uint256) {
        Require.that(
            _value >= 0,
            _FILE,
            "Value is negative"
        );
        return uint256(uint192(_value));
    }

    function _getChainlinkDataStreamsTraderStorage(
    ) internal pure returns (ChainlinkDataStreamsTraderStorage storage $) {
        bytes32 slot = _CHAINLINK_DATA_STREAMS_TRADER_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            $.slot := slot
        }
    }
}
