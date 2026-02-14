import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

async function test() {
  const { data, error } = await supabase.from('jeux').select('*').limit(5)
  if (error) console.error('Erreur:', error)
  else console.log('Données Supabase:', data)
}

test()
