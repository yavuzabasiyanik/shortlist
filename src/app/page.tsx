import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { Workspace } from "@/components/workspace";
import { liveRankingAvailable } from "@/lib/ranking/provider";

export default function Home() {
  // One boolean for the browser; no configuration reaches the client.
  const liveEnabled = liveRankingAvailable(process.env);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white/80">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-teal-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={24} height={24} />
            <span className="font-semibold tracking-tight text-stone-900">Shortlist</span>
          </Link>
          <a
            href="https://github.com/yavuzabasiyanik/shortlist"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-6 sm:px-6">
        <Workspace liveEnabled={liveEnabled} />
      </main>

      <footer className="border-t border-stone-200">
        <p className="mx-auto w-full max-w-[1280px] px-4 py-5 text-xs text-stone-600 sm:px-6">
          A portfolio project. All sample people and companies are fictional.
        </p>
      </footer>
    </div>
  );
}
