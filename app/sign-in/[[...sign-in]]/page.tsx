import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .sign-in-animate {
          animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 px-4">
        <div className="sign-in-animate flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-white text-3xl font-semibold tracking-tight">Briefd</h1>
            <p className="text-zinc-500 text-sm mt-1.5">Sign in to continue</p>
          </div>
          <SignIn
            appearance={{
              elements: {
                rootBox: "shadow-none",
                card: "shadow-none border border-zinc-200 rounded-2xl",
                headerTitle: "text-zinc-900",
                headerSubtitle: "text-zinc-500",
                socialButtonsBlockButton: "border border-zinc-200 hover:bg-zinc-50",
                dividerLine: "bg-zinc-200",
                dividerText: "text-zinc-400",
                formFieldInput:
                  "border-zinc-200 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900",
                formButtonPrimary:
                  "bg-zinc-900 hover:bg-zinc-700 text-white shadow-none",
                footerActionLink: "text-zinc-900 hover:text-zinc-600",
              },
            }}
          />
        </div>
      </div>
    </>
  );
}
