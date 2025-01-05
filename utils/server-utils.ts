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




