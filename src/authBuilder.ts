import { Buffer } from "buffer";

import { getStructHash, keccak256 } from "eip-712";
import { Contract, utils } from "ethers";

import { JwtWithNonce, calcSubHash, maskJWT, whiteList } from "./jwt";
import { IJwtProvider } from "./jwtProvider";
import { typeDataRecovery } from "./samples";
import { sampleProofA, sampleProofB, sampleProofC } from "./samples/constants";

export interface typeDataArgs {
    verifyingContract: string;
    newOwner: string;
    name: string;
    chainId: number;
    version?: string;
}

export interface AuthData {
    subHash: string;
    guardian: string;
    proof: string;
}

export class AuthBuilder {
    public guardian;
    public jwtProvider;
    public chainId;
    public newOwner;
    public salt;
    public subHash;

    private _pubSignals: string[] = [];
    private _proof = "";

    constructor(subHash: string, guardian: string | Contract, jwtProvider: IJwtProvider, newOwner: string, salt: string, chainId = 31337) {
        this.subHash = subHash;
        this.guardian = guardian;
        this.jwtProvider = jwtProvider;
        this.newOwner = newOwner;
        this.salt = salt;
        this.chainId = chainId;
    }

    build() {
        this.buildPubSig();
        this.buildProof();
        return this.buildAuthData();
    }

    getGuardianAddress() {
        if (typeof this.guardian !== "string") {
            return this.guardian.address;
        }
        return this.guardian;
    }

    buildPubSig(override?: GeneratePubSigOptions) {
        this._pubSignals = generatePubSig(this.jwtProvider.jwtWithNonce, this.salt, this.jwtProvider.jwk.n, override);
    }

    // pA, pB, pC are filled with dummy values by default
    // in production, they must be generated by the circuit
    buildProof(override?: { kid?: string; pA?: string[]; pB?: string[][]; pC?: string[]; pubSignals?: string[] }) {
        const pubSignals = override?.pubSignals ?? this._pubSignals;
        if (pubSignals.length == 0) {
            throw new Error("PubSig must have been built before building Proof");
        }

        const kid = override?.kid ?? this.jwtProvider.jwk.kid;
        const pA = override?.pA ?? sampleProofA;
        const pB = override?.pB ?? sampleProofB;
        const pC = override?.pC ?? sampleProofC;

        this._proof = generateProof(kid, pA, pB, pC, pubSignals);
    }

    buildAuthData(): AuthData {
        return { subHash: this.subHash, guardian: this.getGuardianAddress(), proof: this._proof };
    }

    nonce(override?: { verifyingContract?: string; name?: string; newOwner?: string }) {
        return calcNonce({
            verifyingContract: override?.verifyingContract ?? this.getGuardianAddress(),
            name: override?.name ?? (this.jwtProvider.aud as string),
            newOwner: override?.newOwner ?? this.newOwner,
            chainId: this.chainId,
        });
    }

    get jwt() {
        return this.jwtProvider.jwtWithNonce;
    }

    get pubSignals() {
        return this._pubSignals;
    }

    get proof() {
        return this._proof;
    }
}

export class MultiAuthBuilder {
    public builders: AuthBuilder[] = [];

    constructor(subHash: string[], guardians: string[] | Contract[], jwtProvider: IJwtProvider[], newOwner: string, salt: string[], chainId = 31337) {
        if (guardians.length !== jwtProvider.length) {
            throw new Error("Length mismatch");
        }
        for (let i = 0; i < guardians.length; i++) {
            const builder = new AuthBuilder(subHash[i], guardians[i], jwtProvider[i], newOwner, salt[i], chainId);
            this.builders.push(builder);
        }
    }

    build() {
        const auths: AuthData[] = [];
        for (const builder of this.builders) {
            auths.push(builder.build());
        }
        return auths;
    }
}

export type GeneratePubSigOptions = {
    subHash?: string | Uint8Array;
    subLen?: number;
    subOffset?: number;
};

/**
 * @param pubMod      base64-encoded RSA modulus (JwonWebKey.n)
 * @param override For test purpose only. If `subHash` is given, `salt` is ignored.
 */
