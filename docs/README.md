# App X <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

1Hive's X app allows an Aragon organization to require users to [insert cool thing here]. For example [insert example here].

#### 🐲 Project stage: development

The X app is still in development. If you are interested in contributing please see our open [issues](https://github.com/1hive/x-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work?

[Insert detailed description here]

### Initialization

The X app is initialized with `param1`, `param2`, and `param3` parameters. `param1` does A. `param2` does B. `param3` does C.

### Roles

The X app should implement the following roles:
- **ROLE_1**: This allows for [insert role functionality here].
- **ROLE_2**: This allows for [insert role functionality here].
- **ROLE_3**: This allows for [insert role functionality here].

### Interface

[explain the interface]

## How to run Time Lock app locally

First make sure that you have node, npm, and the aragonCLI installed and working. Instructions on how to set that up can be found [here](https://hack.aragon.org/docs/cli-intro.html). You'll also need to have [Metamask](https://metamask.io) or some kind of web wallet enabled to sign transactions in the browser.

Git clone this repo.

```sh
git clone https://github.com/1Hive/x-app.git
```

Navigate into the `x-app` directory.

```sh
cd x-app
```

Install npm dependencies.

```sh
npm i
```

Deploy a dao with Time Lock app installed on your local environment.

```sh
npm run start:template
```

If everything is working correctly, your new DAO will be deployed and your browser will open http://localhost:3000/#/YOUR-DAO-ADDRESS. It should look something like this:

![Newly deploy DAO with x app]([insert example picture here])

You will also see the configuration for your local deployment in the terminal. It should look something like this:

```sh
    Ethereum Node: ws://localhost:8545
    ENS registry: 0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1
    APM registry: aragonpm.eth
    DAO address: YOUR-DAO-ADDRESS
```

### Template

The X app is initialized with [explain template initialization here].

[explain how-to use and interact with the template here]

## Aragon DAO Installation

[list Rinkeby or Mainnet APM deployment here]

To deploy to an organization you can use the [aragonCLI](https://hack.aragon.org/docs/cli-intro.html).

```sh
aragon dao install <dao-address> x.open.aragonpm.eth --app-init-args <thing1> <thing2> <thing3>
```

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/1Hive/x-app/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [team Keybase chat](https://1hive.org/contribute/keybase). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.
