import { Addresses, Networks } from "./constants/Address";

export const providerNameToIss: { [key: string]: string } = {
    google: "https://accounts.google.com",
    kakao: "https://kauth.kakao.com",
    apple: "https://appleid.apple.com",
    line: "https://access.line.me",
    twitch: "https://id.twitch.tv/oauth2",
};

export const issToProviderName: { [key: string]: string } = {};
for (const [key, value] of Object.entries(providerNameToIss)) {
    issToProviderName[value] = key;
}

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
