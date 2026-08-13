import { existsSync } from "fs";
import { resolve } from "path";
import { input, select } from "@inquirer/prompts";
import { applyRegionEdit } from "../component.js";
import { readFileOrNull } from "../region-markdown.js";
import { findYamlRegion, yamlWithRegion } from "../region-yaml.js";
const ID = "artifact-language";
/** Both filenames OpenSpec resolves, in the order it resolves them. */
const CONFIG_NAMES = ["config.yaml", "config.yml"];
/**
 * The offered set is short and ends in a free-text choice: a language this
 * package did not anticipate is still reachable, and nobody has to wait for a
 * release to write artifacts in it.
 */
const OFFERED = [
    { name: "Português (Brasil)", value: "pt-BR" },
    { name: "English", value: "en" },
    { name: "Español", value: "es" },
];
/** The config file OpenSpec would read, or null when the project has none. */
export function configPath(project) {
    for (const name of CONFIG_NAMES) {
        const candidate = resolve(project.root, "openspec", name);
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function labelFor(lang) {
    return OFFERED.find((entry) => entry.value === lang)?.name ?? lang;
}
/**
 * Scoped to artifacts and to nothing else. The agent's replies, the code, and
 * the commit messages are separate choices, and a directive that quietly
 * claimed them would be wrong for most repositories.
 */
function directive(lang) {
    return [
        `Write every OpenSpec artifact — proposal, design, specs, tasks — in ${labelFor(lang)}.`,
        "This governs the artifacts only: it does not set the language of",
        "conversation, of code and comments, or of commit messages.",
    ];
}
export const artifactLanguageComponent = {
    id: "lang",
    label: "Artifact language",
    summary: "the language OpenSpec artifacts are written in",
    inspect(project) {
        const path = configPath(project);
        if (path === null)
            return { kind: "absent" };
        const content = readFileOrNull(path);
        const found = findYamlRegion(content, ID);
        if (found.kind === "damaged")
            return { kind: "unsafe", reason: found.reason };
        if (found.kind === "absent")
            return { kind: "absent" };
        const lang = found.params.lang ?? "unrecognized";
        const detail = labelFor(lang);
        // Body carries the scalar's indentation, so compare on trimmed lines.
        const expected = directive(lang);
        const actual = found.body.map((line) => line.trim());
        const matches = actual.length === expected.length &&
            actual.every((line, i) => line === expected[i]);
        return matches
            ? { kind: "provisioned", detail }
            : { kind: "differs", detail };
    },
    async choose(project, ctx) {
        const supplied = ctx.options.lang;
        if (typeof supplied === "string" && supplied.length > 0) {
            return { lang: supplied };
        }
        ctx.requireInteractive("A language for the artifacts", [
            "--lang <value>   for example: pt-BR, en, or any language you name",
        ]);
        const chosen = await select({
            message: "Which language should OpenSpec artifacts be written in?",
            choices: [
                ...OFFERED,
                { name: "Something else…", value: "__other__" },
            ],
        });
        if (chosen !== "__other__")
            return { lang: chosen };
        const named = await input({ message: "Name the language:" });
        return named.trim() ? { lang: named.trim() } : null;
    },
    /**
     * A missing config file provisions nothing rather than being created: the
     * file requires a `schema` value, and choosing one on the user's behalf is
     * the decision `openspec init` exists to ask about.
     */
    plan(project, selection) {
        const path = configPath(project);
        if (path === null)
            return [];
        const before = readFileOrNull(path);
        const result = yamlWithRegion(before, ID, selection ? { lang: selection.lang } : {}, selection ? directive(selection.lang) : null);
        // Refusing is reported through inspect(); a plan never carries an edit it
        // could not compute, so an unsafe file simply contributes nothing here.
        if (result.kind === "unsafe")
            return [];
        // Coverage reason: `configPath` returned a path, so the file is there and
        // `before` is its contents. The fallback covers a file that vanished
        // between the two calls, which no test can stage without a race.
        /* node:coverage ignore next */
        if (result.content === (before ?? ""))
            return [];
        const edit = {
            kind: "region",
            path,
            before,
            after: result.content,
        };
        return [edit];
    },
    applyEdit(_project, edit) {
        if (edit.kind === "region")
            applyRegionEdit(edit);
    },
};
/** Named so `init` can explain why this component offered nothing to do. */
export function missingConfigReason(project) {
    return configPath(project) === null
        ? `no ${CONFIG_NAMES[0]} under ${resolve(project.root, "openspec")}`
        : null;
}
//# sourceMappingURL=artifact-language.js.map