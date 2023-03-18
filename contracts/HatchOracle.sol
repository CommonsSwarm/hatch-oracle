pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import { IHatch as Hatch } from "./IHatch.sol";


contract HatchOracle is AragonApp, IACLOracle {
    using SafeMath for uint256;

    bytes32 public constant SET_SCORE_TOKEN_ROLE = keccak256("SET_SCORE_TOKEN_ROLE");
    bytes32 public constant SET_RATIO_ROLE = keccak256("SET_RATIO_ROLE");

    string private constant ERROR_TOKEN_NOT_CONTRACT = "HATCH_ORACLE_TOKEN_NOT_CONTRACT";
    string private constant ERROR_PARAMS_MISSING = "HATCH_ORACLE_PARAMS_MISSING";
    string private constant ERROR_SENDER_TOO_BIG = "HATCH_ORACLE_SENDER_TOO_BIG";
    string private constant ERROR_SENDER_ZERO = "HATCH_ORACLE_SENDER_ZERO";

    uint32 public constant PPM = 1000000;

    ERC20 public score;
    uint256 public ratio;
    Hatch public hatch;

    event ScoreTokenSet(address score);
    event RatioSet(uint256 ratio);

    /**
     * @param _score The membership score token address
     * @param _ratio Ratio between contribution and membership score
    */
    function initialize(address _score, uint256 _ratio, address _hatch) external onlyInit {
        require(isContract(_score), ERROR_TOKEN_NOT_CONTRACT);

        score = ERC20(_score);
        ratio = _ratio;
        hatch = Hatch(_hatch);

        initialized();
    }

    /**
     * @notice Update membership score token address to `_score`
     * @param _score The new score token address
     */
    function setScoreToken(address _score) external auth(SET_SCORE_TOKEN_ROLE) {
        require(isContract(_score), ERROR_TOKEN_NOT_CONTRACT);
        score = ERC20(_score);

        emit ScoreTokenSet(_score);
    }

    /**
     * @notice Update ratio to `_ratio`/1000000
     * @param _ratio The new ratio between contribution and membership score
     */
    function setRatio(uint256 _ratio) external auth(SET_RATIO_ROLE) {
        ratio = _ratio;

        emit RatioSet(_ratio);
    }

    /**
     * @dev Amount a contributor is still allowed to contribute
     * @param _contributor Address of the contributor we are querying
     */
    function allowance(address _contributor) external view isInitialized returns (uint256) {
        return score.balanceOf(_contributor).mul(ratio).div(PPM).sub(_getTotalContributed(_contributor));
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance.  The ACLOracle permissioned function should specify the sender
    *     and amount with 'authP(SOME_ACL_ROLE, arr(sender, amount))', typically set to 'msg.sender'.
    */
    function canPerform(address, address, bytes32, uint256[] _how) external view isInitialized returns (bool) {
        require(_how.length > 1, ERROR_PARAMS_MISSING);
        require(_how[0] < 2**160, ERROR_SENDER_TOO_BIG);
        require(_how[0] != 0, ERROR_SENDER_ZERO);

        address sender = address(_how[0]);
        uint256 senderScore = score.balanceOf(sender);

        return senderScore.mul(ratio).div(PPM) >= _getTotalContributed(sender).add(_how[1]);
    }

    function _getTotalContributed(address _contributor) internal view returns (uint256) {
        return ERC20(hatch.token()).balanceOf(_contributor).mul(PPM).div(hatch.exchangeRate());
    }
}
