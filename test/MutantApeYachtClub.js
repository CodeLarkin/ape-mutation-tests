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

    //it("Apes, serums and mutants should deploy successfully", async function () {
    //    // TODO set starting indices (for MAYC at least)

    //    /* bobby mints a bored ape
    //     * bobby gets airdropped or mints a serum
    //     * bobby applies the serum to his ape, burns both
    //     * as a side effect, bobby mints a mutant ape
    //     *
    //     * repeat to confirm works with two apes
    //     * redo but bobby has two apes, serum works on only the correct one
    //     * redo with each serum, confirm you cant use two serums
    //     */


    //});
});
