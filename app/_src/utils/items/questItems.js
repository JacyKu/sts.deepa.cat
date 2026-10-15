// Quest items carry a "* Quest Item *" lore marker and a "#Q<id>I<index>"
// code. The id can be decimal (Q154), hex (QAF), carry letter suffixes
// (Q103n), omit the I separator (Q22801), or be wrapped in <obfuscated> tags.
// Shared by the items page's filters and the quest-name lookup.
const QUEST_ID_RE = /#Q([A-Za-z0-9]+?)(?:I\d+)?(?![A-Za-z0-9])/g;

export function isQuestItem(item) {
    const text = (item.mmlore || []).join('\n') + '\n' + (item.lore || '');
    return text.includes('* Quest Item *');
}

export function getQuestIds(item) {
    const text = ((item.mmlore || []).join('\n') + '\n' + (item.lore || '')).replace(/<[^>]+>/g, '');
    const ids = [];
    let m;
    QUEST_ID_RE.lastIndex = 0;
    while ((m = QUEST_ID_RE.exec(text))) ids.push(m[1]);
    return ids;
}
