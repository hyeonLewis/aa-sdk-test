# Account Abstraction SDK for zkAuth

## 1. Introduction

This is a SDK for zkAuth. It allows applications to interact with zkAuth smart contracts, which can create & manage AA wallet based on zkAuth protocol.

## 2. Installation

TBA

## 3. Usage

Some input/output values need to be stored in the DB or on the user side (localStorage, Clould backup). The storage format doesn't matter, as long as it's structured in a way that makes it easy to retrieve user data.

### Create a new AA wallet

1. Create and Save Wallet

    - Input
        - `ownerKey`: Generated private key of the initial owner
        - `sub`: JWT token's `sub` field after OAuth2 login
        - `initialGuardian`: Initial guardian address based on the OAuth2 provider
        - `chainId`: Chain ID
    - Output
        - `cfAddress`: Calculated AA wallet address
        - `salt`: Salt to generate subHash. The saltSeed is `sub`
    - Save
        - `ownerKey`: Save to user side (can't be saved to DB since it's non-custodial wallet)
        - `cfAddress`: Save to DB or user side
        - `salt` or `saltSeed`: Save to DB or user side
        - `sub`: Optionally save to DB or user side to reuse it in the future without re-login (e.g. to remove guardian)

    ```js
    const signer = new ethers.Wallet(ownerKey, JsonRpcProvider);
    const salt = await calcSalt(sub);
    const subHash = calcSubHash(sub, salt);

    const params: InitCodeParams & BaseApiParams = {
        initialGuardianAddress: initualGuardian,
        initialOwnerAddress: signer.address,
        chainIdOrZero: 0,
        subHash: subHash,
        provider: JsonRpcProvider,
        entryPointAddress: Addresses[chainId].entryPointAddr,
    };

    const scw = new RecoveryAccountAPI(signer, params, Addresses[chainId].oidcRecoveryFactoryV02Addr);
    const cfAddress = await scw.getAccountAddress();
    // Save wallet as your own
    ```

    Note: This stage makes `ghost` wallet, which means it's not been acutally deployed on the chain. It will be deployed with `initCode` when user sends a first userOp with the wallet.

### Add a new Guardian

