// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2023 Dolomite

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

import { UpgradeableAsyncIsolationModeWrapperTrader } from "../external/proxies/abstract/UpgradeableAsyncIsolationModeWrapperTrader.sol"; // solhint-disable-line max-line-length


/**
 * @title   TestAsyncUpgradeableIsolationModeWrapperTrader
 * @author  Dolomite
 *
 * @notice  A test contract for the UpgradeableAsyncIsolationModeWrapperTrader.sol contract
 */
contract TestAsyncUpgradeableIsolationModeWrapperTrader is UpgradeableAsyncIsolationModeWrapperTrader {

    // ======================== Constants ========================

    bytes32 private constant _INPUT_TOKEN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.inputToken")) - 1);

    // ======================== Storage ========================

    /// @dev Do not use storage like this in production contracts
    mapping (address => uint256) private _vaultToNonceMap;

    // ======================== Initializer ========================

    function initialize(address _inputToken, address _vaultFactory, address _dolomiteMargin) external initializer {
        _setAddress(_INPUT_TOKEN_SLOT, _inputToken);
        super._initializeWrapperTrader(_vaultFactory, _dolomiteMargin);
    }

    // ============ Public Functions ============

    function initiateCancelDeposit() external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function initializeWrapperTrader(address _vaultFactory, address _dolomiteMargin) external {
        super._initializeWrapperTrader(_vaultFactory, _dolomiteMargin);
    }

    function initiateCancelDeposit(bytes32 /* _key */) external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setDepositInfoAndReducePendingAmountFromUnwrapper(
        bytes32 /* _key */,
        uint256 /* _outputAmountDeltaWei */,
        DepositInfo calldata /* _depositInfo */
    ) external {
        // solhint-disable-previous-line no-empty-blocks
    }

    function isValidInputToken(address _inputToken) public override view returns (bool) {
        return _getAddress(_INPUT_TOKEN_SLOT) == _inputToken;
    }

    function getDepositInfo(bytes32 /* _key */) public pure returns (DepositInfo memory deposit) {
        return deposit;
    }

    // ================ Internal Functions ================

    function _createDepositWithExternalProtocol(
        address _vault,
        address /* _outputTokenUnderlying */,
        uint256 /* _minOutputAmount */,
        address /* _inputToken */,
        uint256 /* _inputAmount */,
        bytes memory /* _extraOrderData */
    ) internal override returns (bytes32 _depositKey) {
        _depositKey = keccak256(abi.encode(_vault, _vaultToNonceMap[_vault]++));
    }

    function _getExchangeCost(
        address,
        address,
        uint256 _desiredInputAmount,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256) {
        // 1:1 conversion for the sake of testing
        return _desiredInputAmount;
    }

    function _getMarketPriceForToken(address _token) private view returns (uint256) {
        return DOLOMITE_MARGIN().getMarketPrice(DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token)).value;
    }
}
