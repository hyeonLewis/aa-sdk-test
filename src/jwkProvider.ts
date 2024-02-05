import { OIDCProviders } from "./constants/OIDCProviders";

import { apiGet } from ".";

export const getJWKs = async (provider: string, idx?: number) => {
    const jwkUrl = OIDCProviders.find((p) => p.name === provider.toLowerCase())?.jwkUrl;
    if (!jwkUrl) {
        return null;
    }
    const res = await apiGet(jwkUrl);
    return res?.keys[idx || 0];
};
