import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';

export const BlogSubscribeForm = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await api.functions.invoke<{ success?: boolean; alreadySubscribed?: boolean; error?: string }>('blog-subscribe', {
        body: { email }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Successfully subscribed! You\'ll receive updates when new posts are published.');
        setEmail('');
      } else if (data?.alreadySubscribed) {
        toast.info('You\'re already subscribed to our blog updates.');
      } else {
        throw new Error(data?.error || 'Failed to subscribe');
      }
    } catch (error: any) {
      console.error('Subscribe error:', error);
      toast.error(error.message || 'Failed to subscribe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-primary" />
          Subscribe to Updates
        </CardTitle>
        <CardDescription>
          Get notified when we publish new articles. No spam, unsubscribe anytime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubscribe} className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Subscribe'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
