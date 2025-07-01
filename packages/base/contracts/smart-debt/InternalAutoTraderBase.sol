// SPDX-License-Identifier: GPL-3.0-or-later
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

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "../protocol/lib/Require.sol";
import { IInternalAutoTraderBase } from "./interfaces/IInternalAutoTraderBase.sol";


/**
 * @title   InternalAutoTraderBase
 * @author  Dolomite
 *
 * Base contract for performing internal trades
 */
abstract contract InternalAutoTraderBase is OnlyDolomiteMargin, Initializable, IInternalAutoTraderBase {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ========================================================
    // ====================== Constants =======================
    // ========================================================

    uint256 private constant _ONE = 1 ether;

    bytes32 private constant _FILE = "InternalAutoTraderBase";
    bytes32 private constant _INTERNAL_AUTO_TRADER_STORAGE_SLOT = bytes32(uint256(keccak256("eip1967.proxy.internalAutoTraderStorage")) - 1); // solhint-disable-line max-line-length

    IDolomiteRegistry public immutable DOLOMITE_REGISTRY;
    uint256 public immutable CHAIN_ID;

    // ========================================================
    // ===================== Constructor ========================
    // ========================================================

    /**
     * Constructor
     * 
     * @param  _chainId             The chain ID of the chain this contract is deployed on
     * @param  _dolomiteRegistry    The address of the Dolomite registry contract
     */
    constructor(
        uint256 _chainId,
        address _dolomiteRegistry
    ) {
        CHAIN_ID = _chainId;
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ========================================================
    // ================== External Functions ==================
    // ========================================================

    /// @inheritdoc IInternalAutoTraderBase
    function callFunction(
        address _sender,
        IDolomiteStructs.AccountInfo memory /* _accountInfo */,
        bytes memory _data
    ) public virtual onlyDolomiteMargin(msg.sender) {
        Require.that(
            DOLOMITE_REGISTRY.isTrustedInternalTradeCaller(_sender),
            _FILE,
            "Invalid sender"
        );
        _setTradeEnabled(abi.decode(_data, (bool)));
    }

    /// @inheritdoc IInternalAutoTraderBase
    function getTradeCost(
        uint256 _inputMarketId,
        uint256 _outputMarketId,
        IDolomiteStructs.AccountInfo memory _makerAccount,
        IDolomiteStructs.AccountInfo memory _takerAccount,
        IDolomiteStructs.Par memory _oldInputPar,
        IDolomiteStructs.Par memory _newInputPar,
        IDolomiteStructs.Wei memory _inputDeltaWei,
        bytes memory _data
    ) external virtual returns (IDolomiteStructs.AssetAmount memory);

    // ========================================================
    // ==================== Admin Functions ===================
    // ========================================================

    /// @inheritdoc IInternalAutoTraderBase
    function ownerSetGlobalFee(
        IDolomiteStructs.Decimal memory _globalFee
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGlobalFee(_globalFee);
    }

    /// @inheritdoc IInternalAutoTraderBase
    function ownerSetAdminFee(
        IDolomiteStructs.Decimal memory _adminFee
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetAdminFee(_adminFee);
    }

    // ========================================================
    // ==================== View Functions ====================
    // ========================================================

    /// @inheritdoc IInternalAutoTraderBase
    function createActionsForInternalTrade(
        CreateActionsForInternalTradeParams memory _params
    ) external view virtual returns (IDolomiteStructs.ActionArgs[] memory);

    /// @inheritdoc IInternalAutoTraderBase
    function globalFee() public view returns (IDolomiteStructs.Decimal memory) {
        return _getInternalTraderStorage().globalFee;
    }

    /// @inheritdoc IInternalAutoTraderBase
    function adminFee() public view returns (IDolomiteStructs.Decimal memory) {
        return _getInternalTraderStorage().adminFee;
    }

    /// @inheritdoc IInternalAutoTraderBase
    function getFees() public view returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        return _getFees();
    }

    /// @inheritdoc IInternalAutoTraderBase
    function tradeEnabled() public view returns (bool) {
        return _getInternalTraderStorage().tradeEnabled;
    }

    /// @inheritdoc IInternalAutoTraderBase
    function actionsLength(InternalTradeParams[] memory _trades) public pure virtual returns (uint256);

    // ========================================================
    // ================== Internal Functions ==================
    // ========================================================

    function _ownerSetGlobalFee(IDolomiteStructs.Decimal memory _globalFee) internal {
        _getInternalTraderStorage().globalFee = _globalFee;
        emit GlobalFeeSet(_globalFee);
    }

    function _ownerSetAdminFee(IDolomiteStructs.Decimal memory _adminFee) internal {
        _getInternalTraderStorage().adminFee = _adminFee;
        emit AdminFeeSet(_adminFee);
    }

    function _setTradeEnabled(bool _tradeEnabled) internal {
        _getInternalTraderStorage().tradeEnabled = _tradeEnabled;
    }

    function _getFees(
    ) internal view virtual returns (IDolomiteStructs.Decimal memory, IDolomiteStructs.Decimal memory) {
        InternalTraderBaseStorage storage internalTraderStorage = _getInternalTraderStorage();

        return (internalTraderStorage.adminFee, internalTraderStorage.globalFee);
    }

    function _getInternalTraderStorage(
    ) internal pure returns (InternalTraderBaseStorage storage internalTraderStorage) {
        bytes32 slot = _INTERNAL_AUTO_TRADER_STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            internalTraderStorage.slot := slot
        }
    }
}
