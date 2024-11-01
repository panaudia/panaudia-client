import uuid

from flask import Flask, render_template
from ticket_util import make_ticket
import config as config

app = Flask("town_square")

@app.route("/")
def index():

    player_id = str(uuid.uuid4())
    ticket = make_ticket(config.PRIVATE_KEY, config.SPACE_ID, "anon", uid=player_id, issued_by=config.AUTHORITY)
    lookup_url = "%s://%s/entrance" % (config.APP_SCHEME, config.APP_HOST)
    return render_template('index.html', player_id=player_id, ticket=ticket, lookup_url=lookup_url)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
