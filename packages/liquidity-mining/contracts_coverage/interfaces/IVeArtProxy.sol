// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title   IVeArtProxy
 * @author  Dolomite
 *
 * Interface for artwork for the ve token
 */
interface IVeArtProxy {

    function _tokenURI(
        uint _tokenId,
        uint _balanceOf,
        uint _locked_end,
        uint _value
    ) external pure returns (string memory output);
}
