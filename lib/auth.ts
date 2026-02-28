import { auth } from "@/auth";

/** Check if current request is from an admin user */
export async function verifyAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}
