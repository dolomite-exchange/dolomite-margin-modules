// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


/**
 * @title   IVeArtProxy
 * @author  Dolomite
 *
 * @notice  Interface for implementing cool art for each ve NFT
 */
interface IVeArtProxy {
    function _tokenURI(
        uint _tokenId,
        uint _balanceOf,
        uint _locked_end,
        uint _value
    ) external pure returns (string memory output);
}
