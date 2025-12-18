import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, Trash2, RefreshCw } from "lucide-react";

const AdminCache = () => {
  const [cacheStats] = useState({ size: '2.4 MB', items: 156, hitRate: '94%' });

  const clearCache = (type: string) => {
    toast.success(`${type} cache cleared!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8 text-primary" />
            Cache Control
          </h1>
          <p className="text-muted-foreground">Manage application cache</p>
        </div>
        <Button variant="destructive" onClick={() => clearCache('All')}><Trash2 className="w-4 h-4 mr-2" /> Clear All Cache</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Cache Size', value: cacheStats.size }, { label: 'Cached Items', value: cacheStats.items }, { label: 'Hit Rate', value: cacheStats.hitRate }].map(stat => (
          <Card key={stat.label}><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{stat.value}</p><p className="text-muted-foreground">{stat.label}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Cache Types</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {['Page Cache', 'API Cache', 'Session Cache', 'Asset Cache'].map(type => (
            <div key={type} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <span>{type}</span>
              <Button variant="outline" size="sm" onClick={() => clearCache(type)}><RefreshCw className="w-4 h-4 mr-2" /> Clear</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCache;
