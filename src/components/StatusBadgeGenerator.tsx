import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Code, Copy, Check, Globe, ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StatusBadgeGeneratorProps {
  baseUrl?: string;
  currentStatus?: 'operational' | 'degraded' | 'outage';
  uptime?: number;
}

const StatusBadgeGenerator = ({ 
  baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://example.com',
  currentStatus = 'operational',
  uptime = 99.9
}: StatusBadgeGeneratorProps) => {
  const [service, setService] = useState("overall");
  const [format, setFormat] = useState("svg");
  const [size, setSize] = useState("medium");
  const [copied, setCopied] = useState<string | null>(null);

  const badgeUrl = `${baseUrl}/api/badge/uptime?service=${service}&format=${format}&size=${size}`;
  const jsonUrl = `${baseUrl}/api/badge/uptime?service=${service}&format=json`;

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'operational': return '#22c55e';
      case 'degraded': return '#eab308';
      case 'outage': return '#ef4444';
      default: return '#22c55e';
    }
  };

  const getStatusText = () => {
    switch (currentStatus) {
      case 'operational': return 'operational';
      case 'degraded': return 'degraded';
      case 'outage': return 'outage';
      default: return 'operational';
    }
  };

  const embedCodes = {
    html: `<a href="${baseUrl}/status" target="_blank">
  <img src="${badgeUrl}" alt="System Status" />
</a>`,
    markdown: `[![Status](${badgeUrl})](${baseUrl}/status)`,
    bbcode: `[url=${baseUrl}/status][img]${badgeUrl}[/img][/url]`,
    json: `fetch('${jsonUrl}')
  .then(res => res.json())
  .then(data => console.log(data));`
  };

  const handleCopy = async (code: string, type: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(type);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // SVG Preview (inline rendering)
  const SvgPreview = () => {
    const width = size === 'small' ? 90 : size === 'medium' ? 110 : 130;
    const height = size === 'small' ? 18 : size === 'medium' ? 20 : 24;
    const fontSize = size === 'small' ? 9 : size === 'medium' ? 11 : 13;
    
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={width} 
        height={height}
        className="rounded"
      >
        <linearGradient id="bg" x2="0" y2="100%">
          <stop offset="0" stopColor="#bbb" stopOpacity=".1"/>
          <stop offset="1" stopOpacity=".1"/>
        </linearGradient>
        <clipPath id="r">
          <rect width={width} height={height} rx="3" fill="#fff"/>
        </clipPath>
        <g clipPath="url(#r)">
          <rect width="50" height={height} fill="#555"/>
          <rect x="50" width={width - 50} height={height} fill={getStatusColor()}/>
          <rect width={width} height={height} fill="url(#bg)"/>
        </g>
        <g fill="#fff" textAnchor="middle" fontFamily="DejaVu Sans,Verdana,Geneva,sans-serif" fontSize={fontSize}>
          <text x="25" y={height * 0.7} fill="#010101" fillOpacity=".3">status</text>
          <text x="25" y={height * 0.65}>status</text>
          <text x={(50 + width) / 2} y={height * 0.7} fill="#010101" fillOpacity=".3">{getStatusText()}</text>
          <text x={(50 + width) / 2} y={height * 0.65}>{getStatusText()}</text>
        </g>
      </svg>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Code className="w-4 h-4 text-primary" />
          Display Status on Your Site
        </CardTitle>
        <CardDescription>
          Embed a status badge on your website to show service status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Badge Preview */}
        <div className="flex flex-col items-center gap-4 p-6 bg-secondary/30 rounded-lg">
          <p className="text-sm text-muted-foreground">Live Preview</p>
          <div className="bg-background p-4 rounded-lg border">
            <SvgPreview />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            <span>Current: {uptime}% uptime</span>
          </div>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Service</label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Status</SelectItem>
                <SelectItem value="imap">IMAP Service</SelectItem>
                <SelectItem value="smtp">SMTP Service</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="svg">SVG Image</SelectItem>
                <SelectItem value="json">JSON API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Size</label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Embed Codes */}
        <Tabs defaultValue="html" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="bbcode">BBCode</TabsTrigger>
            <TabsTrigger value="json">JSON API</TabsTrigger>
          </TabsList>
          
          {Object.entries(embedCodes).map(([type, code]) => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="relative">
                <pre className="p-4 bg-secondary/50 rounded-lg overflow-x-auto text-xs sm:text-sm">
                  <code className="text-foreground">{code}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(code, type)}
                >
                  {copied === type ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Direct Links */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={badgeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-2" />
              Open Badge URL
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={jsonUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-2" />
              View JSON API
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusBadgeGenerator;
