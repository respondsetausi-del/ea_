import Link from "next/link";
import { ArrowRight, Mail, BarChart3, Layout, Smartphone, Users, Download } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center">
              <span className="text-xs font-black">FR</span>
            </div>
            <span className="text-sm font-bold tracking-widest">FREE ROBOT</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="px-5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition">
              Sign In
            </Link>
            <Link href="/register"
              className="px-5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 transition">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="w-24 h-24 rounded-full border-2 border-emerald-400/50 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
            <span className="text-3xl font-black text-emerald-400">FR</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-5 leading-tight">
            Trade Smarter.<br />
            <span className="text-emerald-400">Execute Faster.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Your all-in-one trading platform. Free tools, free access, real results.
            Join thousands of traders using Free Robot every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
              className="group px-8 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-sm tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2">
              <Download size={18} />
              Download Now
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <Link href="/register"
              className="px-8 py-4 rounded-2xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:border-emerald-400/40 hover:text-emerald-400 transition-all flex items-center justify-center gap-2">
              <Users size={18} />
              Become a Hoster
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-emerald-400 text-xs font-bold tracking-[0.3em] text-center mb-3">WHAT YOU GET</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-4">Everything Free. No Catch.</h2>
          <p className="text-zinc-500 text-center max-w-lg mx-auto mb-14">
            Access powerful trading tools without paying a cent. Built for traders, by traders.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reactivate Email Free */}
            <div className="group relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 hover:border-emerald-500/30 transition-all hover:bg-zinc-950/80">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <Mail size={22} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Reactivate Email Free</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Reactivate your trading account email instantly. No fees, no delays &mdash; get back to trading in seconds.
              </p>
              <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
                Get Started <ArrowRight size={14} />
              </a>
            </div>

            {/* Free Chart Scanner */}
            <div className="group relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 hover:border-emerald-500/30 transition-all hover:bg-zinc-950/80">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <BarChart3 size={22} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Free Chart Scanner</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Scan markets in real-time with advanced chart analysis. Spot opportunities before the crowd.
              </p>
              <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
                Scan Now <ArrowRight size={14} />
              </a>
            </div>

            {/* Free Portal */}
            <div className="group relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 hover:border-emerald-500/30 transition-all hover:bg-zinc-950/80">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <Layout size={22} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Free Portal</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Your personal trading portal. Manage bots, view signals, and track performance all in one place.
              </p>
              <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
                Open Portal <ArrowRight size={14} />
              </a>
            </div>

            {/* Free App Access */}
            <div className="group relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 hover:border-emerald-500/30 transition-all hover:bg-zinc-950/80">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                <Smartphone size={22} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Free App Access</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Download our mobile app and start trading on the go. Available on all devices, completely free.
              </p>
              <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
                Download App <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Become a Hoster CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Users size={26} className="text-emerald-400" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Become a Hoster</h2>
              <p className="text-zinc-400 max-w-md mx-auto mb-8 leading-relaxed">
                Host your own trading bots. White-label the platform, manage users, and build your own trading community.
              </p>
              <Link href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm tracking-wide hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                Start Hosting
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-20 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-emerald-400 text-xs font-bold tracking-[0.3em] mb-3">GET THE APP</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">Start Trading Today</h2>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            Download Free Robot and access all tools instantly. No credit card, no trial &mdash; free forever.
          </p>
          <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-sm tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.4)]">
            <Download size={18} />
            Download Now
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center">
              <span className="text-[8px] font-black text-zinc-500">FR</span>
            </div>
            <span className="text-xs text-zinc-600 tracking-wider font-semibold">FREE ROBOT</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-xs text-zinc-600 hover:text-white transition">Distributor Login</Link>
            <Link href="/register" className="text-xs text-zinc-600 hover:text-white transition">Become a Hoster</Link>
            <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-600 hover:text-white transition">Download App</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
