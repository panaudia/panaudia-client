import os
from ticket_util import make_keys

KEYS_PATH = "keys"
PUBLIC_KEY_PATH = "%s/panaudia_key.pub" % KEYS_PATH
PRIVATE_KEY_PATH = "%s/panaudia_key" % KEYS_PATH

def public_key():
    _ensure_key_pair()
    with open(PUBLIC_KEY_PATH) as f:
        return f.read()

def private_key():
    _ensure_key_pair()
    with open(PRIVATE_KEY_PATH) as f:
        return f.read()

def _ensure_key_pair():
    if not os.path.exists(KEYS_PATH):
        os.mkdir(KEYS_PATH)
        public, private = make_keys()
        with open(PRIVATE_KEY_PATH, "w") as f:
            f.write(private)
        with open(PUBLIC_KEY_PATH, "w") as f:
            f.write(public)