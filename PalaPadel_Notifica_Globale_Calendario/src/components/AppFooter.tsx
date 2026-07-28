export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-[rgba(251,243,222,0.10)] px-4 pb-28 pt-5 xl:pb-6">
      <a
        href="https://www.instagram.com/inlab.communication/"
        target="_blank"
        rel="noreferrer"
        aria-label="Apri InLab Communication su Instagram"
        className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]"
      >
        <img
          src="/inlab-communication.png"
          alt="InLab Communication"
          className="h-20 w-20 shrink-0 rounded-xl border border-[rgba(251,243,222,0.16)] object-cover"
        />
        <div className="text-left">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)]">Web app creata da</p>
          <p className="text-sm font-bold text-[#FBF3DE]">InLab</p>
          <p className="mt-0.5 text-xs font-semibold text-[rgba(251,243,222,0.68)]">Nicola Carpignano</p>
        </div>
      </a>
    </footer>
  );
}
