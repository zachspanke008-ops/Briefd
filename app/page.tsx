import { auth } from "@clerk/nextjs/server";
import { Cormorant_Garamond } from "next/font/google";
import SignOutBtn from "./_components/SignOutBtn";
import PlaidLink from "./_components/PlaidLink";
import SyncButton from "./_components/SyncButton";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
});

export default async function Home() {
  const { userId } = await auth();

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-cw {
          from { transform: translate(-50%, -50%) rotate(0deg);   }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: translate(-50%, -50%) rotate(0deg);    }
          to   { transform: translate(-50%, -50%) rotate(-360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1);    }
          50%       { opacity: 1;   transform: translate(-50%, -50%) scale(1.12); }
        }
        .a1 { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
        .a2 { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.22s both; }
        .a3 { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.38s both; }
      `}</style>

      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 relative overflow-hidden">

        {/* ── background ── */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>

          {/* central glow */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: 600, height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 70%)",
            animation: "pulse-glow 8s ease-in-out infinite",
          }} />

          {/* corner bleed */}
          <div style={{ position:"absolute", top:"-150px", left:"-150px", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)", filter:"blur(30px)" }} />
          <div style={{ position:"absolute", bottom:"-150px", right:"-150px", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)", filter:"blur(30px)" }} />

          {/* ── large outer spirals — slow CW ── */}
          <svg
            style={{ position:"absolute", top:"50%", left:"50%", width:2000, height:2000, animation:"spin-cw 70s linear infinite" }}
            viewBox="0 0 1000 1000" fill="none" overflow="visible"
          >
            <defs><filter id="f1"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
            <g filter="url(#f1)">
              <path d="M500 500 C 620 320, 820 340, 810 510 C 800 690, 630 790, 460 750 C 280 710, 160 540, 220 365 C 285 175, 510 105, 700 200 C 910 305, 960 570, 870 750 C 780 930, 560 970, 370 880" stroke="white" strokeOpacity="0.3" strokeWidth="1.2"/>
              <path d="M500 500 C 380 680, 180 660, 195 490 C 210 310, 390 210, 560 260 C 740 315, 840 500, 780 670 C 720 845, 520 910, 340 830 C 145 742, 90 510, 190 330 C 295 140, 530 90, 720 185" stroke="white" strokeOpacity="0.16" strokeWidth="1"/>
              <path d="M500 500 C 660 290, 890 330, 875 530 C 860 735, 660 860, 460 810 C 245 755, 115 550, 190 340 C 268 118, 530 45, 740 155 C 975 278, 1020 590, 910 800" stroke="white" strokeOpacity="0.08" strokeWidth="0.8"/>
            </g>
          </svg>

          {/* ── medium spirals — CCW ── */}
          <svg
            style={{ position:"absolute", top:"50%", left:"50%", width:1500, height:1500, animation:"spin-ccw 50s linear infinite" }}
            viewBox="0 0 700 700" fill="none" overflow="visible"
          >
            <defs><filter id="f2"><feGaussianBlur stdDeviation="1.8"/></filter></defs>
            <g filter="url(#f2)">
              <path d="M350 350 C 440 220, 590 225, 595 355 C 600 488, 470 565, 345 545 C 213 523, 130 400, 168 278 C 210 147, 370 100, 500 162 C 642 232, 672 415, 604 540 C 535 668, 368 698, 232 628" stroke="white" strokeOpacity="0.32" strokeWidth="1.1"/>
              <path d="M350 350 C 260 480, 110 475, 118 345 C 126 215, 260 145, 380 178 C 505 213, 572 340, 530 460 C 487 582, 340 622, 215 558 C 79 486, 48 315, 142 208 C 240 94, 415 70, 545 145" stroke="white" strokeOpacity="0.18" strokeWidth="0.9"/>
              <path d="M350 350 C 405 275, 488 278, 490 352 C 492 426, 420 470, 350 458 C 277 445, 233 378, 258 310 C 284 238, 363 215, 428 248" stroke="white" strokeOpacity="0.26" strokeWidth="1"/>
            </g>
          </svg>

          {/* ── small inner swirls — fast CW ── */}
          <svg
            style={{ position:"absolute", top:"50%", left:"50%", width:900, height:900, animation:"spin-cw 30s linear infinite" }}
            viewBox="0 0 420 420" fill="none" overflow="visible"
          >
            <defs><filter id="f3"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
            <g filter="url(#f3)">
              <path d="M210 210 C 258 150, 330 152, 332 212 C 334 272, 268 308, 210 296 C 149 283, 114 224, 140 168 C 168 108, 247 90, 305 126 C 368 165, 378 252, 334 310" stroke="white" strokeOpacity="0.38" strokeWidth="1"/>
              <path d="M210 210 C 162 270, 90 268, 88 208 C 86 148, 152 112, 210 124 C 271 137, 306 196, 280 252 C 253 310, 174 330, 113 295" stroke="white" strokeOpacity="0.20" strokeWidth="0.8"/>
            </g>
          </svg>

          {/* vignette to fade edges */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, black 100%)" }} />
        </div>

        {/* ── content ── */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <h1 className={`a1 text-white text-8xl leading-none ${cormorant.className}`}>
            Briefd
          </h1>
          <p className="a2 text-zinc-500 text-base max-w-xs">
            Stay on top of what matters.
          </p>
          <div className="a3 mt-1">
            {userId ? (
              <div className="flex flex-col items-center gap-3">
                <PlaidLink />
                <SyncButton />
                <SignOutBtn />
              </div>
            ) : (
              <a
                href="/sign-in"
                className="inline-block px-6 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-zinc-200 transition-colors"
              >
                Sign in
              </a>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
