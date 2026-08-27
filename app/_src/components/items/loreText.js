'use client';

import React from 'react';

// Renders lore with the quest-item lines colored like in-game: the
// "* Quest Item *" marker in light purple and the "#Q<id>I<index>" code in a
// distinct gray, instead of blending into the plain lore text. Everything
// else (including "Material" lines) stays as-is.
//
// The quest lines are metadata, not lore: with questOnly set (the "Hide lore"
// toggle), only those lines render and the rest of the lore disappears.
const QUEST_MARKER_RE = /\*\s*Quest Item\s*\*/;
const QUEST_ID_RE = /^#Q[A-Za-z0-9]+(?:I\d+)?$/;

function isQuestLine(trimmed) {
    return QUEST_MARKER_RE.test(trimmed) || QUEST_ID_RE.test(trimmed);
}

export default function LoreText({ text, className, questOnly = false }) {
    if (!text) return null;
    const lines = String(text).split('\n');
    const filtered = questOnly ? lines.filter((line) => isQuestLine(line.trim())) : lines;
    if (filtered.length === 0) return null;
    return (
        <span className={className}>
            {filtered.map((line, i) => {
                const trimmed = line.trim();
                let color = null;
                if (QUEST_MARKER_RE.test(trimmed)) color = '#fc54fc';
                else if (QUEST_ID_RE.test(trimmed)) color = '#8a8a96';
                return (
                    <React.Fragment key={i}>
                        {i > 0 && <br />}
                        {color ? <span style={{ color }}>{line}</span> : line}
                    </React.Fragment>
                );
            })}
        </span>
    );
}
