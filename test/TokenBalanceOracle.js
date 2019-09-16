const { assertRevert } = require('./helpers/helpers')
const Oracle = artifacts.require('TokenBalanceOracle')
const MockErc20 = artifacts.require('TokenMock')

import DaoDeployment from './helpers/DaoDeployment'
import { deployedContract } from './helpers/helpers'

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

contract('TokenBalanceOracle', ([rootAccount, ...accounts]) => {
  let daoDeployment = new DaoDeployment()
  let oracleBase, oracle, mockErc20
  let CHANGE_TOKEN_ROLE

  const MOCK_TOKEN_BALANCE = 1000

  before('deploy DAO', async () => {
    await daoDeployment.deployBefore()
    oracleBase = await Oracle.new()
    CHANGE_TOKEN_ROLE = await oracleBase.CHANGE_TOKEN_ROLE()
  })

  beforeEach('install oracle', async () => {
    await daoDeployment.deployBeforeEach(rootAccount)
    const newOracleReceipt = await daoDeployment.kernel.newAppInstance('0x1234', oracleBase.address, '0x', false, {
      from: rootAccount,
    })
    oracle = await Oracle.at(deployedContract(newOracleReceipt))
    mockErc20 = await MockErc20.new(rootAccount, MOCK_TOKEN_BALANCE)
  })

  describe('initialize(address _token)', () => {
    beforeEach('initialize oracle', async () => {
      await oracle.initialize(mockErc20.address)
    })

    it('sets variables as expected', async () => {
      const actualToken = await oracle.token()
      const hasInitialized = await oracle.hasInitialized()

      assert.strictEqual(actualToken, mockErc20.address)
      assert.isTrue(hasInitialized)
    })

    describe('canPerform(address, address, bytes32, uint256[])', async () => {
      it('can perform action if account has tokens', async () => {
        assert.isTrue(await oracle.canPerform(rootAccount, ANY_ADDR, '0x', []))
      })

      it('can perform action if account has the minimum required amount of tokens', async () => {
        assert.isTrue(await oracle.canPerform(rootAccount, ANY_ADDR, '0x', [100]))
      })


      it("can't perform action if account does not have the minimum required amount of tokens", async () => {
        assert.isFalse(await oracle.canPerform(rootAccount, ANY_ADDR, '0x', [2000]))
      })

      it("can't perform action if account does not have tokens", async () => {
        assert.isFalse(await oracle.canPerform(accounts[0], ANY_ADDR, '0x', []))
      })
    })

   

    describe('changeToken(address _token)', () => {
      beforeEach('set permission', async () => {
        await daoDeployment.acl.createPermission(rootAccount, oracle.address, CHANGE_TOKEN_ROLE, rootAccount)
      })

      it('sets a new token', async () => {
        const newMockErc20 = await MockErc20.new(rootAccount, 100)
        const expectedToken = newMockErc20.address

        await oracle.changeToken(expectedToken)

        const actualToken = await oracle.token()
        assert.equal(actualToken, expectedToken)
      })

      it('reverts when setting a non contract token address', async () => {
        await assertRevert(oracle.changeToken(rootAccount), 'ORACLE_TOKEN_NOT_CONTRACT')
      })
    })
  })

  describe('app not initialized', () => {
    it('reverts on changing token', async () => {
      await assertRevert(oracle.changeToken(mockErc20.address), 'APP_AUTH_FAILED')
    })

    it('reverts on checking can perform', async () => {
      await assertRevert(oracle.canPerform(rootAccount, ANY_ADDR, '0x', []))
    })
  })
})
