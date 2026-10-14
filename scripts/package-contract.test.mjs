import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const requiredHostDependencies = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-codemode",
	"@earendil-works/pi-coding-agent",
	"@earendil-works/pi-tui",
	"typebox",
];

test("package has installable consumer metadata", () => {
	assert.equal(packageJson.name, "mypac");
	assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
});

test("retired experimental server is not required by consumers", () => {
	assert.equal(packageJson.devDependencies["@earendil-works/pi-server"], undefined);
	assert.equal(packageJson.peerDependencies["@earendil-works/pi-server"], undefined);
});

test("required Pi host dependencies have exact, matching development and peer pins", () => {
	for (const name of requiredHostDependencies) {
		const version = packageJson.devDependencies[name];
		assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must have an exact development version`);
		assert.equal(packageJson.peerDependencies[name], version, `${name} peer must match its development pin`);
	}
});
