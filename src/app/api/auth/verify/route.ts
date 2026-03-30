import { queryOne } from "@/lib/db";
import { redirect } from "next/navigation";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/sign-in?error=invalid-token");
  }

  const user = await queryOne<{ id: string }>(
    `UPDATE users
     SET email_verified = true, email_verify_token = NULL, email_verify_token_expires_at = NULL
     WHERE email_verify_token = $1
       AND email_verify_token_expires_at > NOW()
       AND email_verified = false
     RETURNING id`,
    [token]
  );

  if (!user) {
    return redirect("/sign-in?error=expired-token");
  }

  return redirect("/sign-in?verified=true");
}
