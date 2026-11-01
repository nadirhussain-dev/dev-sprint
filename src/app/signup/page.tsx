import { redirect } from "next/navigation";

// Email-only sign-in creates the account on first use, so sign-up and sign-in are the same flow.
export default function SignupPage() {
  redirect("/login");
}
