import { headers } from 'next/headers';
import './globals.css';
import { LanguageContextProvider } from './_src/components/languageContext';
import { LowResourceProvider } from './_src/components/lowResourceContext';
import { AnimationsProvider } from './_src/components/animationsContext';
import { HideLoreProvider } from './_src/components/items/hideLoreContext';
import { HideObtainmentProvider } from './_src/components/items/hideObtainmentContext';
import { HideSkinsProvider } from './_src/components/items/hideSkinsContext';
import { MaxMasterworkProvider } from './_src/components/items/maxMasterworkContext';
import { BuildListProvider } from './_src/components/items/buildListContext';
import { BuildListEnabledProvider } from './_src/components/items/buildListEnabledContext';
import { CardItemsFirstProvider } from './_src/components/items/cardItemsFirstContext';
import { ItemFavouritesProvider } from './_src/components/items/itemFavouritesContext';
import Header, { HeaderNav } from './_src/components/header';
import Footer from './_src/components/footer';
import SiteNav from '@deepa/shared/site-nav';

export const metadata = {
    title: {
        default: 'Spare the Sympathy',
        template: '%s - Spare the Sympathy',
    },
    description: 'Monumenta Items and Builds',
    // Same env var that pins the Discord OAuth redirect URI: set
    // STS_PUBLIC_BASE_URL per environment (see .env.example) so absolute
    // metadata URLs (OG/Twitter cards) point at the right host everywhere.
    metadataBase: new URL(process.env.STS_PUBLIC_BASE_URL || 'https://sts.deepa.cat'),
    icons: { icon: '/favicon/favicon.ico' },
    openGraph: {
        siteName: 'Spare the Sympathy',
        type: 'website',
        title: 'Spare the Sympathy',
        description: 'Monumenta Items and Builds',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        card: 'summary',
        title: 'Spare the Sympathy',
        description: 'Monumenta Items and Builds',
        images: ['/favicon/favicon.png'],
    },
};

export default async function StsLayout({ children }) {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const base = host ? '' : '';

    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <link rel="stylesheet" href={base + '/spritesheets/_minecraft.css'} />
                <link rel="stylesheet" href={base + '/spritesheets/_itemsheet.css'} />
                <link rel="stylesheet" href={base + '/spritesheets/_charmsheet.css'} />
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0-beta1/dist/css/bootstrap.min.css"
                    integrity="sha384-0evHe/X+R7YkIZDRvuzKMRqM+OrBnVFBL6DOitfPri4tjfHxaWutUpFmBp4vmVor"
                    crossOrigin="anonymous"
                />
                <div className="site-content" id="top">
                    <LowResourceProvider>
                        <AnimationsProvider>
                            <LanguageContextProvider>
                                <HideLoreProvider>
                                    <HideObtainmentProvider>
                                        <HideSkinsProvider>
                                            <MaxMasterworkProvider>
                                                <BuildListProvider>
                                                    <BuildListEnabledProvider>
                                                        <CardItemsFirstProvider>
                                                            <ItemFavouritesProvider>
                                                                <SiteNav showBeta center={<HeaderNav />}>
                                                                    <Header />
                                                                </SiteNav>
                                                                <div className="site-main">{children}</div>
                                                                <Footer />
                                                            </ItemFavouritesProvider>
                                                        </CardItemsFirstProvider>
                                                    </BuildListEnabledProvider>
                                                </BuildListProvider>
                                            </MaxMasterworkProvider>
                                        </HideSkinsProvider>
                                    </HideObtainmentProvider>
                                </HideLoreProvider>
                            </LanguageContextProvider>
                        </AnimationsProvider>
                    </LowResourceProvider>
                </div>
            </body>
        </html>
    );
}
