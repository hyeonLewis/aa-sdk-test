import { Buffer } from "buffer";

import { getStructHash, keccak256 } from "eip-712";
import { Contract, utils } from "ethers";
import { jwtDecode } from "jwt-decode";

import { JwtWithNonce, calcSubHash } from "./jwt";
import { IJwtProvider } from "./jwtProvider";
import { typeDataRecovery } from "./samples";
import { sampleProofA, sampleProofB, sampleProofC } from "./samples/constants";

import { ZkauthJwtV02, string2Uints } from ".";

export interface typeDataArgs {
    verifyingContract: string;
    newOwner: string;
    name: string;
    sca: string;
    chainId: number;
    version?: string;
}

export interface AuthData {
    subHash: string;
    guardian: string;
    proof: string;
}

export class AuthBuilder {
    public sca: string | Contract;
    public guardian;
    public jwtProvider;
    public chainId;
    public newOwner;
    public salt;
    public subHash;

    private _pubSignals: string[] = [];
    private _proof = "";

    constructor(
        sca: string | Contract,
        subHash: string,
        guardian: string | Contract,
        jwtProvider: IJwtProvider,
        newOwner: string,
        salt: string,
        chainId = 31337
    ) {
        this.sca = sca;
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

    getScaAddress() {
        if (typeof this.sca !== "string") {
            return this.sca.address;
        }
        return this.sca;
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

    nonce(override?: { verifyingContract?: string; sca?: string; name?: string; newOwner?: string }) {
        return calcNonce({
            verifyingContract: override?.verifyingContract ?? this.getGuardianAddress(),
            name: override?.name ?? (this.jwtProvider.aud as string),
            sca: override?.sca ?? this.getScaAddress(),
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

    constructor(
        sca: string | Contract,
        subHash: string[],
        guardians: string[] | Contract[],
        jwtProvider: IJwtProvider[],
        newOwner: string,
        salt: string[],
        chainId = 31337
    ) {
        if (guardians.length !== jwtProvider.length) {
            throw new Error("Length mismatch");
        }
        for (let i = 0; i < guardians.length; i++) {
            const builder = new AuthBuilder(sca, subHash[i], guardians[i], jwtProvider[i], newOwner, salt[i], chainId);
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

// @param pubMod base64-encoded string
// @param pubMod base64-encoded string
export const generatePubSig = (
    jwt: string | JwtWithNonce,
    salt: string,
    pubMod: string,
    override?: GeneratePubSigOptions
) => {
    if (typeof jwt === "string") {
        jwt = jwtDecode(jwt, { header: true }) as JwtWithNonce;
    }

    const modBuf = Buffer.from(pubMod, "base64");
    if (modBuf.length !== 256) {
        throw new Error("Modulus must be 256 bytes");
    }

    const jwtPayload = jwt.payload;
    if (typeof override?.subHash === "string") {
        override.subHash = utils.arrayify(override.subHash);
    }
    const subHash = override?.subHash
        ? override.subHash
        : Buffer.from(calcSubHash(jwtPayload.sub, salt).slice(2), "hex");

    const pubSignals: string[] = new Array(61).fill(0);

    const issSignals = generateUints('"' + jwtPayload.iss + '"');
    for (let i = 0; i < 10; i++) {
        pubSignals[i] = issSignals[i];
    }

    const audSignals = generateUints((('"' + jwtPayload.aud) as string) + '"');
    for (let i = 0; i < 10; i++) {
        pubSignals[i + 10] = audSignals[i];
    }

    const iatSignals = generateUints(jwtPayload.iat.toString());
    for (let i = 0; i < 10; i++) {
        pubSignals[i + 20] = iatSignals[i];
    }

    const expSignals = generateUints(jwtPayload.exp.toString());
    for (let i = 0; i < 10; i++) {
        pubSignals[i + 30] = expSignals[i];
    }

    const nonceSignals = generateUints('"' + jwtPayload.nonce + '"');
    for (let i = 0; i < 10; i++) {
        pubSignals[i + 40] = nonceSignals[i];
    }

    pubSignals[50] = utils.hexZeroPad(subHash.slice(0, 16), 32);
    pubSignals[51] = utils.hexZeroPad(subHash.slice(16, 32), 32);

    const modSignals = generateModPubSig(modBuf);
    for (let i = 0; i < 9; i++) {
        pubSignals[52 + i] = modSignals[i];
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
    typedData.message.sca = args.sca;
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

export const generateModPubSig = (modBytes: string | Buffer) => {
    return string2Uints(modBytes, ZkauthJwtV02.maxPubLen);
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

export const generateUints = (s: string) => {
    const signals: string[] = new Array(10).fill(utils.hexZeroPad(utils.toUtf8Bytes(""), 32));
    const numChunks = Math.floor(s.length / 31);

    for (let i = 0; i < numChunks; i++) {
        signals[i] = "0x00" + utils.hexlify(utils.toUtf8Bytes(s.slice(i * 31, (i + 1) * 31))).replace("0x", "");
    }

    const lastChunk = utils.toUtf8Bytes(s.slice(numChunks * 31));
    signals[numChunks] = "0x00" + utils.hexlify(lastChunk).replace("0x", "");
    signals[numChunks] = signals[numChunks].padEnd(66, "0");
    signals[9] = utils.hexZeroPad(utils.hexlify(s.length), 32);
    return signals;
};

export const generateProof = (kid: string, pA: string[], pB: string[][], pC: string[], pubSignals: string[]) => {
    return utils.defaultAbiCoder.encode(
        ["string", "uint[2]", "uint[2][2]", "uint[2]", "uint[61]"],
        [kid, pA, pB, pC, pubSignals]
    );
};
