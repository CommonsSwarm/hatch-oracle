const { assertRevert } = require('./helpers/helpers')
const Oracle = artifacts.require('TokenBalanceOracle')
const MockErc20 = artifacts.require('TokenMock')

const deployDAO = require('./helpers/deployDao')
const { deployedContract } = require('./helpers/helpers')
const { hash: nameHash } = require('eth-ens-namehash')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

contract('TokenBalanceOracle', ([appManager, accountBal900, accountBal100, accountBal0, nonContractAddress]) => {
  let oracleBase, oracle, mockErc20
  let SET_TOKEN_ROLE, SET_MIN_BALANCE_ROLE

  const ORACLE_MINIMUM_BALANCE = 100
  const MOCK_TOKEN_BALANCE = 1000

  before('deploy base apps', async () => {
    oracleBase = await Oracle.new()
    SET_TOKEN_ROLE = await oracleBase.SET_TOKEN_ROLE()
    SET_MIN_BALANCE_ROLE = await oracleBase.SET_MIN_BALANCE_ROLE()
  })

  beforeEach('deploy dao and token balance oracle', async () => {
    const daoDeployment = await deployDAO(appManager)
    dao = daoDeployment.dao
    acl = daoDeployment.acl

    const newOracleReceipt = await dao.newAppInstance(
      nameHash('token-balance-oracle.aragonpm.test'),
      oracleBase.address,
      '0x',
      false,
      {
        from: appManager,
      }
    )
    oracle = await Oracle.at(deployedContract(newOracleReceipt))
    mockErc20 = await MockErc20.new(accountBal900, MOCK_TOKEN_BALANCE)
    mockErc20.transfer(accountBal100, ORACLE_MINIMUM_BALANCE, { from: accountBal900 })
  })

  describe('initialize(address _token)', () => {
    beforeEach('initialize oracle', async () => {
      await oracle.initialize(mockErc20.address, ORACLE_MINIMUM_BALANCE)
    })

    it('sets variables as expected', async () => {
      const actualToken = await oracle.token()
      const hasInitialized = await oracle.hasInitialized()

      assert.strictEqual(actualToken, mockErc20.address)
      assert.isTrue(hasInitialized)
    })

    it('reverts on reinitialization', async () => {
      await assertRevert(oracle.initialize(mockErc20.address, ORACLE_MINIMUM_BALANCE), 'INIT_ALREADY_INITIALIZED')
    })

    describe('setToken(address _token)', () => {
      beforeEach('set permission', async () => {
        await acl.createPermission(appManager, oracle.address, SET_TOKEN_ROLE, appManager)
      })

      it('sets a new token', async () => {
        const newMockErc20 = await MockErc20.new(appManager, 100)
        const expectedToken = newMockErc20.address

        await oracle.setToken(expectedToken)

        const actualToken = await oracle.token()
        assert.equal(actualToken, expectedToken)
      })

      it('reverts when setting a non contract token address', async () => {
        await assertRevert(oracle.setToken(nonContractAddress), 'ORACLE_TOKEN_NOT_CONTRACT')
      })
    })

    describe('setBalance(uint256 _minBalance)', () => {
      beforeEach('set permission', async () => {
        await acl.createPermission(appManager, oracle.address, SET_MIN_BALANCE_ROLE, appManager)
      })

      it('sets a new minimum balance', async () => {
        const expectedNewBalance = 100
        await oracle.setMinBalance(expectedNewBalance)

        const actualNewBalance = await oracle.minBalance()
        assert.equal(actualNewBalance, expectedNewBalance)
      })
    })

    describe('canPerform(address, address, bytes32, uint256[])', async () => {
      describe('no permission params', () => {
        context(`Required balance is ${ORACLE_MINIMUM_BALANCE}`, () => {
          it('can perform action if account has more than minimum required balance', async () => {
            assert.isTrue(await oracle.canPerform(accountBal900, ANY_ADDR, '0x', []))
          })

          it(`can perform action if account has exactly the minimum required balance`, async () => {
            assert.isTrue(await oracle.canPerform(accountBal100, ANY_ADDR, '0x', []))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(accountBal0, ANY_ADDR, '0x', []))
          })
        })

        context(`Required balance is 1`, () => {
          beforeEach('set minimum required balance to 1', async () => {
            await acl.createPermission(appManager, oracle.address, SET_MIN_BALANCE_ROLE, appManager)
            await oracle.setMinBalance(1)
          })

          it('all accounts with positive balance can perform action', async () => {
            assert.isTrue(await oracle.canPerform(accountBal900, ANY_ADDR, '0x', []))
            assert.isTrue(await oracle.canPerform(accountBal100, ANY_ADDR, '0x', []))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(accountBal0, ANY_ADDR, '0x', []))
          })
        })
      })

      describe('balance passed as permission param', async () => {
        let balancePermissionParam = MOCK_TOKEN_BALANCE - ORACLE_MINIMUM_BALANCE

        context(`Required balance passed as param is ${balancePermissionParam}`, () => {
          it('can perform action if account has exactly the minimum required balance passed as param', async () => {
            assert.isTrue(await oracle.canPerform(accountBal900, ANY_ADDR, '0x', [balancePermissionParam]))
          })

          it("can't perform action if account has less tokens than balance passed as param", async () => {
            assert.isFalse(await oracle.canPerform(accountBal100, ANY_ADDR, '0x', [balancePermissionParam]))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(accountBal0, ANY_ADDR, '0x', [balancePermissionParam]))
          })
        })

        context(`Required balance passed as param is 1`, () => {
          it('all accounts with positive balance can perform action', async () => {
            assert.isTrue(await oracle.canPerform(accountBal900, ANY_ADDR, '0x', [1]))
            assert.isTrue(await oracle.canPerform(accountBal100, ANY_ADDR, '0x', [1]))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(accountBal0, ANY_ADDR, '0x', [1]))
          })
        })
      })
    })
  })

  describe('app not initialized', () => {
    it('reverts on setting token', async () => {
      await assertRevert(oracle.setToken(mockErc20.address), 'APP_AUTH_FAILED')
    })

    it('reverts on setting balance', async () => {
      await assertRevert(oracle.setMinBalance(0), 'APP_AUTH_FAILED')
    })

    it('reverts on checking can perform', async () => {
      await assertRevert(oracle.canPerform(appManager, ANY_ADDR, '0x', []))
    })
  })
})