export const generatePubSig = (jwt: JwtWithNonce, salt: string, pubMod: string, override?: GeneratePubSigOptions) => {
    const mod = utils.hexlify(Buffer.from(pubMod, "base64"));
    if (mod.length !== 514) {
        throw new Error("Modulus must be 256 bytes");
    }

    const jwtPayload = jwt.payload;

    if (typeof override?.subHash === "string") {
        override.subHash = utils.arrayify(override.subHash);
    }

    const subHash = override?.subHash ? override.subHash : Buffer.from(calcSubHash(jwtPayload.sub, salt).slice(2), "hex");
    const maskedJwt = maskJWT(jwt, whiteList);
    const stringifiedMaskedJwt = JSON.stringify(maskedJwt);

    const subLength = override?.subLen ?? jwtPayload.sub.length;
    const subOffset = override?.subOffset ?? stringifiedMaskedJwt.indexOf("sub");

    const pubSignals: string[] = new Array(70).fill(0);

    pubSignals[0] = utils.hexZeroPad(subHash.slice(0, 16), 32);
    pubSignals[1] = utils.hexZeroPad(subHash.slice(16, 32), 32);

    pubSignals[2] = utils.hexZeroPad(utils.hexlify(subOffset + 6), 32);
    pubSignals[3] = utils.hexZeroPad(utils.hexlify(subLength), 32);

    const modSignals = generateModPubSig(BigInt(mod));
    for (let i = 4; i < 36; i++) {
        pubSignals[i] = modSignals[i - 4];
    }

    const jwtSignals = generateJwtPubSig(stringifiedMaskedJwt);
    for (let i = 36; i < 70; i++) {
        pubSignals[i] = jwtSignals[i - 36];
    }

    return pubSignals;
};

const fillInTypeData = (args: typeDataArgs) => {
    const typedData = typeDataRecovery;

    if (args.verifyingContract.length !== 42 || args.newOwner.length !== 42) {
        throw new Error("Invalid address");
    }
    typedData.domain.verifyingContract = args.verifyingContract;
    typedData.domain.name = args.name;
    typedData.message.newOwner = args.newOwner;

    typedData.domain.chainId = args.chainId;
    if (args.version) {
        typedData.domain.version = args.version;
    }
    return typedData;
};

export const calcNonce = (args: typeDataArgs) => {
    const typedData = fillInTypeData(args);

    const domainHash = getStructHash(typedData, "EIP712Domain", typedData.domain);
    const message = getStructHash(typedData, typedData.primaryType, typedData.message);

    const nonce = utils.concat([Buffer.from("1901", "hex"), domainHash, message]);
    const nonceA = keccak256(nonce);

    const nonceB = keccak256(Math.random().toString());

    return utils.hexlify(utils.concat([nonceA, nonceB]));
};

export function calcGuardianId(subHash: string, guardian: string) {
    return utils.keccak256(utils.defaultAbiCoder.encode(["bytes32", "address"], [subHash, guardian]));
}

export const generateModPubSig = (mod: bigint | Buffer | Uint8Array) => {
    const signals: string[] = new Array(32).fill(utils.hexZeroPad(utils.toUtf8Bytes(""), 32));
    if (typeof mod !== "bigint") {
        mod = BigInt("0x" + mod.toString("hex"));
    }
    for (let i = 0; i < signals.length; i++) {
        signals[i] = utils.hexZeroPad(utils.hexlify(mod & (2n ** 64n - 1n)), 32);
        mod = mod >> 64n;
    }
    return signals;
};

export const generateJwtPubSig = (jwt: string) => {
    const signals: string[] = new Array(34).fill(utils.hexZeroPad(utils.toUtf8Bytes(""), 32));
    const numChunks = Math.floor(jwt.length / 31);

    for (let i = 0; i < numChunks; i++) {
        signals[i] = "0x00" + utils.hexlify(utils.toUtf8Bytes(jwt.slice(i * 31, (i + 1) * 31))).replace("0x", "");
    }

    const lastChunk = utils.toUtf8Bytes(jwt.slice(numChunks * 31));
    signals[numChunks] = "0x00" + utils.hexlify(lastChunk).replace("0x", "");
    signals[numChunks] = signals[numChunks].padEnd(66, "0");
    return signals;
};

export const generateProof = (kid: string, pA: string[], pB: string[][], pC: string[], pubSignals: string[]) => {
    return utils.defaultAbiCoder.encode(["string", "uint[2]", "uint[2][2]", "uint[2]", "uint[70]"], [kid, pA, pB, pC, pubSignals]);
};
