import { getServerSession } from "@/auth";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return <AdminLayoutClient initialSession={session}>{children}</AdminLayoutClient>;
}