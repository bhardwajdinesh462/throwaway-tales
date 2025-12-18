-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create domains table
CREATE TABLE public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_premium BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create temp_emails table (generated temporary addresses)
CREATE TABLE public.temp_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address TEXT NOT NULL UNIQUE,
  domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 hour') NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create received_emails table (messages received)
CREATE TABLE public.received_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temp_email_id UUID REFERENCES public.temp_emails(id) ON DELETE CASCADE NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  html_body TEXT,
  is_read BOOLEAN DEFAULT false NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create saved_emails table (user favorites)
CREATE TABLE public.saved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  received_email_id UUID REFERENCES public.received_emails(id) ON DELETE CASCADE NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, received_email_id)
);

-- Create app settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS Policies for user_roles (only admins)
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for domains (public read, admin write)
CREATE POLICY "Anyone can view active domains" ON public.domains
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage domains" ON public.domains
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for temp_emails
CREATE POLICY "Anyone can create temp emails" ON public.temp_emails
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own temp emails" ON public.temp_emails
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Admins can view all temp emails" ON public.temp_emails
  FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS Policies for received_emails
CREATE POLICY "Users can view emails for their temp addresses" ON public.received_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.temp_emails 
      WHERE temp_emails.id = received_emails.temp_email_id 
      AND (temp_emails.user_id IS NULL OR temp_emails.user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert received emails" ON public.received_emails
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update read status" ON public.received_emails
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.temp_emails 
      WHERE temp_emails.id = received_emails.temp_email_id 
      AND (temp_emails.user_id IS NULL OR temp_emails.user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all received emails" ON public.received_emails
  FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS Policies for saved_emails
CREATE POLICY "Users can manage their saved emails" ON public.saved_emails
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for app_settings (admin only write, public read for non-sensitive)
CREATE POLICY "Admins can manage settings" ON public.app_settings
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view settings" ON public.app_settings
  FOR SELECT USING (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default domains
INSERT INTO public.domains (name, is_active, is_premium) VALUES
  ('@trashmail.io', true, false),
  ('@tempbox.net', true, false),
  ('@quickmail.xyz', true, false),
  ('@disposable.email', true, false),
  ('@burner.mail', true, true);

-- Enable realtime for received emails
ALTER PUBLICATION supabase_realtime ADD TABLE public.received_emails;