import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full border-2 border-cyan-500/60 flex items-center justify-center mb-6"
           style={{ boxShadow: '0 0 20px rgba(0,191,255,0.3), 0 0 40px rgba(0,191,255,0.15)' }}>
        <span className="text-3xl font-black text-cyan-400">FR</span>
      </div>
      <h1 className="text-3xl font-black tracking-wider mb-2">FREE ROBOT</h1>
      <p className="text-zinc-500 text-sm mb-10">Distributor Dashboard</p>
      <div className="flex gap-4">
        <Link href="/login"
          className="px-8 py-3 rounded-xl bg-cyan-500 text-black font-bold text-sm tracking-wide hover:bg-cyan-400 transition"
          style={{ boxShadow: '0 0 12px rgba(0,191,255,0.5)' }}>
          Sign In
        </Link>
        <Link href="/register"
          className="px-8 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:border-cyan-500/40 hover:text-white transition">
          Register
        </Link>
      </div>
    </div>
  );
}
