import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAuthenticated, signOut } from "@/lib/actions/auth.action";
import { Button } from "@/components/ui/button";

const Layout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();

  return (
    <div className="root-layout">
      <nav className="flex justify-between items-center w-full">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
          <h2 className="text-primary-100">PrepWise</h2>
        </Link>

        {isUserAuthenticated ? (
          <form action={async () => {
            "use server";
            await signOut();
            redirect("/sign-in");
          }}>
            <Button type="submit" variant="outline" className="border-dark-100 bg-dark-300">Sign Out</Button>
          </form>
        ) : (
          <div className="flex gap-3">
            <Button asChild variant="outline" className="border-dark-100 bg-dark-300 text-white hover:bg-dark-200">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="btn-primary text-dark-100">
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        )}
      </nav>

      {children}
    </div>
  );
};

export default Layout;
