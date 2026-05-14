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

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol"; // solhint-disable-line max-line-length
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { HasLiquidatorRegistry } from "../general/HasLiquidatorRegistry.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { ProxyContractHelpers } from "../helpers/ProxyContractHelpers.sol";
import { IDolomiteRegistry } from "../interfaces/IDolomiteRegistry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { DolomiteMarginVersionWrapperLib } from "../lib/DolomiteMarginVersionWrapperLib.sol";
import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IDolomiteStructs } from "../protocol/interfaces/IDolomiteStructs.sol";
import { DecimalLib } from "../protocol/lib/DecimalLib.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { ExcessivelySafeCall } from "../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../protocol/lib/Require.sol";
import { TypesLib } from "../protocol/lib/TypesLib.sol";
import { ILiquidatorProxyV1 } from "./interfaces/ILiquidatorProxyV1.sol";


/**
 * @title   LiquidatorProxyV1
 * @author  Dolomite
 *
 * Contract for liquidating accounts in DolomiteMargin.
 */
contract LiquidatorProxyV1 is ProxyContractHelpers, HasLiquidatorRegistry, OnlyDolomiteMargin, ReentrancyGuardUpgradeable, ILiquidatorProxyV1 {
    using DolomiteMarginVersionWrapperLib for IDolomiteMargin;
    using DecimalLib for IDolomiteStructs.Decimal;
    using DecimalLib for uint256;
    using TypesLib for IDolomiteStructs.Wei;

    bytes32 private constant _FILE = "LiquidatorProxyV1";

    uint256 private constant _SOLID_ACCOUNT_ID = 0;
    uint256 private constant _LIQUID_ACCOUNT_ID = 1;
    uint256 private constant _DOLOMITE_RAKE_ACCOUNT_ID = 2;
    uint256 private constant _ONE = 1 ether;

    bytes32 internal constant DOLOMITE_FS_GLP_HASH = keccak256(bytes("Dolomite: Fee + Staked GLP"));
    string internal constant DOLOMITE_ISOLATION_PREFIX = "Dolomite Isolation:";
    bytes32 private constant _WHITELISTED_LIQUIDATOR_SLOT = bytes32(uint256(keccak256("eip1967.proxy.whitelistedLiquidator")) - 1); // solhint-disable-line max-line-length

    uint256 public immutable CHAIN_ID;
    IDolomiteRegistry public immutable DOLOMITE_REGISTRY; // solhint-disable-line var-name-mixedcase

    // ================================================
    // =================== Constructor ================
    // ================================================

    constructor(
        uint256 _chainId,
        address _liquidatorAssetRegistry,
        address _dolomiteRegistry,
        address _dolomiteMargin
    ) HasLiquidatorRegistry(_liquidatorAssetRegistry) OnlyDolomiteMargin(_dolomiteMargin) {
        CHAIN_ID = _chainId;
        DOLOMITE_REGISTRY = IDolomiteRegistry(_dolomiteRegistry);
    }

    // ================================================
    // =================== Admin Functions ============
    // ================================================

    function ownerSetWhitelistedLiquidator(
        address _liquidator,
        bool _isWhitelisted
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _setUint256InMap(_WHITELISTED_LIQUIDATOR_SLOT, _liquidator, _isWhitelisted ? 1 : 0);
        emit WhitelistedLiquidatorSet(_liquidator, _isWhitelisted);
    }

    // ================================================
    // =============== Public Functions ===============
    // ================================================

    function liquidate(
        IDolomiteStructs.AccountInfo memory _solidAccount,
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256[] memory _heldMarkets,
        uint256[] memory _owedMarkets,
        uint256[] memory _owedAmountsToLiquidate
    ) external nonReentrant requireIsAssetsWhitelistedForLiquidation(_heldMarkets) requireIsAssetsWhitelistedForLiquidation(_owedMarkets) {
        Require.that(
            isWhitelistedLiquidator(msg.sender),
            _FILE,
            "Msg.sender is not whitelisted"
        );
        Require.that(
            msg.sender == _solidAccount.owner || DOLOMITE_MARGIN().getIsLocalOperator(_solidAccount.owner, msg.sender),
            _FILE,
            "Invalid solid account"
        );
        Require.that(
            _owedMarkets.length == _heldMarkets.length
                && _heldMarkets.length == _owedAmountsToLiquidate.length,
            _FILE,
            "Invalid market arrays"
        );

        IDolomiteStructs.AccountInfo[] memory accounts = _getAccounts(_solidAccount, _liquidAccount);

        for (uint256 i; i < _heldMarkets.length; ++i) {
            uint256 heldMarket = _heldMarkets[i];
            uint256 owedMarket = _owedMarkets[i];
            IDolomiteStructs.Wei memory owedWei = DOLOMITE_MARGIN().getAccountWei(_liquidAccount, owedMarket);
            IDolomiteStructs.Wei memory heldWei = DOLOMITE_MARGIN().getAccountWei(_liquidAccount, heldMarket);

            Require.that(
                owedMarket != heldMarket,
                _FILE,
                "Cannot liquidate same market"
            );
            Require.that(
                !_isIsolationModeMarket(heldMarket),
                _FILE,
                "Cannot liquidate iso mode"
            );
            Require.that(
                owedWei.isNegative() && heldWei.isPositive(),
                _FILE,
                "Invalid market balances"
            );

            IDolomiteStructs.ActionArgs[] memory actions = _getActions(
                _liquidAccount,
                heldMarket,
                owedMarket,
                heldWei.value,
                owedWei.value,
                _owedAmountsToLiquidate[i]
            );
            DOLOMITE_MARGIN().operate(accounts, actions);
        }
    }

    // ================================================
    // =============== View Functions =================
    // ================================================

    function isWhitelistedLiquidator(address _liquidator) public view returns (bool) {
        return _getUint256FromMap(_WHITELISTED_LIQUIDATOR_SLOT, _liquidator) == 1;
    }

    // ================================================
    // ============= Internal Functions ===============
    // ================================================

    function _getAccounts(
        IDolomiteStructs.AccountInfo memory _solidAccount,
        IDolomiteStructs.AccountInfo memory _liquidAccount
    ) internal view returns (IDolomiteStructs.AccountInfo[] memory) {
        IDolomiteStructs.AccountInfo[] memory accounts = new IDolomiteStructs.AccountInfo[](3);

        accounts[_SOLID_ACCOUNT_ID] = _solidAccount;
        accounts[_LIQUID_ACCOUNT_ID] = _liquidAccount;
        accounts[_DOLOMITE_RAKE_ACCOUNT_ID] = IDolomiteStructs.AccountInfo({
            owner: DOLOMITE_REGISTRY.feeAgent(),
            number: 0
        });

        return accounts;
    }

    function _getActions(
        IDolomiteStructs.AccountInfo memory _liquidAccount,
        uint256 _heldMarketId,
        uint256 _owedMarketId,
        uint256 _heldWei,
        uint256 _owedWei,
        uint256 _owedWeiToLiquidate
    ) internal view returns (IDolomiteStructs.ActionArgs[] memory) {
        IDolomiteStructs.Decimal memory dolomiteRake = DOLOMITE_REGISTRY.dolomiteRake();
        IDolomiteStructs.ActionArgs[] memory actions = new IDolomiteStructs.ActionArgs[](dolomiteRake.value > 0 ? 2 : 1);

        if (_eligibleForPartialLiquidation(_liquidAccount)) {
            _owedWei /= 2;
        }

        uint256 solidHeldUpdateWithReward;
        uint256 heldWeiWithoutReward;

        {
            IDolomiteStructs.Decimal memory spread = DOLOMITE_MARGIN().getVersionedLiquidationSpreadForPair(
                CHAIN_ID,
                _liquidAccount,
                _heldMarketId,
                _owedMarketId
            );
            uint256 owedPrice = DOLOMITE_MARGIN().getMarketPrice(_owedMarketId).value;
            uint256 heldPrice = DOLOMITE_MARGIN().getMarketPrice(_heldMarketId).value;
            uint256 owedPriceAdj = owedPrice.mul(spread.onePlus());

            uint256 liquidHeldValue = heldPrice * _heldWei;
            uint256 liquidOwedValueAdj = owedPriceAdj * _owedWei;

            if (liquidHeldValue < liquidOwedValueAdj) {
                solidHeldUpdateWithReward = _heldWei;
                uint256 maxOwedWeiToLiquidate = DolomiteMarginMath.getPartialRoundUp(
                    _heldWei,
                    heldPrice,
                    owedPriceAdj
                );
                _owedWeiToLiquidate = Math.min(_owedWeiToLiquidate, maxOwedWeiToLiquidate);
            } else {
                _owedWeiToLiquidate = Math.min(_owedWeiToLiquidate, _owedWei);
                solidHeldUpdateWithReward = DolomiteMarginMath.getPartial(
                    _owedWeiToLiquidate,
                    owedPriceAdj,
                    heldPrice
                );
            }
            heldWeiWithoutReward = DolomiteMarginMath.getPartial(_owedWeiToLiquidate, owedPrice, heldPrice);
        }

        actions[0] = AccountActionLib.encodeLiquidateAction(
            _SOLID_ACCOUNT_ID,
            _LIQUID_ACCOUNT_ID,
            _owedMarketId,
            _heldMarketId,
            _owedWeiToLiquidate
        );

        if (dolomiteRake.value > 0) {
            actions[1] = AccountActionLib.encodeTransferAction(
                _SOLID_ACCOUNT_ID,
                _DOLOMITE_RAKE_ACCOUNT_ID,
                _heldMarketId,
                IDolomiteStructs.AssetDenomination.Wei,
                (solidHeldUpdateWithReward - heldWeiWithoutReward).mul(dolomiteRake)
            );
        }

        return actions;
    }

    function _eligibleForPartialLiquidation(
        IDolomiteStructs.AccountInfo memory _liquidAccount
    ) internal view returns (bool) {
        IDolomiteStructs.Decimal memory marginRatioOverride =
            DolomiteMarginVersionWrapperLib.getVersionedMarginRatioOverrideForChain(
                DOLOMITE_MARGIN(),
                block.chainid,
                _liquidAccount
            );
        (
            IDolomiteStructs.MonetaryValue memory supplyValue,
            IDolomiteStructs.MonetaryValue memory borrowValue
        ) = DOLOMITE_MARGIN().getAdjustedAccountValues(_liquidAccount);

        if (marginRatioOverride.value == 0) {
            marginRatioOverride = DOLOMITE_MARGIN().getMarginRatio();
        }
        marginRatioOverride = marginRatioOverride.onePlus();

        uint256 collateralRatio = supplyValue.value * _ONE / borrowValue.value;
        uint256 healthFactor = collateralRatio.div(marginRatioOverride);
        Require.that(
            healthFactor < _ONE,
            _FILE,
            "Account is collateralized"
        );

        IDolomiteStructs.Decimal memory partialLiquidationThreshold = DOLOMITE_REGISTRY.partialLiquidationThreshold();
        return partialLiquidationThreshold.value != 0 && healthFactor >= partialLiquidationThreshold.value;
    }

    function _isIsolationModeMarket(uint256 _marketId) internal view returns (bool) {
        return _isIsolationModeAsset(DOLOMITE_MARGIN().getMarketTokenAddress(_marketId));
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
