// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @title   IEnsoRouter
 *
 * @notice  Interface for executing trades via Enso
 */
interface IEnsoRouter {

    enum TokenType {
        Native,
        ERC20,
        ERC721,
        ERC1155
    }

    struct Token {
        TokenType tokenType;
        bytes data;
    }

    /// @notice Route a single token via a call to the shortcuts contract
    /// @param tokenIn The encoded data for the token to send
    /// @param data The call data to be sent to the shortcuts contract
    function routeSingle(
        Token calldata tokenIn,
        bytes calldata data
    ) external payable returns (bytes memory response);

    /// @notice Route a single token via a call to the shortcuts contract and revert if there is insufficient token received
    /// @param tokenIn The encoded data for the token to send
    /// @param tokenOut The encoded data for the token to receive
    /// @param receiver The address of the wallet that will receive the tokens
    /// @param data The call data to be sent to the shortcuts contract
    function safeRouteSingle(
        Token calldata tokenIn,
        Token calldata tokenOut,
        address receiver,
        bytes calldata data
    ) external payable returns (bytes memory response);
}
