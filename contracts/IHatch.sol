pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";


interface IHatch {
    function token() external view returns (address);
    function exchangeRate() external view returns (uint256);
}
