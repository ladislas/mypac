import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Compile } from "typebox/compile";

const themeSchema = JSON.parse(await readFile(
	new URL("../schemas/theme.schema.json", import.meta.resolve("@earendil-works/pi-coding-agent")),
	"utf8",
));
const themeValidator = Compile(themeSchema);

const THEME_FILES = (await readdir(new URL(".", import.meta.url)))
	.filter((file) => file.endsWith(".json"))
	.sort();
const FULLSCREEN_COLOR_ROLES = ["thinkingMax", "scrollbarThumb", "searchMatchBg", "searchMatchText"];

function relativeLuminance(hex) {
	const channels = hex
		.slice(1)
		.match(/../g)
		.map((channel) => Number.parseInt(channel, 16) / 255)
		.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
	const firstLuminance = relativeLuminance(first);
	const secondLuminance = relativeLuminance(second);
	return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

for (const file of THEME_FILES) {
	test(`${file} conforms to the supported Pi theme schema`, async () => {
		const theme = JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
		assert.equal(theme.$schema, themeSchema.$id);
		assert.equal(themeValidator.Check(theme), true, JSON.stringify([...themeValidator.Errors(theme)]));
	});

	test(`${file} defines Pi fullscreen and maximum-thinking colors`, async () => {
		const theme = JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));

		for (const role of FULLSCREEN_COLOR_ROLES) {
			assert.equal(typeof theme.colors[role], "string", `${role} must be explicit`);
		}

		const resolveColor = (value) => theme.vars?.[value] ?? value;
		assert.equal(resolveColor(theme.colors.searchMatchBg), resolveColor(theme.colors.selectedBg), "other matches use the selected background");
		assert.equal(resolveColor(theme.colors.searchMatchText), resolveColor(theme.colors.warning), "current match reverses to the warning background");

		const darkSurface = resolveColor(theme.colors.toolPendingBg);
		for (const role of ["thinkingMinimal", "thinkingLow"]) {
			assert.ok(contrastRatio(resolveColor(theme.colors[role]), darkSurface) >= 4.5, `${role} must remain readable on dark surfaces`);
		}
	});
}
