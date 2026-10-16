import { ArrowRight, MessageSquare, Mic, MonitorUp, Video, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router";
import { gsap } from "@/lib/animation/gsap";
import { useScrollScene } from "@/lib/animation/scroll-scene";

const NOT_KEPT: { icon: LucideIcon; label: string }[] = [
  { icon: Mic, label: "Áudio" },
  { icon: Video, label: "Vídeo" },
  { icon: MonitorUp, label: "Telas" },
  { icon: MessageSquare, label: "Chat da sala" },
];

/** When, in the scene's timeline, the line strikes the button (and the clock stops). */
const STRIKE_AT = 0.5;

/** "00:07": minutes and seconds, like a recorder. */
function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Privacy as one picture: a record button (a microphone, recording), struck through. Pinned, the button starts lit, a
 * line crosses it out and it goes dark, then the promise and what it covers come in. Without
 * motion the button is already struck and everything is there.
 */
export function PrivacyScene() {
  const scope = useRef<HTMLElement>(null);

  useScrollScene(scope, (section) => {
    const select = gsap.utils.selector(section);
    const clock = select("[data-rec-time]")[0];
    const timeline = gsap
      .timeline({
        defaults: { ease: "power2.inOut", duration: 0.5 },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=160%",
          pin: select("[data-privacy-frame]")[0],
          scrub: 0.5,
          anticipatePin: 1,
        },
      })
      .set(select("[data-rec]"), { opacity: 1, filter: "grayscale(0)" })
      .set(select("[data-rec-strike]"), { scaleX: 0 })
      .set(select("[data-privacy-in]"), { opacity: 0, y: 24 })
      .to(select("[data-rec-dot]"), { scale: 1.25, duration: 0.25, repeat: 1, yoyo: true }, 0)
      .to(select("[data-rec-strike]"), { scaleX: 1, ease: "power3.out" }, STRIKE_AT)
      .to(select("[data-rec]"), { opacity: 0.4, filter: "grayscale(1)" }, 0.75)
      .to(select("[data-privacy-in]"), { opacity: 1, y: 0, stagger: 0.15 }, 1.05)
      .to({}, { duration: 0.4 });

    // The clock runs in real time while the scene is on screen and the line has not struck
    // the button yet; once struck it stops where it was, and scrolling back resumes it.
    let seconds = 0;
    const tick = window.setInterval(() => {
      if (!clock || !timeline.scrollTrigger?.isActive || timeline.time() >= STRIKE_AT) return;
      seconds += 1;
      clock.textContent = formatClock(seconds);
    }, 1000);
    return () => {
      window.clearInterval(tick);
      if (clock) clock.textContent = formatClock(0);
    };
  });

  return (
    <section ref={scope} aria-labelledby="privacy-title" className="w-full">
      <div
        data-privacy-frame
        className="page-column flex min-h-svh flex-col items-center justify-center gap-8 py-24 text-center"
      >
        <div aria-hidden="true" className="relative">
          <span
            data-rec
            className="inline-flex items-center gap-4 rounded-full border border-line-strong px-8 py-5 opacity-40 grayscale sm:gap-5 sm:px-10 sm:py-6"
          >
            <span
              data-rec-dot
              className="grid size-10 place-items-center rounded-full bg-[#ff453a] text-white sm:size-12"
            >
              <Mic className="size-5 sm:size-6" strokeWidth={2.4} />
            </span>
            <span className="text-3xl font-semibold tracking-[0.12em] sm:text-4xl">REC</span>
            <span data-rec-time className="text-xl text-ink-muted tabular-nums sm:text-2xl">
              {formatClock(0)}
            </span>
          </span>
          {/* Rotated around its middle; the line inside draws from left to right. */}
          <span className="absolute inset-x-[-6%] top-1/2 -translate-y-1/2 -rotate-[10deg]">
            <span data-rec-strike className="block h-1 origin-left rounded-full bg-ink sm:h-1.5" />
          </span>
        </div>

        <h2
          id="privacy-title"
          data-privacy-in
          className="text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance"
        >
          A chamada não fica <span className="text-brand-soft">gravada.</span>
        </h2>

        <p data-privacy-in className="max-w-xl text-lg text-pretty text-ink-muted sm:text-xl">
          Áudio, vídeo, telas e o chat da sala passam ao vivo e somem quando a sala acaba. Você
          baixa ou apaga seus dados, como prevê a LGPD.
        </p>

        <ul
          data-privacy-in
          aria-label="O que passa pela chamada e não é gravado"
          className="flex flex-wrap justify-center gap-2 sm:gap-3"
        >
          {NOT_KEPT.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium sm:text-base"
            >
              <Icon className="size-4 text-brand-soft" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        <Link
          data-privacy-in
          viewTransition
          to="/privacidade"
          className="inline-flex items-center gap-1.5 text-base font-medium text-brand-soft underline-offset-4 hover:underline"
        >
          Leia o aviso de privacidade
          <ArrowRight className="icon-nudge size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
