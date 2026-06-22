import Link from "next/link";
import {
  ArrowRight,
  Download,
  Zap,
  ShieldCheck,
  Clock,
  Trophy,
  Newspaper,
  Lock,
  Headphones,
  Globe,
  ChevronDown,
  Users,
  CheckCircle,
  Smartphone,
  MonitorSmartphone,
} from "lucide-react";

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-emerald-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <span className="text-xs font-black text-emerald-400">FR</span>
          </div>
          <span className="text-sm font-bold tracking-widest">FREE ROBOT</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-20 px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1)_0%,transparent_60%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-tight">
              Mobile EA
              <br />
              <span className="text-emerald-400">Trading Automation</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-xl mb-8 leading-relaxed mx-auto lg:mx-0">
              Run your Expert Advisors on your phone. Free tools, zero latency,
              24/7 uptime. No VPS needed — trade from anywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="https://free-app-zw10.onrender.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group px-8 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-sm tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Now
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
              <Link
                href="/register"
                className="px-8 py-4 rounded-2xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:border-emerald-400/40 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                <Users size={18} />
                Become a Hoster
              </Link>
            </div>
            <p className="text-zinc-500 text-sm mt-6">
              <strong className="text-zinc-300">100% EA execution guarantee</strong>{" "}
              &bull; 4.8/5 from 337+ reviews
            </p>
          </div>
          <div className="flex justify-center">
            <div className="relative w-72 sm:w-80 aspect-[9/16] rounded-3xl border-2 border-emerald-400/30 bg-zinc-950 overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-emerald-500/5" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Smartphone size={32} className="text-emerald-400" />
                </div>
                <span className="text-emerald-400 font-bold text-lg">
                  Free Robot
                </span>
                <span className="text-zinc-500 text-xs text-center">
                  Your mobile trading terminal
                </span>
                <div className="flex gap-3 mt-2">
                  <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                    MT4
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                    MT5
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                    24/7
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "Low Latency",
      desc: "Execute trades with minimal delay, as low as 1ms, for precise market entry.",
    },
    {
      icon: ShieldCheck,
      title: "Secure & Encrypted",
      desc: "Advanced cybersecurity protects your trading data from threats.",
    },
    {
      icon: Clock,
      title: "24/7 Uptime",
      desc: "Keep your EAs running continuously with our reliable infrastructure.",
    },
  ];
  return (
    <section className="py-20 px-6 bg-zinc-950/50">
      <div className="max-w-5xl mx-auto">
        <p className="text-emerald-400 text-xs font-bold tracking-[0.3em] text-center mb-3">
          WHY CHOOSE FREE ROBOT
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-14">
          Built for Serious Traders
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <f.icon size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HappyTradersSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <Trophy size={28} className="text-amber-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          Years of Happy Traders
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Since our launch, Free Robot has empowered thousands of traders with
          reliable mobile automation. Trusted by the trading community and
          recognized for innovation and commitment to excellence.
        </p>
      </div>
    </section>
  );
}

function PlatformFreezeSection() {
  return (
    <section className="py-20 px-6 bg-zinc-950/50">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
          <Newspaper size={28} className="text-rose-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          No More Freezes on News
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          High-impact news like non-farm payroll reports can freeze your trading
          platform, costing you profits. Free Robot reserves a resource buffer to
          prevent freezes, ensuring your EAs stay active during volatile market
          conditions.
        </p>
      </div>
    </section>
  );
}

function CybersecuritySection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-cyan-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          Cutting-Edge Cybersecurity
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Real-time monitoring and anti-DDoS solutions protect your mobile EA
          hosting from volumetric and protocol-based attacks, keeping your
          trading data secure around the clock.
        </p>
      </div>
    </section>
  );
}

