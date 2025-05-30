// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IERC721, IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { DecimalLib } from "@dolomite-exchange/modules-base/contracts/protocol/lib/DecimalLib.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IVeArtProxy } from "./interfaces/IVeArtProxy.sol";
import { IVeFeeCalculator } from "./interfaces/IVeFeeCalculator.sol";
import { IVoter } from "./interfaces/IVoter.sol";


/**
 * @title   VotingEscrow
 * @author  Modified from Solidly (https://github.com/solidlyexchange/solidly/blob/master/contracts/ve.sol)
 * @author  Modified from Curve (https://github.com/curvefi/curve-dao-contracts/blob/master/contracts/VotingEscrow.vy)
 * @author  Modified from Nouns DAO
 *          (https://github.com/withtally/my-nft-dao-project/blob/main/contracts/ERC721Checkpointable.sol)
 *
 * @notice  veNFT implementation that escrows ERC-20 tokens in the form of an ERC-721 NFT
 * @notice  Votes have a weight depending on time, so that users are committed to the future of (whatever they are
 *          voting for)
 * @dev     Vote weight decays linearly over time. Lock time cannot be more than `MAXTIME` (2 years).
 */
contract VotingEscrow is IERC721, IERC721Metadata, IVotes, Initializable {
    using DecimalLib for uint256;
    using SafeERC20 for IERC20;

    enum DepositType {
        DEPOSIT_FOR_TYPE,
        CREATE_LOCK_TYPE,
        INCREASE_LOCK_AMOUNT,
        INCREASE_UNLOCK_TIME,
        MERGE_TYPE,
        SPLIT_TYPE
    }

    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    struct Point {
        int128 bias;
        int128 slope; // # -dweight / dt
        uint256 ts;
        uint256 blk; // block
    }
    /* We cannot really do block numbers per se b/c slope is per time, not per block
     * and per block could be fairly bad b/c Ethereum changes blocktimes.
     * What we can do is to extrapolate ***At functions */

    /// @notice A checkpoint for marking delegated tokenIds from a given timestamp
    struct Checkpoint {
        uint256 timestamp;
        uint256[] tokenIds;
    }

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposit(
        address indexed provider,
        uint256 tokenId,
        uint256 value,
        uint256 indexed locktime,
        DepositType deposit_type,
        uint256 ts
    );

    event Withdraw(
        address indexed provider,
        uint256 tokenId,
        uint256 amountReceived,
        uint256 ts
    );

    event BurnFeePaid(
        address indexed provider,
        uint256 tokenId,
        uint256 amountBurned
    );

    event RecoupFeePaid(
        address indexed provider,
        uint256 tokenId,
        uint256 amountToVester,
        uint256 amountToBuybackPool
    );

    event Supply(uint256 prevSupply, uint256 supply);

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    address public token;
    address public voter;
    address public team;
    address public artProxy;
    address public feeCalculator;
    address public vester;
    address public buybackPool;

    mapping(uint256 => Point) public point_history; // epoch -> unsigned point

    /// @dev Mapping of interface id to bool about whether or not it's supported
    mapping(bytes4 => bool) internal supportedInterfaces;

    /// @dev ERC165 interface ID of ERC165
    bytes4 internal constant ERC165_INTERFACE_ID = 0x01ffc9a7;

    /// @dev ERC165 interface ID of ERC721
    bytes4 internal constant ERC721_INTERFACE_ID = 0x80ac58cd;

    /// @dev ERC165 interface ID of ERC721Metadata
    bytes4 internal constant ERC721_METADATA_INTERFACE_ID = 0x5b5e139f;

    /// @dev Current count of token
    uint256 public tokenId;

    uint8 internal constant _not_entered = 1;
    uint8 internal constant _entered = 2;
    uint8 internal _entered_state;

    string public constant name = "veDOLO";
    string public constant symbol = "veDOLO";
    string public constant version = "1.0.0";
    uint8 public constant decimals = 18;

    /// @dev Mapping from NFT ID to the address that owns it.
    mapping(uint256 => address) internal idToOwner;

    /// @dev Mapping from owner address to count of his tokens.
    mapping(address => uint256) internal ownerToNFTokenCount;

    /// @dev Mapping from NFT ID to approved address.
    mapping(uint256 => address) internal idToApprovals;

    /// @dev Mapping from owner address to mapping of operator addresses.
    mapping(address => mapping(address => bool)) internal ownerToOperators;

    mapping(uint256 => uint256) public ownership_change;

    /// @dev Mapping from owner address to mapping of index to tokenIds
    mapping(address => mapping(uint256 => uint256))
        internal ownerToNFTokenIdList;

    /// @dev Mapping from NFT ID to index of owner
    mapping(uint256 => uint256) internal tokenToOwnerIndex;

    mapping(uint256 => uint256) public user_point_epoch;
    mapping(uint256 => Point[1000000000]) public user_point_history; // user -> Point[user_epoch]
    mapping(uint256 => LockedBalance) public locked;
    uint256 public epoch;
    mapping(uint256 => int128) public slope_changes; // time -> signed slope change
    uint256 private dirtySlot; // used to be supply, unused now

    uint256 internal constant WEEK = 1 weeks;
    uint256 public constant MAXTIME = 2 * 365 * 86400;
    int128 internal constant iMAXTIME = 2 * 365 * 86400;
    uint256 internal constant MULTIPLIER = 1 ether;

    mapping(uint256 => uint256) public attachments;
    mapping(uint256 => bool) public voted;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of each accounts delegate
    mapping(address => address) private _delegates;
    uint256 public constant MAX_DELEGATES = 1024; // avoid too much gas

    /// @notice A record of delegated token checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    function initialize(
        address token_addr,
        address art_proxy,
        address _voter,
        address _feeCalculator,
        address _vester,
        address _buybackPool,
        address msig
    ) external initializer {
        token = token_addr;
        voter = _voter;
        feeCalculator = _feeCalculator;
        vester = _vester;
        buybackPool = _buybackPool;
        team = msig;
        artProxy = art_proxy;

        point_history[0].blk = block.number;
        point_history[0].ts = block.timestamp;

        supportedInterfaces[ERC165_INTERFACE_ID] = true;
        supportedInterfaces[ERC721_INTERFACE_ID] = true;
        supportedInterfaces[ERC721_METADATA_INTERFACE_ID] = true;

        // mint-ish
        emit Transfer(address(0), address(this), tokenId);
        // burn-ish
        emit Transfer(address(this), address(0), tokenId);

        _entered_state = 1;
    }

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev reentrancy guard
    modifier nonreentrant() {
        require(_entered_state == _not_entered);
        _entered_state = _entered;
        _;
        _entered_state = _not_entered;
    }

    function setTeam(address _team) external {
        require(msg.sender == team);
        team = _team;
    }

    function setArtProxy(address _proxy) external {
        require(msg.sender == team);
        artProxy = _proxy;
    }

    function setVoter(address _voter) external {
        require(msg.sender == team, "not team");
        voter = _voter;
    }

    function setFeeCalculator(address _feeCalculator) external {
        require(msg.sender == team, "not team");
        feeCalculator = _feeCalculator;
    }

    function setVester(address _vester) external {
        require(msg.sender == team, "not team");
        vester = _vester;
    }

    function setBuybackPool(address _buybackPool) external {
        require(msg.sender == team, "not team");
        buybackPool = _buybackPool;
    }

    /// @dev Returns current token URI metadata
    /// @param  _tokenId Token ID to fetch URI for.
    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        require(
            idToOwner[_tokenId] != address(0),
            "Query for nonexistent token"
        );
        LockedBalance memory _locked = locked[_tokenId];
        return
            IVeArtProxy(artProxy)._tokenURI(
                _tokenId,
                _balanceOfNFT(_tokenId, block.timestamp),
                _locked.end,
                uint256(int256(_locked.amount))
            );
    }

    /*//////////////////////////////////////////////////////////////
                      ERC721 BALANCE/OWNER STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Returns the address of the owner of the NFT.
    /// @param  _tokenId The identifier for an NFT.
    function ownerOf(uint256 _tokenId) public view returns (address) {
        return idToOwner[_tokenId];
    }

    /// @dev Returns the number of NFTs owned by `_owner`.
    ///      Throws if `_owner` is the zero address. NFTs assigned to the zero address are considered invalid.
    /// @param  _owner Address for whom to query the balance.
    function _balance(address _owner) internal view returns (uint256) {
        return ownerToNFTokenCount[_owner];
    }

    /// @dev Returns the number of NFTs owned by `_owner`.
    ///      Throws if `_owner` is the zero address. NFTs assigned to the zero address are considered invalid.
    /// @param  _owner Address for whom to query the balance.
    function balanceOf(address _owner) external view returns (uint256) {
        return _balance(_owner);
    }

    /*//////////////////////////////////////////////////////////////
                         ERC721 APPROVAL STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @dev Get the approved address for a single NFT.
    /// @param  _tokenId ID of the NFT to query the approval of.
    function getApproved(uint256 _tokenId) external view returns (address) {
        return idToApprovals[_tokenId];
    }

    /// @dev Checks if `_operator` is an approved operator for `_owner`.
    /// @param  _owner The address that owns the NFTs.
    /// @param  _operator The address that acts on behalf of the owner.
    function isApprovedForAll(
        address _owner,
        address _operator
    ) external view returns (bool) {
        return (ownerToOperators[_owner])[_operator];
    }

    /*//////////////////////////////////////////////////////////////
                              ERC721 LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Set or reaffirm the approved address for an NFT. The zero address indicates there is no approved address.
    ///      Throws unless `msg.sender` is the current NFT owner, or an authorized operator of the current owner.
    ///      Throws if `_tokenId` is not a valid NFT. (NOTE: This is not written the EIP)
    ///      Throws if `_approved` is the current owner. (NOTE: This is not written the EIP)
    /// @param  _approved Address to be approved for the given NFT ID.
    /// @param  _tokenId ID of the token to be approved.
    function approve(address _approved, uint256 _tokenId) public {
        address owner = idToOwner[_tokenId];
        // Throws if `_tokenId` is not a valid NFT
        require(owner != address(0));
        // Throws if `_approved` is the current owner
        require(_approved != owner);
        // Check requirements
        bool senderIsOwner = (idToOwner[_tokenId] == msg.sender);
        bool senderIsApprovedForAll = (ownerToOperators[owner])[msg.sender];
        require(senderIsOwner || senderIsApprovedForAll);
        // Set the approval
        idToApprovals[_tokenId] = _approved;
        emit Approval(owner, _approved, _tokenId);
    }

    /// @dev Enables or disables approval for a third party ("operator") to manage all of
    ///      `msg.sender`'s assets. It also emits the ApprovalForAll event.
    ///      Throws if `_operator` is the `msg.sender`. (NOTE: This is not written the EIP)
    /// @notice This works even if sender doesn't own any tokens at the time.
    /// @param  _operator Address to add to the set of authorized operators.
    /// @param  _approved True if the operators is approved, false to revoke approval.
    function setApprovalForAll(address _operator, bool _approved) external {
        // Throws if `_operator` is the `msg.sender`
        /*assert(_operator != msg.sender);*/
        ownerToOperators[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    /* TRANSFER FUNCTIONS */
    /// @dev Clear an approval of a given address
    ///      Throws if `_owner` is not the current owner.
    function _clearApproval(address _owner, uint256 _tokenId) internal {
        // Throws if `_owner` is not the current owner
        /*assert(idToOwner[_tokenId] == _owner);*/
        if (idToApprovals[_tokenId] != address(0)) {
            // Reset approvals
            idToApprovals[_tokenId] = address(0);
        }
    }

    /// @dev Returns whether the given spender can transfer a given token ID
    /// @param  _spender address of the spender to query
    /// @param  _tokenId uint ID of the token to be transferred
    /// @return  bool whether the msg.sender is approved for the given token ID, is an operator of the owner, or is the
    ///          owner of the token
    function _isApprovedOrOwner(
        address _spender,
        uint256 _tokenId
    ) internal view returns (bool) {
        address owner = idToOwner[_tokenId];
        bool spenderIsOwner = owner == _spender;
        bool spenderIsApproved = _spender == idToApprovals[_tokenId];
        bool spenderIsApprovedForAll = (ownerToOperators[owner])[_spender];
        return spenderIsOwner || spenderIsApproved || spenderIsApprovedForAll;
    }

    function isApprovedOrOwner(
        address _spender,
        uint256 _tokenId
    ) external view returns (bool) {
        return _isApprovedOrOwner(_spender, _tokenId);
    }

    /// @dev Exeute transfer of a NFT.
    ///      Throws unless `msg.sender` is the current owner, an authorized operator, or the approved
    ///      address for this NFT. (NOTE: `msg.sender` not allowed in internal function so pass `_sender`.)
    ///      Throws if `_to` is the zero address.
    ///      Throws if `_from` is not the current owner.
    ///      Throws if `_tokenId` is not a valid NFT.
    function _transferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        address _sender
    ) internal {
        // Check for stale status
        require(!IVoter(voter).stale(_tokenId), "STALE");
        require(attachments[_tokenId] == 0 && !voted[_tokenId], "attached");
        // Check requirements
        require(_isApprovedOrOwner(_sender, _tokenId));
        // Clear approval. Throws if `_from` is not the current owner
        _clearApproval(_from, _tokenId);
        // Remove NFT. Throws if `_tokenId` is not a valid NFT
        _removeTokenFrom(_from, _tokenId);
        // auto re-delegate
        _moveTokenDelegates(delegates(_from), delegates(_to), _tokenId);
        // Add NFT
        _addTokenTo(_to, _tokenId);
        // Set the block of ownership transfer (for Flash NFT protection)
        ownership_change[_tokenId] = block.number;
        // Log the transfer
        emit Transfer(_from, _to, _tokenId);
    }

    /// @dev    Throws unless `msg.sender` is the current owner, an authorized operator, or the approved address for
    ///         this NFT.
    ///         Throws if `_from` is not the current owner.
    ///         Throws if `_to` is the zero address.
    ///         Throws if `_tokenId` is not a valid NFT.
    /// @notice The caller is responsible to confirm that `_to` is capable of receiving NFTs or else
    ///         they maybe be permanently lost.
    /// @param  _from The current owner of the NFT.
    /// @param  _to The new owner.
    /// @param  _tokenId The NFT to transfer.
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external {
        _transferFrom(_from, _to, _tokenId, msg.sender);
    }

    /// @dev Transfers the ownership of an NFT from one address to another address.
    ///      Throws unless `msg.sender` is the current owner, an authorized operator, or the
    ///      approved address for this NFT.
    ///      Throws if `_from` is not the current owner.
    ///      Throws if `_to` is the zero address.
    ///      Throws if `_tokenId` is not a valid NFT.
    ///      If `_to` is a smart contract, it calls `onERC721Received` on `_to` and throws if
    ///      the return value is not `bytes4(keccak256("onERC721Received(address,address,uint,bytes)"))`.
    /// @param  _from The current owner of the NFT.
    /// @param  _to The new owner.
    /// @param  _tokenId The NFT to transfer.
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external {
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    function _isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /// @dev Transfers the ownership of an NFT from one address to another address.
    ///      Throws unless `msg.sender` is the current owner, an authorized operator, or the
    ///      approved address for this NFT.
    ///      Throws if `_from` is not the current owner.
    ///      Throws if `_to` is the zero address.
    ///      Throws if `_tokenId` is not a valid NFT.
    ///      If `_to` is a smart contract, it calls `onERC721Received` on `_to` and throws if
    ///      the return value is not `bytes4(keccak256("onERC721Received(address,address,uint,bytes)"))`.
    /// @param  _from The current owner of the NFT.
    /// @param  _to The new owner.
    /// @param  _tokenId The NFT to transfer.
    /// @param  _data Additional data with no specified format, sent in call to `_to`.
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) public {
        require(!IVoter(voter).stale(_tokenId), "STALE");
        _transferFrom(_from, _to, _tokenId, msg.sender);

        if (_isContract(_to)) {
            // Throws if transfer destination is a contract which does not implement 'onERC721Received'
            try
                IERC721Receiver(_to).onERC721Received(
                    msg.sender,
                    _from,
                    _tokenId,
                    _data
                )
            returns (bytes4 response) {
                if (
                    response != IERC721Receiver(_to).onERC721Received.selector
                ) {
                    revert("ERC721: ERC721Receiver rejected tokens");
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert(
                        "ERC721: transfer to non ERC721Receiver implementer"
                    );
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                              ERC165 LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Interface identification is specified in ERC-165.
    /// @param  _interfaceID Id of the interface
    function supportsInterface(
        bytes4 _interfaceID
    ) external view returns (bool) {
        return supportedInterfaces[_interfaceID];
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL MINT/BURN LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev  Get token by index
    function tokenOfOwnerByIndex(
        address _owner,
        uint256 _tokenIndex
    ) external view returns (uint256) {
        return ownerToNFTokenIdList[_owner][_tokenIndex];
    }

    /// @dev Add a NFT to an index mapping to a given address
    /// @param  _to address of the receiver
    /// @param  _tokenId uint ID Of the token to be added
    function _addTokenToOwnerList(address _to, uint256 _tokenId) internal {
        uint256 current_count = _balance(_to);

        ownerToNFTokenIdList[_to][current_count] = _tokenId;
        tokenToOwnerIndex[_tokenId] = current_count;
    }

    /// @dev Add a NFT to a given address
    ///      Throws if `_tokenId` is owned by someone.
    function _addTokenTo(address _to, uint256 _tokenId) internal {
        // Throws if `_tokenId` is owned by someone
        /*assert(idToOwner[_tokenId] == address(0));*/
        // Change the owner
        idToOwner[_tokenId] = _to;
        // Update owner token index tracking
        _addTokenToOwnerList(_to, _tokenId);
        // Change count tracking
        ownerToNFTokenCount[_to] += 1;
    }

    /// @dev Function to mint tokens
    ///      Throws if `_to` is zero address.
    ///      Throws if `_tokenId` is owned by someone.
    /// @param  _to The address that will receive the minted tokens.
    /// @param  _tokenId The token id to mint.
    /// @return  A boolean that indicates if the operation was successful.
    function _mint(address _to, uint256 _tokenId) internal returns (bool) {
        // Throws if `_to` is zero address
        /*assert(_to != address(0));*/
        // checkpoint for gov
        _moveTokenDelegates(address(0), delegates(_to), _tokenId);
        // Add NFT. Throws if `_tokenId` is owned by someone
        _addTokenTo(_to, _tokenId);
        emit Transfer(address(0), _to, _tokenId);
        return true;
    }

    /// @dev Remove a NFT from an index mapping to a given address
    /// @param  _from address of the sender
    /// @param  _tokenId uint ID Of the token to be removed
    function _removeTokenFromOwnerList(
        address _from,
        uint256 _tokenId
    ) internal {
        // Delete
        uint256 current_count = _balance(_from) - 1;
        uint256 current_index = tokenToOwnerIndex[_tokenId];

        if (current_count == current_index) {
            // update ownerToNFTokenIdList
            ownerToNFTokenIdList[_from][current_count] = 0;
            // update tokenToOwnerIndex
            tokenToOwnerIndex[_tokenId] = 0;
        } else {
            uint256 lastTokenId = ownerToNFTokenIdList[_from][current_count];

            // Add
            // update ownerToNFTokenIdList
            ownerToNFTokenIdList[_from][current_index] = lastTokenId;
            // update tokenToOwnerIndex
            tokenToOwnerIndex[lastTokenId] = current_index;

            // Delete
            // update ownerToNFTokenIdList
            ownerToNFTokenIdList[_from][current_count] = 0;
            // update tokenToOwnerIndex
            tokenToOwnerIndex[_tokenId] = 0;
        }
    }

    /// @dev Remove a NFT from a given address
    ///      Throws if `_from` is not the current owner.
    function _removeTokenFrom(address _from, uint256 _tokenId) internal {
        // Throws if `_from` is not the current owner
        /*assert(idToOwner[_tokenId] == _from);*/
        // Change the owner
        idToOwner[_tokenId] = address(0);
        // Update owner token index tracking
        _removeTokenFromOwnerList(_from, _tokenId);
        // Change count tracking
        ownerToNFTokenCount[_from] -= 1;
    }

    function _burn(uint256 _tokenId) internal {
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            "caller is not owner nor approved"
        );

        address owner = ownerOf(_tokenId);

        // Clear approval
        approve(address(0), _tokenId);
        // checkpoint for gov
        _moveTokenDelegates(delegates(owner), address(0), _tokenId);
        // Remove token
        _removeTokenFrom(msg.sender, _tokenId);
        emit Transfer(owner, address(0), _tokenId);
    }

    /*//////////////////////////////////////////////////////////////
                             ESCROW STORAGE
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                              ESCROW LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the most recently recorded rate of voting power decrease for `_tokenId`
    /// @param  _tokenId token of the NFT
    /// @return  Value of the slope
    function get_last_user_slope(
        uint256 _tokenId
    ) external view returns (int128) {
        uint256 uepoch = user_point_epoch[_tokenId];
        return user_point_history[_tokenId][uepoch].slope;
    }

    /// @notice Get the timestamp for checkpoint `_idx` for `_tokenId`
    /// @param  _tokenId token of the NFT
    /// @param  _idx User epoch number
    /// @return  Epoch time of the checkpoint
    function user_point_history__ts(
        uint256 _tokenId,
        uint256 _idx
    ) external view returns (uint256) {
        return user_point_history[_tokenId][_idx].ts;
    }

    /// @notice Get timestamp when `_tokenId`'s lock finishes
    /// @param  _tokenId User NFT
    /// @return  Epoch time of the lock end
    function locked__end(uint256 _tokenId) external view returns (uint256) {
        return locked[_tokenId].end;
    }

    /// @notice Record global and per-user data to checkpoint
    /// @param  _tokenId NFT token ID. No user checkpoint if 0
    /// @param  old_locked Pevious locked amount / end lock time for the user
    /// @param  new_locked New locked amount / end lock time for the user
    function _checkpoint(
        uint256 _tokenId,
        LockedBalance memory old_locked,
        LockedBalance memory new_locked
    ) internal {
        Point memory u_old;
        Point memory u_new;
        int128 old_dslope = 0;
        int128 new_dslope = 0;
        uint256 _epoch = epoch;

        if (_tokenId != 0) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / iMAXTIME;
                u_old.bias =
                    u_old.slope *
                    int128(int256(old_locked.end - block.timestamp));
            }
            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / iMAXTIME;
                u_new.bias =
                    u_new.slope *
                    int128(int256(new_locked.end - block.timestamp));
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = slope_changes[old_locked.end];
            if (new_locked.end != 0) {
                if (new_locked.end == old_locked.end) {
                    new_dslope = old_dslope;
                } else {
                    new_dslope = slope_changes[new_locked.end];
                }
            }
        }

        Point memory last_point = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
        if (_epoch > 0) {
            last_point = point_history[_epoch];
        }
        uint256 last_checkpoint = last_point.ts;
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initial_last_point = last_point;
        uint256 block_slope = 0; // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope =
                (MULTIPLIER * (block.number - last_point.blk)) /
                (block.timestamp - last_point.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        {
            uint256 t_i = (last_checkpoint / WEEK) * WEEK;
            for (uint256 i = 0; i < 255; ++i) {
                // Hopefully it won't happen that this won't get used in 5 years!
                // If it does, users will be able to withdraw but vote weight will be broken
                t_i += WEEK;
                int128 d_slope = 0;
                if (t_i > block.timestamp) {
                    t_i = block.timestamp;
                } else {
                    d_slope = slope_changes[t_i];
                }
                last_point.bias -=
                    last_point.slope *
                    int128(int256(t_i - last_checkpoint));
                last_point.slope += d_slope;
                if (last_point.bias < 0) {
                    // This can happen
                    last_point.bias = 0;
                }
                if (last_point.slope < 0) {
                    // This cannot happen - just in case
                    last_point.slope = 0;
                }
                last_checkpoint = t_i;
                last_point.ts = t_i;
                last_point.blk =
                    initial_last_point.blk +
                    (block_slope * (t_i - initial_last_point.ts)) /
                    MULTIPLIER;
                _epoch += 1;
                if (t_i == block.timestamp) {
                    last_point.blk = block.number;
                    break;
                } else {
                    point_history[_epoch] = last_point;
                }
            }
        }

        epoch = _epoch;
        // Now point_history is filled until t=now

        if (_tokenId != 0) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }

        // Record the changed point into history
        point_history[_epoch] = last_point;

        if (_tokenId != 0) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;
                if (new_locked.end == old_locked.end) {
                    old_dslope -= u_new.slope; // It was a new deposit, not extension
                }
                slope_changes[old_locked.end] = old_dslope;
            }

            if (new_locked.end > block.timestamp) {
                if (new_locked.end > old_locked.end) {
                    new_dslope -= u_new.slope; // old slope disappeared at this point
                    slope_changes[new_locked.end] = new_dslope;
                }
                // else: we recorded it already in old_dslope
            }
            // Now handle user history
            uint256 user_epoch = user_point_epoch[_tokenId] + 1;

            user_point_epoch[_tokenId] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            user_point_history[_tokenId][user_epoch] = u_new;
        }
    }

    /// @notice Deposit and lock tokens for a user
    /// @param  _tokenId NFT that holds lock
    /// @param  _value Amount to deposit
    /// @param  unlock_time New time when to unlock the tokens, or 0 if unchanged
    /// @param  locked_balance Previous locked amount / timestamp
    /// @param  deposit_type The type of deposit
    function _deposit_for(
        uint256 _tokenId,
        uint256 _value,
        uint256 unlock_time,
        LockedBalance memory locked_balance,
        DepositType deposit_type
    ) internal {
        LockedBalance memory _locked = locked_balance;
        uint256 supply_before = supply();

        LockedBalance memory old_locked;
        (old_locked.amount, old_locked.end) = (_locked.amount, _locked.end);
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += int128(int256(_value));
        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        locked[_tokenId] = _locked;

        // Possibilities:
        // Both old_locked.end could be current or expired (>/< block.timestamp)
        // value == 0 (extend lock) or value > 0 (add to lock or extend lock)
        // _locked.end > block.timestamp (always)
        _checkpoint(_tokenId, old_locked, _locked);

        address from = msg.sender;
        if (
            _value != 0 &&
            (deposit_type != DepositType.MERGE_TYPE &&
                deposit_type != DepositType.SPLIT_TYPE)
        ) {
            IERC20(token).safeTransferFrom(from, address(this), _value);
        }

        emit Deposit(
            from,
            _tokenId,
            _value,
            _locked.end,
            deposit_type,
            block.timestamp
        );
        emit Supply(supply_before, supply());
    }

    function block_number() external view returns (uint256) {
        return block.number;
    }

    /// @notice Record global data to checkpoint
    function checkpoint() external {
        _checkpoint(0, LockedBalance(0, 0), LockedBalance(0, 0));
    }

    /// @notice Deposit `_value` tokens for `_tokenId` and add to the lock
    /// @dev Anyone (even a smart contract) can deposit for someone else, but
    ///      cannot extend their locktime and deposit for a brand new user
    /// @param  _tokenId lock NFT
    /// @param  _value Amount to add to user's lock
    function deposit_for(
        uint256 _tokenId,
        uint256 _value
    ) external nonreentrant {
        LockedBalance memory _locked = locked[_tokenId];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(
            _locked.end > block.timestamp,
            "Cannot add to expired lock. Withdraw"
        );
        _deposit_for(
            _tokenId,
            _value,
            0,
            _locked,
            DepositType.DEPOSIT_FOR_TYPE
        );
    }

    /// @notice Deposit `_value` tokens for `_to` and lock for `_lock_duration`
    /// @param  _value Amount to deposit
    /// @param  _lock_duration Number of seconds to lock tokens for (rounded down to nearest week)
    /// @param  _to Address to deposit
    function _create_lock(
        uint256 _value,
        uint256 _lock_duration,
        address _to
    ) internal returns (uint256) {
        uint256 unlock_time = ((block.timestamp + _lock_duration) / WEEK) *
            WEEK; // Locktime is rounded down to weeks

        require(_value > 0); // dev: need non-zero value
        require(
            unlock_time > block.timestamp,
            "Can only lock until time in the future"
        );
        require(
            unlock_time <= block.timestamp + MAXTIME,
            "Voting lock can be 2 years max"
        );

        ++tokenId;
        uint256 _tokenId = tokenId;
        _mint(_to, _tokenId);

        _deposit_for(
            _tokenId,
            _value,
            unlock_time,
            locked[_tokenId],
            DepositType.CREATE_LOCK_TYPE
        );
        return _tokenId;
    }

    /// @notice Deposit `_value` tokens for `msg.sender` and lock for `_lock_duration`
    /// @param  _value Amount to deposit
    /// @param  _lock_duration Number of seconds to lock tokens for (rounded down to nearest week)
    function create_lock(
        uint256 _value,
        uint256 _lock_duration
    ) external nonreentrant returns (uint256) {
        return _create_lock(_value, _lock_duration, msg.sender);
    }

    /// @notice Deposit `_value` tokens for `_to` and lock for `_lock_duration`
    /// @param  _value Amount to deposit
    /// @param  _lock_duration Number of seconds to lock tokens for (rounded down to nearest week)
    /// @param  _to Address to deposit
    function create_lock_for(
        uint256 _value,
        uint256 _lock_duration,
        address _to
    ) external nonreentrant returns (uint256) {
        return _create_lock(_value, _lock_duration, _to);
    }

    /// @notice Deposit `_value` additional tokens for `_tokenId` without modifying the unlock time
    /// @param  _value Amount of tokens to deposit and add to the lock
    function increase_amount(
        uint256 _tokenId,
        uint256 _value
    ) external nonreentrant {
        /*assert(_isApprovedOrOwner(msg.sender, _tokenId));*/

        LockedBalance memory _locked = locked[_tokenId];

        /*assert(_value > 0);*/ // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(
            _locked.end > block.timestamp,
            "Cannot add to expired lock. Withdraw"
        );

        _deposit_for(
            _tokenId,
            _value,
            0,
            _locked,
            DepositType.INCREASE_LOCK_AMOUNT
        );
    }

    /// @notice Extend the unlock time for `_tokenId`
    /// @param  _lock_duration New number of seconds until tokens unlock
    function increase_unlock_time(
        uint256 _tokenId,
        uint256 _lock_duration
    ) external nonreentrant {
        /*assert(_isApprovedOrOwner(msg.sender, _tokenId));*/

        LockedBalance memory _locked = locked[_tokenId];
        uint256 unlock_time = ((block.timestamp + _lock_duration) / WEEK) * WEEK; // Locktime is rounded down to weeks

        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(unlock_time > _locked.end, "Can only increase lock duration");
        require(
            unlock_time <= block.timestamp + MAXTIME,
            "Voting lock can be 2 years max"
        );

        _deposit_for(
            _tokenId,
            0,
            unlock_time,
            _locked,
            DepositType.INCREASE_UNLOCK_TIME
        );
    }

    /// @notice Withdraw all tokens for `_tokenId`
    /// @dev Only possible if the lock has expired
    function withdraw(uint256 _tokenId) external nonreentrant {
        /*assert(_isApprovedOrOwner(msg.sender, _tokenId));*/
        require(attachments[_tokenId] == 0 && !voted[_tokenId], "attached");

        LockedBalance memory _locked = locked[_tokenId];
        uint256 value = uint256(int256(_locked.amount));

        (uint256 burnFeeAmount, uint256 recoupFeeAmount) = IVeFeeCalculator(feeCalculator).getEarlyWithdrawalFees(
            value,
            _locked.end
        );
        value = value - burnFeeAmount - recoupFeeAmount;

        locked[_tokenId] = LockedBalance(0, 0);
        uint256 supply_before = supply();

        // old_locked can have either expired <= timestamp or zero end
        // _locked has only 0 end
        // Both can have >= 0 amount
        _checkpoint(_tokenId, _locked, LockedBalance(0, 0));

        if (burnFeeAmount > 0) {
            ERC20Burnable(token).burn(burnFeeAmount);
            emit BurnFeePaid(msg.sender, _tokenId, burnFeeAmount);
        }
        if (recoupFeeAmount > 0) {
            uint256 buybackAmount = recoupFeeAmount.mul(IVeFeeCalculator(feeCalculator).buybackFeeSplit());
            IERC20(token).safeTransfer(vester, recoupFeeAmount - buybackAmount);
            IERC20(token).safeTransfer(buybackPool, buybackAmount);
            emit RecoupFeePaid(
                msg.sender,
                _tokenId,
                recoupFeeAmount - buybackAmount,
                buybackAmount
            );
        }
        IERC20(token).safeTransfer(msg.sender, value);

        // Burn the NFT
        _burn(_tokenId);

        emit Withdraw(msg.sender, _tokenId, value, block.timestamp);
        emit Supply(supply_before, supply());
    }

    /*///////////////////////////////////////////////////////////////
                           GAUGE VOTING STORAGE
    //////////////////////////////////////////////////////////////*/

    // The following ERC20/minime-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.

    /// @notice Binary search to estimate timestamp for block number
    /// @param  _block Block to find
    /// @param  max_epoch Don't go beyond this epoch
    /// @return Approximate timestamp for block
    function _find_block_epoch(
        uint256 _block,
        uint256 max_epoch
    ) internal view returns (uint256) {
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (point_history[_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /// @notice Binary search to estimate epoch for timestamp
    /// @param  _time timestamp to find
    /// @param  max_epoch Don't go beyond this epoch
    /// @return Approximate timestamp for block
    function _find_time_user_epoch(
        uint256 _tokenId,
        uint256 _time,
        uint256 max_epoch
    ) internal view returns (uint256) {
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 256; ++i) {
            // Will be always enough for 256-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[_tokenId][_mid].ts <= _time) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /// @notice Get the current voting power for `_tokenId`
    /// @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    /// @param  _tokenId NFT for lock
    /// @param  _t Epoch time to return voting power at
    /// @return  User voting power
    function _balanceOfNFT(
        uint256 _tokenId,
        uint256 _t
    ) internal view returns (uint256) {
        uint256 _epoch = user_point_epoch[_tokenId];
        if (_epoch == 0) {
            return 0;
        } else {
            _epoch = _find_time_user_epoch(_tokenId, _t, _epoch);

            Point memory last_point = user_point_history[_tokenId][_epoch];
            last_point.bias -=
                last_point.slope *
                int128(int256(_t) - int256(last_point.ts));
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
            return uint256(int256(last_point.bias));
        }
    }

    function balanceOfNFT(uint256 _tokenId) external view returns (uint256) {
        if (ownership_change[_tokenId] == block.number) return 0;
        return _balanceOfNFT(_tokenId, block.timestamp);
    }

    function balanceOfNFTAt(
        uint256 _tokenId,
        uint256 _t
    ) external view returns (uint256) {
        return _balanceOfNFT(_tokenId, _t);
    }

    /// @notice Measure voting power of `_tokenId` at block height `_block`
    /// @dev Adheres to MiniMe `balanceOfAt` interface: https://github.com/Giveth/minime
    /// @param  _tokenId User's wallet NFT
    /// @param  _block Block to calculate the voting power at
    /// @return Voting power
    function _balanceOfAtNFT(
        uint256 _tokenId,
        uint256 _block
    ) internal view returns (uint256) {
        // Copying and pasting totalSupply code because Vyper cannot pass by
        // reference yet
        /*assert(_block <= block.number);*/

        // Binary search
        uint256 _min = 0;
        uint256 _max = user_point_epoch[_tokenId];
        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[_tokenId][_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }

        Point memory upoint = user_point_history[_tokenId][_min];

        uint256 max_epoch = epoch;
        uint256 _epoch = _find_block_epoch(_block, max_epoch);
        Point memory point_0 = point_history[_epoch];
        uint256 d_block = 0;
        uint256 d_t = 0;
        if (_epoch < max_epoch) {
            Point memory point_1 = point_history[_epoch + 1];
            d_block = point_1.blk - point_0.blk;
            d_t = point_1.ts - point_0.ts;
        } else {
            d_block = block.number - point_0.blk;
            d_t = block.timestamp - point_0.ts;
        }
        uint256 block_time = point_0.ts;
        if (d_block != 0) {
            block_time += (d_t * (_block - point_0.blk)) / d_block;
        }

        upoint.bias -= upoint.slope * int128(int256(block_time - upoint.ts));
        if (upoint.bias >= 0) {
            return uint256(uint128(upoint.bias));
        } else {
            return 0;
        }
    }

    function balanceOfAtNFT(
        uint256 _tokenId,
        uint256 _block
    ) external view returns (uint256) {
        return _balanceOfAtNFT(_tokenId, _block);
    }

    /// @notice Calculate total voting power at some point in the past
    /// @param  _block Block to calculate the total voting power at
    /// @return Total voting power at `_block`
    function totalSupplyAt(uint256 _block) external view returns (uint256) {
        /*assert(_block <= block.number);*/
        uint256 _epoch = epoch;
        uint256 target_epoch = _find_block_epoch(_block, _epoch);

        Point memory point = point_history[target_epoch];
        uint256 dt = 0;
        if (target_epoch < _epoch) {
            Point memory point_next = point_history[target_epoch + 1];
            if (point.blk != point_next.blk) {
                dt =
                    ((_block - point.blk) * (point_next.ts - point.ts)) /
                    (point_next.blk - point.blk);
            }
        } else {
            if (point.blk != block.number) {
                dt =
                    ((_block - point.blk) * (block.timestamp - point.ts)) /
                    (block.number - point.blk);
            }
        }
        // Now dt contains info on how far are we beyond point
        return _supply_at(point, point.ts + dt);
    }

    /// @notice Calculate total voting power at some point in the past
    /// @param  point The point (bias/slope) to start search from
    /// @param  t Time to calculate the total voting power at
    /// @return Total voting power at that time
    function _supply_at(
        Point memory point,
        uint256 t
    ) internal view returns (uint256) {
        Point memory last_point = point;
        uint256 t_i = (last_point.ts / WEEK) * WEEK;
        for (uint256 i = 0; i < 255; ++i) {
            t_i += WEEK;
            int128 d_slope = 0;
            if (t_i > t) {
                t_i = t;
            } else {
                d_slope = slope_changes[t_i];
            }
            last_point.bias -=
                last_point.slope *
                int128(int256(t_i - last_point.ts));
            if (t_i == t) {
                break;
            }
            last_point.slope += d_slope;
            last_point.ts = t_i;
        }

        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(uint128(last_point.bias));
    }

    function totalSupply() external view returns (uint256) {
        return totalSupplyAtT(block.timestamp);
    }

    /// @notice Calculate total voting power
    /// @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
    /// @return Total voting power
    function totalSupplyAtT(uint256 t) public view returns (uint256) {
        uint256 _epoch = epoch;
        Point memory last_point = point_history[_epoch];
        return _supply_at(last_point, t);
    }

    /// @notice Returns the total base tokens this Voting Escrow holds
    /// @return The balance of base tokens this contract holds
    function supply() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /*///////////////////////////////////////////////////////////////
                            GAUGE VOTING LOGIC
    //////////////////////////////////////////////////////////////*/

    function voting(uint256 _tokenId) external {
        require(msg.sender == voter);
        voted[_tokenId] = true;
    }

    function abstain(uint256 _tokenId) external {
        require(msg.sender == voter);
        voted[_tokenId] = false;
    }

    function attach(uint256 _tokenId) external {
        require(msg.sender == voter);
        attachments[_tokenId] = attachments[_tokenId] + 1;
    }

    function detach(uint256 _tokenId) external {
        require(msg.sender == voter);
        attachments[_tokenId] = attachments[_tokenId] - 1;
    }

    function merge(uint256 _from, uint256 _to) external {
        require(
            !IVoter(voter).stale(_from) && !IVoter(voter).stale(_to),
            "!ACTIVE"
        );
        require(attachments[_from] == 0 && !voted[_from], "attached");
        require(_from != _to);
        require(_isApprovedOrOwner(msg.sender, _from));
        require(_isApprovedOrOwner(msg.sender, _to));

        LockedBalance memory _locked0 = locked[_from];
        LockedBalance memory _locked1 = locked[_to];
        uint256 value0 = uint256(int256(_locked0.amount));
        uint256 end = _locked0.end >= _locked1.end
            ? _locked0.end
            : _locked1.end;

        locked[_from] = LockedBalance(0, 0);
        _checkpoint(_from, _locked0, LockedBalance(0, 0));
        _burn(_from);
        _deposit_for(_to, value0, end, _locked1, DepositType.MERGE_TYPE);
    }

    function split(
        uint256 _from,
        uint256 _amount
    ) external returns (uint256 newTokenId) {
        require(_amount > 0);
        require(
            attachments[_from] == 0 && !voted[_from],
            "ATTACHED, reset votes and unboost liquidity"
        );
        require(_isApprovedOrOwner(msg.sender, _from));

        LockedBalance memory initialLocked = locked[_from];
        uint256 oldAmount = uint256(int256(initialLocked.amount));

        require(
            initialLocked.end > block.timestamp,
            "Cannot add to an expired lock. Withdraw"
        );
        require(_amount < oldAmount);

        LockedBalance memory newLocked;
        newLocked.amount = 0;
        newLocked.end = initialLocked.end;

        ++tokenId;
        _mint(msg.sender, tokenId);

        LockedBalance memory updatedLocked;
        updatedLocked.amount = int128(uint128(oldAmount - _amount));
        updatedLocked.end = initialLocked.end;

        locked[_from] = updatedLocked;

        _checkpoint(_from, initialLocked, updatedLocked);

        _deposit_for(
            tokenId,
            _amount,
            initialLocked.end,
            newLocked,
            DepositType.SPLIT_TYPE
        );

        newTokenId = tokenId;
    }

    /*///////////////////////////////////////////////////////////////
                            DAO VOTING STORAGE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Overrides the standard `Comp.sol` delegates mapping to return
     * the delegator's own address if they haven't delegated.
     * This avoids having to delegate to oneself.
     */
    function delegates(address delegator) public view returns (address) {
        address current = _delegates[delegator];
        return current == address(0) ? delegator : current;
    }

    /**
     * @notice Gets the current votes balance for `account`
     *
     * @param  account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getVotes(address account) external view returns (uint256) {
        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }
        uint256[] storage _tokenIds = checkpoints[account][nCheckpoints - 1]
            .tokenIds;
        uint256 votes = 0;
        for (uint256 i = 0; i < _tokenIds.length; ++i) {
            uint256 tId = _tokenIds[i];
            votes = votes + _balanceOfNFT(tId, block.timestamp);
        }
        return votes;
    }

    function getPastVotesIndex(
        address account,
        uint256 timestamp
    ) public view returns (uint32) {
        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }
        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].timestamp <= timestamp) {
            return (nCheckpoints - 1);
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].timestamp > timestamp) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint storage cp = checkpoints[account][center];
            if (cp.timestamp == timestamp) {
                return center;
            } else if (cp.timestamp < timestamp) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return lower;
    }

    function getPastVotes(
        address account,
        uint256 timestamp
    ) public view returns (uint256) {
        uint32 _checkIndex = getPastVotesIndex(account, timestamp);
        // Sum votes
        uint256[] storage _tokenIds = checkpoints[account][_checkIndex]
            .tokenIds;
        uint256 votes = 0;
        for (uint256 i = 0; i < _tokenIds.length; ++i) {
            uint256 tId = _tokenIds[i];
            // Use the provided input timestamp here to get the right decay
            votes = votes + _balanceOfNFT(tId, timestamp);
        }
        return votes;
    }

    function getPastTotalSupply(
        uint256 timestamp
    ) external view returns (uint256) {
        return totalSupplyAtT(timestamp);
    }

    /*///////////////////////////////////////////////////////////////
                             DAO VOTING LOGIC
    //////////////////////////////////////////////////////////////*/

    function _moveTokenDelegates(
        address srcRep,
        address dstRep,
        uint256 _tokenId
    ) internal {
        if (srcRep != dstRep && _tokenId > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256[] storage srcRepOld = srcRepNum > 0
                    ? checkpoints[srcRep][srcRepNum - 1].tokenIds
                    : checkpoints[srcRep][0].tokenIds;
                uint32 nextSrcRepNum = _findWhatCheckpointToWrite(srcRep);
                uint256[] storage srcRepNew = checkpoints[srcRep][nextSrcRepNum]
                    .tokenIds;
                // All the same except _tokenId
                for (uint256 i = 0; i < srcRepOld.length; ++i) {
                    uint256 tId = srcRepOld[i];
                    if (tId != _tokenId) {
                        srcRepNew.push(tId);
                    }
                }

                numCheckpoints[srcRep] = srcRepNum + 1;
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256[] storage dstRepOld = dstRepNum > 0
                    ? checkpoints[dstRep][dstRepNum - 1].tokenIds
                    : checkpoints[dstRep][0].tokenIds;
                uint32 nextDstRepNum = _findWhatCheckpointToWrite(dstRep);
                uint256[] storage dstRepNew = checkpoints[dstRep][nextDstRepNum]
                    .tokenIds;
                // All the same plus _tokenId
                require(
                    dstRepOld.length + 1 <= MAX_DELEGATES,
                    "dstRep would have too many tokenIds"
                );
                for (uint256 i = 0; i < dstRepOld.length; ++i) {
                    uint256 tId = dstRepOld[i];
                    dstRepNew.push(tId);
                }
                dstRepNew.push(_tokenId);

                numCheckpoints[dstRep] = dstRepNum + 1;
            }
        }
    }

    function _findWhatCheckpointToWrite(
        address account
    ) internal view returns (uint32) {
        uint256 _timestamp = block.timestamp;
        uint32 _nCheckPoints = numCheckpoints[account];

        if (
            _nCheckPoints > 0 &&
            checkpoints[account][_nCheckPoints - 1].timestamp == _timestamp
        ) {
            return _nCheckPoints - 1;
        } else {
            return _nCheckPoints;
        }
    }

    function _moveAllDelegates(
        address owner,
        address srcRep,
        address dstRep
    ) internal {
        // You can only redelegate what you own
        if (srcRep != dstRep) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256[] storage srcRepOld = srcRepNum > 0
                    ? checkpoints[srcRep][srcRepNum - 1].tokenIds
                    : checkpoints[srcRep][0].tokenIds;
                uint32 nextSrcRepNum = _findWhatCheckpointToWrite(srcRep);
                uint256[] storage srcRepNew = checkpoints[srcRep][nextSrcRepNum]
                    .tokenIds;
                // All the same except what owner owns
                for (uint256 i = 0; i < srcRepOld.length; ++i) {
                    uint256 tId = srcRepOld[i];
                    if (idToOwner[tId] != owner) {
                        srcRepNew.push(tId);
                    }
                }

                numCheckpoints[srcRep] = srcRepNum + 1;
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256[] storage dstRepOld = dstRepNum > 0
                    ? checkpoints[dstRep][dstRepNum - 1].tokenIds
                    : checkpoints[dstRep][0].tokenIds;
                uint32 nextDstRepNum = _findWhatCheckpointToWrite(dstRep);
                uint256[] storage dstRepNew = checkpoints[dstRep][nextDstRepNum]
                    .tokenIds;
                uint256 ownerTokenCount = ownerToNFTokenCount[owner];
                require(
                    dstRepOld.length + ownerTokenCount <= MAX_DELEGATES,
                    "dstRep would have too many tokenIds"
                );
                // All the same
                for (uint256 i = 0; i < dstRepOld.length; ++i) {
                    uint256 tId = dstRepOld[i];
                    dstRepNew.push(tId);
                }
                // Plus all that's owned
                for (uint256 i = 0; i < ownerTokenCount; ++i) {
                    uint256 tId = ownerToNFTokenIdList[owner][i];
                    dstRepNew.push(tId);
                }

                numCheckpoints[dstRep] = dstRepNum + 1;
            }
        }
    }

    function _delegate(address delegator, address delegatee) internal {
        /// @notice differs from `_delegate()` in `Comp.sol` to use `delegates` override method to simulate auto-
        ///         delegation
        address currentDelegate = delegates(delegator);

        _delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);
        _moveAllDelegates(delegator, currentDelegate, delegatee);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     *
     * @param  delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        if (delegatee == address(0)) delegatee = msg.sender;
        return _delegate(msg.sender, delegatee);
    }

    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
        address signatory = ecrecover(digest, v, r, s);
        require(
            signatory != address(0),
            "VotingEscrow::delegateBySig: invalid signature"
        );
        require(
            nonce == nonces[signatory]++,
            "VotingEscrow::delegateBySig: invalid nonce"
        );
        require(
            block.timestamp <= expiry,
            "VotingEscrow::delegateBySig: signature expired"
        );
        return _delegate(signatory, delegatee);
    }
}
