import {
    string2Uints,
    string2UintsSha256Padded,
    string2Qwords,
    uints2String,
    qwords2String,
    uints2Buffer,
} from "./circuit-helpers";

export const ZkauthJwtV02 = {
    maxSaltedSubLen: 341, // 31 * 11
    maxClaimLen: 279, // 31 * 9, minimum 31*x that is larger than 256
    maxPubLen: 279, // 31 * 9, minimum 31*x that is larger than 256
    maxSigLen: 279,

    // @param pub  base64url-encoded RSA-2048 public key
    process_input: function (signedJwt: string, pub: string, salt: string) {
        const numBits = 248;
        const maxLen = 1023; // 31 * 33
        const maxSaltedSubLen = 341; // 31 * 11
        const maxPubLen = 279; // 31 * 9, minimum 31*x that is larger than 256
        const maxSigLen = maxPubLen;

        const [header, payload, signature] = signedJwt.split(".");

        // JWT
        const jwt = header + "." + payload;
        const jwtLen = jwt.length;

        const payOff = header.length + 1; // position in base64-encoded JWT
        const payLen = payload.length;
        const pay = Buffer.from(payload, "base64url").toString();
        const payObject = JSON.parse(Buffer.from(payload, "base64url").toString());
        console.assert(signedJwt.substring(payOff, payOff + payLen) == payload, "payOff");

        // [ string ][ 80 ][ 00..00 ][ len ]
        const jwtUints = string2UintsSha256Padded(jwt, maxLen);
        const jwtBlocks = Math.floor(jwt.length / 64) + 1;

        // Claims
        function claimPos(jwt: string, name: string): number[] {
            const regex = new RegExp(`\\s*("${name}")\\s*:\\s*("?[^",]*"?)\\s*([,\\}])`);

            const match = jwt.match(regex);
            if (!(match && match.index)) {
                throw new Error("Claim not found: " + name);
            }

            const claimValue = match[2];

            const claimValueHasQuotes = match[0].includes(`"${claimValue}"`);

            const claimOffset = match.index;
            const colonIndex = match[0].indexOf(":");
            const claimValueIndex = match[0].indexOf(claimValue, colonIndex + 1) - (claimValueHasQuotes ? 1 : 0);
            const claimValueLength = claimValue.length + (claimValueHasQuotes ? 2 : 0); // Add 2 for the quotes if they exist
            const pos = [claimOffset, match[0].length, colonIndex, claimValueIndex, claimValueLength];

            return pos;
        }

        const issPos = claimPos(pay, "iss");
        const audPos = claimPos(pay, "aud");
        const iatPos = claimPos(pay, "iat");
        const expPos = claimPos(pay, "exp");
        const noncePos = claimPos(pay, "nonce");
        const subPos = claimPos(pay, "sub");

        // SaltedSub
        const sub = '"' + payObject["sub"] + '"';
        const saltedSub = salt + sub;
        const saltedSubUints = string2UintsSha256Padded(saltedSub, maxSaltedSubLen);
        const saltedSubBlocks = Math.floor(saltedSub.length / 64) + 1;

        // Signature
        const sigUints = string2Uints(Buffer.from(signature, "base64url"), maxSigLen);
        const pubUints = string2Uints(Buffer.from(pub, "base64url"), maxPubLen);

        return {
            jwtUints,
            jwtLen,
            jwtBlocks,
            payOff,
            payLen,
            issPos,
            audPos,
            iatPos,
            expPos,
            noncePos,
            subPos,
            saltedSubUints,
            saltedSubBlocks,
            sigUints,
            pubUints,
        };
    },
    process_output: function (pubsig: string[]) {
        const iss = uints2String(pubsig.slice(0, 9));
        const issLen = pubsig[9];
        const aud = uints2String(pubsig.slice(10, 19));
        const audLen = pubsig[19];
        const iat = uints2String(pubsig.slice(20, 29));
        const iatLen = pubsig[29];
        const exp = uints2String(pubsig.slice(30, 39));
        const expLen = pubsig[39];
        const nonce = uints2String(pubsig.slice(40, 49));
        const nonceLen = pubsig[49];
        const hSub =
            BigInt(pubsig[50]).toString(16).padStart(32, "0") + BigInt(pubsig[51]).toString(16).padStart(32, "0");
        const pub = uints2Buffer(pubsig.slice(52, 61)).subarray(0, 256).toString("base64url");

        console.log("iss =", iss, ", issLen =", issLen);
        console.log("aud =", aud, ", audLen =", audLen);
        console.log("iat =", iat, ", iatLen =", iatLen);
        console.log("exp =", exp, ", expLen =", expLen);
        console.log("nonce =", nonce, ", nonceLen =", nonceLen);
        console.log("hSub =", "0x" + hSub);
        console.log("pub =", pub);
    },
};