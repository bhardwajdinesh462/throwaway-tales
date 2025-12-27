import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSEOSettings } from '@/hooks/useSEOSettings';
import { useGeneralSettings } from '@/hooks/useGeneralSettings';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  author?: string;
  publishedTime?: string;
  noIndex?: boolean;
}

// Marker IDs for injected elements (so we can remove/replace them)
const INJECTED_MARKERS = {
  headerCode: 'seo-header-code-injected',
  footerCode: 'seo-footer-code-injected',
  schemaMarkup: 'seo-schema-markup-injected',
  googleAnalytics: 'seo-ga-injected',
  googleTagManager: 'seo-gtm-injected',
  googleTagManagerNoscript: 'seo-gtm-noscript-injected',
  facebookPixel: 'seo-fb-pixel-injected',
  customCss: 'custom-css-injected',
  customJs: 'custom-js-injected',
};

// Path compatibility mapping for old vs new routes
const PATH_COMPAT_MAP: Record<string, string> = {
  '/privacy': '/privacy-policy',
  '/terms': '/terms-of-service',
  '/cookies': '/cookie-policy',
  '/features': '/premium-features',
};

const SEOHead = ({
  title: propTitle,
  description: propDescription,
  keywords: propKeywords,
  image: propImage,
  url = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website',
  siteName: propSiteName,
  twitterCard = 'summary_large_image',
  author,
  publishedTime,
  noIndex: propNoIndex,
}: SEOHeadProps) => {
  const { settings: seoSettings, isLoading: seoLoading, getPageSEO } = useSEOSettings();
  const { settings: generalSettings, isLoading: generalLoading } = useGeneralSettings();
  const location = useLocation();
  const lastInjectedRef = useRef<string>('');

  useEffect(() => {
    if (seoLoading || generalLoading) return;

    // Get page-specific SEO settings (try current path, then compat mapping)
    let pageSEO = getPageSEO(location.pathname);
    if (!pageSEO.title && !pageSEO.description && PATH_COMPAT_MAP[location.pathname]) {
      pageSEO = getPageSEO(PATH_COMPAT_MAP[location.pathname]);
    }

    // Priority: prop > page-specific > global settings
    const title = propTitle || pageSEO.title || seoSettings.siteTitle;
    const description = propDescription || pageSEO.description || seoSettings.metaDescription;
    const keywords = propKeywords || pageSEO.keywords || seoSettings.metaKeywords;
    const image = propImage || pageSEO.ogImage || seoSettings.ogImage;
    const siteName = propSiteName || generalSettings.siteName;
    const authorName = author || `${generalSettings.siteName} Team`;
    const noIndex = propNoIndex ?? pageSEO.noIndex ?? false;
    const noFollow = pageSEO.noFollow ?? false;
    const canonicalUrl = pageSEO.canonicalUrl || url;

    // Update document title
    document.title = title;

    // Helper to update or create meta tag
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      if (!content) return;
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Helper to remove element by ID
    const removeById = (id: string) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };

    // Helper to inject script safely (recreates to ensure execution)
    const injectScript = (id: string, content: string, location: 'head' | 'body' = 'head') => {
      removeById(id);
      if (!content.trim()) return;
      
      const script = document.createElement('script');
      script.id = id;
      script.textContent = content;
      if (location === 'head') {
        document.head.appendChild(script);
      } else {
        document.body.appendChild(script);
      }
    };

    // Helper to inject HTML block (parses and executes scripts)
    const injectHtmlBlock = (id: string, html: string, location: 'head' | 'body' = 'head') => {
      removeById(id);
      if (!html.trim()) return;

      const container = document.createElement('div');
      container.id = id;
      container.style.display = 'none';
      
      // Parse the HTML
      const template = document.createElement('template');
      template.innerHTML = html;
      
      // Extract and execute scripts separately (innerHTML doesn't execute scripts)
      const scripts: { src?: string; content?: string }[] = [];
      template.content.querySelectorAll('script').forEach(script => {
        if (script.src) {
          scripts.push({ src: script.src });
        } else if (script.textContent) {
          scripts.push({ content: script.textContent });
        }
        script.remove();
      });

      // Append non-script content
      if (location === 'head') {
        document.head.appendChild(container);
        container.innerHTML = template.innerHTML;
      } else {
        document.body.appendChild(container);
        container.innerHTML = template.innerHTML;
      }

      // Execute scripts
      scripts.forEach((s, i) => {
        const scriptEl = document.createElement('script');
        scriptEl.id = `${id}-script-${i}`;
        if (s.src) {
          scriptEl.src = s.src;
          scriptEl.async = true;
        } else if (s.content) {
          scriptEl.textContent = s.content;
        }
        document.head.appendChild(scriptEl);
      });
    };

    // Basic meta tags
    setMetaTag('description', description);
    setMetaTag('keywords', keywords);
    setMetaTag('author', authorName);
    
    // Robots
    const robotsDirectives: string[] = [];
    if (noIndex) robotsDirectives.push('noindex');
    else robotsDirectives.push('index');
    if (noFollow) robotsDirectives.push('nofollow');
    else robotsDirectives.push('follow');
    setMetaTag('robots', robotsDirectives.join(', '));

    // Open Graph tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', image, true);
    setMetaTag('og:url', url, true);
    setMetaTag('og:type', type, true);
    setMetaTag('og:site_name', siteName, true);

    // Twitter Card tags
    setMetaTag('twitter:card', twitterCard);
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', image);
    if (seoSettings.twitterHandle) {
      setMetaTag('twitter:site', seoSettings.twitterHandle);
    }

    // Article specific
    if (type === 'article' && publishedTime) {
      setMetaTag('article:published_time', publishedTime, true);
      setMetaTag('article:author', authorName, true);
    }

    // Site verification tags
    if (seoSettings.googleSiteVerification) {
      setMetaTag('google-site-verification', seoSettings.googleSiteVerification);
    }
    if (seoSettings.bingSiteVerification) {
      setMetaTag('msvalidate.01', seoSettings.bingSiteVerification);
    }

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // Create a fingerprint to avoid re-injecting identical content
    const fingerprint = JSON.stringify({
      headerCode: seoSettings.headerCode,
      footerCode: seoSettings.footerCode,
      schemaMarkup: seoSettings.schemaMarkup,
      googleAnalyticsId: seoSettings.googleAnalyticsId,
      googleTagManagerId: seoSettings.googleTagManagerId,
      facebookPixelId: seoSettings.facebookPixelId,
      customCss: seoSettings.customCss,
      customJs: seoSettings.customJs,
    });

    if (fingerprint !== lastInjectedRef.current) {
      lastInjectedRef.current = fingerprint;

      // Inject header code (custom HTML/scripts in head)
      if (seoSettings.headerCode) {
        injectHtmlBlock(INJECTED_MARKERS.headerCode, seoSettings.headerCode, 'head');
      } else {
        removeById(INJECTED_MARKERS.headerCode);
      }

      // Inject footer code (custom HTML/scripts at end of body)
      if (seoSettings.footerCode) {
        injectHtmlBlock(INJECTED_MARKERS.footerCode, seoSettings.footerCode, 'body');
      } else {
        removeById(INJECTED_MARKERS.footerCode);
      }

      // Inject schema markup (JSON-LD)
      if (seoSettings.schemaMarkup) {
        removeById(INJECTED_MARKERS.schemaMarkup);
        const schemaScript = document.createElement('script');
        schemaScript.id = INJECTED_MARKERS.schemaMarkup;
        schemaScript.type = 'application/ld+json';
        schemaScript.textContent = seoSettings.schemaMarkup;
        document.head.appendChild(schemaScript);
      } else {
        removeById(INJECTED_MARKERS.schemaMarkup);
      }

      // Inject Google Analytics (gtag.js)
      if (seoSettings.googleAnalyticsId) {
        removeById(INJECTED_MARKERS.googleAnalytics);
        removeById(`${INJECTED_MARKERS.googleAnalytics}-lib`);
        
        // Load gtag library
        const gaLib = document.createElement('script');
        gaLib.id = `${INJECTED_MARKERS.googleAnalytics}-lib`;
        gaLib.async = true;
        gaLib.src = `https://www.googletagmanager.com/gtag/js?id=${seoSettings.googleAnalyticsId}`;
        document.head.appendChild(gaLib);
        
        // Initialize gtag
        const gaInit = document.createElement('script');
        gaInit.id = INJECTED_MARKERS.googleAnalytics;
        gaInit.textContent = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${seoSettings.googleAnalyticsId}');
        `;
        document.head.appendChild(gaInit);
      } else {
        removeById(INJECTED_MARKERS.googleAnalytics);
        removeById(`${INJECTED_MARKERS.googleAnalytics}-lib`);
      }

      // Inject Google Tag Manager
      if (seoSettings.googleTagManagerId) {
        removeById(INJECTED_MARKERS.googleTagManager);
        removeById(INJECTED_MARKERS.googleTagManagerNoscript);
        
        // GTM script
        const gtmScript = document.createElement('script');
        gtmScript.id = INJECTED_MARKERS.googleTagManager;
        gtmScript.textContent = `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${seoSettings.googleTagManagerId}');
        `;
        document.head.appendChild(gtmScript);
        
        // GTM noscript fallback
        const gtmNoscript = document.createElement('noscript');
        gtmNoscript.id = INJECTED_MARKERS.googleTagManagerNoscript;
        gtmNoscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${seoSettings.googleTagManagerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.insertBefore(gtmNoscript, document.body.firstChild);
      } else {
        removeById(INJECTED_MARKERS.googleTagManager);
        removeById(INJECTED_MARKERS.googleTagManagerNoscript);
      }

      // Inject Facebook Pixel
      if (seoSettings.facebookPixelId) {
        removeById(INJECTED_MARKERS.facebookPixel);
        
        const fbScript = document.createElement('script');
        fbScript.id = INJECTED_MARKERS.facebookPixel;
        fbScript.textContent = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${seoSettings.facebookPixelId}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(fbScript);
      } else {
        removeById(INJECTED_MARKERS.facebookPixel);
      }

      // Inject custom CSS
      if (seoSettings.customCss) {
        removeById(INJECTED_MARKERS.customCss);
        const styleTag = document.createElement('style');
        styleTag.id = INJECTED_MARKERS.customCss;
        styleTag.textContent = seoSettings.customCss;
        document.head.appendChild(styleTag);
      } else {
        removeById(INJECTED_MARKERS.customCss);
      }

      // Inject custom JS
      if (seoSettings.customJs) {
        injectScript(INJECTED_MARKERS.customJs, seoSettings.customJs, 'body');
      } else {
        removeById(INJECTED_MARKERS.customJs);
      }
    }

  }, [
    propTitle, propDescription, propKeywords, propImage, propSiteName, propNoIndex,
    url, type, twitterCard, author, publishedTime,
    seoSettings, generalSettings, seoLoading, generalLoading, location.pathname, getPageSEO
  ]);

  return null;
};

export default SEOHead;
