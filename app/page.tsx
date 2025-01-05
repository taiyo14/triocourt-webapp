
import { getAllTokens, parseJwt } from "@/utils/server-utils";
import Dashboard from "./components/dashboard";
import LoginPage from "./components/login";



export default async function Page() {

  const tokens = await getAllTokens();

  
  if (tokens && tokens.aws_creds.Expiration) {
    const idToken = parseJwt(tokens.cognito_tokens.IdToken);
    const email = idToken.email;

    return (
      <>
        <Dashboard email={email} />
      </>
    )
  }

  return (
    <>
      <LoginPage />
    </>
  )
}