1. Prepare a JWT token from the target OIDC provider for the new Guardian (Note: Nonce isn't important)

2. Add the new Guardian

    - Input
        - `newSub`: JWT token's `sub` field taken from the previous step
        - `newSalt`: Salt to generate subHash. The saltSeed is `newSub`
        - `newGuardian`: New guardian address based on the provider
        - `newThreshold`: New threshold after adding the guardian
    - Save
        - `newSalt` or `newSaltSeed`: Save to DB or user side
        - `newSub`: Optionally save to DB or user side to reuse it in the future without re-login (e.g. to remove guardian)

    ```js
    const newSalt = await calcSalt(newSub);
    const newSubHash = ethers.utils.keccak256(Buffer.from(newSalt + newSub));
    const signer = new ethers.Wallet(ownerKey, JsonRpcProvider);
    const param: RecoveryAccountApiParams = {
        scaAddr: cfAddress,
        provider: JsonRpcProvider,
        entryPointAddress: Addresses[chainId].entryPointAddr,
    };
    const scw = new RecoveryAccountAPI(signer, param, Addresses[chainId].oidcRecoveryFactoryV02Addr);
    const data = scw.encodeAddGuardian(newGuardian, newSubHash, newThreshold);
    const tx: TransactionDetailsForUserOp = {
        target: cfAddress,
        data: data,
        value: 0,
    };
    const uorc = await createAndSendUserOp(scw, bundlerUrl, chainId, tx);
    ...
    ```

    Note: It's possible to add a new guardian even if the wallet is `ghost` wallet.

### Remove a Guardian

1. Prepare `sub` and `guardian` to remove

    - If `sub` isn't stored in DB or user side, you need to get user's JWT token.

2. Remove the Guardian

    - Input
        - `targetSub`: JWT token's `sub` field taken from the previous step
        - `targetGuardian`: Guardian address to remove
        - `newThreshold`: New threshold after removing the guardian
    - Delete
        - Delete saved guardian's `sub` and `salt/saltSeed` from DB or user side

    ```js
    const newSalt = await calcSalt(targetSub);
    const newSubHash = ethers.utils.keccak256(Buffer.from(newSalt + targetSub));
    const signer = new ethers.Wallet(ownerKey, JsonRpcProvider);
    const param: RecoveryAccountApiParams = {
        scaAddr: cfAddress,
        provider: JsonRpcProvider,
        entryPointAddress: Addresses[chainId].entryPointAddr,
    };
    const scw = new RecoveryAccountAPI(signer, param, Addresses[chainId].oidcRecoveryFactoryV02Addr);
    const data = scw.encodeRemoveGuardian(targetGuardian, newSubHash, newThreshold);
    const tx: TransactionDetailsForUserOp = {
        target: cfAddress,
        data: data,
        value: 0,
    };
    const uorc = await createAndSendUserOp(scw, bundlerUrl, chainId, tx);
    ...
    ```

### Recover an AA wallet

If user wallet is `ghost` wallet, strongly recommend prevent user to enter the recovery process.

1. Prepare user's recovery JWT tokens above a `threshold` based on registered guardians

    - Input
        - `newOwnerAddress`: New owner's address
        - `guardians`: Guardian addresses
        - `cfAddress`: AA wallet address
        - `chainId`: Chain ID

    ```js
    const args: typeDataArgs = {
        verifyingContract: guardian,
        sca: cfAddress,
        newOwner: newOwnerAddress,
        name: aud,
        chainId: chainId,
    };
    const nonce = calcNonce(args);
    // get JWT token from server with nonce
    ```

2. Recover it

    - Input
        - `recoverTokens`: JWT tokens of registered guardians taken from the previous step
        - `newOwnerKey`: New owner's private key (private key of `newOwnerAddress`)
    - Save
        - `newOwnerKey`: Save to user side (can't be saved to DB since it's non-custodial wallet)
    - Delete
        - Delete previous owner's private key from user side

    ```js
    const iss: string[] = [];
    const sub: string[] = [];
    const salts: string[] = [];
    const confUrls: string[] = [];
    const jwkUrls: string[] = [];
    const jwks: RsaJsonWebKey[] = [];

    // recoverTokens are JWT tokens of registered guardians
    for (const recoverToken of recoverTokens) {
      const { iss: issTemp, sub: subTemp } = JSON.parse(recoverToken);
      iss.push(issTemp);
      sub.push(subTemp);
      salts.push(await calcSalt(subTemp));
      const provider = getProviderNameFromIss(issTemp);
      confUrls.push(OIDCProviders.find(p => p.name === provider.toLowerCase())?.confUrl as string);
      jwkUrls.push(OIDCProviders.find(p => p.name === provider.toLowerCase())?.jwkUrl as string);
      jwks.push((await getJWKs(provider)) as RsaJsonWebKey);
    }

    const signer = new ethers.Wallet(newOwnerKey, JsonRpcProvider);
    const params: RecoveryAccountApiParams = {
      scaAddr: cfAddress,
      provider: JsonRpcProvider,
      entryPointAddress: Addresses[chainId].entryPointAddr,
    };
    const scw = new RecoveryAccountAPI(signer, params, Addresses[chainId].oidcRecoveryFactoryV02Addr);

    for (const [idx, recoverToken] of recoverTokens.entries()) {
      const authBuilder = new AuthBuilder(
        cfAddress,
        calcSubHash(sub[idx], salts[idx]),
        guardians[idx],
        new JwtProvider(confUrls[idx], jwkUrls[idx], decodeJwtOnlyPayload(recoverToken), jwks[idx]),
        newOwnerAddress,
        salts[idx],
        chainId,
      );

      await scw.requestRecover(newOwnerAddress, authBuilder.build());
    }
    ...
    ```

    Or directly use private key of current owner if user knows it.
