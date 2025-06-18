"use client";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { convex } from "./ConvexClientProvider";
import { useHeaderContent } from "./util/HeaderContext";
import { motion } from "framer-motion";
import { useLoading } from "./util/LoadingContext";

function NavLink({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (href === pathname) return;
    setIsNavigating(true);
    router.push(href);
  };

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      className="group relative overflow-x-hidden"
      onClick={handleClick}
    >
      {children}
      <div
        className={cn("bg-brand absolute bottom-0 left-0 h-[1px] w-full", {
          "animate-load": isNavigating,
          "origin-left scale-x-0 transform transition-transform duration-100 group-hover:scale-x-100":
            !isNavigating
        })}
      />
    </Link>
  );
}

export default function Header() {
  const [isConnected, setIsConnected] = useState(false);
  const currentUser = useQuery(api.auth.getCurrentUser);
  const pathname = usePathname();
  const { isLoading } = useLoading();

  useEffect(() => {
    const checkConnection = () => {
      const connectionState = convex.connectionState();
      setIsConnected(connectionState.isWebSocketConnected);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  const { isAuthenticated } = useConvexAuth();
  const { content } = useHeaderContent();

  if (typeof window !== "undefined" && window.innerHeight < 400) {
    const overlayVariants = {
      initial: {
        top: "50%",
        left: "50%",
        x: "-50%",
        y: "-50%",
        scale: 1
      },
      corner: {
        top: "0.5rem",
        left: "1rem",
        x: 0,
        y: 0,
        scale: 0.3,
        transition: { type: "spring", stiffness: 300, damping: 30 }
      }
    } as const;
    return (
      <motion.div
        variants={overlayVariants}
        initial="initial"
        animate={isLoading ? "initial" : "corner"}
        className="absolute z-50 flex origin-top-left flex-col items-start"
      >
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-title group relative text-4xl font-extrabold select-none"
        >
          Hypershelf
          <div className="absolute bottom-0 left-0 h-1 w-11.5 overflow-hidden">
            <div
              className={cn(
                "bg-brand h-full w-full",
                isLoading
                  ? "animate-brand-load"
                  : "group-hover:animate-brand-once"
              )}
            />
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <header className="fixed z-50 w-full">
      <div className="border-border text-foreground mx-4 my-2 flex h-8 items-center justify-between rounded-md border bg-black/40 px-4 py-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-title group relative text-xs font-extrabold"
          >
            Hypershelf
            <div className="bg-brand absolute bottom-0 left-0 h-0.5 w-4"></div>
            <div className="absolute bottom-0 left-0 h-0.5 w-4 overflow-hidden">
              <div className="bg-brand group-hover:animate-brand-once h-full w-full" />
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <div
              className={cn("h-1.5 w-1.5 rounded-full", {
                "bg-green-500": isConnected,
                "bg-red-500": !isConnected
              })}
            ></div>
            <div className="text-muted-foreground text-xs">
              {isConnected ? "Live" : "Reconnecting..."}
            </div>
          </div>
        </div>
        {content}
        <nav>
          <div className="flex space-x-6 text-xs font-medium">
            {pathname !== "/signin" && (
              <>
                <NavLink href="/">Assets</NavLink>
                <NavLink href="/fields">Fields</NavLink>
                <NavLink href="/schemas">Schemas</NavLink>
              </>
            )}
            {pathname !== "/signin" &&
              (isAuthenticated ? (
                <>
                  <NavLink href="/signout">Sign Out</NavLink>
                  <div className="text-muted-foreground text-xs">
                    {currentUser?.email ?? "..."}
                  </div>
                </>
              ) : (
                <NavLink href="/signin">Sign In</NavLink>
              ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
