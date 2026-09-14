import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots { return { rules:{userAgent:'*',allow:'/'}, sitemap:'https://us-market-ai.vercel.app/sitemap.xml' }; }
