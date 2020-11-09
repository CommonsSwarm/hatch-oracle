pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@ablack/fundraising-presale/contracts/Presale.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract HatchOracle is AragonApp, IACLOracle {
    using SafeMath for uint256;

    bytes32 public constant SET_TOKEN_ROLE = keccak256("SET_TOKEN_ROLE");
    bytes32 public constant SET_RATIO_ROLE = keccak256("SET_RATIO_ROLE");

    string private constant ERROR_TOKEN_NOT_CONTRACT = "TOKEN_BALANCE_ORACLE_TOKEN_NOT_CONTRACT";
    string private constant ERROR_PARAMS_MISSING = "TOKEN_BALANCE_ORACLE_PARAMS_MISSING";
    string private constant ERROR_SENDER_TOO_BIG = "TOKEN_BALANCE_ORACLE_SENDER_TOO_BIG";
    string private constant ERROR_SENDER_ZERO = "TOKEN_BALANCE_ORACLE_SENDER_ZERO";

    uint32  public constant PPM      = 1000000;

    ERC20 public token;
    uint256 public ratio;
    Presale public hatch;

    event TokenSet(address token);
    event RatioSet(uint256 ratioNom, uint256 ratioDen);

    /**
     * @param _token The token address
     * @param _ratio Ratio between sent tokens and token balance
    */
    function initialize(address _token, uint256 _ratio, address _hatch) external onlyInit {
        require(isContract(_token), ERROR_TOKEN_NOT_CONTRACT);

        token = ERC20(_token);
        ratio = _ratio;
        hatch = Presale(_hatch);

        initialized();
    }

    /**
     * @notice Update token address to `_token`
     * @param _token The new token address
     */
    function setToken(address _token) external auth(SET_TOKEN_ROLE) {
        require(isContract(_token), ERROR_TOKEN_NOT_CONTRACT);
        token = ERC20(_token);

        emit TokenSet(_token);
    }

    /**
     * @notice Update ratio to `_ratioNom` / `_ratioDen`
     * @param _ratio The new ratio between sent tokens and token balance
     */
    function setRatio(uint256 _ratio) external auth(SET_RATIO_ROLE) {
        ratio = _ratio;

        emit RatioSet(_ratio, PPM);
    }

    /**
     * @dev Amount of tokens a contributor is still allowed to contribute
     * @param _contributor Address of the contributor we are querying
     */
    function allowance(address _contributor) external view returns (uint256) {
        return token.balanceOf(_contributor).mul(ratio).div(PPM).sub(_getTotalContributed(_contributor));
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance.  The ACLOracle permissioned function should specify the sender
    *     and amount with 'authP(SOME_ACL_ROLE, arr(sender, amount))', typically set to 'msg.sender'.
    */
    function canPerform(address, address, bytes32, uint256[] _how) external view returns (bool) {
        require(_how.length > 1, ERROR_PARAMS_MISSING);
        require(_how[0] < 2**160, ERROR_SENDER_TOO_BIG);
        require(_how[0] != 0, ERROR_SENDER_ZERO);

        address sender = address(_how[0]);
        uint256 senderBalance = token.balanceOf(sender);

        return senderBalance.mul(ratio).div(PPM) >= _getTotalContributed(sender).add(_how[1]);
    }

    function _getTotalContributed(address _contributor) internal view returns (uint256) {
        return ERC20(hatch.token()).balanceOf(_contributor).mul(hatch.PPM()).div(hatch.exchangeRate());
    }
}
