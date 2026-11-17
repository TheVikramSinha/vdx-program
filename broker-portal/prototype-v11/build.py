from pathlib import Path
import re
s=Path('Veridex-Interactive-Broker-Portal-Prototype 7.html').read_text()
a=s.index('/* Version 7: focused broker workflows');b=s.index('\nboot();',a)
ext='\n'.join(Path('prototype-v11/'+f).read_text() for f in ['enhancements.js','review-updates.js','table-essentials.js','components.js','updates.js'])
s=s[:a]+ext+s[b:]
s=s.replace('veridex-broker-prototype-v7','veridex-broker-prototype-v11').replace('Version 7 · Local prototype','Version 11 · Local prototype').replace('version 9','version 11').replace('Version 9','Version 11')
s=s.replace("const branchVisible=a=>S.branch==='All branches'||a?.branch===S.branch;",'const branchVisible=a=>true;')
s=s.replace("${simple('Branch','branch',{options:branchOptions(d.branch),required:true})}",'')
s=s.replace("${S.role==='Admin'?act(icon('building')+esc(S.branch)+' <span class=\"muted\">⌄</span>','branches',{},'btn branch-control'):''}",'')
s=s.replace('<title>','<title>Version 11 · ',1)
s=s.replace('</style></head>','\n'+Path('prototype-v11/design.css').read_text()+'\n</style></head>',1)
Path('Veridex-Interactive-Broker-Portal-Prototype 11.html').write_text(s)
for i,m in enumerate(re.finditer(r'<script([^>]*)>([\s\S]*?)</script>',s)):
 if 'application/json' not in m[1] and 'src=' not in m[1]:Path(f'/tmp/v11-check-{i}.js').write_text(m[2])
print('Built standalone version 11.')
