import { z } from "zod";

//  ================== TOKENS ==================

export const cognitoTokensSchema = z.object({
  IdToken: z.string(),
  AccessToken: z.string(),
  RefreshToken: z.string(),
  ExpiresIn: z.number()  // how long the token lasts (in seconds) - is set to 3600
    .or(z.string()).pipe(z.coerce.number())
})
export type CognitoTokens = z.infer<typeof cognitoTokensSchema>

export const awsCredsSchema = z.object({
  AccessKeyId: z.string(),
  SecretAccessKey: z.string(),
  SessionToken: z.string(),
  Expiration: z.date()    // time at which the credentials expires (miliseconds since epoch) - will be 1 hour from credential generation
    .or(z.string()).pipe(z.coerce.date()),
})
export type AwsCreds = z.infer<typeof awsCredsSchema>

export const tokenSchema = z.object({
  aws_creds: awsCredsSchema,
  cognito_tokens: cognitoTokensSchema,
  identity_id: z.string(),
})
export type Tokens = z.infer<typeof tokenSchema>
