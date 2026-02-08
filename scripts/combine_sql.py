import os
import datetime

# Define the order of files
file_order = [
    'schema.sql',
    'fix_rls_recursion.sql',
    'add_hp_sanity.sql',
    'add_spirit_travel.sql',
    'add_maps.sql',
    'add_map_tokens.sql',
    'add_skill_system.sql',
    'add_pathway_images.sql',
    'fix_sequence_range.sql',
    'fix_skill_rls.sql',
    'repair_profiles.sql'
]

base_path = r'c:\Users\chain\Documents\Thai Witchcraft\My Art Work\whisper\supabase'
output_file = os.path.join(base_path, 'setup_complete.sql')

try:
    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write('-- ══════════════════════════════════════════════════════════════\n')
        outfile.write('-- WHISPER DND — Complete Setup Script\n')
        outfile.write(f'-- Generated on: {datetime.datetime.now()}\n')
        outfile.write('-- ══════════════════════════════════════════════════════════════\n\n')

        for filename in file_order:
            filepath = os.path.join(base_path, filename)
            if os.path.exists(filepath):
                outfile.write(f'-- ══════════════════════════════════════════════════════════════\n')
                outfile.write(f'-- START OF FILE: {filename}\n')
                outfile.write(f'-- ══════════════════════════════════════════════════════════════\n')
                with open(filepath, 'r', encoding='utf-8') as infile:
                    outfile.write(infile.read())
                outfile.write(f'\n\n-- END OF FILE: {filename}\n\n')
                print(f'Added {filename}')
            else:
                print(f'Warning: {filename} not found')

    print(f'Successfully created {output_file}')
except Exception as e:
    print(f"Error: {e}")
