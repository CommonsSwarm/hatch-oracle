pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";


contract ExecutionTarget is AragonApp {
    bytes32 public constant SET_COUNTER_ROLE = keccak256("SET_COUNTER_ROLE");
    bytes32 public constant EXECUTE_ROLE = keccak256("EXECUTE_ROLE");

    uint public counter;

    function initialize(uint _counter) external onlyInit {
        counter = _counter;

        initialized();
    }

    function setCounter(uint x) external auth(SET_COUNTER_ROLE) {
        counter = x;
    }

    function execute(uint256 balance) external authP(EXECUTE_ROLE, arr(balance)) {
        counter += 1;
    }
}
