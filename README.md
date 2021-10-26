# Hatch Oracle <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

The Hatch Oracle app is an [ACL Oracle](https://hack.aragon.org/docs/acl_IACLOracle). ACL Oracles are small helper functions that plug in to Aragon's access control list (ACL) to do more sophisticated permission evaluation. In the context of Commons Stack Orgs, the Hatch Oracle is used to check if an address is trying to collaborate on a Hatch more tokens than the allowed by the CSTK tokens it holds. This is done by setting a CSTK/XDAI ratio in the Hatch Oracle. Then when an account submits the intent to perform a contribution on an Hatch whose ROLE is protected behind this Oracle, the ACL will check with the Oracle if the account has exceeded the amount allowed by their CSTK tokens. The Hatch Oracle will return a boolean which can be used to either approve or reject the intent.

The code in this repo has not been audited.

## How does it work?

The Hatch Oracle app is initialized with the address of an ERC-20 token (the membership score, generally CSTK in Commons Stack), a ratio in parts per million, and the hatch contract it is interceding. There are setters for the first two parameters. Other applications can then "query" through the ACL, the Hatch Oracle to determine if an account has enough allowance to perform an action in the Hatch.

## Initialization

The Hatch Oracle is initialized with `address _score`, `uint256 _ratio`, and `address _hatch` parameters.
- The `address _score` parameter is the address of the token that Hatch Oracle is to track.
- The `uint256 _ratio` determine the ratio token balance is going to be multiplied before doing the comparison with the amount of funds contributed. It's specified in PPM.
- The `address _hatch` is the Hatch contract the oracle is interceding.

## Roles

The Hatch Oracle app should implement the following roles:
- **SET_SCORE_TOKEN_ROLE**: This allows for changing the score membership token address that the Hatch Oracle tracks.
- **SET_RATIO_ROLE**: This allows for changing the token ratio at which the Hatch Oracle multiplies the token before comparing with the amount of funds contributed.

## Interface

The Hatch Oracle does not have an interface. It is meant as a back-end helper function for Aragon applications to perform more sophisticated permissions evaluation.

## How to run Hatch Oracle locally

The Hatch Oracle works in tandem with other Aragon applications. While we do not explore this functionality as a stand alone demo, the [TEC template](https://github.com/TECommons/tec-template) uses the Hatch Oracle and it can be run locally.

## Deploying to an Aragon DAO

TBD

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/TECommons/hatch-oracle/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [Discord chat](https://discord.gg/n58U4hA). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.
