import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";
export function describeComponentState(state) {
    switch (state.kind) {
        case "absent":
            return "not set";
        case "provisioned":
            return state.detail;
        case "differs":
            return `${state.detail} — differs from what this package writes`;
        case "unsafe":
            return `cannot be edited safely (${state.reason})`;
    }
}
export function editPath(edit) {
    return edit.path;
}
/**
 * The changed hunk between two versions of a file. A region splice is
 * contiguous, so trimming the common prefix and suffix leaves exactly the lines
 * that moved — no diff algorithm and no dependency.
 */
export function lineDiff(before, after) {
    // A file's terminating newline splits into a trailing empty element that is
    // not a line. Left in, it shows up as a phantom blank in every diff.
    const split = (text) => {
        if (!text)
            return [];
        const lines = text.split("\n");
        if (lines[lines.length - 1] === "")
            lines.pop();
        return lines;
    };
    const a = split(before);
    const b = split(after);
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start])
        start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }
    return { removed: a.slice(start, endA), added: b.slice(start, endB) };
}
/**
 * Everything that would happen, named before any of it does. A path is enough
 * for a whole file or directory; an edit inside a file the user owns is shown
 * as a diff, because the path alone does not say what becomes of the rest.
 */
export function renderPlan(edits) {
    const lines = [];
    const writes = edits.filter((e) => e.kind === "path" && e.action === "write");
    const deletes = edits.filter((e) => e.kind === "path" && e.action === "delete");
    const regions = edits.filter((e) => e.kind === "region");
    if (writes.length > 0) {
        lines.push("Will be written:");
        for (const edit of writes) {
            lines.push(`  ${edit.path}${edit.note ? `   (${edit.note})` : ""}`);
        }
        lines.push("");
    }
    if (deletes.length > 0) {
        lines.push("Will be deleted:");
        for (const edit of deletes) {
            lines.push(`  ${edit.path}${edit.note ? `   (${edit.note})` : ""}`);
        }
        lines.push("");
    }
    for (const edit of regions) {
        const { removed, added } = lineDiff(edit.before, edit.after);
        const what = edit.before === null
            ? " (new file)"
            : edit.after === null
                ? " (file removed)"
                : "";
        lines.push(`${edit.path}${what}`);
        for (const line of removed)
            lines.push(`  - ${line}`);
        for (const line of added)
            lines.push(`  + ${line}`);
        lines.push("");
    }
    return lines;
}
/** Writing the whole file is the apply for every region edit, so both components share it. */
export function applyRegionEdit(edit) {
    if (edit.after === null) {
        rmSync(edit.path, { force: true });
        return;
    }
    mkdirSync(dirname(edit.path), { recursive: true });
    writeFileSync(edit.path, edit.after);
}
/**
 * Applies what was named and confirmed. A failure names the path involved
 * rather than the component, because the path is what the user has to go look
 * at, and stops rather than continuing into a half-applied state.
 */
export function applyPlan(project, entries) {
    for (const { component, edits } of entries) {
        for (const edit of edits) {
            try {
                component.applyEdit(project, edit);
            }
            catch (err) {
                console.error(`[openspec-tools] Could not complete the change to ${editPath(edit)}: ${err.message}`);
                process.exit(1);
            }
        }
    }
}
//# sourceMappingURL=component.js.map