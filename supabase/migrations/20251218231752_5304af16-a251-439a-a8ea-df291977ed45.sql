-- Create blogs table for database persistence
CREATE TABLE IF NOT EXISTS public.blogs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    excerpt text,
    content text NOT NULL,
    featured_image_url text,
    meta_title text,
    meta_description text,
    tags text[] DEFAULT '{}',
    category text DEFAULT 'General',
    author text NOT NULL,
    reading_time integer DEFAULT 5,
    published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Public can read published blogs
CREATE POLICY "Anyone can read published blogs"
ON public.blogs FOR SELECT
USING (published = true);

-- Admins can manage all blogs
CREATE POLICY "Admins can manage blogs"
ON public.blogs FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_blogs_updated_at
BEFORE UPDATE ON public.blogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add width, height, and size_name columns to banners table for size presets
ALTER TABLE public.banners 
ADD COLUMN IF NOT EXISTS width integer DEFAULT 728,
ADD COLUMN IF NOT EXISTS height integer DEFAULT 90,
ADD COLUMN IF NOT EXISTS size_name text DEFAULT 'leaderboard';

-- Create security definer function for admins to fetch all profiles
CREATE OR REPLACE FUNCTION public.get_all_profiles_for_admin(
    p_search text DEFAULT NULL,
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    updated_at timestamptz,
    role text,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset integer;
    v_total bigint;
BEGIN
    -- Check if user is admin
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    v_offset := (p_page - 1) * p_page_size;
    
    -- Get total count
    SELECT COUNT(*) INTO v_total
    FROM public.profiles p
    WHERE (p_search IS NULL OR p_search = '' OR 
           p.email ILIKE '%' || p_search || '%' OR 
           p.display_name ILIKE '%' || p_search || '%');
    
    -- Return results with roles
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.email,
        p.display_name,
        p.avatar_url,
        p.created_at,
        p.updated_at,
        COALESCE(ur.role::text, 'user') as role,
        v_total as total_count
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE (p_search IS NULL OR p_search = '' OR 
           p.email ILIKE '%' || p_search || '%' OR 
           p.display_name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset;
END;
$$;