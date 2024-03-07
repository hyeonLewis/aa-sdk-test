import { Buffer } from "buffer";

import base64url from "base64url";

import * as helper from "./circuit-helpers";

export const ZkauthJwtV02 = {
    maxSaltedSubLen: 341, // 31 * 11
    maxClaimLen: 279, // 31 * 9, minimum 31*x that is larger than 256
    maxPubLen: 279, // 31 * 9, minimum 31*x that is larger than 256
    maxSigLen: 279,

    // @param pub  base64url-encoded RSA-2048 public key
    process_input: function (signedJwt: string, pub: string, salt: string) {
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
        // toString('ascii') may result in some unicode characters to be misinterpreted
        const pay = base64url.toBuffer(payload).toString("ascii");
        const payObject = JSON.parse(base64url.decode(payload));
        console.assert(signedJwt.substring(payOff, payOff + payLen) == payload, "payOff");

        const jwtUints = helper.toUints(helper.sha256Pad(jwt), maxLen);
        const jwtBlocks = helper.sha256BlockLen(jwt);

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
        // salt is hex string and sub is ASCII string
        const saltedSub = Buffer.concat([Buffer.from(salt, "hex"), Buffer.from(sub, "ascii")]);
        const saltedSubUints = helper.toUints(helper.sha256Pad(saltedSub), maxSaltedSubLen);
        const saltedSubBlocks = helper.sha256BlockLen(saltedSub);

        // Signature
        const sigUints = helper.toUints(helper.fromBase64(signature), maxSigLen);
        const pubUints = helper.toUints(helper.fromBase64(pub), maxPubLen);

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
        const iss = helper.toASCII(helper.fromUints(pubsig.slice(0, 9)));
        const issLen = pubsig[9];
        const aud = helper.toASCII(helper.fromUints(pubsig.slice(10, 19)));
        const audLen = pubsig[19];
        const iat = helper.toASCII(helper.fromUints(pubsig.slice(20, 29)));
        const iatLen = pubsig[29];
        const exp = helper.toASCII(helper.fromUints(pubsig.slice(30, 39)));
        const expLen = pubsig[39];
        const nonce = helper.toASCII(helper.fromUints(pubsig.slice(40, 49)));
        const nonceLen = pubsig[49];
        const hSub = "0x" + helper.toHex(helper.fromUints(pubsig.slice(50, 52)).subarray(0, 32));
        const pub = helper.toBase64(helper.fromUints(pubsig.slice(52, 61)).subarray(0, 256));

        console.log("iss =", iss, ", issLen =", issLen);
        console.log("aud =", aud, ", audLen =", audLen);
        console.log("iat =", iat, ", iatLen =", iatLen);
        console.log("exp =", exp, ", expLen =", expLen);
        console.log("nonce =", nonce, ", nonceLen =", nonceLen);
        console.log("hSub =", hSub);
        console.log("pub =", pub);
    },
};

function main() {
    const jwt =
        "eyJraWQiOiI5ZjI1MmRhZGQ1ZjIzM2Y5M2QyZmE1MjhkMTJmZWEiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIwYWU2ZDBhNDM5ZTBlYWJhMjM5MWRlYWI0MGM0Y2ZkMCIsInN1YiI6IjMxOTgzNzQ3MjgiLCJhdXRoX3RpbWUiOjE3MDk0MzA2MTUsImlzcyI6Imh0dHBzOi8va2F1dGgua2FrYW8uY29tIiwibmlja25hbWUiOiLquYDtmITsmrAiLCJleHAiOjE3MDk0NTIyMTUsImlhdCI6MTcwOTQzMDYxNSwibm9uY2UiOiIweGRhMWRjNjRlOTEyZmRlZWE1Yzk1YTA0MGZlMWIxZmQ4NGMxMGE5NWY1ZWIyNjMyOGJlMzY0ZjYwYjE4MDI0MTg2Nzc5NzI2MjZmMDkwNjkyZGRjMjk0NGQwMGIwNTBhMzQ3MGQ0ZGY1MGY3MjcyOWVjYjBmYzk3OTBkMTZlYzA3In0.OX597Eo3ivTvdksx2-3PyPm9H4byGM0KLVbrbgZhMZdH1u4JdTzBMjnIvmkjCQzohraN9sDqKSfi3aFgk8EBy-TmWZ0KV4drS9tbZ2G0XAq_dZUhhSOOyoDBoveQPXSeFb6Rhnwu8wD7XfFWKSxVg0BzIXLc7Q9sFeycdIfdpJ0uyk3fwZfUiLEXvDFAiU-uKOKPfhGJjqW_XTiAccXq_KifkeyfSacK2XcEq7PXmH_l2i5mSIerSNMwpwIZwO2T7iFtdH9UW21nqrJFzlbKv3zWVDMMsfWDXb-AWTVHESSeRG5m2K5iVqMH_p0jLzJSLeVvbxUUMDml3TEPYXW5vQ";
    const pub =
        "qGWf6RVzV2pM8YqJ6by5exoixIlTvdXDfYj2v7E6xkoYmesAjp_1IYL7rzhpUYqIkWX0P4wOwAsg-Ud8PcMHggfwUNPOcqgSk1hAIHr63zSlG8xatQb17q9LrWny2HWkUVEU30PxxHsLcuzmfhbRx8kOrNfJEirIuqSyWF_OBHeEgBgYjydd_c8vPo7IiH-pijZn4ZouPsEg7wtdIX3-0ZcXXDbFkaDaqClfqmVCLNBhg3DKYDQOoyWXrpFKUXUFuk2FTCqWaQJ0GniO4p_ppkYIf4zhlwUYfXZEhm8cBo6H2EgukntDbTgnoha8kNunTPekxWTDhE5wGAt6YpT4Yw";
    const salt = "306e876778a7080e88d172aa5e669d60cf932df2785b093dfdc7621f4179c059";
    const result = ZkauthJwtV02.process_input(jwt, pub, salt);
    console.log(result);
}

main();
