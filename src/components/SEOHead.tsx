import { useEffect } from 'react';
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

  useEffect(() => {
    if (seoLoading || generalLoading) return;

    // Get page-specific SEO settings
    const pageSEO = getPageSEO(location.pathname);

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
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
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

    // Inject custom CSS
    if (seoSettings.customCss) {
      let styleTag = document.getElementById('custom-css-injected') as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-css-injected';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = seoSettings.customCss;
    }

    // Inject custom JS (deferred)
    if (seoSettings.customJs) {
      let scriptTag = document.getElementById('custom-js-injected') as HTMLScriptElement;
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'custom-js-injected';
        document.body.appendChild(scriptTag);
      }
      scriptTag.textContent = seoSettings.customJs;
    }

  }, [
    propTitle, propDescription, propKeywords, propImage, propSiteName, propNoIndex,
    url, type, twitterCard, author, publishedTime,
    seoSettings, generalSettings, seoLoading, generalLoading, location.pathname, getPageSEO
  ]);

  return null;
};

export default SEOHead;
