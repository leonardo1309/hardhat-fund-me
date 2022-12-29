const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { assert, expect } = require("chai")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
          let fundMe
          let deployer
          let mockV3Aggregator
          let sendValue = ethers.utils.parseEther("1")
          beforeEach(async function () {
              //deploy FundMe contract using hardhat deploy
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", function () {
              it("Sets the aggregator addresses correctly", async function () {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          describe("fund", async function () {
              it("Fails if you dont send enough ETH", async function () {
                  await expect(fundMe.fund()).to.be.reverted
              })
              it("Updates the amount funded data structure", async function () {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("Adds funder to array of getFunder", async function () {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunder(0)
                  assert.equal(funder, deployer)
              })
          })

          describe("withdraw", async function () {
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue })
              })

              it("Withdraw ETH from a single funder", async function () {
                  //Arrange
                  const startingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingFunderBalance =
                      await fundMe.provider.getBalance(deployer)
                  //Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const endingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const endingFunderBalance = await fundMe.provider.getBalance(
                      deployer
                  )
                  //Assert
                  assert.equal(endingContractBalance, 0)
                  assert.equal(
                      startingContractBalance
                          .add(startingFunderBalance)
                          .toString(),
                      endingFunderBalance.add(gasCost).toString()
                  )
              })

              it("Allows us to withdraw with multiple getFunder", async function () {
                  //Arrange
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingFunderBalance =
                      await fundMe.provider.getBalance(deployer)

                  //Act

                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  //Assert

                  const endingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const endingFunderBalance = await fundMe.provider.getBalance(
                      deployer
                  )

                  assert.equal(endingContractBalance, 0)
                  assert.equal(
                      startingContractBalance
                          .add(startingFunderBalance)
                          .toString(),
                      endingFunderBalance.add(gasCost).toString()
                  )

                  //Make sure the getFunder are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted
                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })

              it("Only allows the owner to withdraw funds", async function () {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1]
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )
                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner")
              })

              it("Cheaper withdraw testing", async function () {
                  //Arrange
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingFunderBalance =
                      await fundMe.provider.getBalance(deployer)

                  //Act

                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  //Assert

                  const endingContractBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const endingFunderBalance = await fundMe.provider.getBalance(
                      deployer
                  )

                  assert.equal(endingContractBalance, 0)
                  assert.equal(
                      startingContractBalance
                          .add(startingFunderBalance)
                          .toString(),
                      endingFunderBalance.add(gasCost).toString()
                  )

                  //Make sure the getFunder are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted
                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
          })
      })
