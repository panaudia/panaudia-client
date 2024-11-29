import uuid

from flask import Flask, render_template
from ticket_util import make_ticket
import keys

import config as config

APP_SCHEME = "https"
APP_HOST = "panaudia.com"

PRIVATE_KEY = keys.private_key()
PUBLIC_KEY = keys.public_key()

app = Flask("town_square")

@app.route("/")
def index():

    player_id = str(uuid.uuid4())
    ticket = make_ticket(PRIVATE_KEY, config.SPACE_ID, "anon", uid=player_id, issued_by=config.AUTHORITY)
    lookup_url = "%s://%s/gateway" % (APP_SCHEME, APP_HOST)
    rsp = render_template('index.html', player_id=player_id, ticket=ticket, lookup_url=lookup_url)
    return rsp, 200, {}


if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=4443, debug=True, ssl_context=('server.crt', 'server.key'))
    app.run(host='0.0.0.0', port=8000, debug=True)
