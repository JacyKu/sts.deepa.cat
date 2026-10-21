/**
 * Shortcodes that render as inline images on the site and in generated embed
 * cards cannot be rendered in plain-text titles (browser tabs, Discord title
 * fields, card tooltips). Strip them from those text-only contexts while
 * leaving the stored build name and the image renderers untouched.
 */
export function stripSeahorseShortcode(value) {
    return String(value ?? '')
        .replace(/:seahorse:/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
