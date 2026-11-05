// Live card summaries for saved builds.
//
// Build cards and list filters read denormalized columns (skills_json,
// class_name, spec, skill_point_count, cz_tree) stored on the builds row. Those
// columns are a snapshot from the last save, so a class update that removes or
// renames skills leaves old rows showing the removed abilities. The token is
// the source of truth, so the list routes recompute just the skill-related
// summary fields against the current skills/cz data at read time and repair
// the stored row when it differs.
//
// Only the skill portion is decoded, not the equipment: an empty item map
// keeps the 13MB items.json out of this path. `decodeBuildParam` needs any
// item map to walk a binary token (equipment hashes resolve to "None"), while
// class/spec/skills are plain strings that need no item lookup.
import { getCzData, getSkillsData } from '../app/_src/utils/itemsData';
import { computeBuildSummary } from './public-builds';
import { listBuildsForSummaryRefresh, updateBuildCardSummary } from './sts-builds';

const NO_ITEM_DATA = Object.freeze({});

function normalizedSummary(live) {
    return {
        class_name: live.class_name || null,
        spec: live.spec || null,
        skill_point_count: Number(live.skill_point_count) || 0,
        skills_json: live.skills_json || '[]',
        cz_tree: live.cz_tree || null,
    };
}

function isSameSummary(row, summary) {
    return (
        (row.class_name || null) === summary.class_name &&
        (row.spec || null) === summary.spec &&
        (Number(row.skill_point_count) || 0) === summary.skill_point_count &&
        (row.skills_json || '[]') === summary.skills_json &&
        (row.cz_tree || null) === summary.cz_tree
    );
}

function refreshRow(row, skillsData, czData) {
    if (!row || typeof row.token !== 'string' || !row.token) return row;
    let live;
    try {
        live = computeBuildSummary(row.token, NO_ITEM_DATA, skillsData, czData);
    } catch (error) {
        // A malformed legacy token keeps its stored summary rather than
        // taking the whole list down.
        return row;
    }
    if (!live) return row;

    const summary = normalizedSummary(live);
    if (isSameSummary(row, summary)) return row;

    // Persist the correction opportunistically so the public skill filter
    // (which matches skills_json) self-heals after a class update. A write
    // failure must not hide the corrected card from this response.
    try {
        updateBuildCardSummary(row.id, row.token, summary);
    } catch (error) {
        console.error(`[build-summaries] could not refresh ${row.id}: ${error && error.message ? error.message : error}`);
    }
    return { ...row, ...summary };
}

// Returns the rows with their skill summary replaced by a live derivation
// from the token + current class data. Leaves rows untouched when the skills
// catalog is unavailable (a failed data read must not blank every card).
export async function refreshLiveBuildSummaries(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return Array.isArray(rows) ? rows : [];
    const skillsData = await getSkillsData();
    if (!skillsData) return rows;
    const czData = await getCzData();
    return rows.map((row) => refreshRow(row, skillsData, czData));
}

// Single-build variant for endpoints like the Discord card route.
export async function refreshLiveBuildSummary(row) {
    if (!row) return row;
    const skillsData = await getSkillsData();
    if (!skillsData) return row;
    const czData = await getCzData();
    return refreshRow(row, skillsData, czData);
}

// Repair every stored row after a class-data update, so public skill filters
// (which match the stored skills_json in SQL) are correct immediately instead
// of only after each build happens to be listed. Runs in the background from
// the class-update scheduler; returns how many rows changed.
export async function refreshAllBuildSummaries() {
    const skillsData = await getSkillsData();
    if (!skillsData) return 0;
    const czData = await getCzData();
    const pageSize = 200;
    let offset = 0;
    let changed = 0;
    while (true) {
        const rows = listBuildsForSummaryRefresh(pageSize, offset);
        if (rows.length === 0) break;
        for (const row of rows) {
            const next = refreshRow(row, skillsData, czData);
            if (next !== row) changed += 1;
        }
        offset += rows.length;
    }
    return changed;
}
