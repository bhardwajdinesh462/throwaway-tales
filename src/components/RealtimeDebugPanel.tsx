import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Radio, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Circle
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface RealtimeEvent {
  id: string;
  type: "INSERT" | "UPDATE" | "DELETE" | "STATUS" | "ERROR";
  table?: string;
  payload?: any;
  timestamp: Date;
}

interface RealtimeDebugPanelProps {
  tempEmailId?: string;
  className?: string;
}

export const RealtimeDebugPanel = ({ tempEmailId, className = "" }: RealtimeDebugPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [channelStatus, setChannelStatus] = useState<string>("CLOSED");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  const addEvent = useCallback((event: Omit<RealtimeEvent, "id" | "timestamp">) => {
    setEvents((prev) => [
      { ...event, id: crypto.randomUUID(), timestamp: new Date() },
      ...prev.slice(0, 49), // Keep last 50 events
    ]);
  }, []);

  const setupChannel = useCallback(() => {
    if (!tempEmailId) return;

    // Clean up existing channel
    if (channelRef.current) {
      api.realtime.removeChannel(channelRef.current);
    }

    const channelName = `debug-realtime-${tempEmailId}`;
    const channel = api.realtime.channel(channelName);

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "received_emails",
          filter: `temp_email_id=eq.${tempEmailId}`,
        },
        (payload) => {
          console.log("[RealtimeDebug] Event received:", payload);
          addEvent({
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "received_emails",
            payload: payload.new || payload.old,
          });
        }
      )
      .subscribe((status, error) => {
        console.log("[RealtimeDebug] Channel status:", status, error);
        setChannelStatus(status);
        
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
          addEvent({ type: "STATUS", payload: { status: "Connected" } });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsSubscribed(false);
          if (error) {
            addEvent({ type: "ERROR", payload: { error: error.message } });
          }
        } else if (status === "TIMED_OUT") {
          setReconnectAttempts((prev) => prev + 1);
          addEvent({ type: "STATUS", payload: { status: "Reconnecting...", attempt: reconnectAttempts + 1 } });
        }
      });

    channelRef.current = channel;
  }, [tempEmailId, addEvent, reconnectAttempts]);

  useEffect(() => {
    if (isOpen && tempEmailId) {
      setupChannel();
    }

    return () => {
      if (channelRef.current) {
        api.realtime.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOpen, tempEmailId, setupChannel]);

  const handleReconnect = () => {
    setReconnectAttempts(0);
    setupChannel();
  };

  const handleClear = () => {
    setEvents([]);
  };

  const getStatusColor = () => {
    switch (channelStatus) {
      case "SUBSCRIBED":
        return "bg-green-500";
      case "SUBSCRIBING":
        return "bg-yellow-500 animate-pulse";
      case "CLOSED":
        return "bg-gray-500";
      case "CHANNEL_ERROR":
      case "TIMED_OUT":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getEventBadgeVariant = (type: string) => {
    switch (type) {
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      case "STATUS":
        return "outline";
      case "ERROR":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="border-dashed border-primary/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>Realtime Debug</span>
                <Circle className={`w-2 h-2 ${getStatusColor()}`} />
                <span className="text-xs text-muted-foreground font-normal">
                  {channelStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {events.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {events.length} events
                  </Badge>
                )}
                {reconnectAttempts > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {reconnectAttempts} reconnects
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* Status Bar */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {isSubscribed ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  Channel: received_emails (temp_email_id={tempEmailId?.slice(0, 8)}...)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 px-2">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReconnect} className="h-6 px-2">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reconnect
                </Button>
              </div>
            </div>

            {/* Event Log */}
            <ScrollArea className="h-48 rounded border border-border bg-muted/30">
              <div className="p-2 space-y-1">
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Waiting for realtime events...
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-xs p-1.5 rounded bg-background/50 hover:bg-background/80"
                    >
                      <Badge variant={getEventBadgeVariant(event.type)} className="text-[10px] px-1.5 shrink-0">
                        {event.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        {event.table && (
                          <span className="text-muted-foreground">{event.table}: </span>
                        )}
                        <span className="text-foreground break-all">
                          {event.payload?.subject || event.payload?.from_address || event.payload?.status || JSON.stringify(event.payload)?.slice(0, 100)}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Info */}
            <p className="text-[10px] text-muted-foreground">
              This panel shows live Supabase realtime events for your inbox. Events appear when new emails arrive via the database channel.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default RealtimeDebugPanel;
