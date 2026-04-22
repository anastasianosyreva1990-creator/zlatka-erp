import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getRole(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('role, sewer_id, sewers(*)')
    .eq('id', userId)
    .single()
  return data
}
