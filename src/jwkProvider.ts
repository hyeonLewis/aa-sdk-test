import axios from "axios";

import { OIDCProviders } from "./constants/OIDCProviders";

export const getJWKs = async (oidcProvider: string, idx?: number) => {
    const jwkUrl = OIDCProviders.find((p) => p.name === oidcProvider.toLowerCase())?.jwkUrl;
    if (!jwkUrl) {
        return null;
    }

    let res;
    try {
        res = await axios.get(jwkUrl);
    } catch (e) {
        console.error(e);
        return null;
    }
    return res?.data.keys[idx || 0];
};
