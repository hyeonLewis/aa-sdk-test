import axios from "axios";

import { OIDCProviders } from "./constants/OIDCProviders";

const promiseMap: { [key: string]: Promise<any> } = {};

export async function apiGet(path: string, queryParams?: object) {
    const key = JSON.stringify({ path, queryParams });
    promiseMap[key] = promiseMap[key] || axios.get(path, { params: queryParams });
    try {
        return (await promiseMap[key])?.data;
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        delete promiseMap[key];
    }
}

export const getJWKs = async (provider: string, idx?: number) => {
    const jwkUrl = OIDCProviders.find((p) => p.name === provider.toLowerCase())?.jwkUrl;
    if (!jwkUrl) {
        return null;
    }
    const res = await apiGet(jwkUrl);
    return res?.keys[idx || 0];
};
