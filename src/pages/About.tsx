import { motion } from 'framer-motion';
import { 
  Shield, Users, Globe, Mail, Heart, Zap, 
  Target, Award, Sparkles, Building, CheckCircle 
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const About = () => {
  const stats = [
    { value: '1M+', label: 'Emails Protected', icon: Mail },
    { value: '50K+', label: 'Active Users', icon: Users },
    { value: '99.9%', label: 'Uptime', icon: Zap },
    { value: '150+', label: 'Countries', icon: Globe },
  ];

  const values = [
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'We believe privacy is a fundamental right. Your data belongs to you, and we will never sell or share it with third parties.',
    },
    {
      icon: Heart,
      title: 'User-Centric',
      description: 'Every feature we build starts with our users. We listen to feedback and continuously improve based on your needs.',
    },
    {
      icon: Zap,
      title: 'Innovation',
      description: 'We leverage cutting-edge technology including AI to provide the best temporary email experience possible.',
    },
    {
      icon: Globe,
      title: 'Accessibility',
      description: 'Privacy protection should be available to everyone. Our free tier ensures basic privacy features are always accessible.',
    },
  ];

  const team = [
    {
      name: 'Nullsto Team',
      role: 'Founders & Developers',
      description: 'A passionate team dedicated to protecting online privacy through innovative email solutions.',
    },
  ];

  const milestones = [
    { year: '2024', event: 'Nullsto launched with advanced privacy features' },
    { year: '2024', event: 'AI-powered email summaries introduced' },
    { year: '2024', event: 'Reached 50,000+ active users globally' },
    { year: '2025', event: 'Expanding with enterprise features and API access' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[150px]" />
      </div>

      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto mb-20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-6 backdrop-blur-sm"
            >
              <Building className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                About Nullsto
              </span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              Protecting Your
              <span className="block mt-2">
                <span className="gradient-text">Digital Privacy</span>
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Nullsto.edu.pl is a privacy-focused temporary email service designed to protect 
              your real inbox from spam, phishing, and unwanted communications.
            </p>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
          >
            {stats.map((stat, index) => (
              <Card key={index} className="glass-card text-center p-6 hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-0">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</p>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Mission Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-8 md:p-12 mb-20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary-foreground" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Our Mission</h2>
              </div>
              <p className="text-lg text-muted-foreground max-w-3xl">
                At Nullsto, our mission is to make online privacy accessible to everyone. 
                In today's digital world, your email is a gateway to your personal information. 
                We provide a secure, disposable email solution that protects your identity while 
                maintaining the convenience you need for online interactions.
              </p>
              <p className="text-lg text-muted-foreground max-w-3xl mt-4">
                Whether you're signing up for a new service, testing applications, or simply 
                want to avoid spam, Nullsto gives you the control over your digital footprint.
              </p>
            </div>
          </motion.div>

          {/* Values Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Values</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Card className="h-full hover:border-primary/30 transition-all duration-300 group">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <value.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                      <p className="text-muted-foreground text-sm">{value.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Timeline Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Journey</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Key milestones in our mission to protect online privacy
              </p>
            </div>
            <div className="max-w-2xl mx-auto">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex gap-4 mb-6 last:mb-0"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    {index < milestones.length - 1 && (
                      <div className="w-0.5 h-full bg-primary/20 mt-2" />
                    )}
                  </div>
                  <div className="pb-6">
                    <span className="text-primary font-semibold">{milestone.year}</span>
                    <p className="text-foreground">{milestone.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-center glass-card p-8 md:p-12"
          >
            <Sparkles className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Ready to Protect Your Privacy?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Join thousands of users who trust Nullsto for their email privacy needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline">
                  Contact Us
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
