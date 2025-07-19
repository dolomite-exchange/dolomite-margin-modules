// SPDX-License-Identifier: GPL-3.0-or-later
/*

    Copyright 2025 Dolomite

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

import { OnlyDolomiteMargin } from "@dolomite-exchange/modules-base/contracts/helpers/OnlyDolomiteMargin.sol";
import { IDolomiteStructs } from "@dolomite-exchange/modules-base/contracts/protocol/interfaces/IDolomiteStructs.sol";
import { Require } from "@dolomite-exchange/modules-base/contracts/protocol/lib/Require.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC4626PriceOracle } from "./interfaces/IERC4626PriceOracle.sol";


/**
 * @title   ERC4626PriceOracle
 * @author  Dolomite
 *
 * @notice  An oracle that gets the price of an ERC4626 vault in the asset token
 */
contract ERC4626PriceOracle is IERC4626PriceOracle, OnlyDolomiteMargin {

    // ============================ Constants ============================

    bytes32 private constant _FILE = "ERC4626PriceOracle";
    uint256 private constant _ONE_DOLLAR = 10 ** 36;

    mapping(address => TokenInfo) public tokenInfo;

    // ============================ Constructor ============================

    constructor(
        address[] memory _initialTokens,
        address _dolomiteMargin
    ) OnlyDolomiteMargin(_dolomiteMargin) {
        for (uint256 i = 0; i < _initialTokens.length; i++) {
            _ownerInsertOrUpdateToken(_initialTokens[i], true);
        }
    }

    // ============================ Admin Functions ============================

    function ownerInsertOrUpdateToken(
        address _token,
        bool _isSupported
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerInsertOrUpdateToken(_token, _isSupported);
    }

    // ============================ Public Functions ============================

    function getPrice(
        address _token
    ) external view returns (IDolomiteStructs.MonetaryPrice memory) {
        TokenInfo memory info = tokenInfo[_token];
        Require.that(
            info.vault == _token,
            _FILE,
            "Invalid token",
            _token
        );

        uint256 assetAmount = IERC4626(info.vault).convertToAssets(10 ** info.vaultDecimals);
        return IDolomiteStructs.MonetaryPrice({
            value: standardizeNumberOfDecimals(info.assetDecimals, assetAmount)
        });
    }

    /**
     * Standardizes `value` to have `ONE_DOLLAR.decimals` - `tokenDecimals` number of decimals.
     *
     * @dev _tokenAmount is in token decimals. To get (36 - _tokenDecimals) we need to multiply
     *      by 10 ** (36 - _tokenDecimals * 2)
     *
     *      Ex: USDC
     *      _tokenDecimals = 6
     *      returned price should be in 36 - 6 = 30 decimals

     *      tokenDecimalsFactor = 10 ** (36 - 6 * 2) = 10 ** 24
     *      return = 6 decimals * (10 ** 24) = 30 decimals
     */
    function standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _tokenAmount
    ) public pure returns (uint256) {
        uint256 tokenDecimalsFactor = 10 ** (36 - _tokenDecimals * 2);
        return _tokenAmount * tokenDecimalsFactor;
    }

    // ============================ Internal Functions ============================

    function _ownerInsertOrUpdateToken(
        address _token,
        bool _isSupported
    ) internal {
        if (_isSupported) {
            address asset = IERC4626(_token).asset();
            uint8 assetDecimals = IERC20Metadata(asset).decimals();

            tokenInfo[_token] = TokenInfo({
                vault: _token,
                vaultDecimals: uint8(IERC20Metadata(_token).decimals()),
                asset: asset,
                assetDecimals: assetDecimals
            });
        } else {
            delete tokenInfo[_token];
        }

        emit TokenInsertedOrUpdated(_token, _isSupported);
    }
}
