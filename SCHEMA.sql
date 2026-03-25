-- Create the 'obligations' table
CREATE TABLE IF NOT EXISTS public.obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    category TEXT DEFAULT 'other',
    penalty INTEGER DEFAULT 0,
    flexibility INTEGER DEFAULT 1,
    is_paid BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own data
CREATE POLICY "Users can manage their own obligations" 
ON public.obligations 
FOR ALL 
USING (auth.uid() = user_id);
