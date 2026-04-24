// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2026 Dolomite.

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

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";
import { Require } from "../protocol/lib/Require.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { IDolomiteAutoTrader } from "../protocol/interfaces/IDolomiteAutoTrader.sol";
import { IDolomiteStructs } from  "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { IInternalTradeLiquidatorProxy } from "./interfaces/IInternalTradeLiquidatorProxy.sol";


/**
 * @title   InternalTradeLiquidatorProxy
 * @author  Dolomite
 *
 * @dev     FOR ARBITRUM ONLY
 *
 * Contract for performing liquidations via an internal trader
 */
contract InternalTradeLiquidatorProxy is OnlyDolomiteMargin, IInternalTradeLiquidatorProxy {
    using DecimalLib for uint256;
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "InternalTradeLiquidatorProxy";

    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";

    address public handler;
    bool private _isHandler;

    // ===================================================================
    // ========================== Constructor ============================
    // ===================================================================

    constructor(address _handler, address _dolomiteMargin) OnlyDolomiteMargin(_dolomiteMargin) {
        _ownerSetHandler(_handler);
    }

    // ===================================================================
    // ========================== Admin Functions ========================
    // ===================================================================

    function ownerSetHandler(address _handler) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetHandler(_handler);
    }

    // ===================================================================
    // ========================== Public Functions =======================
    // ===================================================================

    function liquidate(
        IDolomiteStructs.AccountInfo memory _solidAccount,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _collateralMarketId,
        uint256 _debtMarketId,
        uint256 _inputAmount,
        uint256 _minOutputAmount
    ) external {
        if (msg.sender == handler && _solidAccount.owner == msg.sender) { /* FOR COVERAGE TESTING */ }
        Require.that(
            msg.sender == handler && _solidAccount.owner == msg.sender,
            _FILE,
            "Invalid sender"
        );
        if (!_isIsolationModeAsset(DOLOMITE_MARGIN().getMarketTokenAddress(_collateralMarketId))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !_isIsolationModeAsset(DOLOMITE_MARGIN().getMarketTokenAddress(_collateralMarketId)),
            _FILE,
            "Invalid collateral market"
        );

        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](2);
        accounts[0] = _solidAccount;
        accounts[1] = _liquidAccount;

        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](1);
        actions[0] = IDolomiteStructs.ActionArgs({
            actionType: IDolomiteStructs.ActionType.Trade,
            accountId: 0,
            amount: IDolomiteStructs.AssetAmount({
                sign: true,
                denomination: IDolomiteStructs.AssetDenomination.Wei,
                ref: _inputAmount == type(uint256).max ? IDolomiteStructs.AssetReference.Target : IDolomiteStructs.AssetReference.Delta,
                value: _inputAmount == type(uint256).max ? 0 : _inputAmount
            }),
            primaryMarketId: _debtMarketId,
            secondaryMarketId: _collateralMarketId,
            otherAddress: address(this),
            otherAccountId: 1,
            data: abi.encode(_minOutputAmount)
        });

        _isHandler = true; // set this to true so the internal trade can occur
        DOLOMITE_MARGIN().operate(accounts, actions);
        _isHandler = false;
    }


    /**
     * Allows traders to make trades approved by this smart contract. The active trader's account is
     * the takerAccount and the passive account (for which this contract approves trades
     * on-behalf-of) is the makerAccount.
     *
     * @param  _inputMarketId   The market for which the trader specified the original amount (debt market)
     * @param  _outputMarketId  The market for which the trader wants the resulting amount specified (collateral market)
     * @param  _makerAccount    The account for which this contract is making trades
     * @param  _inputDeltaWei   The change in token amount for the makerAccount for the inputMarketId
     * @return                  The AssetAmount for the makerAccount for the outputMarketId
     */
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo calldata _makerAccount,
        IDolomiteStructs.AccountInfo calldata _takerAccount,
        IDolomiteStructs.Par calldata /* _oldInputPar */,
        IDolomiteStructs.Par calldata /* _newInputPar */,
        IDolomiteStructs.Wei calldata _inputDeltaWei,
        bytes calldata _data
    ) external onlyDolomiteMargin(msg.sender) returns (IDolomiteStructs.AssetAmount memory) {
        if (_isHandler) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _isHandler,
            _FILE,
            "Invalid caller"
        );
        if (!_isCollateralized(_makerAccount)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            !_isCollateralized(_makerAccount),
            _FILE,
            "Account is healthy"
        );

        uint256 collateralMarket = _outputMarketId;
        uint256 debtMarket = _inputMarketId;
        IDolomiteStructs.AccountInfo memory makerAccount = _makerAccount;
        IDolomiteStructs.AccountInfo memory takerAccount = _takerAccount;

        (uint256 heldPrice, uint256 owedPriceAdj) = _getHeldAndOwedPriceAdj(collateralMarket, debtMarket);
        uint256 liquidHeldWei = DOLOMITE_MARGIN().getAccountWei(makerAccount, collateralMarket).value;
        uint256 liquidOwedWei = DOLOMITE_MARGIN().getAccountWei(makerAccount, debtMarket).value;

        if (_inputDeltaWei.isPositive() && _inputDeltaWei.value <= liquidOwedWei) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _inputDeltaWei.isPositive() && _inputDeltaWei.value <= liquidOwedWei,
            _FILE,
            "Cannot overliquidate"
        );

        uint256 liquidationAmount = _inputDeltaWei.value;
        uint256 heldReward = liquidationAmount * owedPriceAdj / heldPrice;
        if (heldReward > liquidHeldWei) {
            heldReward = liquidHeldWei;
        }

        if (heldReward >= abi.decode(_data, (uint256))) { /* FOR COVERAGE TESTING */ }
        Require.that(
            heldReward >= abi.decode(_data, (uint256)),
            _FILE,
            "Insufficient output amount"
        );

        emit Liquidation(
            takerAccount.owner,
            takerAccount.number,
            makerAccount.owner,
            makerAccount.number,
            collateralMarket,
            debtMarket,
            heldReward,
            liquidationAmount
        );
        return IDolomiteStructs.AssetAmount({
            sign: false,
            denomination: IDolomiteStructs.AssetDenomination.Wei,
            ref: IDolomiteStructs.AssetReference.Delta,
            value: heldReward
        });
    }

    // ===================================================================
    // ========================= Internal Functions ======================
    // ===================================================================

    function _ownerSetHandler(address _handler) internal {
        if (_handler != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(
            _handler != address(0),
            _FILE,
            "Invalid handler"
        );

        handler = _handler;
        emit HandlerSet(_handler);
    }

    function _isCollateralized(IDolomiteStructs.AccountInfo memory _makerAccount) internal view returns (bool) {
        (
            IDolomiteStructs.MonetaryValue memory supply,
            IDolomiteStructs.MonetaryValue memory borrow
        ) = DOLOMITE_MARGIN().getAdjustedAccountValues(_makerAccount);
        IDolomiteStructs.Decimal memory requiredRatio = DOLOMITE_MARGIN().getMarginRatio();

        return supply.value >= borrow.value + borrow.value.mul(requiredRatio);
    }

    function _getHeldAndOwedPriceAdj(uint256 _collateralMarket, uint256 _debtMarket) internal view returns (uint256, uint256) {
        IDolomiteStructs.Decimal memory spread = DOLOMITE_MARGIN().getLiquidationSpreadForPair(
            _collateralMarket,
            _debtMarket
        );

        IDolomiteStructs.MonetaryPrice memory heldPrice = DOLOMITE_MARGIN().getMarketPrice(_collateralMarket);
        IDolomiteStructs.MonetaryPrice memory owedPrice = DOLOMITE_MARGIN().getMarketPrice(_debtMarket);
        owedPrice.value = owedPrice.value + owedPrice.value.mul(spread);

        return (heldPrice.value, owedPrice.value);
    }

    function _isIsolationModeAsset(address _token) internal view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _token,
            IERC20Metadata(address(0)).name.selector,
            bytes("")
        );
        if (!isSuccess) {
            return false;
        }

        string memory name = abi.decode(returnData, (string));
        if (keccak256(bytes(name)) == DOLOMITE_FS_GLP_HASH) {
            return true;
        }
        return _startsWith(DOLOMITE_ISOLATION_PREFIX, name);
    }

    function _startsWith(string memory _start, string memory _str) internal pure returns (bool) {
        if (bytes(_start).length > bytes(_str).length) {
            return false;
        }

        bytes32 hash;
        assembly {
            let size := mload(_start)
            hash := keccak256(add(_str, 32), size)
        }
        return hash == keccak256(bytes(_start));
    }
}
