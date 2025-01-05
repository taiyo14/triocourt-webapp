'server-only';


import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

import { CognitoIdentityProviderClient, InitiateAuthCommand, InitiateAuthCommandInput } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoIdentityClient, GetCredentialsForIdentityCommand, GetIdCommand } from "@aws-sdk/client-cognito-identity";

import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { NextResponse } from "next/server";
import { AwsCreds, awsCredsSchema, CognitoTokens, cognitoTokensSchema, Tokens, tokenSchema } from "@/app/types";


const {
  REGION,
  AUTH_SECRET,
  COGNITO_POOL_ID,
  COGNITO_APPCLIENT_ID,
  COGNITO_APPCLIENT_SECRET,
  IDENTITYPOOL_ID,
  AWS_ACCOUNT_ID,
} = process.env;

const AWS_COOKIE = "aws_creds";

const cognitoclient = new CognitoIdentityProviderClient({ region: REGION });
const identityclient = new CognitoIdentityClient({ region: REGION });


export function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


//  ================== METHODS ==================

//  ====  AWS_CREDS ====

export async function setAwsCreds(creds: AwsCreds, response?: NextResponse) {
  let target = null
  if (response) target = response.cookies;
  else target = await cookies();

  target.set(AWS_COOKIE, JSON.stringify(creds), {
    httpOnly: true,
    expires: creds.Expiration,
    sameSite: "lax",
    path: "/",
    secure: process.env.ENV === "prod",
  })

  // if (response) return response;
}
export async function getAwsCreds() {
  const credsCookie = (await cookies()).get(AWS_COOKIE);
  if (!credsCookie?.value) return null;
  const unsafeCreds = JSON.parse(credsCookie.value);
  const parsed = awsCredsSchema.safeParse(unsafeCreds);
  if (parsed.success) return parsed.data;
  return null;
}

//  ==== COGNITO ====

export async function setCognitoTokens(tokens: CognitoTokens, response?: NextResponse) {
  let target = null
  if (response) target = response.cookies;
  else target = await cookies();

  Object.entries(tokens).forEach(([key, val]) => {
    target.set(`cognito.${key}`, String(val), {
      httpOnly: true,
      maxAge: 3600,
      sameSite: "lax",
      path: "/",
      secure: process.env.ENV === "prod",
    })
  })

  //  = setting the tokens in one cookie is too big!  =
  // (await cookies()).set(COGNITO_COOKIE, JSON.stringify(tokens), {
  //   httpOnly: true,
  //   expires: 3600,
  //   sameSite: "lax",
  //   path: "/",
  //   secure: process.env.ENV === "prod",
  // })
}
export async function getCognitoTokens() {
  const cookieStore = await (await cookies()).getAll();

  const unsafeTokens = cookieStore.reduce((cognitoToken, cookie) => {
    const { name, value } = cookie;

    if (name.startsWith('cognito')) {
      const key = name.split('.').at(-1);
      if (key) cognitoToken[key] = value;
    }

    return cognitoToken;
  }, {} as Record<string, string | number>)

  const parsed = cognitoTokensSchema.safeParse(unsafeTokens);
  if (parsed.success) return parsed.data;
  return null;

  // const tokenCookie = (await cookies()).get(COGNITO_COOKIE);
  // if (!tokenCookie?.value) return null;
  // const unsafeToken = JSON.parse(tokenCookie?.value);
  // const parsed = cognitoTokensSchema.safeParse(unsafeToken);
  // if (parsed.success) return parsed.data;
  // return null;
}

//  ==== IDENTITY_ID ====

export async function setIdentiyId(id: string, response?: NextResponse) {
  let target = null
  if (response) target = response.cookies;
  else target = await cookies();

  target.set('identity_id', id, {
    httpOnly: true,
    maxAge: 3600,
    sameSite: "lax",
    path: "/",
    secure: process.env.ENV === "prod",
  })
}
export async function getIdentityId() {
  const unsafeId = (await cookies()).get('identity_id');
  const parsed = z.string().safeParse(unsafeId?.value);
  if (parsed.success) return parsed.data;
  return null;
}

// ==== all tokens ====

