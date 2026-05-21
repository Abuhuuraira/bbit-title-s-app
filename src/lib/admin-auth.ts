import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export function verifyAdminAuth() {
  const cookieStore = cookies();
  const adminAuth = cookieStore.get("admin_auth")?.value;
  
  if (!adminAuth) {
    redirect("/admin-login");
  }
  
  return true;
}
