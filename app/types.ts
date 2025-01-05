import { z } from "zod";
import isStrongPassword from "validator/es/lib/isStrongPassword";

const base = {
  minLength: 0,
  minLowercase: 0,
  minUppercase: 0,
  minNumbers: 0,
  minSymbols: 0,
}

export const tooSmallMessage = "Must be 8 or more characters";

export const minLengthSchema = z.string().refine(str => isStrongPassword(str, { ...base, minLength: 8 }));

export const strongPassword = z.string().superRefine((str, ctx) => {
  if (!minLengthSchema.safeParse(str).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: tooSmallMessage,
    })
  }
})

export const signupFormSchema = z.object({
  email: z.string().email(),
  password: strongPassword
})

export type SignupForm = z.infer<typeof signupFormSchema>



export const signinFormSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export type SigninForm = z.infer<typeof signinFormSchema>

export type SignupMessage = {
  error?: {
    code: number;
    message: string;
    email: undefined | string;
  },
  success?: {
    UserConfirmed: boolean | undefined,
    email: string,
  }
}

export const dateSchema = z.string().date();

export const dateFormSchema = z.object({
  date: dateSchema
})

export type DateForm = z.infer<typeof dateFormSchema>
export type DateType = z.infer<typeof dateSchema>

export function curDate() { return new Date().toISOString().split('T').at(0) as string };

export type Slot = {
  start: number,
  end: number,
  avail: "available" | "occupied" | "unavailable"
}

export type AvailabilityResponse = {
  courtId: string,
  date: DateType,
  availability: Slot[]
}



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
