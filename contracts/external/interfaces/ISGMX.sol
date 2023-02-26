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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @notice  This is the intermediary token used during the staking process for GMX. We use this contract to distinguish
 *          between GMX esGMX deposited for staking to receive sbfGMX. The contract address on Arbitrum Mainnet is:
 *          0x908C4D94D34924765f1eDc22A1DD098397c59dD4
 */
interface ISGMX is IERC20 {

    function depositBalances(address _account, address _depositToken) external view returns (uint256);
}
