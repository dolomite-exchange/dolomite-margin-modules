/*

   Copyright 2022 Dolomite Foundation

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

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TestToken is ERC20 {

    uint8 private _decimals;

    constructor (
        string memory _name,
        string memory _symbol,
        uint8 __decimals
    )
    ERC20(_name, _symbol) {
        _decimals = __decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address _account, uint _amount) public {
        super._mint(_account, _amount);
    }

    function burn(address _account, uint _amount) public {
        super._burn(_account, _amount);
    }

}
