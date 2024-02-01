# Account Abstraction SDK for zkAuth

## 1. Introduction

This is a SDK for zkAuth. It allows applications to interact with zkAuth smart contracts, which can create & manage AA wallet based on zkAuth protocol.

## 2. Installation

TBA

## 3. Usage

### Create a new AA wallet

1. Prepare arguments:

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
    ```

2. Get User's JWT token:

    ```js
    const args: typeDataArgs = {
        verifyingContract: initialGuardian,
        sca: cfAddress,
        newOwner: signer.address,
        name: aud,
        chainId: chainId,
    };
    const nonce = calcNonce(args);
    // get JWT token from server with nonce
    ...
    ```

3. Deploy AA wallet:

    ```js
    const decodedPayloadJwt = decodeJwtOnlyPayload(userJwtToken);
    // Note that decodedPayloadJwt is the same as idToken.sub
    const subHash = calcSubHash(decodedPayloadJwt.payload.sub, salt);
    const confUrl = OIDCProviders.find(p => p.name === newOIDCProvider.toLowerCase())?.confUrl;
    const jwkUrl = OIDCProviders.find(p => p.name === newOIDCProvider.toLowerCase())?.jwkUrl;

    const authBuilder = new AuthBuilder(
      cfAddress,
      subHash,
      params.initialGuardianAddress,
      new JwtProvider(confUrl, jwkUrl, decodedPayloadJwt, jwks as RsaJsonWebKey),
      signer.address,
      salt,
      network.chainId,
    );

    await scw.deployAndRecover(authBuilder.build());
    // Save data to DB if needed
    ...
    ```

### Add a new Guardian

1. Prepare a JWT token for the new Guardian (Note: Nonce isn't needed)

2. Add the new Guardian

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
    const data = scw.encodeRemoveGuardian(targetGuardian, newSubHash, newThreshold);
    const tx: TransactionDetailsForUserOp = {
        target: cfAddress,
        data: data,
        value: 0,
    };
    const uorc = await createAndSendUserOp(scw, bundlerUrl, chainId, tx);
    // Save a new guardian if needed
    ...
    ```

### Remove a Guardian

1. Prepare `sub` and `guardian` to remove.

    - If `sub` isn't stored in DB, you need to get user's JWT token.

2. Remove the Guardian

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
    // Remove a guardian if needed
    ...
    ```

### Recover an AA wallet

1. Prepare user's recovery JWT tokens based on registered guardian and `threshold`.

    ```js
    const args: typeDataArgs = {
        verifyingContract: guardian,
        sca: cfAddress,
        newOwner: newOwnerAddress,
        name: aud,
        chainId: network.chainId,
    };
    const nonce = calcNonce(args);
    // get JWT token from server with nonce
    ```

2. Recover the AA wallet

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
        network.chainId,
      );

      await scw.requestRecover(newOwnerAddress, authBuilder.build());
    }
    ...
    ```

    Or directly use private key of current owner if user knows it.
