import { ImageResponse } from 'next/og';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getItemData, getSkillsData } from '../../../_src/utils/itemsData';
import { getLinkPreviewData, getEffectiveBuildName } from '../../../_src/utils/buildPreview';
import { getMinecraftTextureKey } from '../../../_src/utils/items/minecraftFallback';
import { getBuild } from '../../../../lib/sts-builds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLOT_LABELS = {
    mainhand: 'Mainhand',
    offhand: 'Offhand',
    helmet: 'Helmet',
    chestplate: 'Chestplate',
    leggings: 'Leggings',
    boots: 'Boots',
};

const MAX_MASTERWORK = { Rare: 4, Artifact: 4, Epic: 6 };

const ACCENT = '#9C59D1';
const TEXT = '#ffffff';
const MUTED = '#bababa';
const DIM = '#8a8a96';
const STAR = '#FFD24A';
const SKILL_BASE = '#C084FC';
const SKILL_SPEC = '#7CC4FF';
const SKILL_ENH = '#7EE787';
const PANEL = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.12)';
const CZ_COLOR = '#703663'; // CZ/Depths abilities are always Twisted.

const STAR_PATH =
    'M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z';

let spriteInfoCache = null;
let faviconCache = null;
// Discord CDN avatars fetched for the embed author bar, keyed by URL so
// repeated fetches (Discord re-fetches og images with each preview) stay cheap.
const avatarCache = new Map();

async function getFaviconDataUrl() {
    if (faviconCache) return faviconCache;
    try {
        const buf = await sharp(path.join(process.cwd(), 'public', 'favicon', 'favicon.ico'))
            .resize(128, 128)
            .png()
            .toBuffer();
        faviconCache = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
        faviconCache = null;
    }
    return faviconCache;
}

// Fetch a Discord CDN avatar and re-encode it as a PNG data URL for embedding
// in the card image. Returns null when the fetch fails (e.g. deleted avatar).
async function getAvatarDataUrl(url) {
    if (avatarCache.has(url)) return avatarCache.get(url);
    let dataUrl = null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const buf = await sharp(await res.arrayBuffer())
                .resize(64, 64)
                .png()
                .toBuffer();
            dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        }
    } catch (e) {
        dataUrl = null;
    }
    avatarCache.set(url, dataUrl);
    return dataUrl;
}

// Parses the spritesheet maps + CSS positions once; crops 64x64 item textures on demand.
async function getSpriteInfo() {
    if (spriteInfoCache) return spriteInfoCache;

    const base = path.join(process.cwd(), 'public', 'spritesheets');
    const [mapRaw, cssRaw, sheet, animSheet, mcCssRaw, mcSheet] = await Promise.all([
        fs.readFile(path.join(base, 'itemsheet-map.json'), 'utf8'),
        fs.readFile(path.join(base, '_itemsheet.css'), 'utf8'),
        fs.readFile(path.join(base, 'itemsheet.png')),
        fs.readFile(path.join(base, 'itemsheet-anim.png')),
        fs.readFile(path.join(base, '_minecraft.css'), 'utf8'),
        fs.readFile(path.join(base, 'minecraft.png')),
    ]);

    const map = JSON.parse(mapRaw);
    const positions = {};
    const re = /\.monumenta-([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px/g;
    let match;
    while ((match = re.exec(cssRaw))) {
        positions[match[1]] = { x: Math.abs(Number(match[2])), y: Math.abs(Number(match[3])) };
    }

    // Tokens whose sprite lives on the animated sheet (strips of frames).
    const animTokens = new Set();
    const animRe =
        /\.monumenta-([\w-]+)\s*\{\s*background-position:[^}]*background-image:\s*url\("\.\/itemsheet-anim\.png"\)/g;
    while ((match = animRe.exec(cssRaw))) {
        animTokens.add(match[1]);
    }

    const mcPositions = {};
    const mcRe = /\.minecraft-([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)(?:px)?/g;
    while ((match = mcRe.exec(mcCssRaw))) {
        mcPositions[match[1]] = { x: Math.abs(Number(match[2])), y: Math.abs(Number(match[3])) };
    }

    spriteInfoCache = { map, positions, animTokens, sheet, animSheet, mcPositions, mcSheet };
    return spriteInfoCache;
}

function findSpriteKey(map, itemKey, itemName) {
    const candidates = [
        itemName,
        itemName && itemName.replace(/^EX\s+/, ''),
        itemKey,
        itemKey && itemKey.replace(/^EX\s+/, ''),
        itemKey && itemKey.replace(/-[0-9]+$/, ''),
    ];
    for (const c of candidates) {
        if (c && map[c]) return map[c];
    }
    return null;
}

async function cropSprite(sheet, pos) {
    try {
        const buf = await sharp(sheet, { limitInputPixels: false })
            .extract({ left: pos.x, top: pos.y, width: 64, height: 64 })
            .png()
            .toBuffer();
        return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
        return null;
    }
}

async function itemSpriteDataUrl(
    { map, positions, animTokens, sheet, animSheet, mcPositions, mcSheet },
    itemKey,
    itemName,
    baseItem
) {
    const spriteKey = findSpriteKey(map, itemKey, itemName);
    const pos = spriteKey && positions[spriteKey];
    if (pos) {
        // Animated strips live on the animated sheet; the crop position is
        // the strip start (frame 0). The main sheet has no cell for them.
        if (animTokens.has(spriteKey) && animSheet) {
            return cropSprite(animSheet, pos);
        }
        return cropSprite(sheet, pos);
    }
    // Fall back to the vanilla Minecraft texture for the item's base material.
    if (baseItem) {
        const mcKey = getMinecraftTextureKey(baseItem);
        const mcPos = mcPositions[mcKey];
        if (mcPos) return cropSprite(mcSheet, mcPos);
    }
    return null;
}

function Stars({ filled, max, size = 12 }) {
    const count = Math.max(0, Math.min(max, Number(filled) || 0));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: max }, (_, i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 576 512">
                    <path d={STAR_PATH} fill={i < count ? STAR : 'rgba(255,255,255,0.15)'} />
                </svg>
            ))}
        </div>
    );
}

