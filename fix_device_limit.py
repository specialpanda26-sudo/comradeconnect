import sys
def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        if s.count(a) != 1:
            sys.exit('NOT FOUND (or already changed) in ' + path + ': ' + a[:60])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

# the default limit (used when the host does not set DEVICE_MAX_ACCOUNTS)
edit('backend/server.js', [("DEVICE_MAX_ACCOUNTS: '1'", "DEVICE_MAX_ACCOUNTS: '3'")])
edit('render.yaml', [('- { key: DEVICE_MAX_ACCOUNTS, value: "1" }', '- { key: DEVICE_MAX_ACCOUNTS, value: "3" }')])

# clearer messages now that more than one account is allowed
edit('backend/src/device.js', [
("'This device already has a Comrade Connect account. Sign in to it instead. If this is a mistake, contact support.'",
 "'This device has reached the limit of ' + maxAccounts(env) + ' Comrade Connect accounts. Sign in to one of them instead. If this is a mistake, contact support.'"),
("'This device already has a Comrade Connect account. Sign in to it instead.'",
 "'This device has reached the limit of ' + maxAccounts(env) + ' Comrade Connect accounts. Sign in to one of them instead.'"),
])
print('Device limit is now 3')
