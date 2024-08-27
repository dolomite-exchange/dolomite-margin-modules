// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IOogaBoogaRouter {
    /// @dev Contains all information needed to describe the input and output for a swap
    struct permit2Info {
        address contractAddress;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    /// @dev Contains all information needed to describe the input and output for a swap
    struct erc20PermitInfo {
        uint256 value;
        uint256 deadline;
        // Signature data
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @dev Contains all information needed to describe the input and output for a swap
    struct swapTokenInfo {
        address inputToken;
        uint256 inputAmount;
        address outputToken;
        uint256 outputQuote;
        uint256 outputMin;
        address outputReceiver;
    }

    // @dev event for swapping one token for another
    event Swap(
        address sender,
        uint256 inputAmount,
        address inputToken,
        uint256 amountOut,
        address outputToken,
        int256 slippage,
        uint32 referralCode
    );

    /// @dev Holds all information for a given referral
    struct referralInfo {
        uint64 referralFee;
        address beneficiary;
        bool registered;
    }
    /// @notice Externally facing interface for swapping two tokens
    /// @param tokenInfo All information about the tokens being swapped
    /// @param pathDefinition Encoded path definition for executor
    /// @param executor Address of contract that will execute the path
    /// @param referralCode referral code to specify the source of the swap

    function swap(swapTokenInfo memory tokenInfo, bytes calldata pathDefinition, address executor, uint32 referralCode)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Externally facing interface for swapping two tokens
    /// @param permit2 All additional info for Permit2 transfers
    /// @param tokenInfo All information about the tokens being swapped
    /// @param pathDefinition Encoded path definition for executor
    /// @param executor Address of contract that will execute the path
    /// @param referralCode referral code to specify the source of the swap
    function swapPermit2(
        permit2Info memory permit2,
        swapTokenInfo memory tokenInfo,
        bytes calldata pathDefinition,
        address executor,
        uint32 referralCode
    ) external returns (uint256 amountOut);

    /// @notice Externally facing interface for swapping two tokens
    /// @param permit All additional info for ERC20Permit transfers
    /// @param tokenInfo All information about the tokens being swapped
    /// @param pathDefinition Encoded path definition for executor
    /// @param executor Address of contract that will execute the path
    /// @param referralCode referral code to specify the source of the swap
    function swapERC20Permit(
        erc20PermitInfo calldata permit,
        swapTokenInfo calldata tokenInfo,
        bytes calldata pathDefinition,
        address executor,
        uint32 referralCode
    ) external returns (uint256 amountOut);
}
