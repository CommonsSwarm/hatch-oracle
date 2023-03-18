const { assertRevert } = require('@1hive/contract-helpers-test/src/asserts')
const Oracle = artifacts.require('HatchOracle')
const MockErc20 = artifacts.require('TokenMock')
const Hatch = artifacts.require('HatchMock')

const { newDao, installNewApp } = require('@1hive/contract-helpers-test/src/aragon-os')

const { hash: nameHash } = require('eth-ens-namehash')
const { bn } = require('@1hive/contract-helpers-test/src/numbers')

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'

contract(
  'HatchOracle',
  ([appManager, accountScore900, accountScore100, accountScore0, nonContractAddress]) => {
    let oracleBase, hatchBase, oracle, hatch, scoreToken, hatchToken
    let SET_SCORE_TOKEN_ROLE, SET_RATIO_ROLE, CONTRIBUTE_ROLE

    const PPM = 1000000
    const RATIO = 100 * PPM
    const SCORE_TOKEN_BALANCE = 1000
    const EXCHANGE_RATE = 10 * PPM

    before('deploy base apps', async () => {
      oracleBase = await Oracle.new()
      hatchBase = await Hatch.new()
      SET_SCORE_TOKEN_ROLE = await oracleBase.SET_SCORE_TOKEN_ROLE()
      SET_RATIO_ROLE = await oracleBase.SET_RATIO_ROLE()
      CONTRIBUTE_ROLE = await hatchBase.CONTRIBUTE_ROLE()
    })

    beforeEach('deploy dao and hatch oracle', async () => {
      ({dao, acl} = await newDao(appManager))

      oracle = await Oracle.at(await installNewApp(
        dao,
        nameHash('hatch-oracle.aragonpm.test'),
        oracleBase.address,
        appManager
      ))

      hatch = await Hatch.at(await installNewApp(
        dao,
        nameHash('hatch.aragonpm.test'),
        hatchBase.address,
        appManager
      ))
      scoreToken = await MockErc20.new(accountScore900, SCORE_TOKEN_BALANCE)
      await scoreToken.transfer(accountScore100, SCORE_TOKEN_BALANCE / 10, { from: accountScore900 })
      hatchToken = await MockErc20.new(hatch.address, 1000000000)
      await hatch.initialize(hatchToken.address, EXCHANGE_RATE)
    })

    describe('initialize(address _score, uint256 _ratio, address _hatch)', () => {
      beforeEach('initialize oracle', async () => {
        await oracle.initialize(scoreToken.address, RATIO, hatch.address)
      })

      it('sets variables as expected', async () => {
        const actualToken = await oracle.score()
        const actualRatio = await oracle.ratio()
        const actualHatch = await oracle.hatch()
        const hasInitialized = await oracle.hasInitialized()

        assert.strictEqual(actualToken, scoreToken.address)
        assert.strictEqual(actualRatio.toString(), RATIO.toString())
        assert.strictEqual(actualHatch, hatch.address)
        assert.isTrue(hasInitialized)
      })

      it('reverts on reinitialization', async () => {
        await assertRevert(
          oracle.initialize(scoreToken.address, RATIO, hatch.address),
          'INIT_ALREADY_INITIALIZED'
        )
      })

      describe('setScoreToken(address _score)', () => {
        beforeEach('set permission', async () => {
          await acl.createPermission(appManager, oracle.address, SET_SCORE_TOKEN_ROLE, appManager)
        })

        it('sets a new score token', async () => {
          const newScore = await MockErc20.new(appManager, 100)
          const expectedScore = newScore.address

          await oracle.setScoreToken(expectedScore)

          const actualScore = await oracle.score()
          assert.equal(actualScore, expectedScore)
        })

        it('reverts when setting a non contract token address', async () => {
          await assertRevert(oracle.setScoreToken(nonContractAddress), 'HATCH_ORACLE_TOKEN_NOT_CONTRACT')
        })
      })

      describe('canPerform(address, address, bytes32, uint256[])', async () => {
        context(`Ratio is ${RATIO/PPM} contribution / membership score`, () => {
          it('can perform action if contribution is below score capacity', async () => {
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 90000]))
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 10000]))
          })

          it("can't perform action if contribution is too high", async () => {
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 90001]))
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 10001]))
          })

          it("can't perform action if score is 0", async () => {
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore0, 1]))
          })

        })

        context(`Ratio is 1 contribution / membership score`, () => {
          beforeEach('set ratio to 1/1', async () => {
            await acl.createPermission(appManager, oracle.address, SET_RATIO_ROLE, appManager)
            await oracle.setRatio(PPM)
          })

          it('can perform action if contribution is below score capacity', async () => {
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 900]))
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 100]))
          })

          it("can't perform action if contribution is too high", async () => {
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 901]))
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 101]))
          })
        })

        context(`Ratio is 1/100 contribution / membership score`, () => {
          beforeEach('set ratio to 1/100', async () => {
            await acl.createPermission(appManager, oracle.address, SET_RATIO_ROLE, appManager)
            await oracle.setRatio(0.01 * PPM)
          })

          it('can perform action if contribution is below score capacity', async () => {
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 9]))
            assert.isTrue(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 1]))
          })

          it("can't perform action if contribution is too high", async () => {
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900, 10]))
            assert.isFalse(await oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore100, 2]))
          })
        })

        it('reverts when not enough params', async () => {
          await assertRevert(
            oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [accountScore900]),
            'HATCH_ORACLE_PARAMS_MISSING'
          )
        })

        it('reverts when sender too big', async () => {
          await assertRevert(
            oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [bn(2).pow(bn(160)), 100]),
            'HATCH_ORACLE_SENDER_TOO_BIG'
          )
        })

        it('reverts when passed address zero', async () => {
          await assertRevert(
            oracle.canPerform(ANY_ADDR, ANY_ADDR, '0x', [0, 1000]),
            'HATCH_ORACLE_SENDER_ZERO'
          )
        })
      })
    })
    describe('app not initialized', () => {
      it('reverts on setting token', async () => {
        await assertRevert(oracle.setScoreToken(scoreToken.address), 'APP_AUTH_FAILED')
      })

      it('reverts on setting ratio', async () => {
        await assertRevert(oracle.setRatio(0), 'APP_AUTH_FAILED')
      })

      it('reverts on checking can perform', async () => {
        await assertRevert(oracle.canPerform(appManager, ANY_ADDR, '0x', [accountScore0, 1]), 'INIT_NOT_INITIALIZED')
      })

      it('reverts on checking allowance', async () => {
        await assertRevert(oracle.allowance(appManager), 'INIT_NOT_INITIALIZED')
      })
    })

    describe('integration tests with hatch', () => {
      let oracleAddressBN, params

      const ORACLE_PARAM_ID = bn(203).shln(248)
      const EQ = bn(1).shln(240)

      beforeEach('initialize oracle', async () => {
        // convert oracle address to BN and get param256: [(uint256(ORACLE_PARAM_ID) << 248) + (uint256(EQ) << 240) + oracleAddress];
        oracleAddressBN = bn(oracle.address.slice(2), 16)
        params = [ORACLE_PARAM_ID.add(EQ).add(oracleAddressBN), 1000]

        await oracle.initialize(scoreToken.address, RATIO, hatch.address)

        await acl.createPermission(
          appManager,
          hatch.address,
          CONTRIBUTE_ROLE,
          appManager
        )
        await acl.grantPermissionP(ANY_ADDR, hatch.address, CONTRIBUTE_ROLE, params)
      })

      context(`Ratio is ${RATIO/PPM} contribution / membership score`, () => {
        it('can perform action if contribution is below score capacity', async () => {
          await hatch.contribute(90000, { from: accountScore900 })
          await hatch.contribute(10000, { from: accountScore100 })
        })

        it("can't perform action if already contributed", async() => {
          await hatch.contribute(90000 / 2, { from: accountScore900 })
          await hatch.contribute(10000 / 2, { from: accountScore100 })
          await hatch.contribute(90000 / 2, { from: accountScore900 })
          await hatch.contribute(10000 / 2, { from: accountScore100 })
          await assertRevert(
            hatch.contribute(1, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await assertRevert(
            hatch.contribute(1, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })

        it("can't perform action if contribution is too high", async () => {
          await assertRevert(
            hatch.contribute(90001, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await assertRevert(
            hatch.contribute(10001, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })

        it("can't perform action if score is 0", async () => {
          await assertRevert(
            hatch.contribute(1, { from: accountScore0 }),
            'APP_AUTH_FAILED'
          )
        })

      })

      context(`Ratio is 1 contribution / membership score`, () => {
        beforeEach('set ratio to  1/1', async () => {
          await acl.createPermission(appManager, oracle.address, SET_RATIO_ROLE, appManager)
          await oracle.setRatio(PPM)
        })

        it('can perform action if contribution is below score capacity', async () => {
          await hatch.contribute(900, { from: accountScore900 })
          await hatch.contribute(100, { from: accountScore100 })
        })

        it("can't perform action if already contributed", async() => {
          await hatch.contribute(900 / 2, { from: accountScore900 })
          await hatch.contribute(100 / 2, { from: accountScore100 })
          await hatch.contribute(900 / 2, { from: accountScore900 })
          await hatch.contribute(100 / 2, { from: accountScore100 })
          await assertRevert(
            hatch.contribute(1, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await assertRevert(
            hatch.contribute(1, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })

        it("can't perform action if contribution is too high", async () => {
          await assertRevert(
            hatch.contribute(901, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await assertRevert(
            hatch.contribute(101, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })
      })

      context(`Ratio is 1/100 contribution / membership score`, () => {
        beforeEach('set ratio to 1/100', async () => {
          await acl.createPermission(appManager, oracle.address, SET_RATIO_ROLE, appManager)
          await oracle.setRatio(0.01 * PPM)
        })

        it('can perform action if contribution is below score capacity', async () => {
          await hatch.contribute(9, { from: accountScore900 })
          await hatch.contribute(1, { from: accountScore100 })
        })

        it("can't perform action if already contributed", async() => {
          await hatch.contribute(5, { from: accountScore900 })
          await hatch.contribute(4, { from: accountScore900 })
          await assertRevert(
            hatch.contribute(1, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await hatch.contribute(1, { from: accountScore100 })
          await assertRevert(
            hatch.contribute(1, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })

        it("can't perform action if contribution is too high", async () => {
          await assertRevert(
            hatch.contribute(10, { from: accountScore900 }),
            'APP_AUTH_FAILED'
          )
          await assertRevert(
            hatch.contribute(2, { from: accountScore100 }),
            'APP_AUTH_FAILED'
          )
        })
      })
    })
  }
)