export const getAllTokens = cache(async () => {
  const allTokens_arr = await Promise.all([
    getAwsCreds,
    getCognitoTokens,
    getIdentityId,
  ].map(prom => prom()));

  const unsafeAllToken = {
    aws_creds: allTokens_arr[0],
    cognito_tokens: allTokens_arr[1],
    identity_id: allTokens_arr[2]
  }

  const parsed = tokenSchema.safeParse(unsafeAllToken);
  if (parsed.success) return parsed.data;
  return null;
})

//  ===== cookies =====

export async function setCookies(tokens: Tokens, response?: NextResponse) {
  await Promise.all([
    setAwsCreds(tokens.aws_creds, response),
    setCognitoTokens(tokens.cognito_tokens, response),
    setIdentiyId(tokens.identity_id, response),
  ]);
}

export async function deleteAllCookies() {
  const cookieStore = await cookies();
  cookieStore.getAll().forEach(cookie => {
    cookieStore.delete(cookie.name);
  })
}






export async function makeSecretHash(email: string) {
  try {
    if (!COGNITO_APPCLIENT_SECRET) throw new Error('APPCLIENT_SECRET is undefined');
    if (!COGNITO_APPCLIENT_ID) throw new Error('USERPOOL_ID is undefined');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(COGNITO_APPCLIENT_SECRET),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );

    const message = encoder.encode(`${email}${COGNITO_APPCLIENT_ID}`);

    const signature = await crypto.subtle.sign("HMAC", key, message);

    // const base64Hash = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const base64Hash = Buffer.from(new Uint8Array(signature)).toString('base64');

    return base64Hash;

  } catch (error) {
    console.log(error);
    return null;
  }
}


export function parseJwt(token: string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}





export async function fetchTokens(email: string, password: string) {
  try {
    const secretHash = await makeSecretHash(email);
    if (!secretHash) throw new Error("Failed to make secret hash");

    const input: InitiateAuthCommandInput = {
      AuthFlow: "USER_PASSWORD_AUTH", // required
      ClientId: COGNITO_APPCLIENT_ID, // required
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash,
      },
    };

    const initiateAuthCommand = new InitiateAuthCommand(input);
    const initiateAuthRes = await cognitoclient.send(initiateAuthCommand);

    const { AuthenticationResult } = initiateAuthRes;
    if (!AuthenticationResult) throw new Error("AuthenticationResult is undefined");
    return AuthenticationResult;

  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function fetchAwsCredentials(IdToken: string, identityId?: string) {
  /**
   *  use idToken and userIdentiyId  to get temporary aws credentials  (expires in 1 hour)
   */
  try {

    let userIdentityPoolId = identityId;

    if (!userIdentityPoolId) {
      const getIdRes = await fetchIdentityId(IdToken);
      if (!getIdRes) throw new Error('Failed to fetch identity id');

      userIdentityPoolId = getIdRes.IdentityId;
    }
    if (!userIdentityPoolId) throw new Error("Failed to get user's idenity pool id");

    if (!COGNITO_POOL_ID) throw new Error("USERPOOL_ID is undefined");
    if (!REGION) throw new Error("REGION is undefined");


    const providerName = `cognito-idp.${REGION}.amazonaws.com/${COGNITO_POOL_ID}`
    const getIdentityCreds = new GetCredentialsForIdentityCommand({
      IdentityId: userIdentityPoolId,
      Logins: {
        [providerName]: IdToken
      }
    });

    const getIdCredsRes = await identityclient.send(getIdentityCreds);
    return getIdCredsRes;

  } catch (error) {
    console.error("Error fetching temporary aws creds from identity pool", error);
    return null;
  }
}

export async function fetchIdentityId(idToken: string) {
  try {
    if (!COGNITO_POOL_ID) throw new Error("USERPOOL_ID is undefined");
    if (!REGION) throw new Error("REGION is undefined");
    if (!IDENTITYPOOL_ID) throw new Error("IDENTITYPOOL_ID is undefined");
    if (!AWS_ACCOUNT_ID) throw new Error("AWS_ACCOUNT_ID is undefined");


    const providerName = `cognito-idp.${REGION}.amazonaws.com/${COGNITO_POOL_ID}`

    const getIdCommand = new GetIdCommand({
      AccountId: AWS_ACCOUNT_ID,
      IdentityPoolId: IDENTITYPOOL_ID,
      Logins: {
        [providerName]: idToken
      }
    })

    const getIdRes = await identityclient.send(getIdCommand);
    return getIdRes;

  } catch (error) {
    console.log(error);
    return null;
  }
}