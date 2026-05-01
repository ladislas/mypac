import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type SlidedeckSlide = {
	title: string;
	eyebrow?: string;
	body: string;
};

export type SlidedeckLocation = {
	dir: string;
	file: string;
};

export function getSessionSlidedeckDir(agentDir: string, sessionId: string): string {
	return path.join(agentDir, "slidedecks", sessionId);
}

export function isSessionSlidedeckFile(filePath: string, sessionDeckDir: string): boolean {
	const resolvedFile = path.resolve(filePath);
	const resolvedDir = path.resolve(sessionDeckDir);
	const relative = path.relative(resolvedDir, resolvedFile);

	return (
		path.extname(resolvedFile).toLowerCase() === ".html" &&
		relative !== "" &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}

const DECK_CSS = String.raw`
:root {
	--bg: #0b1020;
	--panel: #121a31;
	--panel-2: #182341;
	--text: #e8ecf8;
	--muted: #9fb0d9;
	--accent: #8ab4ff;
	--accent-2: #6ee7b7;
	--warn: #fbbf24;
	--danger: #f87171;
	--border: rgba(255, 255, 255, 0.1);
	--shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

* {
	box-sizing: border-box;
}

html,
body {
	margin: 0;
	height: 100%;
	background: radial-gradient(circle at top, #182341 0%, var(--bg) 55%);
	color: var(--text);
	font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
	overflow: hidden;
}

.deck {
	height: 100%;
	position: relative;
}

.slide {
	position: absolute;
	inset: 0;
	padding: 56px 72px 80px;
	display: none;
	gap: 28px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
}

.slide.active {
	display: flex;
	flex-direction: column;
}

.eyebrow {
	color: var(--accent-2);
	text-transform: uppercase;
	letter-spacing: 0.12em;
	font-size: 12px;
	font-weight: 700;
}

h1,
h2,
h3 {
	margin: 0;
	line-height: 1.05;
}

h1,
.slide-title {
	font-size: 54px;
}

h2 {
	font-size: 40px;
}

h3 {
	font-size: 26px;
	color: var(--accent);
}

p,
li {
	font-size: 24px;
	line-height: 1.45;
	color: var(--text);
}

a,
a:visited {
	color: var(--accent);
	text-decoration-color: rgba(138, 180, 255, 0.6);
	text-underline-offset: 0.14em;
}

a:hover,
a:focus-visible {
	color: var(--accent-2);
	text-decoration-color: currentColor;
}

.muted,
.muted p,
p.muted {
	color: var(--muted);
}

ul,
ol {
	margin: 0;
	padding-left: 28px;
}

.grid,
.grid-2,
.card-grid,
.kpi-row {
	display: grid;
	gap: 20px;
}

.grid.two,
.grid-2 {
	grid-template-columns: 1fr 1fr;
}

.grid.three {
	grid-template-columns: repeat(3, 1fr);
}

.card-grid {
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 18px;
}

.kpi-row {
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 18px;
}

.card,
.callout {
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
	border: 1px solid var(--border);
	border-radius: 18px;
	padding: 20px 22px;
	box-shadow: var(--shadow);
}

.callout {
	border-left: 4px solid var(--accent-2);
}

.card h3,
.callout h3 {
	margin-bottom: 10px;
}

.big-list li {
	margin: 10px 0;
	font-size: 28px;
}

.small li,
.small p,
.small td,
.small th {
	font-size: 18px;
}

.tiny li,
.tiny p,
.tiny td,
.tiny th {
	font-size: 16px;
}

.kpi,
.kpi-value {
	font-size: 44px;
	font-weight: 800;
	color: var(--accent);
	margin-bottom: 8px;
}

.kpi-value {
	display: block;
	line-height: 1;
}

.stat {
	font-size: 44px;
	font-weight: 800;
	color: var(--accent);
	display: inline-block;
	line-height: 1;
}

.tag {
	display: inline-block;
	font-size: 16px;
	padding: 6px 10px;
	border-radius: 999px;
	background: rgba(138, 180, 255, 0.15);
	border: 1px solid rgba(138, 180, 255, 0.25);
	color: var(--accent);
	margin-right: 8px;
	margin-bottom: 8px;
}

.badge {
	display: inline-flex;
	align-items: center;
	white-space: nowrap;
	font-size: 14px;
	font-weight: 600;
	padding: 4px 12px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid var(--border);
	color: var(--text);
}

.badge.done {
	background: rgba(110, 231, 183, 0.12);
	border-color: rgba(110, 231, 183, 0.3);
	color: var(--accent-2);
}

.badge.in-progress {
	background: rgba(138, 180, 255, 0.12);
	border-color: rgba(138, 180, 255, 0.3);
	color: var(--accent);
}

.badge.blocked {
	background: rgba(248, 113, 113, 0.12);
	border-color: rgba(248, 113, 113, 0.3);
	color: var(--danger);
}

table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	background: rgba(255, 255, 255, 0.02);
	border-radius: 14px;
	overflow: hidden;
}

th,
td {
	border: 1px solid var(--border);
	padding: 12px 14px;
	text-align: left;
	vertical-align: top;
}

th {
	background: rgba(255, 255, 255, 0.05);
	color: var(--accent-2);
	font-weight: 700;
}

.footer {
	position: absolute;
	left: 72px;
	right: 72px;
	bottom: 24px;
	display: flex;
	align-items: center;
	gap: 16px;
	color: var(--muted);
	font-size: 16px;
}

.progress {
	height: 6px;
	flex: 1;
	background: rgba(255, 255, 255, 0.08);
	border-radius: 999px;
	overflow: hidden;
}

.progress > div {
	height: 100%;
	background: linear-gradient(90deg, var(--accent), var(--accent-2));
	width: 0%;
}

.nav {
	display: flex;
	gap: 10px;
	flex-shrink: 0;
}

button {
	appearance: none;
	border: 1px solid var(--border);
	background: var(--panel);
	color: var(--text);
	border-radius: 999px;
	padding: 10px 16px;
	font-size: 16px;
	cursor: pointer;
	box-shadow: var(--shadow);
}

button:hover:not(:disabled) {
	background: var(--panel-2);
}

button:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.split {
	display: grid;
	grid-template-columns: 1.1fr 0.9fr;
	gap: 24px;
	align-items: stretch;
}

.center {
	justify-content: center;
}

.hero {
	display: flex;
	flex-direction: column;
	gap: 22px;
	max-width: 1100px;
}

.section {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
	text-align: center;
	gap: 16px;
}

.section h2 {
	font-size: 64px;
}

.section p {
	font-size: 22px;
	color: var(--muted);
}

.statement {
	display: flex;
	flex-direction: column;
	justify-content: center;
	flex: 1;
	max-width: 900px;
}

.statement p {
	font-size: 36px;
	line-height: 1.3;
	font-weight: 600;
}

.quote {
	border-left: 4px solid var(--accent);
	padding: 20px 28px;
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0 16px 16px 0;
}

.quote p {
	font-size: 28px;
	line-height: 1.4;
	font-style: italic;
}

.quote .attribution {
	margin-top: 12px;
	font-size: 18px;
	color: var(--muted);
	font-style: normal;
}

.steps {
	counter-reset: step;
	list-style: none;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.steps li {
	display: flex;
	align-items: flex-start;
	flex-wrap: wrap;
	gap: 4px 16px;
	counter-increment: step;
}

.steps li::before {
	content: counter(step);
	font-size: 18px;
	font-weight: 800;
	color: var(--accent);
	background: rgba(138, 180, 255, 0.12);
	border: 1px solid rgba(138, 180, 255, 0.25);
	border-radius: 50%;
	min-width: 36px;
	height: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	margin-top: 2px;
}

.steps li strong {
	flex: 1;
	min-width: 0;
	line-height: 36px;
}

.steps li p {
	flex-basis: 100%;
	padding-left: 52px;
	margin: 0;
}

.ascii {
	white-space: pre;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 18px;
	line-height: 1.3;
	color: var(--muted);
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--border);
	border-radius: 16px;
	padding: 18px;
}

.accent {
	color: var(--accent);
}

.good {
	color: var(--accent-2);
}

.warn {
	color: var(--warn);
}

.bad {
	color: var(--danger);
}

.slide code {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 0.88em;
	padding: 0.12em 0.35em;
	border-radius: 0.35em;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid var(--border);
}

.slide pre code,
.ascii code {
	padding: 0;
	border: 0;
	background: transparent;
}

@media (max-width: 1100px) {
	.slide {
		padding: 36px 36px 72px;
	}

	h1,
	.slide-title {
		font-size: 42px;
	}

	h2 {
		font-size: 32px;
	}

	p,
	li {
		font-size: 20px;
	}

	.grid.two,
	.grid.three,
	.grid-2,
	.card-grid,
	.kpi-row,
	.split {
		grid-template-columns: 1fr;
	}

	.footer {
		left: 36px;
		right: 36px;
	}
}

@media (max-width: 860px) {
	html,
	body {
		overflow: auto;
	}

	.deck {
		display: flex;
		flex-direction: column;
		height: auto;
		min-height: 100vh;
	}

	.slide {
		position: static;
		display: none;
		flex: 1;
		padding: 24px 36px 24px;
	}

	.slide.active {
		display: flex;
	}

	.footer {
		position: static;
		left: auto;
		right: auto;
		bottom: auto;
		padding: 16px 36px 24px;
	}
}

@media print {
	html,
	body {
		overflow: visible;
		height: auto;
	}

	.deck {
		height: auto;
	}

	.slide {
		position: relative;
		display: flex !important;
		min-height: 100vh;
		page-break-after: always;
	}

	.slide:last-child {
		page-break-after: auto;
	}

	.footer {
		display: none;
	}
}
`;

const DECK_JS = String.raw`
const deck = document.querySelector(".deck");
const slides = Array.from(document.querySelectorAll(".slide"));
const progressBars = Array.from(document.querySelectorAll(".progress > div"));
let index = Math.max(0, slides.findIndex((slide) => slide.id === window.location.hash.slice(1)));

function render() {
	slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
	const pct = ((index + 1) / slides.length) * 100;
	progressBars.forEach((bar) => {
		bar.style.width = pct + "%";
	});
	const slideCounter = document.getElementById("slide-counter");
	if (slideCounter) slideCounter.textContent = "Slide " + (index + 1);
	const current = slides[index];
	if (current && window.location.hash !== "#" + current.id) {
		history.replaceState(null, "", "#" + current.id);
	}
	const deckTitle = deck?.getAttribute("data-title") || document.title;
	document.title = "(" + (index + 1) + "/" + slides.length + ") " + deckTitle;
	document.getElementById("prev")?.toggleAttribute("disabled", index === 0);
	document.getElementById("next")?.toggleAttribute("disabled", index === slides.length - 1);
}

function next() {
	index = Math.min(index + 1, slides.length - 1);
	render();
}

function prev() {
	index = Math.max(index - 1, 0);
	render();
}

document.getElementById("next")?.addEventListener("click", next);
document.getElementById("prev")?.addEventListener("click", prev);
window.addEventListener("hashchange", () => {
	const hashIndex = slides.findIndex((slide) => slide.id === window.location.hash.slice(1));
	if (hashIndex >= 0) {
		index = hashIndex;
		render();
	}
});
window.addEventListener("keydown", (event) => {
	if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
		event.preventDefault();
		next();
	}
	if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) {
		event.preventDefault();
		prev();
	}
	if (event.key === "Home") {
		index = 0;
		render();
	}
	if (event.key === "End") {
		index = slides.length - 1;
		render();
	}
});

render();
`;

export function buildSlidedeckPrompt(
	input: string,
	options: { sessionDeckDir?: string; lastDeckPath?: string } = {},
): string {
	const trimmed = input.trim();
	const source = trimmed || "Use the current conversation context.";
	const lastDeckPath = options.lastDeckPath ? `- Most recently returned deck in this session: ${options.lastDeckPath}` : undefined;
	const sessionDeckDir = options.sessionDeckDir ? `- Current session deck directory: ${options.sessionDeckDir}` : undefined;

	return [
		"Create a presentation-style HTML slidedeck for this work.",
		"",
		"## Tool usage",
		"- Use the save_slidedeck tool exactly once with the final deck.",
		"- Do not emit a full <html> document in chat.",
		"- Do not use write or edit to create deck files in the workspace.",
		"- The tool provides the outer HTML, CSS, and navigation — only supply slide content.",
		"- Provide a concise deck title and 4–10 focused slides unless the material clearly needs a different count.",
		"- Each slide needs a short `title` and an HTML `body` fragment.",
		"- `title` and `eyebrow` are plain text — do not use HTML entities (write `&` not `&amp;`). The tool handles escaping.",
		"- Optionally set `eyebrow` on each slide for a category label (e.g. 'Problem', 'Solution', 'Timeline'). Omit to use the default 'Slide N'.",
		"- If refining a previously saved deck, prefer reading the latest deck, copying it to a new `-v2`, `-v3`, etc. HTML file, and making focused edits to that copy instead of regenerating the whole deck.",
		"- Preserve untouched slides verbatim when iterating on an existing deck.",
		"- In-place edits are acceptable only for tiny fixes such as typos.",
		"- If the latest deck path is not obvious, use the most recently returned deck path in this session; otherwise inspect the current session deck directory and pick the highest `-vN` revision, else the latest timestamped base deck.",
		"- Optimize for clarity, scanability, and discussion/review use.",
		"- If the request is too ambiguous, ask at most one brief clarifying question before calling the tool.",
		...(lastDeckPath ? [lastDeckPath] : []),
		...(sessionDeckDir ? [sessionDeckDir] : []),
		"",
		"## CSS layout cheat sheet",
		"",
		"Use these patterns exactly — class names matter and composites must be nested correctly.",
		"",
		"**Cover / hero slide**",
		'<div class="hero"><p class="muted">Subtitle or date</p></div>',
		"",
		"**Section divider** (chapter break — centered big heading)",
		'<div class="section"><p>Optional subtitle</p></div>',
		"",
		"**Two-column split** (left + right panels)",
		'<div class="split"><div><h3>Left</h3><p>…</p></div><div><h3>Right</h3><p>…</p></div></div>',
		"",
		"**Two-column grid** (use `grid two`, not `two` alone)",
		'<div class="grid two"><div>…</div><div>…</div></div>',
		"",
		"**Three-column grid** (use `grid three`, not `three` alone)",
		'<div class="grid three"><div>…</div><div>…</div><div>…</div></div>',
		"",
		"**Card grid** (responsive cards — `card-grid` wraps `card` divs)",
		'<div class="card-grid"><div class="card"><h3>Title</h3><p>…</p></div></div>',
		"",
		"**Callout** (highlighted note with accent left border)",
		'<div class="callout"><h3>Note</h3><p>…</p></div>',
		"",
		"**Metric row** (`kpi-row` container → bare divs → `kpi-value` span for the number)",
		'<div class="kpi-row"><div><span class="kpi-value">42</span><p>label</p></div></div>',
		"",
		"**Stat / accent label** (step numbers, status words — use `.stat`, not `.kpi`)",
		'<div class="stat good">✓</div>  <!-- or: <div class="stat">1</div> -->',
		"",
		"**Statement** (one big sentence centered on the slide)",
		'<div class="statement"><p>The one thing that matters most.</p></div>',
		"",
		"**Quote** (blockquote with attribution)",
		'<div class="quote"><p>The quote text here.</p><p class="attribution">— Author, Source</p></div>',
		"",
		"**Numbered steps** (auto-counter list — apply `steps` class to `<ol>`)",
		'<ol class="steps"><li><strong>Step name</strong><p>Description</p></li></ol>',
		"",
		"**Status badges** (inline pill — `.done`, `.in-progress`, or `.blocked` modifier)",
		'<span class="badge done">Done</span>  <span class="badge in-progress">In progress</span>  <span class="badge blocked">Blocked</span>',
		"",
		"**Tag row** (inline keyword labels)",
		'<div><span class="tag">TypeScript</span><span class="tag">CSS</span></div>',
		"",
		"**ASCII / code diagram**",
		'<pre class="ascii">diagram here</pre>',
		"",
		"**Table** (use `small` or `tiny` class on the slide body for denser text)",
		"<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>",
		"",
		"## Utility classes",
		"- `muted` — dimmed text color",
		"- `accent` — blue accent color",
		"- `good` — green (success/positive)",
		"- `warn` — yellow (caution)",
		"- `bad` — red (error/negative)",
		"- `small` / `tiny` — reduce font size on lists, tables, paragraphs",
		"- `big-list` — larger font on list items",
		"- `center` — center-justify flex content",
		"",
		"After the tool succeeds, reply with:",
		"1. The saved file path",
		"2. A Markdown link in the exact format `[slidedeck](<saved file path>)`",
		"3. The deck title",
		"4. A short summary of what the deck covers",
		"",
		"Source material:",
		source,
	].join("\n");
}

export function getSlidedeckFileUrl(filePath: string): string {
	return pathToFileURL(filePath).toString();
}

export function getSlidedeckMarkdownLink(filePath: string, label: string = "Open slidedeck"): string {
	return `[${label}](${getSlidedeckFileUrl(filePath)})`;
}

export function resolveAgentDir(env: NodeJS.ProcessEnv = process.env, homeDir: string = os.homedir()): string {
	const envCandidates = ["PI_CODING_AGENT_DIR", "TAU_CODING_AGENT_DIR"];
	let agentDir: string | undefined;

	for (const key of envCandidates) {
		if (env[key]) {
			agentDir = env[key];
			break;
		}
	}

	if (!agentDir) {
		for (const [key, value] of Object.entries(env)) {
			if (key.endsWith("_CODING_AGENT_DIR") && value) {
				agentDir = value;
				break;
			}
		}
	}

	if (!agentDir) {
		return path.join(homeDir, ".pi", "agent");
	}

	if (agentDir === "~") {
		return homeDir;
	}
	if (agentDir.startsWith("~/")) {
		return path.join(homeDir, agentDir.slice(2));
	}

	return path.resolve(agentDir);
}

export function getSlidedeckLocation(options: {
	agentDir: string;
	sessionId: string;
	title: string;
	timestamp?: Date;
}): SlidedeckLocation {
	const slug = slugify(options.title) || "deck";
	const stamp = formatTimestamp(options.timestamp ?? new Date());
	const dir = getSessionSlidedeckDir(options.agentDir, options.sessionId);
	return {
		dir,
		file: path.join(dir, `${stamp}-${slug}.html`),
	};
}

export function renderSlidedeckHtml(options: {
	title: string;
	slides: SlidedeckSlide[];
	generatedAt?: Date;
}): string {
	const slides = options.slides.map((slide, index) => renderSlide(slide, index, options.slides.length)).join("\n\n");
	const escapedTitle = escapeHtml(options.title);

	return [
		"<!doctype html>",
		"<html lang=\"en\">",
		"<head>",
		"<meta charset=\"utf-8\" />",
		"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />",
		`<title>${escapedTitle}</title>`,
		`<style>${DECK_CSS}</style>`,
		"</head>",
		"<body>",
		`<div class=\"deck\" data-title=\"${escapedTitle}\">`,
		slides,
		"<div class=\"footer\">",
		"<div id=\"slide-counter\">Slide 1</div>",
		"<div class=\"progress\"><div></div></div>",
		"<div class=\"nav\">",
		"<button id=\"prev\">← Prev</button>",
		"<button id=\"next\">Next →</button>",
		"</div>",
		"</div>",
		"</div>",
		`<script>${DECK_JS}</script>`,
		"</body>",
		"</html>",
	].join("\n");
}

function renderSlide(slide: SlidedeckSlide, index: number, total: number): string {
	const headingTag = index === 0 ? "h1" : "h2";
	const eyebrow = slide.eyebrow ?? `Slide ${index + 1}`;
	return [
		`<section class=\"slide${index === 0 ? " active" : ""}\" id=\"slide-${index + 1}\">`,
		`<div class=\"eyebrow\">${escapeHtml(eyebrow)}</div>`,
		`<${headingTag} class=\"slide-title\">${escapeHtml(slide.title)}</${headingTag}>`,
		slide.body,
		"</section>",
	].join("");
}

function formatTimestamp(value: Date): string {
	const year = value.getUTCFullYear();
	const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
	const day = `${value.getUTCDate()}`.padStart(2, "0");
	const hours = `${value.getUTCHours()}`.padStart(2, "0");
	const minutes = `${value.getUTCMinutes()}`.padStart(2, "0");
	const seconds = `${value.getUTCSeconds()}`.padStart(2, "0");
	return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
