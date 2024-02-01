export enum Networks {
    BAOBAB = 1001,
    CYPRESS = 8217,
}

interface Addresses {
    entryPointAddr: string;
    oidcRecoveryFactoryV02Addr?: string;
    zkVerifierV02Addr?: string;
    manualJwksProviderAddr?: string;
    googleGuardianV02Addr?: string;
    kakaoGuardianV02Addr?: string;
    appleGuardianV02Addr?: string;
    lineGuardianV02Addr?: string;
    twitchGuardianV02Addr?: string;
    counterAddr?: string;
}

const CYPRESS: Addresses = {
    entryPointAddr: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    oidcRecoveryFactoryV02Addr: undefined,
    zkVerifierV02Addr: undefined,
    manualJwksProviderAddr: undefined,
    googleGuardianV02Addr: undefined,
    kakaoGuardianV02Addr: undefined,
    appleGuardianV02Addr: undefined,
    lineGuardianV02Addr: undefined,
    twitchGuardianV02Addr: undefined,
    counterAddr: undefined,
};

const BAOBAB: Addresses = {
    entryPointAddr: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    oidcRecoveryFactoryV02Addr: "0xd717B50719324eb321E884712a5cDc33d868aF88",
    zkVerifierV02Addr: "0xC7B94E3827FD4D2c638EEae2e9219Da063b5BB55",
    manualJwksProviderAddr: "0xF871E80Ac5F679f9137Db4091841F0657dFD2B04",
    googleGuardianV02Addr: "0x40eA3Fb3B1e7f2FeE7B904a1Be838Ad46c570622",
    kakaoGuardianV02Addr: "0x2b65C2D002Db674fb8ee55Fa27dA0fdB49426bb6",
    appleGuardianV02Addr: undefined,
    lineGuardianV02Addr: undefined,
    twitchGuardianV02Addr: "0x50785d8B763F4D2EC05E6AB91a8e2E8AEF6B471d",
    counterAddr: "0x3F2201Db69c7bD8427FD816ca4d38CC17B448d90",
};

export const Addresses: { [key: number]: Addresses } = {
    [Networks.CYPRESS]: CYPRESS,
    [Networks.BAOBAB]: BAOBAB,
};
