"use server"



import { CognitoIdentityProviderClient, CognitoIdentityProviderServiceException, SignUpCommand, SignUpCommandInput, SignUpCommandOutput } from "@aws-sdk/client-cognito-identity-provider";

import { AvailabilityResponse, DateForm, dateFormSchema, SigninForm, signinFormSchema, SignupForm, signupFormSchema, SignupMessage, Slot } from "./types";
import { deleteAllCookies, fetchAwsCredentials, fetchTokens, getCurrentDate, makeSecretHash, setCookies, signRequest } from "@/utils/server-utils";
import { HttpRequest } from "@smithy/protocol-http";
import { revalidatePath } from "next/cache";




const {
  COGNITO_APPCLIENT_ID,
  REGION,
  API_HOSTNAME,
} = process.env;

const client = new CognitoIdentityProviderClient({
  region: REGION
});


export async function signinAction(values: SigninForm) {

  const parsedValues = signinFormSchema.safeParse(values);

  if (parsedValues.error) {
    return ({
      error: {
        code: 1,
        message: JSON.stringify(parsedValues.error)
      }
    })
  }

  const validValues = parsedValues.data;

  try {

    const { email, password } = validValues;

    // exchange user credentials for tokens

    const tokens = await fetchTokens(email, password);
    if (!tokens) throw new Error('Failed to fetch tokens');

    const { IdToken, AccessToken, RefreshToken, ExpiresIn } = tokens;
    if (!IdToken || !AccessToken || !RefreshToken || !ExpiresIn) throw new Error("Tokens are malformed");

    // exchange tokens for temporary aws credentials

    const getIdCredsRes = await fetchAwsCredentials(IdToken);
    if (!getIdCredsRes) throw new Error("Failed to fetch temporary aws credentials");

    const { Credentials: creds, IdentityId: identityId } = getIdCredsRes;
    if (!creds) throw new Error("Credentials is undefined, inside getIdCredsRes");
    if (!identityId) throw new Error("IdentityId is undefined, inside getIdCredsRes");

    const { AccessKeyId, SecretKey, SessionToken, Expiration } = creds;
    if (!AccessKeyId || !SecretKey || !SessionToken || !Expiration) throw new Error("Temporary creds are malformed");

    await setCookies({
      aws_creds: {
        AccessKeyId,
        SecretAccessKey: SecretKey,
        SessionToken,
        Expiration,
      },
      cognito_tokens: {
        IdToken,
        AccessToken,
        RefreshToken,
        ExpiresIn,
      },
      identity_id: identityId
    })

  } catch (error) {
    console.log('failed to sign in', error);
  }
  finally {
    revalidatePath('/');
  }
}


export async function signupAction(values: SignupForm): Promise<SignupMessage> {
  const parsedValues = signupFormSchema.safeParse(values);

  if (parsedValues.error) {
    return ({
      error: {
        code: 1,
        message: JSON.stringify(parsedValues.error),
        email: undefined,
      }
    })
  }

  const { email, password } = parsedValues.data;

  const secretHash = await makeSecretHash(email);
  if (!secretHash) return ({
    error: {
      code: 2,
      message: "Invalid secret hash",
      email: undefined,
    }
  });

  const signupInput: SignUpCommandInput = {
    ClientId: COGNITO_APPCLIENT_ID,
    Username: email,
    Password: password,
    SecretHash: secretHash,
    UserAttributes: [
      { Name: "custom:joinedOn", Value: getCurrentDate() }
    ]
  }
  const command = new SignUpCommand(signupInput);

  try {
    const response: SignUpCommandOutput = await client.send(command);

    const { UserConfirmed } = response;

    return {
      success: {
        UserConfirmed,
        email
      }
    }

  } catch (error) {
    // console.error(error);
    if (error instanceof CognitoIdentityProviderServiceException) {

      switch (error.name) {
        case 'UsernameExistsException':
          return ({
            error: {
              code: 5,
              message: 'Username already exists',
              email,
            }
          });

        case 'InvalidPasswordException':
          return ({
            error: {
              code: 0,
              message: 'Something went wrong.',
              email: undefined,
            }
          });

        default:
          break;
      }
    }
    return {
      error: {
        code: 0,
        message: JSON.stringify(error),
        email: undefined,
      }
    }
  }
  finally {
    revalidatePath('/');
  }

}


export async function signoutAction() {
  await deleteAllCookies();
  revalidatePath('/');
}



