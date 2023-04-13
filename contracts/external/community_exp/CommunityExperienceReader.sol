// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.9;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";


/**
 * @title   CommunityExperienceReader
 * @author  Dolomite
 *
 * @notice  Contract for reporting total experience earned by users for the Dolomite Community XP program.
 */
contract CommunityExperienceReader {

    address public constant GALXE_NFT_ADDRESS = 0xd92bF3C13941283Df4C33A9453A21B908a8f41FF;

    function getTokensOfOwnerPageable(
        address _account,
        uint256 _startIndex,
        uint256 _maxCount
    ) external view returns (uint256[] memory tokenIds) {
        uint256 balance = IERC721(GALXE_NFT_ADDRESS).balanceOf(_account);
        if (balance == 0 || _startIndex >= balance || _maxCount == 0) {
            return new uint256[](0);
        }


        tokenIds = new uint256[](balance - _startIndex > _maxCount ? _maxCount : balance - _startIndex);

        for (uint256 i = _startIndex; i < balance && i < _startIndex + _maxCount; i++) {
            tokenIds[i - _startIndex] = IERC721Enumerable(GALXE_NFT_ADDRESS).tokenOfOwnerByIndex(_account, i);
        }

        return tokenIds;
    }
}
