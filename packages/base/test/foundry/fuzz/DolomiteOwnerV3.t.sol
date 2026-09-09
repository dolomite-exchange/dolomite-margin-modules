pragma solidity ^0.8.13;


import { Test } from "forge-std/Test.sol";

contract DolomiteOwnerV3Test is Test {

    bytes32 private constant _FILE = "DolomiteOwnerV3Test";

    struct ComputedRole {
        address destination;
        bytes4 selector;
    }

    function test_calculateRole_calculateSelectorAndAddress(bytes4 _selector, address _destination) public {
        bytes32 role = calculateRole(_selector, _destination);

        ComputedRole memory computed = calculateSelectorAndAddress(role);
        assertEq(computed.selector, _selector, "Selector not equal");
        assertEq(computed.destination, _destination, "Destination not equal");
    }

    function calculateRole(bytes4 _selector, address _contract) public pure returns (bytes32) {
        return bytes32(_selector) | bytes32(uint256(uint160(_contract)));
    }

    function calculateSelectorAndAddress(bytes32 role) public pure returns (ComputedRole memory) {
        return ComputedRole({
            destination: address(uint160(uint256(role))),
            selector: bytes4(role)
        });
    }
}