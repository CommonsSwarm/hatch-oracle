pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";


contract TokenBalanceOracle is AragonApp, IACLOracle {

    bytes32 public constant CHANGE_TOKEN_ROLE = keccak256("CHANGE_TOKEN_ROLE");
    string private constant ERROR_TOKEN_NOT_CONTRACT = "ORACLE_TOKEN_NOT_CONTRACT";

    ERC20 public token;

    event ChangeToken(address _newToken);

    function initialize(address _token) external onlyInit {
        initialized();

        token = ERC20(_token);
    }

    /**
    * @notice Change token to `_token`
    * @param _token The new token address
    */
    function changeToken(address _token) external auth(CHANGE_TOKEN_ROLE) {
        require(isContract(_token), ERROR_TOKEN_NOT_CONTRACT);
        token = ERC20(_token);

        emit ChangeToken(_token);
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance
    */
    function canPerform(address _sender, address, bytes32, uint256[] how) external view returns (bool) {
        uint256 balance = token.balanceOf(_sender); 
        return how.length > 0 ? balance >= how[0] : balance > 0;
    }
}