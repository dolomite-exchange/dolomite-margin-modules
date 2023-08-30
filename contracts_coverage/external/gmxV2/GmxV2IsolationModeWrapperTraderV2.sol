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

import { Require } from "../../protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTrader } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTrader.sol";
import { IGmxV2IsolationModeTokenVault } from "../interfaces/gmx/IGmxV2IsolationModeTokenVault.sol";
import { IsolationModeWrapperTraderV2 } from "../proxies/abstract/IsolationModeWrapperTraderV2.sol";

import { IDepositCallbackReceiver } from "../interfaces/gmx/IDepositCallbackReceiver.sol";
import { Deposit } from "../interfaces/gmx/Deposit.sol";
import { EventUtils } from "../interfaces/gmx/EventUtils.sol";

import { IWithdrawalCallbackReceiver } from "../interfaces/gmx/IWithdrawalCallbackReceiver.sol";
import { Withdrawal } from "../interfaces/gmx/Withdrawal.sol";

import "hardhat/console.sol";

/**
 * @title   GmxV2IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GM tokens (via depositing into GMX)
 */

contract GmxV2IsolationModeWrapperTraderV2 is IsolationModeWrapperTraderV2, IGmxV2IsolationModeWrapperTrader, IDepositCallbackReceiver, IWithdrawalCallbackReceiver  {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";

    IGmxRegistryV2 public immutable GMX_REGISTRY_V2; // solhint-disable-line var-name-mixedcase

    // =================================================
    // ================ Field Variables ================
    // =================================================

    mapping(bytes32 => address) public depositKeyToVault;

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyDepositHandler(address _from) {
        if (_from == address(GMX_REGISTRY_V2.gmxDepositHandler())) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(GMX_REGISTRY_V2.gmxDepositHandler()),
            _FILE,
            "Only deposit handler can call",
            _from
        );
        _;
    }

    modifier onlyWithdrawalHandler(address _from) {
        if (_from == address(GMX_REGISTRY_V2.gmxWithdrawalHandler())) { /* FOR COVERAGE TESTING */ }
        Require.that(_from == address(GMX_REGISTRY_V2.gmxWithdrawalHandler()),
            _FILE,
            "Only withdrawal handler can call",
            _from
        );
        _;
    }

    // ============ Constructor ============

    constructor(address _gmxRegistryV2, address _dGM, address _dolomiteMargin) IsolationModeWrapperTraderV2(_dGM, _dolomiteMargin) {
        GMX_REGISTRY_V2 = IGmxRegistryV2(_gmxRegistryV2);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    function isValidInputToken(address _inputToken) public view override returns (bool) {
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).initialLongToken();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).initialShortToken();
        return (_inputToken == longToken || _inputToken == shortToken);
    }

    // ============================================
    // ============ Internal Functions ============
    // ============================================

    function _exchangeIntoUnderlyingToken(
        address _tradeOriginator,
        address, // _receiver
        address _outputTokenUnderlying,
        uint256 _minOutputAmount,
        address _inputToken,
        uint256 _inputAmount,
        bytes memory // _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        address[] memory longTokenSwapPath = new address[](0);
        address[] memory shortTokenSwapPath = new address[](0);
        IGmxExchangeRouter exchangeRouter = GMX_REGISTRY_V2.gmxExchangeRouter();
        address depositVault = GMX_REGISTRY_V2.gmxDepositVault();
        uint256 bal = address(this).balance;

        exchangeRouter.sendWnt{value: bal}(depositVault, bal);
        IERC20(_inputToken).approve(address(GMX_REGISTRY_V2.gmxRouter()), _inputAmount);
        exchangeRouter.sendTokens(_inputToken, depositVault, _inputAmount);

        {
            IGmxExchangeRouter.CreateDepositParams memory depositParamsTest = IGmxExchangeRouter.CreateDepositParams(
                address(this), // receiver
                address(this), // callbackContract
                address(0), // uiFeeReceiver
                _outputTokenUnderlying, // market
                IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).initialLongToken(), // initialLongToken
                IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).initialShortToken(), // initialShortToken
                longTokenSwapPath,
                shortTokenSwapPath,
                _minOutputAmount,
                false, // shouldUnwrapNativeToken
                bal, // executionFee
                850000 // callbackGasLimit // @follow-up How much gas to spend?
            );
            // set skip transfer to true. Call factory then factory calls vault.
            // factory can only receive from trusted token converter
            bytes32 depositKey = exchangeRouter.createDeposit(depositParamsTest);
            depositKeyToVault[depositKey] = _tradeOriginator; // Vault contract
            emit DepositCreated(depositKey);
        }

        // Since we don't get output amount here, return minOutputAmount

        // call factory to set sourceIsWrapper
        // @audit Do we need to confirm if _tradeOriginator is a vault?
        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).setShouldSkipTransfer(_tradeOriginator, true);
        return _minOutputAmount;
    }

    function _getExchangeCost(
        address,
        address,
        uint256,
        bytes memory
    )
    internal
    override
    pure
    returns (uint256)
    {
        revert(string(abi.encodePacked(Require.stringifyTruncated(_FILE), ": getExchangeCost is not implemented")));
    }

    function afterDepositExecution(
        bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory eventData
    )
    external
    onlyDepositHandler(msg.sender) {
        if (depositKeyToVault[key] != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(depositKeyToVault[key] != address(0),
            _FILE,
            'Invalid deposit key'
        );

        uint256 len = eventData.uintItems.items.length;
        EventUtils.UintKeyValue memory receivedMarketTokens = eventData.uintItems.items[len-1];
        if (keccak256(abi.encodePacked(receivedMarketTokens.key)) == keccak256(abi.encodePacked('receivedMarketToken'))) { /* FOR COVERAGE TESTING */ }
        Require.that(keccak256(abi.encodePacked(receivedMarketTokens.key)) == keccak256(abi.encodePacked('receivedMarketToken')),
            _FILE,
            "Unexpected return data"
        );

        // adjust virtual GM token amount based on actual amount returned
        if (receivedMarketTokens.value > deposit.numbers.minMarketTokens) {
            IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).safeTransfer(depositKeyToVault[key], deposit.numbers.minMarketTokens);
            IERC20(VAULT_FACTORY.UNDERLYING_TOKEN()).approve(depositKeyToVault[key], receivedMarketTokens.value);
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).setSourceIsWrapper(depositKeyToVault[key], true);
            IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).depositIntoDolomiteMarginFromTokenConverter(
                depositKeyToVault[key],
                123,
                receivedMarketTokens.value - deposit.numbers.minMarketTokens
            );
            IGmxV2IsolationModeTokenVault(depositKeyToVault[key]).setVaultFrozen(false);
            // @todo check virtual vs real balance
        }
    }

    function afterDepositCancellation(
        bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory eventData
    )
    external
    onlyDepositHandler(msg.sender) {
        if (depositKeyToVault[key] != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(depositKeyToVault[key] != address(0),
            _FILE,
            'Invalid deposit key'
        );

        IGmxV2IsolationModeTokenVault vault = IGmxV2IsolationModeTokenVault(depositKeyToVault[key]);
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY));

        if (deposit.numbers.initialLongTokenAmount > 0) {
            IERC20(deposit.addresses.initialLongToken).approve(address(VAULT_FACTORY), deposit.numbers.initialLongTokenAmount);
            factory.depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                depositKeyToVault[key],
                123, // @todo Don't hardcode these values
                0,
                deposit.numbers.initialLongTokenAmount
            );
        }
        else {
            IERC20(deposit.addresses.initialShortToken).approve(address(VAULT_FACTORY), deposit.numbers.initialShortTokenAmount);
            factory.depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                depositKeyToVault[key],
                123,
                0,
                deposit.numbers.initialShortTokenAmount
            );
        }

        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).setShouldSkipTransfer(depositKeyToVault[key], true);
        factory.withdrawFromDolomiteMarginFromTokenConverter(
            depositKeyToVault[key],
            123,
            deposit.numbers.minMarketTokens
        );
        vault.setVaultFrozen(false);

        // @todo need to send execution fee back to user

        emit DepositCancelled(key);
        delete depositKeyToVault[key];
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyWithdrawalHandler(msg.sender) {}

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyWithdrawalHandler(msg.sender) {}

    function cancelDeposit(bytes32 _key) external {
        if (depositKeyToVault[_key] == msg.sender) { /* FOR COVERAGE TESTING */ }
        Require.that(depositKeyToVault[_key] == msg.sender,
            _FILE,
            "Only vault can cancel deposit"
        );
        GMX_REGISTRY_V2.gmxExchangeRouter().cancelDeposit(_key);
    }

    receive() external payable {}
}
