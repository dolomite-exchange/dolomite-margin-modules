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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IGmxV2IsolationModeVaultFactory } from "../interfaces/gmx/IGmxV2IsolationModeVaultFactory.sol";
import { IGmxV2IsolationModeWrapperTraderV2 } from "../interfaces/gmx/IGmxV2IsolationModeWrapperTraderV2.sol";
import { IGmxV2IsolationModeTokenVault } from "../interfaces/gmx/IGmxV2IsolationModeTokenVault.sol";
import { IsolationModeWrapperTraderV2 } from "../proxies/abstract/IsolationModeWrapperTraderV2.sol";

import { Deposit } from "../interfaces/gmx/GmxDeposit.sol";
import { EventUtils } from "../interfaces/gmx/GmxEventUtils.sol";
import { Withdrawal } from "../interfaces/gmx/GmxWithdrawal.sol";
import { IGmxExchangeRouter } from "../interfaces/gmx/IGmxExchangeRouter.sol";
import { IGmxDepositCallbackReceiver } from "../interfaces/gmx/IGmxDepositCallbackReceiver.sol";
import { IGmxRegistryV2 } from "../interfaces/gmx/IGmxRegistryV2.sol";


/**
 * @title   GmxV2IsolationModeWrapperTraderV2
 * @author  Dolomite
 *
 * @notice  Used for wrapping GMX GM tokens (via depositing into GMX)
 */

