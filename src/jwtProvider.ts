import { JsonWebKey } from "crypto";

import { JwtWithNonce } from ".";

export interface RsaJsonWebKey extends JsonWebKey {
    kid: string;
    n: string;
    e: string;
}

export interface IJwtProvider {
    readonly confUrl: string;
    readonly jwksUrl: string;
    readonly aud: string;
    readonly iss: string;
    readonly jwk: RsaJsonWebKey;
    readonly jwtWithNonce: JwtWithNonce;
}

export class JwtProvider implements IJwtProvider {
    readonly confUrl: string;
    readonly jwksUrl: string;
    readonly jwk: RsaJsonWebKey;

    readonly jwt: JwtWithNonce;

    constructor(confUrl: string, jwksUrl: string, jwt: JwtWithNonce, jwk: RsaJsonWebKey) {
        this.confUrl = confUrl;
        this.jwksUrl = jwksUrl;

        this.jwt = structuredClone(jwt);

        this.jwk = jwk;
    }

    get aud() {
        return this.jwt.payload.aud as string;
    }

    get iss() {
        return this.jwt.payload.iss as string;
    }

    get jwtWithNonce() {
        return this.jwt;
    }
}