function MasterworkStars({ tier, masterwork }) {
    const max = MAX_MASTERWORK[tier];
    if (!max) return null;
    return <Stars filled={masterwork} max={max} />;
}

function EquipmentGrid({ itemLines, size = 56 }) {
    const CELL_W = 340;
    const rows = [];
    for (let i = 0; i < itemLines.length; i += 2) {
        rows.push(itemLines.slice(i, i + 2));
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((pair, ri) => (
                <div key={ri} style={{ display: 'flex', marginTop: ri === 0 ? 6 : 8 }}>
                    {pair.map(({ label, name, img, ex, tier, masterwork }) => (
                        <div key={label} style={{ display: 'flex', width: CELL_W, marginRight: 10 }}>
                            {img ? (
                                <img src={img} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
                            ) : (
                                <div style={{ width: size, height: size, border: `1px solid ${BORDER}` }} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 10 }}>
                                <div style={{ fontSize: 11, letterSpacing: 1.5, color: DIM, fontWeight: 700 }}>
                                    {label.toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>
                                    {ex && (
                                        <div
                                            style={{
                                                color: ACCENT,
                                                fontWeight: 800,
                                                letterSpacing: 1,
                                                marginRight: 5,
                                            }}
                                        >
                                            EX
                                        </div>
                                    )}
                                    <div style={{ color: name ? TEXT : DIM, fontWeight: name ? 600 : 400 }}>
                                        {name || 'None'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: 3 }}>
                                    {name && tier && masterwork != null && (
                                        <>
                                            <MasterworkStars tier={tier} masterwork={masterwork} />
                                            <div style={{ color: DIM, fontSize: 12, marginLeft: 7 }}>{tier}</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function SkillChips({ skills, color, enhancedIds }) {
    const sorted = [...skills].sort((a, b) => (enhancedIds.has(b.id) ? 1 : 0) - (enhancedIds.has(a.id) ? 1 : 0));
    return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sorted.map((s) => {
                const enhanced = enhancedIds.has(s.id);
                const chipColor = enhanced ? SKILL_ENH : color;
                return (
                    <div
                        key={s.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            border: `1px solid ${BORDER}`,
                            background: PANEL,
                            padding: '2px 7px',
                            fontSize: 13,
                            color: chipColor,
                        }}
                    >
                        <span style={{ fontWeight: 600 }}>{s.name || s.shortName || s.id}</span>
                        <span style={{ fontWeight: 800 }}>
                            {s.points}
                            {enhanced ? '*' : ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function SkillPanel({ data }) {
    const baseSkills = data.skills || [];
    const specSkills = data.specSkills || [];
    const enhancedIds = new Set((data.enhancements || []).map((e) => (typeof e === 'string' ? e : e.id)));
    if (baseSkills.length === 0 && specSkills.length === 0) return null;
    const treeHeader = (label, showLegend) => (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, letterSpacing: 2, color: DIM, fontWeight: 700 }}>{label}</span>
            {showLegend && <span style={{ fontSize: 11, color: DIM }}>(* is enhanced)</span>}
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {baseSkills.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {treeHeader((data.className || 'CLASS').toUpperCase(), true)}
                    <SkillChips skills={baseSkills} color={SKILL_BASE} enhancedIds={enhancedIds} />
                </div>
            )}
            {specSkills.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {treeHeader((data.spec || 'SPECIALIZATION').toUpperCase(), false)}
                    <SkillChips skills={specSkills} color={SKILL_SPEC} enhancedIds={enhancedIds} />
                </div>
            )}
        </div>
    );
}

// Delve infusion chips (slot label + infusion name), rendered from DB state
// in slot order MH > OH > Helm > Chest > Legs > Boots (the saved state stores
// them alphabetically, so the panel reorders instead of trusting key order).
function InfusionPanel({ infusions }) {
    const SLOT_SHORT = {
        mainhand: 'MH',
        offhand: 'OH',
        helmet: 'HELM',
        chestplate: 'CHEST',
        leggings: 'LEGS',
        boots: 'BOOTS',
    };
    const SLOT_ORDER = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots'];
    const entries = SLOT_ORDER.map((slot) => [slot, infusions && infusions[slot]]).filter(([, v]) => v && v !== 'None');
    if (entries.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: DIM, fontWeight: 700, marginBottom: 4 }}>
                INFUSIONS
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {entries.map(([slot, name]) => (
                    <div
                        key={slot}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            border: `1px solid ${BORDER}`,
                            background: PANEL,
                            padding: '2px 7px',
                            fontSize: 13,
                            color: SKILL_ENH,
                        }}
                    >
                        <span style={{ fontSize: 10, letterSpacing: 1, color: DIM, fontWeight: 700 }}>
                            {SLOT_SHORT[slot] || slot.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const build = searchParams.get('build');
    const buildId = searchParams.get('id');

    // Saved builds can be rendered by DB id: the token alone can't carry the
    // delve infusions, which live in the DB state.
    let savedState = null;
    // The build author (name + Discord avatar) for the embed, from the author
    // snapshot taken at publicise time. Hidden entirely for anonymous posts.
    let author = null;
    const token = (() => {
        if (build) return build;
        if (buildId) {
            const row = getBuild(buildId);
            if (!row) return null;
            savedState = row.parsedState;
            if (row.is_public === 1 && row.anonymous !== 1 && row.author_name) {
                author = { name: row.author_name };
                if (row.user_id && row.author_avatar) {
                    author.avatarUrl = `https://cdn.discordapp.com/avatars/${row.user_id}/${row.author_avatar}.png?size=128&format=png`;
                }
            }
            return row.token;
        }
        return null;
    })();

    const [itemData, skillsData] = await Promise.all([getItemData(), getSkillsData()]);
    const data = token ? getLinkPreviewData(token, itemData, skillsData) : null;
    const fontStyle = { fontFamily: 'sans-serif' };

    // No (or invalid) build: render a simple base-site card with the favicon.
    if (!data) {
        const favicon = await getFaviconDataUrl();
        return new ImageResponse(
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0e0e14',
                    color: TEXT,
                    ...fontStyle,
                }}
            >
                {favicon && <img src={favicon} width={96} height={96} style={{ imageRendering: 'pixelated' }} />}
                <div style={{ fontSize: 28, letterSpacing: 8, color: ACCENT, fontWeight: 700, marginTop: 28 }}>
                    Spare the Sympathy
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, color: TEXT, marginTop: 10 }}>Monumenta Builder</div>
            </div>,
            { width: 1200, height: 630 }
        );
    }

    const title = getEffectiveBuildName(data, null) || 'Monumenta Builder';
    const className = data.className || null;
    const spec = data.spec || null;
    const region = data.region;
    const regionDisplay = data.regionLabel || ([1, 2, 3].includes(region) ? `R${region}` : null);
    const totalSkillPoints = (data.skills || []).reduce((sum, s) => sum + (Number(s.points) || 0), 0);
    const totalSpecPoints = (data.specSkills || []).reduce((sum, s) => sum + (Number(s.points) || 0), 0);
    const hasCz = (data.czAbilities || []).length > 0;
    // Class skills don't exist inside Celestial Zenith / Darkest Depths.
    const hasBuildInfo = (className || spec || totalSkillPoints > 0 || totalSpecPoints > 0) && !hasCz;
    const hasInfusions = Object.values((savedState && savedState.infusions) || {}).some((v) => v && v !== 'None');

    const InfoItem = ({ label, value }) => (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: DIM, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 17, color: TEXT, fontWeight: 700 }}>{value}</div>
        </div>
    );

    const spriteInfo = await getSpriteInfo();
    const avatarDataUrl = author?.avatarUrl ? await getAvatarDataUrl(author.avatarUrl) : null;
    const itemLines = data
        ? await Promise.all(
              Object.entries(SLOT_LABELS).map(async ([slot, label]) => {
                  const key = data.items[slot];
                  if (key === 'None')
                      return { label, name: null, key: null, img: null, ex: false, tier: null, masterwork: 0 };
                  const item = itemData[key];
                  const rawName = item?.name || key;
                  const ex = Boolean(rawName?.startsWith('EX '));
                  const name = ex ? rawName.replace(/^EX\s+/, '') : rawName;
                  const img = await itemSpriteDataUrl(spriteInfo, key, rawName, item?.base_item);
                  return {
                      label,
                      name,
                      key,
                      img,
                      ex,
                      tier: item?.tier || null,
                      masterwork: item && item.masterwork != null ? item.masterwork : null,
                  };
              })
          )
        : null;
    // Valley (1) and Isles (2) - including Darkest Depths - have no charms.
    // Never show the charms panel (or reserve its space) for those regions.
    const charmNames = region > 2 ? data?.charms.items || [] : [];
    const hasCharms = charmNames.length > 0;
    const hasAnyItem = (itemLines || []).some((l) => l.name);
    const hasAnyExtra =
        hasBuildInfo ||
        data.ascension > 0 ||
        hasCz ||
        (data.skills || []).length > 0 ||
        (data.specSkills || []).length > 0 ||
        hasInfusions;
    // Scale the item textures up when the card would otherwise have empty
    // space: no charms panel -> 72px, and when nothing else is on the card
    // (no skills/infusions/cz/info) -> 96px.
    const textureSize = !hasCharms && hasAnyItem ? (hasAnyExtra ? 72 : 96) : 56;

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: '#0e0e14',
                color: TEXT,
                padding: '28px 40px',
                boxSizing: 'border-box',
                ...fontStyle,
            }}
        >
            <div style={{ fontSize: 30, fontWeight: 800, color: TEXT }}>{title}</div>

            {hasBuildInfo && (
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {regionDisplay && <InfoItem label="REGION" value={regionDisplay} />}
                    {className && <InfoItem label="CLASS" value={className} />}
                    {spec && <InfoItem label="SPEC" value={spec} />}
                    {totalSkillPoints > 0 && <InfoItem label="SKILL POINTS" value={String(totalSkillPoints)} />}
                    {totalSpecPoints > 0 && <InfoItem label="SPEC POINTS" value={String(totalSpecPoints)} />}
                </div>
            )}

            {data.ascension > 0 && (
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <InfoItem label="ASCENSION" value={String(data.ascension)} />
                </div>
            )}

            {!hasCz && <SkillPanel data={data} />}

            <InfusionPanel infusions={savedState && savedState.infusions} />

            {hasCz && data.czAbilities.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
                    <div style={{ fontSize: 12, letterSpacing: 2, color: DIM, fontWeight: 700 }}>
                        {region === 2 ? 'DARKEST DEPTHS' : 'CELESTIAL ZENITH'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {data.czAbilities.map((name) => (
                            <div
                                key={name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    border: `2px solid ${CZ_COLOR}`,
                                    background: PANEL,
                                    padding: '3px 8px',
                                }}
                            >
                                <span style={{ fontSize: 13, color: TEXT, fontWeight: 700 }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 18, marginTop: 'auto', paddingTop: 10 }}>
                <div
                    style={{
                        flex: 1,
                        border: `2px solid ${BORDER}`,
                        background: PANEL,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <div style={{ fontSize: 13, letterSpacing: 2, color: DIM, fontWeight: 700 }}>EQUIPMENT</div>
                    <EquipmentGrid itemLines={itemLines} size={textureSize} />
                </div>

                {charmNames.length > 0 && (
                    <div
                        style={{
                            width: 330,
                            border: `2px solid ${BORDER}`,
                            background: PANEL,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 14,
                                letterSpacing: 2,
                                color: DIM,
                                fontWeight: 700,
                            }}
                        >
                            <span>{`CHARMS ${String(data.charms.totalPower)}/12`}</span>
                            <svg width={12} height={12} viewBox="0 0 576 512">
                                <path d={STAR_PATH} fill={STAR} />
                            </svg>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {charmNames.map((c, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: 3,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: TEXT,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                    >
                                        {c.name}
                                    </div>
                                    {c.power != null && (
                                        <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 2 }}>
                                            <Stars filled={c.power} max={c.power} size={9} />
                                            <div style={{ color: DIM, fontSize: 11, marginLeft: 4 }}>
                                                {String(c.power)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {author && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: `1px solid ${BORDER}`,
                    }}
                >
                    {avatarDataUrl && (
                        <img
                            src={avatarDataUrl}
                            width={26}
                            height={26}
                            style={{ borderRadius: 999, objectFit: 'cover' }}
                        />
                    )}
                    <div style={{ fontSize: 14, color: MUTED, fontWeight: 600 }}>{author.name}</div>
                    <div style={{ fontSize: 10, letterSpacing: 2, color: DIM, fontWeight: 700, marginLeft: 4 }}>
                        BUILD AUTHOR
                    </div>
                </div>
            )}
        </div>,
        { width: 1200, height: 630 }
    );
}
