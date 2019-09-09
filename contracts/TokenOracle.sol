pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";


contract TokenOracle is AragonApp, IACLOracle {

    bytes32 public constant CHANGE_TOKEN_ROLE = keccak256("CHANGE_DURATION_ROLE");

    ERC20 public token;

    function initialize(address _token) external onlyInit {
        initialized();

        token = ERC20(_token);
    }

    function changeToken(address _token) external auth(CHANGE_TOKEN_ROLE) {
        token = ERC20(_token);
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance
    */
    function canPerform(address _sender, address, bytes32, uint256[]) external view returns (bool) {
        return token.balanceOf(_sender) > 0;
    }
}