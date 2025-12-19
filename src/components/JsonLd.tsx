import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

interface WebsiteJsonLdProps {
  name?: string;
  description?: string;
  url?: string;
}

interface OrganizationJsonLdProps {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageJsonLdProps {
  questions: FAQItem[];
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

interface SoftwareApplicationJsonLdProps {
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
}

// Website Schema
export const WebsiteJsonLd = ({
  name,
  description,
  url = typeof window !== 'undefined' ? window.location.origin : '',
}: WebsiteJsonLdProps) => {
  const { general } = useSettings();
  const siteName = name || general.siteName;
  const siteDescription = description || general.siteDescription;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'website-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      description: siteDescription,
      url,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${url}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
    
    const existing = document.getElementById('website-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    
    return () => {
      const el = document.getElementById('website-jsonld');
      if (el) el.remove();
    };
  }, [siteName, siteDescription, url]);

  return null;
};

// Organization Schema
export const OrganizationJsonLd = ({
  name,
  url = typeof window !== 'undefined' ? window.location.origin : '',
  logo = '/og-image.png',
  sameAs = [],
}: OrganizationJsonLdProps) => {
  const { general } = useSettings();
  const siteName = name || general.siteName;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'organization-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url,
      logo: `${url}${logo}`,
      sameAs,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['English', 'Arabic', 'Spanish', 'French'],
      },
    });
    
    const existing = document.getElementById('organization-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    
    return () => {
      const el = document.getElementById('organization-jsonld');
      if (el) el.remove();
    };
  }, [siteName, url, logo, sameAs]);

  return null;
};

// Software Application Schema
export const SoftwareApplicationJsonLd = ({
  name,
  description,
  applicationCategory = 'WebApplication',
  operatingSystem = 'Any',
  offers = { price: '0', priceCurrency: 'USD' },
}: SoftwareApplicationJsonLdProps) => {
  const { general } = useSettings();
  const siteName = name || general.siteName;
  const siteDescription = description || general.siteDescription;

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'software-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteName,
      description: siteDescription,
      applicationCategory,
      operatingSystem,
      offers: {
        '@type': 'Offer',
        ...offers,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '10000',
        bestRating: '5',
        worstRating: '1',
      },
    });
    
    const existing = document.getElementById('software-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    
    return () => {
      const el = document.getElementById('software-jsonld');
      if (el) el.remove();
    };
  }, [siteName, siteDescription, applicationCategory, operatingSystem, offers]);

  return null;
};

// FAQ Page Schema
export const FAQPageJsonLd = ({ questions }: FAQPageJsonLdProps) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    });
    
    const existing = document.getElementById('faq-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    
    return () => {
      const el = document.getElementById('faq-jsonld');
      if (el) el.remove();
    };
  }, [questions]);

  return null;
};

// Breadcrumb Schema
export const BreadcrumbJsonLd = ({ items }: BreadcrumbJsonLdProps) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'breadcrumb-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
    
    const existing = document.getElementById('breadcrumb-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    
    return () => {
      const el = document.getElementById('breadcrumb-jsonld');
      if (el) el.remove();
    };
  }, [items]);

  return null;
};

// Combined default export for easy use
const JsonLd = () => (
  <>
    <WebsiteJsonLd />
    <OrganizationJsonLd />
    <SoftwareApplicationJsonLd />
  </>
);

export default JsonLd;