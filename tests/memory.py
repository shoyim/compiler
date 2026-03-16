import requests, json

code = '''
import sys
data = ' ' * (50 * 1024 * 1024)  # 50MB
print(sys.getsizeof(data))
'''

resp = requests.post('http://localhost:2000/api/v2/execute', json={
    'language': 'python',
    'version': '3.12',
    'files': [{'name': 'main.py', 'content': code}],
    'stdin': '',
    'run_timeout': 10000,
    'run_cpu_time': 5000,
    'compile_memory_limit': -1,
    'run_memory_limit': -1
})
data = resp.json()

print(data)

print('stdout (python getsizeof):', data['run']['stdout'].strip())
print('piston memory (bytes):', data['run']['memory'])
print('piston memory (MB):', round(int(data['run']['memory']) / 1024 / 1024, 2) if data['run']['memory'] else 'null')
