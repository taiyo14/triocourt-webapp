'use client'





import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils";
import { minLengthSchema, SigninForm, signinFormSchema, SignupForm, signupFormSchema, SignupMessage, tooSmallMessage } from "../types";
import { signinAction, signupAction } from "../actions";
import { LoaderCircle } from "lucide-react";



enum PageType {
  SIGNIN = "sign-in",
  SIGNUP = "sign-up",
  CONFIRM = "confirmation",
}



export default function LoginPage() {



  const [page, setPage] = useState(PageType.SIGNIN);
  const [isPendingSignup, startTransitionSignup] = useTransition();
  const [isPendingSignin, startTransitionSignin] = useTransition();


  const [signinError, setSigninError] = useState<{ code: number, message: string, email?: string } | null>(null);
  const [signupMessage, setSignupMessage] = useState<SignupMessage | null>(null);

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupFormSchema),
    criteriaMode: "all",
    defaultValues: { email: '', password: '' },
    mode: "onBlur"
  })

  const signinForm = useForm<SignupForm>({
    resolver: zodResolver(signinFormSchema),
    criteriaMode: "all",
    defaultValues: { email: '', password: '' },
    mode: "onBlur"
  })


  function onSignupSubmit(values: SignupForm) {
    // do preprocessing before sent to server action

    startTransitionSignup(async () => {
      const res = await signupAction(values);

      if (res.error) {
        // setSignupMessage(res.error);
        setSignupMessage(res);

        if (res.error.code === 5) setPage(PageType.CONFIRM);
      }
      else {
        setSignupMessage(res);
        setPage(PageType.CONFIRM);
      }

    })

  }

  function onSigninSubmit(values: SigninForm) {

    startTransitionSignin(async () => {
      const res = await signinAction(values);

      if (res && res.error) {
        setSigninError(res.error);
      }

    })
  }


  return (
    <div className="w-screen h-screen grid justify-center items-center">
      <div className="space-y-4">

        {page === PageType.SIGNIN && (
          <div className="grid">
            <span>SIGN IN</span>
            <Form {...signinForm}>
              <form onSubmit={signinForm.handleSubmit(onSigninSubmit)} className="space-y-4">
                <FormField
                  control={signinForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signinForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <p className="text-sm text-red-400">{signinError?.message}</p>
                <Button type="submit" disabled={isPendingSignin} className="w-20">
                  {isPendingSignin ? <LoaderCircle className="animate-spin"/> : "Submit"}
                </Button>

                <p className="text-sm">Don&apos;t have an account? <Button type="button" variant='link' className="p-0 underline" onClick={() => setPage(PageType.SIGNUP)}>Sign up</Button></p>
              </form>
            </Form>
          </div>
        )}

        {page === PageType.SIGNUP && (
          <div className="grid">
            <span>SIGN UP</span>
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} onChange={(e) => {
                          field.onChange(e);
                          signupForm.trigger("password");
                        }} />
                      </FormControl>
                      <div className="grid">
                        {<p className={cn('text-sm', signupForm.formState.dirtyFields.password && minLengthSchema.safeParse(signupForm.getValues('password')).success && 'text-green-500')} >{tooSmallMessage}</p>}
                      </div>
                    </FormItem>
                  )}
                />
                {signupMessage?.error?.message && signupMessage?.error?.code !== 5 && <p className="text-sm text-red-400">{signupMessage?.error?.message}</p>}
                <Button type="submit" disabled={isPendingSignup} className="w-20">
                  {isPendingSignup ? <LoaderCircle className="animate-spin"/> : "Submit"}
                </Button>
                <p className="text-sm">Already have an account? <Button type="button" variant='link' className="p-0 underline" onClick={() => setPage(PageType.SIGNIN)}>Sign in</Button></p>

              </form>
            </Form>
          </div>
        )}

        {page === PageType.CONFIRM && (
          <div className="grid gap-2">
            <p>We&apos;ve sent the verification email.<br />Please check your inbox.</p>
            <span className="text-sm font-medium">email:</span>
            <span className="pl-4 text-base md:text-sm">{signupMessage?.error?.email || signupMessage?.success?.email}</span>
            <Button className="mt-4" onClick={() => setPage(PageType.SIGNIN)}>Back to sign in</Button>
          </div>
        )}

      </div>
    </div>
  )
}
