const { assertRevert } = require('./helpers/helpers')
const Oracle = artifacts.require('TokenBalanceOracle')
const MockErc20 = artifacts.require('TokenMock')
const ExecutionTarget = artifacts.require('ExecutionTarget')

const deployDAO = require('./helpers/deployDao')
const { deployedContract } = require('./helpers/helpers')
const { hash: nameHash } = require('eth-ens-namehash')
const BN = require('bn.js')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

const ORACLE_PARAM_ID = new BN(203).shln(248)
const EQ = new BN(1).shln(240)

contract('TokenBalanceOracle', ([appManager, account1, account2, nonContractAddress]) => {
  let oracleBase, oracle, mockErc20, executionTargetBase, executionTarget
  let SET_TOKEN_ROLE, SET_BALANCE_ROLE, SET_COUNTER_ROLE, EXECUTE_ROLE

  const ORACLE_MINIMUM_BALANCE = 100
  const MOCK_TOKEN_BALANCE = 1000
  const account1Balance = ORACLE_MINIMUM_BALANCE

  before('deploy base apps', async () => {
    oracleBase = await Oracle.new()
    SET_TOKEN_ROLE = await oracleBase.SET_TOKEN_ROLE()
    SET_BALANCE_ROLE = await oracleBase.SET_BALANCE_ROLE()

    executionTargetBase = await ExecutionTarget.new()
    SET_COUNTER_ROLE = await executionTargetBase.SET_COUNTER_ROLE()
    EXECUTE_ROLE = await executionTargetBase.EXECUTE_ROLE()
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
    mockErc20 = await MockErc20.new(appManager, MOCK_TOKEN_BALANCE)
    mockErc20.transfer(account1, account1Balance)
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
        await acl.createPermission(appManager, oracle.address, SET_BALANCE_ROLE, appManager)
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
            assert.isTrue(await oracle.canPerform(appManager, ANY_ADDR, '0x', []))
          })

          it(`can perform action if account has exactly the minimum required balance`, async () => {
            assert.isTrue(await oracle.canPerform(account1, ANY_ADDR, '0x', []))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(account2, ANY_ADDR, '0x', []))
          })
        })

        context(`Required balance is 0`, () => {
          beforeEach('set minimum required balance to 0', async () => {
            await acl.createPermission(appManager, oracle.address, SET_BALANCE_ROLE, appManager)
            await oracle.setMinBalance(0)
          })

          it('all accounts with positive balance can perform action', async () => {
            assert.isTrue(await oracle.canPerform(appManager, ANY_ADDR, '0x', []))
            assert.isTrue(await oracle.canPerform(account1, ANY_ADDR, '0x', []))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(account2, ANY_ADDR, '0x', []))
          })
        })
      })

      describe('balance passed as permission param', async () => {
        let balancePermissionParam = MOCK_TOKEN_BALANCE - account1Balance

        context(`Required balance passed as param is ${balancePermissionParam}`, () => {
          it('can perform action if account has exactly the minimum required balance passed as param', async () => {
            assert.isTrue(await oracle.canPerform(appManager, ANY_ADDR, '0x', [balancePermissionParam]))
          })

          it("can't perform action if account has less tokens than balance passed as param", async () => {
            assert.isFalse(await oracle.canPerform(account1, ANY_ADDR, '0x', [balancePermissionParam]))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(account2, ANY_ADDR, '0x', [balancePermissionParam]))
          })
        })

        context(`Required balance passed as param is 0`, () => {
          it('all accounts with positive balance can perform action', async () => {
            assert.isTrue(await oracle.canPerform(appManager, ANY_ADDR, '0x', [0]))
            assert.isTrue(await oracle.canPerform(account1, ANY_ADDR, '0x', [0]))
          })

          it("can't perform action if account does not have tokens", async () => {
            assert.isFalse(await oracle.canPerform(account2, ANY_ADDR, '0x', [0]))
          })
        })
      })
    })

    describe('integration tests with executionTarget', () => {
      let INITIAL_COUNTER = 1
      let oracleAddressBN, params

      beforeEach('deploy ExecutionTarget', async () => {
        const newExecutionTargetReceipt = await dao.newAppInstance(
          nameHash('execution-target.aragonpm.test'),
          executionTargetBase.address,
          '0x',
          false,
          {
            from: appManager,
          }
        )
        executionTarget = await ExecutionTarget.at(deployedContract(newExecutionTargetReceipt))

        //convert oracle address to BN and get param256: [(uint256(ORACLE_PARAM_ID) << 248) + (uint256(EQ) << 240) + oracleAddress];
        oracleAddressBN = new BN(oracle.address.slice(2), 16)
        params = [ORACLE_PARAM_ID.add(EQ).add(oracleAddressBN)]

        await executionTarget.initialize(INITIAL_COUNTER)
      })

      describe('executing function with no auth params', () => {
        beforeEach('Create role and grant with params', async () => {
          await acl.createPermission(appManager, executionTarget.address, SET_COUNTER_ROLE, appManager)
          await acl.grantPermissionP(appManager, executionTarget.address, SET_COUNTER_ROLE, params)
          await acl.grantPermissionP(account1, executionTarget.address, SET_COUNTER_ROLE, params)
          await acl.grantPermissionP(account2, executionTarget.address, SET_COUNTER_ROLE, params)
        })

        context(`Required balance is ${ORACLE_MINIMUM_BALANCE}`, () => {
          it('can perform action if account has more than minimum required balance', async () => {
            const expectedCounter = 3

            await executionTarget.setCounter(expectedCounter)

            const actualCounter = await executionTarget.counter()
            assert.equal(actualCounter, expectedCounter)
          })

          it(`can perform action if account has exactly the minimum required balance`, async () => {
            await executionTarget.setCounter(1, { from: account1 })
          })

          it("can't perform action if account does not have tokens", async () => {
            await assertRevert(executionTarget.setCounter(1, { from: account2 }), 'APP_AUTH_FAILED')
          })
        })

        context(`Required balance is 0`, () => {
          beforeEach('set minimum required balance to 0', async () => {
            await acl.createPermission(appManager, oracle.address, SET_BALANCE_ROLE, appManager)
            await oracle.setMinBalance(0)
          })

          it('all accounts with positive balance can perform action', async () => {
            //appManager
            await executionTarget.setCounter(1)
            //account1
            await executionTarget.setCounter(1, { from: account1 })
          })

          it("can't perform action if account does not have tokens", async () => {
            await assertRevert(executionTarget.setCounter(1, { from: account2 }), 'APP_AUTH_FAILED')
          })
        })
      })

      describe('executing function with balance auth param', () => {
        //note that for this function the required minimum balance is set by the counter state variable.
        beforeEach('Create role and grant with params', async () => {
          await acl.createPermission(appManager, executionTarget.address, EXECUTE_ROLE, appManager)
          await acl.grantPermissionP(appManager, executionTarget.address, EXECUTE_ROLE, params)
          await acl.grantPermissionP(account1, executionTarget.address, EXECUTE_ROLE, params)
          await acl.grantPermissionP(account2, executionTarget.address, EXECUTE_ROLE, params)
        })

        context(`Required balance is ${ORACLE_MINIMUM_BALANCE}`, () => {
          beforeEach(`set counter to ${ORACLE_MINIMUM_BALANCE}`, async () => {
            await acl.createPermission(appManager, executionTarget.address, SET_COUNTER_ROLE, appManager)

            //note that setting counter to `ORACLE_MINIMUM_BALANCE` means setting the required balance to `ORACLE_MINIMUM_BALANCE` for execute() function
            await executionTarget.setCounter(ORACLE_MINIMUM_BALANCE)
          })

          it('can execute target if account has more than minimum required balance', async () => {
            await executionTarget.execute()

            const actualCounter = await executionTarget.counter()
            assert.equal(actualCounter, ORACLE_MINIMUM_BALANCE + 1)
          })

          it(`can perform action if account has exactly the minimum required balance`, async () => {
            await executionTarget.execute({ from: account1 })
          })

          it("can't perform action if account does not have tokens", async () => {
            await assertRevert(executionTarget.execute({ from: account2 }), 'APP_AUTH_FAILED')
          })
        })

        context(`Required balance is 0`, () => {
          beforeEach('set counter to 0', async () => {
            await acl.createPermission(appManager, executionTarget.address, SET_COUNTER_ROLE, appManager)

            //note that setting counter to 0 means setting the required balance to 0 for execute() function
            await executionTarget.setCounter(0)
          })

          it('all accounts with positive balance can execute target', async () => {
            await executionTarget.execute()
            await executionTarget.execute({ from: account1 })
          })

          it('all accounts with no balance cannot execute target', async () => {
            await assertRevert(executionTarget.execute({ from: account2 }), 'APP_AUTH_FAILED')
          })
        })

        context(`required balance is ${MOCK_TOKEN_BALANCE * 2}`, () => {
          beforeEach(`set counter to ${MOCK_TOKEN_BALANCE * 2}`, async () => {
            await acl.createPermission(appManager, executionTarget.address, SET_COUNTER_ROLE, appManager)

            //note that setting counter to MOCK_TOKEN_BALANCE * 2 means setting the required balance to MOCK_TOKEN_BALANCE * 2 for execute() function
            await executionTarget.setCounter(MOCK_TOKEN_BALANCE * 2)
          })

          it(`all accounts with less than ${MOCK_TOKEN_BALANCE * 2} tokens can't execute target`, async () => {
            await assertRevert(executionTarget.execute(), 'APP_AUTH_FAILED')
            await assertRevert(executionTarget.execute({ from: account1 }), 'APP_AUTH_FAILED')
            await assertRevert(executionTarget.execute({ from: account2 }), 'APP_AUTH_FAILED')
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
