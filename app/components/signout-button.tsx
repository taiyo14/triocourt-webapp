'use client'

import { Button } from "@/components/ui/button"
import { signoutAction } from "../actions"





export default function SignOutButton() {
    return (
        <Button onClick={() => signoutAction()}>SIGN OUT</Button>
    )
}