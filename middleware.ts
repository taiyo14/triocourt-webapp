import { NextResponse, type NextMiddleware, type NextRequest } from "next/server";

import { fetchAwsCredentials, getAllTokens, refreshCognitoToken, setCookies } from "./utils/server-utils";
import { Tokens } from "./app/types";


let isRefreshing = false;



export const config = {
  matcher: ["/"]
};


export const middleware: NextMiddleware = async (request: NextRequest) => {
  console.log(`middleware called...`)
  const response = NextResponse.next();

  const token = await getAllTokens();
  if (!token) return response;


  if (shouldUpdateToken(token.aws_creds.Expiration)) {

    const newTokens = await refreshTokens(token);
    if (!newTokens) return response;

    setCookies(newTokens, response);
  }

  return response;
};


function shouldUpdateToken(expiration?: Date) {
  if (!expiration) return false;

  // miliseconds since epoch
  const expTime = new Date(expiration).valueOf();
  const curTime = Date.now();

  return curTime > expTime;
}


async function refreshTokens(token: Tokens) {
  if (isRefreshing) {
    return token;
  }


  isRefreshing = true;

  try {
    console.log(`old token: ${JSON.stringify(token.aws_creds.SecretAccessKey)}`)
    console.log(`refreshing tokens...`);
    const t0 = performance.now();

    const idToken = token.cognito_tokens.IdToken;
    const refreshToken = token.cognito_tokens.RefreshToken;

    const newUserPoolCreds = await refreshCognitoToken(idToken, refreshToken);
    if (!newUserPoolCreds) return null;

    const { AccessToken, IdToken, ExpiresIn } = newUserPoolCreds;
    if (!IdToken || !AccessToken || !ExpiresIn) return null;

    const { identity_id: identityId } = token;
    const newAwsCreds = await fetchAwsCredentials(IdToken, identityId);
    if (!newAwsCreds) return null;

    const { Credentials, IdentityId } = newAwsCreds;
    if (!Credentials) return null;
    if (!IdentityId) return null;

    const { AccessKeyId, SecretKey, SessionToken, Expiration } = Credentials;
    if (!AccessKeyId || !SecretKey || !SessionToken || !Expiration) return null;
    const t1 = performance.now();
    console.log(`successfully refreshed tokens. took ${t1 - t0} milliseconds.`);
    console.log(`new token: ${JSON.stringify(SecretKey)}`)

    const newToken: Tokens = {
      identity_id: IdentityId,
      cognito_tokens: {
        IdToken,
        AccessToken,
        RefreshToken: refreshToken,
        ExpiresIn,
      },
      aws_creds: {
        AccessKeyId,
        SecretAccessKey: SecretKey,
        SessionToken,
        Expiration,
      },
    }

    return newToken;
  } finally {
    isRefreshing = false;
  }
}