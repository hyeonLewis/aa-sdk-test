import { ethers } from "ethers";

import { Addresses, Networks } from "./constants/Address";

import { OIDCRecoveryAccountV02, OIDCGuardianV02 } from ".";

// Utils for OIDCRecoveryAccountV02 without using RecoveryAccountAPI
export const getThreshold = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    const threshold = await oidcRecoveryAccount.threshold();
    return Number(threshold);
};

export const getIss = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcIss: string[] = [];
    const guardianAddress = await getGuardians(cfAddress, rpcUrl);

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
    const guardians = await oidcRecoveryAccount.getGuardiansInfo();
    const guardianAddress = guardians.map((guardian: any) => guardian[1]);

    return guardianAddress;
};

export const getInitialOwnerAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    const initialOwnerAddress = await oidcRecoveryAccount.initialOwner();

    return initialOwnerAddress;
};

export const getInitialGuardianAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    const initialGuardianAddress = await oidcRecoveryAccount.initialGuardian();

    return initialGuardianAddress;
};

export const getOwnerAddress = async (cfAddress: string, rpcUrl: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const oidcRecoveryAccount = new ethers.Contract(cfAddress, OIDCRecoveryAccountV02, provider);
    const ownerAddress = await oidcRecoveryAccount.owner();

    return ownerAddress;
};

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
