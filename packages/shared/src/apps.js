// Shared app registry: every enabled entry becomes a link in the site nav
// (used by both the platform app and the STS app) unless `nav: false` hides it
// from the nav while keeping the route reachable.
//
// Add new apps here. Set `subdomain` to reach the app via <subdomain>.your-domain.
// Set `enabled: false` to keep an app hidden and unreachable until it is ready
// (disabled apps return the hidden-404 from the platform proxy).

const apps = [
    {
        slug: 'sts',
        subdomain: 'sts',
        label: 'Spare the Sympathy',
        description: 'Monumenta item guide and build tool',
        enabled: true,
    },
    {
        slug: 'dash',
        subdomain: 'dash',
        label: 'Dashboard',
        description: 'Container and domain dashboard',
        enabled: true,
        // Reachable at /dash but not listed in the nav.
        nav: false,
    },
    {
        slug: 'login',
        subdomain: 'login',
        label: 'Login',
        description: 'Platform login',
        enabled: true,
        // Reachable at /login but not listed in the nav.
        nav: false,
    },
    { slug: 'auth', subdomain: 'auth', label: 'Auth', description: 'Platform auth', enabled: false },
];

export function getAllApps() {
    return apps;
}

export function getApps() {
    return apps.filter((a) => a.enabled && a.nav !== false);
}

export function getAppBySubdomain(subdomain) {
    return apps.find((a) => a.subdomain === subdomain) || null;
}
