const { expect } = require("chai");

const { ethers, waffle } = hre;
const { BigNumber, utils } = ethers;
const { constants, expectRevert } = require('@openzeppelin/test-helpers')

describe("Test harness for MutantApeYachtClub", function () {

    before(async function () {
        this.Bayc = await ethers.getContractFactory("BoredApeYachtClub")
        this.Bacc = await ethers.getContractFactory("BoredApeChemistryClub")
        this.Mayc = await ethers.getContractFactory("MutantApeYachtClub")
    });

    beforeEach(async function () {
        // Create some wallets with non-zero balance
        [this.alice, this.bobby, this.carly, this.dobby, this.erkle] = await ethers.getSigners()
        this.wallets = [this.alice, this.bobby, this.carly, this.dobby, this.erkle];

        // Create two wallets with 0 balance
        this.provider = ethers.provider;
        this.owner0 = ethers.Wallet.createRandom()
        this.owner0.connect(this.provider)
        this.owner1 = ethers.Wallet.createRandom()
        this.owner1.connect(this.provider)

        this.bayc = await this.Bayc.deploy("BaycTest", "BAYCT", 10000, 1)
        await this.bayc.deployed()

        this.baycBaseURI = "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/"
        await this.bayc.setBaseURI(this.baycBaseURI)

        // Deploy BoredApeChemistryClub and set base URI
        this.baccBaseURI = "ipfs://QmdtARLUPQeqXrVcNzQuRqr9UCFoFvn76X9cdTczt4vqfw/"
        this.bacc = await this.Bacc.deploy(this.baccBaseURI)
        await this.bacc.deployed()

        // Deploy MutantApeYachtClub and set base URI
        this.Mayc = await ethers.getContractFactory("MutantApeYachtClub", this.alice)
        this.mayc = await this.Mayc.deploy("MaycTest", "MAYCT", this.bayc.address, this.bacc.address)
        await this.mayc.deployed()

        this.maycBaseURI = "https://boredapeyachtclub.com/api/mutants/"
        await this.mayc.setBaseURI(this.maycBaseURI)

        // Point the ChemistryClub to the MutantApe contract
        this.bacc.connect(this.alice).setMutationContractAddress(this.mayc.address)
    });

    it("Bayc and Bacc URIs are set correctly", async function () {
        expect(await this.bayc.baseURI()).to.equal(this.baycBaseURI)
        expect(await this.bacc.uri(0)).to.equal(this.baccBaseURI + "0")
        expect(await this.bacc.uri(1)).to.equal(this.baccBaseURI + "1")
        expect(await this.bacc.uri(69)).to.equal(this.baccBaseURI + "69")
    });

    it("Mayc URI is set correctly", async function () {
        await this.bayc.connect(this.alice).flipSaleState()
        await this.mayc.connect(this.alice).startPublicSale(1000, 100000000)
        await this.mayc.connect(this.bobby).mintMutants(1, { value: ethers.utils.parseEther("1.0") })
        // baseURI is private, but can get the URI for token 0
        expect(await this.mayc.tokenURI(0)).to.equal(this.maycBaseURI + "0")
    });

    it("Some invalid mint/mutate checks", async function () {
        await expectRevert(this.bayc.connect(this.bobby).mintApe(1), "Sale must be active to mint Ape")
        await expectRevert(this.mayc.connect(this.bobby).mintMutants(1), "Public sale is not active")

        expect(await this.bayc.saleIsActive()).to.equal(false)
        await this.bayc.connect(this.alice).flipSaleState()
        expect(await this.bayc.saleIsActive()).to.equal(true)

        await expectRevert(this.bayc.connect(this.bobby).mintApe(21), "Can only mint 20 tokens at a time")
    });

    it("Can mint one BoredApe", async function () {
        await this.bayc.connect(this.alice).flipSaleState()
        await this.bayc.connect(this.bobby).mintApe(1, { value: ethers.utils.parseEther("1.0") })
    });

    it("Can mint one MutantApe", async function () {
        // TODO how to handle price conversion???
        await this.mayc.connect(this.alice).startPublicSale(1000, 100000000)
        expect(await this.mayc.isMinted(0)).to.equal(false)
        await this.mayc.connect(this.bobby).mintMutants(1, { value: ethers.utils.parseEther("1.0") })
        expect(await this.mayc.isMinted(0)).to.equal(true)
    });

    it("Can't mutate until Serum mutation is active", async function () {
        await expectRevert(
            this.mayc.connect(this.bobby).mutateApeWithSerum(0, 0),
            "Serum Mutation is not active"
        )
    });

    it("Can't mutate without a BoredApe", async function () {
        await this.bacc.connect(this.alice).mintBatch([0], [1])
        await this.mayc.connect(this.alice).toggleSerumMutationActive()
        await expectRevert(
            this.mayc.connect(this.bobby).mutateApeWithSerum(0, 0),
            "ERC721: owner query for nonexistent token"
        )
        await this.bayc.connect(this.alice).flipSaleState()
        await this.bayc.connect(this.alice).mintApe(1, { value: ethers.utils.parseEther("1.0") })
        // alice has the BoredApe, bobby tries to mutate it
        await expectRevert(
            this.mayc.connect(this.bobby).mutateApeWithSerum(0, 0),
            "Must own the ape you're attempting to mutate"
        )
    });

    it("Can't mutate without a Serum", async function () {
        await this.bayc.connect(this.alice).flipSaleState()
        await this.bayc.connect(this.bobby).mintApe(1, { value: ethers.utils.parseEther("1.0") })
        await this.mayc.connect(this.alice).toggleSerumMutationActive()
        await expectRevert(
            this.mayc.connect(this.bobby).mutateApeWithSerum(0, 0),
            "Must own at least one of this serum type to mutate"
        )
    });

    it("Can mutate a BoredApe with a Serum", async function () {

        await this.bayc.connect(this.alice).flipSaleState()
        await this.bayc.connect(this.bobby).mintApe(1, { value: ethers.utils.parseEther("1.0") })

        await this.bacc.connect(this.alice).mintBatch([0], [1]) // mints to Bacc owner (alice)
        // transfer the serum to Bobby so he can mutate his ape
        //     this would be where the owner airdrops serums to all BoredApe holders
        await this.bacc.connect(this.alice).safeBatchTransferFrom(this.alice.address, this.bobby.address, [0], [1], 0)

        let balance = await this.bacc.connect(this.bobby).balanceOf(this.bobby.address, 0)
        expect(balance).to.equal(1)
        await this.mayc.connect(this.alice).toggleSerumMutationActive()

        expect(await this.mayc.isMinted(0)).to.equal(false)
        await this.mayc.connect(this.bobby).mutateApeWithSerum(0, 0)
        let mutantId = await this.mayc.connect(this.bobby).getMutantIdForApeAndSerumCombination(0, 0)
        expect(await this.mayc.isMinted(mutantId)).to.equal(true)
    });

});
