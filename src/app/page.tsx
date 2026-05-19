import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full border-2 border-white/60 flex items-center justify-center mb-6">
        <span className="text-3xl font-black text-white">FR</span>
      </div>
      <h1 className="text-3xl font-black tracking-wider mb-2 text-white">FREE ROBOT</h1>
      <p className="text-zinc-500 text-sm mb-10">Distributor Dashboard</p>
      <div className="flex gap-4">
        <Link href="/login"
          className="px-8 py-3 rounded-xl bg-white text-black font-bold text-sm tracking-wide hover:bg-zinc-200 transition">
          Sign In
        </Link>
        <Link href="/register"
          className="px-8 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:border-white/40 hover:text-white transition">
          Register
        </Link>
      </div>
      <a href="https://free-app-zw10.onrender.com" target="_blank" rel="noopener noreferrer"
        className="mt-10 px-10 py-3 rounded-xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:bg-white hover:text-black transition">
        iOS
      </a>
    </div>
  );
}
