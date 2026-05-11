"use client";
import { SignOutButton } from "@clerk/nextjs";

export default function SignOutBtn() {
  return (
    <SignOutButton redirectUrl="/sign-in">
      <button className="px-6 py-2.5 border border-zinc-700 text-zinc-400 text-sm font-medium rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors">
        Sign out
      </button>
    </SignOutButton>
  );
}
