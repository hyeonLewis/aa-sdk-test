import axios from "axios";
import { ethers } from "ethers";

import { Addresses, Networks } from "./constants/Address";

import { OIDCRecoveryAccountV02, OIDCGuardianV02 } from ".";

// Utils for OIDCRecoveryAccountV02 without using RecoveryAccountAPI
export const getThreshold = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    try {
        const threshold = await oidcRecoveryAccount.threshold();
        return Number(threshold);
    } catch (err) {
        console.error(err);
        return 0;
    }
};

export const getIss = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcIss: string[] = [];
    let guardianAddress;
    try {
        guardianAddress = await getGuardians(cfAddress, rpcUrl);
    } catch (err) {
        console.error(err);
        return [];
    }

    for (const address of guardianAddress) {
        const guardian = new ethers.Contract(address, OIDCGuardianV02, provider);
        const iss = await guardian.iss();
        oidcIss.push(iss);
    }
    return oidcIss;
};

export const getGuardians = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    try {
        const guardians = await oidcRecoveryAccount.getGuardiansInfo();
        const guardianAddress = guardians.map((guardian: any) => guardian[1]);
        return guardianAddress;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const getInitialOwnerAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    try {
        return await oidcRecoveryAccount.initialOwner();
    } catch (err) {
        console.error(err);
        return "";
    }
};

export const getInitialGuardianAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    try {
        return await oidcRecoveryAccount.initialGuardian();
    } catch (err) {
        console.error(err);
        return "";
    }
};

export const getOwnerAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    try {
        return await oidcRecoveryAccount.owner();
    } catch (err) {
        console.error(err);
        return "";
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const getProviderNameFromIss = (iss: string) => {
    if (iss === "https://accounts.google.com") {
        return "google";
    } else if (iss === "https://kauth.kakao.com") {
        return "kakao";
    } else if (iss === "https://appleid.apple.com") {
        return "apple";
    } else if (iss === "https://access.line.me") {
        return "line";
    } else if (iss === "https://id.twitch.tv/oauth2") {
        return "twitch";
    } else {
        return "";
    }
};

export const getIssFromProviderName = (provider: string) => {
    if (provider === "google") {
        return "https://accounts.google.com";
    } else if (provider === "kakao") {
        return "https://kauth.kakao.com";
    } else if (provider === "apple") {
        return "https://appleid.apple.com";
    } else if (provider === "line") {
        return "https://access.line.me";
    } else if (provider === "twitch") {
        return "https://id.twitch.tv/oauth2";
    } else {
        return "";
    }
};

export const getGuardianFromIssOrName = (issOrName: string, chainId: Networks) => {
    if (issOrName === "https://accounts.google.com" || issOrName === "google") {
        return Addresses[chainId].googleGuardianV02Addr;
    } else if (issOrName === "https://kauth.kakao.com" || issOrName === "kakao") {
        return Addresses[chainId].kakaoGuardianV02Addr;
    } else if (issOrName === "https://appleid.apple.com" || issOrName === "apple") {
        return Addresses[chainId].appleGuardianV02Addr;
    } else if (issOrName === "https://access.line.me" || issOrName === "line") {
        return Addresses[chainId].lineGuardianV02Addr;
    } else if (issOrName === "https://id.twitch.tv/oauth2" || issOrName === "twitch") {
        return Addresses[chainId].twitchGuardianV02Addr;
    } else {
        return "";
    }
};
