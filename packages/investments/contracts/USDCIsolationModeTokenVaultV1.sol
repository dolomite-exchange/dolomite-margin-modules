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

import { IDolomiteRegistry } from "@dolomite-exchange/modules-base/contracts/interfaces/IDolomiteRegistry.sol";
import { IGenericTraderBase } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderBase.sol";
import { IGenericTraderProxyV1 } from "@dolomite-exchange/modules-base/contracts/interfaces/IGenericTraderProxyV1.sol";
import { IsolationModeTokenVaultV1 } from "@dolomite-exchange/modules-base/contracts/isolation-mode/abstract/IsolationModeTokenVaultV1.sol"; // solhint-disable-line max-line-length
import { AccountActionLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountActionLib.sol";
import { AccountBalanceLib } from "@dolomite-exchange/modules-base/contracts/lib/AccountBalanceLib.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAaveLendingPool } from "./interfaces/IAaveLendingPool.sol";
import { IUSDCIsolationModeVaultFactory } from "./interfaces/IUSDCIsolationModeVaultFactory.sol";
import { IUSDCRegistry } from "./interfaces/IUSDCRegistry.sol";


/**
 * @title   USDCIsolationModeTokenVaultV1
 * @author  Dolomite
 *
 * @notice  A implementation (for an upgradeable proxy) for wrapping tokens via a per-user vault that can be used
 *          with DolomiteMargin
 */
contract USDCIsolationModeTokenVaultV1 is IsolationModeTokenVaultV1 {
    using SafeERC20 for IERC20;

    // ==================================================================
    // =========================== Constants ============================
    // ==================================================================

    bytes32 private constant _FILE = "USDCStrategyUserVaultV1";

    enum Strategy {
        NONE,
        AAVE
    }

    mapping(uint256 => Strategy) public accountNumberToStrategy;

    function registry() public view returns (IUSDCRegistry) {
        return IUSDCIsolationModeVaultFactory(VAULT_FACTORY()).usdcRegistry();
    }

    function dolomiteRegistry()
        public
        override
        view
        returns (IDolomiteRegistry)
    {
        return registry().dolomiteRegistry();
    }

    function borrowToIncreaseStrategySize(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        Strategy _strategy,
        uint256 _amountToBorrow,
        bytes calldata _data
    ) external onlyVaultOwner(msg.sender) {
        Require.that(
            _fromAccountNumber != 0 && _toAccountNumber != 0,
            _FILE,
            "Invalid account number"
        );

        if (accountNumberToStrategy[_toAccountNumber] == Strategy.NONE) {
            accountNumberToStrategy[_toAccountNumber] = _strategy;
        } else {
            Require.that(
                accountNumberToStrategy[_toAccountNumber] == _strategy,
                _FILE,
                "Account already used"
            );
        }

        // @follow-up Do I need other checks here like in other vault functions?
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            address(this),
            _fromAccountNumber,
            address(this),
            _toAccountNumber,
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN()),
            IDolomiteStructs.AssetDenomination.Wei,
            _amountToBorrow,
            AccountBalanceLib.BalanceCheckFlag.None
        );
        _executeSimpleWrap(_toAccountNumber, _amountToBorrow, _data, AccountBalanceLib.BalanceCheckFlag.To);

        if (_strategy == Strategy.AAVE) {
            _investInAave(_amountToBorrow);
        }
    }

    function transferToIncreaseStrategySize(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        Strategy _strategy,
        uint256 _amount,
        bytes memory _data
    ) external onlyVaultOwner(msg.sender) {
        Require.that(
            _toAccountNumber != 0,
            _FILE,
            "Invalid account number"
        );

        // @audit What if a user transfers money to the subaccount prior to setting a strategy?
        if (accountNumberToStrategy[_toAccountNumber] == Strategy.NONE) {
            accountNumberToStrategy[_toAccountNumber] = _strategy;
        } else {
            Require.that(
                accountNumberToStrategy[_toAccountNumber] == _strategy,
                _FILE,
                "Account already used"
            );
        }

        _transferIntoPositionWithOtherToken(
            _fromAccountNumber,
            _toAccountNumber,
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN()),
            _amount,
            AccountBalanceLib.BalanceCheckFlag.Both
        );
        _executeSimpleWrap(_toAccountNumber, _amount, _data, AccountBalanceLib.BalanceCheckFlag.Both);


        if (_strategy == Strategy.AAVE) {
            _investInAave(_amount);
        }
    }

    function decreaseStrategySizeAndTransfer(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        Strategy _strategy,
        uint256 _amount,
        bytes calldata _data
    ) external onlyVaultOwner(msg.sender) {
        Require.that(
            accountNumberToStrategy[_fromAccountNumber] == _strategy,
            _FILE,
            "Strategy does not match"
        );

        if (_strategy == Strategy.AAVE) {
            _withdrawFromAave(_amount);
        }
        _executeSimpleUnwrap(_fromAccountNumber, _amount, _data, AccountBalanceLib.BalanceCheckFlag.Both);
        _transferFromPositionWithOtherToken(
            _fromAccountNumber,
            _toAccountNumber,
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN()),
            _amount,
            AccountBalanceLib.BalanceCheckFlag.None
        );
    }

    function decreaseStrategySizeAndRepayDebt(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        Strategy _strategy,
        uint256 _amount,
        bytes calldata _data
    ) external onlyVaultOwner(msg.sender) {
        Require.that(
            accountNumberToStrategy[_fromAccountNumber] == _strategy,
            _FILE,
            "Strategy does not match"
        );

        if (_strategy == Strategy.AAVE) {
            _withdrawFromAave(_amount);
        }
        _executeSimpleUnwrap(_fromAccountNumber, _amount, _data, AccountBalanceLib.BalanceCheckFlag.From);
        AccountActionLib.transfer(
            DOLOMITE_MARGIN(),
            address(this),
            _fromAccountNumber,
            address(this),
            _toAccountNumber,
            DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN()),
            IDolomiteStructs.AssetDenomination.Wei,
            _amount,
            AccountBalanceLib.BalanceCheckFlag.None
        );
    }

    // @todo How are we going to tell if we need to reset an account to None?

    function adjustAccountBalance(uint256 _accountNumber, uint256 _amount) external {
        // @todo Call to dolomite to adjust balance
    }

    function _executeSimpleWrap(
        uint256 _accountNumber,
        uint256 _amount,
        bytes memory _data,
        AccountBalanceLib.BalanceCheckFlag _flag
    ) internal {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN());
        marketIdsPath[1] = marketId();

        (
            address _wrapper,
            bytes memory _tradeData
        ) = abi.decode(_data, (address, bytes));
        IGenericTraderBase.TraderParam[] memory tradersPath = new IGenericTraderProxyV1.TraderParam[](1);
        tradersPath[0] = IGenericTraderBase.TraderParam({
            traderType: IGenericTraderBase.TraderType.IsolationModeWrapper,
            makerAccountIndex: 0,
            trader: _wrapper,
            tradeData: _tradeData
        });

        IDolomiteStructs.AccountInfo[] memory makerAccounts = new IDolomiteStructs.AccountInfo[](0);
        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: _flag,
            eventType: IGenericTraderProxyV1.EventEmissionType.None
        });

        _swapExactInputForOutput(
            SwapExactInputForOutputParams({
                tradeAccountNumber: _accountNumber,
                marketIdsPath: marketIdsPath,
                inputAmountWei: _amount,
                minOutputAmountWei: _amount,
                tradersPath: tradersPath,
                makerAccounts: makerAccounts,
                userConfig: userConfig
            })
        );
    }

    function _executeSimpleUnwrap(
        uint256 _accountNumber,
        uint256 _amount,
        bytes memory _data,
        AccountBalanceLib.BalanceCheckFlag _flag
    ) internal {
        uint256[] memory marketIdsPath = new uint256[](2);
        marketIdsPath[0] = marketId();
        marketIdsPath[1] = DOLOMITE_MARGIN().getMarketIdByTokenAddress(UNDERLYING_TOKEN());

        (
            address _unwrapper,
            bytes memory _tradeData
        ) = abi.decode(_data, (address, bytes));
        IGenericTraderBase.TraderParam[] memory tradersPath = new IGenericTraderProxyV1.TraderParam[](1);
        tradersPath[0] = IGenericTraderBase.TraderParam({
            traderType: IGenericTraderBase.TraderType.IsolationModeUnwrapper,
            makerAccountIndex: 0,
            trader: _unwrapper,
            tradeData: _tradeData
        });

        IDolomiteStructs.AccountInfo[] memory makerAccounts = new IDolomiteStructs.AccountInfo[](0);
        IGenericTraderProxyV1.UserConfig memory userConfig = IGenericTraderProxyV1.UserConfig({
            deadline: block.timestamp,
            balanceCheckFlag: _flag,
            eventType: IGenericTraderProxyV1.EventEmissionType.None
        });

        _swapExactInputForOutput(
            SwapExactInputForOutputParams({
                tradeAccountNumber: _accountNumber,
                marketIdsPath: marketIdsPath,
                inputAmountWei: _amount,
                minOutputAmountWei: _amount,
                tradersPath: tradersPath,
                makerAccounts: makerAccounts,
                userConfig: userConfig
            })
        );
    }

    function _investInAave(uint256 _amount) internal {
        IAaveLendingPool lendingPool = registry().aaveLendingPool();
        IERC20 token = IERC20(UNDERLYING_TOKEN());
        token.safeApprove(address(lendingPool), _amount);
        lendingPool.supply(address(token), _amount, address(this), 0);
    }

    function _withdrawFromAave(uint256 _amount) internal {
        IAaveLendingPool lendingPool = registry().aaveLendingPool();
        IERC20 token = IERC20(UNDERLYING_TOKEN());
        lendingPool.withdraw(address(token), _amount, address(this));
    }

    function getBalanceForSubaccount(uint256 _accountNumber) external view returns (uint256) {
        Strategy strategy = accountNumberToStrategy[_accountNumber];
        if (strategy == Strategy.NONE) {
            return 0;
        } else if (strategy == Strategy.AAVE) {
            address aToken = registry().aaveLendingPool().getReserveData(UNDERLYING_TOKEN()).aTokenAddress;
            // @audit This won't work if multiple subaccounts use this strategy
            return IERC20(aToken).balanceOf(address(this));
        } else {
            revert("Invalid strategy");
        }
    }
}
