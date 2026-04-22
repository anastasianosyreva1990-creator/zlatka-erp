import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, sewers(*)')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Profile error:', error)
      // Если профиль не найден — возвращаем дефолтный админ профиль
      return { id: user.id, role: 'admin', name: user.email }
    }

    return profile
  } catch (e) {
    console.error('Auth error:', e)
    return null
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
