import Link from "next/link";
import VisitTracker from "@/components/VisitTracker";
import Logo from "@/components/Logo";
import {
  ArrowRight,
  Zap,
  Shield,
  Bell,
  Globe,
  Smartphone,
  TrendingUp,
  Clock,
  ChevronDown,
  Download,
} from "lucide-react";

const ACCENT = "#0A84FF";

export default function Home() {
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#0D1117" }}>
      <VisitTracker />
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b px-6 py-3"
        style={{
          background: "rgba(13,17,23,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: "rgba(10,132,255,0.15)",
        }}
      >
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-xl font-extrabold tracking-wide">
              EA <span style={{ color: ACCENT }}>NAPTUNE</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-[18px] py-2 rounded-xl text-[13px] font-bold border transition-colors"
              style={{
                color: ACCENT,
                borderColor: "rgba(10,132,255,0.25)",
                background: "rgba(10,132,255,0.08)",
              }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 rounded-xl text-[13px] font-extrabold text-black transition-all"
              style={{
                background: ACCENT,
                boxShadow: `0 4px 16px 0px rgba(10,132,255,0.3)`,
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="pt-[140px] pb-20 px-6 flex flex-col items-center"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(10,132,255,0.08) 0%, transparent 60%)",
        }}
      >
        <div className="mb-7">
          <Logo size={118} />
        </div>
        <h1 className="text-[42px] sm:text-[52px] font-black text-center leading-[1.15] tracking-tight mb-5">
          Mobile EA{"\n"}
          <br className="sm:hidden" />
          Trading <span style={{ color: ACCENT }}>Automation</span>
        </h1>
        <p
          className="text-[17px] text-center leading-[27px] max-w-[560px] mb-9"
          style={{ color: "#8B949E" }}
        >
          Run your Expert Advisors directly from your phone. Connect your MT5
          account, receive real-time trading signals, and execute trades
          automatically — no VPS required.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-12">
          <a
            href="https://free-app-zw10.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-[14px] text-[15px] font-bold border transition-colors"
            style={{
              color: ACCENT,
              borderColor: "rgba(10,132,255,0.3)",
              background: "rgba(10,132,255,0.06)",
            }}
          >
            <Smartphone size={18} />
            iOS Version
          </a>
          <a
            href="/ea-access.apk"
            download
            className="flex items-center gap-2 px-6 py-3.5 rounded-[14px] text-[15px] font-bold border transition-colors"
            style={{
              color: ACCENT,
              borderColor: "rgba(10,132,255,0.3)",
              background: "rgba(10,132,255,0.06)",
            }}
          >
            <Download size={18} />
            Android (APK)
          </a>
        </div>
      </section>

      {/* Features */}
      <section
        className="py-20 px-6 flex flex-col items-center"
        style={{ background: "#0A0D12" }}
      >
        <p
          className="text-[11px] font-extrabold tracking-[3px] mb-3"
          style={{ color: ACCENT }}
        >
          FEATURES
        </p>
        <h2 className="text-[32px] font-black text-center mb-12 tracking-tight">
          Why Traders Choose EA Naptune
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[1000px] w-full">
          {[
            {
              icon: Zap,
              title: "Fast Execution",
              desc: "Execute trades with ultra-low latency directly from your mobile device. No delays, no missed opportunities.",
            },
            {
              icon: Shield,
              title: "Secure & Encrypted",
              desc: "Your trading credentials and data are encrypted end-to-end. We never store your MT5 passwords on our servers.",
            },
            {
              icon: Bell,
              title: "Real-Time Signals",
              desc: "Receive instant trading signals from your connected EAs. One-tap execution or fully automated trading.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-[18px] p-7 border"
              style={{
                background: "#161B22",
                borderColor: "rgba(10,132,255,0.08)",
                boxShadow: "0 4px 20px 0px rgba(0,0,0,0.3)",
              }}
            >
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-[18px]"
                style={{ background: "rgba(10,132,255,0.1)" }}
              >
                <f.icon size={24} style={{ color: ACCENT }} />
              </div>
              <h3 className="text-[18px] font-extrabold mb-2.5">{f.title}</h3>
              <p className="text-[14px] leading-[22px]" style={{ color: "#8B949E" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 flex flex-col items-center">
        <p
          className="text-[11px] font-extrabold tracking-[3px] mb-3"
          style={{ color: ACCENT }}
        >
          HOW IT WORKS
        </p>
        <h2 className="text-[32px] font-black text-center mb-12 tracking-tight">
          Up and Running in Minutes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[900px] w-full">
          {[
            {
              num: "1",
              title: "Get Your Access Key",
              desc: "Sign up with your email and enter your EA access key to activate your account.",
            },
            {
              num: "2",
              title: "Connect Your MT5",
              desc: "Link your MetaTrader 5 broker account securely. We support all major brokers worldwide.",
            },
            {
              num: "3",
              title: "Start Auto Trading",
              desc: "Configure your trading parameters and let your EA execute trades automatically from your phone.",
            },
          ].map((s) => (
            <div key={s.num} className="flex flex-col items-center text-center">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center mb-[18px] text-[22px] font-black text-black"
                style={{
                  background: ACCENT,
                  boxShadow: "0 4px 16px 0px rgba(10,132,255,0.25)",
                }}
              >
                {s.num}
              </div>
              <h3 className="text-[17px] font-extrabold mb-2">{s.title}</h3>
              <p
                className="text-[14px] leading-[22px] max-w-[260px]"
                style={{ color: "#8B949E" }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Reliability / Trust */}
      <section
        className="py-20 px-6 flex flex-col items-center"
        style={{ background: "#0A0D12" }}
      >
        <p
          className="text-[11px] font-extrabold tracking-[3px] mb-3"
          style={{ color: ACCENT }}
        >
          RELIABILITY
        </p>
        <h2 className="text-[32px] font-black text-center mb-12 tracking-tight">
          Built for Serious Traders
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[800px] w-full">
          {[
            {
              icon: Globe,
              title: "Works Worldwide",
              desc: "Connected across global trading servers for low-latency execution anywhere.",
            },
            {
              icon: Smartphone,
              title: "No VPS Needed",
              desc: "Your phone becomes your trading server. No desktop, no VPS rental fees.",
            },
            {
              icon: TrendingUp,
              title: "MT4 & MT5 Support",
              desc: "Compatible with both MetaTrader 4 and MetaTrader 5 platforms and all brokers.",
            },
            {
              icon: Clock,
              title: "Always Running",
              desc: "Your EAs keep executing even when the app is in the background or your screen is off.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3.5 p-5 rounded-[14px] border"
              style={{
                background: "#161B22",
                borderColor: "rgba(10,132,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(10,132,255,0.1)" }}
              >
                <item.icon size={20} style={{ color: ACCENT }} />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold mb-1">{item.title}</h3>
                <p className="text-[13px] leading-5" style={{ color: "#8B949E" }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 flex flex-col items-center">
        <p
          className="text-[11px] font-extrabold tracking-[3px] mb-3"
          style={{ color: ACCENT }}
        >
          FAQ
        </p>
        <h2 className="text-[32px] font-black text-center mb-12 tracking-tight">
          Common Questions
        </h2>
        <div className="max-w-[700px] w-full space-y-2.5">
          {[
            {
              q: "How does EA Naptune work?",
              a: "EA Naptune converts your Expert Advisors into mobile-compatible bots. Once you connect your MT5 account, the app communicates directly with your broker to execute trades based on your EA signals — all from your phone.",
            },
            {
              q: "Is my trading account safe?",
              a: "Yes. Your MT5 credentials are encrypted and used only to establish a direct connection with your broker. We never store passwords on our servers. All trading happens through your broker's official web terminal.",
            },
            {
              q: "Which brokers are supported?",
              a: "EA Naptune supports all major MT5 brokers including RazorMarkets, Deriv, RCG Markets, Trade245, and any broker with a web terminal. MT4 support is also available.",
            },
            {
              q: "Do I need a VPS?",
              a: "No. EA Naptune eliminates the need for a VPS entirely. Your phone acts as the trading server, executing trades with ultra-low latency directly through the broker's platform.",
            },
          ].map((faq, i) => (
            <details
              key={i}
              className="group rounded-[14px] border overflow-hidden"
              style={{
                background: "#161B22",
                borderColor: "rgba(10,132,255,0.06)",
              }}
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="flex items-center justify-between px-5 py-5 cursor-pointer list-none text-[15px] font-bold hover:text-[#0A84FF] transition-colors [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown
                  size={18}
                  className="shrink-0 ml-3 transition-transform group-open:rotate-180"
                  style={{ color: "#8B949E" }}
                />
              </summary>
              <div
                className="px-5 pb-5 text-[14px] leading-[23px] border-t pt-3.5"
                style={{
                  color: "#8B949E",
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-[60px] px-6 flex justify-center border-y"
        style={{
          borderColor: "rgba(10,132,255,0.15)",
          background:
            "linear-gradient(135deg, rgba(10,132,255,0.04) 0%, #0D1117 50%, rgba(10,132,255,0.03) 100%)",
        }}
      >
        <div
          className="max-w-[620px] w-full rounded-3xl p-12 flex flex-col items-center border"
          style={{
            background: "rgba(22,27,34,0.8)",
            borderColor: "rgba(10,132,255,0.12)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 4px 40px 0px rgba(10,132,255,0.08)",
          }}
        >
          <p
            className="text-[10px] font-extrabold tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            GET STARTED TODAY
          </p>
          <h2 className="text-[30px] font-black text-center leading-[38px] mb-3.5">
            Ready to Automate
            <br />
            Your Trading?
          </h2>
          <p
            className="text-[14px] text-center leading-[23px] max-w-[440px] mb-[30px]"
            style={{ color: "#8B949E" }}
          >
            Join thousands of traders using EA Naptune to run their Expert
            Advisors from anywhere — no VPS needed, just seamless mobile
            trading.
          </p>
          <Link
            href="/register"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-[16px] font-extrabold text-black transition-all"
            style={{
              background: ACCENT,
              boxShadow: "0 4px 24px 0px rgba(10,132,255,0.45)",
            }}
          >
            <ArrowRight size={18} />
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-10 px-6 border-t"
        style={{ borderColor: "rgba(10,132,255,0.08)" }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-col items-center">
          <div className="flex flex-col items-center text-center mb-4">
            <Logo size={44} />
            <span className="text-[18px] font-black tracking-wide mt-2.5">
              EA <span style={{ color: ACCENT }}>NAPTUNE</span>
            </span>
            <p className="text-[12px] mt-1" style={{ color: "#8B949E" }}>
              Mobile EA Trading Automation
            </p>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/login"
              className="text-[13px] font-semibold transition-colors hover:text-white"
              style={{ color: "#8B949E" }}
            >
              Sign In
            </Link>
            <span className="text-[13px] opacity-30" style={{ color: "#8B949E" }}>
              |
            </span>
            <span className="text-[13px] font-semibold" style={{ color: "#8B949E" }}>
              Terms &amp; Conditions
            </span>
          </div>
          <p className="text-[12px]" style={{ color: "rgba(139,148,158,0.5)" }}>
            &copy; 2025 EA Naptune. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
