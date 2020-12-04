pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract HatchMock is AragonApp {

    using SafeMath for uint256;

    bytes32 public constant CONTRIBUTE_ROLE = keccak256("CONTRIBUTE_ROLE");

    ERC20 public token;
    uint256 public exchangeRate;
    uint32 public constant PPM = 1000000;

    function initialize(address _token, uint256 _exchangeRate) external onlyInit {
        token = ERC20(_token);
        exchangeRate = _exchangeRate;
        initialized();
    }

    function contribute(uint amount) external authP(CONTRIBUTE_ROLE, arr(msg.sender, amount)) {
        token.transfer(msg.sender, exchangeRate.mul(amount).div(PPM));
    }
}
