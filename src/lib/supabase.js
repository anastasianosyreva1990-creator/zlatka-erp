import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eqakagcbrzqfbsrgzaeh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWthZ2NicnpxZmJzcmd6YWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTQ4NzgsImV4cCI6MjA5MTk5MDg3OH0.Hgv8sVv4lctRLzxbrsvYt8kg-IRKVeRMjXl6fq9Ytew'

export const supabase = createClient(supabaseUrl, supabaseKey)