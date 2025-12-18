import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Clock, Play, Pause, RefreshCw, Database } from "lucide-react";

const AdminCron = () => {
  const [jobs] = useState([
    { id: '1', name: 'Clean Expired Emails', schedule: '0 * * * *', lastRun: new Date().toISOString(), status: 'active' },
    { id: '2', name: 'Send Notifications', schedule: '*/5 * * * *', lastRun: new Date().toISOString(), status: 'active' },
    { id: '3', name: 'Database Backup', schedule: '0 0 * * *', lastRun: new Date().toISOString(), status: 'paused' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="w-8 h-8 text-primary" />
            Cron Jobs
          </h1>
          <p className="text-muted-foreground">Manage scheduled tasks</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Scheduled Jobs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium">{job.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{job.schedule}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={job.status === 'active' ? "bg-green-500/20 text-green-500" : "bg-gray-500/20"}>{job.status}</Badge>
                <Button variant="ghost" size="sm" onClick={() => toast.success(`Running ${job.name}...`)}><Play className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCron;
