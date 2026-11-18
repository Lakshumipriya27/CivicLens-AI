import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-ink-100 py-12">
      <p className="text-[12px] font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>
      <h2 className="mt-1 text-[22px] font-semibold">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] text-ink-700">{children}</div>
    </section>
  );
}

export default function HowItWorks() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-[32px] font-semibold">How CivicLens AI works</h1>
      <p className="mt-3 text-[16px] text-ink-600">
        A plain description of what is automated, what is rule-based, and where a human always makes the call.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2 text-[13px]">
        {[['#analysis', 'Image analysis'], ['#duplicates', 'Duplicate detection'], ['#incidents', 'Incidents'],
          ['#priority', 'Priority score'], ['#lifecycle', 'Lifecycle'], ['#limits', 'Limitations']].map(([h, l]) => (
          <a key={h} href={h} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-700 hover:bg-ink-50">{l}</a>
        ))}
      </nav>

      <Section id="analysis" eyebrow="AI-powered" title="1. Image analysis">
        <p>
          When a citizen uploads a photo, the backend sends it to the configured vision model (Google Gemini by default).
          The model returns a structured suggestion: likely category, a description of visible evidence, a suggested
          severity, a self-reported confidence and any visible safety concern. The response is validated before it is stored.
        </p>
        <p>
          The citizen sees the suggestion and can change the category, severity and description before submitting.
          Uploaded photos are re-encoded on the server, which strips embedded metadata such as GPS tags.
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
          Without an API key the platform runs in <strong>demonstration mode</strong>: analysis is simulated with simple
          image statistics (brightness, colour, edge density) plus keywords, and is labelled as simulated everywhere it appears.
        </p>
      </Section>

      <Section id="duplicates" eyebrow="Rule-based + image hashing" title="2. Duplicate detection">
        <p>Each new report is compared with recent reports within a configurable radius (default 200 m, 30 days) using five signals:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Proximity</strong> — great-circle distance between the two locations.</li>
          <li><strong>Category</strong> — identical (1.0), related such as garbage overflow vs dumping (partial), or unrelated.</li>
          <li><strong>Text</strong> — cosine similarity of the description wording.</li>
          <li><strong>Time</strong> — reports closer in time score higher.</li>
          <li><strong>Image</strong> — perceptual hash (dHash) similarity of the photos.</li>
        </ul>
        <p>
          Pairs above the threshold (default 0.55) become <em>suggestions</em> with a plain-language explanation. A suggestion is
          not proof: reports are only linked after an administrator confirms. Every citizen keeps their own report record.
        </p>
      </Section>

      <Section id="incidents" eyebrow="Human-confirmed" title="3. Incident intelligence">
        <p>
          An incident is one real-world problem with one or more linked reports. Confirming a duplicate, or verifying a single
          report, creates or extends an incident. Its location is the centre of its reports, its severity is the highest among
          them, and every status change is recorded and visible to the citizens whose reports are linked.
        </p>
      </Section>

      <Section id="priority" eyebrow="Transparent heuristic" title="4. Priority score">
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-[14px]">P = 0.35·S + 0.25·R + 0.20·V + 0.20·W</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>S, severity</strong> — highest linked severity: low 25, medium 55, high 80, critical 95.</li>
          <li><strong>R, corroborating reports</strong> — (reports − 1) × 25, capped at 100.</li>
          <li><strong>V, public exposure</strong> — category baseline plus context words such as school, hospital, bus stop. Administrators can override it.</li>
          <li><strong>W, waiting time</strong> — rises linearly to 100 after 30 days; frozen when resolved.</li>
        </ul>
        <p>Levels: Low 0–29 · Moderate 30–49 · High 50–74 · Critical 75–100. Example: S 80, R 70, V 90, W 50 gives 73.5 (High).</p>
        <p className="text-[14px] text-ink-500">
          This is the platform&apos;s initial, configurable prioritisation heuristic. It is not an officially validated government standard.
          Weights are set in the backend configuration.
        </p>
      </Section>

      <Section id="lifecycle" eyebrow="Tracked" title="5. Resolution lifecycle">
        <p>Submitted → Under Review → Acknowledged → In Progress → Resolved, with Reopened if needed. Resolving requires a note or evidence photo.</p>
      </Section>

      <Section id="limits" eyebrow="Honest limits" title="6. Limitations">
        <ul className="list-disc space-y-1 pl-5">
          <li>Vision models can misclassify photos; their confidence values are self-reported, not calibrated.</li>
          <li>Perceptual hashing only catches visually similar photos, not the same pothole from a different angle.</li>
          <li>Exposure is estimated from category and keywords, not from real footfall or road-network data.</li>
        </ul>
      </Section>

      <div className="py-10">
        <Link to="/register" className="inline-flex h-10 items-center rounded-md bg-brand-700 px-5 font-medium text-white hover:bg-brand-800">Create a citizen account</Link>
      </div>
    </div>
  );
}
