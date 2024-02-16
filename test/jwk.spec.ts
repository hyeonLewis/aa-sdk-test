import { assert } from "chai";
import { describe, it } from "mocha";

import { getJWKs } from "../src";

describe("jwk", () => {
    it("getJWKs", async () => {
        const jwks = await getJWKs("google");
        assert.isNotNull(jwks);
        assert.equal(jwks.use, "sig");
        assert.equal(jwks.e, "AQAB");
        assert.equal(jwks.alg, "RS256");
    });
});
