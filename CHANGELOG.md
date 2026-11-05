# Spare the Sympathy - v1.4.0

Please report issues or feature requests on [Github](https://github.com/JacyKu/sts.deepa.cat/issues).

## Changelog

### Added

- **Build emoji** - `:seahorse:` renders inline in names, descriptions, and embeds. Plain-text titles omit it.
- **Build-link skills** - import class/spec points and enhancements from a build link.

### Changed

- **Checkboxes** - match the app's accent and rounded style.
- **Data backups** - `public/items` is zipped and uploaded to R2 with the database backup.
- **Shaman rework** - new Totem Mastery, Totem Forms, Windweaver/Earthcarver specs, calculations, and icons.

### Fixed

- **Item names with commas** - builds using items such as Granzanber, Halberd of Ascension now keep the item after saving and reloading.
- **Build names** - editing or clearing a name now enables Save and saves correctly.
- **Saved spec and skills** - saving a changed spec or cleared skills no longer restores the old layout.
- **Build cards** - cards refresh their class, spec, and skills after saving.
- **Build-card skills after class updates** - removed or renamed skills disappear, even on unsaved builds. Stored summaries self-repair.
- **Ability damage** - skill/spec damage now multiplies gear damage instead of adding to it.
- **Spec enhancements** - Windweaver and Earthcarver spec abilities no longer show enhancement boxes.
- **Passive calculations** - Unwavering, Elusive, Deadeye, Bloodlust, Rejuvenation, and Endurance display correctly and use editable stack boxes.
- **Passive values** - corrected Unwavering, Elusive, Deadeye, Bloodlust, Endurance, and Rejuvenation effects.
- **Potion healing** - Heal and AntiHeal affect healing and regen; 100% anti-heal stops healing.
- **Potion attack speed** - Haste and Mining Fatigue add 10% attack speed per level.
- **Frenzy** - attack speed now multiplies gear attack speed.
- **Delve infusion levels** - use the selected level (I-IV); Revelation adds one.
- **Saved delve levels** - saved builds restore their infusion levels.

## Spare the Sympathy Discord bot

### Changed

- **`/convert`** - replies with a saved `/b/<id>` link.

### Fixed

- **Item embeds** - use the location colour when an item has no rarity.

## Spare the Sympathy Minecraft mod

### Added

- **Build naming** - Export/Upload ask for a name first (Shift+click skips it).
- **Skill picker** - the Class Selection GUI can load a build link or token and compare its class/spec points, including enhancement targets.

### Changed

- **Shaman skills** - Armoury export and the skill picker recognise the reworked Shaman abilities and apostrophe names.
- **Armoury export** - every item uses its max masterwork version.
- **Movable view buttons** - `/ps`, `/pa` and `/vc` can be Ctrl+dragged; positions are saved.
- **`/pa` progress** - shows `0/2`-`2/2` and missing spec pages.
- **Re-viewing a player** - replaces the cached view.
- **Revelation** - delve infusion uploads assume Revelation.

### Fixed

- **Armoury** - exalted items export the Ring version, and basic infusions export again.
- **ReplayMod** - Ctrl+dragging the armoury and /ps, /pa and /vc buttons works while ReplayMod is installed.
- **Unofficial Monumenta Mod** - resizing with the calculator open no longer crashes.