function SupportSection() {
  return (
    <section className="py-20 px-6 bg-zinc-950/50">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
          <Headphones size={28} className="text-violet-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          We&apos;re Here For You 24/7
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Our dedicated support team is available around the clock to assist with
          any issues. Get help setting up your EAs, troubleshooting, or
          optimizing your trading workflow.
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { num: "1", title: "Download Free Robot", desc: "Get the app on your Android or iOS device." },
    { num: "2", title: "Get Your License Key", desc: "Register and receive your free access key." },
    { num: "3", title: "Connect & Auto-Trade", desc: "Link your MT4/MT5 account and start trading." },
  ];
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-emerald-400 text-xs font-bold tracking-[0.3em] text-center mb-3">
          GET STARTED
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-4">
          How to Setup Your Mobile Bot
        </h2>
        <p className="text-zinc-500 text-center max-w-xl mx-auto mb-14">
          Your personal mobile VPS — run Expert Advisors 24/7 right from your
          phone, no desktop VPS needed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div
              key={s.num}
              className="relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 text-center hover:border-emerald-500/30 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-black font-black text-lg flex items-center justify-center mx-auto mb-5">
                {s.num}
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-10">
          {["Accurate Execution", "Ultra Low 1ms Latency", "MT4/MT5 Supported", "Unlimited Access"].map((f) => (
            <span
              key={f}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-semibold"
            >
              <CheckCircle size={14} className="text-emerald-400" />
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorldwideSection() {
  return (
    <section className="py-20 px-6 bg-zinc-950/50">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <Globe size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          Active Worldwide
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Connected across 900+ global points, ensuring low-latency trading
          worldwide. No matter where you are, Free Robot keeps you connected.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
          {[
            { label: "Countries", value: "50+" },
            { label: "Traders", value: "5K+" },
            { label: "Uptime", value: "99.9%" },
            { label: "Latency", value: "<1ms" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-black text-emerald-400">
                {s.value}
              </div>
              <div className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      q: "How does a mobile trading bot work?",
      a: "Free Robot converts your Expert Advisors into mobile-compatible bots. Our infrastructure runs them 24/7 on cloud servers accessible from your phone — no desktop VPS needed.",
    },
    {
      q: "Is Free Robot actually free?",
      a: "Yes. The core platform is completely free. Download the app, get your license key, and start trading with zero upfront cost.",
    },
    {
      q: "Which platforms are supported?",
      a: "Free Robot supports both MetaTrader 4 and MetaTrader 5. Connect any MT4/MT5 broker account and run your EAs seamlessly.",
    },
    {
      q: "Do I need a VPS?",
      a: "No. Free Robot replaces the need for a traditional VPS. Your phone acts as the control panel while our servers handle the execution 24/7.",
    },
  ];
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">
          Have Some Questions?
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none text-sm font-bold hover:text-emerald-400 transition">
                {faq.q}
                <ChevronDown
                  size={18}
                  className="text-zinc-500 group-open:rotate-180 transition-transform shrink-0 ml-4"
                />
              </summary>
              <div className="px-6 pb-5 text-zinc-400 text-sm leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function HostCTASection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wider mb-6">
              AFFILIATE PROGRAM
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Earn With <span className="text-emerald-400">Free Robot</span>
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
              Refer traders to our platform and earn commissions on every
              subscription. Track your referrals, monitor earnings, and grow your
              network.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {["Up to 50% Commission", "Crypto Payouts", "Real-Time Dashboard"].map((p) => (
                <span
                  key={p}
                  className="flex items-center gap-2 text-xs text-zinc-300 font-semibold"
                >
                  <CheckCircle size={14} className="text-emerald-400" />
                  {p}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-sm tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              >
                Become a Hoster
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:border-emerald-400/40 hover:text-emerald-400 transition-all"
              >
                Distributor Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DownloadCTA() {
  return (
    <section className="py-20 px-6 border-t border-zinc-900">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-emerald-400 text-xs font-bold tracking-[0.3em] mb-3">
          GET THE APP
        </p>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">
          Start Trading Today
        </h2>
        <p className="text-zinc-500 max-w-md mx-auto mb-8">
          Download Free Robot and access all tools instantly. No credit card, no
          trial &mdash; free forever.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://free-app-zw10.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-sm tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)]"
          >
            <Download size={18} />
            Download Android
          </a>
          <a
            href="https://free-app-zw10.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:border-emerald-400/40 hover:text-emerald-400 transition-all"
          >
            <MonitorSmartphone size={18} />
            Get iOS / Web
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 px-6 border-t border-zinc-900">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center">
            <span className="text-[8px] font-black text-zinc-500">FR</span>
          </div>
          <span className="text-xs text-zinc-600 tracking-wider font-semibold">
            FREE ROBOT
          </span>
        </div>
        <p className="text-xs text-zinc-700">
          &copy; {new Date().getFullYear()} Free Robot. All Rights Reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-xs text-zinc-600 hover:text-white transition"
          >
            Distributor Login
          </Link>
          <Link
            href="/register"
            className="text-xs text-zinc-600 hover:text-white transition"
          >
            Become a Hoster
          </Link>
          <a
            href="https://free-app-zw10.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-white transition"
          >
            Download App
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <NavBar />
      <HeroSection />
      <FeaturesSection />
      <HappyTradersSection />
      <PlatformFreezeSection />
      <CybersecuritySection />
      <SupportSection />
      <HowItWorksSection />
      <WorldwideSection />
      <FAQSection />
      <HostCTASection />
      <DownloadCTA />
      <Footer />
    </div>
  );
}