contract GmxV2IsolationModeWrapperTraderV2 is 
    IsolationModeWrapperTraderV2,
    IGmxV2IsolationModeWrapperTraderV2,
    IGmxDepositCallbackReceiver
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 private constant _FILE = "GmxV2IsolationModeWrapperV2";

    IGmxRegistryV2 public immutable GMX_REGISTRY_V2; // solhint-disable-line var-name-mixedcase
    bytes32 private constant _DEPOSIT_INFO_SLOT = bytes32(uint256(keccak256("eip1967.proxy.depositInfo")) - 1);
    bytes32 private constant _HANDLERS_SLOT = bytes32(uint256(keccak256("eip1967.proxy.handlers")) - 1);

    // ===================================================
    // ==================== Modifiers ====================
    // ===================================================

    modifier onlyHandler(address _from) {
        Require.that(
            getHandlerStatus(_from),
            _FILE,
            "Only handler can call",
            _from
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        address _gmxRegistryV2,
        address _dGM,
        address _dolomiteMargin
    ) IsolationModeWrapperTraderV2(_dGM, _dolomiteMargin) {
        GMX_REGISTRY_V2 = IGmxRegistryV2(_gmxRegistryV2);
    }

    // ============================================
    // ============= Public Functions =============
    // ============================================

    receive() external payable {}

    function afterDepositExecution(
        bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory eventData
    ) 
    external 
    onlyHandler(msg.sender) {
        DepositInfo storage depositInfo = _getDepositSlot(key);
        Require.that(
            depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        // @follow-up EventData is weird so we should discuss
        uint256 len = eventData.uintItems.items.length;
        EventUtils.UintKeyValue memory receivedMarketTokens = eventData.uintItems.items[len-1];
        Require.that(
            keccak256(abi.encodePacked(receivedMarketTokens.key)) == keccak256(abi.encodePacked("receivedMarketToken")),
            _FILE,
            "Unexpected return data"
        );

        IERC20 underlyingToken = IERC20(VAULT_FACTORY.UNDERLYING_TOKEN());
        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY));

        underlyingToken.safeTransfer(depositInfo.vault, deposit.numbers.minMarketTokens);
        if (receivedMarketTokens.value > deposit.numbers.minMarketTokens) {
            uint256 diff = receivedMarketTokens.value - deposit.numbers.minMarketTokens;
            underlyingToken.approve(depositInfo.vault, diff);

            factory.depositIntoDolomiteMarginFromTokenConverter(
                depositInfo.vault,
                depositInfo.accountNumber,
                diff
            ); 
        }

        factory.setVaultFrozen(depositInfo.vault, false);
        depositInfo.vault = address(0);
        depositInfo.accountNumber = 0;
        emit DepositExecuted(key);
    }

    function afterDepositCancellation(
        bytes32 key,
        Deposit.Props memory deposit,
        EventUtils.EventLogData memory // eventData
    ) 
    external 
    onlyHandler(msg.sender) {
        DepositInfo storage depositInfo = _getDepositSlot(key);
        Require.that(
            depositInfo.vault != address(0),
            _FILE,
            "Invalid deposit key"
        );

        IGmxV2IsolationModeVaultFactory factory = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY));

        if (deposit.numbers.initialLongTokenAmount > 0) {
            _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                deposit.addresses.initialLongToken,
                deposit.numbers.initialLongTokenAmount,
                depositInfo,
                factory
            );
        }
        else {
            _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
                deposit.addresses.initialShortToken,
                deposit.numbers.initialShortTokenAmount,
                depositInfo,
                factory
            );
        }

        factory.setShouldSkipTransfer(depositInfo.vault, true);
        factory.withdrawFromDolomiteMarginFromTokenConverter(
            depositInfo.vault,
            depositInfo.accountNumber, 
            deposit.numbers.minMarketTokens
        );
        factory.setVaultFrozen(depositInfo.vault, false);

        depositInfo.vault = address(0);
        depositInfo.accountNumber = 0;
        emit DepositCancelled(key);
    }

    function cancelDeposit(bytes32 _key) external {
        DepositInfo memory depositInfo = _getDepositSlot(_key);
        Require.that(
            depositInfo.vault == msg.sender,
            _FILE,
            "Only vault can cancel deposit"
        );
        GMX_REGISTRY_V2.gmxExchangeRouter().cancelDeposit(_key);
    }

    function setHandlerStatus(address _address, bool _status) external onlyDolomiteMarginOwner(msg.sender) {
        _setHandlerStatus(_address, _status);
    }

    function ownerWithdrawETH(address _receiver) external onlyDolomiteMarginOwner(msg.sender) {
        uint256 bal = address(this).balance;
        (bool success, ) = payable(_receiver).call{value: bal}("");
        Require.that(
            success,
            _FILE,
            "Unable to withdraw funds"
        );
    }

    function isValidInputToken(address _inputToken) public view override returns (bool) {
        address longToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).longToken();
        address shortToken = IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).shortToken();
        return (_inputToken == longToken || _inputToken == shortToken);
    }

    function getHandlerStatus(address _address) public view returns (bool) {
        bytes32 slot = keccak256(abi.encodePacked(_HANDLERS_SLOT, _address));
        return _getUint256(slot) == 1;
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
        bytes memory _extraOrderData
    )
        internal
        override
        returns (uint256)
    {
        IGmxExchangeRouter exchangeRouter = GMX_REGISTRY_V2.gmxExchangeRouter();
        uint256 bal = address(this).balance;

        {
            address depositVault = GMX_REGISTRY_V2.gmxDepositVault();
            exchangeRouter.sendWnt{value: bal}(depositVault, bal);
            IERC20(_inputToken).approve(address(GMX_REGISTRY_V2.gmxRouter()), _inputAmount);
            exchangeRouter.sendTokens(_inputToken, depositVault, _inputAmount);
        }

        {
            IGmxExchangeRouter.CreateDepositParams memory depositParamsTest = IGmxExchangeRouter.CreateDepositParams(
                address(this), // receiver
                address(this), // callbackContract
                address(0), // uiFeeReceiver
                _outputTokenUnderlying, // market
                IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).longToken(), // initialLongToken
                IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).shortToken(), // initialShortToken
                new address[](0), // longTokenSwapPath
                new address[](0), // shortTokenSwapPath
                _minOutputAmount,
                false, // shouldUnwrapNativeToken
                bal, // executionFee
                1500000 // callbackGasLimit // @follow-up How much gas to spend? Should this be in extraOrderData
            );

            bytes32 depositKey = exchangeRouter.createDeposit(depositParamsTest);
            // @audit Do we trust this extraOrderData
            _setDepositInfo(depositKey, DepositInfo(_tradeOriginator, abi.decode(_extraOrderData, (uint256))));
            emit DepositCreated(depositKey);
        }

        // @audit Do we need to confirm if _tradeOriginator is a vault?
        IGmxV2IsolationModeVaultFactory(address(VAULT_FACTORY)).setShouldSkipTransfer(_tradeOriginator, true);
        return _minOutputAmount;
    }

    function _depositOtherTokenIntoDolomiteMarginFromTokenConverter(
        address _token,
        uint256 _amount,
        DepositInfo memory _info,
        IGmxV2IsolationModeVaultFactory factory
    ) internal {
        IERC20(_token).approve(address(factory), _amount);
        factory.depositOtherTokenIntoDolomiteMarginFromTokenConverter(
            _info.vault,
            _info.accountNumber, 
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(_token),
            _amount
        );
    }

    function _setHandlerStatus(address _address, bool _status) internal {
        bytes32 slot =  keccak256(abi.encodePacked(_HANDLERS_SLOT, _address));
        _setUint256(slot, _status ? 1 : 0);
    }

    function _setDepositInfo(bytes32 _key, DepositInfo memory _info) internal {
        DepositInfo storage storageInfo = _getDepositSlot(_key);
        storageInfo.vault = _info.vault;
        storageInfo.accountNumber = _info.accountNumber;
    }

    function _getDepositSlot(bytes32 _key) internal pure returns (DepositInfo storage info) {
        bytes32 slot = keccak256(abi.encodePacked(_DEPOSIT_INFO_SLOT, _key));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            info.slot := slot
        }
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

}